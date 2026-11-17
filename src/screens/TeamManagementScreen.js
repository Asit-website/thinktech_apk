import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import {
  API_BASE_URL,
  getTeamMembers,
  getTeamMemberProfile,
  getTeamAttendance,
  getTeamRegularizations,
  reviewTeamRegularization,
  getTeamLateApprovals,
  reviewTeamLateApproval,
  getTeamDashboardStats
} from '../config/api';
import { notifyError, notifySuccess } from '../utils/notify';
import BottomNav from '../components/BottomNav';

function formatDisplayDate(d) {
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatLongDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch (_) {
    return String(dateStr);
  }
}

function formatBreakTime(seconds) {
  if (seconds && Number(seconds) > 0) {
    return `${(Number(seconds) / 3600).toFixed(2)}h`;
  }
  return '-';
}

function formatWorkHours(hours, checkIn, checkOut) {
  const h = Number(hours);
  if (Number.isFinite(h) && h > 0) {
    return `${h.toFixed(2)}h`;
  }
  if (checkIn && checkOut) {
    try {
      const [inH, inM] = checkIn.split(':').map(Number);
      const [outH, outM] = checkOut.split(':').map(Number);
      let diffMin = (outH * 60 + outM) - (inH * 60 + inM);
      if (diffMin < 0) diffMin += 1440;
      return `${(diffMin / 60).toFixed(2)}h`;
    } catch (_) {}
  }
  return '-';
}

function getInitials(name) {
  if (!name) return 'ST';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
}

function getPhotoUrl(p) {
  if (!p) return null;
  const str = String(p).trim();
  if (!str) return null;
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  const base = API_BASE_URL || (__DEV__ ? 'http://localhost:4000' : 'https://backend.vetansutra.com');
  return `${base}${str.startsWith('/') ? '' : '/'}${str}`;
}

function renderStatusBadge(status) {
  const s = String(status || '').toUpperCase();
  let bg = '#E2E8F0', color = '#475569', label = s || 'NOT MARKED';
  if (s === 'PRESENT' || s === 'APPROVED') { bg = '#DCFCE7'; color = '#15803D'; label = s; }
  else if (s === 'ABSENT' || s === 'REJECTED') { bg = '#FEE2E2'; color = '#B91C1C'; label = s; }
  else if (s === 'HALF_DAY') { bg = '#FEF3C7'; color = '#B45309'; label = 'HALF DAY'; }
  else if (s === 'PENDING' || s === 'PENDING_APPROVAL') { bg = '#DBEAFE'; color = '#1D4ED8'; label = 'PENDING'; }
  else if (s === 'LEAVE') { bg = '#F3E8FF'; color = '#7E22CE'; label = 'LEAVE'; }
  else if (s === 'OVERTIME') { bg = '#E0F2FE'; color = '#0369A1'; label = 'OVERTIME'; }
  else if (s === 'WEEK_OFF') { bg = '#F1F5F9'; color = '#64748B'; label = 'WEEK OFF'; }
  else if (s === 'HOLIDAY') { bg = '#E0F2FE'; color = '#0369A1'; label = 'HOLIDAY'; }

  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function TeamManagementScreen({ navigation }) {
  // 'members' | 'attendance' | 'regularization' | 'latePunch'
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Attendance Tab State (VIEW ONLY)
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceList, setAttendanceList] = useState([]);
  const [attLoading, setAttLoading] = useState(false);

  // Profile Modal State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Regularization State
  const [regList, setRegList] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  // Late Punch Approvals State
  const [lateList, setLateList] = useState([]);
  const [lateLoading, setLateLoading] = useState(false);
  const [lateFilter, setLateFilter] = useState('ALL');

  const displayedLateList = useMemo(() => {
    if (lateFilter === 'ALL') return lateList;
    return lateList.filter(r => r.status === lateFilter);
  }, [lateList, lateFilter]);

  // Reject Remarks Modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectType, setRejectType] = useState('reg'); // 'reg' | 'late'
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Load Team Members
  const loadMembers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const resp = await getTeamMembers(search);
      if (resp?.success) {
        setMembers(resp.members || []);
        if (resp.teamName) setTeamName(resp.teamName);
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  // Load Attendance (View Only)
  const loadAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const dateStr = formatDisplayDate(selectedDate);
      const resp = await getTeamAttendance(dateStr);
      if (resp?.success) {
        setAttendanceList(resp.attendance || []);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setAttLoading(false);
    }
  }, [selectedDate]);

  // Load Regularizations
  const loadRegularizations = useCallback(async () => {
    setRegLoading(true);
    try {
      const resp = await getTeamRegularizations();
      if (resp?.success) {
        setRegList(resp.regularizations || []);
      }
    } catch (err) {
      console.error('Failed to load regularizations:', err);
    } finally {
      setRegLoading(false);
    }
  }, []);

  // Dashboard Stats State
  const [dashboardStats, setDashboardStats] = useState({
    totalAssigned: 0,
    presentToday: 0,
    absentToday: 0,
    onLeaveToday: 0
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const loadDashboardStats = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const resp = await getTeamDashboardStats();
      if (resp?.success && resp.stats) {
        setDashboardStats(resp.stats);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // Load Late Punch Approvals
  const loadLateApprovals = useCallback(async () => {
    setLateLoading(true);
    try {
      const resp = await getTeamLateApprovals();
      if (resp?.success) {
        setLateList(resp.list || []);
      }
    } catch (err) {
      console.error('Failed to load late punch approvals:', err);
    } finally {
      setLateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardStats();
    loadMembers();
    loadRegularizations();
    loadLateApprovals();
  }, [loadDashboardStats, loadMembers, loadRegularizations, loadLateApprovals]);

  useEffect(() => {
    if (activeTab === 'attendance') loadAttendance();
    else if (activeTab === 'regularization') loadRegularizations();
    else if (activeTab === 'latePunch') loadLateApprovals();
  }, [activeTab, loadAttendance, loadRegularizations, loadLateApprovals]);

  // Open Full Profile Modal
  const handleOpenProfile = async (staffId) => {
    setProfileLoading(true);
    setProfileModalVisible(true);
    try {
      const resp = await getTeamMemberProfile(staffId);
      if (resp?.success) {
        setSelectedProfile(resp.staff);
      } else {
        notifyError(resp?.message || 'Failed to load profile');
      }
    } catch (err) {
      notifyError('Failed to fetch profile details');
    } finally {
      setProfileLoading(false);
    }
  };

  // Regularization Review
  const handleReviewReg = async (id, status, remarks = '') => {
    setActioningId(id);
    try {
      const resp = await reviewTeamRegularization(id, status, remarks);
      if (resp?.success) {
        notifySuccess(`Regularization ${status.toLowerCase()} successfully`);
        loadRegularizations();
      } else {
        notifyError(resp?.message || 'Failed to update request');
      }
    } catch (err) {
      notifyError(err.response?.data?.message || 'Action failed');
    } finally {
      setActioningId(null);
      setRejectModalVisible(false);
    }
  };

  // Late Punch Review
  const handleReviewLate = async (id, status, remarks = '') => {
    setActioningId(id);
    try {
      const resp = await reviewTeamLateApproval(id, status, remarks);
      if (resp?.success) {
        notifySuccess(`Late check-in ${status.toLowerCase()} successfully`);
        loadLateApprovals();
      } else {
        notifyError(resp?.message || 'Failed to update request');
      }
    } catch (err) {
      notifyError(err.response?.data?.message || 'Action failed');
    } finally {
      setActioningId(null);
      setRejectModalVisible(false);
    }
  };

  // Open Reject Dialog
  const openRejectDialog = (type, id) => {
    setRejectType(type);
    setRejectTargetId(id);
    setRejectRemarks('');
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    setRejectSubmitting(true);
    if (rejectType === 'reg') {
      await handleReviewReg(rejectTargetId, 'REJECTED', rejectRemarks);
    } else {
      await handleReviewLate(rejectTargetId, 'REJECTED', rejectRemarks);
    }
    setRejectSubmitting(false);
  };

  // Change Date
  const handleDateShift = (deltaDays) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + deltaDays);
    setSelectedDate(nextDate);
  };

  // Pending Counts
  const pendingRegCount = useMemo(() => regList.filter(r => r.status === 'PENDING').length, [regList]);
  const pendingLateCount = useMemo(() => lateList.filter(r => r.status === 'PENDING').length, [lateList]);

  // Attendance Stats
  const attStats = useMemo(() => {
    const present = attendanceList.filter(a => String(a.status).toLowerCase() === 'present').length;
    const absent = attendanceList.filter(a => String(a.status).toLowerCase() === 'absent').length;
    const halfDay = attendanceList.filter(a => String(a.status).toLowerCase() === 'half_day').length;
    return { total: attendanceList.length, present, absent, halfDay };
  }, [attendanceList]);

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Image source={require('../assets/left.png')} style={{ width: 14, height: 14, tintColor: '#1E293B' }} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>My Team</Text>
          <Text style={styles.headerSubtitle}>{teamName || 'Team Leader Portal'}</Text>
        </View>
        <View style={styles.tlBadge}>
          <Text style={styles.tlBadgeText}>TL</Text>
        </View>
      </View>

      {/* Team Leader Dashboard KPI Stats (2x2 Grid) */}
      <View style={styles.dashboardKpiWrap}>
        <View style={styles.dashboardKpiRow}>
          {/* Card 1: Total Assigned */}
          <View style={[styles.dashboardKpiCard, { borderLeftColor: '#2563EB' }]}>
            <Text style={styles.dashboardKpiLabel}>Total Assigned</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[styles.dashboardKpiValue, { color: '#1E3A8A' }]}>
                {dashboardStats.totalAssigned}
              </Text>
              <Text style={{ fontSize: 16 }}>👥</Text>
            </View>
          </View>

          {/* Card 2: Present Today */}
          <View style={[styles.dashboardKpiCard, { borderLeftColor: '#16A34A' }]}>
            <Text style={styles.dashboardKpiLabel}>Present Today</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[styles.dashboardKpiValue, { color: '#15803D' }]}>
                {dashboardStats.presentToday}
              </Text>
              <Text style={{ fontSize: 16 }}>🟢</Text>
            </View>
          </View>
        </View>

        <View style={[styles.dashboardKpiRow, { marginTop: 8 }]}>
          {/* Card 3: Absent Today */}
          <View style={[styles.dashboardKpiCard, { borderLeftColor: '#DC2626' }]}>
            <Text style={styles.dashboardKpiLabel}>Absent Today</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[styles.dashboardKpiValue, { color: '#B91C1C' }]}>
                {dashboardStats.absentToday}
              </Text>
              <Text style={{ fontSize: 16 }}>🔴</Text>
            </View>
          </View>

          {/* Card 4: On Leave */}
          <View style={[styles.dashboardKpiCard, { borderLeftColor: '#EAB308' }]}>
            <Text style={styles.dashboardKpiLabel}>On Leave</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[styles.dashboardKpiValue, { color: '#A16207' }]}>
                {dashboardStats.onLeaveToday}
              </Text>
              <Text style={{ fontSize: 16 }}>🟡</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Segment Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'members' && styles.tabButtonActive]}
          onPress={() => setActiveTab('members')}
        >
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Members ({members.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'attendance' && styles.tabButtonActive]}
          onPress={() => setActiveTab('attendance')}
        >
          <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>
            Attendance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'regularization' && styles.tabButtonActive]}
          onPress={() => setActiveTab('regularization')}
        >
          <Text style={[styles.tabText, activeTab === 'regularization' && styles.tabTextActive]}>
            Regularize {pendingRegCount > 0 ? `(${pendingRegCount})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'latePunch' && styles.tabButtonActive]}
          onPress={() => setActiveTab('latePunch')}
        >
          <Text style={[styles.tabText, activeTab === 'latePunch' && styles.tabTextActive]}>
            Late Punch {pendingLateCount > 0 ? `(${pendingLateCount})` : ''}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search staff by Name, ID, Phone..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
                <Text style={{ color: '#94A3B8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading && members.length === 0 ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0F3B8C" />
              <Text style={{ marginTop: 8, color: '#64748B' }}>Loading team members...</Text>
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMembers(true)} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No Team Members</Text>
                  <Text style={styles.emptyText}>No staff members assigned under your team leader account.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.staffCard}>
                  <View style={styles.staffCardTop}>
                    {(() => {
                      const photoUri = getPhotoUrl(item.avatar || item.photoUrl);
                      if (photoUri) {
                        return <Image source={{ uri: photoUri }} style={styles.avatarCircle} />;
                      }
                      return (
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                        </View>
                      );
                    })()}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.staffName}>{item.name}</Text>
                      <Text style={styles.staffSub}>
                        {item.staffId ? `${item.staffId} • ` : ''}{item.designation || 'Staff'}
                      </Text>
                      {item.department ? (
                        <Text style={styles.deptText}>🏢 {item.department}</Text>
                      ) : null}
                    </View>
                    {renderStatusBadge(item.todayAttendance?.status)}
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.profileBtn, { flex: 1 }]}
                      onPress={() => handleOpenProfile(item.id)}
                    >
                      <Text style={styles.profileBtnText}>View Full Profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* TAB 2: ATTENDANCE (VIEW ONLY) */}
      {activeTab === 'attendance' && (
        <View style={{ flex: 1 }}>
          <View style={styles.dateSelector}>
            <TouchableOpacity style={styles.dateNavBtn} onPress={() => handleDateShift(-1)}>
              <Text style={styles.dateNavBtnText}>◀</Text>
            </TouchableOpacity>

            <View style={styles.dateDisplay}>
              <Text style={styles.dateDisplayText}>{formatDisplayDate(selectedDate)}</Text>
              <Text style={styles.dateSubText}>
                {selectedDate.toDateString() === new Date().toDateString() ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
            </View>

            <TouchableOpacity style={styles.dateNavBtn} onPress={() => handleDateShift(1)}>
              <Text style={styles.dateNavBtnText}>▶</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsBar}>
            <View style={styles.statPill}><Text style={styles.statLabel}>Total: {attStats.total}</Text></View>
            <View style={[styles.statPill, { backgroundColor: '#DCFCE7' }]}><Text style={[styles.statLabel, { color: '#15803D' }]}>P: {attStats.present}</Text></View>
            <View style={[styles.statPill, { backgroundColor: '#FEE2E2' }]}><Text style={[styles.statLabel, { color: '#B91C1C' }]}>A: {attStats.absent}</Text></View>
            <View style={[styles.statPill, { backgroundColor: '#FEF3C7' }]}><Text style={[styles.statLabel, { color: '#B45309' }]}>HD: {attStats.halfDay}</Text></View>
          </View>

          {attLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0F3B8C" />
              <Text style={{ marginTop: 8, color: '#64748B' }}>Loading attendance...</Text>
            </View>
          ) : (
            <FlatList
              data={attendanceList}
              keyExtractor={(item) => String(item.id || item.userId)}
              contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
              refreshControl={<RefreshControl refreshing={attLoading} onRefresh={loadAttendance} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No Records</Text>
                  <Text style={styles.emptyText}>No attendance records for this date.</Text>
                </View>
              }
              renderItem={({ item }) => {
                const lateMins = item.latePunchInMinutes || item.lateMinutes || 0;
                const hasLate = Boolean(item.isLate || lateMins > 0);
                const hasLoc = Boolean(item.latitude || item.punchOutLatitude);

                return (
                  <View style={styles.attCard}>
                    {/* Header: Staff Name & ID + Status Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {(() => {
                        const photoUri = getPhotoUrl(item.avatar || item.photoUrl);
                        if (photoUri) {
                          return <Image source={{ uri: photoUri }} style={styles.attAvatar} />;
                        }
                        return (
                          <View style={styles.attAvatar}>
                            <Text style={styles.attAvatarText}>
                              {(item.name || 'S').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        );
                      })()}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.staffName}>{item.name}</Text>
                        <Text style={styles.staffIdText}>ID: {item.staffId || 'N/A'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {renderStatusBadge(item.status)}
                        {hasLate && (
                          <View style={styles.lateTag}>
                            <Text style={styles.lateTagText}>Late by {lateMins} min</Text>
                          </View>
                        )}
                        {item.earlyExitMinutes > 0 && (
                          <View style={styles.earlyTag}>
                            <Text style={styles.earlyTagText}>Early Exit: {item.earlyExitMinutes} min</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Department & Date Row */}
                    <View style={styles.attMetaRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={styles.attMetaLabel}>Department: </Text>
                        <Text style={styles.attMetaValue}>{item.department || '-'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.attMetaLabel}>Date: </Text>
                        <Text style={styles.attMetaValue}>{formatLongDate(item.date)}</Text>
                      </View>
                    </View>

                    {/* Punch Times Grid Row 1: Check In, Check Out, Break */}
                    <View style={styles.punchRow}>
                      <View style={styles.punchBlock}>
                        <Text style={styles.punchLabel}>Check In</Text>
                        <Text style={styles.punchTime}>{item.checkIn || '-'}</Text>
                      </View>
                      <View style={styles.punchBlock}>
                        <Text style={styles.punchLabel}>Check Out</Text>
                        <Text style={styles.punchTime}>{item.checkOut || '-'}</Text>
                      </View>
                      <View style={styles.punchBlock}>
                        <Text style={styles.punchLabel}>Break</Text>
                        <Text style={styles.punchTime}>{formatBreakTime(item.breakTotalSeconds)}</Text>
                      </View>
                    </View>

                    {/* Punch Times Grid Row 2: Working Hours, Location */}
                    <View style={[styles.punchRow, { marginTop: 6, backgroundColor: '#F1F5F9' }]}>
                      <View style={styles.punchBlock}>
                        <Text style={styles.punchLabel}>Working Hours</Text>
                        <Text style={styles.punchTime}>
                          {formatWorkHours(item.totalWorkHours, item.checkIn, item.checkOut)}
                        </Text>
                      </View>
                      <View style={styles.punchBlock}>
                        <Text style={styles.punchLabel}>Location</Text>
                        <Text style={[styles.punchTime, { color: hasLoc ? '#0F3B8C' : '#64748B' }]}>
                          {hasLoc ? '📍 Tracked' : '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* TAB 3: REGULARIZATION (APPROVE / REJECT) */}
      {activeTab === 'regularization' && (
        <View style={{ flex: 1 }}>
          {regLoading && regList.length === 0 ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0F3B8C" />
              <Text style={{ marginTop: 8, color: '#64748B' }}>Loading regularization requests...</Text>
            </View>
          ) : (
            <FlatList
              data={regList}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
              refreshControl={<RefreshControl refreshing={regLoading} onRefresh={loadRegularizations} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No Requests</Text>
                  <Text style={styles.emptyText}>No regularization requests from your team.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.requestCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{item.user?.profile?.name || `Staff #${item.userId}`}</Text>
                      <Text style={styles.staffSub}>
                        {item.user?.profile?.staffId ? `${item.user.profile.staffId} • ` : ''}
                        Date: <Text style={{ fontWeight: 'bold' }}>{item.date}</Text>
                      </Text>
                    </View>
                    {renderStatusBadge(item.status)}
                  </View>

                  <View style={styles.timingBox}>
                    <Text style={{ fontSize: 12, color: '#059669' }}>
                      Requested In: <Text style={{ fontWeight: 'bold' }}>{item.requestedInTime || '--:--'}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: '#2563EB', marginTop: 2 }}>
                      Requested Out: <Text style={{ fontWeight: 'bold' }}>{item.requestedOutTime || '--:--'}</Text>
                    </Text>
                    {item.reason ? (
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                        Reason: {item.reason}
                      </Text>
                    ) : null}
                  </View>

                  {item.status === 'PENDING' ? (
                    <View style={styles.actionBtnRow}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleReviewReg(item.id, 'APPROVED')}
                        disabled={actioningId === item.id}
                      >
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => openRejectDialog('reg', item.id)}
                        disabled={actioningId === item.id}
                      >
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.reviewedText}>
                      {item.adminRemarks || `Status: ${item.status}`}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* TAB 4: LATE PUNCH-IN APPROVALS (MATCHES ADMIN) */}
      {activeTab === 'latePunch' && (
        <View style={{ flex: 1 }}>
          {/* Status Filter Bar matching Admin */}
          <View style={styles.statsBar}>
            <TouchableOpacity
              style={[styles.statPill, lateFilter === 'ALL' && { backgroundColor: '#0F3B8C' }]}
              onPress={() => setLateFilter('ALL')}
            >
              <Text style={[styles.statLabel, lateFilter === 'ALL' && { color: '#FFFFFF' }]}>
                All ({lateList.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statPill, lateFilter === 'PENDING' && { backgroundColor: '#FEF3C7' }]}
              onPress={() => setLateFilter('PENDING')}
            >
              <Text style={[styles.statLabel, lateFilter === 'PENDING' ? { color: '#B45309' } : { color: '#D97706' }]}>
                Pending ({lateList.filter(r => r.status === 'PENDING').length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statPill, lateFilter === 'APPROVED' && { backgroundColor: '#DCFCE7' }]}
              onPress={() => setLateFilter('APPROVED')}
            >
              <Text style={[styles.statLabel, lateFilter === 'APPROVED' ? { color: '#15803D' } : { color: '#16A34A' }]}>
                Approved ({lateList.filter(r => r.status === 'APPROVED').length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statPill, lateFilter === 'REJECTED' && { backgroundColor: '#FEE2E2' }]}
              onPress={() => setLateFilter('REJECTED')}
            >
              <Text style={[styles.statLabel, lateFilter === 'REJECTED' ? { color: '#B91C1C' } : { color: '#DC2626' }]}>
                Rejected ({lateList.filter(r => r.status === 'REJECTED').length})
              </Text>
            </TouchableOpacity>
          </View>

          {lateLoading && lateList.length === 0 ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0F3B8C" />
              <Text style={{ marginTop: 8, color: '#64748B' }}>Loading late punch requests...</Text>
            </View>
          ) : (
            <FlatList
              data={displayedLateList}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
              refreshControl={<RefreshControl refreshing={lateLoading} onRefresh={loadLateApprovals} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No data</Text>
                  <Text style={styles.emptyText}>No late punch approval requests found.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.requestCard}>
                  {/* Column 1: Staff Details & Column 5: Status */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{item.user?.profile?.name || `Staff #${item.userId}`}</Text>
                      <Text style={styles.staffSub}>
                        ID: {item.user?.profile?.staffId || '--'} • {item.user?.profile?.department || 'General'}
                      </Text>
                    </View>
                    {renderStatusBadge(item.status)}
                  </View>

                  {/* Column 2: Date & Column 4: Late By */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>Date: </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }}>{item.date}</Text>
                    </View>
                    <View style={[styles.lateTag, { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3 }]}>
                      <Text style={[styles.lateTagText, { color: '#B91C1C', fontWeight: 'bold' }]}>
                        {item.lateMinutes || 0} min late
                      </Text>
                    </View>
                  </View>

                  {/* Column 3: Shift vs Punch Time */}
                  <View style={styles.timingBox}>
                    <Text style={{ fontSize: 12, color: '#334155' }}>
                      Shift Start: <Text style={{ fontWeight: '700' }}>{item.shiftStartTime || '--'}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: '#DC2626', marginTop: 3 }}>
                      Punched In: <Text style={{ fontWeight: '700' }}>{item.punchedInAt ? item.punchedInAt.slice(11, 16) : '--:--'}</Text>
                    </Text>
                    {item.reason ? (
                      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                        Reason: {item.reason}
                      </Text>
                    ) : null}
                  </View>

                  {/* Column 6: Action */}
                  {item.status === 'PENDING' ? (
                    <View style={styles.actionBtnRow}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleReviewLate(item.id, 'APPROVED')}
                        disabled={actioningId === item.id}
                      >
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => openRejectDialog('late', item.id)}
                        disabled={actioningId === item.id}
                      >
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.reviewedText}>
                      {item.adminRemarks ? `Note: ${item.adminRemarks}` : (item.reviewedAt ? `Reviewed ${item.reviewedAt.slice(0, 10)}` : `Status: ${item.status}`)}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* MODAL: STAFF PROFILE (Same as Admin View) */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={styles.closeBtn}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E293B' }}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Staff Profile</Text>
            <View style={{ width: 50 }} />
          </View>

          {profileLoading || !selectedProfile ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0F3B8C" />
              <Text style={{ marginTop: 10, color: '#64748B' }}>Loading profile details...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {/* Header Banner matching SS1 */}
              <View style={styles.profileHeaderCard}>
                {(() => {
                  const photoUri = getPhotoUrl(selectedProfile.avatar || selectedProfile.photoUrl);
                  if (photoUri) {
                    return (
                      <Image
                        source={{ uri: photoUri }}
                        style={{ width: 56, height: 56, borderRadius: 28 }}
                      />
                    );
                  }
                  return (
                    <View style={[styles.avatarCircle, { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E0F2FE' }]}>
                      <Text style={[styles.avatarText, { fontSize: 20, color: '#0284C7' }]}>
                        {getInitials(selectedProfile.name)}
                      </Text>
                    </View>
                  );
                })()}
                <Text style={styles.profileMainName}>{selectedProfile.name}</Text>
                <Text style={styles.profileMainSub}>
                  ID {selectedProfile.staffId || '-'} | {selectedProfile.department || 'General'} | {selectedProfile.active !== false ? 'Active' : 'Inactive'}
                </Text>
                <View style={[styles.badgePill, { backgroundColor: '#DCFCE7', alignSelf: 'center', marginTop: 8 }]}>
                  <Text style={[styles.badgeText, { color: '#15803D' }]}>
                    {selectedProfile.active !== false ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
              </View>

              {/* 1. Profile Information */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Profile Information</Text>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Name</Text><Text style={styles.infoValue}>{selectedProfile.name}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>ID</Text><Text style={styles.infoValue}>{selectedProfile.staffId || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Designation</Text><Text style={styles.infoValue}>{selectedProfile.designation || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Staff Type</Text><Text style={styles.infoValue}>{selectedProfile.staffType || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Contact Number</Text><Text style={styles.infoValue}>{selectedProfile.contactNumber || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Date of Joining</Text><Text style={styles.infoValue}>{selectedProfile.dateOfJoining || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Department</Text><Text style={styles.infoValue}>{selectedProfile.department || '-'}</Text></View>
              </View>

              {/* 2. General Information */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>General Information</Text>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Salary Cycle Date</Text><Text style={styles.infoValue}>{selectedProfile.salaryCycleDate || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Shift</Text><Text style={styles.infoValue}>{selectedProfile.shift || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Salary Template</Text><Text style={styles.infoValue}>{selectedProfile.salaryTemplate || '-'}</Text></View>
              </View>

              {/* 3. Personal Information */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{selectedProfile.email || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Gender</Text><Text style={styles.infoValue}>{selectedProfile.gender || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Date of Birth</Text><Text style={styles.infoValue}>{selectedProfile.dob || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Marital Status</Text><Text style={styles.infoValue}>{selectedProfile.maritalStatus || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Blood Group</Text><Text style={styles.infoValue}>{selectedProfile.bloodGroup || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Emergency Contact</Text><Text style={styles.infoValue}>{selectedProfile.emergencyContact || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Current Address</Text><Text style={styles.infoValue}>{selectedProfile.currentAddress || '-'}</Text></View>
              </View>

              {/* 4. Bank Details */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Bank Details</Text>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Bank Name</Text><Text style={styles.infoValue}>{selectedProfile.bankName || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Branch</Text><Text style={styles.infoValue}>{selectedProfile.bankBranch || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>IFSC</Text><Text style={styles.infoValue}>{selectedProfile.bankIfsc || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Account Number</Text><Text style={styles.infoValue}>{selectedProfile.bankAccountNumber || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Account Holder</Text><Text style={styles.infoValue}>{selectedProfile.bankAccountHolderName || '-'}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>UPI ID</Text><Text style={styles.infoValue}>{selectedProfile.upiId || '-'}</Text></View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* MODAL: REJECT REMARKS */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.editModalBox}>
            <Text style={styles.editModalTitle}>
              Reject {rejectType === 'reg' ? 'Regularization' : 'Late Punch'} Request
            </Text>

            <Text style={styles.inputLabel}>Reason for Rejection (Optional)</Text>
            <TextInput
              style={[styles.timeInput, { height: 70, textAlignVertical: 'top' }]}
              value={rejectRemarks}
              onChangeText={setRejectRemarks}
              placeholder="Enter reason for rejecting this request..."
              multiline
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#DC2626' }]}
                onPress={handleConfirmReject}
                disabled={rejectSubmitting}
              >
                {rejectSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Confirm Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav navigation={navigation} currentTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  headerSubtitle: { fontSize: 12, color: '#64748B' },
  tlBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tlBadgeText: { fontSize: 12, fontWeight: '800', color: '#B45309' },

  dashboardKpiWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dashboardKpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dashboardKpiCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
  },
  dashboardKpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  dashboardKpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  tabScroll: { maxHeight: 48, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 8 },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: { borderBottomColor: '#0F3B8C' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#0F3B8C', fontWeight: '700' },

  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  clearSearchBtn: { position: 'absolute', right: 28, top: 18 },

  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffCardTop: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F3B8C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  staffName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  staffSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  deptText: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  profileBtn: {
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0F3B8C',
    alignItems: 'center',
  },
  profileBtnText: { color: '#0F3B8C', fontWeight: '600', fontSize: 13 },

  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavBtnText: { color: '#1E293B', fontWeight: 'bold' },
  dateDisplay: { alignItems: 'center' },
  dateDisplayText: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  dateSubText: { fontSize: 11, color: '#64748B' },

  statsBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#475569' },

  attCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  attAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attAvatarText: { color: '#0284C7', fontWeight: '700', fontSize: 15 },
  staffIdText: { fontSize: 11, color: '#64748B', marginTop: 1 },
  attMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  attMetaLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  attMetaValue: { fontSize: 11, color: '#1E293B', fontWeight: '600' },
  lateTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  lateTagText: { color: '#B91C1C', fontSize: 9, fontWeight: '700' },
  earlyTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  earlyTagText: { color: '#B45309', fontSize: 9, fontWeight: '700' },
  punchRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  punchBlock: { alignItems: 'center' },
  punchLabel: { fontSize: 11, color: '#64748B' },
  punchTime: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 2 },

  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timingBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  rejectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  rejectBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  reviewedText: { fontSize: 12, color: '#94A3B8', marginTop: 10, fontStyle: 'italic' },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4 },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  closeBtn: { padding: 4 },

  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileMainName: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 8 },
  profileMainSub: { fontSize: 13, color: '#64748B', marginTop: 2 },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  infoLabel: { fontSize: 12, color: '#64748B' },
  infoValue: { fontSize: 12, fontWeight: '600', color: '#1E293B', maxWidth: '60%', textAlign: 'right' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editModalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  editModalTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 4 },
  timeInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700' },
});

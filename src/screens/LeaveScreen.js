import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
import { listAllLeaveRequests, listMyLeaveRequests, updateLeaveStatus, listMyLeaveEncashments } from '../config/api';
import { notifyError, notifySuccess } from '../utils/notify';

export default function LeaveScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [encashmentClaims, setEncashmentClaims] = useState([]);
  const [role, setRole] = useState('staff');
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLeaves, setNotifLeaves] = useState([]); // APPROVED + REJECTED
  const [unseenCount, setUnseenCount] = useState(0);

  const tabStatus = useMemo(() => (activeTab === 'approved' ? 'APPROVED' : 'PENDING'), [activeTab]);

  const loadRole = async () => {
    try {
      const u = await AsyncStorage.getItem('user');
      const parsed = u ? JSON.parse(u) : null;
      setRole(parsed?.role || 'staff');
    } catch (e) {
      setRole('staff');
    }
  };

  const loadLeaves = async () => {
    setLoading(true);
    try {
      if (activeTab === 'encashment') {
        const res = await listMyLeaveEncashments();
        if (res?.success) {
          setEncashmentClaims(Array.isArray(res.claims) ? res.claims : []);
        } else {
          notifyError(res?.message || 'Unable to load encashment claims.');
        }
      } else {
        const res = role === 'staff' ? await listMyLeaveRequests({ status: tabStatus }) : await listAllLeaveRequests({ status: tabStatus });
        if (res?.success) {
          setItems(Array.isArray(res.leaves) ? res.leaves : []);
        } else {
          notifyError(res?.message || 'Unable to load leave requests.');
        }
      }
    } catch (e) {
      notifyError('Unable to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRole();
  }, []);

  useEffect(() => {
    loadLeaves();
  }, [role, tabStatus, activeTab]);

  // Notifications polling and badge count (approved + rejected total)
  useEffect(() => {
    let cancelled = false;
    const STORAGE_KEY = 'notif:lastSeenApprovedAt';
    const compute = async () => {
      try {
        const [ap, rj] = await Promise.all([
          listMyLeaveRequests({ status: 'APPROVED' }),
          listMyLeaveRequests({ status: 'REJECTED' }),
        ]);
        const approved = (ap?.leaves || []).map((x) => ({ ...x, _notifStatus: 'APPROVED' }));
        const rejected = (rj?.leaves || []).map((x) => ({ ...x, _notifStatus: 'REJECTED' }));
        const items = [...approved, ...rejected].sort((a, b) => (
          new Date(b.reviewedAt || b.updatedAt || b.createdAt).getTime() - new Date(a.reviewedAt || a.updatedAt || a.createdAt).getTime()
        ));
        if (cancelled) return;
        setNotifLeaves(items);
        // Show total approved + rejected on the badge
        setUnseenCount(items.length);
      } catch (e) { }
    };
    compute();
    const intv = setInterval(compute, 60000);
    return () => { cancelled = true; clearInterval(intv); };
  }, []);

  const openNotifications = async () => {
    setNotifOpen(true);
    try {
      const latest = notifLeaves
        .map((it) => new Date(it.reviewedAt || it.updatedAt || it.createdAt).getTime())
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => b - a)[0];
      const toStore = latest ? new Date(latest).toISOString() : new Date().toISOString();
      await AsyncStorage.setItem('notif:lastSeenApprovedAt', toStore);
      // Keep badge as total count; do not clear
    } catch { }
  };

  const onMarkRead = () => {
    setNotifLeaves([]);
    setUnseenCount(0);
    setNotifOpen(false);
  };

  const formatDate = (d) => {
    if (!d) return '--';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '--';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatCardDate = (iso) => {
    if (!iso) return '--/--/--';
    const d = new Date(`${iso}T00:00:00`);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const formatLongDate = (iso) => {
    if (!iso) return '--';
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const weekday = (iso) => {
    if (!iso) return '--';
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  };


  const onReview = async (id, nextStatus) => {
    try {
      const res = await updateLeaveStatus(id, { status: nextStatus });
      if (res?.success) {
        loadLeaves();
        notifySuccess(nextStatus === 'APPROVED' ? 'Leave request approved.' : 'Leave request rejected.');
      } else {
        notifyError(res?.message || 'Unable to update leave status.');
      }
    } catch (e) {
      notifyError('Unable to update leave status.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leave</Text>
        <TouchableOpacity style={styles.bellButton} activeOpacity={0.7} onPress={openNotifications}>
          <Image source={require('../assets/bell (2).png')} style={{ width: 18, height: 18 }} />
          {unseenCount > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : String(unseenCount)}</Text></View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          onPress={() => setActiveTab('pending')}
          style={[styles.tab, activeTab === 'pending' ? styles.tabActive : styles.tabInactive]}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('approved')}
          style={[styles.tab, activeTab === 'approved' ? styles.tabActive : styles.tabInactive]}
        >
          <Text style={[styles.tabText, activeTab === 'approved' && styles.tabTextActive]}>Approved</Text>
        </TouchableOpacity>
        {role === 'staff' && (
          <TouchableOpacity
            onPress={() => setActiveTab('encashment')}
            style={[styles.tab, activeTab === 'encashment' ? styles.tabActive : styles.tabInactive]}
          >
            <Text style={[styles.tabText, activeTab === 'encashment' && styles.tabTextActive]}>Encashment</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={{ paddingVertical: 24 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={{ paddingVertical: 24 }}>
            <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' }}>No leaves</Text>
          </View>
        ) : null}

        {!loading && activeTab === 'encashment' && encashmentClaims.length === 0 ? (
          <View style={{ paddingVertical: 24 }}>
            <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' }}>No encashment claims</Text>
          </View>
        ) : null}

        {activeTab !== 'encashment' ? items.map((it) => (
          <View key={String(it.id)} style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardDate}>{formatCardDate(it.startDate)}</Text>
                <Text style={styles.cardDay}>{weekday(it.startDate)}</Text>
              </View>
              {role !== 'staff' && it?.user?.phone ? (
                <Text style={styles.cardDay}>{it.user.phone}</Text>
              ) : null}
            </View>
            <View style={styles.divider} />
            <View style={styles.cardRow}>
              <View style={styles.cardCol}>
                <Text style={styles.muted}>Leave Date</Text>
                <Text style={styles.value}>{formatLongDate(it.startDate)} - {formatLongDate(it.endDate)}</Text>
              </View>
              <View style={styles.cardCol}>
                <Text style={styles.muted}>Category</Text>
                <Text style={styles.value}>{it.categoryKey ? String(it.categoryKey).toUpperCase() : '-'}</Text>
              </View>
            </View>
            <View style={styles.cardRow}>
              <View style={styles.cardCol}>
                <Text style={styles.muted}>Reason</Text>
                <Text style={styles.value}>{it.reason || '-'}</Text>
              </View>
              <View style={styles.cardCol}>
                <Text style={styles.muted}>Status</Text>
                <Text style={styles.value}>{String(it.status || '-')}</Text>
              </View>
            </View>

            {it.status === 'APPROVED' ? (
              <View style={[styles.cardRow, { marginTop: 6 }]}>
                <View style={styles.cardCol}>
                  <Text style={styles.muted}>Paid / Unpaid</Text>
                  <Text style={styles.value}>
                    {(typeof it.paidDays === 'number' ? it.paidDays : it.paidDays ? Number(it.paidDays) : 0)} paid
                    {`  •  `}
                    {(typeof it.unpaidDays === 'number' ? it.unpaidDays : it.unpaidDays ? Number(it.unpaidDays) : 0)} unpaid
                  </Text>
                </View>
              </View>
            ) : null}


            {tabStatus === 'PENDING' && (role === 'admin' || role === 'superadmin') ? (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.9} onPress={() => onReview(it.id, 'REJECTED')}>
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.approveBtn} activeOpacity={0.9} onPress={() => onReview(it.id, 'APPROVED')}>
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )) : encashmentClaims.map((it) => (
          <View key={String(it.id)} style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardDate}>{formatDate(it.createdAt).split(' ')[0]}</Text>
                <Text style={styles.cardDay}>{it.monthKey}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: it.status === 'APPROVED' ? '#DEF7EC' : it.status === 'REJECTED' ? '#FDE8E8' : '#FEF3C7' }]}>
                <Text style={[styles.statusText, { color: it.status === 'APPROVED' ? '#03543F' : it.status === 'REJECTED' ? '#9B1C1C' : '#92400E' }]}>
                  {it.status}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.cardRow}>
              <View style={styles.cardCol}>
                <Text style={styles.muted}>Days</Text>
                <Text style={styles.value}>{it.days} Days</Text>
              </View>
              <View style={styles.cardCol}>
                <Text style={styles.muted}>Category</Text>
                <Text style={styles.value}>{it.categoryKey ? String(it.categoryKey).toUpperCase() : '-'}</Text>
              </View>
            </View>
            <View style={styles.cardRow}>
              <View style={styles.cardCol}>
                <Text style={styles.muted}>Estimated Amount</Text>
                <Text style={styles.value}>₹ {it.amount || '-'}</Text>
              </View>
              <View style={styles.cardCol}>
                <Text style={styles.muted}>Payroll Month</Text>
                <Text style={styles.value}>{it.monthKey || '-'}</Text>
              </View>
            </View>
            {it.reviewNote ? (
              <View style={[styles.cardRow, { marginTop: 6 }]}>
                <View style={styles.cardCol}>
                  <Text style={styles.muted}>Admin Note</Text>
                  <Text style={styles.value}>{it.reviewNote}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ))}
        <View style={{ height: 140 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => navigation.navigate(activeTab === 'encashment' ? 'ClaimEncashment' : 'ApplyLeave')}
      >
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>

      <BottomNav navigation={navigation} activeKey="salary" />

      {/* Notifications slide-over */}
      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <View style={styles.notifBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setNotifOpen(false)} />
          <View style={styles.notifPanel}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotifOpen(false)}><Text style={styles.notifClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {notifLeaves.length === 0 ? (
                <Text style={styles.notifEmpty}>No approved leaves yet.</Text>
              ) : (
                notifLeaves.slice(0, 20).map((lv) => (
                  <View key={String(lv.id)} style={styles.notifItem}>
                    <Text style={[styles.notifItemTitle, lv._notifStatus === 'APPROVED' ? styles.notifApproved : styles.notifRejected]}>
                      {lv._notifStatus === 'APPROVED' ? 'Leave approved' : 'Leave rejected'}
                    </Text>
                    <Text style={styles.notifItemText}>Start: {formatDate(lv.startDate)}  •  End: {formatDate(lv.endDate)}</Text>
                    {lv.reviewedAt ? (
                      <Text style={styles.notifItemMeta}>
                        {lv._notifStatus === 'APPROVED' ? 'Approved' : 'Rejected'} on {new Date(lv.reviewedAt).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              <TouchableOpacity onPress={onMarkRead} activeOpacity={0.85} style={{ alignSelf: 'flex-end', backgroundColor: '#125EC9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Mark read</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
// legacy per-screen bottom bar removed in favor of shared BottomNav

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30,
    marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    // shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  headerTitle: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  bellButton: { padding: 6, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, paddingHorizontal: 3, backgroundColor: '#EF4444', borderRadius: 8, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: 'Inter_600SemiBold' },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: '#E6EEFF' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabText: { color: '#6B7280', fontFamily: 'Inter_500Medium' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#125EC9' },
  tabInactive: { borderBottomWidth: 0, borderBottomColor: 'transparent' },
  tabTextActive: { color: '#125EC9' },

  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 200 },
  card: {
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, marginBottom: 12,
    borderColor: '#E6EEFF', borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 6
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { color: '#1f2c3a', fontFamily: 'Inter_600SemiBold' },
  cardDay: { color: '#6B7280', fontFamily: 'Inter_400Regular', marginTop: 2 },
  divider: { height: 0.5, backgroundColor: '#C3C3C3', marginVertical: 10 },
  cardRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  cardCol: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  muted: { color: '#616161', fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
  value: { color: '#616161', fontFamily: 'Inter_500Medium', fontSize: 13 },

  // Notifications slide-over styles
  notifBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.25)' },
  notifPanel: { width: '78%', maxWidth: 360, backgroundColor: '#fff', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, alignSelf: 'stretch', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 12 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  notifTitle: { fontSize: 16, color: '#111827', fontFamily: 'Inter_600SemiBold' },
  notifClose: { fontSize: 18, color: '#6B7280' },
  notifEmpty: { color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 12 },
  notifItem: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: '#F9FAFB' },
  notifItemTitle: { fontFamily: 'Inter_600SemiBold', color: '#111827', marginBottom: 6 },
  notifItemText: { fontFamily: 'Inter_500Medium', color: '#374151' },
  notifItemMeta: { fontFamily: 'Inter_400Regular', color: '#6B7280', marginTop: 6, fontSize: 12 },

  fab: {
    position: 'absolute', right: 24, bottom: 100, width: 58, height: 58, borderRadius: 50,
    backgroundColor: '#125EC9', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8
  },
  fabPlus: { color: '#fff', fontSize: 22, fontFamily: 'Inter_600SemiBold' },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FF4747' },
  cancelBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  rejectBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FF4747' },
  rejectBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  approveBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#125EC9' },
  approveBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
  },

});

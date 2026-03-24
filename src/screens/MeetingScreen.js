import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity,
  Image, FlatList, Modal, TextInput, ActivityIndicator,
  ScrollView, Platform, Alert, Linking, RefreshControl
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { listMyMeetings, createMeeting, updateMeeting, listAllStaff, updateMeetingStatus } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifySuccess, notifyError, notifyInfo } from '../utils/notify';

const MEETING_STATUS_TABS = [
  { label: 'Schedule', value: 'SCHEDULE' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
];

export default function MeetingScreen({ navigation, route }) {
  const [meetings, setMeetings] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedMeetingForStatus, setSelectedMeetingForStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(3);
  const [filterTab, setFilterTab] = useState('SCHEDULE');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 3600000)); // 1 hour from now
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const [remarks, setRemarks] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState(null);

  const fetchData = async () => {
    try {
      if (!refreshing) setLoading(true);
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) setCurrentUser(JSON.parse(userStr));

      const [mRes, sRes] = await Promise.all([
        listMyMeetings(),
        listAllStaff()
      ]);
      if (mRes.success) {
        // Sort newest first
        const sorted = (mRes.meetings || []).sort((a, b) =>
          new Date(b.scheduledAt) - new Date(a.scheduledAt)
        );
        setMeetings(sorted);
      }
      if (sRes.success) setStaff(sRes.staff);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  useEffect(() => {
    fetchData();
    if (route.params?.initialStatus) {
      setFilterTab(route.params.initialStatus);
    }
  }, [route.params?.initialStatus]);

  const filtered = meetings.filter(m => {
    if (filterTab === 'SCHEDULE') return m.status === 'SCHEDULE' || !m.status;
    return m.status === filterTab;
  });
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSaveMeeting = async () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Title is required';

    // Google Meet link validation
    const link = meetLink.trim();
    if (!link) {
      newErrors.meetLink = 'Google Meet link is mandatory.';
    } else {
      const gmeetRegex = /^(https?:\/\/)?meet\.google\.com\/[a-z0-9-]+$/i;
      if (!gmeetRegex.test(link)) {
        newErrors.meetLink = 'Please enter a valid Google Meet link.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    setSubmitting(true);
    try {
      const payload = {
        title,
        description,
        meetLink: link,
        scheduledAt: scheduledAt.toISOString(),
        attendeeIds: selectedAttendeeIds
      };
      const res = isEditMode && editingMeetingId
        ? await updateMeeting(editingMeetingId, payload)
        : await createMeeting(payload);
      if (res.success) {
        notifySuccess(isEditMode ? 'Meeting updated successfully' : 'Meeting scheduled and invites sent');
        setModalVisible(false);
        resetForm();
        fetchData();
      }
    } catch (e) {
      notifyError(isEditMode ? 'Failed to update meeting' : 'Failed to schedule meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedMeetingForStatus) return;
    if (selectedMeetingForStatus.isClosed) {
      Alert.alert('Locked', 'This meeting is closed and cannot be updated.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateMeetingStatus(selectedMeetingForStatus.id, newStatus, remarks);
      if (res.success) {
        notifySuccess('Meeting status updated');
        setStatusModalVisible(false);
        setRemarks('');
        fetchData();
      }
    } catch (e) {
      notifyError('Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setMeetLink('');
    setScheduledAt(new Date(Date.now() + 3600000));
    setSelectedAttendeeIds([]);
    setErrors({});
    setIsEditMode(false);
    setEditingMeetingId(null);
  };

  const openEditModal = (meeting) => {
    setIsEditMode(true);
    setEditingMeetingId(meeting.id);
    setTitle(meeting.title || '');
    setDescription(meeting.description || '');
    setMeetLink(meeting.meetLink || '');
    setScheduledAt(meeting.scheduledAt ? new Date(meeting.scheduledAt) : new Date(Date.now() + 3600000));
    setSelectedAttendeeIds((meeting.attendeeRecords || []).map(a => a.userId).filter(Boolean));
    setErrors({});
    setModalVisible(true);
  };

  const toggleAttendee = (id) => {
    if (selectedAttendeeIds.includes(id)) {
      setSelectedAttendeeIds(selectedAttendeeIds.filter(i => i !== id));
    } else {
      setSelectedAttendeeIds([...selectedAttendeeIds, id]);
      if (errors.attendees) setErrors({ ...errors, attendees: null });
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'DONE': return '#059669';
      case 'IN_PROGRESS': return '#D97706';
      default: return '#125EC9';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'DONE': return '#DCFCE7';
      case 'IN_PROGRESS': return '#FEF3C7';
      default: return '#EBF3FF';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACCEPTED': return '#059669';
      case 'DECLINED': return '#DC2626';
      default: return '#9CA3AF';
    }
  };

  const renderMeetingItem = ({ item }) => (
    <View style={styles.meetingCard}>
      <View style={styles.cardHeader}>
        <View style={styles.timeCluster}>
          <Image source={require('../assets/cal.png')} style={styles.timeIcon} />
          <Text style={styles.meetingTime}>
            {new Date(item.scheduledAt).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
          <Text style={[styles.statusText, { color: getStatusTextColor(item.status) }]}>
            {item.status || 'SCHEDULE'}
          </Text>
        </View>
      </View>
      <Text style={styles.meetingTitle}>{item.title}</Text>
      {item.description ? <Text style={styles.meetingDesc}>{item.description}</Text> : null}

      {item.meetLink ? (() => {
        const scheduledTime = new Date(item.scheduledAt).getTime();
        const currentTime = new Date().getTime();
        const oneHourInMs = 1 * 60 * 60 * 1000;
        const isExpired = currentTime > (scheduledTime + oneHourInMs);

        return (
          <TouchableOpacity
            style={[styles.linkBtn, isExpired && styles.disabledBtn]}
            onPress={() => {
              if (isExpired) {
                Alert.alert('Meeting Expired', 'This meeting has already ended and the link is no longer active.');
              } else {
                const url = item.meetLink.includes('://') ? item.meetLink : `https://${item.meetLink}`;
                Linking.openURL(url).catch(() => {
                  Alert.alert('Error', 'Unable to open meeting link. Please copy and open in browser.');
                });
              }
            }}
            activeOpacity={isExpired ? 1 : 0.8}
          >
            <Image
              source={require('../assets/v2.png')}
              style={[styles.joinIcon, isExpired && { tintColor: '#9CA3AF' }]}
            />
            <Text style={[styles.linkText, isExpired && styles.disabledText]}>
              {isExpired ? 'Meeting Expired' : 'Join Google Meet'}
            </Text>
          </TouchableOpacity>
        );
      })() : null}
      {item.attendeeRecords && item.attendeeRecords.length > 0 ? (
        <View style={styles.attendeesBox}>
          <Text style={styles.attendeesLabel}>Invited Staff & Status:</Text>
          <View style={styles.attendeeGrid}>
            {item.attendeeRecords.map((att) => (
              <View key={att.id} style={styles.attendeeStatItem}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(att.status) }]} />
                <Text style={styles.attendeeNameText}>
                  {att.user?.profile?.name || 'Staff'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {item.isClosed && (
        <View style={{ marginTop: 10, padding: 8, backgroundColor: '#FFF1F2', borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: '#E11D48', fontWeight: '800', fontSize: 11 }}>
            🔒 {item.closedBy?.profile?.name ? `CLOSED BY ${item.closedBy.profile.name.toUpperCase()}` : 'CLOSED BY ADMIN'}
          </Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.footerTopRow}>
          <View style={styles.organizerRow}>
            <View style={styles.avatarMini}><Text style={styles.avatarText}>{(item.creator?.profile?.name || 'M')[0]}</Text></View>
            <Text style={styles.organizer}>Organized by {item.creator?.profile?.name || 'Manager'}</Text>
          </View>
          {Number(item.createdBy) === Number(currentUser?.id) && !item.isClosed && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => openEditModal(item)}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.updateStatusRow}>
          <TouchableOpacity
            style={[styles.updateStatusBtn, item.isClosed && { opacity: 0.5 }]}
            onPress={() => {
              if (item.isClosed) {
                Alert.alert('Locked', 'This meeting is closed by admin and cannot be modified');
                return;
              }
              setSelectedMeetingForStatus(item);
              setStatusModalVisible(true);
            }}
            disabled={item.isClosed}
          >
            <Text style={styles.updateStatusBtnText}>
              {item.isClosed ? 'Locked' : 'Update Status'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const filteredMeetings = meetings.filter(m => (m.status || 'SCHEDULE') === filterTab);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={styles.backIcon} />
          <Text style={styles.headerTitle}>Meetings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {MEETING_STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.tab, filterTab === tab.value && styles.activeTab]}
            onPress={() => setFilterTab(tab.value)}
          >
            <Text style={[styles.tabText, filterTab === tab.value && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#125EC9" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={paginated}
          keyExtractor={item => String(item.id)}
          renderItem={renderMeetingItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No {filterTab.toLowerCase().replace('_', ' ')} meetings found</Text>
            </View>
          }
          ListFooterComponent={totalPages > 1 ? (
            <View style={styles.paginationContainer}>
              <TouchableOpacity 
                style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} 
                onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              
              <Text style={styles.pageIndicator}>{currentPage} / {totalPages}</Text>

              <TouchableOpacity 
                style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]} 
                onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : <View style={{ height: 100 }} />}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          resetForm();
          setModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <SafeAreaView style={styles.modalFull}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.closeBtn}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>{isEditMode ? 'Edit Meeting' : 'Schedule Meeting'}</Text>
              <TouchableOpacity onPress={handleSaveMeeting} disabled={submitting}>
                <Text style={[styles.doneBtn, submitting && { opacity: 0.5 }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  placeholder="What is the meeting about?"
                  placeholderTextColor="#9CA3AF"
                  value={title}
                  onChangeText={(val) => {
                    setTitle(val);
                    if (errors.title) setErrors({ ...errors, title: null });
                  }}
                />
                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Add meeting notes or agenda..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Google Meet Link *</Text>
                <TextInput
                  style={[styles.input, errors.meetLink && styles.inputError]}
                  placeholder="meet.google.com/xxx-xxxx-xxx"
                  placeholderTextColor="#9CA3AF"
                  value={meetLink}
                  onChangeText={(val) => {
                    setMeetLink(val);
                    if (errors.meetLink) setErrors({ ...errors, meetLink: null });
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.meetLink && <Text style={styles.errorText}>{errors.meetLink}</Text>}
              </View>

              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={styles.pickerBox} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.pickerLabel}>Date</Text>
                  <Text style={styles.pickerValue}>{scheduledAt.toLocaleDateString('en-IN')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerBox} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.pickerLabel}>Time</Text>
                  <Text style={styles.pickerValue}>{scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="date"
                  onChange={(e, d) => {
                    setShowDatePicker(false);
                    if (d) {
                      const next = new Date(scheduledAt);
                      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      setScheduledAt(next);
                    }
                  }}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="time"
                  onChange={(e, d) => {
                    setShowTimePicker(false);
                    if (d) {
                      const next = new Date(scheduledAt);
                      next.setHours(d.getHours(), d.getMinutes());
                      setScheduledAt(next);
                    }
                  }}
                />
              )}

              <Text style={styles.sectionHeading}>Invite Staff</Text>
              <View style={styles.staffList}>
                {staff.map(s => (
                  <TouchableOpacity
                    key={s.userId}
                    style={[
                      styles.staffItem,
                      selectedAttendeeIds.includes(s.userId) && styles.staffSelected
                    ]}
                    onPress={() => toggleAttendee(s.userId)}
                  >
                    <View style={styles.staffInfo}>
                      <View style={[styles.avatarMini, { width: 32, height: 32, borderRadius: 16 }, selectedAttendeeIds.includes(s.userId) && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Text style={[styles.avatarText, selectedAttendeeIds.includes(s.userId) && { color: '#fff' }]}>{s.name[0]}</Text>
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={[styles.staffName, selectedAttendeeIds.includes(s.userId) && { color: '#fff' }]}>{s.name}</Text>
                        <Text style={[styles.staffRole, selectedAttendeeIds.includes(s.userId) && { color: 'rgba(255,255,255,0.7)' }]}>{s.designation || 'Staff'}</Text>
                      </View>
                    </View>
                    <View style={[styles.checkbox, selectedAttendeeIds.includes(s.userId) && styles.checkboxChecked]}>
                      {selectedAttendeeIds.includes(s.userId) && <Text style={{ color: '#125EC9', fontSize: 12 }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: 100 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Status Selection Modal */}
      <Modal visible={statusModalVisible} transparent animationType="fade">
        <View style={styles.statusModalOverlay}>
          <View style={styles.statusModalContent}>
            <Text style={styles.statusModalTitle}>Change Meeting Status</Text>
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Add notes about this status change..."
                placeholderTextColor="#9CA3AF"
                multiline
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>
            {['SCHEDULE', 'IN_PROGRESS', 'DONE'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusOption,
                  selectedMeetingForStatus?.status === s && styles.statusOptionSelected
                ]}
                onPress={() => handleUpdateStatus(s)}
                disabled={submitting}
              >
                <Text style={[
                  styles.statusOptionText,
                  selectedMeetingForStatus?.status === s && styles.statusOptionTextSelected
                ]}>{s}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setStatusModalVisible(false)} style={styles.statusCancelBtn}>
              <Text style={styles.statusCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#B3B3B3',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backIcon: { width: 18, height: 12, marginRight: 10, tintColor: '#125EC9' },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16 },
  meetingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cardHeader: { marginBottom: 12 },
  timeCluster: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  timeIcon: { width: 12, height: 12, tintColor: '#125EC9', marginRight: 6 },
  meetingTime: { fontSize: 12, color: '#125EC9', fontWeight: '700' },
  meetingTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 },
  meetingDesc: { fontSize: 14, color: '#6B7280', marginBottom: 16, lineHeight: 20 },
  linkBtn: {
    flexDirection: 'row',
    backgroundColor: '#EBF3FF',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  joinIcon: { width: 16, height: 16, tintColor: '#125EC9', marginRight: 8 },
  linkText: { color: '#125EC9', fontWeight: '700', fontSize: 15 },
  attendeesBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  attendeesLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  attendeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  attendeeStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  attendeeNameText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700',
  },
  disabledBtn: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  cardFooter: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  organizerRow: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#125EC9', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#125EC9',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#125EC9',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    marginTop: -4,
  },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  organizer: { fontSize: 12, color: '#6B7280', marginLeft: 8 },
  empty: { textAlign: 'center', marginTop: 100, color: '#9CA3AF', fontSize: 15 },

  modalBg: { flex: 1, backgroundColor: '#fff' },
  modalFull: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff'
  },
  modalHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  closeBtn: { fontSize: 16, color: '#DC2626', fontWeight: '500' },
  doneBtn: { fontSize: 16, color: '#125EC9', fontWeight: '700' },
  formContent: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, color: '#6B7280', marginBottom: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  dateTimeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  pickerBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  pickerLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: '600' },
  pickerValue: { fontSize: 15, color: '#111827', fontWeight: '600' },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12, marginTop: 10 },
  staffList: { gap: 8 },
  staffItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  staffSelected: { backgroundColor: '#125EC9', borderColor: '#125EC9' },
  staffInfo: { flexDirection: 'row', alignItems: 'center' },
  staffName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  staffRole: { fontSize: 12, color: '#6B7280' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#fff', borderColor: '#fff' },
  inputError: { borderColor: '#DC2626', backgroundColor: '#FFF5F5' },
  viewMoreBtn: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewMoreText: {
    color: '#125EC9',
    fontWeight: '800',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateStatusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  updateStatusBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#6B7280',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EBF3FF',
    borderWidth: 1,
    borderColor: '#BFD8FF',
  },
  editBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#125EC9',
  },
  cardFooter: {
    flexDirection: 'column',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  footerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateStatusRow: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusModalContent: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  statusModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusOption: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusOptionSelected: {
    backgroundColor: '#125EC9',
    borderColor: '#125EC9',
  },
  statusOptionText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#374151',
  },
  statusOptionTextSelected: {
    color: '#fff',
  },
  statusCancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statusCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#DC2626',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  activeTab: {
    backgroundColor: '#125EC9',
    borderColor: '#125EC9',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  activeTabText: {
    color: '#fff',
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 30,
    marginVertical: 20,
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 100,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
  },
  pageBtnText: {
    color: '#125EC9',
    fontSize: 13,
    fontWeight: '700',
  },
  pageBtnDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.5,
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageIndicator: {
    marginHorizontal: 15,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '700',
  },
});

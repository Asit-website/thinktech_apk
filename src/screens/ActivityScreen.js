import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity,
  Image, FlatList, Modal, TextInput, ActivityIndicator, Alert, ScrollView, RefreshControl
} from 'react-native';
import { listMyActivities, createActivity, updateActivity, updateActivityStatus, listAllStaff, transferActivity } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifySuccess, notifyError } from '../utils/notify';

const STATUS_OPTIONS = [
  { label: 'Schedule', value: 'SCHEDULE', color: '#6B7280', bg: '#F3F4F6' },
  { label: 'In Progress', value: 'IN_PROGRESS', color: '#125EC9', bg: '#EBF3FF' },
  { label: 'Review', value: 'REVIEW', color: '#D97706', bg: '#FFFBEB' },
  { label: 'Done', value: 'DONE', color: '#059669', bg: '#ECFDF5' },
];

export default function ActivityScreen({ navigation }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRemarks, setNewRemarks] = useState('');
  const [newTAT, setNewTAT] = useState(''); // Turn Around Time
  const [showTATPicker, setShowTATPicker] = useState(false);
  const [filterTab, setFilterTab] = useState('SCHEDULE');

  // Custom Picker States
  const [selHour, setSelHour] = useState('12');
  const [selMin, setSelMin] = useState('00');
  const [selPeriod, setSelPeriod] = useState('PM');
  const [errors, setErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Status Modal State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Transfer Modal State
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [staff, setStaff] = useState([]);

  const fetchActivities = async () => {
    try {
      // only show loading if not refreshing
      if (!refreshing) setLoading(true);
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) setCurrentUser(JSON.parse(userStr));

      const [actRes, staffRes] = await Promise.all([
        listMyActivities(),
        listAllStaff()
      ]);

      if (actRes.success) {
        setActivities(actRes.activities);
        setCurrentPage(1);
      }
      if (staffRes.success) setStaff(staffRes.staff);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities();
  };

  useEffect(() => {
    fetchActivities();

    // Check if navigated from Dashboard with a specific status
    if (navigation.getState().routes.find(r => r.name === 'Activity')?.params?.initialStatus) {
      setFilterTab(navigation.getState().routes.find(r => r.name === 'Activity')?.params?.initialStatus);
    }
  }, []);

  const filtered = activities.filter(a => a.status === filterTab);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCreate = async () => {
    const newErrors = {};
    if (!newTitle.trim()) newErrors.title = 'Title is required';
    if (!newDesc.trim()) newErrors.description = 'Description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        title: newTitle,
        description: newDesc,
        remarks: newRemarks,
        turnAroundTime: newTAT,
        status: isEditMode ? undefined : 'SCHEDULE',
        date: isEditMode ? undefined : new Date().toISOString().split('T')[0]
      };

      const res = isEditMode
        ? await updateActivity(editingActivityId, payload)
        : await createActivity(payload);

      if (res.success) {
        notifySuccess(isEditMode ? 'Activity updated' : 'Activity created');
        setModalVisible(false);
        resetForm();
        fetchActivities();
      }
    } catch (e) {
      const errMsg = e?.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} activity`;
      notifyError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewRemarks('');
    setNewTAT('');
    setErrors({});
    setIsEditMode(false);
    setEditingActivityId(null);
  };

  const openEditModal = (activity) => {
    setIsEditMode(true);
    setEditingActivityId(activity.id);
    setNewTitle(activity.title || '');
    setNewDesc(activity.description || '');
    setNewRemarks(activity.remarks || '');
    setNewTAT(activity.turnAroundTime || '');
    setErrors({});
    setModalVisible(true);
  };

  const handleConfirmTime = () => {
    setNewTAT(`${selHour}:${selMin} ${selPeriod}`);
    setShowTATPicker(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedActivity || !nextStatus) return;
    setSubmitting(true);
    try {
      const res = await updateActivityStatus(selectedActivity.id, nextStatus, remarks);
      if (res.success) {
        notifySuccess(`Status updated to ${nextStatus}`);
        setStatusModalVisible(false);
        setRemarks('');
        fetchActivities();
      }
    } catch (e) {
      const errMsg = e?.response?.data?.message || 'Update failed';
      notifyError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (targetUserId) => {
    if (!selectedActivity) return;
    setSubmitting(true);
    try {
      const res = await transferActivity(selectedActivity.id, targetUserId);
      if (res.success) {
        notifySuccess('Activity shared successfully');
        setTransferModalVisible(false);
        fetchActivities();
      }
    } catch (e) {
      notifyError('Failed to share activity');
    } finally {
      setSubmitting(false);
    }
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  const getOverdueStatus = (item) => {
    if (item.status === 'DONE') return null;
    if (!item.date) return null;

    try {
      const today = new Date().toISOString().split('T')[0];
      const itemDate = item.date;

      if (itemDate < today) return 'OVERDUE';

      if (itemDate === today && item.turnAroundTime) {
        const [time, period] = item.turnAroundTime.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        const targetDate = new Date(item.date);
        targetDate.setHours(hours, minutes, 0, 0);

        if (new Date() > targetDate) return 'DUE';
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const renderItem = ({ item }) => {
    const currentStatus = STATUS_OPTIONS.find(s => s.value === item.status) || STATUS_OPTIONS[0];
    const overdueStatus = getOverdueStatus(item);

    const isCreator = Number(item.allocatedById) === Number(currentUser?.id);
    const isTransferee = item.transferredToId == currentUser?.id;
    const sharedWithName = item.transferredTo?.profile?.name || 'Staff';

    let closedByText = "CLOSED BY ADMIN";
    if (item.isClosed && item.closedBy?.profile?.name) {
      closedByText = `CLOSED BY ${item.closedBy.profile.name.toUpperCase()}`;
    }

    return (
      <View style={styles.activityCard}>
        <View style={styles.cardHeader}>
          <View style={styles.timeCluster}>
            <Image source={require('../assets/cal.png')} style={styles.timeIcon} />
            <Text style={styles.meetingTime}>
              {new Date(item.createdAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}
            </Text>
          </View>
          {isCreator && !item.transferredToId && !item.isClosed && (
            <TouchableOpacity
              style={styles.cornerShareBtn}
              onPress={() => {
                setSelectedActivity(item);
                setTransferModalVisible(true);
              }}
            >
              <Image source={require('../assets/v2.png')} style={styles.shareIconMini} />
              <Text style={styles.shareBtnTextMini}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              {item.isClosed && (
                <View style={{ marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#FFF1F2', borderRadius: 4 }}>
                  <Text style={{ color: '#E11D48', fontWeight: '800', fontSize: 9 }}>🔒 {closedByText}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {overdueStatus && (
                <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', marginRight: 8 }]}>
                  <Text style={[styles.statusBadgeText, { color: '#DC2626' }]}>{overdueStatus}</Text>
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: currentStatus.bg }]}>
                <Text style={[styles.statusBadgeText, { color: currentStatus.color }]}>
                  {currentStatus.label}
                </Text>
              </View>
            </View>
          </View>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          {item.remarks ? (
            <View style={styles.remarksBox}>
              <Text style={styles.remarksLabel}>Remarks:</Text>
              <Text style={styles.remarksText}>{item.remarks}</Text>
            </View>
          ) : null}
          {item.turnAroundTime ? (
            <View style={styles.tatRow}>
              <Text style={styles.tatLabel}>⏱ TAT:</Text>
              <Text style={styles.tatValue}>{item.turnAroundTime}</Text>
            </View>
          ) : null}
          {item.transferredToId ? (
            <View style={[styles.tatRow, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.tatLabel, { color: '#16A34A' }]}>👥 SHARED WITH:</Text>
              <Text style={[styles.tatValue, { color: '#16A34A' }]}>{sharedWithName}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {isCreator && !item.isClosed ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : <View />}
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
            By: <Text style={{ fontWeight: '700', color: '#4B5563' }}>{item.allocatedBy?.profile?.name || 'Admin'}</Text>
          </Text>
        </View>

        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.statusBtn,
                item.status === opt.value && { backgroundColor: opt.color, borderColor: opt.color },
                item.isClosed && { opacity: 0.5 }
              ]}
              onPress={() => {
                if (item.isClosed) {
                  Alert.alert('Locked', 'This activity is closed and cannot be modified');
                  return;
                }
                setSelectedActivity(item);
                setNextStatus(opt.value);
                setRemarks(item.remarks || '');
                setStatusModalVisible(true);
              }}
              disabled={item.isClosed}
            >
              <Text style={[styles.statusBtnText, item.status === opt.value && { color: '#fff' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={styles.backIcon} />
          <Text style={styles.headerTitle}>Activity</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {STATUS_OPTIONS.map(tab => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.tab, filterTab === tab.value && styles.activeTab]}
            onPress={() => {
              setFilterTab(tab.value);
              setCurrentPage(1);
            }}
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
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>No activities found. Tap '+' to add one.</Text>
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
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>{isEditMode ? 'Edit Activity' : 'Add New Activity'}</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="Task Title *"
              placeholderTextColor="#9CA3AF"
              value={newTitle}
              onChangeText={(val) => {
                setNewTitle(val);
                if (errors.title) setErrors({ ...errors, title: null });
              }}
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }, errors.description && styles.inputError]}
              placeholder="Description *"
              placeholderTextColor="#9CA3AF"
              multiline
              value={newDesc}
              onChangeText={(val) => {
                setNewDesc(val);
                if (errors.description) setErrors({ ...errors, description: null });
              }}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Remarks (Optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              value={newRemarks}
              onChangeText={setNewRemarks}
            />

            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowTATPicker(true)}
            >
              <Text style={styles.pickerLabel}>Turn Around Time (Target Time)</Text>
              <Text style={styles.pickerValue}>{newTAT || 'Select Time'}</Text>
            </TouchableOpacity>

            {showTATPicker && (
              <Modal visible={showTATPicker} transparent animationType="fade">
                <View style={styles.customPickerOverlay}>
                  <View style={styles.customPickerBox}>
                    <Text style={styles.pickerTitle}>Set Target Time</Text>

                    <View style={styles.pickerColumns}>
                      {/* Hours */}
                      <View style={styles.pickerCol}>
                        <Text style={styles.colLabel}>HOURS</Text>
                        <ScrollView showsVerticalScrollIndicator={false} style={styles.colScroll}>
                          {hours.map(h => (
                            <TouchableOpacity
                              key={h}
                              style={[styles.colItem, selHour === h && styles.colItemSel]}
                              onPress={() => setSelHour(h)}
                            >
                              <Text style={[styles.colItemText, selHour === h && styles.colItemTextSel]}>{h}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>

                      {/* Minutes */}
                      <View style={styles.pickerCol}>
                        <Text style={styles.colLabel}>MINS</Text>
                        <ScrollView showsVerticalScrollIndicator={false} style={styles.colScroll}>
                          {minutes.map(m => (
                            <TouchableOpacity
                              key={m}
                              style={[styles.colItem, selMin === m && styles.colItemSel]}
                              onPress={() => setSelMin(m)}
                            >
                              <Text style={[styles.colItemText, selMin === m && styles.colItemTextSel]}>{m}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>

                      {/* AM/PM */}
                      <View style={[styles.pickerCol, { flex: 0.7 }]}>
                        <Text style={styles.colLabel}>AM/PM</Text>
                        <View style={styles.periodBox}>
                          {['AM', 'PM'].map(p => (
                            <TouchableOpacity
                              key={p}
                              style={[styles.periodBtn, selPeriod === p && styles.periodBtnSel]}
                              onPress={() => setSelPeriod(p)}
                            >
                              <Text style={[styles.periodBtnText, selPeriod === p && styles.periodBtnTextSel]}>{p}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>

                    <View style={styles.pickerFooter}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTATPicker(false)}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmTime}>
                        <Text style={styles.confirmBtnText}>Set Time</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{isEditMode ? 'Update Activity' : 'Save Activity'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Status Selection & Remarks Modal */}
      <Modal visible={statusModalVisible} transparent animationType="fade">
        <View style={styles.statusModalOverlay}>
          <View style={styles.statusModalContent}>
            <Text style={styles.statusModalTitle}>Update Activity Status</Text>
            <Text style={styles.statusSubTitle}>Status: {nextStatus}</Text>
            
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.label}>Remarks</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Add notes about this status change..."
                placeholderTextColor="#9CA3AF"
                multiline
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleUpdateStatus} 
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirm Status</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStatusModalVisible(false)} style={styles.statusCancelBtn}>
              <Text style={styles.statusCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transfer/Share Modal */}
      <Modal visible={transferModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>Share Activity</Text>
              <TouchableOpacity onPress={() => setTransferModalVisible(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionHeading}>Select Staff member to share with:</Text>
            <ScrollView style={{ flex: 1 }}>
              <View style={styles.staffList}>
                {staff.filter(s => s.userId !== currentUser?.id).map(s => (
                  <TouchableOpacity
                    key={s.userId}
                    style={styles.staffItem}
                    onPress={() => handleTransfer(s.userId)}
                  >
                    <View style={styles.staffInfo}>
                       <View style={[styles.avatarMini, { width: 32, height: 32, borderRadius: 16 }]}>
                        <Text style={styles.avatarText}>{s.name[0]}</Text>
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.staffName}>{s.name}</Text>
                        <Text style={styles.staffRole}>{s.designation || 'Staff'}</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#125EC9', fontWeight: 'bold' }}>Select</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
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
  list: { padding: 16 },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeader: { marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeCluster: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  timeIcon: { width: 12, height: 12, tintColor: '#125EC9', marginRight: 6 },
  meetingTime: { fontSize: 12, color: '#125EC9', fontWeight: '700' },
  cardInfo: { marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  desc: { fontSize: 14, color: '#4B5563', marginTop: 4 },
  remarksBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#D1D5DB'
  },
  remarksLabel: { fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 },
  remarksText: { fontSize: 13, color: '#374151', fontStyle: 'italic' },
  tatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#EBF3FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tatLabel: { fontSize: 11, fontWeight: '700', color: '#125EC9', marginRight: 4 },
  tatValue: { fontSize: 12, fontWeight: '700', color: '#125EC9' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  statusBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  statusBtnText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },

  cornerShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shareIconMini: {
    width: 12,
    height: 12,
    tintColor: '#125EC9',
    marginRight: 4,
  },
  shareBtnTextMini: {
    fontSize: 11,
    fontWeight: '700',
    color: '#125EC9',
  },

  empty: { textAlign: 'center', marginTop: 100, color: '#9CA3AF', fontSize: 15 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  closeModalText: { fontSize: 22, color: '#6B7280' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  saveBtn: { backgroundColor: '#125EC9', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
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
  pickerBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  pickerLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  pickerValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  customPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  customPickerBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    elevation: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerColumns: {
    flexDirection: 'row',
    height: 200,
    gap: 10,
  },
  pickerCol: {
    flex: 1,
    alignItems: 'center',
  },
  colLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 8,
    letterSpacing: 1,
  },
  colScroll: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
  },
  colItem: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  colItemSel: {
    backgroundColor: '#125EC9',
  },
  colItemText: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '600',
  },
  colItemTextSel: {
    color: '#fff',
  },
  periodBox: {
    width: '100%',
    gap: 10,
  },
  periodBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  periodBtnSel: {
    backgroundColor: '#125EC9',
    borderColor: '#125EC9',
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  periodBtnTextSel: {
    color: '#fff',
  },
  pickerFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#125EC9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    marginTop: -4, // Offset for visual centering of '+'
  },
  inputError: { borderColor: '#DC2626', backgroundColor: '#FFF5F5' },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusModalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
  },
  statusModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    textAlign: 'center',
  },
  statusSubTitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
    fontWeight: '700',
    textTransform: 'uppercase',
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
  sectionHeading: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase' },
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
    marginBottom: 8,
  },
  staffInfo: { flexDirection: 'row', alignItems: 'center' },
  staffName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  staffRole: { fontSize: 12, color: '#6B7280' },
  avatarMini: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#125EC9', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#EBF3FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#125EC9',
  },
  editBtnText: {
    fontSize: 11,
    color: '#125EC9',
    fontWeight: '700',
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

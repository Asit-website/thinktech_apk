import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, Pressable, Platform, TextInput, Alert, ActivityIndicator } from 'react-native';
import BottomNav from '../components/BottomNav';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createLeaveRequest, getMyLeaveCategories } from '../config/api';
import { notifyError, notifyInfo, notifySuccess } from '../utils/notify';

function formatDate(d) {
  if (!d) return 'DD / MM / YYYY';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd} / ${mm} / ${yyyy}`;
}

function toIsoDate(d) {
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ApplyLeaveScreen({ navigation }) {
  const [leaveType, setLeaveType] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryKey, setCategoryKey] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showType, setShowType] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // For web fallback we precompute a short list of dates
  const days = useMemo(() => {
    const arr = [];
    const base = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  useEffect(() => {
    let running = true;
    (async () => {
      try {
        const res = await getMyLeaveCategories();
        if (running && res?.success) {
          setCategories(Array.isArray(res.categories) ? res.categories : []);
        }
      } catch (e) {}
    })();
    return () => { running = false; };
  }, []);

  const categoryLabel = (c) => `${c.name} (${Math.max(0, Number(c.remaining || 0))} left)`;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={styles.headerTitle}>Apply Leave</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.label}>Leave Category</Text>
          <TouchableOpacity onPress={() => setShowType(true)} activeOpacity={0.8} style={styles.inputRow}>
            <Text style={[styles.placeholder, categoryKey ? styles.valueText : null]}>
              {categoryKey ? categoryLabel(categories.find(c => c.key === categoryKey) || { name: categoryKey, remaining: 0 }) : 'Select category'}
            </Text>
            <Image source={require('../assets/down.png')} style={{ width: 12, height: 12 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.colLeft]}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity
              onPress={() => setShowStart(true)}
              activeOpacity={0.8}
              style={styles.inputRow}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={require('../assets/calendar2-range.png')} style={{ width: 14, height: 14 }} />
                <Text style={[styles.placeholder, { marginLeft: 8 }, startDate && styles.valueText]}>{formatDate(startDate)}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.field, styles.colRight]}>
            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity
              onPress={() => setShowEnd(true)}
              activeOpacity={0.8}
              style={styles.inputRow}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={require('../assets/calendar2-range.png')} style={{ width: 14, height: 14 }} />
                <Text style={[styles.placeholder, { marginLeft: 8 }, endDate && styles.valueText]}>{formatDate(endDate)}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />

        <View style={styles.field}>
          <Text style={styles.label}>Reason</Text>
          <View style={styles.textAreaWrap}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Optional"
              placeholderTextColor="#9CA3AF"
              style={styles.textArea}
              multiline
            />
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.applyBtn}
        activeOpacity={0.9}
        disabled={loading}
        onPress={async () => {
          if (!categoryKey || !startDate || !endDate) {
            notifyInfo('Please select category and dates.');
            return;
          }
          setLoading(true);
          try {
            const res = await createLeaveRequest({
              leaveType: 'PAID',
              startDate: toIsoDate(startDate),
              endDate: toIsoDate(endDate),
              reason: reason?.trim() ? reason.trim() : undefined,
              categoryKey,
            });
            if (res?.success) {
              notifySuccess('Leave request submitted successfully.');
              navigation.goBack();
            } else {
              notifyError(res?.message || 'Unable to submit leave request. Please try again.');
            }
          } catch (e) {
            notifyError('Unable to submit leave request. Please try again.');
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyText}>Apply</Text>}
      </TouchableOpacity>

      {/* Type Picker Modal */}
      <Modal visible={showType} transparent animationType="fade" onRequestClose={() => setShowType(false)}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalBackdropFill} onPress={() => setShowType(false)} />
          <View style={styles.modalSheet}>
            {categories.map((c) => (
              <TouchableOpacity key={c.key} style={styles.modalRow} onPress={() => { setCategoryKey(c.key); setShowType(false); }}>
                <Text style={styles.modalText}>{categoryLabel(c)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Web fallback modal for Start Date */}
      {Platform.OS === 'web' && showStart && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowStart(false)}>
          <View style={styles.modalContainerCenter}>
            <Pressable style={styles.modalBackdropFill} onPress={() => setShowStart(false)} />
            <View style={styles.modalSheetLarge}>
              <Text style={styles.modalTitle}>Select start date</Text>
              <ScrollView style={{ maxHeight: 260 }}>
                {days.map((d) => (
                  <TouchableOpacity key={`s-${d.toDateString()}`} style={styles.modalRow} onPress={() => { setStartDate(d); setShowStart(false); if (endDate && endDate < d) setEndDate(d); }}>
                    <Text style={styles.modalText}>{formatDate(d)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Native Start Date Picker */}
      {Platform.OS !== 'web' && showStart && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowStart(false);
            if (selectedDate) {
              setStartDate(selectedDate);
              if (endDate && endDate < selectedDate) {
                setEndDate(selectedDate);
              }
            }
          }}
        />
      )}

      {/* Web fallback modal for End Date */}
      {Platform.OS === 'web' && showEnd && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowEnd(false)}>
          <View style={styles.modalContainerCenter}>
            <Pressable style={styles.modalBackdropFill} onPress={() => setShowEnd(false)} />
            <View style={styles.modalSheetLarge}>
              <Text style={styles.modalTitle}>Select end date</Text>
              <ScrollView style={{ maxHeight: 260 }}>
                {days
                  .filter((d) => !startDate || d >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()))
                  .map((d) => (
                    <TouchableOpacity key={`e-${d.toDateString()}`} style={styles.modalRow} onPress={() => { setEndDate(d); setShowEnd(false); }}>
                      <Text style={styles.modalText}>{formatDate(d)}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Native End Date Picker */}
      {Platform.OS !== 'web' && showEnd && (
        <DateTimePicker
          value={endDate || startDate || new Date()}
          mode="date"
          display="default"
          minimumDate={startDate || new Date()}
          onChange={(event, selectedDate) => {
            setShowEnd(false);
            if (selectedDate) setEndDate(selectedDate);
          }}
        />
      )}
      {/* <BottomNav navigation={navigation} activeKey="salary" /> */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'start',
    paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30,
    marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    // shadowOffset intentionally omitted to match other screens
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  backBtn: { paddingTop:6,paddingBottom:6 },
  backChevron: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' },

  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 },

  row: { flexDirection: 'row', gap: 12 },
  colLeft: { flex: 1 },
  colRight: { flex: 1 },
  field: { marginBottom: 18 },
  label: { color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
  inputRow: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  placeholder: { color: '#616161', fontFamily: 'Inter_400Regular', fontSize: 12 },

  applyBtn: {
    position: 'absolute', left: 16, right: 16, bottom: 30,
    height: 44, borderRadius: 8,
    backgroundColor: '#125EC9', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },
  applyText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },

  textAreaWrap: {
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 80,
    color: '#1f2c3a',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlignVertical: 'top',
    outline: 'none',
  },

  // Modal styles for select and date pickers
  modalContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalContainerCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdropFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalSheetLarge: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: { color: '#125EC9', fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  modalRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EEFF',
  },
  modalText: { color: '#1f2c3a', fontFamily: 'Inter_500Medium' },
  valueText: { color: '#1f2c3a', fontFamily: 'Inter_500Medium' },
});

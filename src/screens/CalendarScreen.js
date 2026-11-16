import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import BottomNav from '../components/BottomNav';
import CustomDatePicker from '../components/CustomDatePicker';
import CustomTimePicker from '../components/CustomTimePicker';
import { getAttendanceHistory, getMe, applyRegularization, getMyRegularizations } from '../config/api';
import { notifyError, notifySuccess } from '../utils/notify';

function getMonthMatrix(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const startDay = first.getDay(); // 0..6 Sun..Sat
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime12(d) {
  if (!d) return '--:--';
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function formatTime12FromStr(isoOrTimeStr) {
  if (!isoOrTimeStr) return '--:--';
  try {
    if (isoOrTimeStr.includes('T') || isoOrTimeStr.includes('-')) {
      const d = new Date(isoOrTimeStr);
      if (!isNaN(d.getTime())) return formatTime12(d);
    }
    const parts = String(isoOrTimeStr).split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
    return String(isoOrTimeStr);
  } catch (_) {
    return '--:--';
  }
}

function formatTime24(d) {
  if (!d) return null;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}:00`;
}

function formatDateDisplay(d) {
  if (!d) return 'Select Date';
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

export default function CalendarScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'calendar');
  const [monthDate, setMonthDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [daysByDate, setDaysByDate] = useState({});
  const [selected, setSelected] = useState(null);
  const [staffStartMonth, setStaffStartMonth] = useState(null);

  // Regularization state
  const [regularizations, setRegularizations] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);

  // Regularization form state
  const [formDate, setFormDate] = useState(new Date());
  const [formInTime, setFormInTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 30, 0, 0);
    return d;
  });
  const [formOutTime, setFormOutTime] = useState(() => {
    const d = new Date();
    d.setHours(18, 30, 0, 0);
    return d;
  });
  const [formReason, setFormReason] = useState('');

  // Pickers state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showInTimePicker, setShowInTimePicker] = useState(false);
  const [showOutTimePicker, setShowOutTimePicker] = useState(false);

  const matrix = useMemo(() => getMonthMatrix(monthDate), [monthDate]);

  const monthKey = useMemo(() => {
    const y = monthDate.getFullYear();
    const m = String(monthDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [monthDate]);

  // Load calendar history and regularizations
  const loadData = async (mKey) => {
    setLoading(true);
    setRegLoading(true);
    try {
      const [histRes, regRes] = await Promise.all([
        getAttendanceHistory(mKey).catch(() => null),
        getMyRegularizations(mKey).catch(() => null)
      ]);

      if (histRes?.success && Array.isArray(histRes?.days)) {
        const map = {};
        histRes.days.forEach((d) => {
          if (!d?.date) return;
          map[String(d.date)] = d;
        });
        setDaysByDate(map);
      } else {
        setDaysByDate({});
      }

      if (regRes?.success && Array.isArray(regRes?.regularizations)) {
        setRegularizations(regRes.regularizations);
      } else {
        setRegularizations([]);
      }
    } catch (e) {
      notifyError('Unable to load attendance data.');
    } finally {
      setLoading(false);
      setRegLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        const user = me?.success ? me.user : null;
        if (user) {
          const candidates = [user?.profile?.dateOfJoining, user?.createdAt, user?.profile?.createdAt].filter(Boolean);
          for (const c of candidates) {
            const d = new Date(c);
            if (!Number.isNaN(d.getTime())) {
              const start = new Date(d.getFullYear(), d.getMonth(), 1);
              setStaffStartMonth(start);
              break;
            }
          }
        }
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    loadData(monthKey);
  }, [monthKey]);

  const canGoPrev = useMemo(() => {
    if (!staffStartMonth) return true;
    const sel = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    return sel > staffStartMonth;
  }, [monthDate, staffStartMonth]);

  const dec = () => {
    if (!canGoPrev) return;
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const inc = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const headerLabel = `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  const dateKeyForDay = (day) => {
    if (!day) return null;
    const y = monthDate.getFullYear();
    const m = String(monthDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const statusColor = (dateKey) => {
    const st = String(daysByDate?.[dateKey]?.dayStatus || '');
    if (st === 'ABSENT') return '#D90000';
    if (st === 'PRESENT') return '#10C300';
    if (st === 'OVERTIME') return '#10C300';
    if (st === 'LEAVE') return '#8C2DFF';
    if (st === 'HALF_DAY') return '#F3F300';
    if (st === 'HOLIDAY') return '#6B7280';
    if (st === 'WEEKLY_OFF') return '#5BC0DE';
    return null;
  };

  const cellBg = (dateKey, day) => {
    if (!day) return '#F3F4F6';
    const st = String(daysByDate?.[dateKey]?.dayStatus || '');
    if (st === 'ABSENT') return '#CA0000';
    if (st === 'HOLIDAY') return '#F3F4F6';
    if (st === 'WEEKLY_OFF') return '#E1F5FE';
    return '#FFFFFF';
  };

  const dayTextColor = (dateKey) => {
    const st = String(daysByDate?.[dateKey]?.dayStatus || '');
    if (st === 'ABSENT') return '#FFFFFF';
    if (st === 'HOLIDAY') return '#6B7280';
    if (st === 'WEEKLY_OFF') return '#5BC0DE';
    return '#1f2c3a';
  };

  const onPressDay = (day) => {
    const key = dateKeyForDay(day);
    if (!key) return;
    const detail = daysByDate?.[key] || { date: key, dayStatus: 'NA' };
    setSelected(detail);
  };

  // Open apply modal for a specific day
  const handleOpenDayRegularization = (dayDetail) => {
    if (!dayDetail?.date) return;
    const [y, m, d] = dayDetail.date.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    setFormDate(targetDate);

    const defaultIn = new Date();
    defaultIn.setHours(9, 30, 0, 0);
    const defaultOut = new Date();
    defaultOut.setHours(18, 30, 0, 0);

    if (dayDetail.punchedInAt) {
      const inD = new Date(dayDetail.punchedInAt);
      setFormInTime(!isNaN(inD.getTime()) ? inD : defaultIn);
    } else {
      setFormInTime(defaultIn);
    }

    if (dayDetail.punchedOutAt) {
      const outD = new Date(dayDetail.punchedOutAt);
      setFormOutTime(!isNaN(outD.getTime()) ? outD : defaultOut);
    } else {
      setFormOutTime(defaultOut);
    }

    setFormReason('');
    setRegModalOpen(true);
  };

  // Open fresh apply modal
  const handleOpenNewRegularization = () => {
    setFormDate(new Date());
    const defaultIn = new Date();
    defaultIn.setHours(9, 30, 0, 0);
    const defaultOut = new Date();
    defaultOut.setHours(18, 30, 0, 0);
    setFormInTime(defaultIn);
    setFormOutTime(defaultOut);
    setFormReason('');
    setRegModalOpen(true);
  };

  // Submit regularization request to backend
  const handleSubmitRegularization = async () => {
    if (!formDate) {
      notifyError('Please select a date to regularize.');
      return;
    }
    if (!formReason || !formReason.trim()) {
      notifyError('Please specify the reason for regularization.');
      return;
    }

    setSubmittingReg(true);
    try {
      const payload = {
        date: toIsoDate(formDate),
        requestedInTime: formatTime24(formInTime),
        requestedOutTime: formatTime24(formOutTime),
        reason: formReason.trim()
      };

      const res = await applyRegularization(payload);
      if (res?.success) {
        notifySuccess('Attendance regularization requested successfully!');
        setRegModalOpen(false);
        setFormReason('');
        loadData(monthKey);
        setActiveTab('regularization');
      } else {
        notifyError(res?.message || 'Failed to submit regularization request');
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || err?.message || 'Failed to submit regularization request');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Check if a day has any regularization
  const getDayRegularization = (dateKey) => {
    return regularizations.find((r) => r.date === dateKey);
  };

  const selectedDayReg = selected?.date ? getDayRegularization(selected.date) : null;

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance & Regularization</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Month Navigation Row */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={dec} style={styles.chevBtn}>
            <Image source={require('../assets/left.png')} style={{ width: 32, height: 32 }} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{headerLabel}</Text>
          <TouchableOpacity onPress={inc} style={styles.chevBtn}>
            <Image source={require('../assets/right.png')} style={{ width: 32, height: 32 }} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher Pills */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.tabBtn, activeTab === 'calendar' && styles.tabBtnActive]}
            onPress={() => setActiveTab('calendar')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'calendar' && styles.tabBtnTextActive]}>
              📅 Calendar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.tabBtn, activeTab === 'regularization' && styles.tabBtnActive]}
            onPress={() => setActiveTab('regularization')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'regularization' && styles.tabBtnTextActive]}>
              📋 Regularization {regularizations.length > 0 ? `(${regularizations.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator color="#125EC9" />
          </View>
        ) : null}

        {/* TAB 1: CALENDAR VIEW */}
        {activeTab === 'calendar' ? (
          <View style={styles.calendarSection}>
            <View style={styles.weekRow}>
              {week.map((d) => (
                <Text key={d} style={styles.weekCell}>{d}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {matrix.map((day, idx) => {
                const key = dateKeyForDay(day);
                const dot = key ? statusColor(key) : null;
                const bg = cellBg(key, day);
                const textColor = key ? dayTextColor(key) : '#1f2c3a';
                const active = selected?.date && key && String(selected.date) === String(key);
                const hasReg = key ? getDayRegularization(key) : null;

                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.85}
                    onPress={() => onPressDay(day)}
                    disabled={!day}
                    style={[styles.cell, { backgroundColor: bg }, active && styles.cellActive]}
                  >
                    {day ? (
                      <Text style={[styles.dayText, { color: textColor }]}>{day}</Text>
                    ) : null}
                    {day && dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
                    {day && hasReg ? (
                      <View style={[
                        styles.regIndicator,
                        {
                          backgroundColor:
                            hasReg.status === 'APPROVED' ? '#10B981' :
                            hasReg.status === 'REJECTED' ? '#EF4444' : '#F59E0B'
                        }
                      ]} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Day Details Card */}
            {selected?.date ? (
              <View style={styles.detailCard}>
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.detailTitle}>{selected.date}</Text>
                  <View style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        selected.dayStatus === 'PRESENT' ? '#E8F5E9' :
                        selected.dayStatus === 'ABSENT' ? '#FFEBEE' :
                        selected.dayStatus === 'LEAVE' ? '#F3E8FF' :
                        selected.dayStatus === 'HALF_DAY' ? '#FEF9C3' : '#F3F4F6'
                    }
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      { color: statusColor(selected.date) || '#374151' }
                    ]}>
                      {String(selected.dayStatus || 'NA')}
                    </Text>
                  </View>
                </View>

                {/* Punch Timings */}
                {(selected.punchedInAt || selected.punchedOutAt) ? (
                  <View style={styles.punchTimeRow}>
                    <Text style={styles.punchText}>
                      In: <Text style={{ fontWeight: '600', color: '#111827' }}>{formatTime12FromStr(selected.punchedInAt)}</Text>
                    </Text>
                    <Text style={[styles.punchText, { marginLeft: 16 }]}>
                      Out: <Text style={{ fontWeight: '600', color: '#111827' }}>{formatTime12FromStr(selected.punchedOutAt)}</Text>
                    </Text>
                  </View>
                ) : null}

                {selected.latePunchInMinutes > 0 ? (
                  <Text style={[styles.detailSub, { color: '#CA0000', fontWeight: '600' }]}>
                    Late arrival by {selected.latePunchInMinutes} min
                  </Text>
                ) : null}

                {selected.dayStatus === 'LEAVE' && selected.leaveType ? (
                  <Text style={styles.detailSub}>Leave: {String(selected.leaveType)}</Text>
                ) : null}

                {/* Regularization info on this day if exists */}
                {selectedDayReg ? (
                  <View style={[
                    styles.dayRegInfoBox,
                    {
                      backgroundColor:
                        selectedDayReg.status === 'APPROVED' ? '#ECFDF5' :
                        selectedDayReg.status === 'REJECTED' ? '#FEF2F2' : '#FFFBEB',
                      borderColor:
                        selectedDayReg.status === 'APPROVED' ? '#A7F3D0' :
                        selectedDayReg.status === 'REJECTED' ? '#FECACA' : '#FDE68A'
                    }
                  ]}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>
                      Regularization {selectedDayReg.status}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Requested: {formatTime12FromStr(selectedDayReg.requestedInTime)} - {formatTime12FromStr(selectedDayReg.requestedOutTime)}
                    </Text>
                    {selectedDayReg.adminRemarks ? (
                      <Text style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 2 }}>
                        Admin: {selectedDayReg.adminRemarks}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Action button: Regularize this day */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.actionRegularizeBtn}
                  onPress={() => handleOpenDayRegularization(selected)}
                >
                  <Text style={styles.actionRegularizeBtnText}>
                    {selectedDayReg ? '✍️ Update / Re-apply Regularization' : '✍️ Regularize This Day'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Legend */}
            <View style={styles.legendContainer}>
              <View style={[styles.legend, { flexWrap: 'wrap' }]}>
                <LegendItem color="#10C300" label="Present" />
                <LegendItem color="#D90000" label="Absent" />
                <LegendItem color="#8C2DFF" label="On leave" />
                <LegendItem color="#F3F300" label="Half day" />
                <LegendItem color="#6B7280" label="Holiday" />
              </View>
              <View style={[styles.legend, { marginTop: 8 }]}>
                <LegendItem color="#5BC0DE" label="Weekly Off" />
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>Regularized</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          /* TAB 2: REGULARIZATION REQUESTS VIEW */
          <View style={styles.regSection}>
            <View style={styles.regHeaderRow}>
              <View>
                <Text style={styles.regHeaderTitle}>My Regularizations</Text>
                <Text style={styles.regHeaderSub}>Requests for {headerLabel}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.newRegBtn}
                onPress={handleOpenNewRegularization}
              >
                <Text style={styles.newRegBtnText}>+ New Request</Text>
              </TouchableOpacity>
            </View>

            {regLoading && (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color="#125EC9" />
              </View>
            )}

            {!regLoading && regularizations.length === 0 ? (
              <View style={styles.emptyRegBox}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
                <Text style={styles.emptyRegTitle}>No requests submitted</Text>
                <Text style={styles.emptyRegSub}>
                  Forgot to punch in or faced a technical glitch? Tap + New Request to regularize your attendance.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.newRegBtn, { marginTop: 14 }]}
                  onPress={handleOpenNewRegularization}
                >
                  <Text style={styles.newRegBtnText}>Apply Regularization</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* List of Regularizations */}
            {regularizations.map((item) => {
              const isApproved = item.status === 'APPROVED';
              const isRejected = item.status === 'REJECTED';
              const isPending = !isApproved && !isRejected;

              return (
                <View key={item.id} style={styles.regCard}>
                  <View style={styles.regCardTop}>
                    <View>
                      <Text style={styles.regCardDate}>{item.date}</Text>
                      <Text style={styles.regCardTimings}>
                        In: {formatTime12FromStr(item.requestedInTime)}  ·  Out: {formatTime12FromStr(item.requestedOutTime)}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusPill,
                      {
                        backgroundColor: isApproved ? '#DEF7EC' : isRejected ? '#FDE8E8' : '#FEF08A'
                      }
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        {
                          color: isApproved ? '#03543F' : isRejected ? '#9B1C1C' : '#713F12'
                        }
                      ]}>
                        {isApproved ? '✓ Approved' : isRejected ? '✕ Rejected' : '⏳ Pending'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.regCardDivider} />

                  <View style={styles.regCardBody}>
                    <Text style={styles.regReasonLabel}>Reason:</Text>
                    <Text style={styles.regReasonText}>{item.reason || 'No reason provided'}</Text>
                  </View>

                  {item.adminRemarks ? (
                    <View style={styles.adminRemarksBox}>
                      <Text style={styles.adminRemarksLabel}>Admin Note:</Text>
                      <Text style={styles.adminRemarksText}>{item.adminRemarks}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* MODAL: Apply Attendance Regularization */}
      <Modal
        visible={regModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRegModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Apply Regularization</Text>
                <Text style={styles.modalSubTitle}>Request punch adjustment for approval</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRegModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Field 1: Date */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Date to Regularize *</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.formPickerInput}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.formPickerText}>
                    📅 {formatDateDisplay(formDate)}
                  </Text>
                  <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: '500' }}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* Field 2 & 3: Requested Timings */}
              <View style={styles.timingRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.formLabel}>Punch In Time</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.formPickerInput}
                    onPress={() => setShowInTimePicker(true)}
                  >
                    <Text style={styles.formPickerText}>
                      ⏰ {formatTime12(formInTime)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.formLabel}>Punch Out Time</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.formPickerInput}
                    onPress={() => setShowOutTimePicker(true)}
                  >
                    <Text style={styles.formPickerText}>
                      ⏰ {formatTime12(formOutTime)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Field 4: Reason */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reason for Regularization *</Text>
                <TextInput
                  style={styles.formTextArea}
                  multiline
                  numberOfLines={4}
                  placeholder="e.g. Forgot to punch in due to onsite client meeting, or biometric machine network glitch"
                  placeholderTextColor="#9CA3AF"
                  value={formReason}
                  onChangeText={setFormReason}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.cancelBtn}
                onPress={() => setRegModalOpen(false)}
                disabled={submittingReg}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.submitBtn, submittingReg && { opacity: 0.7 }]}
                onPress={handleSubmitRegularization}
                disabled={submittingReg}
              >
                {submittingReg ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date Picker Component */}
      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(d) => setFormDate(d)}
        initialDate={formDate}
      />

      {/* Time Pickers */}
      <CustomTimePicker
        visible={showInTimePicker}
        onClose={() => setShowInTimePicker(false)}
        onSelect={(t) => setFormInTime(t)}
        initialTime={formInTime}
      />

      <CustomTimePicker
        visible={showOutTimePicker}
        onClose={() => setShowOutTimePicker(false)}
        onSelect={(t) => setFormOutTime(t)}
        initialTime={formOutTime}
      />

      <BottomNav navigation={navigation} activeKey="Attendance" />
    </SafeAreaView>
  );
}

function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 25 : 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#ffffff'
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  headerTitle: { fontSize: 17, color: '#1E293B', fontFamily: 'Inter_600SemiBold' },

  scrollContent: { padding: 16, paddingBottom: 85 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  chevBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  monthLabel: { fontFamily: 'Inter_600SemiBold', color: '#1E293B', fontSize: 17 },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  tabBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Inter_500Medium'
  },
  tabBtnTextActive: {
    color: '#125EC9',
    fontFamily: 'Inter_600SemiBold'
  },

  // Calendar Grid
  calendarSection: {},
  weekRow: { flexDirection: 'row', marginBottom: 10, marginTop: 4 },
  weekCell: { flex: 1, textAlign: 'center', color: '#64748B', fontFamily: 'Inter_500Medium', fontSize: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    flexBasis: '14.2857%',
    maxWidth: '14.2857%',
    aspectRatio: 1,
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 4
  },
  cellActive: { borderColor: '#125EC9', borderWidth: 2 },
  dayText: { color: '#1F2937', fontFamily: 'Inter_500Medium', fontSize: 12 },
  dot: { width: 5, height: 5, borderRadius: 5, position: 'absolute', bottom: 4 },
  regIndicator: {
    width: 6,
    height: 6,
    borderRadius: 6,
    position: 'absolute',
    top: 3,
    right: 3
  },

  // Detail Card
  detailCard: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  detailTitle: { color: '#0F172A', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },

  punchTimeRow: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  punchText: { fontSize: 13, color: '#475569', fontFamily: 'Inter_400Regular' },
  detailSub: { marginTop: 4, color: '#64748B', fontFamily: 'Inter_400Regular', fontSize: 12 },

  dayRegInfoBox: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1
  },

  actionRegularizeBtn: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  actionRegularizeBtnText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },

  // Legend
  legendContainer: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 6 },
  legendText: { color: '#64748B', fontFamily: 'Inter_400Regular', fontSize: 12 },

  // Regularization Tab Section
  regSection: {},
  regHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  regHeaderTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#0F172A' },
  regHeaderSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  newRegBtn: {
    backgroundColor: '#125EC9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  newRegBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  emptyRegBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10
  },
  emptyRegTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1E293B' },
  emptyRegSub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, lineHeight: 18 },

  regCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  regCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  regCardDate: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#0F172A' },
  regCardTimings: { fontSize: 12, color: '#475569', marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  regCardDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  regCardBody: {},
  regReasonLabel: { fontSize: 11, color: '#94A3B8', fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  regReasonText: { fontSize: 13, color: '#334155', marginTop: 2, lineHeight: 18 },

  adminRemarksBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6'
  },
  adminRemarksLabel: { fontSize: 11, fontWeight: '600', color: '#1E40AF' },
  adminRemarksText: { fontSize: 12, color: '#475569', marginTop: 1 },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12
  },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#0F172A' },
  modalSubTitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCloseText: { fontSize: 14, color: '#64748B', fontWeight: 'bold' },

  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#334155', marginBottom: 6 },
  formPickerInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  formPickerText: { fontSize: 13, color: '#0F172A', fontFamily: 'Inter_500Medium' },
  timingRow: { flexDirection: 'row', marginBottom: 14 },

  formTextArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 80
  },

  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center'
  },
  cancelBtnText: { color: '#64748B', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  submitBtn: {
    flex: 1.5,
    backgroundColor: '#125EC9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' }
});

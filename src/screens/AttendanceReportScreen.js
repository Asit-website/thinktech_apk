import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
// import { LineChart } from 'react-native-chart-kit';
import { listMyLeaveRequests, getAttendanceReport, getWeeklyAttendance } from '../config/api';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AttendanceReportScreen({ navigation }) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifLeaves, setNotifLeaves] = React.useState([]); // APPROVED + REJECTED
  const [unseenCount, setUnseenCount] = React.useState(0);
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showNativePicker, setShowNativePicker] = React.useState(false);
  const [attendanceData, setAttendanceData] = React.useState({
    punchIn: '--',
    punchOut: '--',
    break: '--',
    weeklyData: [9.2, 8.8, 9.5, 8.7, 9.1, 0, 0]
  });
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
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
        // Badge shows total approved + rejected items
        setUnseenCount(items.length);
      } catch (e) { }
    };

    compute();
    const intv = setInterval(compute, 60000);
    return () => { cancelled = true; clearInterval(intv); };
  }, []);

  // Fetch attendance data when component mounts and when date changes
  React.useEffect(() => {
    fetchAttendanceData(selectedDate);
  }, [selectedDate]);

  const onMarkRead = async () => {
    setNotifLeaves([]);
    setUnseenCount(0);
    setNotifOpen(false);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleWebDateChange = (dateString) => {
    setSelectedDate(new Date(dateString));
    fetchAttendanceData(new Date(dateString));
  };

  const handleNativeDateChange = (event, selectedDate) => {
    setShowNativePicker(false);
    if (event.type === 'set' && selectedDate) {
      setSelectedDate(selectedDate);
      fetchAttendanceData(selectedDate);
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'web') {
      setShowDatePicker(true);
    } else {
      setShowNativePicker(true);
    }
  };

  const fetchAttendanceData = async (date) => {
    try {
      setIsLoading(true);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log('Mobile: Fetching attendance for date:', dateStr);

      // Fetch attendance data for the selected date
      const attendanceResponse = await getAttendanceReport(dateStr);
      console.log('Mobile: API response:', attendanceResponse);

      // Fetch weekly data for the chart
      const weekStart = new Date(date);
      const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Adjust for Monday start
      weekStart.setDate(date.getDate() - daysFromMonday); // Start of week (Monday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End of week (Sunday)

      const startDateStr = weekStart.toISOString().split('T')[0];
      const endDateStr = weekEnd.toISOString().split('T')[0];

      console.log('Mobile: Week date range:', {
        selectedDate: date.toISOString().split('T')[0],
        weekStart: startDateStr,
        weekEnd: endDateStr,
        dayOfWeek: date.getDay(),
        daysFromMonday: daysFromMonday
      });

      const weeklyResponse = await getWeeklyAttendance(
        startDateStr,
        endDateStr
      );
      console.log('Mobile: Weekly response:', weeklyResponse);

      // Process the API response
      console.log('Mobile: Checking response structure:', {
        hasResponse: !!attendanceResponse,
        hasData: !!(attendanceResponse && attendanceResponse.data),
        responseKeys: attendanceResponse ? Object.keys(attendanceResponse) : 'no response',
        dataKeys: attendanceResponse && attendanceResponse.data ? Object.keys(attendanceResponse.data) : 'no data',
        fullResponse: attendanceResponse
      });

      if (attendanceResponse && attendanceResponse.success && attendanceResponse.data) {
        const data = attendanceResponse.data;
        console.log('Mobile: Processing data:', data);
        console.log('Mobile: Data keys:', Object.keys(data));
        console.log('Mobile: Weekly response data:', weeklyResponse?.data);

        const punchInTime = data.punchIn ? formatTime(data.punchIn) : '--';
        const punchOutTime = data.punchOut ? formatTime(data.punchOut) : '--';
        const breakTime = data.breakDuration !== null && data.breakDuration !== undefined ?
          formatBreakDuration(data.breakDuration, data.breakDurationSeconds) : '--';

        console.log('Mobile: Formatted times:', { punchInTime, punchOutTime, breakTime });

        const newAttendanceData = {
          punchIn: punchInTime,
          punchOut: punchOutTime,
          break: breakTime,
          weeklyData: weeklyResponse?.data?.weeklyHours || [9.2, 8.8, 9.5, 8.7, 9.1, 0, 0]
        };

        console.log('Mobile: Weekly response:', weeklyResponse);
        console.log('Mobile: Weekly data being set:', newAttendanceData.weeklyData);
        console.log('Mobile: Setting new attendance data:', newAttendanceData);
        setAttendanceData(newAttendanceData);

        // Force a re-render by updating state
        setTimeout(() => {
          console.log('Mobile: Current attendance data after update:', attendanceData);
        }, 100);
      } else {
        console.log('Mobile: No attendance data found, using fallback');
        // Fallback for weekends or no data
        setAttendanceData({
          punchIn: '--',
          punchOut: '--',
          break: '--',
          weeklyData: weeklyResponse?.data?.weeklyHours || [9.2, 8.8, 9.5, 8.7, 9.1, 0, 0]
        });
      }
    } catch (error) {
      console.error('Mobile: Error fetching attendance data:', error);
      // Fallback to default data on error
      setAttendanceData({
        punchIn: '--',
        punchOut: '--',
        break: '--',
        weeklyData: [9.2, 8.8, 9.5, 8.7, 9.1, 0, 0]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '--';
    console.log('formatTime input:', timeStr, 'type:', typeof timeStr);

    // Handle different time formats from API
    if (typeof timeStr === 'string') {
      // If it's already formatted like "09:15 AM"
      if (timeStr.includes(':') && (timeStr.includes('AM') || timeStr.includes('PM'))) {
        return timeStr;
      }

      // If it's an ISO string like "2025-01-09T09:15:00.000Z"
      try {
        const time = new Date(timeStr);
        if (!isNaN(time.getTime())) {
          return time.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
      } catch (e) {
        console.error('Error parsing time string:', e);
      }
    }

    return timeStr; // Return as-is if we can't format it
  };

  const formatBreakDuration = (minutes, seconds) => {
    if (minutes === 0 || !minutes) {
      if (seconds && seconds > 0) return `${seconds} sec`;
      return '0 min';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    return `${hours} hr ${mins} min`;
  };

  const handleDownloadReport = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      console.log('Mobile: Generating report image for date:', dateStr);

      // Create a canvas element to draw the report
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size (A4 ratio)
      canvas.width = 794; // A4 width in pixels at 96 DPI
      canvas.height = 1123; // A4 height in pixels at 96 DPI

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add header
      ctx.fillStyle = '#125EC9';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Attendance Report', canvas.width / 2, 80);

      ctx.font = '18px Arial';
      ctx.fillStyle = '#333333';
      ctx.fillText(`Date: ${formatDate(selectedDate)}`, canvas.width / 2, 120);

      // Draw table
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';

      const tableStartY = 180;
      const rowHeight = 40;
      const col1X = 100;
      const col2X = 400;

      // Table headers
      ctx.fillStyle = '#125EC9';
      ctx.fillRect(col1X - 20, tableStartY - 30, canvas.width - 160, 40);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Field', col1X, tableStartY);
      ctx.fillText('Details', col2X, tableStartY);

      // Table data
      ctx.fillStyle = '#333333';
      ctx.fillText('Punch In', col1X, tableStartY + rowHeight);
      ctx.fillText(attendanceData.punchIn || '--', col2X, tableStartY + rowHeight);

      ctx.fillText('Punch Out', col1X, tableStartY + rowHeight * 2);
      ctx.fillText(attendanceData.punchOut || '--', col2X, tableStartY + rowHeight * 2);

      ctx.fillText('Break Duration', col1X, tableStartY + rowHeight * 3);
      ctx.fillText(attendanceData.break || '--', col2X, tableStartY + rowHeight * 3);

      // Add footer
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Generated on: ${new Date().toLocaleString()}`, canvas.width / 2, canvas.height - 60);
      ctx.fillText('ThinkTech Attendance System', canvas.width / 2, canvas.height - 30);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-report-${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('Mobile: Report image downloaded successfully');
      }, 'image/png');

    } catch (error) {
      console.error('Mobile: Error generating report image:', error);
      alert('Error generating report');
    }
  };

  const openNotifications = async () => {
    setNotifOpen(true);
    try {
      const latest = notifLeaves
        .map((it) => new Date(it.reviewedAt || it.updatedAt || it.createdAt).getTime())
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => b - a)[0];
      const toStore = latest ? new Date(latest).toISOString() : new Date().toISOString();
      await AsyncStorage.setItem('notif:lastSeenApprovedAt', toStore);
      // keep badge as total count; do not clear
    } catch { }
  };

  // Month state and handlers for the bottom section
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const today = new Date();
  const [monthIdx, setMonthIdx] = React.useState(today.getMonth());
  const [year, setYear] = React.useState(today.getFullYear());

  const prevMonth = () => {
    setMonthIdx((idx) => {
      if (idx === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return idx - 1;
    });
  };

  const nextMonth = () => {
    setMonthIdx((idx) => {
      if (idx === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return idx + 1;
    });
  };

  function Accordion({ title, children }) {
    const [open, setOpen] = React.useState(false);
    return (
      <View style={styles.accItem}>
        <TouchableOpacity style={styles.accHeader} activeOpacity={0.85} onPress={() => setOpen(v => !v)}>
          <Text style={styles.accTitle}>{title}</Text>
          <Image source={require('../assets/rightie.png')} style={[styles.accIcon, open ? { transform: [{ rotate: '90deg' }] } : null]} />
        </TouchableOpacity>
        {open ? <View style={styles.accBody}>{children}</View> : null}
      </View>
    );
  }

  function Row({ label, amount }) {
    return (
      <View style={styles.rowBetween}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowAmount}>{amount}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance Report</Text>
        <TouchableOpacity style={styles.bellButton} activeOpacity={0.7} onPress={openNotifications}>
          <Image source={require('../assets/bell (2).png')} style={{ width: 18, height: 18 }} />
          {unseenCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : String(unseenCount)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View> */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={styles.headerTitle}>Attendance Report</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.datePickerCard}>
          <View style={styles.datePickerRow}>
            <TouchableOpacity style={styles.datePickerButton} activeOpacity={0.7} onPress={openDatePicker}>
              <Image source={require('../assets/desti.png')} style={{ width: 16, height: 16 }} />
              <Text style={styles.datePickerText}>{formatDate(selectedDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <Modal transparent animationType="slide">
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerContainer}>
                <Text style={styles.datePickerTitle}>Select Date</Text>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => handleWebDateChange(e.target.value)}
                  style={styles.webDatePicker}
                />
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.datePickerConfirm} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerConfirmText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Native Date Picker for Android and iOS */}
        {showNativePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleNativeDateChange}
          />
        )}

        <View style={styles.punchCardRow}>
          <View style={styles.punchCard}>
            <View style={styles.punchContent}>
              <Image source={require('../assets/clock-fill.png')} style={styles.punchIcon} />
              <View>
                <View>
                  <Text style={styles.punchLabel}>Punch In</Text>
                </View>
                <Text style={styles.punchTime}>{attendanceData.punchIn}</Text>
              </View>
            </View>
          </View>
          <View style={styles.punchCard1}>
            <View style={styles.punchContent}>
              <Image source={require('../assets/clocks.png')} style={styles.punchIcon} />
              <View>
                <Text style={styles.punchLabel1}>Punch Out</Text>
                <Text style={styles.punchTime}>{attendanceData.punchOut}</Text>
              </View>
            </View>
          </View>
          <View style={styles.punchCard2}>
            <View style={styles.punchContent}>
              <Image source={require('../assets/hots.png')} style={styles.punchIcon} />
              <View>
                <Text style={styles.punchLabel2}>Break</Text>
                <Text style={styles.punchTime}>{attendanceData.break}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.imageContainer}>
          <View style={styles.weeklyProgressCard}>
            <Text style={styles.weeklyProgressTitle}>Weekly Progress</Text>
            <View style={styles.weeklyProgressContainer}>
              {attendanceData.weeklyData && attendanceData.weeklyData.length > 0 ? (
                attendanceData.weeklyData.map((hours, index) => {
                  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                  // Ensure hours is a number and handle edge cases
                  const normalizedHours = typeof hours === 'string' ? parseFloat(hours) : Number(hours);
                  const validHours = isNaN(normalizedHours) ? 0 : normalizedHours;

                  // Convert hours to minutes for display
                  const validMinutes = Math.round(validHours * 60);

                  const maxMinutes = 600; // Maximum expected minutes (10 hours) for scaling
                  const percentage = Math.min((validMinutes / maxMinutes) * 100, 100);
                  const colors = ['#0090F6', '#125EC9', '#1E40AF', '#1E3A8A', '#172554', '#0F172A', '#020617'];

                  console.log(`Mobile: Day ${days[index]} - Raw: ${hours}, Valid: ${validHours}, Minutes: ${validMinutes}, Percentage: ${percentage}%`);

                  return (
                    <View key={days[index]} style={styles.weeklyProgressItem}>
                      <View style={styles.weeklyProgressHeader}>
                        <Text style={styles.weeklyProgressLabel}>{days[index]}</Text>
                        <Text style={styles.weeklyProgressValue}>{validMinutes}m</Text>
                      </View>
                      <View style={styles.weeklyProgressBarContainer}>
                        <View
                          style={[
                            styles.weeklyProgressBar,
                            {
                              backgroundColor: colors[index],
                              width: `${Math.max(percentage, 3)}%` // Minimum 3% width for visibility
                            }
                          ]}
                        />
                      </View>
                      <Text style={styles.weeklyProgressPercentage}>{percentage.toFixed(0)}%</Text>
                    </View>
                  );
                })
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
                  <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
                    No weekly data available
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* <TouchableOpacity style={styles.downloadButton} activeOpacity={0.85} onPress={handleDownloadReport}>
          <Image source={require('../assets/vix.png')} style={styles.downloadIcon} />
          <Text style={styles.downloadButtonText}>Download</Text>
        </TouchableOpacity> */}
      </ScrollView>

      {/* <BottomNav navigation={navigation} activeKey="Attendance" /> */}


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

function QuickAction({ title, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.actionLeft}>
        <Image source={icon} style={{ width: 18, height: 18 }} />
        <View style={styles.actionLabelRow}>
          <Text style={styles.actionText}>{title}</Text>
        </View>
      </View>
      <Image source={require('../assets/stoke.png')} style={{ width: 12, height: 12, tintColor: '#125EC9' }} />
    </TouchableOpacity>
  );
}

// legacy BottomBar/BarItem removed in favor of shared BottomNav

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
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
  backBtn: { paddingTop: 6, paddingBottom: 6 },
  backChevron: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' },

  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, paddingHorizontal: 3, backgroundColor: '#EF4444', borderRadius: 8, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: 'Inter_600SemiBold' },
  bellEmoji: {
    fontSize: 18,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  // content: {
  //   paddingHorizontal: 16,
  //   paddingBottom: 200,
  // },
  summaryCard: {
    backgroundColor: '#F8FAFF',
    borderColor: '#2E6ADB',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    // Shadow to match: box-shadow: 0px 11px 10.7px -7px #00000040
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.25,
    shadowRadius: 10.7,
    elevation: 10,
    overflow: 'visible',
    position: 'relative',
    marginTop: 50
  },
  dateHeader: {
    backgroundColor: '#184181',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'absolute',
    left: 0,
    right: 0,
    top: -15,
    zIndex: 2,

  },
  dateText: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  timerGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 0,
  },
  timerCluster: {
    width: 100,
  },
  timerPill: {
    backgroundColor: '#223151',
    borderRadius: 6,
    width: 134,
    height: 41,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  timerLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 3,
    width: 90,
  },
  timerLabelText: {
    color: '#223151',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    width: 26,
    textAlign: 'center',
  },
  // column layout for hr/min/sec
  timerClusterRow: {
    flexDirection: 'row',
    width: 90,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timerCol: {
    width: 26,
    alignItems: 'center',
  },
  statsBox: {
    // backgroundColor: '#ffffff',
    // borderColor: '#D9E6FF',
    // borderWidth: 1,
    borderRadius: 12,
    // padding: 12,
    marginTop: 10,
    paddingTop: 12,
    paddingBottom: 12
  },
  summaryTop: {
    backgroundColor: '#F3F7FF',
    // borderRadius: 8,
    paddingVertical: 6,
    // paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomColor: "#AAAAAA",
    borderBottomWidth: 1
  },
  summaryRight: {
    marginLeft: 12,
    alignItems: 'flex-end',
    width: 90,
  },
  summaryCaption: {
    color: '#525252',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginBottom: 2,
  },
  summaryHeading: {
    color: '#525252',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  summaryValue: {
    color: '#125EC9',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    // gap: 16,
    // paddingTop:8
  },
  col: {
    flex: 1,
    // borderWidth: 1,
    // borderColor: '#E6EEFF',
    // borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
    borderRightColor: "#AAAAAA",
    borderRightWidth: 1,
    borderBottomColor: "#AAAAAA",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  col1: {
    flex: 1,
    // borderWidth: 1,
    // borderColor: '#E6EEFF',
    // borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
    borderBottomColor: "#AAAAAA",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  col2: {
    flex: 1,
    // borderWidth: 1,
    // borderColor: '#E6EEFF',
    // borderRadius: 10,
    paddingVertical: 10,
    borderRightColor: "#AAAAAA",
    borderRightWidth: 1,
    paddingHorizontal: 12,
  },
  col3: {
    flex: 1,
    // borderWidth: 1,
    // borderColor: '#E6EEFF',
    // borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  muted: {
    color: '#525252',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginBottom: 6,
  },
  value: {
    color: '#454545',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  value1: {
    color: '#525252',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 40
  },
  action: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#125EC9',
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 0,
  },
  actionLeft: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
  },
  actionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#125EC9',
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginTop: 2,
  },
  // bottom bar styles replaced by shared BottomNav
  activityWrap: {
    paddingTop: 8,
  },
  sectionTitle: {
    color: '#454545',
    fontFamily: 'Inter_500Medium',
    marginBottom: 15,
    marginTop: 25
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#B3B3B3',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityText: {
    color: '#616161',
    fontFamily: 'Inter_500Medium',
    fontSize: 16
  },
  activityTime: {
    color: '#616161',
    fontFamily: 'Inter_500Medium',
    fontSize: 16
  },
  footerActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 5,
  },
  btnDanger: {
    flex: 1,
    backgroundColor: '#F24E43',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDangerText: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
  btnDisabled: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabledText: {
    color: '#9CA3AF',
    fontFamily: 'Inter_600SemiBold',
  },
  timeChip: {},
  timeChipText: {},
  rightStack: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 7,
  },

  // Month section + accordion styles
  monthSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 20,
    paddingHorizontal: 15,
    marginTop: 12,
    boxShadow: '0px 7px 9.1px -5px #00000040'

  },
  monthHeader: { paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 35 },
  monthTitle: { color: '#454545', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  // monthArrow: { width: 36, height: 28, borderRadius: 6, backgroundColor: '#F3F7FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6EEFF' },
  // monthArrowText: { color: '#125EC9', fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 16 },

  accItem: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  accHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  accTitle: { color: '#454545', fontFamily: 'Inter_500Medium', fontSize: 14 },
  accIcon: { width: 12, height: 12 },
  accBody: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#FFFFFF' },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E3E3',
  },
  rowLabel: { color: '#616161', fontFamily: 'Inter_500Medium' },
  rowAmount: { color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  notifApproved: { color: '#065F46' },
  notifRejected: { color: '#B91C1C' },

  // Notification modal styles
  notifBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  notifPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  notifTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#454545',
  },
  notifClose: {
    fontSize: 18,
    color: '#6B7280',
  },
  notifEmpty: {
    textAlign: 'center',
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
    paddingVertical: 40,
  },
  notifItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  notifItemTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  notifItemText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  notifItemMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#9CA3AF',
  },

  // ss2 Attendance Report layout styles
  datePickerCard: {
    //   backgroundColor: '#ffffff',
    borderRadius: 12,
    //   borderWidth: 1,
    //   borderColor: '#E6EEFF',
    //   padding: 16,
    marginBottom: 16,
    marginTop: 20
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    width: "100%"
  },
  datePickerText: {
    color: '#454545',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  punchCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  punchCard: {
    flex: 1,
    backgroundColor: '#DAFFD7',
    borderRadius: 12,
    paddingVertical: 25,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    alignItems: 'flex-start',
  },
  punchCard1: {
    backgroundColor: "#FFD7D7", borderRadius: 12,
    paddingVertical: 25,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    alignItems: 'flex-start',
    flex: 1
  },
  punchCard2: {
    backgroundColor: "#F4FFD7", borderRadius: 12,
    paddingVertical: 25,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    alignItems: 'flex-start',
    flex: 1
  },
  punchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  punchIcon: {
    width: 15,
    height: 15,
    //   tintColor: '#ffffff',
    marginTop: 2,
    position: "relative", top: -8
  },
  punchLabel: {
    color: '#35C800',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    marginBottom: 6,
  },
  punchLabel1: {
    color: '#E80000',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    marginBottom: 6,
  },
  punchLabel2: {
    color: '#929700',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    marginBottom: 6,
  },
  punchTime: {
    color: '#454545',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  imageContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EEFF',
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  downloadButton: {
    backgroundColor: '#125EC9',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    width: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    position: "fixed", bottom: 30
  },
  downloadButtonText: {
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  downloadIcon: {
    width: 16,
    height: 16,
    tintColor: '#ffffff',
  },

  // Date picker modal styles
  datePickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  datePickerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#454545',
    marginBottom: 16,
    textAlign: 'center',
  },
  webDatePicker: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6EEFF',
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 20,
    outline: 'none',
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  datePickerCancel: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  datePickerCancelText: {
    color: '#6B7280',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  datePickerConfirm: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#125EC9',
    borderRadius: 8,
  },
  datePickerConfirmText: {
    color: '#ffffff',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },

  // Weekly progress bar styles
  weeklyProgressCard: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EEFF',
    width: '100%',
  },
  weeklyProgressTitle: {
    fontFamily: 'Inter_600SemiBold',
    color: '#1f2c3a',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  weeklyProgressContainer: { gap: 12 },
  weeklyProgressItem: { gap: 6 },
  weeklyProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  weeklyProgressLabel: {
    fontFamily: 'Inter_500Medium',
    color: '#1f2c3a',
    fontSize: 13,
    width: 40,
  },
  weeklyProgressValue: {
    fontFamily: 'Inter_600SemiBold',
    color: '#1f2c3a',
    fontSize: 13,
    width: 40,
    textAlign: 'right',
  },
  weeklyProgressBarContainer: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden'
  },
  weeklyProgressBar: {
    height: '100%',
    borderRadius: 3,
    minWidth: 1, // Ensure minimum visibility
  },
  weeklyProgressPercentage: {
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    fontSize: 11,
    textAlign: 'right',
  },
});

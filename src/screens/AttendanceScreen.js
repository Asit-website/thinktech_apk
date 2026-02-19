import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import BottomNav from '../components/BottomNav';
import { endBreak, getAttendanceStatus, punchInWithPhoto, punchOutWithPhoto, startBreak, listMyLeaveRequests, getMyLeaveCategories } from '../config/api';
import { locationTrackingService } from '../services/locationService';
// NOTE: Avoid static import of expo-location on web to prevent bundler crash; use dynamic import when needed
import { notifyError, notifyInfo, notifySuccess } from '../utils/notify';

export default function AttendanceScreen({ navigation }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null); // uri string
  const [photoTimerId, setPhotoTimerId] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLeaves, setNotifLeaves] = useState([]); // includes APPROVED and REJECTED
  const [unseenCount, setUnseenCount] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState(0);
  const [hasLeavePolicy, setHasLeavePolicy] = useState(false);

  const loadStatus = async () => {
    try {
      setRefreshing(true);
      const res = await getAttendanceStatus();
      if (res?.success) {
        console.log('Attendance status response:', JSON.stringify(res.status, null, 2));
        setStatus(res.status);
      }
    } catch (e) {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const loadLeaveBalance = async () => {
    try {
      const res = await getMyLeaveCategories();
      if (res?.success) {
        // Find if any paid categories exist (total is not null)
        const paidCats = (res.categories || []).filter(c => c.total !== null && !c.unlimited);
        if (paidCats.length > 0) {
          setHasLeavePolicy(true);
          const totalRemaining = paidCats.reduce((sum, cat) => sum + (Number(cat.remaining) || 0), 0);
          setLeaveBalance(totalRemaining);
        } else {
          setHasLeavePolicy(false);
        }
      }
    } catch (e) {
      console.error('Failed to load leave balance:', e);
    }
  };

  useEffect(() => {
    loadStatus();
    loadLeaveBalance();
    const t = setInterval(loadStatus, 5000);

    // Cleanup: stop location tracking when component unmounts
    return () => {
      clearInterval(t);
      try {
        locationTrackingService.stopTracking();
      } catch (e) {
        console.error('Failed to stop location tracking on cleanup:', e);
      }
    };
  }, []);


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
        // Show total count of approved + rejected, as requested
        setUnseenCount(items.length);
      } catch (e) {
        // ignore fetch errors for badge; optional notify if needed
      }
    };

    compute();
    const intv = setInterval(compute, 60000);
    return () => { cancelled = true; clearInterval(intv); };
  }, []);

  const openNotifications = async () => {
    setNotifOpen(true);
    try {
      // Set last seen to the latest approval timestamp among current items
      const latest = notifLeaves
        .map((it) => new Date(it.reviewedAt || it.updatedAt || it.createdAt).getTime())
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => b - a)[0];
      const toStore = latest ? new Date(latest).toISOString() : new Date().toISOString();
      await AsyncStorage.setItem('notif:lastSeenApprovedAt', toStore);
      // Keep badge showing total count; do not clear on open
    } catch { }
  };

  const onMarkRead = () => {
    setNotifLeaves([]);
    setUnseenCount(0);
    setNotifOpen(false);
  };

  const canPunchIn = !status?.punchedInAt;
  const canPunchOut = !!status?.punchedInAt && !status?.punchedOutAt;
  const isOnBreak = !!status?.isOnBreak;

  const workingSeconds = Number(status?.workingSeconds || 0);
  const breakSeconds = Number(status?.breakSeconds || 0);
  const overtimeSeconds = Number(status?.overtimeSeconds || 0);
  const dayStatus = status?.dayStatus || 'ABSENT';
  const assignedShift = status?.assignedShift || null;

  const shiftLabel = useMemo(() => {
    if (!assignedShift) return 'Not assigned';
    const t = (assignedShift.shiftType || '').toLowerCase();
    if (t === 'open') {
      const mins = Number(assignedShift.workMinutes || 0);
      return `${assignedShift.name || 'Open Shift'} • ${mins} mins`;
    }
    const start = assignedShift.startTime || '--:--';
    const end = assignedShift.endTime || '--:--';
    return `${assignedShift.name || 'Shift'} • ${start} - ${end}`;
  }, [status?.assignedShift]);

  const hh = Math.floor(workingSeconds / 3600);
  const mm = Math.floor((workingSeconds % 3600) / 60);
  const ss = Math.floor(workingSeconds % 60);

  const breakLabel = useMemo(() => {
    const h = Math.floor(breakSeconds / 3600);
    const m = Math.floor((breakSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }, [breakSeconds]);

  const breakMmSs = useMemo(() => {
    const m = String(Math.floor(breakSeconds / 60)).padStart(2, '0');
    const s = String(Math.floor(breakSeconds % 60)).padStart(2, '0');
    return `${m}:${s}`;
  }, [breakSeconds]);

  const timeoutLabel = useMemo(() => {
    const m = String(Math.floor(breakSeconds / 60)).padStart(2, '0');
    const s = String(Math.floor(breakSeconds % 60)).padStart(2, '0');
    return `${m}:${s}`;
  }, [breakSeconds]);

  const pickPhoto = async () => {
    console.log('Starting pickPhoto...');

    if (Platform.OS !== 'web') {
      console.log('Requesting camera permissions...');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      console.log('Camera permission result:', perm);
      if (!perm.granted) {
        notifyInfo('Camera permission is required to capture a photo.');
        return null;
      }
    }

    let result;
    try {
      console.log('Launching camera...');
      if (Platform.OS === 'web') {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      } else {
        result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      }

    } catch (e) {

      try {

        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });

      } catch (e2) {

        notifyError('Unable to open camera. Please try again.');
        return null;
      }
    }

    if (result.canceled) {
      console.log('User cancelled photo selection');
      return null;
    }

    const asset = result.assets?.[0];
    const uri = asset?.uri || null;
    console.log('Selected photo URI:', uri);
    return uri;
  };

  const onPunchIn = async () => {
    console.log('Starting punch-in process...');
    const uri = await pickPhoto();
    if (!uri) {
      console.log('No photo URI returned, cancelling punch-in');
      return;
    }

    console.log('Photo URI obtained, starting punch-in API call...');
    setLoading(true);
    try {
      // Request location permission and capture coordinates
      let coords = null;
      try {
        console.log('Getting location...');
        const Location = await import('expo-location');
        const { status: perm } = await Location.requestForegroundPermissionsAsync();

        if (perm !== 'granted') throw new Error('Location permission denied');
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        coords = { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy };

      } catch (e) {

        // If no geofence is assigned, backend will still allow. We'll pass no coords in that case.
      }

      console.log('Making punch-in API call...');
      const res = await punchInWithPhoto(uri, coords);


      if (res?.success) {
        console.log('Punch-in successful, refreshing status...');
        await loadStatus();
        notifySuccess('Punch-in recorded successfully.');

        // Start location tracking after successful punch-in
        try {
          console.log('Starting location tracking...');
          await locationTrackingService.startTracking(2); // Track every 2 minutes
          notifyInfo('Location tracking started for your shift.');
        } catch (e) {
          console.error('Failed to start location tracking:', e);
          // Don't show error to user as punch-in was successful
        }

        // Show photo preview after successful punch-in
        try {
          setPhotoPreview(uri);
          if (photoTimerId) clearTimeout(photoTimerId);
          const t = setTimeout(() => setPhotoPreview(null), 5000);
          setPhotoTimerId(t);
        } catch (e) { }
      } else {
        notifyError(res?.message || 'Punch-in failed. Please try again.');
      }
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Punch-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onPunchOut = async () => {
    const uri = await pickPhoto();
    if (!uri) return;

    setLoading(true);
    try {
      const res = await punchOutWithPhoto(uri);
      if (res?.success) {
        await loadStatus();
        notifySuccess('Punch-out recorded successfully.');

        // Stop location tracking after successful punch-out
        try {
          console.log('Stopping location tracking...');
          locationTrackingService.stopTracking();
          notifyInfo('Location tracking stopped.');
        } catch (e) {
          console.error('Failed to stop location tracking:', e);
          // Don't show error to user as punch-out was successful
        }

        // Show photo preview after successful punch-out
        try {
          setPhotoPreview(uri);
          if (photoTimerId) clearTimeout(photoTimerId);
          const t = setTimeout(() => setPhotoPreview(null), 5000);
          setPhotoTimerId(t);
        } catch (e) { }
      } else {
        notifyError(res?.message || 'Punch-out failed. Please try again.');
      }
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Punch-out failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onToggleBreak = async () => {
    setLoading(true);
    try {
      const res = isOnBreak ? await endBreak() : await startBreak();
      if (res?.success) {
        await loadStatus();
        notifySuccess(isOnBreak ? 'Break ended successfully.' : 'Break started successfully.');
      } else {
        notifyError(res?.message || 'Unable to update break status. Please try again.');
      }
    } catch (e) {
      notifyError(e?.response?.data?.message || 'Unable to update break status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatClock = (iso) => {
    if (!iso) return '--';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const dateLabel = useMemo(() => {
    const iso = status?.date;
    const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
    return `${dd}-${mm}-${yyyy}   ${weekday}`;
  }, [status?.date]);

  const dayStatusLabel = useMemo(() => {
    console.log('Mobile dayStatus:', dayStatus);
    if (dayStatus === 'PRESENT') return 'Present';
    if (dayStatus === 'HALF_DAY') return 'Half day';
    if (dayStatus === 'OVERTIME') return 'Overtime';
    if (dayStatus === 'LEAVE') return 'Leave';
    return 'Absent';
  }, [dayStatus]);

  const statusColor = useMemo(() => {
    if (dayStatus === 'PRESENT') return '#52c41a'; // Green
    if (dayStatus === 'HALF_DAY') return '#faad14'; // Orange
    if (dayStatus === 'OVERTIME') return '#1890ff'; // Blue
    if (dayStatus === 'LEAVE') return '#722ed1'; // Purple
    return '#f5222d'; // Red for Absent
  }, [dayStatus]);

  const overtimeLabel = useMemo(() => {
    if (!overtimeSeconds) return null;
    const h = Math.floor(overtimeSeconds / 3600);
    const m = Math.floor((overtimeSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m overtime`;
    return `${m}m overtime`;
  }, [overtimeSeconds]);

  const formatDate = (d) => {
    if (!d) return '--';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '--';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <TouchableOpacity style={styles.bellButton} activeOpacity={0.7} onPress={openNotifications}>
          <Image source={require('../assets/bell (2).png')} style={{ width: 18, height: 18 }} />
          {unseenCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : String(unseenCount)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <View style={styles.dateHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 7, paddingVertical: 7 }}>
              <Image source={require('../assets/cal.png')} style={{ width: 14, height: 14, tintColor: '#ffffff' }} />
              <Text style={styles.dateText}>{dateLabel}</Text>
            </View>
          </View>
          <View style={styles.statsBox}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.summaryCaption}>Total</Text>
                <Text style={styles.summaryHeading}>Working Hours</Text>
                {overtimeLabel ? <Text style={styles.summaryCaption}>{overtimeLabel}</Text> : null}
              </View>
              <View style={styles.summaryRight}>
                <View style={styles.timerClusterRow}>
                  <View style={styles.timerCol}>
                    <View style={styles.timerPill}><Text style={styles.timerText}>{String(hh).padStart(2, '0')}</Text></View>
                    <Text style={styles.timerLabelText}>hr</Text>
                  </View>
                  <View style={styles.timerCol}>
                    <View style={styles.timerPill}><Text style={styles.timerText}>{String(mm).padStart(2, '0')}</Text></View>
                    <Text style={styles.timerLabelText}>min</Text>
                  </View>
                  <View style={styles.timerCol}>
                    <View style={styles.timerPill}><Text style={styles.timerText}>{String(ss).padStart(2, '0')}</Text></View>
                    <Text style={styles.timerLabelText}>sec</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.muted}>Shift</Text>
                <Text style={styles.value}>{shiftLabel}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.muted}>Punch in</Text>
                <Text style={styles.value}>{formatClock(status?.punchedInAt)}</Text>
              </View>
              <View style={styles.col1}>
                <Text style={styles.muted}>Punch out</Text>
                <Text style={styles.value}>{formatClock(status?.punchedOutAt)}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col2}>
                <Text style={styles.muted}>Break</Text>
                <Text style={styles.value}>{breakMmSs}</Text>
              </View>
              <View style={styles.col3}>
                <Text style={styles.muted}>Leave Balance</Text>
                {hasLeavePolicy ? (
                  <Text style={[styles.value, { color: '#fb8500', fontWeight: 'bold' }]}>{leaveBalance} Days</Text>
                ) : (
                  <Text style={[styles.value, { color: '#f5222d', fontSize: 10, fontWeight: 'bold' }]}>No leave policy assign</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <QuickAction title="Leave" icon={require('../assets/leave1.png')} onPress={() => navigation.navigate('Leave')} />
          <QuickAction title="History" icon={require('../assets/leave2.png')} onPress={() => navigation.navigate('History')} />
          <QuickAction title="Calendar" icon={require('../assets/leave3.png')} onPress={() => navigation.navigate('Calendar')} />
          {/* <QuickAction title="More" icon={require('../assets/currency-rupee.png')} /> */}
        </View>

        <View style={styles.activityWrap}>
          <Text style={styles.sectionTitle}>Your Activity</Text>
          {status?.punchedInAt ? (
            <View style={styles.activityRow}>
              <View style={styles.activityLeft}>
                <Image source={require('../assets/v2.png')} style={{ width: 14, height: 14 }} />
                <Text style={styles.activityText}>Punch in</Text>
              </View>
              <Text style={styles.activityTime}>{formatClock(status?.punchedInAt)}</Text>
            </View>
          ) : null}

          {status?.punchedOutAt ? (
            <View style={styles.activityRow}>
              <View style={styles.activityLeft}>
                <Image source={require('../assets/v2.png')} style={{ width: 14, height: 14 }} />
                <Text style={styles.activityText}>Punch out</Text>
              </View>
              <Text style={styles.activityTime}>{formatClock(status?.punchedOutAt)}</Text>
            </View>
          ) : null}

          {!status?.punchedInAt && !status?.punchedOutAt ? (
            <View style={styles.activityRow}>
              <View style={styles.activityLeft}>
                <Image source={require('../assets/v2.png')} style={{ width: 14, height: 14 }} />
                <Text style={styles.activityText}>No activity yet</Text>
              </View>
              <Text style={styles.activityTime}>--</Text>
            </View>
          ) : null}
        </View>

        {/* spacer removed; bottom padding on ScrollView handles safe space */}
      </ScrollView>

      <View style={styles.footerActions}>
        <TouchableOpacity style={[styles.btnDanger, !canPunchOut ? styles.btnDisabled : null]} onPress={onPunchOut} disabled={!canPunchOut || loading}>
          {loading && canPunchOut ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnDangerText, !canPunchOut ? styles.btnDisabledText : null]}>Punch out</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnDisabled, canPunchIn ? styles.btnPrimary : null]} onPress={onPunchIn} disabled={!canPunchIn || loading}>
          {loading && canPunchIn ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnDisabledText, canPunchIn ? styles.btnPrimaryText : null]}>Punch in</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.rightStack}>
        <View style={styles.timeoutCard}>
          <View>
            <Text style={styles.timeoutLabel}>Timeout</Text>
            <Text style={styles.timeoutValue}>{timeoutLabel}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.timeoutIconChip} activeOpacity={0.85} onPress={onToggleBreak} disabled={!status?.punchedInAt || !!status?.punchedOutAt || loading}>
          <Image source={require('../assets/cup-hot.png')} style={{ width: 20, height: 20, tintColor: '#ffffff' }} />
        </TouchableOpacity>
      </View>

      <BottomNav navigation={navigation} activeKey="Attendance" />
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
      {/* Photo preview popup */}
      <Modal visible={!!photoPreview} transparent animationType="fade" onRequestClose={() => setPhotoPreview(null)}>
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <Image source={{ uri: photoPreview || undefined }} style={styles.previewImage} resizeMode="cover" />
            <TouchableOpacity style={styles.previewClose} activeOpacity={0.85} onPress={() => setPhotoPreview(null)}>
              <Text style={styles.previewCloseText}>✕</Text>
            </TouchableOpacity>
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
  notifBackdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  notifPanel: {
    width: '78%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notifTitle: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter_600SemiBold',
  },
  notifClose: {
    fontSize: 18,
    color: '#6B7280',
  },
  notifEmpty: {
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 12,
  },
  notifItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#F9FAFB',
  },
  notifItemTitle: {
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  notifItemText: {
    fontFamily: 'Inter_500Medium',
    color: '#374151',
  },
  notifItemMeta: {
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginTop: 6,
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 30,
    marginLeft: 5,
    marginRight: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#B3B3B3',
    backgroundColor: '#ffffff',
    // shadow similar to: y:7, blur:6, spread:-6
    shadowColor: '#000',
    // shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 18,
    color: '#125EC9',
    fontFamily: 'Inter_600SemiBold',
  },
  bellButton: {
    padding: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  bellEmoji: {
    fontSize: 18,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 200,
  },
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
    marginTop: 25
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
    width: 26,
    height: 26,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
  btnPrimary: {
    backgroundColor: '#FF4747',
  },
  btnDisabledText: {
    color: '#BFBFBF',
    fontFamily: 'Inter_600SemiBold',
  },
  btnPrimaryText: {
    color: '#ffffff',
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
  timeoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#125EC9',
    borderRadius: 30,
    paddingHorizontal: 40,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  timeoutLabel: {
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginBottom: 0,
  },
  timeoutValue: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  timeoutIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0B2F6E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeoutIconChip: {
    width: 60,
    height: 60,
    borderRadius: 50,
    backgroundColor: '#125EC9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  previewCard: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 360,
    backgroundColor: '#E5E7EB',
  },
  previewClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  previewCloseText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  notifApproved: { color: '#065F46' },
  notifRejected: { color: '#B91C1C' },
});

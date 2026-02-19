import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, Pressable, LayoutAnimation, Platform, UIManager, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
import { getAttendanceHistory } from '../config/api';

export default function HistoryScreen({ navigation }) {
  const [month, setMonth] = useState(null); // { label, value: 'YYYY-MM' }
  const [showMonth, setShowMonth] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [personName, setPersonName] = useState('');

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const months = useMemo(() => {
    const now = new Date();
    const list = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      list.push({ label, value: `${yyyy}-${mm}` });
    }
    return list;
  }, []);

  useEffect(() => {
    if (!month && months.length) setMonth(months[0]);
  }, [month, months]);

  useEffect(() => {
    (async () => {
      try {
        const u = await AsyncStorage.getItem('user');
        const parsed = u ? JSON.parse(u) : null;
        setPersonName(parsed?.name ? String(parsed.name) : (parsed?.phone ? String(parsed.phone) : ''));
      } catch (e) {
        setPersonName('');
      }
    })();
  }, []);

  const loadHistory = async (monthValue) => {
    setLoading(true);
    try {
      const res = await getAttendanceHistory(monthValue);
      if (res?.success) {
        setHistory(res);
      } else {
        Alert.alert(res?.message || 'Failed to load history');
      }
    } catch (e) {
      Alert.alert('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (month?.value) loadHistory(month.value);
  }, [month?.value]);

  // color mapping for chips to match ss1 palette
  const tokenBgStyle = (label) => {
    const map = {
      // requested order background:
      // Present -> #D9EFFF, Absent -> #FFFFFF, HalfDay -> #FFFFFF, Leave -> #FFFFFF, Overtime -> #CFF6FF
      Present: '#D9EFFF',
      Absent: '#FFFFFF',
      'Half Day': '#FFFFFF',
      HalfDay: '#FFFFFF',
      Leave: '#FFFFFF',
      Overtime: '#CFF6FF',
      // fallback mappings
      Late: '#F2E8FF',
      Hours: '#E8F2FF',
    };
    const bg = map[label] || '#F3F4F6';
    return { backgroundColor: bg, borderWidth: 1, borderColor: '#E6EEFF' };
  };

  // progress bar data/colors
  const progressData = useMemo(() => {
    const s = history?.summary;
    if (!s) return [];
    return [
      { x: 'Present', y: Number(s.present || 0) },
      { x: 'Absent', y: Number(s.absent || 0) },
      { x: 'HalfDay', y: Number(s.halfDay || 0) },
      { x: 'Leave', y: Number(s.leave || 0) },
      { x: 'Overtime', y: Number(s.overtime || 0) },
    ];
  }, [history?.summary]);
  const progressColors = ['#0090F6', '#CA0000', '#999400', '#9500F8', '#007B80'];

  const workDays = useMemo(() => {
    const days = Array.isArray(history?.days) ? history.days : [];

    const toHM = (sec) => {
      const s = Math.max(0, Number(sec || 0));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const remainingSecs = s % 60;
      
      if (h === 0 && m === 0 && remainingSecs > 0) {
        return `${remainingSecs} sec`;
      }
      if (h === 0 && m > 0) {
        return remainingSecs > 0 ? `${m} min ${remainingSecs} sec` : `${m} min`;
      }
      if (h > 0) {
        return remainingSecs > 0 ? `${h} hr ${m} min ${remainingSecs} sec` : `${h} hr ${m} min`;
      }
      return `${h}:${String(m).padStart(2, '0')}`;
    };

    const labelForDate = (iso) => {
      const d = new Date(`${iso}T00:00:00`);
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    };

    return days
      .filter((d) => d.dayStatus !== 'NA')
      .slice()
      .reverse()
      .map((d) => {
        const tokens = [];
        if (d.dayStatus === 'PRESENT') tokens.push({ t: 'Present', v: toHM(d.workingSeconds) });
        if (d.dayStatus === 'OVERTIME') tokens.push({ t: 'Overtime', v: toHM(d.overtimeSeconds) });
        if (d.dayStatus === 'HALF_DAY') tokens.push({ t: 'Half Day', v: toHM(d.workingSeconds) });
        if (d.dayStatus === 'ABSENT') tokens.push({ t: 'Absent', v: '1' });
        if (d.dayStatus === 'LEAVE') tokens.push({ t: 'Leave', v: d.leaveType || 'Leave' });

        if (Number(d.breakSeconds || 0) > 0) tokens.push({ t: 'Break', v: toHM(d.breakSeconds) });

        return { date: labelForDate(d.date), tokens };
      });
  }, [history?.days]);

  const toggleExpanded = (date) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => ({ ...prev, [date]: !prev[date] }));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center',height:70 }]}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={styles.headerTitle}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Person and Month row */}
        <View style={styles.personCard}>
          <TouchableOpacity
            onPress={() => {
              const list = months;
              const i = list.findIndex((m) => m.value === month?.value);
              const next = list[(i - 1 + list.length) % list.length];
              setMonth(next);
            }}
            style={styles.monthArrow}
            activeOpacity={0.7}
          >
            <Image source={require('../assets/chevron-up.png')} style={{ width: 12, height: 12 }} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.personName}>{personName || ' '}</Text>
            <TouchableOpacity onPress={() => setShowMonth(true)} activeOpacity={0.8}>
              <Text style={styles.monthText}>{month?.label || ''}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              const list = months;
              const i = list.findIndex((m) => m.value === month?.value);
              const next = list[(i + 1) % list.length];
              setMonth(next);
            }}
            style={styles.monthArrow}
            activeOpacity={0.7}
          >
            <Image source={require('../assets/chevron-up (2).png')} style={{ width: 12, height: 12 }} />
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Present', value: String(history?.summary?.present ?? 0), bg: '#D9EFFF', cl: '#0090F6' },
            { label: 'Absent', value: String(history?.summary?.absent ?? 0), bg: '#FFE2E2', cl: '#CA0000' },
            { label: 'HalfDay', value: String(history?.summary?.halfDay ?? 0), bg: '#FFFDC4', cl: '#999400' },
            { label: 'Leave', value: String(history?.summary?.leave ?? 0), bg: '#EBDFFF', cl: '#9500F8' },
            { label: 'Overtime', value: String(history?.summary?.overtime ?? 0), bg: '#CFF6FF', cl: '#007B80' },
            { label: 'Fine', value: '0', bg: '#FFCDDB', cl: '#007B80' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg,color:s.cl }]}>
              <Text style={[styles.statLabel, {color:s.cl }]}>{s.label}</Text>
              <Text style={[styles.statValue, {color:s.cl }]}>{s.value}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {/* Activity analysis with progress bars */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity analysis</Text>
          <View style={styles.progressCard}>
            {progressData && progressData.length > 0 ? (
              <View style={styles.progressContainer}>
                {progressData.map((item, index) => {
                  const total = progressData.reduce((sum, i) => sum + i.y, 0);
                  const percentage = total > 0 ? (item.y / total) * 100 : 0;
                  return (
                    <View key={item.x} style={styles.progressItem}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>{item.x}</Text>
                        <Text style={styles.progressValue}>{item.y} days</Text>
                      </View>
                      <View style={styles.progressBarContainer}>
                        <View 
                          style={[
                            styles.progressBar, 
                            { 
                              backgroundColor: progressColors[index],
                              width: `${Math.max(percentage, 2)}%` // Minimum 2% width for visibility
                            }
                          ]} 
                        />
                      </View>
                      <Text style={styles.progressPercentage}>{percentage.toFixed(1)}%</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
                <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
                  {loading ? 'Loading...' : 'No attendance data available'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Work days list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily details</Text>
          {workDays.map((d) => {
            const isOpen = expanded[d.date];
            return (
              <View key={d.date} style={styles.workItem}>
                <TouchableOpacity
                  style={styles.workHeader}
                  onPress={() => toggleExpanded(d.date)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.workDate}>{d.date}</Text>
                  {/* <Image 
                    source={require('../assets/chevron-down.png')} 
                    style={[styles.chevron, { transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }]} 
                  /> */}
                </TouchableOpacity>
                {isOpen && d.tokens.length > 0 && (
                  <View style={styles.tokenRow}>
                    {d.tokens.map((t) => (
                      <View key={t.t} style={[styles.token, tokenBgStyle(t.t)]}>
                        <Text style={styles.tokenTitle}>{t.t}</Text>
                        <Text style={styles.tokenValue}>{t.v}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {isOpen && d.tokens.length === 0 && (
                  <View style={styles.tokenRow}>
                    <Text style={{ color: '#6B7280', fontFamily: 'Inter_400Regular' }}>No details</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Month select modal */}
      <Modal visible={showMonth} transparent animationType="fade" onRequestClose={() => setShowMonth(false)}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowMonth(false)} />
          <View style={styles.modalSheet}>
            {months.map((m) => (
              <TouchableOpacity key={m.value} style={styles.modalRow} onPress={() => { setMonth(m); setShowMonth(false); }}>
                <Text style={styles.modalText}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
      <BottomNav navigation={navigation} activeKey="history" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3',
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  backBtn: { paddingTop: 6, paddingBottom: 6 },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' },

  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },

  personCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12,
  },
  personName: { fontFamily: 'Inter_600SemiBold', color: '#1f2c3a', marginBottom: 6 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthSwitcher: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  monthArrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#F3F4F6' },
  monthCenter: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E6EEFF', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  monthText: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    width: '30%', minWidth: 90, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontFamily: 'Inter_700Bold', color: '#1f2c3a', marginBottom: 4,fontSize:16,marginTop:4 },
  statLabel: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 10 },

  section: { marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: ' Inter_500Medium', color: '#454545', marginBottom: 8,fontSize:13 },

  // Progress bar styles
  progressCard: { 
    padding: 16, 
    backgroundColor: '#fff', 
    marginTop: 8, 
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EEFF',
  },
  progressContainer: { gap: 16 },
  progressItem: { gap: 8 },
  progressHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  progressLabel: { 
    fontFamily: 'Inter_500Medium', 
    color: '#1f2c3a', 
    fontSize: 14 
  },
  progressValue: { 
    fontFamily: 'Inter_600SemiBold', 
    color: '#1f2c3a', 
    fontSize: 14 
  },
  progressBarContainer: { 
    height: 8, 
    backgroundColor: '#F3F4F6', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBar: { 
    height: '100%', 
    borderRadius: 4,
    minWidth: 2, // Ensure minimum visibility
  },
  progressPercentage: { 
    fontFamily: 'Inter_400Regular', 
    color: '#6B7280', 
    fontSize: 12,
    textAlign: 'right',
  },

  workItem: {
    borderWidth: 1, borderColor: '#E6EEFF', borderRadius: 10, backgroundColor: '#fff',
    marginBottom: 10, overflow: 'hidden'
  },
  workHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#F8FAFF' },
  workDate: { fontFamily: 'Inter_500Medium', color: '#1f2c3a' },
  chevron: { width: 16, height: 16, tintColor: '#6B7280' },
  tokenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  token: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  tokenTitle: { fontFamily: 'Inter_400Regular', color: '#6B7280', fontSize: 10 },
  tokenValue: { fontFamily: 'Inter_700Bold', color: '#1f2c3a',fontSize:16 },

  modalContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  modalSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingVertical: 10, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  modalRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E6EEFF' },
  modalText: { fontFamily: 'Inter_500Medium', color: '#1f2c3a' },
});

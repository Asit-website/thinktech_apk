import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import BottomNav from '../components/BottomNav';
import { getAttendanceHistory, getMe } from '../config/api';
import { notifyError } from '../utils/notify';

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

export default function CalendarScreen({ navigation }) {
  const [monthDate, setMonthDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [daysByDate, setDaysByDate] = useState({});
  const [selected, setSelected] = useState(null);
  const [staffStartMonth, setStaffStartMonth] = useState(null);

  const matrix = useMemo(() => getMonthMatrix(monthDate), [monthDate]);

  const monthKey = useMemo(() => {
    const y = monthDate.getFullYear();
    const m = String(monthDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [monthDate]);

  useEffect(() => {
    let mounted = true;
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

      setLoading(true);
      try {
        const res = await getAttendanceHistory(monthKey);
        if (!mounted) return;

        if (res?.success && Array.isArray(res?.days)) {
          const map = {};
          res.days.forEach((d) => {
            if (!d?.date) return;
            map[String(d.date)] = d;
          });
          setDaysByDate(map);
        } else {
          setDaysByDate({});
          notifyError(res?.message || 'Unable to load calendar.');
        }
      } catch (e) {
        if (!mounted) return;
        setDaysByDate({});
        notifyError('Unable to load calendar.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={{ width: 18 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={dec} style={styles.chevBtn}>
            <Image source={require('../assets/left.png')} style={{ width: 32, height: 32 }} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{headerLabel}</Text>
          <TouchableOpacity onPress={inc} style={styles.chevBtn}>
            <Image source={require('../assets/right.png')} style={{ width: 32, height: 32 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {week.map((d) => (
            <Text key={d} style={styles.weekCell}>{d}</Text>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 10 }}><ActivityIndicator /></View>
        ) : null}

        <View style={styles.grid}>
          {matrix.map((day, idx) => {
            const key = dateKeyForDay(day);
            const dot = key ? statusColor(key) : null;
            const bg = cellBg(key, day);
            const textColor = key ? dayTextColor(key) : '#1f2c3a';
            const active = selected?.date && key && String(selected.date) === String(key);
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
              </TouchableOpacity>
            );
          })}
        </View>

        {selected?.date ? (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{selected.date}</Text>
            <Text style={styles.detailSub}>Status: {String(selected.dayStatus || 'NA')}</Text>
            {selected.hasLateRule && selected.latePunchInMinutes > 0 ? (
              <Text style={[styles.detailSub, { color: '#CA0000', fontWeight: '600' }]}>Late by {selected.latePunchInMinutes} min</Text>
            ) : null}
            {selected.dayStatus === 'LEAVE' && selected.leaveType ? (
              <Text style={styles.detailSub}>Leave Type: {String(selected.leaveType)}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Legend */}
        <View style={[styles.legend, { flexWrap: 'wrap' }]}>
          <LegendItem color="#10C300" label="Present" />
          <LegendItem color="#D90000" label="Absent" />
          <LegendItem color="#8C2DFF" label="On leave" />
          <LegendItem color="#F3F300" label="Half day" />
          <LegendItem color="#6B7280" label="Holiday" />
        </View>
        <View style={[styles.legend, { marginTop: 8 }]}>
          <LegendItem color="#5BC0DE" label="Weekly Off" />
        </View>
      </View>

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
    paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30,
    marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold', marginLeft: 8 },

  container: { padding: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  chevBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'transparent' },
  monthLabel: { fontFamily: 'Inter_400Regular', color: '#616161', fontSize: 18 },

  weekRow: { flexDirection: 'row', marginBottom: 10, marginTop: 22 },
  weekCell: { flex: 1, textAlign: 'center', color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12 },

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
    borderColor: '#E6EEFF',
    marginVertical: 4
  },
  cellActive: { borderColor: '#125EC9', borderWidth: 2 },
  dayText: { color: '#1f2c3a', fontFamily: 'Inter_500Medium', fontSize: 12 },
  dot: { width: 6, height: 6, borderRadius: 6, position: 'absolute', bottom: 4 },

  detailCard: { marginTop: 14, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E6EEFF' },
  detailTitle: { color: '#111827', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  detailSub: { marginTop: 6, color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12 },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 8 },
  legendText: { color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12 },
});

import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
import { listMyLeaveRequests, getSalesSummary, getCurrentTarget } from '../config/api';

export default function SalesScreen({ navigation }) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifLeaves, setNotifLeaves] = React.useState([]); // APPROVED + REJECTED
  const [unseenCount, setUnseenCount] = React.useState(0);

  // Summary card state
  const [dateLabel, setDateLabel] = React.useState('');
  const [summary, setSummary] = React.useState({ totalAmount: 0, totalOrders: 0, conversionRate: 0, avgOrderValue: 0 });
  const [dailyTarget, setDailyTarget] = React.useState(0);

  // Notifications polling (approved/rejected leaves)
  React.useEffect(() => {
    let cancelled = false;

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
        setUnseenCount(items.length);
      } catch (e) { }
    };

    compute();
    const intv = setInterval(compute, 60000);
    return () => { cancelled = true; clearInterval(intv); };
  }, []);

  // INR formatter
  const fmtINR = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN')}`;

  // Load today's sales summary + target for the card
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
        if (!cancelled) setDateLabel(`${dd}-${mm}-${yyyy}   ${weekday}`);

        const iso = today.toISOString().slice(0, 10);
        const [s, t] = await Promise.all([
          getSalesSummary(iso),
          getCurrentTarget('daily'),
        ]);
        const sum = s?.summary || {};
        const tgt = t?.target || {};
        if (!cancelled) {
          setSummary({
            totalAmount: Number(sum.totalAmount || 0),
            totalOrders: Number(sum.totalOrders || 0),
            conversionRate: Number(sum.conversionRate || 0),
            avgOrderValue: Number(sum.avgOrderValue || 0),
          });
          setDailyTarget(Number(tgt.targetAmount || 0));
        }
      } catch (_) { }
    };
    load();
    const intv = setInterval(load, 60000);
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={styles.headerTitle}>Sales</Text>
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
                <Text style={styles.summaryCaption}>Total Sales Amount</Text>
              </View>
              <View style={styles.summaryRight}>
                <View style={styles.timerClusterRow}>
                  <View style={styles.timerCol}>
                    <View style={styles.timerPill}><Text style={styles.timerText}>{fmtINR(summary.totalAmount)}</Text></View>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.muted}>Total Orders</Text>
                <Text style={styles.value}>{`${summary.totalOrders} Orders`}</Text>
              </View>
              <View style={styles.col1}>
                <Text style={styles.muted}>Conversion Rate</Text>
                <Text style={styles.value}>{`${summary.conversionRate}%`}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.col2}>
                <Text style={styles.muted}>Avg Order Value</Text>
                <Text style={styles.value}>{fmtINR(summary.avgOrderValue)}</Text>
              </View>
              <View style={styles.col3}>
                <Text style={styles.muted}>{`Target: ${fmtINR(dailyTarget)}`}</Text>
                <Text style={styles.value1}>{`Remaining: ${fmtINR(Math.max(0, dailyTarget - summary.totalAmount))}`}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <QuickAction title="Visit Form" icon={require('../assets/visit1.png')} onPress={() => navigation.navigate('VisitForm')} />
          <QuickAction title="Order Form" icon={require('../assets/visit2.png')} onPress={() => navigation.navigate('OrderForm')} />
          <QuickAction title="Assigned Job" icon={require('../assets/visit3.png')} onPress={() => navigation.navigate('AssignedJobs')} />
          <QuickAction title="Targets" icon={require('../assets/visit4.png')} onPress={() => navigation.navigate('Targets')} />
          <QuickAction title="Expense" icon={require('../assets/currency-rupee.png')} onPress={() => navigation.navigate('Expense')} />
        </View>

        {/* spacer removed; bottom padding on ScrollView handles safe space */}
      </ScrollView>

      <BottomNav navigation={navigation} activeKey="sales" />

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

// styles unchanged from your file
const styles = StyleSheet.create({
  // ... keep your existing styles as-is
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30, marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  headerTitle: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  bellButton: { padding: 6, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, paddingHorizontal: 3, backgroundColor: '#EF4444', borderRadius: 8, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: 'Inter_600SemiBold' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 200 },

  summaryCard: {
    backgroundColor: '#F8FAFF', borderColor: '#2E6ADB', borderWidth: 1, borderRadius: 12, padding: 16,
    marginBottom: 16, shadowColor: '#000000', shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.25, shadowRadius: 10.7, elevation: 10, overflow: 'visible', position: 'relative', marginTop: 50,
  },
  dateHeader: {
    backgroundColor: '#184181', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'absolute',
    left: 0, right: 0, top: -15, zIndex: 2,
  },
  dateText: { color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  statsBox: { borderRadius: 12, marginTop: 10, paddingTop: 12, paddingBottom: 12 },
  summaryTop: {
    backgroundColor: '#F3F7FF', paddingVertical: 6, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottomColor: '#AAAAAA', borderBottomWidth: 1,
  },
  summaryRight: { marginLeft: 12, alignItems: 'flex-end', width: 90 },
  summaryCaption: { color: '#525252', fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 2 },

  row: { flexDirection: 'row' },
  col: { flex: 1, paddingVertical: 10, marginTop: 10, borderRightColor: '#AAAAAA', borderRightWidth: 1, borderBottomColor: '#AAAAAA', borderBottomWidth: 1, paddingHorizontal: 12 },
  col1: { flex: 1, paddingVertical: 10, marginTop: 10, borderBottomColor: '#AAAAAA', borderBottomWidth: 1, paddingHorizontal: 12 },
  col2: { flex: 1, paddingVertical: 10, borderRightColor: '#AAAAAA', borderRightWidth: 1, paddingHorizontal: 12 },
  col3: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },

  muted: { color: '#525252', fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 6 },
  value: { color: '#454545', fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  value1: { color: '#525252', fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  timerClusterRow: { flexDirection: 'row', width: 90, justifyContent: 'space-between', alignItems: 'flex-start' },
  timerCol: { width: 26, alignItems: 'center' },
  timerPill: { backgroundColor: '#223151', borderRadius: 6, width: 134, height: 41, paddingHorizontal: 0, paddingVertical: 0, alignItems: 'center', justifyContent: 'center' },
  timerText: { color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 40 },
  action: { width: '48%', borderWidth: 1, borderColor: '#125EC9', backgroundColor: '#F8FAFF', borderRadius: 12, paddingHorizontal: 14, paddingTop: 8, height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 0 },
  actionLeft: { alignItems: 'flex-start', justifyContent: 'center', flexDirection: 'column', gap: 4 },
  actionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: '#125EC9', fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 2 },

  // notifications slide-over
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
  notifApproved: { color: '#065F46' },
  notifRejected: { color: '#B91C1C' },
});
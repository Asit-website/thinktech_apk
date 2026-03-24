import React, { useState, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Image,
  ScrollView, ActivityIndicator, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listMyActivities, listMyMeetings, listMyTickets } from '../config/api';
import BottomNav from '../components/BottomNav';

export default function TodoListScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [tickets, setTickets] = useState([]);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [actRes, meetRes, tickRes] = await Promise.all([
        listMyActivities(),
        listMyMeetings(),
        listMyTickets()
      ]);
      const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

      if (actRes.success) {
        const monthActs = actRes.activities.filter(a => a.date && a.date.startsWith(currentMonth));
        setActivities(monthActs);
      }
      if (tickRes) {
        const monthTicks = tickRes.filter(t => (t.createdAt || t.created_at || '').startsWith(currentMonth));
        setTickets(monthTicks);
      }
      if (meetRes.success) {
        const monthMeets = meetRes.meetings.filter(m => (m.scheduledAt || '').startsWith(currentMonth));
        setMeetings(monthMeets);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };


  const renderStatusGrid = (data, type) => {
    const counts = {
      SCHEDULE: data.filter(a => a.status === 'SCHEDULE').length,
      IN_PROGRESS: data.filter(a => a.status === 'IN_PROGRESS').length,
      REVIEW: data.filter(a => a.status === 'REVIEW').length,
      DONE: data.filter(a => a.status === 'DONE').length,
    };

    const targetScreen = type === 'activity' ? 'Activity' : 'Ticket';

    return (
      <View style={styles.statusGrid}>
        <View style={styles.statusRow}>
          <StatusCard label="Scheduled" count={counts.SCHEDULE} color="#6366F1" icon="📅" status="SCHEDULE" screen={targetScreen} />
          <StatusCard label="In-Progress" count={counts.IN_PROGRESS} color="#F59E0B" icon="⚙️" status="IN_PROGRESS" screen={targetScreen} />
        </View>
        <View style={styles.statusRow}>
          <StatusCard label="In-Review" count={counts.REVIEW} color="#8B5CF6" icon="🔍" status="REVIEW" screen={targetScreen} />
          <StatusCard label="Completed" count={counts.DONE} color="#10B981" icon="✅" status="DONE" screen={targetScreen} />
        </View>
      </View>
    );
  };

  const StatusCard = ({ label, count, color, icon, status, screen }) => (
    <TouchableOpacity
      style={[styles.statusCard, { borderLeftColor: color }]}
      onPress={() => navigation.navigate(screen, { initialStatus: status })}
    >
      <Text style={styles.statusIcon}>{icon}</Text>
      <View>
        <Text style={styles.statusCount}>{count}</Text>
        <Text style={styles.statusLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMeetingStatusGrid = (data) => {
    const counts = {
      SCHEDULE: data.filter(m => (m.status || 'SCHEDULE') === 'SCHEDULE').length,
      IN_PROGRESS: data.filter(m => m.status === 'IN_PROGRESS').length,
      DONE: data.filter(m => m.status === 'DONE').length,
    };

    return (
      <View style={styles.statusGrid}>
        <View style={styles.statusRow}>
          <StatusCard label="Scheduled" count={counts.SCHEDULE} color="#6366F1" icon="📅" status="SCHEDULE" screen="Meeting" />
          <StatusCard label="In-Progress" count={counts.IN_PROGRESS} color="#F59E0B" icon="⚙️" status="IN_PROGRESS" screen="Meeting" />
        </View>
        <View style={styles.statusRow}>
          <StatusCard label="Completed" count={counts.DONE} color="#10B981" icon="✅" status="DONE" screen="Meeting" />
          <View style={{ flex: 1 }} />
        </View>
      </View>
    );
  };


  const getStatusColor = (status) => {
    switch (status) {
      case 'ACCEPTED': return '#059669';
      case 'DECLINED': return '#DC2626';
      default: return '#9CA3AF';
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.proHeader}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnPro}>
            <Image source={require('../assets/arrow.png')} style={styles.backIconPro} />
          </TouchableOpacity>
          <Text style={styles.headerDatePro}>
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <View style={styles.headerWelcome}>
          <Text style={styles.welcomeText}>Task Dashboard</Text>
          <Text style={styles.welcomeSub}>Manage your monthly activities</Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.dashContent}>
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color="#125EC9" style={{ marginTop: 40 }} />
          ) : (
            <>
              <View style={[styles.sectionPro, { marginTop: 24, marginBottom: 40 }]}>
                <Text style={styles.sectionTitlePro}>Quick Access</Text>
                <View style={styles.actionGrid}>
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => navigation.navigate('Activity')}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: '#EBF3FF' }]}>
                      <Image source={require('../assets/v2.png')} style={{ width: 22, height: 22, tintColor: '#125EC9' }} />
                    </View>
                    <Text style={styles.actionLabel}>Activities</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => navigation.navigate('Meeting')}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                      <Image source={require('../assets/cal.png')} style={{ width: 22, height: 22, tintColor: '#059669' }} />
                    </View>
                    <Text style={styles.actionLabel}>Meetings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => navigation.navigate('Ticket')}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                      <Image source={require('../assets/v2.png')} style={{ width: 22, height: 22, tintColor: '#D97706' }} />
                    </View>
                    <Text style={styles.actionLabel}>Tickets</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.sectionPro, { marginBottom: 16 }]}>
                <Text style={styles.sectionTitlePro}>Activities This Month</Text>
              </View>
              {renderStatusGrid(activities, 'activity')}

              <View style={[styles.sectionPro, { marginTop: 24, marginBottom: 16 }]}>
                <Text style={styles.sectionTitlePro}>Meetings This Month</Text>
              </View>
              {renderMeetingStatusGrid(meetings)}

              <View style={[styles.sectionPro, { marginTop: 24 }]}>
                <Text style={[styles.sectionTitlePro, { marginBottom: 16 }]}>Tickets Raised This Month</Text>
                {renderStatusGrid(tickets, 'ticket')}
              </View>


            </>
          )}
        </View>
      </ScrollView>
      <BottomNav navigation={navigation} activeKey="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  proHeader: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    boxShadow: 'rgba(0, 0, 0, 0.25) 0px 0px 6px'
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtnPro: { padding: 4 },
  backIconPro: { width: 22, height: 16, tintColor: '#111827' },
  headerDatePro: { color: '#6B7280', fontSize: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  headerWelcome: {},
  welcomeText: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#111827' },
  welcomeSub: { fontSize: 14, color: '#6B7280', marginTop: 4, fontFamily: 'Inter_500Medium' },

  container: { flex: 1 },
  dashContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },

  statusGrid: { marginBottom: 20 },
  statusRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statusCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  statusIcon: { fontSize: 20, marginRight: 12 },
  statusCount: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  statusLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_700Bold' },

  sectionPro: { marginTop: 10 },
  sectionTitlePro: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#111827' },
  sectionHeaderPro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  viewAllText: { fontSize: 14, color: '#125EC9', fontFamily: 'Inter_700Bold' },

  proMeetingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
  },
  mCardInfo: { flex: 1 },
  mTimeBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mTimeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#125EC9', marginRight: 10 },
  liveBadge: { backgroundColor: '#EBF3FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontFamily: 'Inter_600SemiBold' },
  liveText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#125EC9', textTransform: 'uppercase' },
  mCardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#1F2937', marginBottom: 14 },

  attendanceRow: { borderTopWidth: 1, borderTopColor: '#F9FAFB', paddingTop: 12, flexDirection: 'row', alignItems: 'center' },
  attLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_700Bold', marginRight: 10 },
  attAvatars: { flexDirection: 'row', alignItems: 'center' },
  attWrap: { position: 'relative', width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: -6, borderWidth: 2, borderColor: '#fff' },
  attDot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#fff' },
  attInitial: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#4B5563' },
  moreAtt: { marginLeft: 12, fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: '#9CA3AF' },

  actionGrid: { flexDirection: 'row', gap: 16 },
  actionItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionIcon: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#374151' },

  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});

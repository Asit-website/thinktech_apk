import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { listMyAssignedJobs } from '../config/api';

export default function AssignedJobsScreen() {
  const navigation = useNavigation();
  const [jobs, setJobs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await listMyAssignedJobs();
      const rows = Array.isArray(res?.jobs) ? res.jobs : [];
      const filtered = rows.filter((r) => {
        const c = r?.client;
        if (!c) return true;
        let ex = c.extra || {};
        if (typeof ex === 'string') {
          try { ex = JSON.parse(ex); } catch (_) { ex = {}; }
        }
        return ex.active !== false;
      });
      const mapped = filtered.map((r) => ({
        id: String(r.id),
        client: r.client?.name || 'Client',
        address: r.client?.location || '',
        tag: String(r.status || 'pending').toUpperCase(),
      }));
      setJobs(mapped);
    } catch {}
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30, marginLeft: 5, marginRight: 5, borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,marginBottom:25 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={{ fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' }}>Assigned job</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {jobs.map((job) => (
          <TouchableOpacity key={job.id} activeOpacity={0.8} style={{ marginBottom: 12 }} onPress={() => navigation.navigate('AssignedJobDetail', { jobId: job.id })}>
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 8, paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: '#eee',position:"relative" }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Image source={require('../assets/assigned2.png')} style={{ width: 10, height: 13.5 }} />
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#454545' }}>{job.client}</Text>
                </View>
                <Image source={require('../assets/assigned1.png')} style={{ width: 14, height: 14 }} tintColor="#bbb" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                {/* <Text style={{ fontSize: 14, color: '#666', marginRight: 6 }}>📍</Text> */}
                <Text style={{ fontSize: 11, color: '#454545',position:"absolute",top:13 }}>{job.address}</Text>
              </View>
              <View style={{ marginTop: 10, alignItems: 'flex-end' }}>
                {(() => {
                  const s = String(job.tag || '').toLowerCase();
                  const conf = s === 'complete'
                    ? { bg: '#DCFCE7', border: '#DCFCE7', color: '#166534' }
                    : s === 'inprogress'
                    ? { bg: '#E0ECFF', border: '#E0ECFF', color: '#1D4ED8' }
                    : { bg: '#FFF0C7', border: '#FFF0C7', color: '#987500' };
                  return (
                    <View style={{ backgroundColor: conf.bg, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: conf.border }}>
                      <Text style={{ fontSize: 8, color: conf.color, fontFamily: 'Inter_500Medium' }}>{job.tag}</Text>
                    </View>
                  );
                })()}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

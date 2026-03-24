import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getAssignedJobDetail, updateAssignedJobStatus } from '../config/api';
import { notifyError, notifyInfo, notifySuccess } from '../utils/notify';

// Same key used in Admin Geofence settings
const GOOGLE_MAPS_API_KEY = 'AIzaSyBukqAGI9NioKWUOgzVs0vXrBOg9DnbwLo';

export default function AssignedJobDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const jobId = route.params?.jobId ? String(route.params.jobId) : null;
  const [loading, setLoading] = React.useState(true);
  const [job, setJob] = React.useState(null);

  const load = React.useCallback(async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      const res = await getAssignedJobDetail(jobId);
      const j = res?.job || null;
      if (j) {
        setJob({
          id: j.id,
          client: j.client?.name || 'Client',
          address: j.clientAddress || j.client?.location || '',
          clientLat: j.clientLat,
          clientLng: j.clientLng,
          status: j.status || 'pending',
          assignedOn: j.assignedOn ? new Date(j.assignedOn).toDateString() : null,
          dueDate: j.dueDate ? new Date(j.dueDate).toDateString() : null,
          started: !!j.startedAt,
          ended: !!j.endedAt,
        });
      }
    } catch (e) {}
    finally { setLoading(false); }
  }, [jobId]);

  React.useEffect(() => { load(); }, [load]);

  const getStartLocation = React.useCallback(async () => {
    const once = () => new Promise((resolve) => {
      try {
        if (!navigator?.geolocation?.getCurrentPosition) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
          () => resolve({}),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      } catch (_) { resolve({}); }
    });
    const watch = () => new Promise((resolve) => {
      try {
        if (!navigator?.geolocation?.watchPosition) return resolve({});
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            navigator.geolocation.clearWatch(id);
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
          },
          () => {
            navigator.geolocation.clearWatch(id);
            resolve({});
          },
          { enableHighAccuracy: true, maximumAge: 0 }
        );
        // Safety timeout to stop watching after 15s
        setTimeout(() => {
          try { navigator.geolocation.clearWatch(id); } catch {}
          resolve({});
        }, 15000);
      } catch (_) { resolve({}); }
    });
    try {
      // If the Permissions API is available, guide the user when blocked
      try {
        if (navigator?.permissions?.query) {
          const p = await navigator.permissions.query({ name: 'geolocation' });
          if (p && p.state === 'denied') {
            notifyInfo('Location blocked. Click the lock icon > Site settings > Allow Location, then reload.');
            return {};
          }
        }
      } catch (_) {}
      let loc = await once();
      if (!(typeof loc.lat === 'number' && typeof loc.lng === 'number')) {
        // retry once after a short delay (permission prompt / GPS warmup)
        await new Promise(r => setTimeout(r, 1000));
        loc = await once();
      }
      if (!(typeof loc.lat === 'number' && typeof loc.lng === 'number')) {
        // final fallback: watch for a single reading (up to 15s)
        loc = await watch();
      }
      return loc;
    } catch (_) {
      return {};
    }
  }, []);

  const handleNavigate = () => {
    if (job?.clientLat && job?.clientLng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${job.clientLat},${job.clientLng}`;
      Linking.openURL(url).catch(() => notifyError('Could not open map'));
    } else if (job?.address) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`;
      Linking.openURL(url).catch(() => notifyError('Could not open map'));
    } else {
      notifyInfo('No address or coordinates available for navigation.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30, marginLeft: 5, marginRight: 5, borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6, marginBottom: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={{ fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' }}>Assigned job</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 160 }}>
        {loading || !job ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#125EC9" />
          </View>
        ) : (
        <>
        {/* Info notice */}
        <View style={{  padding: 12, marginBottom: 14 }}>
          <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12,lineHeight:20 }}>
           View and manage tasks asiigned to you by your manager. Complete pending tasks on time.
          </Text>
        </View>

        {/* Job card */}
        <View style={{ backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14 }}>
          {/* Header row: client + status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* <Image source={require('../assets/assigned2.png')} style={{ width: 10, height: 13.5 }} /> */}
              <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#454545' }}>{job.client}</Text>
            </View>
            {/* <View style={{ backgroundColor: '#FFF0C7', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: '#FFF0C7' }}>
              <Text style={{ fontSize: 10, color: '#987500', fontFamily: 'Inter_500Medium' }}>{job.tag}</Text>
            </View> */}
          </View>

          {/* Address + description */}
          <View style={{ marginTop: 8 }}>
            <TouchableOpacity onPress={handleNavigate} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={require('../assets/assigned2.png')} style={{ width: 10, height: 13.5 }} />
              <Text style={{ fontSize: 12, color: '#125EC9', fontFamily: 'Inter_500Medium', marginLeft: 6, textDecorationLine: 'underline' }}>{job.address}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
              Visit the client to discuss pricing, order confirmation, and collect feedback.
            </Text>
          </View>

          {/* Map Section */}
          {(job.clientLat && job.clientLng) || job.address ? (
            <TouchableOpacity
              onPress={handleNavigate}
              style={{
                marginTop: 16,
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: '#E5E7EB',
                height: 150,
                position: 'relative',
                borderWidth: 1,
                borderColor: '#D1D5DB'
              }}
            >
              <Image
                source={{
                  uri: job.clientLat && job.clientLng
                    ? `https://maps.googleapis.com/maps/api/staticmap?center=${job.clientLat},${job.clientLng}&zoom=15&size=600x300&markers=color:red%7C${job.clientLat},${job.clientLng}&key=${GOOGLE_MAPS_API_KEY}`
                    : `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(job.address)}&zoom=15&size=600x300&markers=color:red%7C${encodeURIComponent(job.address)}&key=${GOOGLE_MAPS_API_KEY}`
                }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <View style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4
              }}>
                <Image source={require('../assets/stoke.png')} style={{ width: 10, height: 10, tintColor: '#125EC9' }} />
                <Text style={{ fontSize: 10, color: '#125EC9', fontFamily: 'Inter_600SemiBold' }}>Open in Google Maps</Text>
              </View>
              {/* Overlay for better click feedback */}
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.02)' }} />
            </TouchableOpacity>
          ) : null}

          {/* Actions row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {(() => { const isPending = String(job.status || '').toLowerCase() === 'pending'; const hasEnded = !!job.ended; const isLocked = isPending || hasEnded; return [
              (
                <TouchableOpacity key="visit" onPress={() => {
                  if (isLocked) { notifyInfo(isPending ? 'Please start the job first.' : 'Please wait for admin verification.'); return; }
                  navigation.navigate('VisitForm', { fromJobId: job.id });
                }}>
                  <View style={{ backgroundColor: '#BFDAFF', borderColor: '#BFDAFF', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, opacity: isLocked ? 0.55 : 1 }}>
                    <Text style={{ color: '#125EC9', fontFamily: 'Inter_500Medium', fontSize: 8 }}>Client visit</Text>
                  </View>
                </TouchableOpacity>
              ),
              (
                <TouchableOpacity key="order" onPress={() => {
                  if (isLocked) { notifyInfo(isPending ? 'Please start the job first.' : 'Please wait for admin verification.'); return; }
                  navigation.navigate('OrderForm', { assignedJobId: job.id });
                }}>
                  <View style={{ backgroundColor: '#E0ECFF', borderColor: '#E0ECFF', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, opacity: isLocked ? 0.55 : 1 }}>
                    <Text style={{ color: '#1D4ED8', fontFamily: 'Inter_500Medium', fontSize: 8 }}>Client order</Text>
                  </View>
                </TouchableOpacity>
              ),
              (
                <TouchableOpacity key="navigate" onPress={handleNavigate}>
                  <View style={{ backgroundColor: '#F3F4F6', borderColor: '#E5E7EB', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                    <Text style={{ color: '#374151', fontFamily: 'Inter_500Medium', fontSize: 8 }}>Navigate</Text>
                  </View>
                </TouchableOpacity>
              )
            ]; })()}
            {String(job.status).toLowerCase() === 'pending' && !job.started && !job.ended ? (
              <TouchableOpacity onPress={async () => {
                try {
                  const loc = await getStartLocation();
                  if (!(typeof loc.lat === 'number' && typeof loc.lng === 'number')) {
                    notifyInfo('Starting without GPS. Enable location to store coordinates.');
                  }
                  await updateAssignedJobStatus(job.id, 'inprogress', {
                    startLat: typeof loc.lat === 'number' ? loc.lat : undefined,
                    startLng: typeof loc.lng === 'number' ? loc.lng : undefined,
                    startAccuracy: typeof loc.acc === 'number' ? loc.acc : undefined,
                  });
                  notifySuccess('Job started');
                  load();
                } catch (_) {
                  notifyError('Unable to start job');
                }
              }}>
                <View style={{ backgroundColor: '#FFD4D4', borderColor: '#FFD4D4', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                  <Text style={{ color: '#FF4747', fontFamily: 'Inter_600SemiBold', fontSize: 8 }}>Start job</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {String(job.status).toLowerCase() === 'inprogress' && !job.ended ? (
              <TouchableOpacity onPress={async () => {
                try {
                  const loc = await getStartLocation();
                  if (!(typeof loc.lat === 'number' && typeof loc.lng === 'number')) {
                    notifyInfo('Stopping without GPS. Enable location to store coordinates.');
                  }
                  await updateAssignedJobStatus(job.id, 'inprogress', {
                    endLat: typeof loc.lat === 'number' ? loc.lat : undefined,
                    endLng: typeof loc.lng === 'number' ? loc.lng : undefined,
                    endAccuracy: typeof loc.acc === 'number' ? loc.acc : undefined,
                    stopJob: true,
                  });
                  notifySuccess('Job stopped');
                  load();
                } catch (_) {
                  notifyError('Unable to stop job');
                }
              }}>
                <View style={{ backgroundColor: '#DCFCE7', borderColor: '#DCFCE7', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                  <Text style={{ color: '#166534', fontFamily: 'Inter_600SemiBold', fontSize: 8 }}>Stop job</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Helper to prompt enabling location access */}
          {(() => {
            const s = String(job.status || '').toLowerCase();
            if ((s === 'pending' || s === 'inprogress') && !job.ended) {
              return (
                <TouchableOpacity onPress={async () => { await getStartLocation(); }} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 10, color: '#6B7280', textDecorationLine: 'underline' }}>Enable location access</Text>
                </TouchableOpacity>
              );
            }
            return null;
          })()}

          {/* Assigned on / Due date side by side with borders */}
          <View style={{ flexDirection: 'row', marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#71717A',paddingVertical:12 }}>
            {/* Assigned on column */}
            <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, borderRightWidth: 1, borderColor: '#71717A' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={require('../assets/calendar3.png')} style={{ width: 14, height: 14 }} />
                <Text style={{ color: '#1F2937', fontFamily: 'Inter_500Medium', fontSize: 12 }}>Assigned on</Text>
              </View>
              <Text style={{ marginTop: 6, color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>
                {job.assignedOn || '—'}
              </Text>
            </View>
            {/* Due date column */}
            <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={require('../assets/celis.png')} style={{ width: 14, height: 14 }} />
                <Text style={{ color: '#1F2937', fontFamily: 'Inter_500Medium', fontSize: 12 }}>Due date</Text>
              </View>
              <Text style={{ marginTop: 6, color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>
                {job.dueDate || '—'}
              </Text>
            </View>
          </View>

          {/* Status chip for current status only */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {(() => {
              const s = String(job.status || '').toLowerCase();
              const conf = s === 'complete'
                ? { bg: '#DCFCE7', border: '#DCFCE7', color: '#166534', label: 'Complete' }
                : s === 'inprogress'
                ? { bg: '#E0ECFF', border: '#E0ECFF', color: '#1D4ED8', label: 'In progress' }
                : { bg: '#FFF0C7', border: '#FFF0C7', color: '#987500', label: 'Pending' };
              return (
                <View style={{ backgroundColor: conf.bg, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: conf.border }}>
                  <Text style={{ fontSize: 10, color: conf.color, fontFamily: 'Inter_500Medium' }}>{conf.label}</Text>
                </View>
              );
            })()}
          </View>
        </View>
        </>
        )}
      </ScrollView>
    </View>
  );
}

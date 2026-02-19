import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, Alert, ActivityIndicator, Platform, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import BottomNav from '../components/BottomNav';
import { getMyProfile, updateMyProfile, uploadMyProfilePhoto, listMyLeaveRequests } from '../config/api';
import { notifyError, notifyInfo, notifySuccess } from '../utils/notify';

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLeaves, setNotifLeaves] = useState([]); // APPROVED + REJECTED
  const [unseenCount, setUnseenCount] = useState(0);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');

  const photoUrl = useMemo(() => {
    const p = profile?.photoUrl;
    if (!p) return null;
    if (String(p).startsWith('http')) return String(p);
    const base = __DEV__ ? 'http://localhost:4000' : 'https://backend.vetansutra.com';
    return `${base}${p}`;
  }, [profile?.photoUrl]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyProfile();
      if (res?.success) {
        setProfile(res.profile);
        setName(res.profile?.name || '');
        setEmail(res.profile?.email || '');
        setDesignation(res.profile?.designation || '');
        setDepartment(res.profile?.department || '');

        // keep local user cache in sync for other screens
        const current = await AsyncStorage.getItem('user');
        const parsed = current ? JSON.parse(current) : {};
        await AsyncStorage.setItem('user', JSON.stringify({ ...parsed, name: res.profile?.name || null, phone: res.profile?.phone || parsed?.phone, role: res.profile?.role || parsed?.role }));
      } else {
        notifyError(res?.message || 'Unable to load profile.');
      }
    } catch (e) {
      notifyError('Unable to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Notifications polling and badge count (approved + rejected total)
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
        // Show total count of approved + rejected items on badge
        setUnseenCount(items.length);
      } catch (e) { }
    };
    compute();
    const intv = setInterval(compute, 60000);
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
      // Keep badge showing total count; do not clear on open
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

  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        notifyInfo('Camera permission is required to upload a photo.');
        return null;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (result.canceled) return null;
      return result.assets?.[0]?.uri || null;
    } catch (e) {
      notifyError('Unable to pick image. Please try again.');
      return null;
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await updateMyProfile({ name, email, designation, department });
      if (res?.success) {
        setEditing(false);
        await load();
        notifySuccess('Profile updated successfully.');
      } else {
        notifyError(res?.message || 'Unable to update profile.');
      }
    } catch (e) {
      notifyError('Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity activeOpacity={0.7} style={styles.bellButton} onPress={openNotifications}>
          <Image source={require('../assets/bell (2).png')} style={{ width: 18, height: 18 }} />
          {unseenCount > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : String(unseenCount)}</Text></View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Profile Card */}
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.8} style={styles.editBtn} onPress={() => setEditing((v) => !v)}>
            <Image source={require('../assets/pencil-square.png')} style={{ width: 16, height: 16 }} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={async () => {
              const uri = await pickPhoto();
              if (!uri) return;
              setSaving(true);
              try {
                const res = await uploadMyProfilePhoto(uri);
                if (res?.success) {
                  await load();
                  notifySuccess('Profile photo updated successfully.');
                } else {
                  notifyError(res?.message || 'Unable to upload photo.');
                }
              } catch (e) {
                notifyError('Unable to upload photo.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }} />
            ) : (
              <Image source={require('../assets/tab5.png')} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }} />
            )}
          </TouchableOpacity>

          {loading ? <ActivityIndicator /> : null}

          {editing ? (
            <View style={{ width: '92%' }}>
              <Text style={styles.muted}>Name</Text>
              <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Name" />
              <View style={{ height: 10 }} />
              <Text style={styles.muted}>Designation</Text>
              <TextInput value={designation} onChangeText={setDesignation} style={styles.input} placeholder="Designation" />
              <View style={{ height: 10 }} />
              <Text style={styles.muted}>Department</Text>
              <TextInput value={department} onChangeText={setDepartment} style={styles.input} placeholder="Department" />
            </View>
          ) : (
            <>
              <Text style={styles.name}>{profile?.name || ''}</Text>
              <Text style={styles.role}>{profile?.designation || ''}</Text>
            </>
          )}

          {/* <View style={[styles.divider, { width: '92%' }]} /> */}
          <View style={[styles.infoRow, { width: '92%', marginTop: '30px' }]}>
            <View>
              <Text style={styles.muted}>Phone number</Text>
              <Text style={styles.value}>{profile?.phone || ''}</Text>
            </View>
          </View>
          <View style={[styles.divider, { width: '92%' }]} />
          <View style={[styles.infoRow, { width: '92%' }]}>
            <View style={{ width: '100%' }}>
              <Text style={styles.muted}>Email</Text>
              {editing ? (
                <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="Email" />
              ) : (
                <Text style={styles.value}>{profile?.email || ''}</Text>
              )}
            </View>
          </View>

          {editing ? (
            <View style={{ width: '92%', marginTop: 14, alignItems: 'flex-end' }}>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#125EC9' }]} onPress={onSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.smallBtnText, { color: '#fff' }]}>Save</Text>}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* List Section */}
        <View style={styles.list}>
          <TouchableOpacity style={styles.listItem} activeOpacity={0.8} onPress={() => navigation.navigate('MyDocuments')}>
            <Text style={styles.listText}>My Document</Text>
            <Image source={require('../assets/pie.png')} style={{ width: 12, height: 12 }} />
          </TouchableOpacity>
          <View style={styles.listDivider} />
          <TouchableOpacity style={styles.listItem} activeOpacity={0.8} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.listText}>Settings</Text>
            <Image source={require('../assets/pie.png')} style={{ width: 12, height: 12 }} />
          </TouchableOpacity>
          <View style={styles.listDivider} />
          <TouchableOpacity style={styles.listItem} activeOpacity={0.8} onPress={onLogout}>
            <Text style={[styles.listText, { color: '#FF4747' }]}>Log out</Text>
            <Image source={require('../assets/pie.png')} style={{ width: 12, height: 12 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomNav navigation={navigation} activeKey="Profile" />

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30,
    marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  headerTitle: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  bellButton: { padding: 6, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, paddingHorizontal: 3, backgroundColor: '#EF4444', borderRadius: 8, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: 'Inter_600SemiBold' },

  card: {
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#E6EEFF',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  editBtn: { position: 'absolute', top: 10, right: 10, padding: 6, borderRadius: 8 },
  avatarWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DEDEDE' },
  name: { color: '#454545', fontFamily: 'Inter_500Medium', fontSize: 16 },
  role: { color: '#616161', fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },

  infoBox: { backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 16, padding: 16, borderWidth: 1, borderColor: '#E6EEFF' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 0.5, backgroundColor: '#E3E3E3', marginVertical: 12 },
  muted: { color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 14 },
  value: { color: '#616161', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },

  // Notifications slide-over
  notifBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.25)' },
  notifPanel: { width: '78%', maxWidth: 360, backgroundColor: '#fff', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, alignSelf: 'stretch', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 12 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  notifTitle: { fontSize: 16, color: '#111827', fontFamily: 'Inter_600SemiBold' },
  notifClose: { fontSize: 18, color: '#6B7280' },
  notifEmpty: { color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 12 },
  notifItem: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: '#F9FAFB' },
  notifItemTitle: { fontFamily: 'Inter_600SemiBold', color: '#111827', marginBottom: 6 },
  notifApproved: { color: '#065F46' },
  notifRejected: { color: '#B91C1C' },
  notifItemText: { fontFamily: 'Inter_500Medium', color: '#374151' },
  notifItemMeta: { fontFamily: 'Inter_400Regular', color: '#6B7280', marginTop: 6, fontSize: 12 },

  input: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E6EEFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#1f2c3a',
    marginTop: 6,
    width: '100%',
  },

  smallBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  smallBtnText: { fontFamily: 'Inter_600SemiBold' },

  list: { backgroundColor: '#F3F4F6', borderRadius: 12, marginTop: 16 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  listText: { color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 14 },
  listDivider: { height: 1, backgroundColor: '#E3E3E3' },
});

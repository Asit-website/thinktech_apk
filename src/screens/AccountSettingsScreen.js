import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyProfile, updateMyProfile } from '../config/api';
import { notifyError, notifySuccess } from '../utils/notify';

export default function AccountSettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staffId, setStaffId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyProfile();
      if (res?.success) {
        setStaffId(res?.profile?.staffId ? String(res.profile.staffId) : '');
        setPhone(res?.profile?.phone ? String(res.profile.phone) : '');
        setEmail(res?.profile?.email ? String(res.profile.email) : '');
      } else {
        notifyError(res?.message || 'Unable to load account settings.');
      }
    } catch (e) {
      notifyError('Unable to load account settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await updateMyProfile({ email });
      if (res?.success) {
        notifySuccess('Account settings saved successfully.');
        await load();
      } else {
        notifyError(res?.message || 'Unable to save account settings.');
      }
    } catch (e) {
      notifyError('Unable to save account settings.');
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        {loading ? (
          <View style={{ paddingVertical: 24 }}><ActivityIndicator /></View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Staff ID (Read only)</Text>
          <TextInput value={staffId} editable={false} style={[styles.input, styles.inputDisabled]} placeholder="-" />

          <Text style={styles.label}>Mobile Number (Read only)</Text>
          <TextInput value={phone} editable={false} style={[styles.input, styles.inputDisabled]} placeholder="-" />

          <Text style={styles.label}>Email (Editable)</Text>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="Enter email" keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity style={[styles.footerBtn, styles.saveBtn]} activeOpacity={0.9} onPress={onSave} disabled={saving || loading}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.footerBtn, styles.logoutBtn]} activeOpacity={0.9} onPress={onLogout} disabled={saving || loading}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 110 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12 },

  label: { marginTop: 10, marginBottom: 6, color: '#374151', fontFamily: 'Inter_500Medium', fontSize: 12 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
    color: '#111827',
  },
  inputDisabled: { backgroundColor: '#F9FAFB', color: '#6B7280' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#ffffff',
  },
  footerRow: { flexDirection: 'row', gap: 12 },
  footerBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },

  saveBtn: { backgroundColor: '#125EC9' },
  saveText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  logoutBtn: { backgroundColor: '#FF4747' },
  logoutText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
});

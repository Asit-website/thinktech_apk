import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { getMyBankDetails, updateMyBankDetails } from '../config/api';
import { notifyError, notifySuccess } from '../utils/notify';

export default function BankDetailsScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [upiId, setUpiId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyBankDetails();
      if (res?.success) {
        const b = res?.bank || {};
        setBankAccountHolderName(b.bankAccountHolderName || '');
        setBankAccountNumber(b.bankAccountNumber || '');
        setBankIfsc(b.bankIfsc || '');
        setBankName(b.bankName || '');
        setBankBranch(b.bankBranch || '');
        setUpiId(b.upiId || '');
      } else {
        notifyError(res?.message || 'Unable to load bank details.');
      }
    } catch (e) {
      notifyError('Unable to load bank details.');
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
      const res = await updateMyBankDetails({
        bankAccountHolderName,
        bankAccountNumber,
        bankIfsc,
        bankName,
        bankBranch,
        upiId,
      });

      if (res?.success) {
        notifySuccess('Bank details saved successfully.');
      } else {
        notifyError(res?.message || 'Unable to save bank details.');
      }
    } catch (e) {
      notifyError('Unable to save bank details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank Details</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        {loading ? (
          <View style={{ paddingVertical: 24 }}><ActivityIndicator /></View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Account Holder Name</Text>
          <TextInput value={bankAccountHolderName} onChangeText={setBankAccountHolderName} style={styles.input} placeholder="" />

          <Text style={styles.label}>Account Number</Text>
          <TextInput value={bankAccountNumber} onChangeText={setBankAccountNumber} style={styles.input} placeholder="" keyboardType="number-pad" />

          <Text style={styles.label}>IFSC</Text>
          <TextInput value={bankIfsc} onChangeText={(t) => setBankIfsc(t?.toUpperCase?.() || t)} style={styles.input} placeholder="" autoCapitalize="characters" />

          <Text style={styles.label}>Bank Name</Text>
          <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholder="" />

          <Text style={styles.label}>Branch</Text>
          <TextInput value={bankBranch} onChangeText={setBankBranch} style={styles.input} placeholder="" />

          <Text style={styles.label}>UPI ID</Text>
          <TextInput value={upiId} onChangeText={setUpiId} style={styles.input} placeholder="" autoCapitalize="none" />
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} activeOpacity={0.9} onPress={onSave} disabled={saving || loading}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
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
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12,position:"relative"},

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

  saveBtn: { marginTop: 16, backgroundColor: '#125EC9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#ffffff',
  },
});

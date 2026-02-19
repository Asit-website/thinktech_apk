import React from 'react';

import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, Platform, Modal, Pressable, ActivityIndicator } from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import { sendClientOtp, submitVisitForm, getMyProfile, getAssignedJobDetail, listMyAssignedJobs } from '../config/api';

import { useRoute } from '@react-navigation/native';

import { notifySuccess, notifyError, notifyInfo } from '../utils/notify';

import DateTimePicker from '@react-native-community/datetimepicker';



export default function VisitFormScreen({ navigation }) {

  const route = useRoute();

  const [visitDate, setVisitDate] = React.useState(null);

  const [showDate, setShowDate] = React.useState(false);

  const [salesPerson, setSalesPerson] = React.useState('');

  const [visitType, setVisitType] = React.useState('Follow-up');

  const [clientName, setClientName] = React.useState('');

  const [phone, setPhone] = React.useState('');

  const [clientType, setClientType] = React.useState('Retailer');

  const [location, setLocation] = React.useState('');

  const [attachments, setAttachments] = React.useState([]);

  const [clientOtp, setClientOtp] = React.useState('');

  const [clientSignature, setClientSignature] = React.useState(null); // { uri, name, type }

  const [submitting, setSubmitting] = React.useState(false);
  const [sendingOtp, setSendingOtp] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);



  // Client picker state

  const assignedJobId = route.params?.fromJobId ? Number(route.params.fromJobId) : null;

  const [clientId, setClientId] = React.useState(null);

  const [clientPickerVisible, setClientPickerVisible] = React.useState(false);

  const [clientOptions, setClientOptions] = React.useState([]); // [{id,name,phone,clientType,location}]

  const [loadingClients, setLoadingClients] = React.useState(false);



  const [selectKey, setSelectKey] = React.useState(null); // 'visitType' | 'clientType'

  const visitTypeOptions = ['Follow-up', 'New Visit', 'Complaint', 'Demo'];

  const clientTypeOptions = ['Retailer', 'Distributor', 'Wholesaler'];



  const onChangeDate = (_e, d) => {

    if (Platform.OS !== 'ios') setShowDate(false);

    if (d) setVisitDate(d);

  };



  const captureSignatureFromCamera = async () => {

    if (Platform.OS !== 'web') {

      const perm = await ImagePicker.requestCameraPermissionsAsync();

      if (!perm.granted) return;

    }

    let res;

    try {

      res = await ImagePicker.launchCameraAsync({ quality: 0.7 });

    } catch (e) {

      return;

    }

    if (res?.canceled) return;

    const asset = res.assets?.[0];

    if (asset?.uri) setClientSignature({ uri: asset.uri, name: asset.fileName || 'signature.jpg', type: asset.type || 'image/jpeg' });

  };



  const pickSignatureFromLibrary = async () => {

    let res;

    try {

      res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: false });

    } catch (e) {

      return;

    }

    if (res?.canceled) return;

    const asset = res.assets?.[0];

    if (asset?.uri) setClientSignature({ uri: asset.uri, name: asset.fileName || 'signature.jpg', type: asset.type || 'image/jpeg' });

  };



  const handleSendOtp = async () => {
    if (!phone || phone.trim().length < 10) {
      notifyError('Please enter a valid phone number');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await sendClientOtp(phone);
      if (res?.success) {
        setOtpSent(true);
        notifySuccess(`OTP sent to ${phone}${res?.otp ? ` (OTP: ${res.otp})` : ''}`);
      } else {
        notifyError(res?.message || 'Failed to send OTP');
      }
    } catch (e) {
      console.error('Send OTP error:', e);
      notifyError('Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  // Auto-fill sales person name from logged-in profile

  React.useEffect(() => {

    let mounted = true;

    (async () => {

      try {

        const res = await getMyProfile();

        const name = res?.profile?.name || res?.profile?.fullName || null;

        if (mounted && name) setSalesPerson(name);

        if (mounted && !visitDate) setVisitDate(new Date());

      } catch (e) {

        // ignore

      }

    })();

    return () => { mounted = false; };

  }, []);



  // Prefill from an assigned job if navigated with fromJobId

  React.useEffect(() => {

    let active = true;

    const jobId = route?.params?.fromJobId;

    if (!jobId) return () => { active = false; };

    (async () => {

      try {

        const res = await getAssignedJobDetail(jobId);

        const job = res?.job;

        const c = job?.client;

        if (active && c) {

          setClientId(c.id || null);

          if (c.name) setClientName(c.name);

          if (c.phone) setPhone(c.phone);

          if (c.clientType) setClientType(c.clientType);

          if (c.location) setLocation(c.location);

        }

      } catch (_) { }

    })();

    return () => { active = false; };

  }, [route?.params?.fromJobId]);



  // Client picker functions

  const openClientPicker = async () => {

    if (assignedJobId) return; // client fixed via job

    try {

      setLoadingClients(true);

      setClientPickerVisible(true);

      const res = await listMyAssignedJobs();

      const rows = Array.isArray(res?.jobs) ? res.jobs : [];

      const opts = rows.map((r) => ({

        id: r.client?.id || null,

        name: r.client?.name || 'Client',

        phone: r.client?.phone || '',

        clientType: r.client?.clientType || '',

        location: r.client?.location || '',

      })).filter((c) => c.id);

      setClientOptions(opts);

    } catch (_) { }

    finally { setLoadingClients(false); }

  };



  const onSelectClient = (c) => {

    setClientId(c.id);

    setClientName(c.name || '');

    setPhone(c.phone || '');

    setClientType(c.clientType || 'Retailer');

    setLocation(c.location || '');

    setClientPickerVisible(false);

  };



  const addAttachmentFromCamera = async () => {

    if (Platform.OS !== 'web') {

      const perm = await ImagePicker.requestCameraPermissionsAsync();

      if (!perm.granted) return;

    }

    let res;

    try {

      res = await ImagePicker.launchCameraAsync({ quality: 0.7 });

    } catch (e) {

      return;

    }

    if (res?.canceled) return;

    const asset = res.assets?.[0];

    if (asset?.uri) setAttachments((prev) => [...prev, { uri: asset.uri, name: asset.fileName || 'photo.jpg', type: asset.type || 'image/jpeg' }]);

  };



  const addAttachmentFromLibrary = async () => {

    let res;

    try {

      res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: false });

    } catch (e) {

      return;

    }

    if (res?.canceled) return;

    const asset = res.assets?.[0];

    if (asset?.uri) setAttachments((prev) => [...prev, { uri: asset.uri, name: asset.fileName || 'image.jpg', type: asset.type || 'image/jpeg' }]);

  };



  const removeAttachment = (idx) => {

    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  };



  const onSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);

    try {

      let loc = { lat: undefined, lng: undefined };

      const getGeo = () => new Promise((resolve) => {

        const nav = typeof navigator !== 'undefined' ? navigator : null;

        if (!nav || !nav.geolocation) return resolve(loc);

        const opts = { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 };

        try {

          nav.geolocation.getCurrentPosition(

            (pos) => {

              const crd = pos && pos.coords ? pos.coords : {};

              if (typeof crd.latitude === 'number' && typeof crd.longitude === 'number') {

                resolve({ lat: crd.latitude, lng: crd.longitude });

              } else { resolve(loc); }

            },

            () => resolve(loc),

            opts,

          );

        } catch (_) { resolve(loc); }

      });



      const geo = await getGeo();

      // Validation
      if (!visitDate) {
        notifyError('Please select visit date and time');
        setSubmitting(false);
        return;
      }
      if (!salesPerson.trim()) {
        notifyError('Please enter sales person name');
        setSubmitting(false);
        return;
      }
      if (!clientName.trim()) {
        notifyError('Please enter client name');
        setSubmitting(false);
        return;
      }
      if (!phone.trim()) {
        notifyError('Please enter phone number');
        setSubmitting(false);
        return;
      }
      if (!location.trim()) {
        notifyError('Please enter location');
        setSubmitting(false);
        return;
      }

      // Require OTP verification if phone number is provided (not for assigned jobs)
      if (!assignedJobId && phone && phone.trim().length >= 10) {
        if (!otpSent) {
          notifyError('Please send OTP to the client first');
          setSubmitting(false);
          return;
        }
        if (!clientOtp || clientOtp.trim().length < 4) {
          notifyError('Please enter the OTP sent to client');
          setSubmitting(false);
          return;
        }
      }

      const res = await submitVisitForm({

        visitDate,

        salesPerson,

        visitType,

        clientName,

        phone,

        clientType,

        location,

        attachments,

        clientOtp: clientOtp || undefined,

        clientSignature,

        assignedJobId: route?.params?.fromJobId,

        checkInLat: typeof geo.lat === 'number' ? geo.lat : undefined,

        checkInLng: typeof geo.lng === 'number' ? geo.lng : undefined,

      });

      if (res?.success) {

        setAttachments([]);

        setClientOtp('');

        setClientSignature(null);

        notifySuccess('Visit submitted successfully.');

        setTimeout(() => navigation.goBack(), 800);

      }

    } catch (e) {

      notifyError(e?.response?.data?.message || 'Failed to submit visit.');

    } finally {

      setSubmitting(false);

    }

  };



  const fmt = (d) => {

    if (!d) return 'Select date & time';

    const dd = String(d.getDate()).padStart(2, '0');

    const mm = String(d.getMonth() + 1).padStart(2, '0');

    const yy = String(d.getFullYear()).slice(-2);

    let h = d.getHours();

    const m = String(d.getMinutes()).padStart(2, '0');

    const ampm = h >= 12 ? 'PM' : 'AM';

    h = h % 12; h = h || 12;

    return `${dd} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}, ${yy} ${h}:${m} ${ampm}`;

  };



  return (

    <SafeAreaView style={styles.screen}>

      <View style={styles.header}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>

          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />

        </TouchableOpacity>

        <Text style={styles.headerTitle}>Visit Form</Text>

        <View style={{ width: 18 }} />

      </View>



      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Visit Details */}

        <Text style={styles.sectionTitle}>Visit Details</Text>

        <View style={styles.card}>

          <FormRow label="Visit Date and Time">

            {Platform.OS === 'web' ? (

              <TouchableOpacity onPress={() => setShowDate(true)} style={[styles.inputBoxRow, { justifyContent: 'space-between' }]}>

                <Text style={styles.inputText}>{fmt(visitDate)}</Text>

                <Image source={require('../assets/calendar2-range.png')} style={{ width: 16, height: 16 }} />

              </TouchableOpacity>

            ) : (

              <TouchableOpacity onPress={() => setShowDate(true)} style={[styles.inputBoxRow, { justifyContent: 'space-between' }]}>

                <Text style={styles.inputText}>{fmt(visitDate)}</Text>

                <Image source={require('../assets/calendar2-range.png')} style={{ width: 16, height: 16 }} />

              </TouchableOpacity>

            )}

          </FormRow>

          {showDate && Platform.OS !== 'web' && (

            <DateTimePicker value={visitDate || new Date()} mode="datetime" display="default" onChange={onChangeDate} />

          )}

          <FormRow label="Sales Person">

            <TextInput value={salesPerson} onChangeText={setSalesPerson} style={styles.textInput} placeholder="Enter name" placeholderTextColor="#9CA3AF" />

          </FormRow>

          <FormRow label="Visit Type">

            <TouchableOpacity style={styles.inputBoxRow} onPress={() => setSelectKey('visitType')}>

              <Text style={styles.inputText}>{visitType}</Text>

              <Image source={require('../assets/down.png')} style={{ width: 10, height: 10 }} />

            </TouchableOpacity>

          </FormRow>

        </View>



        {/* Divider between sections */}

        <View style={styles.sectionDivider} />

        {/* Client Information */}

        <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Client Information</Text>

        <View style={styles.card}>

          <FormRow label="Client Name">

            <View style={styles.inputBoxRow}>

              <TextInput

                value={clientName}

                onChangeText={setClientName}

                style={[styles.textInput, { flex: 1 }]}

                placeholder="Enter client name"

                placeholderTextColor="#9CA3AF"

                editable={!assignedJobId}

              />

              {!assignedJobId ? (

                <TouchableOpacity onPress={openClientPicker} style={styles.pickButton}>

                  <Text style={styles.pickButtonText}>Pick</Text>

                </TouchableOpacity>

              ) : null}

            </View>

          </FormRow>

          <FormRow label="Phone Number">

            <View style={styles.phoneInputRow}>

              <TextInput

                value={phone}

                onChangeText={setPhone}

                keyboardType="phone-pad"

                style={[styles.textInput, styles.phoneInput]}

                placeholder="Enter phone"

                placeholderTextColor="#9CA3AF"

                editable={!assignedJobId}

              />

              <TouchableOpacity
                style={[styles.sendOtpButton, sendingOtp && styles.sendOtpButtonDisabled]}
                onPress={handleSendOtp}
                disabled={sendingOtp || !phone || phone.trim().length < 10}
              >
                {sendingOtp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendOtpButtonText}>
                    {otpSent ? 'Resend OTP' : 'Send OTP'}
                  </Text>
                )}
              </TouchableOpacity>

            </View>

          </FormRow>

          <FormRow label="Client Type">

            <TouchableOpacity style={styles.inputBoxRow} onPress={() => setSelectKey('clientType')}>

              <Text style={styles.inputText}>{clientType}</Text>

              <Image source={require('../assets/down.png')} style={{ width: 10, height: 10 }} />

            </TouchableOpacity>

          </FormRow>

          <FormRow label="Location">

            <TextInput value={location} onChangeText={setLocation} style={styles.textInput} placeholder="Enter location" placeholderTextColor="#9CA3AF" />

          </FormRow>

        </View>



        {/* Attachments - Commented out */}
        {/*
        <View style={styles.sectionDivider} />

        <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Attachments</Text>

        <View style={styles.card}>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>

            <TouchableOpacity onPress={addAttachmentFromCamera} style={[styles.inputBox, { alignItems: 'center', justifyContent: 'center' }]}>

              <Text style={styles.inputText}>Capture Photo</Text>

            </TouchableOpacity>

            <TouchableOpacity onPress={addAttachmentFromLibrary} style={[styles.inputBox, { alignItems: 'center', justifyContent: 'center' }]}>

              <Text style={styles.inputText}>Choose from Files</Text>

            </TouchableOpacity>

          </View>

          {attachments.length > 0 ? (

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>

              <View style={{ flexDirection: 'row', gap: 10 }}>

                {attachments.map((a, idx) => (

                  <View key={String(idx)} style={{ width: 80 }}>

                    <Image source={{ uri: a.uri }} style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#E5E7EB' }} />

                    <TouchableOpacity onPress={() => removeAttachment(idx)} style={{ marginTop: 6, alignItems: 'center' }}>

                      <Text style={{ color: '#F24E43', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Remove</Text>

                    </TouchableOpacity>

                  </View>

                ))}

              </View>

            </ScrollView>

          ) : null}

        </View>
        */}



        {/* Client Verification */}

        <View style={styles.sectionDivider} />

        <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Client Verification</Text>

        <View style={styles.card}>

          <FormRow label="Client OTP (Optional)">

            <TextInput value={clientOtp} onChangeText={setClientOtp} keyboardType="number-pad" style={styles.textInput} placeholder="Enter OTP" placeholderTextColor="#9CA3AF" />

          </FormRow>

          <FormRow label="Client Signature (Photo)">

            {clientSignature ? (

              <View style={{ gap: 8 }}>

                <Image source={{ uri: clientSignature.uri }} style={{ width: 160, height: 80, borderRadius: 8, backgroundColor: '#E5E7EB' }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>

                  <TouchableOpacity onPress={() => setClientSignature(null)} style={[styles.inputBox, { alignItems: 'center' }]}>

                    <Text style={styles.inputText}>Remove</Text>

                  </TouchableOpacity>

                  <TouchableOpacity onPress={pickSignatureFromLibrary} style={[styles.inputBox, { alignItems: 'center' }]}>

                    <Text style={styles.inputText}>Replace</Text>

                  </TouchableOpacity>

                </View>

              </View>

            ) : (

              <View style={{ flexDirection: 'row', gap: 10 }}>

                <TouchableOpacity onPress={captureSignatureFromCamera} style={[styles.inputBox, { alignItems: 'center', justifyContent: 'center' }]}>

                  <Text style={styles.inputText}>Capture Signature</Text>

                </TouchableOpacity>

                <TouchableOpacity onPress={pickSignatureFromLibrary} style={[styles.inputBox, { alignItems: 'center', justifyContent: 'center' }]}>

                  <Text style={styles.inputText}>Upload File</Text>

                </TouchableOpacity>

              </View>

            )}

          </FormRow>

        </View>



        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>

          <TouchableOpacity onPress={() => !submitting && navigation.goBack()} disabled={submitting} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: "#125EC9" }}>

            <Text style={{ color: '#125EC9', fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>

          </TouchableOpacity>

          <TouchableOpacity onPress={onSubmit} disabled={submitting} style={{ flex: 1, backgroundColor: '#0059D7', borderRadius: 8, paddingVertical: 10, alignItems: 'center', opacity: submitting ? 0.8 : 1 }}>

            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Save Visit</Text>}

          </TouchableOpacity>

        </View>

      </ScrollView>



      {/* Web fallback date modal */}

      {showDate && Platform.OS === 'web' && (

        <Modal transparent animationType="fade" visible={showDate} onRequestClose={() => setShowDate(false)}>

          <Pressable style={styles.modalBackdrop} onPress={() => setShowDate(false)}>

            <View style={styles.modalCard}>

              <Text style={styles.modalTitle}>Select date & time</Text>

              <DateTimePicker value={visitDate || new Date()} mode="datetime" display="default" onChange={onChangeDate} />

              <TouchableOpacity onPress={() => setShowDate(false)} style={styles.modalBtn}>

                <Text style={styles.modalBtnText}>Done</Text>

              </TouchableOpacity>

            </View>

          </Pressable>

        </Modal>

      )}



      {/* Select modal */}

      {!!selectKey && (

        <Modal transparent animationType="fade" visible onRequestClose={() => setSelectKey(null)}>

          <Pressable style={styles.modalBackdrop} onPress={() => setSelectKey(null)}>

            <View style={styles.modalCard}>

              <Text style={styles.modalTitle}>{selectKey === 'visitType' ? 'Visit Type' : 'Client Type'}</Text>

              {(selectKey === 'visitType' ? visitTypeOptions : clientTypeOptions).map((opt) => (

                <TouchableOpacity key={opt} style={styles.optionRow} onPress={() => {

                  if (selectKey === 'visitType') setVisitType(opt); else setClientType(opt);

                  setSelectKey(null);

                }}>

                  <Text style={styles.optionText}>{opt}</Text>

                </TouchableOpacity>

              ))}

            </View>

          </Pressable>

        </Modal>

      )}



      {/* Client Picker Modal */}

      {clientPickerVisible ? (

        <Modal transparent animationType="fade" visible onRequestClose={() => setClientPickerVisible(false)}>

          <Pressable style={styles.modalBackdrop} onPress={() => setClientPickerVisible(false)}>

            <Pressable style={styles.clientPickerModal} onPress={(e) => e.stopPropagation()}>

              <View style={styles.modalHeader}>

                <Text style={styles.modalTitle}>Select Client</Text>

                <TouchableOpacity onPress={() => setClientPickerVisible(false)}>

                  <Text style={styles.modalClose}>✕</Text>

                </TouchableOpacity>

              </View>

              <View style={styles.clientListContainer}>

                {loadingClients ? (

                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>

                    <ActivityIndicator color="#125EC9" />

                  </View>

                ) : (

                  clientOptions.map((c) => (

                    <TouchableOpacity

                      key={String(c.id)}

                      onPress={() => onSelectClient(c)}

                      style={styles.clientOptionRow}

                    >

                      <Text style={styles.clientName}>{c.name}</Text>

                      {!!c.phone && <Text style={styles.clientPhone}>{c.phone}</Text>}

                    </TouchableOpacity>

                  ))

                )}

              </View>

            </Pressable>

          </Pressable>

        </Modal>

      ) : null}

    </SafeAreaView>

  );

}



function FormRow({ label, children }) {

  return (

    <View style={{ marginBottom: 12 }}>

      <Text style={styles.label}>{label}</Text>

      {children}

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



  sectionTitle: { color: '#454545', fontFamily: 'Inter_500Medium', marginBottom: 8, fontSize: 14 },

  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12 },

  sectionDivider: { height: 1, backgroundColor: '#E6EEFF', marginVertical: 12 },

  label: { color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },

  inputBox: { backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: '#E6EEFF', paddingVertical: 13, paddingHorizontal: 12 },

  inputBoxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', borderRadius: 6, borderWidth: 1, borderColor: '#E6EEFF', paddingVertical: 13, paddingHorizontal: 12 },

  textInput: { backgroundColor: '#F3F4F6', borderRadius: 6, borderWidth: 1, borderColor: '#E6EEFF', paddingVertical: 13, paddingHorizontal: 12, color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 },

  inputText: { color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12, backgroundColor: "#F3F4F6" },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },

  modalCard: { width: '100%', maxWidth: 320, backgroundColor: '#fff', borderRadius: 12, padding: 16 },

  modalTitle: { color: '#454545', fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 12 },

  modalBtn: { marginTop: 12, backgroundColor: '#125EC9', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },

  modalBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  optionRow: { paddingVertical: 10 },

  optionText: { color: '#454545', fontFamily: 'Inter_500Medium' },

  // Client picker styles

  pickButton: { marginLeft: 8, backgroundColor: '#E0ECFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },

  pickButtonText: { color: '#1D4ED8', fontFamily: 'Inter_500Medium', fontSize: 11 },

  modalHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#454545', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  modalClose: { color: '#6B7280', fontSize: 18 },

  clientPickerModal: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },

  clientListContainer: { maxHeight: 360, padding: 12 },

  clientOptionRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },

  clientName: { color: '#111827', fontFamily: 'Inter_500Medium' },

  clientPhone: { color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12 },

  // Phone input with OTP button styles
  phoneInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  phoneInput: { flex: 1 },

  sendOtpButton: {
    backgroundColor: '#125EC9',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },

  sendOtpButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },

  sendOtpButtonText: {
    color: '#fff',
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    fontWeight: '500',
  },

});


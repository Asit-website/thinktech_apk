import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, ActivityIndicator, Platform, Modal, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getMyGeneralInfo, updateMyGeneralInfo } from '../config/api';
import { notifyError, notifySuccess } from '../utils/notify';

export default function GeneralInfoScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // SS2 fields (editable)
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [dobDate, setDobDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dojDate, setDojDate] = useState(null);
  const [showDojPicker, setShowDojPicker] = useState(false);
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [nationality, setNationality] = useState('');

  const [personalMobile, setPersonalMobile] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');

  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');

  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeType, setEmployeeType] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [reportingManager, setReportingManager] = useState('');
  const [shiftTiming, setShiftTiming] = useState('');

  const [selectKey, setSelectKey] = useState(null); // 'gender' | 'maritalStatus'

  const genderOptions = ['Male', 'Female', 'Other'];
  const maritalStatusOptions = ['Married', 'Unmarried'];

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyGeneralInfo();
      if (res?.success) {
        const g = res?.general || {};
        setFullName(g.fullName || '');
        setDob(g.dob || '');
        setGender(g.gender || '');
        setMaritalStatus(g.maritalStatus || '');
        setBloodGroup(g.bloodGroup || '');
        setNationality(g.nationality || '');

        setPersonalMobile(g.personalMobile || '');
        setEmergencyContactName(g.emergencyContactName || '');
        setEmergencyContactNumber(g.emergencyContactNumber || '');

        setCurrentAddress(g.currentAddress || '');
        setPermanentAddress(g.permanentAddress || '');

        setDesignation(g.designation || '');
        setDepartment(g.department || '');
        setEmployeeType(g.employeeType || '');
        setDateOfJoining(g.dateOfJoining || '');
        setWorkLocation(g.workLocation || '');
        setReportingManager(g.reportingManager || '');
        setShiftTiming(g.shiftTiming || '');
      } else {
        notifyError(res?.message || 'Unable to load general info.');
      }
    } catch (e) {
      notifyError('Unable to load general info.');
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
      const res = await updateMyGeneralInfo({
        fullName,
        dob,
        gender,
        maritalStatus,
        bloodGroup,
        nationality,
        personalMobile,
        emergencyContactName,
        emergencyContactNumber,
        currentAddress,
        permanentAddress,
        designation,
        department,
        employeeType,
        dateOfJoining,
        workLocation,
        reportingManager,
        shiftTiming,
      });

      if (res?.success) {
        notifySuccess('General info saved successfully.');
      } else {
        notifyError(res?.message || 'Unable to save general info.');
      }
    } catch (e) {
      notifyError('Unable to save general info.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const onChangeDob = (_e, d) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (d) {
      setDobDate(d);
      setDob(formatDate(d));
    }
  };

  const onChangeDoj = (_e, d) => {
    if (Platform.OS !== 'ios') setShowDojPicker(false);
    if (d) {
      setDojDate(d);
      setDateOfJoining(formatDate(d));
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>General Info</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={{ paddingVertical: 24 }}><ActivityIndicator /></View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.section}>Personal Details</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="" />

          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, styles.inputRow]}>
            <Text style={styles.inputText}>{dob || 'Select date'}</Text>
            <Image source={require('../assets/calendar2-range.png')} style={{ width: 16, height: 16 }} />
          </TouchableOpacity>

          {showDatePicker && Platform.OS !== 'web' && (
            <DateTimePicker value={dobDate || new Date()} mode="date" display="default" onChange={onChangeDob} />
          )}

          <Text style={styles.label}>Gender</Text>
          <TouchableOpacity onPress={() => setSelectKey('gender')} style={[styles.input, styles.inputRow]}>
            <Text style={styles.inputText}>{gender || 'Select gender'}</Text>
            <Image source={require('../assets/down.png')} style={{ width: 10, height: 10 }} />
          </TouchableOpacity>

          <Text style={styles.label}>Marital Status</Text>
          <TouchableOpacity onPress={() => setSelectKey('maritalStatus')} style={[styles.input, styles.inputRow]}>
            <Text style={styles.inputText}>{maritalStatus || 'Select status'}</Text>
            <Image source={require('../assets/down.png')} style={{ width: 10, height: 10 }} />
          </TouchableOpacity>

          <Text style={styles.label}>Blood Group</Text>
          <TextInput value={bloodGroup} onChangeText={setBloodGroup} style={styles.input} placeholder="" />

          <Text style={styles.label}>Nationality</Text>
          <TextInput value={nationality} onChangeText={setNationality} style={styles.input} placeholder="" />

          <Text style={styles.section}>Contact Details</Text>

          <Text style={styles.label}>Personal Mobile Number</Text>
          <TextInput value={personalMobile} onChangeText={setPersonalMobile} style={styles.input} placeholder="" keyboardType="number-pad" />

          <Text style={styles.label}>Emergency Contact Name</Text>
          <TextInput value={emergencyContactName} onChangeText={setEmergencyContactName} style={styles.input} placeholder="" />

          <Text style={styles.label}>Emergency Contact Number</Text>
          <TextInput value={emergencyContactNumber} onChangeText={setEmergencyContactNumber} style={styles.input} placeholder="" keyboardType="number-pad" />

          <Text style={styles.label}>Current Address</Text>
          <TextInput value={currentAddress} onChangeText={setCurrentAddress} style={[styles.input, styles.multiline]} placeholder="" multiline />

          <Text style={styles.label}>Permanent Address</Text>
          <TextInput value={permanentAddress} onChangeText={setPermanentAddress} style={[styles.input, styles.multiline]} placeholder="" multiline />

          <Text style={styles.section}>Employment Details</Text>

          <Text style={styles.label}>Designation</Text>
          <TextInput value={designation} onChangeText={setDesignation} style={styles.input} placeholder="" />

          <Text style={styles.label}>Department</Text>
          <TextInput value={department} onChangeText={setDepartment} style={styles.input} placeholder="" />

          <Text style={styles.label}>Employee Type</Text>
          <TextInput value={employeeType} onChangeText={setEmployeeType} style={styles.input} placeholder="" />

          <Text style={styles.label}>Date of Joining</Text>
          <TouchableOpacity onPress={() => setShowDojPicker(true)} style={[styles.input, styles.inputRow]}>
            <Text style={styles.inputText}>{dateOfJoining || 'Select date'}</Text>
            <Image source={require('../assets/calendar2-range.png')} style={{ width: 16, height: 16 }} />
          </TouchableOpacity>

          {showDojPicker && Platform.OS !== 'web' && (
            <DateTimePicker value={dojDate || new Date()} mode="date" display="default" onChange={onChangeDoj} />
          )}

          <Text style={styles.label}>Work Location</Text>
          <TextInput value={workLocation} onChangeText={setWorkLocation} style={styles.input} placeholder="" />

          <Text style={styles.label}>Reporting Manager</Text>
          <TextInput value={reportingManager} onChangeText={setReportingManager} style={styles.input} placeholder="" />

          <Text style={styles.label}>Shift Timing</Text>
          <TextInput value={shiftTiming} onChangeText={setShiftTiming} style={styles.input} placeholder="" />

          <TouchableOpacity style={styles.saveBtn} activeOpacity={0.9} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Picker Modal */}
      <Modal visible={!!selectKey} transparent animationType="fade" onRequestClose={() => setSelectKey(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectKey(null)}>
          <View style={styles.modalContent}>
            {selectKey === 'gender' && genderOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.modalOption}
                onPress={() => {
                  setGender(opt);
                  setSelectKey(null);
                }}
              >
                <Text style={styles.modalOptionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
            {selectKey === 'maritalStatus' && maritalStatusOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.modalOption}
                onPress={() => {
                  setMaritalStatus(opt);
                  setSelectKey(null);
                }}
              >
                <Text style={styles.modalOptionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
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

  content: { padding: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12 },

  section: { marginTop: 8, marginBottom: 8, color: '#0F3B8C', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  label: { marginTop: 10, marginBottom: 6, color: '#374151', fontFamily: 'Inter_500Medium', fontSize: 12 },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
    color: '#111827',
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputText: { color: '#111827', fontFamily: 'Inter_400Regular', flex: 1 },

  saveBtn: { marginTop: 16, backgroundColor: '#125EC9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 8, minWidth: 200, maxWidth: 300 },
  modalOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  modalOptionText: { color: '#111827', fontFamily: 'Inter_500Medium', fontSize: 14 },
});

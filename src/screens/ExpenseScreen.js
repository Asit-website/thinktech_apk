import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Platform, Alert, ActivityIndicator, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { submitExpense } from '../config/api';
import { notifySuccess, notifyError } from '../utils/notify';

export default function ExpenseScreen() {
  const navigation = useNavigation();
  const webFileInputRef = React.useRef(null);
  const [expenseType, setExpenseType] = useState('Travel');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [amount, setAmount] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onPickImageFromCamera = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Camera permission is needed to take a photo.'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setAttachment({ uri: asset.uri, name: asset.fileName || 'photo.jpg', type: asset.mimeType || 'image/jpeg' });
      }
    } catch (e) { Alert.alert('Error', 'Unable to open camera'); }
  }, []);

  const onPickImageFromLibrary = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Media library permission is needed.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setAttachment({ uri: asset.uri, name: asset.fileName || 'image.jpg', type: asset.mimeType || 'image/jpeg' });
      }
    } catch (e) { Alert.alert('Error', 'Unable to open gallery'); }
  }, []);

  const onPickDocument = useCallback(async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (res.type === 'success') setAttachment({ uri: res.uri, name: res.name, type: res.mimeType || 'application/octet-stream' });
    } catch (e) { Alert.alert('Error', 'Unable to open file picker'); }
  }, []);

  const onUploadAttachment = useCallback(() => {
    if (Platform.OS === 'web') {
      try { webFileInputRef.current && webFileInputRef.current.click(); } catch (e) {}
      return;
    }
    if (Platform.OS === 'ios') {
      const ActionSheetIOS = require('react-native').ActionSheetIOS;
      ActionSheetIOS.showActionSheetWithOptions({ options: ['Cancel', 'Camera', 'Photo Library', 'Choose File'], cancelButtonIndex: 0 }, (idx) => {
        if (idx === 1) onPickImageFromCamera(); else if (idx === 2) onPickImageFromLibrary(); else if (idx === 3) onPickDocument();
      });
      return;
    }
    Alert.alert('Upload attachment', 'Select a source', [
      { text: 'Camera', onPress: onPickImageFromCamera },
      { text: 'Photo Library', onPress: onPickImageFromLibrary },
      { text: 'Choose File', onPress: onPickDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [onPickDocument, onPickImageFromCamera, onPickImageFromLibrary]);

  const onWebFileChange = (e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    const uri = URL.createObjectURL(f);
    setAttachment({ uri, name: f.name, type: f.type || 'application/octet-stream' });
    try { e.target.value = null; } catch (_) {}
  };

  const onSubmit = async () => {
    if (!amount) return notifyError('Enter amount');
    try {
      setSubmitting(true);
      const payload = { expenseType, expenseDate, amount: Number(amount), billNumber, description, attachment };
      const res = await submitExpense(payload);
      if (res?.success) {
        notifySuccess('Expense submitted');
        navigation.goBack();
      } else notifyError(res?.message || 'Failed to submit expense');
    } catch (e) { notifyError('Failed to submit expense'); }
    finally { setSubmitting(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30, marginLeft: 5, marginRight: 5, borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={{ fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' }}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 }}>
        <Text style={{ color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20, marginBottom: 12 }}>Submit your expense for admin verification.</Text>

        <View style={{ backgroundColor: '#fff', padding: 12, marginBottom: 12 }}>
          <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 6 }}>Expense Type</Text>
          <TouchableOpacity onPress={() => setShowTypePicker(true)} style={{ backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#E6EEFF', paddingVertical: 12, paddingHorizontal: 12 }}>
            <Text style={{ color: '#374151' }}>{expenseType || 'Select type'}</Text>
          </TouchableOpacity>

          <Modal visible={showTypePicker} transparent animationType="fade" onRequestClose={() => setShowTypePicker(false)}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={() => setShowTypePicker(false)}>
              <View style={{ position: 'absolute', left: 20, right: 20, top: '30%', backgroundColor: '#fff', borderRadius: 8, padding: 12 }}>
                {['Travel','Food','Office Supplies','Fuel','Accommodation','Communication','Other'].map((opt) => (
                  <TouchableOpacity key={opt} onPress={() => { setExpenseType(opt); setShowTypePicker(false); }} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                    <Text style={{ color: opt === expenseType ? '#125EC9' : '#374151', fontFamily: opt === expenseType ? 'Inter_700Bold' : 'Inter_400Regular' }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 12 }}>Expense Date</Text>
          <TouchableOpacity onPress={() => {
            if (Platform.OS === 'android' && DateTimePickerAndroid && DateTimePickerAndroid.open) {
              DateTimePickerAndroid.open({
                value: expenseDate || new Date(),
                onChange: (_e, val) => { if (val) setExpenseDate(val); },
                mode: 'date',
                is24Hour: true,
              });
            } else {
              setShowDate(true);
            }
          }} style={{ backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginTop: 6 }}>
            <Text style={{ color: '#374151' }}>{expenseDate ? (new Date(expenseDate)).toDateString() : 'Select date'}</Text>
          </TouchableOpacity>
          {showDate && (
            <DateTimePicker value={expenseDate || new Date()} mode="date" display="calendar" onChange={(_e, val) => { setShowDate(Platform.OS === 'ios'); if (val) setExpenseDate(val); }} />
          )}

          <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 12 }}>Amount (₹)</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Enter amount" style={{ backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginTop: 6 }} />

          <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 12 }}>Bill / Invoice Number</Text>
          <TextInput value={billNumber} onChangeText={setBillNumber} placeholder="Bill number" style={{ backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginTop: 6 }} />

          <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 12 }}>Attachment</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <TouchableOpacity onPress={onUploadAttachment} style={{ backgroundColor: '#125ec9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
              <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{attachment ? 'Replace File' : 'Upload File'}</Text>
            </TouchableOpacity>
            {attachment ? <Text style={{ marginLeft: 12 }}>{attachment.name}</Text> : null}
          </View>

          <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 12 }}>Description</Text>
          <TextInput value={description} onChangeText={setDescription} placeholder="Describe the expense..." multiline style={{ backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginTop: 6, minHeight: 80 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 }}>
              <Text style={{ color: '#374151', fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSubmit} disabled={submitting} style={{ flex: 1, backgroundColor: '#125EC9', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginLeft: 8 }}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Submit Expense</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      {Platform.OS === 'web' ? (
        <input
          ref={webFileInputRef}
          type="file"
          accept="image/*,application/pdf,application/*,text/*"
          style={{ display: 'none' }}
          onChange={onWebFileChange}
        />
      ) : null}
    </View>
  );
}

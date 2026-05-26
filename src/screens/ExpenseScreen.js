import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Platform, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, RefreshControl, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { submitExpense, getMyExpenses } from '../config/api';
import { notifySuccess, notifyError } from '../utils/notify';

export default function ExpenseScreen() {
  const navigation = useNavigation();
  const webFileInputRef = React.useRef(null);

  // View state: 'list' or 'add'
  const [view, setView] = useState('list');

  // List states
  const [claims, setClaims] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Form states
  const [expenseType, setExpenseType] = useState('Travel');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [amount, setAmount] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchClaims = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await getMyExpenses();
      if (res?.success && Array.isArray(res.claims)) {
        setClaims(res.claims);
      }
    } catch (e) {
      console.error('Failed to load expenses:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const resetForm = () => {
    setExpenseType('Travel');
    setExpenseDate(new Date());
    setAmount('');
    setBillNumber('');
    setDescription('');
    setAttachment(null);
  };

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
        notifySuccess('Expense claim submitted');
        resetForm();
        fetchClaims();
        setView('list');
      } else notifyError(res?.message || 'Failed to submit expense');
    } catch (e) { notifyError('Failed to submit expense'); }
    finally { setSubmitting(false); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  const statusBgColor = (status) => {
    if (status === 'approved') return '#E8F5E9';
    if (status === 'rejected') return '#FFEBEE';
    if (status === 'settled') return '#E0F2FE';
    return '#FFF3E0';
  };

  const statusTextColor = (status) => {
    if (status === 'approved') return '#2E7D32';
    if (status === 'rejected') return '#C62828';
    if (status === 'settled') return '#0369A1';
    return '#E65100';
  };

  const filteredClaims = claims.filter(c => (c.status || 'pending').toLowerCase() === activeTab);

  const itemsPerPage = 3;
  const totalPages = Math.ceil(filteredClaims.length / itemsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedClaims = filteredClaims.slice(startIndex, startIndex + itemsPerPage);

  if (view === 'list') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30, marginLeft: 5, marginRight: 5, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 4 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
            <Text style={{ fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' }}>My Expenses</Text>
          </TouchableOpacity>
        </View>

        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          {['pending', 'approved', 'rejected', 'settled'].map((tab) => {
            const isActive = activeTab === tab;
            const count = claims.filter(c => (c.status || 'pending').toLowerCase() === tab).length;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? '#125EC9' : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{
                    fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_500Medium',
                    fontSize: 13,
                    color: isActive ? '#125EC9' : '#6B7280',
                    textTransform: 'capitalize'
                  }}>
                    {tab}
                  </Text>
                  <View style={{
                    marginLeft: 6,
                    backgroundColor: isActive ? '#EFF6FF' : '#F3F4F6',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}>
                    <Text style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 10,
                      color: isActive ? '#1D4ED8' : '#6B7280',
                    }}>
                      {count}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content List */}
        {loading && !refreshing ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#125EC9" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchClaims(true)} colors={['#125EC9']} />}
          >
            {filteredClaims.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80 }}>
                <Text style={{ fontSize: 15, fontFamily: 'Inter_500Medium', color: '#9CA3AF' }}>No {activeTab} expenses found</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#D1D5DB', marginTop: 4 }}>Pull down to refresh</Text>
              </View>
            ) : (
              <>
                {paginatedClaims.map((item) => (
                  <View key={item.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <Image source={require('../assets/currency-rupee.png')} style={{ width: 18, height: 18, tintColor: '#125EC9' }} />
                        </View>
                        <View>
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#1F2937' }}>{item.expenseType || 'Other'}</Text>
                          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6B7280', marginTop: 2 }}>{new Date(item.expenseDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: '#1F2937' }}>₹{item.amount}</Text>
                    </View>
                    {item.description ? (
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#4B5563', marginTop: 10, lineHeight: 18 }}>{item.description}</Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                          {item.billNumber ? (
                            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', marginRight: 12 }}>Bill No: {item.billNumber}</Text>
                          ) : null}
                          {item.attachmentUrl ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, marginRight: 2 }}>📎</Text>
                              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#125EC9' }}>Attachment</Text>
                            </View>
                          ) : null}
                        </View>
                        
                        {item.status === 'approved' && (
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#6B7280', marginTop: 4 }}>
                            Approved on: {formatDate(item.approvedAt || item.updatedAt)}
                          </Text>
                        )}
                        {item.status === 'rejected' && (
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#6B7280', marginTop: 4 }}>
                            Rejected on: {formatDate(item.updatedAt)}
                          </Text>
                        )}
                        {item.status === 'settled' && (
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#6B7280', marginTop: 4 }}>
                            Settled on: {formatDate(item.settledAt || item.updatedAt)}
                          </Text>
                        )}
                      </View>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: statusBgColor(item.status) }}>
                        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: statusTextColor(item.status), textTransform: 'capitalize' }}>{item.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16, marginBottom: 20 }}>
                    <TouchableOpacity
                      disabled={safeCurrentPage === 1}
                      onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: safeCurrentPage === 1 ? '#F3F4F6' : '#E5E7EB',
                        backgroundColor: safeCurrentPage === 1 ? '#F9FAFB' : '#FFFFFF',
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: safeCurrentPage === 1 ? '#D1D5DB' : '#374151' }}>
                        &lt; Prev
                      </Text>
                    </TouchableOpacity>

                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      const isActive = safeCurrentPage === pageNum;
                      return (
                        <TouchableOpacity
                          key={pageNum}
                          onPress={() => setCurrentPage(pageNum)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: isActive ? '#125EC9' : '#FFFFFF',
                            borderWidth: isActive ? 0 : 1,
                            borderColor: '#E5E7EB',
                            marginHorizontal: 4,
                          }}
                        >
                          <Text style={{
                            fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_500Medium',
                            fontSize: 13,
                            color: isActive ? '#FFFFFF' : '#374151'
                          }}>
                            {pageNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      disabled={safeCurrentPage === totalPages}
                      onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: safeCurrentPage === totalPages ? '#F3F4F6' : '#E5E7EB',
                        backgroundColor: safeCurrentPage === totalPages ? '#F9FAFB' : '#FFFFFF',
                        marginLeft: 8,
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: safeCurrentPage === totalPages ? '#D1D5DB' : '#374151' }}>
                        Next &gt;
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* Floating Add Button */}
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setView('add');
          }}
          style={{ position: 'absolute', right: 20, bottom: 20, backgroundColor: '#125EC9', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 20, marginRight: 6, fontWeight: 'bold' }}>+</Text>
          <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>New Claim</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // view === 'add'
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30, marginLeft: 5, marginRight: 5, borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 }}>
        <TouchableOpacity onPress={() => setView('list')} style={{ paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={{ fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' }}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
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
              <TouchableOpacity onPress={() => setView('list')} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 }}>
                <Text style={{ color: '#374151', fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onSubmit} disabled={submitting} style={{ flex: 1, backgroundColor: '#125EC9', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginLeft: 8 }}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Submit Expense</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

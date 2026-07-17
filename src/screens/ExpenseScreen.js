import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Platform, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, RefreshControl, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { submitExpense, updateExpense, getMyExpenses } from '../config/api';
import { notifySuccess, notifyError } from '../utils/notify';

export default function ExpenseScreen() {
  const navigation = useNavigation();
  const webFileInputRef = React.useRef(null);
  const paginationScrollRef = useRef(null);

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

  const [showTypePicker, setShowTypePicker] = useState(false);
  const [activeTypeIndex, setActiveTypeIndex] = useState(null);
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [editingClaim, setEditingClaim] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [globalDescription, setGlobalDescription] = useState('');
  const [expenseTypes, setExpenseTypes] = useState(['Travel','Food','Office Supplies','Fuel','Accommodation','Communication','Other']);
  const [newTypeName, setNewTypeName] = useState('');

  // Dynamic rows state
  const [expenses, setExpenses] = useState([{ expenseType: 'Travel', amount: '', billNumber: '', description: '', attachment: null, travelFrom: '', travelTo: '', mode: 'Car' }]);
  const [showModePicker, setShowModePicker] = useState(false);
  const [activeModeIndex, setActiveModeIndex] = useState(null);
  const activeUploadIndexRef = useRef(null);

  const updateExpenseField = useCallback((index, field, value) => {
    setExpenses(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }, []);

  const addExpenseRow = () => {
    setExpenses(prev => [...prev, { expenseType: 'Travel', amount: '', billNumber: '', description: '', attachment: null, travelFrom: '', travelTo: '', mode: 'Car' }]);
  };

  const removeExpenseRow = (index) => {
    setExpenses(prev => prev.filter((_, idx) => idx !== index));
  };

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
    setExpenseDate(new Date());
    setExpenses([{ expenseType: 'Travel', amount: '', billNumber: '', description: '', attachment: null, travelFrom: '', travelTo: '', mode: 'Car' }]);
    setGlobalDescription('');
    setEditingClaim(null);
  };

  const openEditClaim = (claim) => {
    if ((claim?.status || 'pending').toLowerCase() !== 'pending') {
      notifyError('Approved expenses cannot be edited');
      return;
    }
    setEditingClaim(claim);
    setExpenseDate(claim.expenseDate ? new Date(claim.expenseDate) : new Date());
    setGlobalDescription(claim.description || '');

    let itemsList = [];
    if (claim.items) {
      if (typeof claim.items === 'string') {
        try {
          itemsList = JSON.parse(claim.items);
        } catch (e) {
          itemsList = [];
        }
      } else if (Array.isArray(claim.items)) {
        itemsList = claim.items;
      }
    }

    if (itemsList.length === 0) {
      itemsList = [{
        expenseType: claim.expenseType || 'Travel',
        amount: claim.amount !== undefined && claim.amount !== null ? String(claim.amount) : '',
        billNumber: claim.billNumber || '',
        description: claim.description || '',
        attachment: null,
        attachmentUrl: claim.attachmentUrl,
        travelFrom: claim.travelFrom || '',
        travelTo: claim.travelTo || '',
        mode: claim.mode || 'Car',
      }];
    } else {
      itemsList = itemsList.map(item => ({
        expenseType: item.expenseType || 'Travel',
        amount: item.amount !== undefined && item.amount !== null ? String(item.amount) : '',
        billNumber: item.billNumber || '',
        description: item.description || '',
        attachment: null,
        attachmentUrl: item.attachmentUrl,
        travelFrom: item.travelFrom || '',
        travelTo: item.travelTo || '',
        mode: item.mode || 'Car',
      }));
    }

    setExpenses(itemsList);
    setView('add');
  };

  const onPickImageFromCamera = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Camera permission is needed to take a photo.'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const fileObj = { uri: asset.uri, name: asset.fileName || 'photo.jpg', type: asset.mimeType || 'image/jpeg' };
        if (activeUploadIndexRef.current !== null) {
          updateExpenseField(activeUploadIndexRef.current, 'attachment', fileObj);
        }
      }
    } catch (e) { Alert.alert('Error', 'Unable to open camera'); }
  }, [updateExpenseField]);

  const onPickImageFromLibrary = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission required', 'Media library permission is needed.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const fileObj = { uri: asset.uri, name: asset.fileName || 'image.jpg', type: asset.mimeType || 'image/jpeg' };
        if (activeUploadIndexRef.current !== null) {
          updateExpenseField(activeUploadIndexRef.current, 'attachment', fileObj);
        }
      }
    } catch (e) { Alert.alert('Error', 'Unable to open gallery'); }
  }, [updateExpenseField]);

  const onPickDocument = useCallback(async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (res.type === 'success') {
        const fileObj = { uri: res.uri, name: res.name, type: res.mimeType || 'application/octet-stream' };
        if (activeUploadIndexRef.current !== null) {
          updateExpenseField(activeUploadIndexRef.current, 'attachment', fileObj);
        }
      }
    } catch (e) { Alert.alert('Error', 'Unable to open file picker'); }
  }, [updateExpenseField]);

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

  const triggerAttachmentUpload = (index) => {
    activeUploadIndexRef.current = index;
    onUploadAttachment();
  };

  const onWebFileChange = (e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    const uri = URL.createObjectURL(f);
    const fileObj = { uri, name: f.name, type: f.type || 'application/octet-stream' };
    if (activeUploadIndexRef.current !== null) {
      updateExpenseField(activeUploadIndexRef.current, 'attachment', fileObj);
    }
    try { e.target.value = null; } catch (_) {}
  };

  const onSubmit = async () => {
    // Validate all items
    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      if (!exp.amount) return notifyError(`Enter amount for Item #${i + 1}`);
      if (exp.expenseType === 'Travel') {
        if (!exp.travelFrom) return notifyError(`Enter From Location for Item #${i + 1}`);
        if (!exp.travelTo) return notifyError(`Enter To Location for Item #${i + 1}`);
        if (!exp.mode) return notifyError(`Select Mode of Transport for Item #${i + 1}`);
      }
    }

    try {
      setSubmitting(true);
      if (editingClaim?.id) {
        const payload = {
          expenseType: expenses[0]?.expenseType || 'Other',
          expenseDate,
          description: globalDescription,
          expenses
        };
        const res = await updateExpense(editingClaim.id, payload);
        if (res?.success) {
          notifySuccess('Expense claim updated');
          resetForm();
          fetchClaims();
          setView('list');
        } else notifyError(res?.message || 'Failed to update expense');
      } else {
        const res = await submitExpense({
          expenseType: expenses[0]?.expenseType || 'Other',
          expenseDate,
          description: globalDescription,
          expenses
        });
        if (res?.success) {
          notifySuccess('Expense claim submitted');
          resetForm();
          fetchClaims();
          setView('list');
        } else notifyError(res?.message || 'Failed to submit expense');
      }
    } catch (e) {
      notifyError(e?.response?.data?.message || (editingClaim?.id ? 'Failed to update expense' : 'Failed to submit expense'));
    } finally {
      setSubmitting(false);
    }
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

  useEffect(() => {
    if (totalPages <= 1) return;
    requestAnimationFrame(() => {
      paginationScrollRef.current?.scrollTo({
        x: Math.max(0, (safeCurrentPage - 2) * 40),
        animated: true,
      });
    });
  }, [safeCurrentPage, totalPages]);

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
                    {(() => {
                      let parsedItems = [];
                      if (item.items) {
                        if (typeof item.items === 'string') {
                          try {
                            parsedItems = JSON.parse(item.items);
                          } catch (e) {
                            parsedItems = [];
                          }
                        } else if (Array.isArray(item.items)) {
                          parsedItems = item.items;
                        }
                      }
                      return parsedItems.length > 0 ? (
                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginTop: 8 }}>
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#374151', marginBottom: 4 }}>Claimed Items ({parsedItems.length}):</Text>
                          {parsedItems.map((sub, idx) => (
                            <View key={idx} style={{ marginTop: idx > 0 ? 6 : 0, borderTopWidth: idx > 0 ? 0.5 : 0, borderTopColor: '#E5E7EB', paddingTop: idx > 0 ? 6 : 0 }}>
                              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#1F2937' }}>
                                #{idx + 1}: {sub.expenseType || 'Other'} - ₹{sub.amount}
                              </Text>
                              {sub.expenseType === 'Travel' ? (
                                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#4B5563', marginTop: 2 }}>
                                  📍 Route: {sub.travelFrom || '-'} ➔ {sub.travelTo || '-'} {sub.mode ? `(${sub.mode})` : ''}
                                </Text>
                              ) : null}
                              {sub.description ? (
                                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                                  Desc: {sub.description}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      ) : (item.travelFrom || item.travelTo ? (
                        <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginTop: 8 }}>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#4B5563' }}>
                            📍 Route: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{item.travelFrom || '-'}</Text> ➔ <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{item.travelTo || '-'}</Text>
                          </Text>
                          {item.mode ? (
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#4B5563', marginTop: 2 }}>
                              🚗 Mode: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{item.mode}</Text>
                            </Text>
                          ) : null}
                        </View>
                      ) : null);
                    })()}
                    {Number(item.paidAmount || 0) > 0 || item.status === 'settled' ? (
                      <View style={{ marginTop: 8, backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8, borderWidth: 0.5, borderColor: '#FDE68A' }}>
                        {Number(item.paidAmount || 0) > 0 ? (
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#B45309' }}>
                            💵 Paid Directly: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>₹{item.paidAmount}</Text>
                          </Text>
                        ) : null}
                        {item.status === 'settled' ? (
                          <>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#16A34A', marginTop: Number(item.paidAmount || 0) > 0 ? 4 : 0 }}>
                              ✅ Settled in Payroll: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>₹{Math.max(0, (item.approvedAmount !== null && item.approvedAmount !== undefined ? Number(item.approvedAmount) : Number(item.amount)) - Number(item.paidAmount || 0))}</Text>
                            </Text>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                              ⏰ Remaining Balance: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>₹0</Text>
                            </Text>
                          </>
                        ) : (
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#D97706', marginTop: 4 }}>
                            ⏰ Remaining Balance: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>₹{Math.max(0, (item.approvedAmount !== null && item.approvedAmount !== undefined ? Number(item.approvedAmount) : Number(item.amount)) - Number(item.paidAmount || 0))}</Text>
                          </Text>
                        )}
                      </View>
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
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: statusBgColor(item.status) }}>
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: statusTextColor(item.status), textTransform: 'capitalize' }}>{item.status}</Text>
                        </View>
                        {(item.status || 'pending').toLowerCase() === 'pending' ? (
                          <TouchableOpacity onPress={() => openEditClaim(item)} style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#125EC9', backgroundColor: '#EFF6FF' }}>
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#125EC9' }}>Edit</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <ScrollView
                    ref={paginationScrollRef}
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 16, marginBottom: 20 }}
                    contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}
                  >
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
                  </ScrollView>
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
          <Text style={{ fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' }}>{editingClaim ? 'Edit Expense' : 'Add Expense'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 }}>
          <Text style={{ color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20, marginBottom: 12 }}>
            {editingClaim ? 'Update this pending expense before admin approval.' : 'Submit your expense for admin verification.'}
          </Text>

          <View style={{ backgroundColor: '#fff', padding: 12, marginBottom: 12 }}>
            <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>Expense Date</Text>
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
            }} style={{ backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginTop: 6, marginBottom: 12 }}>
              <Text style={{ color: '#374151' }}>{expenseDate ? (new Date(expenseDate)).toDateString() : 'Select date'}</Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker value={expenseDate || new Date()} mode="date" display="calendar" onChange={(_e, val) => { setShowDate(Platform.OS === 'ios'); if (val) setExpenseDate(val); }} />
            )}

            <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 12 }}>Description</Text>
            <TextInput
              value={globalDescription}
              onChangeText={setGlobalDescription}
              placeholder="Describe the expense..."
              multiline
              style={{ backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#E6EEFF', padding: 10, marginTop: 6, marginBottom: 12, minHeight: 60, textAlignVertical: 'top', color: '#374151' }}
            />

            <Modal visible={showTypePicker} transparent animationType="fade" onRequestClose={() => setShowTypePicker(false)}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowTypePicker(false)}>
                <View style={{ width: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '60%' }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#1F2937', marginBottom: 12 }}>Select Expense Type</Text>
                  <ScrollView style={{ maxHeight: '75%' }}>
                    {expenseTypes.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => {
                          if (activeTypeIndex !== null) {
                            updateExpenseField(activeTypeIndex, 'expenseType', opt);
                          }
                          setShowTypePicker(false);
                        }}
                        style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                      >
                        <Text style={{
                          color: activeTypeIndex !== null && opt === expenses[activeTypeIndex]?.expenseType ? '#125EC9' : '#374151',
                          fontFamily: activeTypeIndex !== null && opt === expenses[activeTypeIndex]?.expenseType ? 'Inter_700Bold' : 'Inter_400Regular'
                        }}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      placeholder="New custom type..."
                      value={newTypeName}
                      onChangeText={setNewTypeName}
                      style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginRight: 8, color: '#374151' }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (newTypeName.trim()) {
                          const trimmed = newTypeName.trim();
                          if (!expenseTypes.includes(trimmed)) {
                            setExpenseTypes([...expenseTypes, trimmed]);
                          }
                          if (activeTypeIndex !== null) {
                            updateExpenseField(activeTypeIndex, 'expenseType', trimmed);
                          }
                          setNewTypeName('');
                          setShowTypePicker(false);
                        }
                      }}
                      style={{ backgroundColor: '#125EC9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 }}
                    >
                      <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>

            {expenses.map((exp, index) => {
              const isTravel = exp.expenseType === 'Travel';
              return (
                <View key={index} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA', marginBottom: 16, marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#374151' }}>Expense Item #{index + 1}</Text>
                    {expenses.length > 1 && (
                      <TouchableOpacity onPress={() => removeExpenseRow(index)}>
                        <Text style={{ color: '#EF4444', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 6 }}>Expense Type</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setActiveTypeIndex(index);
                      setShowTypePicker(true);
                    }}
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 12, marginBottom: 10 }}
                  >
                    <Text style={{ color: '#374151' }}>{exp.expenseType || 'Select type'}</Text>
                  </TouchableOpacity>

                  <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>Amount (₹)</Text>
                  <TextInput
                    value={exp.amount}
                    onChangeText={(val) => updateExpenseField(index, 'amount', val)}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginTop: 4, marginBottom: 10 }}
                  />

                  {isTravel && (
                    <>
                      <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>From Location</Text>
                      <TextInput
                        value={exp.travelFrom}
                        onChangeText={(val) => updateExpenseField(index, 'travelFrom', val)}
                        placeholder="Starting point"
                        style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginTop: 4, marginBottom: 10 }}
                      />

                      <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>To Location</Text>
                      <TextInput
                        value={exp.travelTo}
                        onChangeText={(val) => updateExpenseField(index, 'travelTo', val)}
                        placeholder="Destination"
                        style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginTop: 4, marginBottom: 10 }}
                      />

                      <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>Mode of Transport</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setActiveModeIndex(index);
                          setShowModePicker(true);
                        }}
                        style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginTop: 4, marginBottom: 10 }}
                      >
                        <Text style={{ color: '#374151' }}>{exp.mode || 'Car'}</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>Bill / Invoice Number</Text>
                  <TextInput
                    value={exp.billNumber}
                    onChangeText={(val) => updateExpenseField(index, 'billNumber', val)}
                    placeholder="Bill number"
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginTop: 4, marginBottom: 10 }}
                  />

                  <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12 }}>Attachment</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 10 }}>
                    <TouchableOpacity onPress={() => triggerAttachmentUpload(index)} style={{ backgroundColor: '#125ec9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 }}>
                      <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 11 }}>{exp.attachment ? 'Replace File' : 'Upload File'}</Text>
                    </TouchableOpacity>
                    {exp.attachment ? <Text style={{ marginLeft: 8, fontSize: 11, color: '#374151', flex: 1 }} numberOfLines={1}>{exp.attachment.name}</Text> : null}
                    {!exp.attachment && exp.attachmentUrl ? <Text style={{ marginLeft: 8, fontSize: 11, color: '#6B7280' }}>Existing file saved</Text> : null}
                  </View>


                </View>
              );
            })}

            <TouchableOpacity onPress={addExpenseRow} style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#125EC9', paddingVertical: 12, alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#125EC9', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>+ Add More Expense Line</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
              <TouchableOpacity onPress={() => { resetForm(); setView('list'); }} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 }}>
                <Text style={{ color: '#374151', fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onSubmit} disabled={submitting} style={{ flex: 1, backgroundColor: '#125EC9', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginLeft: 8 }}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>{editingClaim ? 'Update Expense' : 'Submit Expense'}</Text>}
              </TouchableOpacity>
            </View>

            <Modal visible={showModePicker} transparent animationType="fade" onRequestClose={() => setShowModePicker(false)}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={() => setShowModePicker(false)}>
                <View style={{ position: 'absolute', left: 20, right: 20, top: '35%', backgroundColor: '#fff', borderRadius: 8, padding: 12 }}>
                  {['Car','Bike','Train','Flight','Bus','Taxi','Auto','Other'].map((opt) => (
                    <TouchableOpacity key={opt} onPress={() => {
                      if (activeModeIndex !== null) {
                        updateExpenseField(activeModeIndex, 'mode', opt);
                      }
                      setShowModePicker(false);
                    }} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                      <Text style={{ color: '#374151', fontFamily: 'Inter_400Regular' }}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
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

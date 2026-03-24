import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Platform, Alert, Modal, Pressable, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAssignedJobDetail, listMyAssignedJobs, submitOrder, listOrderProducts } from '../config/api';
import { notifySuccess, notifyError } from '../utils/notify';
import { formatAddress } from '../services/locationService';

export default function OrderFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [proof, setProof] = useState(null);
  const [orderDate, setOrderDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProd, setNewProd] = useState({ name: '', size: '', qty: 1, price: '' });
  const [masterProducts, setMasterProducts] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showMasterModal, setShowMasterModal] = useState(false);

  // Client selection / source
  const assignedJobId = route.params?.assignedJobId ? Number(route.params.assignedJobId) : null;
  const [clientId, setClientId] = useState(null);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [clientOptions, setClientOptions] = useState([]); // [{id,name,phone,clientType,location}]
  const [loadingClients, setLoadingClients] = useState(false);
  const webFileInputRef = React.useRef(null);

  const totals = useMemo(() => {
    const net = products.reduce((sum, p) => sum + (Number(p.qty) || 0) * (Number(p.price) || 0), 0);
    const gst = Math.round(net * 0.18);
    const total = net + gst;
    return { net, gst, total };
  }, [products]);

  const fmtDateLine = (d) => {
    const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${wk}, ${dd}-${mm}-${yyyy}`;
  };

  const onChangeDate = (_e, val) => {
    if (Platform.OS !== 'ios') setShowDate(false);
    if (val) setOrderDate(val);
  };

  const loadMasterProducts = async () => {
    try {
      setLoadingMaster(true);
      console.log('[DEBUG] Calling listOrderProducts API...');
      const res = await listOrderProducts();
      console.log('[DEBUG] listOrderProducts response:', res);
      if (res?.success) {
        setMasterProducts(res.products || []);
      } else {
        console.warn('[DEBUG] listOrderProducts failed:', res?.message);
      }
    } catch (err) {
      console.error('[DEBUG] loadMasterProducts error:', err);
    }
    finally { setLoadingMaster(false); }
  };

  const addProduct = () => {
    setNewProd({ name: '', size: '', qty: 1, price: '' });
    setProductSearch('');
    setShowProductModal(true);
    if (masterProducts.length === 0) loadMasterProducts();
  };

  const submitNewProduct = () => {
    const nextId = (products[products.length - 1]?.id || 0) + 1;
    const name = newProd.name?.trim();
    if (!name) {
      notifyError('Product name is required');
      return;
    }
    const size = newProd.size?.trim() || '';
    const qty = String(Math.max(0, Number(newProd.qty) || 0));
    const price = String(Math.max(0, Number(newProd.price) || 0));
    setProducts((prev) => [...prev, { id: nextId, name, size, qty, price }]);
    setShowProductModal(false);
  };

  const onSelectMasterProduct = (p) => {
    const nextId = (products[products.length - 1]?.id || 0) + 1;
    setProducts((prev) => [
      ...prev,
      {
        id: nextId,
        name: p.name || '',
        size: p.size || '',
        qty: String(p.defaultQty || 1),
        price: String(p.defaultPrice || 0),
      }
    ]);
    setProductSearch('');
    notifySuccess(`${p.name} added`);
  };

  const filteredMasterProducts = useMemo(() => {
    if (!productSearch.trim()) return masterProducts;
    const s = productSearch.toLowerCase();
    return masterProducts.filter((p) =>
      p.name?.toLowerCase().includes(s) || p.size?.toLowerCase().includes(s)
    );
  }, [masterProducts, productSearch]);

  const updateProduct = (id, key, value) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  };

  const removeProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const onPickImageFromCamera = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is needed to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setProof({ uri: asset.uri, name: asset.fileName || 'photo.jpg', type: asset.mimeType || 'image/jpeg' });
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open camera');
    }
  }, []);

  const onPickImageFromLibrary = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Media library permission is needed.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setProof({ uri: asset.uri, name: asset.fileName || 'image.jpg', type: asset.mimeType || 'image/jpeg' });
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open gallery');
    }
  }, []);

  const onPickDocument = useCallback(async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.type === 'success') {
        setProof({ uri: res.uri, name: res.name, type: res.mimeType || 'application/octet-stream' });
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open file picker');
    }
  }, []);

  const onUploadProof = useCallback(() => {
    if (Platform.OS === 'web') {
      // Trigger hidden file input to pick a file on web
      try { webFileInputRef.current && webFileInputRef.current.click(); } catch (e) { }
      return;
    }
    if (Platform.OS === 'ios') {
      const ActionSheetIOS = require('react-native').ActionSheetIOS;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Camera', 'Photo Library', 'Choose File'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) onPickImageFromCamera();
          else if (idx === 2) onPickImageFromLibrary();
          else if (idx === 3) onPickDocument();
        }
      );
    } else {
      Alert.alert('Upload proof', 'Select a source', [
        { text: 'Camera', onPress: onPickImageFromCamera },
        { text: 'Photo Library', onPress: onPickImageFromLibrary },
        { text: 'Choose File', onPress: onPickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [onPickDocument, onPickImageFromCamera, onPickImageFromLibrary]);

  const onWebFileChange = (e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    const uri = URL.createObjectURL(f);
    setProof({ uri, name: f.name, type: f.type || 'application/octet-stream' });
    // reset input to allow choosing the same file again
    try { e.target.value = null; } catch (_) { }
  };

  // Prefill if coming from an assigned job
  React.useEffect(() => {
    let active = true;
    loadMasterProducts(); // Auto-load products on mount
    if (!assignedJobId) return () => { active = false; };
    (async () => {
      try {
        const res = await getAssignedJobDetail(assignedJobId);
        const c = res?.job?.client;
        if (active && c) {
          setClientId(c.id || null);
          if (c.name) setClientName(c.name);
          if (c.phone) setPhone(c.phone);
          if (c.location) setRemarks((r) => r);
        }
      } catch (_) { }
    })();
    return () => { active = false; };
  }, [assignedJobId]);

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
    setClientPickerVisible(false);
  };

  const onSubmit = async () => {
    if (!clientName?.trim()) {
      notifyError('Client name is required');
      return;
    }
    if (!proof || !proof.uri) {
      notifyError('Upload proof is required');
      return;
    }
    try {
      setSubmitting(true);
      let geo = { lat: undefined, lng: undefined, altitude: undefined, address: undefined };
      try {
        const Location = require('expo-location');
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm?.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const coords = current?.coords || {};
          geo = {
            lat: typeof coords.latitude === 'number' ? coords.latitude : undefined,
            lng: typeof coords.longitude === 'number' ? coords.longitude : undefined,
            altitude: typeof coords.altitude === 'number' ? coords.altitude : undefined,
            address: undefined,
          };
          if (typeof geo.lat === 'number' && typeof geo.lng === 'number') {
            try {
              const rev = await Location.reverseGeocodeAsync({ latitude: geo.lat, longitude: geo.lng });
              const a = Array.isArray(rev) ? rev[0] : null;
              geo.address = formatAddress(a) || `Coordinates: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`;
            } catch (_) {
              geo.address = `Coordinates: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`;
            }
          }
        }
      } catch (_) {
        const fallback = await new Promise((resolve) => {
          const nav = typeof navigator !== 'undefined' ? navigator : null;
          if (!nav || !nav.geolocation) return resolve({ lat: undefined, lng: undefined, altitude: undefined, address: undefined });
          try {
            nav.geolocation.getCurrentPosition(
              (pos) => {
                const crd = pos && pos.coords ? pos.coords : {};
                resolve({
                  lat: typeof crd.latitude === 'number' ? crd.latitude : undefined,
                  lng: typeof crd.longitude === 'number' ? crd.longitude : undefined,
                  altitude: typeof crd.altitude === 'number' ? crd.altitude : undefined,
                  address: undefined,
                });
              },
              () => resolve({ lat: undefined, lng: undefined, altitude: undefined, address: undefined }),
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
            );
          } catch (_) {
            resolve({ lat: undefined, lng: undefined, altitude: undefined, address: undefined });
          }
        });
        geo = fallback;
      }

      const items = products.map((p) => ({ name: p.name, size: p.size, qty: Number(p.qty) || 0, price: Number(p.price) || 0 }));
      const payload = {
        orderDate,
        paymentMethod,
        remarks,
        items,
        proof,
        checkInLat: typeof geo.lat === 'number' ? geo.lat : undefined,
        checkInLng: typeof geo.lng === 'number' ? geo.lng : undefined,
        checkInAltitude: typeof geo.altitude === 'number' ? geo.altitude : undefined,
        checkInAddress: geo.address || undefined,
      };
      if (phone) payload.phone = phone;
      if (assignedJobId) payload.assignedJobId = assignedJobId;
      else if (clientId) payload.clientId = clientId;

      const res = await submitOrder(payload);
      if (res?.success) {
        notifySuccess('Order submitted');
        navigation.goBack();
      } else {
        notifyError(res?.message || 'Failed to submit order');
      }
    } catch (e) {
      notifyError('Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30, marginLeft: 5, marginRight: 5, borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={{ fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' }}>Order Form</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 }}>
        <Text style={{ color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20, marginBottom: 12 }}>
          Create or update customer order details and attach proof.
        </Text>

        <View style={{ backgroundColor: '#fff', padding: 12, marginBottom: 12 }}>
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 6 }}>Client name <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#E6EEFF', paddingVertical: 13, paddingHorizontal: 12 }}>
              <Image source={require('../assets/uki.png')} style={{ width: 14, height: 14, marginRight: 8 }} />
              <TextInput value={clientName} onChangeText={setClientName} editable={!assignedJobId} placeholder="Enter client name" placeholderTextColor="#9CA3AF" style={{ flex: 1, color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12, outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' }} />
              {!assignedJobId ? (
                <TouchableOpacity onPress={openClientPicker} style={{ marginLeft: 8, backgroundColor: '#E0ECFF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 }}>
                  <Text style={{ color: '#1D4ED8', fontFamily: 'Inter_500Medium', fontSize: 11 }}>Pick</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 6 }}>Phone number</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#E6EEFF', paddingVertical: 13, paddingHorizontal: 12 }}>
              <Image source={require('../assets/telephone.png')} style={{ width: 14, height: 14, marginRight: 8 }} />
              <TextInput value={phone} onChangeText={setPhone} editable={!assignedJobId} placeholder="Enter phone" keyboardType="phone-pad" placeholderTextColor="#9CA3AF" style={{ flex: 1, color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12, outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' }} />
            </View>
          </View>

        </View>

        {/* Order date and time */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 12 }}>
          <Text style={{ color: '#1F2937', fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 }}>Order date and time</Text>
          <TouchableOpacity onPress={() => setShowDate(true)} style={{ backgroundColor: '#F3F4F6', borderRadius: 8, borderWidth: 1, borderColor: '#E6EEFF', paddingHorizontal: 12, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>{fmtDateLine(orderDate)}</Text>
            <Image source={require('../assets/calendar2-range.png')} style={{ width: 16, height: 16 }} />
          </TouchableOpacity>
        </View>

        {/* Product Info */}
        <View style={{ backgroundColor: '#FFFFFF', padding: 12, marginBottom: 12 }}>
          <Text style={{ color: '#1F2937', fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 10 }}>Products info</Text>

          {/* Master Product Selection Section */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 6 }}>Select Product from Master List</Text>
            <TouchableOpacity
              onPress={() => setShowMasterModal(true)}
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#E6EEFF',
                paddingVertical: 13,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>
                {loadingMaster ? 'Loading master products...' : 'Tap here to choose product from list'}
              </Text>
              <Image source={require('../assets/uki.png')} style={{ width: 14, height: 14, tintColor: '#125EC9' }} />
            </TouchableOpacity>
          </View>

          {products.length === 0 ? (
            <View style={{ paddingVertical: 12 }}>
              <Text style={{ color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 10 }}>No products added to this order.</Text>
              <View style={{ alignItems: 'flex-start' }}>
                <TouchableOpacity onPress={addProduct} style={{ backgroundColor: '#125EC9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}>
                  <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 12 }}>+ Add Manual Product</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
              <TouchableOpacity onPress={addProduct} style={{ backgroundColor: '#125EC9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 }}>
                <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 12 }}>+ Add Manual Product</Text>
              </TouchableOpacity>
            </View>
          )}

          {products.map((p) => {
            const amount = (Number(p.qty) || 0) * (Number(p.price) || 0);
            return (
              <View key={p.id} style={{ borderTopWidth: 1, borderColor: '#E5E7EB', paddingTop: 10, marginTop: 8 }}>
                {/* Header: icon + name on left, Value label on right */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image source={require('../assets/seam.png')} style={{ width: 16, height: 16, marginRight: 6 }} />
                    <Text style={{ color: '#111827', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{p.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeProduct(p.id)} style={{ paddingHorizontal: 4 }}>
                    <Text style={{ color: '#DC2626', fontFamily: 'Inter_500Medium', fontSize: 11 }}>Remove</Text>
                  </TouchableOpacity>
                </View>

                {/* Rows: label left, value right */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, marginTop: 20 }}>
                  <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>Product size</Text>
                  <Text style={{ color: '#454545', fontFamily: 'Inter_400Medium', fontSize: 12, minWidth: 80, textAlign: 'right' }}>{p.size}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                  <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>Product qty</Text>
                  <Text style={{ color: '#454545', fontFamily: 'Inter_400Medium', fontSize: 12, minWidth: 80, textAlign: 'right' }}>{p.qty}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>Product rate</Text>
                  <Text style={{ color: '#454545', fontFamily: 'Inter_400Medium', fontSize: 12, textAlign: 'right' }}>₹ {p.price}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>Product amount</Text>
                  <Text style={{ color: '#454545', fontFamily: 'Inter_400SemiBold', fontSize: 12, minWidth: 80, textAlign: 'right' }}>₹ {amount}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
                  <TouchableOpacity onPress={addProduct} style={{ backgroundColor: '#125EC9', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 }}>
                    <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 10 }}>+ Add Product</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Totals (divider only, not boxed) */}
        <View style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E5E7EB', paddingTop: 10, paddingHorizontal: 12, paddingBottom: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>Net amount :</Text>
            <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>₹ {totals.net}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>GST (18%) :</Text>
            <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>₹ {totals.gst}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>Total amount :</Text>
            <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12 }}>₹ {totals.total}</Text>
          </View>
        </View>


        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: '#1F2937', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Payment method :</Text>
            <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginLeft: 6 }}>{paymentMethod}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['Cash', 'Online', 'Cheque'].map((m) => (
              <TouchableOpacity key={m} onPress={() => setPaymentMethod(m)} style={{ backgroundColor: paymentMethod === m ? '#E0ECFF' : '#F3F4F6', borderColor: paymentMethod === m ? '#E0ECFF' : '#F3F4F6', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                <Text style={{ color: paymentMethod === m ? '#1D4ED8' : '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 11 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 12 }}>
          <Text style={{ color: '#1F2937', fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 }}>Remarks.</Text>
          <TextInput value={remarks} onChangeText={setRemarks} placeholder="Type here..." placeholderTextColor="#9CA3AF" multiline style={{ minHeight: 110, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E6EEFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top', color: '#111827', outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' }} />
        </View>

        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 12 }}>
          <Text style={{ color: '#1F2937', fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 }}>Upload proof</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Left square preview */}
            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E6EEFF', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {(() => {
                const isImg = !!proof && ((proof.type && proof.type.startsWith('image/')) || /\.(png|jpg|jpeg|webp|gif)$/i.test(String(proof.name || proof.uri || '')));
                if (isImg) {
                  return <Image source={{ uri: proof.uri }} style={{ width: 32, height: 32, borderRadius: 6 }} />;
                }
                return <Image source={require('../assets/upload.png')} style={{ width: 16, height: 16, tintColor: '#6B7280' }} />;
              })()}
              {proof ? (
                <TouchableOpacity onPress={() => setProof(null)} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#DC2626', borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 10 }}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {/* Upload button */}
            <TouchableOpacity onPress={onUploadProof} style={{ backgroundColor: '#125ec9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
              <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{proof ? 'Replace proof' : 'Upload proof'}</Text>
            </TouchableOpacity>
            {/* File name inline (optional) */}
            {!!proof?.name && (
              <Text numberOfLines={1} style={{ flexShrink: 1, color: '#1F2937', fontFamily: 'Inter_500Medium', fontSize: 12 }}>{proof.name}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity onPress={onSubmit} disabled={submitting} style={{ backgroundColor: '#125ec9', paddingVertical: 14, borderRadius: 8, alignItems: 'center', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 14 }}>Submit</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Master Products List Modal */}
      {showMasterModal ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setShowMasterModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowMasterModal(false)}>
            <Pressable style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 30 }} onPress={(e) => e.stopPropagation()}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Select Product</Text>
                <TouchableOpacity onPress={() => setShowMasterModal(false)}>
                  <Text style={{ color: '#125EC9', fontWeight: '500' }}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {/* Internal search in modal if needed, or just list */}
              <View style={{ padding: 12 }}>
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, marginBottom: 12 }}>
                  <TextInput
                    value={productSearch}
                    onChangeText={setProductSearch}
                    placeholder="Search master list..."
                    style={{ height: 40, fontSize: 13 }}
                  />
                </View>

                {loadingMaster && <ActivityIndicator color="#125EC9" style={{ marginVertical: 20 }} />}

                {!loadingMaster && (
                  <ScrollView style={{ minHeight: 100 }}>
                    {filteredMasterProducts.length === 0 ? (
                      <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#9CA3AF' }}>No products found</Text>
                        <TouchableOpacity onPress={loadMasterProducts} style={{ marginTop: 10 }}>
                          <Text style={{ color: '#125EC9' }}>Try Refreshing</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      filteredMasterProducts.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => {
                            onSelectMasterProduct(p);
                            setShowMasterModal(false);
                          }}
                          style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', px: 4 }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}>{p.name} {p.size ? `(${p.size})` : ''}</Text>
                          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Price: ₹{p.defaultPrice}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {showProductModal ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowProductModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 }} onPress={() => setShowProductModal(false)}>
            <Pressable style={{ width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#454545', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#454545', fontFamily: 'Inter_500Medium', fontSize: 14 }}>Add product</Text>
                <TouchableOpacity onPress={() => setShowProductModal(false)}><Text style={{ color: '#6B7280', fontSize: 18 }}>✕</Text></TouchableOpacity>
              </View>
              <View style={{ padding: 16 }}>
                <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 10 }}>Product Details (Enter Manually)</Text>

                <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 4 }}>Name</Text>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#C4C4C4', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 }}>
                  <TextInput value={newProd.name} onChangeText={(v) => setNewProd((p) => ({ ...p, name: v }))} placeholder="Product name" placeholderTextColor="#9CA3AF" style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12, outlineStyle: 'none' }} />
                </View>

                <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 4 }}>Size</Text>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#C4C4C4', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10 }}>
                  <TextInput value={newProd.size} onChangeText={(v) => setNewProd((p) => ({ ...p, size: v }))} placeholder="Product size" placeholderTextColor="#9CA3AF" style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12, outlineStyle: 'none' }} />
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 4 }}>Qty</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity onPress={() => setNewProd(p => ({ ...p, qty: Math.max(0, Number(p.qty) - 1) }))} style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#c4c4c4', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#454545', fontWeight: '600' }}>−</Text></TouchableOpacity>
                      <View style={{ flex: 1, height: 34, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#c4c4c4', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#454545', fontSize: 12 }}>{newProd.qty}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setNewProd(p => ({ ...p, qty: Number(p.qty) + 1 }))} style={{ width: 34, height: 34, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#c4c4c4', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#454545', fontWeight: '600' }}>+</Text></TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 11, marginBottom: 4 }}>Rate (₹)</Text>
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#c4c4c4', paddingVertical: 10, paddingHorizontal: 12, height: 34, justifyContent: 'center' }}>
                      <TextInput value={String(newProd.price)} onChangeText={(v) => setNewProd((p) => ({ ...p, price: v.replace(/[^0-9]/g, '') }))} keyboardType="numeric" placeholder="₹" placeholderTextColor="#9CA3AF" style={{ color: '#454545', fontSize: 12, outlineStyle: 'none' }} />
                    </View>
                  </View>
                </View>

                <TouchableOpacity onPress={submitNewProduct} style={{ backgroundColor: '#125EC9', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Submit</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Date picker */}
      {showDate && Platform.OS !== 'web' ? (
        <DateTimePicker value={orderDate} mode="datetime" onChange={onChangeDate} />
      ) : null}
      {showDate && Platform.OS === 'web' ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowDate(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 }} onPress={() => setShowDate(false)}>
            <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
              <Text style={{ color: '#111827', fontFamily: 'Inter_600SemiBold', marginBottom: 12 }}>Select date & time</Text>
              <input
                type="datetime-local"
                value={orderDate ? orderDate.toISOString().slice(0, 16) : ''}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  if (!isNaN(date.getTime())) {
                    setOrderDate(date);
                    setShowDate(false);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderWidth: 1,
                  borderColor: '#C4C4C4',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none'
                }}
              />
              <TouchableOpacity onPress={() => setShowDate(false)} style={{ marginTop: 12, alignSelf: 'flex-end', backgroundColor: '#0F3B8C', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 }}>
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      ) : null}

      {/* Client Picker Modal */}
      {clientPickerVisible ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setClientPickerVisible(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 }} onPress={() => setClientPickerVisible(false)}>
            <Pressable style={{ width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#454545', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#454545', fontFamily: 'Inter_500Medium', fontSize: 14 }}>Select Client</Text>
                <TouchableOpacity onPress={() => setClientPickerVisible(false)}><Text style={{ color: '#6B7280', fontSize: 18 }}>✕</Text></TouchableOpacity>
              </View>
              <View style={{ maxHeight: 360, padding: 12 }}>
                {loadingClients ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}><ActivityIndicator color="#125EC9" /></View>
                ) : (
                  clientOptions.map((c) => (
                    <TouchableOpacity key={String(c.id)} onPress={() => onSelectClient(c)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                      <Text style={{ color: '#111827', fontFamily: 'Inter_500Medium' }}>{c.name}</Text>
                      {!!c.phone && <Text style={{ color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12 }}>{c.phone}</Text>}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {/* Hidden file input for web proof upload */}
      {Platform.OS === 'web' ? (
        // eslint-disable-next-line react/no-unknown-property
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

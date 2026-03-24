import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, Platform, Linking, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { listRequiredDocuments, uploadStaffDocument } from '../config/api';
import { notifyError, notifyInfo, notifySuccess } from '../utils/notify';

export default function MyDocumentsScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [items, setItems] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listRequiredDocuments();
      if (res?.success) {
        setItems(Array.isArray(res.documents) ? res.documents : []);
      } else {
        notifyError(res?.message || 'Unable to load documents.');
      }
    } catch (e) {
      notifyError('Unable to load documents.');
    } finally {
      setLoading(false);
    }
  };

  const buildFileUrl = (p) => {
    if (!p) return null;
    if (String(p).startsWith('http')) return String(p);
    const base = __DEV__ ? 'http://localhost:4000' : 'https://backend.vetansutra.com';
    return `${base}${p}`;
  };

  const onView = async (p) => {
    const url = buildFileUrl(p);
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        notifyError('Unable to open document.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      notifyError('Unable to open document.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pickFileFromDevice = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return null;
      const asset = res.assets?.[0];
      if (!asset?.uri) return null;

      return {
        uri: asset.uri,
        name: asset.name || 'document',
        type: asset.mimeType || 'application/octet-stream',
      };
    } catch (e) {
      notifyError('Unable to pick file.');
      return null;
    }
  };

  const pickFileFromCamera = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        notifyInfo('Camera permission is required to capture document photo.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled) return null;
      const asset = result.assets?.[0];
      if (!asset?.uri) return null;

      return {
        uri: asset.uri,
        name: asset.fileName || 'document.jpg',
        type: asset.mimeType || 'image/jpeg',
      };
    } catch (_) {
      notifyError('Unable to open camera.');
      return null;
    }
  };

  const selectFileForUpload = () => new Promise((resolve) => {
    if (Platform.OS !== 'android') {
      pickFileFromDevice().then(resolve);
      return;
    }

    Alert.alert(
      'Upload Document',
      'Choose source',
      [
        { text: 'Camera', onPress: async () => resolve(await pickFileFromCamera()) },
        { text: 'Choose File', onPress: async () => resolve(await pickFileFromDevice()) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });

  const statusLabel = useMemo(() => {
    const map = {
      SUBMITTED: 'Submitted',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
    };
    return (s) => map[String(s || '')] || '';
  }, []);

  const onUpload = async (docTypeId) => {
    const file = await selectFileForUpload();
    if (!file?.uri) return;

    setUploadingId(String(docTypeId));
    try {
      const res = await uploadStaffDocument(docTypeId, file);
      if (res?.success) {
        notifySuccess('Document uploaded successfully.');
        await load();
      } else {
        notifyError(res?.message || 'Unable to upload document.');
      }
    } catch (e) {
      notifyError('Unable to upload document.');
    } finally {
      setUploadingId(null);
    }
  };

  const isPdfUrl = (url) => {
    if (!url) return false;
    return /\.pdf(\?|#|$)/i.test(String(url));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Documents</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={{ paddingVertical: 24 }}><ActivityIndicator /></View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={{ paddingVertical: 24 }}>
            <Text style={styles.empty}>No documents configured by admin.</Text>
          </View>
        ) : null}

        {items.map((it) => {
          const busy = uploadingId === String(it.id);
          const isApproved = String(it.status || '').toUpperCase() === 'APPROVED';
          const sub = it.uploaded ? statusLabel(it.status) : 'Not uploaded';
          const required = it.required ? 'Required' : 'Optional';
          const fileUrl = buildFileUrl(it.fileUrl);
          const isPdf = isPdfUrl(fileUrl);
          return (
            <View key={String(it.id)} style={styles.card}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{it.name}</Text>
                  <Text style={styles.sub}>{required} • {sub}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.btn, isApproved ? styles.btnDisabled : null]}
                  activeOpacity={0.9}
                  onPress={() => onUpload(it.id)}
                  disabled={busy || isApproved}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>
                      {isApproved ? 'Approved' : (it.uploaded ? 'Replace' : 'Upload')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {fileUrl ? (
                <View style={styles.previewRow}>
                  {isPdf ? (
                    <View style={styles.pdfBadge}>
                      <Text style={styles.pdfText}>PDF</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: fileUrl }} style={styles.previewImg} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewText}>Uploaded</Text>
                    <TouchableOpacity style={styles.viewBtn} activeOpacity={0.9} onPress={() => onView(it.fileUrl)}>
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 30 }} />
      </ScrollView>
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
  empty: { color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' },

  card: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    borderColor: '#E6EEFF',
    borderWidth: 1,
    marginBottom: 12,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: '#1f2c3a', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  sub: { marginTop: 4, color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12 },

  btn: { backgroundColor: '#125EC9', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minWidth: 90, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#9CA3AF' },
  btnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  previewRow: { flexDirection: 'row', gap: 12, marginTop: 12, alignItems: 'center' },
  previewImg: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#E5E7EB' },
  pdfBadge: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  pdfText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  previewText: { color: '#111827', fontFamily: 'Inter_500Medium', fontSize: 12 },
  viewBtn: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#0F3B8C', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  viewBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});

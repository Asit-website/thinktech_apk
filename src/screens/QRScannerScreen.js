import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import api from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [punchResult, setPunchResult] = useState(null);

  // Request camera permission on mount
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1677ff" />
        <Text style={styles.loadingText}>Initializing Camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={64} color="#dc2626" />
        <Text style={styles.errorText}>Camera access is required to scan QR Code.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ type, data }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      // 1. Parse QR payload
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (err) {
        throw new Error('Invalid QR Code format. Please scan a valid attendance QR.');
      }

      if (!parsedData.token) {
        throw new Error('Invalid QR Code signature.');
      }

      // 2. Fetch current GPS location
      let locPermission = await Location.getForegroundPermissionsAsync();
      if (!locPermission.granted) {
        locPermission = await Location.requestForegroundPermissionsAsync();
      }
      if (!locPermission.granted) {
        throw new Error('Location permission is required for geofenced QR scans.');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // 3. Post to backend using shared API client
      const response = await api.post(
        '/attendance/qr-punch',
        {
          token: parsedData.token,
          latitude,
          longitude,
        }
      );

      if (response.data?.success) {
        setPunchResult({
          action: response.data.action,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          orgName: parsedData.orgName || 'Office',
        });
      } else {
        throw new Error(response.data?.message || 'Failed to record punch.');
      }

    } catch (error) {
      console.error('QR Scan error:', error);
      const errMsg = error.response?.data?.message || error.message || 'An error occurred during verification.';
      if (Platform.OS === 'web') {
        alert(errMsg);
        setScanned(false);
      } else {
        Alert.alert(
          'Punch Failed',
          errMsg,
          [{ text: 'Try Again', onPress: () => setScanned(false) }]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const closeSuccessModal = () => {
    setPunchResult(null);
    setScanned(false);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Header Overlay */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Attendance Scan</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Scanner Box Overlay */}
      <View style={styles.overlayContainer}>
        <View style={styles.scannerBox}>
          {/* Box Borders */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#1677ff" />
              <Text style={styles.loadingText}>Verifying Location...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Guidance */}
      <View style={styles.footer}>
        <Text style={styles.guidanceText}>
          Align the office QR Code inside the box to scan automatically.
        </Text>
      </View>

      {/* Success Modal */}
      <Modal visible={!!punchResult} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark-sharp" size={40} color="#ffffff" />
            </View>
            
            <Text style={styles.successTitle}>
              {punchResult?.action === 'PUNCH_IN' ? 'Punch In Successful!' : 'Punch Out Successful!'}
            </Text>
            
            <Text style={styles.successSubtitle}>
              Recorded at {punchResult?.time}
            </Text>
            <Text style={styles.successOrg}>
              Location: {punchResult?.orgName}
            </Text>

            <TouchableOpacity style={styles.closeButton} onPress={closeSuccessModal}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_600SemiBold',
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scannerBox: {
    width: 260,
    height: 260,
    borderColor: 'transparent',
    borderWidth: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#1677ff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
  },
  errorText: {
    color: '#475569',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    fontFamily: 'Inter_500Medium',
  },
  permissionButton: {
    backgroundColor: '#1677ff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  guidanceText: {
    color: '#e2e8f0',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
  },
  successSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 4,
    fontFamily: 'Inter_500Medium',
  },
  successOrg: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 24,
    fontFamily: 'Inter_500Medium',
  },
  closeButton: {
    backgroundColor: '#1677ff',
    paddingVertical: 12,
    paddingHorizontal: 48,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});

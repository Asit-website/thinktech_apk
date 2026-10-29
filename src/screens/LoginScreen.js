import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { sendOtp } from '../config/api';
import { notifyError } from '../utils/notify';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const showError = (msg) => {
    setErrorMsg(msg);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
      window.alert(msg);
    } else {
      Alert.alert('Notice', msg, [{ text: 'OK' }]);
    }
    notifyError(msg);
  };

  const handleSendOtp = async () => {
    const sanitized = phone.replace(/[^0-9]/g, '');
    if (sanitized.length < 10) {
      showError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await sendOtp(sanitized);
      if (res?.success) {
        if (res?.otp) {
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
            window.alert('OTP: ' + String(res.otp));
          } else {
            Alert.alert('OTP', String(res.otp));
          }
        }
        navigation.navigate('OTP', { phone: sanitized, otp: res?.otp ? String(res.otp) : undefined });
      } else {
        const msg = res?.message || 'Failed to send OTP';
        showError(msg);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Unable to send OTP';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <View style={styles.topArea}>
          <Image
            source={{ uri: 'https://res.cloudinary.com/dgif730br/image/upload/v1771585917/Screenshot_8880_nmyxse.png' }}
            style={styles.logo}
          />
        </View>

        <View style={styles.middleArea}>
          <Text style={styles.heading}>Verify your account</Text>

          <View style={[styles.inputRow, errorMsg ? styles.inputRowError : null]}>
            <View style={styles.countryBox}>
              <Text style={styles.countryText}>+91</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Enter Phone Number"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              style={styles.phoneInput}
              maxLength={10}
            />
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footerFixed}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continue</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },

  topArea: { alignItems: 'center', paddingTop: 40 },
  logo: { width: 250, height: 100, resizeMode: 'contain' },

  middleArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { color: '#515151', fontFamily: 'Inter_600SemiBold', fontSize: 22, marginBottom: 30 },

  inputRow: {
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderColor: '#0F3B8C',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  inputRowError: {
    borderColor: '#DC2626',
  },
  countryBox: {
    height: 25,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#51515180',
    backgroundColor: '#FFFFFF',
  },
  countryText: { color: '#111827', fontFamily: 'Inter_500Medium', fontSize: 12 },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    color: '#515151',
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    outlineStyle: 'none',
    outlineWidth: 0,
  },

  errorBox: {
    width: '100%',
    maxWidth: 320,
    marginTop: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  footerFixed: { marginTop: 20, marginBottom: 30, alignItems: 'center', paddingHorizontal: 20 },
  primaryBtn: { width: '100%', maxWidth: 320, backgroundColor: '#0F3B8C', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});

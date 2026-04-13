import React, { useEffect, useState, useRef } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendOtp, verifyOtp, getLatestOtpForPhone } from '../config/api';
import { notifyError, notifyInfo, notifySuccess } from '../utils/notify';
import { usePermissions } from '../contexts/PermissionsContext';

export default function OTPScreen({ route, navigation }) {
  const { phone, otp } = route.params || {};
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRef = useRef(null);
  const autoFillTimerRef = useRef(null);
  const { refreshPermissions } = usePermissions();

  const animateAutoFill = (otpStr) => {
    try { if (autoFillTimerRef.current) clearInterval(autoFillTimerRef.current); } catch { }
    const text = String(otpStr || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (!text) return;
    setCode('');
    let i = 0;
    autoFillTimerRef.current = setInterval(() => {
      i += 1;
      setCode(text.slice(0, i));
      if (i >= text.length) {
        try { clearInterval(autoFillTimerRef.current); } catch { }
        autoFillTimerRef.current = null;
      }
    }, 90); // slight typing animation per digit
  };

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus?.();
    }, 250);
    return () => clearTimeout(t);
  }, []);

  // Web: fetch latest OTP from backend (dev-only endpoint) and auto-fill after a small delay
  useEffect(() => {
    let active = true;
    let timer = null;
    if (Platform.OS === 'web' && phone) {
      timer = setTimeout(async () => {
        try {
          const res = await getLatestOtpForPhone(phone);
          if (active && res?.otp) animateAutoFill(String(res.otp));
        } catch { }
      }, 2200); // ~2.2s delay before autofill
    }
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      try { if (autoFillTimerRef.current) clearInterval(autoFillTimerRef.current); } catch { }
      autoFillTimerRef.current = null;
    };
  }, [phone]);

  // Database OTP fetch functionality (like web)
  useEffect(() => {
    let active = true;
    let timer = null;
    let attempts = 0;
    const maxAttempts = 20; // Try for ~2 minutes

    const fetchOtpFromDatabase = async () => {
      try {
        if (!phone || !active) return;

        const response = await getLatestOtpForPhone(phone);
        if (response?.success && response?.otp && active) {
          const otpStr = String(response.otp).replace(/[^0-9]/g, '').slice(0, 6);
          if (otpStr.length === 6) {
            console.log('OTP fetched from database:', otpStr);
            animateAutoFill(otpStr);
            attempts = maxAttempts; // Stop fetching
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts && active) {
          timer = setTimeout(fetchOtpFromDatabase, 6000); // Check every 6 seconds
        }
      } catch (error) {
        console.log('Error fetching OTP from database:', error.message);
        attempts++;
        if (attempts < maxAttempts && active) {
          timer = setTimeout(fetchOtpFromDatabase, 6000);
        }
      }
    };

    // Start fetching after a small delay
    if (phone) {
      timer = setTimeout(fetchOtpFromDatabase, 3000); // Start after 3 seconds
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phone]);

  const digits = Array.from({ length: 6 }).map((_, i) => code[i] || '');

  const handleVerify = async () => {
    if (code.trim().length < 6) {
      notifyInfo('Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(phone, code.trim());
      if (res?.success) {
        // Check if user has staff role
        if (res?.user?.role !== 'staff') {
          notifyError('You are not allowed because you are not a staff member');
          // Clear any stored tokens
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('user');
          setLoading(false);
          return;
        }

        notifySuccess('Login successful.');
        // Refresh permissions immediately after login
        refreshPermissions();
        setTimeout(() => {
          try {
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          } catch (e) { }
        }, 650);
      } else {
        notifyError(res?.message || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      notifyError('Unable to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      const res = await sendOtp(phone);
      if (res?.otp) {
        Alert.alert('OTP', String(res.otp));
      } else {
        notifySuccess('OTP has been sent successfully.');
      }
    } catch (e) {
      notifyError('Unable to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.topArea}>
          <Image
            source={{ uri: 'https://res.cloudinary.com/dgif730br/image/upload/v1771585917/Screenshot_8880_nmyxse.png' }}
            style={styles.logo}
          />
        </View>

        <View style={styles.middleArea}>
          <Text style={styles.title}>Enter 6 digit pin</Text>

          {otp ? <Text style={styles.devOtp}>OTP: {String(otp)}</Text> : null}

          <TouchableOpacity style={styles.otpRow} activeOpacity={1} onPress={() => inputRef.current?.focus?.()}>
            {digits.map((d, idx) => (
              <View key={idx} style={[styles.otpBox, idx === 0 ? null : styles.otpBoxSpacing]}>
                <Text style={styles.otpDigit}>{d}</Text>
              </View>
            ))}

            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => setCode((t || '').replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoFocus={false}
              caretHidden
              selectionColor="transparent"
              underlineColorAndroid="transparent"
              style={styles.hiddenInput}
              maxLength={6}
            />
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.small}>Having any issue?</Text>
            <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
              <Text style={styles.resend}>{resendLoading ? 'Sending...' : 'Send again'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footerFixed}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 },

  topArea: { alignItems: 'center', paddingTop: 40 },
  logo: { width: 250, height: 100, resizeMode: 'contain' },

  middleArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#515151', fontFamily: 'Inter_600SemiBold', fontSize: 16, marginBottom: 16 },
  devOtp: { color: '#9CA3AF', fontFamily: 'Inter_400Regular', fontSize: 11, marginBottom: 10 },

  otpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  otpBox: {
    width: 45,
    height: 42,
    borderWidth: 1,
    borderColor: '#0F3B8C',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  otpBoxSpacing: { marginLeft: 8 },
  otpDigit: { color: '#111827', fontFamily: 'Inter_500Medium', fontSize: 14 },

  hiddenInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    zIndex: 10,
    outlineStyle: 'none',
    outlineWidth: 0,
  },

  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  small: { color: '#363535', marginRight: 6, fontFamily: 'Inter_400Regular', fontSize: 10 },
  resend: { color: '#184181', fontFamily: 'Inter_500Medium', fontSize: 11 },

  footerFixed: { position: 'absolute', left: 0, right: 0, bottom: 30, alignItems: 'center', paddingHorizontal: 20 },
  primaryBtn: { width: '100%', maxWidth: 320, backgroundColor: '#0F3B8C', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});

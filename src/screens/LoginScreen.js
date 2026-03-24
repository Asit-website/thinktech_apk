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

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const sanitized = phone.replace(/[^0-9]/g, '');
    if (sanitized.length < 10) {
      Alert.alert('Please enter a valid mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(sanitized);
      if (res?.success) {
        if (res?.otp) {
          Alert.alert('OTP', String(res.otp));
        }
        navigation.navigate('OTP', { phone: sanitized, otp: res?.otp ? String(res.otp) : undefined });
      } else {
        Alert.alert(res?.message || 'Failed to send OTP');
      }
    } catch (err) {
      Alert.alert('Unable to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.topArea}>
          {/* https://res.cloudinary.com/dgif730br/image/upload/v1767436218/thinktech-logo-blue-300x103_1_s4uvih.png */}
          <Image
            source={{ uri: 'https://res.cloudinary.com/dgif730br/image/upload/v1771585917/Screenshot_8880_nmyxse.png' }}
            style={styles.logo}
          />
        </View>

        <View style={styles.middleArea}>
          <Text style={styles.heading}>Verify your account</Text>

          <View style={styles.inputRow}>
            <View style={styles.countryBox}>
              <Text style={styles.countryText}>+91</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter Phone Number"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              style={styles.phoneInput}
              maxLength={10}
            />
          </View>
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
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 },

  topArea: { alignItems: 'center', paddingTop: 40 },
  logo: { width: 250, height: 100, resizeMode: 'contain' },

  middleArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { color: '#515151', fontFamily: ' Inter_600SemiBold', fontSize: 22, marginBottom: 30 },

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

  footerFixed: { position: 'absolute', left: 0, right: 0, bottom: 30, alignItems: 'center', paddingHorizontal: 20 },
  primaryBtn: { width: '100%', maxWidth: 320, backgroundColor: '#0F3B8C', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});

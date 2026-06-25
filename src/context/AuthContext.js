import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from '../config/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      const token = await AsyncStorage.getItem('auth_token');
      if (userData && token) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (phone) => {
    try {
      const response = await api.post('/auth/send-otp', { phone });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  };

  const verifyOtp = async (phone, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { phone, otp });
      const { user: userData, token, refreshToken } = response.data;
      
      await AsyncStorage.setItem('auth_token', token);
      if (refreshToken) {
        await AsyncStorage.setItem('refresh_token', refreshToken);
      }
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  };

  const logout = async () => {
    let locationData = {};
    try {
      if (Platform.OS !== 'web') {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let loc = null;
          try {
            loc = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Location request timed out')), 8000))
            ]);
          } catch (err) {
            console.log('getCurrentPositionAsync failed or timed out, trying last known position:', err.message);
            try {
              loc = await Location.getLastKnownPositionAsync();
            } catch (lastErr) {
              console.log('getLastKnownPositionAsync failed:', lastErr.message);
            }
          }

          if (loc && loc.coords) {
            locationData.latitude = loc.coords.latitude;
            locationData.longitude = loc.coords.longitude;
            locationData.accuracy = loc.coords.accuracy;
            try {
              const rev = await Promise.race([
                Location.reverseGeocodeAsync({
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Reverse geocode timed out')), 5000))
              ]);
              if (rev && rev.length > 0) {
                const { formatAddress } = require('../services/locationService');
                locationData.address = formatAddress(rev[0]);
              }
            } catch (e) {
              console.log('Reverse geocode failed during logout:', e.message);
            }
          }
        }
      }
    } catch (e) {
      console.log('Failed to fetch location during logout:', e.message);
    }

    try {
      const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
      if (storedRefreshToken) {
        await api.post('/auth/logout-mobile', {
          refreshToken: storedRefreshToken,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address,
          accuracy: locationData.accuracy
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, sendOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};


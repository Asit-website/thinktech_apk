import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyPermissions, getSubscriptionInfo } from '../config/api';

const PermissionsContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

export const PermissionsProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setPermissions([]);
        setSubscriptionInfo(null);
        setLoading(false);
        return;
      }

      const [permRes, subRes] = await Promise.all([
        getMyPermissions(),
        getSubscriptionInfo()
      ]);

      if (permRes.success && permRes.permissions) {
        setPermissions(permRes.permissions);
      } else {
        setPermissions([]);
      }

      if (subRes.success) {
        setSubscriptionInfo(subRes.subscriptionInfo);
      }
    } catch (error) {
      console.error('Error loading app data:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasPermission = (permissionName) => {
    return permissions.some(permission => permission.name === permissionName);
  };

  const refreshData = () => {
    loadData();
  };

  const value = {
    permissions,
    subscriptionInfo,
    loading,
    hasPermission,
    refreshPermissions: refreshData,
    refreshData,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyPermissions } from '../config/api';

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
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      const response = await getMyPermissions();
      if (response.success && response.permissions) {
        setPermissions(response.permissions);
      } else {
        setPermissions([]);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const hasPermission = (permissionName) => {
    return permissions.some(permission => permission.name === permissionName);
  };

  const refreshPermissions = () => {
    loadPermissions();
  };

  const value = {
    permissions,
    loading,
    hasPermission,
    refreshPermissions,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

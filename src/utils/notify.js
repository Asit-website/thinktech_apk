import { Platform } from 'react-native';
import { showToast } from './toastBus';
import React from 'react';
import { createRoot } from 'react-dom/client';

// Global notification state
let notificationRef = null;

export function setNotificationRef(ref) {
  notificationRef = ref;
}

export function notifySuccess(message, title = 'Success') {
  if (Platform.OS === 'android' && notificationRef) {
    notificationRef.show(title, message, 'success');
    return;
  }
  
  const ok = showToast({ type: 'success', title, message });
  if (!ok && Platform.OS !== 'android') {
    // Fallback for web only
    console.log(`✅ ${title}: ${message}`);
  }
}

export function notifyError(message, title = 'Error') {
  if (Platform.OS === 'android' && notificationRef) {
    notificationRef.show(title, message, 'error');
    return;
  }
  
  const ok = showToast({ type: 'error', title, message });
  if (!ok && Platform.OS !== 'android') {
    // Fallback for web only
    console.log(`❌ ${title}: ${message}`);
  }
}

export function notifyInfo(message, title = 'Info') {
  if (Platform.OS === 'android' && notificationRef) {
    notificationRef.show(title, message, 'info');
    return;
  }
  
  const ok = showToast({ type: 'info', title, message });
  if (!ok && Platform.OS !== 'android') {
    // Fallback for web only
    console.log(`ℹ️ ${title}: ${message}`);
  }
}

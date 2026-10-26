import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL = __DEV__
  ? 'http://localhost:4000'  // Local development
  : process.env.API_URL || 'https://backend.vetansutra.com';  // Production from EAS env or fallback

export { API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-App-Platform'] = 'mobile-apk';

    // Zero Trust device fingerprint generation and injection
    let deviceFingerprint = await AsyncStorage.getItem('device_fingerprint');
    if (!deviceFingerprint) {
      const chars = 'abcdef0123456789';
      let hex = '';
      for (let i = 0; i < 32; i++) {
        hex += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      deviceFingerprint = hex;
      await AsyncStorage.setItem('device_fingerprint', deviceFingerprint);
    }
    config.headers['x-device-fingerprint'] = deviceFingerprint;

    // Handle FormData requests - do NOT set Content-Type explicitly in React Native,
    // otherwise the boundary parameter is omitted and OkHttp crashes with ERR_NETWORK
    const isFormData = Boolean(
      config.data && (
        (typeof FormData !== 'undefined' && config.data instanceof FormData) ||
        config.data?._parts ||
        config.data?.constructor?.name === 'FormData' ||
        (typeof config.data?.append === 'function' && Array.isArray(config.data?._parts))
      )
    );

    if (isFormData) {
      console.log('FormData detected, deleting manual Content-Type so native layer injects boundary');
      if (config.headers) {
        if (typeof config.headers.delete === 'function') {
          config.headers.delete('Content-Type');
          config.headers.delete('content-type');
        } else {
          delete config.headers['Content-Type'];
          delete config.headers['content-type'];
        }
      }
      // Don't transform FormData
      config.transformRequest = [(data) => data];
      config.headers['Accept'] = 'application/json';
    } else {
      // Set Content-Type for JSON requests
      config.headers['Content-Type'] = 'application/json';
      config.headers['Accept'] = 'application/json';
    }

    console.log('Request config:', {
      url: config.url,
      method: config.method,
      baseURL: config.baseURL,
      contentType: config.headers?.['Content-Type'] || config.headers?.['content-type'] || 'auto-multipart',
      isFormData
    });

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Background refresh queue handling
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor for automatic transparent token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Trigger refresh only on 401 Unauthorized errors and if it's not a retry already
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If the refresh endpoint itself failed, clear credentials
      if (originalRequest.url && originalRequest.url.includes('/auth/refresh-mobile')) {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('refresh_token');
        await AsyncStorage.removeItem('user');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
        if (!storedRefreshToken) {
          throw new Error('Refresh token missing');
        }

        const resp = await axios.post(`${API_BASE_URL}/auth/refresh-mobile`, {
          refreshToken: storedRefreshToken
        });

        const { token, refreshToken } = resp.data;

        await AsyncStorage.setItem('auth_token', String(token));
        await AsyncStorage.setItem('refresh_token', String(refreshToken));

        originalRequest.headers.Authorization = `Bearer ${token}`;

        processQueue(null, token);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Check if the error is a temporary network issue
        const isNetworkError = !refreshError.response || 
                               refreshError.message?.includes('Network Error') || 
                               refreshError.code === 'ERR_NETWORK' ||
                               refreshError.code === 'ECONNABORTED';

        if (!isNetworkError) {
          // Only clear session when the server explicitly rejects the refresh token (e.g., expired or invalid)
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('user');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export async function sendOtp(phone) {
  const resp = await api.post('/auth/send-otp', { phone });
  return resp.data;
}

export async function getLatestOtpForPhone(phone) {
  const resp = await api.get(`/auth/otp/latest?phone=${encodeURIComponent(String(phone))}`);
  return resp.data;
}

export async function getMyGeneralInfo() {
  const resp = await api.get('/me/general');
  return resp.data;
}

export async function updateMyGeneralInfo(payload = {}) {
  const resp = await api.put('/me/general', payload);
  return resp.data;
}

export async function verifyOtp(phone, code) {
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
            console.log('Reverse geocode failed during verifyOtp:', e.message);
          }
        }
      }
    }
  } catch (e) {
    console.log('Failed to fetch location during verifyOtp:', e.message);
  }

  const resp = await api.post('/auth/verify-otp', {
    phone,
    code,
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    address: locationData.address,
    accuracy: locationData.accuracy
  });
  const data = resp.data;

  if (data?.success && data?.token) {
    await AsyncStorage.setItem('auth_token', String(data.token));
    if (data?.refreshToken) {
      await AsyncStorage.setItem('refresh_token', String(data.refreshToken));
    }
    if (data?.user) {
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
    }
  }

  return data;
}

export async function getAttendanceStatus() {
  const resp = await api.get('/attendance/status');
  return resp.data;
}

export async function getAttendanceHistory(month) {
  const qs = month ? `?month=${encodeURIComponent(String(month))}` : '';
  const resp = await api.get(`/attendance/history${qs}`);
  return resp.data;
}

export async function getAttendanceReport(date) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const resp = await api.get(`/attendance/report${qs}`);
  return resp.data; // This returns { success: true, data: {...} }
}

export async function getWeeklyAttendance(startDate, endDate) {
  const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}` : '';
  const resp = await api.get(`/attendance/weekly${qs}`);
  return resp.data; // This returns { success: true, data: {...} }
}

export async function getSessionSummary() {
  const resp = await api.get('/me/session-summary');
  return resp.data;
}

export async function getSessionEvents() {
  const resp = await api.get('/me/session-events');
  return resp.data;
}

export async function setMaxBreakDuration(maxBreakMinutes) {
  const resp = await api.put('/attendance/settings/max-break', { maxBreakMinutes });
  return resp.data;
}

export async function getMaxBreakDuration() {
  const resp = await api.get('/attendance/settings/max-break');
  return resp.data;
}

export async function punchInWithPhoto(photoUri, coords) {
  console.log('punchInWithPhoto called with URI:', photoUri);

  // If NO photo is provided, send clean JSON directly to avoid React Native Axios FormData boundary errors
  if (!photoUri) {
    const payload = {
      platform: Platform.OS,
    };
    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      payload.lat = coords.lat;
      payload.lng = coords.lng;
      if (typeof coords.accuracy === 'number') {
        payload.accuracyMeters = Math.round(coords.accuracy);
      }
      if (coords.address) {
        payload.address = String(coords.address);
      }
    }
    console.log('Dispatching clean JSON punch-in request...');
    const resp = await api.post('/attendance/punch-in', payload);
    return resp.data;
  }

  // When photo IS provided, prepare FormData
  const form = new FormData();
  form.append('platform', Platform.OS);

  if (Platform.OS === 'web') {
    const r = await fetch(photoUri);
    const blob = await r.blob();
    const file = new File([blob], 'punch-in.jpg', { type: blob.type || 'image/jpeg' });
    form.append('photo', file);
  } else {
    const fileName = photoUri.split('/').pop() || 'punch-in.jpg';
    form.append('photo', {
      uri: photoUri,
      name: fileName,
      type: 'image/jpeg',
    });
  }

  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    form.append('lat', String(coords.lat));
    form.append('lng', String(coords.lng));
    if (typeof coords.accuracy === 'number') {
      form.append('accuracyMeters', String(Math.round(coords.accuracy)));
    }
    if (coords.address) {
      form.append('address', String(coords.address));
    }
  }

  // Use native fetch directly for multipart to prevent Axios React Native boundary issues
  const token = await AsyncStorage.getItem('auth_token');
  const deviceFingerprint = await AsyncStorage.getItem('device_fingerprint');
  const fetchHeaders = {
    'Accept': 'application/json',
    'X-App-Platform': 'mobile-apk',
  };
  if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
  if (deviceFingerprint) fetchHeaders['x-device-fingerprint'] = deviceFingerprint;

  const fetchResp = await fetch(`${API_BASE_URL}/attendance/punch-in`, {
    method: 'POST',
    headers: fetchHeaders,
    body: form,
  });

  const data = await fetchResp.json();
  if (!fetchResp.ok) {
    const fallbackErr = new Error(data?.message || `HTTP ${fetchResp.status}`);
    fallbackErr.response = { status: fetchResp.status, data };
    throw fallbackErr;
  }
  return data;
}

export async function punchOutWithPhoto(photoUri, coords) {
  console.log('punchOutWithPhoto called with URI:', photoUri);

  // If NO photo is provided, send clean JSON directly
  if (!photoUri) {
    const payload = {
      platform: Platform.OS,
    };
    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      payload.lat = coords.lat;
      payload.lng = coords.lng;
      if (typeof coords.accuracy === 'number') {
        payload.accuracyMeters = Math.round(coords.accuracy);
      }
      if (coords.address) {
        payload.address = String(coords.address);
      }
    }
    console.log('Dispatching clean JSON punch-out request...');
    const resp = await api.post('/attendance/punch-out', payload);
    return resp.data;
  }

  // When photo IS provided, prepare FormData
  const form = new FormData();
  form.append('platform', Platform.OS);

  if (Platform.OS === 'web') {
    const r = await fetch(photoUri);
    const blob = await r.blob();
    const file = new File([blob], 'punch-out.jpg', { type: blob.type || 'image/jpeg' });
    form.append('photo', file);
  } else {
    const fileName = photoUri.split('/').pop() || 'punch-out.jpg';
    form.append('photo', {
      uri: photoUri,
      name: fileName,
      type: 'image/jpeg',
    });
  }

  if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    form.append('lat', String(coords.lat));
    form.append('lng', String(coords.lng));
    if (typeof coords.accuracy === 'number') {
      form.append('accuracyMeters', String(Math.round(coords.accuracy)));
    }
    if (coords.address) {
      form.append('address', String(coords.address));
    }
  }

  const token = await AsyncStorage.getItem('auth_token');
  const deviceFingerprint = await AsyncStorage.getItem('device_fingerprint');
  const fetchHeaders = {
    'Accept': 'application/json',
    'X-App-Platform': 'mobile-apk',
  };
  if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
  if (deviceFingerprint) fetchHeaders['x-device-fingerprint'] = deviceFingerprint;

  const fetchResp = await fetch(`${API_BASE_URL}/attendance/punch-out`, {
    method: 'POST',
    headers: fetchHeaders,
    body: form,
  });

  const data = await fetchResp.json();
  if (!fetchResp.ok) {
    const fallbackErr = new Error(data?.message || `HTTP ${fetchResp.status}`);
    fallbackErr.response = { status: fetchResp.status, data };
    throw fallbackErr;
  }
  return data;
}

export async function startBreak() {
  const resp = await api.post('/attendance/start-break');
  return resp.data;
}

export async function endBreak() {
  const resp = await api.post('/attendance/end-break');
  return resp.data;
}

export async function createLeaveRequest({ startDate, endDate, leaveType, reason, categoryKey }) {
  const resp = await api.post('/leave', { startDate, endDate, leaveType, reason, categoryKey });
  return resp.data;
}

export async function listMyLeaveRequests({ status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(String(status))}` : '';
  const resp = await api.get(`/leave/me${qs}`);
  return resp.data;
}

export async function cancelMyLeaveRequest(id) {
  const resp = await api.delete(`/leave/${encodeURIComponent(String(id))}`);
  return resp.data;
}

export async function listAllLeaveRequests({ status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(String(status))}` : '';
  const resp = await api.get(`/leave${qs}`);
  return resp.data;
}

export async function updateLeaveStatus(id, { status, note } = {}) {
  const resp = await api.patch(`/leave/${encodeURIComponent(String(id))}/status`, { status, note });
  return resp.data;
}

export async function getMyLeaveCategories(dateIso) {
  const qs = dateIso ? `?date=${encodeURIComponent(String(dateIso))}` : '';
  const resp = await api.get(`/leave/categories${qs}`);
  return resp.data;
}

export async function getMyWeeklyOffDates(start, end) {
  const qs = `?start=${encodeURIComponent(String(start))}&end=${encodeURIComponent(String(end))}`;
  const resp = await api.get(`/leave/weekly-off/my${qs}`);
  return resp.data;
}

export async function checkLeaveRange(start, end) {
  const qs = `?start=${encodeURIComponent(String(start))}&end=${encodeURIComponent(String(end))}`;
  const resp = await api.get(`/leave/check-range${qs}`);
  return resp.data;
}

export async function claimLeaveEncashment({ categoryKey, days, monthKey }) {
  const resp = await api.post('/leave/encash/claim', { categoryKey, days, monthKey });
  return resp.data;
}

export async function listMyLeaveEncashments() {
  const resp = await api.get('/leave/encash/claims/me'); // I should probably add this route to backend if I want staff to see their claims
  return resp.data;
}

export async function getMyProfile() {
  const resp = await api.get('/me/profile');
  return resp.data;
}

export async function getMyBankDetails() {
  const resp = await api.get('/me/bank');
  return resp.data;
}

export async function updateMyBankDetails({
  bankAccountHolderName,
  bankAccountNumber,
  bankIfsc,
  bankName,
  bankBranch,
  upiId,
} = {}) {
  const resp = await api.put('/me/bank', {
    bankAccountHolderName,
    bankAccountNumber,
    bankIfsc,
    bankName,
    bankBranch,
    upiId,
  });
  return resp.data;
}

export async function updateMyProfile({ name, email, designation, department } = {}) {
  const resp = await api.put('/me/profile', { name, email, designation, department });
  return resp.data;
}

export async function uploadMyProfilePhoto(photoUri) {
  const form = new FormData();

  if (Platform.OS === 'web') {
    const r = await fetch(photoUri);
    const blob = await r.blob();
    const file = new File([blob], 'profile.jpg', { type: blob.type || 'image/jpeg' });
    form.append('photo', file);
  } else {
    form.append('photo', {
      uri: photoUri,
      name: 'profile.jpg',
      type: 'image/jpeg',
    });
  }

  const resp = await api.post('/me/profile/photo', form);
  return resp.data;
}

export async function listRequiredDocuments() {
  const resp = await api.get('/documents/required');
  return resp.data;
}

export async function uploadStaffDocument(documentTypeId, file) {
  console.log('uploadStaffDocument called with:', {
    documentTypeId,
    fileName: file?.name,
    fileType: file?.type,
    hasUri: !!file?.uri
  });

  const form = new FormData();

  const fileUri = file?.uri;
  const fileName = file?.name || 'document';
  const fileType = file?.type || file?.mimeType || 'application/octet-stream';

  if (!fileUri) {
    throw new Error('file uri missing');
  }

  if (Platform.OS === 'web') {
    const r = await fetch(fileUri);
    const blob = await r.blob();
    const webFile = new File([blob], fileName, { type: blob.type || fileType });
    form.append('file', webFile);
    console.log('Web staff document processed:', fileName);
  } else {
    // Fix for mobile camera picker - same as order form proof
    const mobileFileName = fileUri.split('/').pop() || fileName;
    form.append('file', {
      uri: fileUri,
      name: mobileFileName,
      type: fileType,
    });
    console.log('Mobile staff document processed:', mobileFileName);
  }

  console.log('FormData created for staff document, type:', form.constructor.name);
  console.log('FormData parts:', form._parts);

  try {
    console.log('Making staff document upload API request...');
    const resp = await api.post(`/documents/${encodeURIComponent(String(documentTypeId))}/upload`, form);
    console.log('Staff document upload API response:', resp.data);
    return resp.data;
  } catch (error) {
    console.error('Staff document upload error:', error);
    throw error;
  }
}

// Sales
export async function getMyPermissions() {
  const resp = await api.get('/mobile/roles/my-permissions-open');
  return resp.data;
}

export async function getSalesSummary(dateIso) {
  const qs = dateIso ? `?date=${encodeURIComponent(String(dateIso))}` : '';
  const resp = await api.get(`/sales/summary${qs}`);
  return resp.data;
}

export async function getWeeklySales(startDate, endDate) {
  const qs = startDate ? `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}` : '';
  const resp = await api.get(`/sales/weekly${qs}`);
  return resp.data;
}

// Salary Template APIs
export async function getSalaryTemplates() {
  const resp = await api.get('/salary-templates');
  return resp.data;
}

export async function getSalaryTemplate(id) {
  const resp = await api.get(`/salary-templates/${id}`);
  return resp.data;
}

export async function calculateSalary(templateId, attendanceData) {
  const resp = await api.post(`/salary-templates/${templateId}/calculate`, { attendanceData });
  return resp.data;
}

// User Profile APIs
export async function getMe() {
  const resp = await api.get('/me');
  return resp.data;
}

// Staff Management APIs
export async function getStaffSalaryDetails(staffId) {
  const resp = await api.get(`/admin/staff/${staffId}/salary-details`);
  return resp.data;
}

export async function updateStaffSalaryTemplate(staffId, salaryTemplateId) {
  const resp = await api.put(`/admin/staff/${staffId}/salary-template`, { salaryTemplateId });
  return resp.data;
}

export async function recalculateStaffSalary(staffId, attendanceData) {
  const resp = await api.post(`/admin/staff/${staffId}/recalculate-salary`, attendanceData);
  return resp.data;
}

export async function sendClientOtp(phone) {
  console.log('sendClientOtp called with phone:', phone);
  const resp = await api.post('/sales/send-client-otp', { phone });
  return resp.data;
}

export async function submitVisitForm({
  visitDate,
  salesPerson,
  visitType,
  clientName,
  phone,
  clientType,
  location,
  attachments = [],
  clientOtp,
  clientSignature,
  checkInLat,
  checkInLng,
  checkInAltitude,
  checkInAddress,
  assignedJobId
} = {}) {
  console.log('submitVisitForm called with:', {
    visitDate,
    salesPerson,
    visitType,
    clientName,
    phone,
    clientType,
    location,
    attachmentsCount: attachments.length,
    clientOtp,
    hasSignature: !!clientSignature,
    assignedJobId
  });

  const form = new FormData();
  if (visitDate) form.append('visitDate', typeof visitDate === 'string' ? visitDate : new Date(visitDate).toISOString());
  if (salesPerson) form.append('salesPerson', salesPerson);
  if (visitType) form.append('visitType', visitType);
  if (clientName) form.append('clientName', clientName);
  if (phone) form.append('phone', phone);
  if (clientType) form.append('clientType', clientType);
  if (location) form.append('location', location);
  if (clientOtp) form.append('clientOtp', clientOtp);
  if (typeof checkInLat === 'number') form.append('checkInLat', String(checkInLat));
  if (typeof checkInLng === 'number') form.append('checkInLng', String(checkInLng));
  if (typeof checkInAltitude === 'number') form.append('checkInAltitude', String(checkInAltitude));
  if (checkInAddress) form.append('checkInAddress', String(checkInAddress));
  if (assignedJobId) form.append('assignedJobId', String(assignedJobId));

  // Handle signature - exact same pattern as order proof
  if (clientSignature && clientSignature.uri) {
    if (Platform.OS === 'web') {
      console.log('Processing signature for web...');
      const r = await fetch(clientSignature.uri);
      const blob = await r.blob();
      const file = new File([blob], 'signature.jpg', { type: blob.type || 'image/jpeg' });
      form.append('clientSignature', file);
      console.log('Web signature processed, blob size:', blob.size);
    } else {
      console.log('Processing signature for mobile...');
      // Exact same pattern as order proof - use proof.uri.split('/').pop()
      const fileName = clientSignature.uri.split('/').pop() || 'signature.jpg';
      form.append('clientSignature', {
        uri: clientSignature.uri,
        name: fileName,
        type: 'image/jpeg',
      });
      console.log('Mobile signature processed, filename:', fileName);
    }
  }

  console.log('FormData created for visit, type:', form.constructor.name);
  console.log('FormData parts:', form._parts);
  console.log('Is FormData instance:', form instanceof FormData);

  try {
    console.log('Making visit form API request...');
    const resp = await api.post('/sales/visit', form);
    console.log('Visit form API response:', resp.data);
    return resp.data;
  } catch (error) {
    console.error('Visit form API error:', error);
    console.error('Error response:', error.response);
    console.error('Error config:', error.config);

    // Direct fetch fallback for FormData
    if (error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error') || error.message?.includes('Network request failed')) {
      console.log('Trying visit form with direct fetch fallback...');
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const deviceFingerprint = await AsyncStorage.getItem('device_fingerprint');
        const fetchHeaders = {
          'Accept': 'application/json',
          'X-App-Platform': 'mobile-apk',
        };
        if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
        if (deviceFingerprint) fetchHeaders['x-device-fingerprint'] = deviceFingerprint;

        const fetchResp = await fetch(`${API_BASE_URL}/sales/visit`, {
          method: 'POST',
          headers: fetchHeaders,
          body: form,
        });

        const data = await fetchResp.json();
        console.log('Direct fetch visit form response:', data);
        if (!fetchResp.ok) {
          const fallbackErr = new Error(data?.message || `HTTP ${fetchResp.status}`);
          fallbackErr.response = { status: fetchResp.status, data };
          throw fallbackErr;
        }
        return data;
      } catch (fallbackError) {
        console.error('Direct visit fetch fallback error:', fallbackError);
        throw (fallbackError.response ? fallbackError : error);
      }
    }

    throw error;
  }
}

// Assigned jobs & targets
export async function listMyAssignedJobs() {
  const resp = await api.get('/sales/assigned_jobs');
  return resp.data;
}

export async function listMyClients() {
  const resp = await api.get('/sales/my-clients');
  return resp.data;
}

export async function getAssignedJobDetail(id) {
  const resp = await api.get(`/sales/assigned-jobs/${encodeURIComponent(String(id))}`);
  return resp.data;
}

export async function updateAssignedJobStatus(id, status, opts = {}) {
  const body = { status };
  if (opts && typeof opts.startLat === 'number') body.startLat = opts.startLat;
  if (opts && typeof opts.startLng === 'number') body.startLng = opts.startLng;
  if (opts && typeof opts.startAccuracy === 'number') body.startAccuracy = opts.startAccuracy;
  if (opts && typeof opts.endLat === 'number') body.endLat = opts.endLat;
  if (opts && typeof opts.endLng === 'number') body.endLng = opts.endLng;
  if (opts && typeof opts.endAccuracy === 'number') body.endAccuracy = opts.endAccuracy;
  if (opts && opts.stopJob === true) body.stopJob = 1;
  const resp = await api.put(`/sales/assigned-jobs/${encodeURIComponent(String(id))}/status`, body);
  return resp.data;
}

export async function getCurrentTarget(period = 'daily') {
  const resp = await api.get(`/sales/targets/current?period=${encodeURIComponent(String(period))}`);
  return resp.data;
}

export async function getCurrentIncentive(period = 'daily') {
  const resp = await api.get(`/sales/incentives/current?period=${encodeURIComponent(String(period))}`);
  return resp.data;
}

export async function listOrderProducts() {
  const resp = await api.get('/sales/order-products');
  return resp.data;
}

// Orders
export async function submitOrder({
  orderDate,
  paymentMethod,
  remarks,
  items = [],
  assignedJobId,
  clientId,
  phone,
  proof,
  checkInLat,
  checkInLng,
  checkInAltitude,
  checkInAddress,
} = {}) {
  console.log('submitOrder called with:', {
    orderDate,
    paymentMethod,
    remarks,
    itemsCount: items.length,
    assignedJobId,
    clientId,
    phone,
    hasProof: !!proof
  });

  const form = new FormData();
  if (orderDate) form.append('orderDate', typeof orderDate === 'string' ? orderDate : new Date(orderDate).toISOString());
  if (paymentMethod) form.append('paymentMethod', paymentMethod);
  if (remarks) form.append('remarks', remarks);
  if (Array.isArray(items)) form.append('items', JSON.stringify(items));
  if (assignedJobId) form.append('assignedJobId', String(assignedJobId));
  if (clientId) form.append('clientId', String(clientId));
  if (phone) form.append('phone', phone);
  if (typeof checkInLat === 'number') form.append('checkInLat', String(checkInLat));
  if (typeof checkInLng === 'number') form.append('checkInLng', String(checkInLng));
  if (typeof checkInAltitude === 'number') form.append('checkInAltitude', String(checkInAltitude));
  if (checkInAddress) form.append('checkInAddress', String(checkInAddress));

  if (proof && proof.uri) {
    const name = proof.name || 'proof.jpg';
    const type = proof.type || proof.mimeType || 'image/jpeg';

    if (Platform.OS === 'web') {
      const r = await fetch(proof.uri);
      const blob = await r.blob();
      const webFile = new File([blob], name, { type: blob.type || type });
      form.append('proof', webFile);
      console.log('Web proof processed:', name);
    } else {
      // Fix for mobile camera picker - same as punch-in/punch-out
      const fileName = proof.uri.split('/').pop() || name;
      form.append('proof', {
        uri: proof.uri,
        name: fileName,
        type: type,
      });
      console.log('Mobile proof processed:', fileName);
    }
  }

  console.log('FormData created for order, type:', form.constructor.name);
  console.log('FormData parts:', form._parts);
  console.log('Is FormData instance:', form instanceof FormData);

  try {
    console.log('Making order API request...');
    const resp = await api.post('/sales/orders', form);
    console.log('Order API response:', resp.data);
    return resp.data;
  } catch (error) {
    console.error('Order API error:', error);
    console.error('Error response:', error.response);
    console.error('Error config:', error.config);

    // Direct fetch fallback for FormData
    if (error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error') || error.message?.includes('Network request failed') || error.response?.status === 415) {
      console.log('Trying order with direct fetch fallback...');
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const deviceFingerprint = await AsyncStorage.getItem('device_fingerprint');
        const fetchHeaders = {
          'Accept': 'application/json',
          'X-App-Platform': 'mobile-apk',
        };
        if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
        if (deviceFingerprint) fetchHeaders['x-device-fingerprint'] = deviceFingerprint;

        const fetchResp = await fetch(`${API_BASE_URL}/sales/orders`, {
          method: 'POST',
          headers: fetchHeaders,
          body: form,
        });

        const data = await fetchResp.json();
        console.log('Direct fetch order response:', data);
        if (!fetchResp.ok) {
          const fallbackErr = new Error(data?.message || `HTTP ${fetchResp.status}`);
          fallbackErr.response = { status: fetchResp.status, data };
          throw fallbackErr;
        }
        return data;
      } catch (fallbackError) {
        console.error('Direct order fetch fallback error:', fallbackError);
        throw (fallbackError.response ? fallbackError : error);
      }
    }

    throw error;
  }
}

// Expenses (mobile: staff submit expenses)
export async function submitExpense({ expenseType, expenseDate, expenses = [] } = {}) {
  const form = new FormData();
  if (expenseType) form.append('expenseType', expenseType);
  if (expenseDate) form.append('expenseDate', typeof expenseDate === 'string' ? expenseDate : new Date(expenseDate).toISOString());

  const serializedItems = await Promise.all(expenses.map(async (exp, index) => {
    const item = {
      expenseType: exp.expenseType || 'Other',
      amount: Number(exp.amount || 0),
      billNumber: exp.billNumber || null,
      description: exp.description || null,
    };
    if (exp.expenseType === 'Travel') {
      item.travelFrom = exp.travelFrom || null;
      item.travelTo = exp.travelTo || null;
      item.mode = exp.mode || null;
    }
    const attachment = exp.attachment;
    if (attachment && attachment.uri) {
      const name = attachment.name || (attachment.uri.split('/').pop() || 'attachment');
      const type = attachment.type || 'application/octet-stream';
      if (Platform.OS === 'web') {
        const r = await fetch(attachment.uri);
        const blob = await r.blob();
        const webFile = new File([blob], name, { type: blob.type || type });
        form.append(`attachment_${index}`, webFile);
      } else {
        form.append(`attachment_${index}`, { uri: attachment.uri, name, type });
      }
    }
    return item;
  }));

  form.append('items', JSON.stringify(serializedItems));

  const resp = await api.post('/me/expenses', form);
  return resp.data;
}

export async function updateExpense(id, { expenseType, expenseDate, expenses = [], amount, billNumber, description, attachment, travelFrom, travelTo, mode } = {}) {
  const form = new FormData();
  if (expenseType) form.append('expenseType', expenseType);
  if (expenseDate) form.append('expenseDate', typeof expenseDate === 'string' ? expenseDate : new Date(expenseDate).toISOString());

  if (Array.isArray(expenses) && expenses.length > 0) {
    const serializedItems = await Promise.all(expenses.map(async (exp, index) => {
      const item = {
        expenseType: exp.expenseType || 'Other',
        amount: Number(exp.amount || 0),
        billNumber: exp.billNumber || null,
        description: exp.description || null,
      };
      if (exp.expenseType === 'Travel') {
        item.travelFrom = exp.travelFrom || null;
        item.travelTo = exp.travelTo || null;
        item.mode = exp.mode || null;
      }
      const att = exp.attachment;
      if (att && att.uri) {
        const name = att.name || (att.uri.split('/').pop() || 'attachment');
        const type = att.type || 'application/octet-stream';
        if (Platform.OS === 'web') {
          const r = await fetch(att.uri);
          const blob = await r.blob();
          const webFile = new File([blob], name, { type: blob.type || type });
          form.append(`attachment_${index}`, webFile);
        } else {
          form.append(`attachment_${index}`, { uri: att.uri, name, type });
        }
      }
      return item;
    }));
    form.append('items', JSON.stringify(serializedItems));
  } else {
    if (amount !== undefined) form.append('amount', String(Number(amount) || 0));
    if (billNumber) form.append('billNumber', billNumber);
    if (description) form.append('description', description);
    if (travelFrom) form.append('travelFrom', travelFrom);
    if (travelTo) form.append('travelTo', travelTo);
    if (mode) form.append('mode', mode);

    if (attachment && attachment.uri) {
      const name = attachment.name || (attachment.uri.split('/').pop() || 'attachment');
      const type = attachment.type || 'application/octet-stream';
      if (Platform.OS === 'web') {
        const r = await fetch(attachment.uri);
        const blob = await r.blob();
        const webFile = new File([blob], name, { type: blob.type || type });
        form.append('attachment', webFile);
      } else {
        form.append('attachment', { uri: attachment.uri, name, type });
      }
    }
  }

  const resp = await api.put(`/me/expenses/${id}`, form);
  return resp.data;
}

export async function getMyExpenses() {
  const resp = await api.get('/me/expenses');
  return resp.data;
}

// Activities
export async function listMyActivities() {
  const resp = await api.get('/activities/me');
  return resp.data;
}

export async function createActivity(data) {
  const resp = await api.post('/activities', data);
  return resp.data;
}

export async function getSubscriptionInfo() {
  const resp = await api.get('/subscription/subscription-info');
  return resp.data;
}

export async function updateActivity(id, data) {
  const resp = await api.patch(`/activities/${id}`, data);
  return resp.data;
}

export async function updateActivityStatus(id, status, remarks) {
  // Normalize status to uppercase for backend consistency
  const normalizedStatus = String(status).toUpperCase().replace(/\s+/g, '_');
  const resp = await api.patch(`/activities/${id}/status`, { status: normalizedStatus, remarks });
  return resp.data;
}

export async function transferActivity(id, targetUserId) {
  const resp = await api.patch(`/activities/${id}/transfer`, { targetUserId });
  return resp.data;
}

// Tickets
export async function listMyTickets() {
  const resp = await api.get('/tickets/my');
  return resp.data;
}

export async function createTicket(data) {
  const resp = await api.post('/tickets', data);
  return resp.data;
}

export async function updateTicket(id, data) {
  const resp = await api.patch(`/tickets/${id}`, data);
  return resp.data;
}

export async function updateTicketStatus(id, { status, remarks }) {
  const resp = await api.patch(`/tickets/${id}/status`, { status, remarks });
  return resp.data;
}

export async function listStaffForAllocation() {
  const resp = await api.get('/tickets/staff');
  return resp.data;
}

// Meetings
export async function listMyMeetings() {
  const resp = await api.get('/meetings/me');
  return resp.data;
}

export async function createMeeting(data) {
  const resp = await api.post('/meetings', data);
  return resp.data;
}

export async function updateMeeting(id, data) {
  const resp = await api.put(`/meetings/${encodeURIComponent(String(id))}`, data);
  return resp.data;
}

export async function updateMeetingStatus(id, status, remarks) {
  const resp = await api.patch(`/meetings/${id}/status`, { status, remarks });
  return resp.data;
}

export async function listAllStaff() {
  const resp = await api.get('/me/staff-list');
  return resp.data;
}

export async function askAI(messages) {
  const resp = await api.post('/ai/ask', { messages });
  return resp.data;
}

export async function listMyVisits() {
  const resp = await api.get('/sales/my-visits');
  return resp.data;
}

export async function listMyOrders() {
  const resp = await api.get('/sales/my-orders');
  return resp.data;
}

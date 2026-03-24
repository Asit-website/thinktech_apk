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

    // Handle FormData requests - set multipart/form-data explicitly
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      console.log('FormData detected, setting multipart/form-data');
      // Set explicit multipart/form-data Content-Type
      config.headers['Content-Type'] = 'multipart/form-data';
      // Don't transform FormData
      config.transformRequest = [(data) => data];
      // Set Accept header
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
      contentType: config.headers['Content-Type'],
      isFormData: config.data instanceof FormData
    });

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user');
      // Navigate to login - handled by AuthContext
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
  const resp = await api.post('/auth/verify-otp', { phone, code });
  const data = resp.data;

  if (data?.success && data?.token) {
    await AsyncStorage.setItem('auth_token', String(data.token));
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

  const form = new FormData();

  if (Platform.OS === 'web') {
    console.log('Processing photo for web...');
    const r = await fetch(photoUri);
    const blob = await r.blob();
    const file = new File([blob], 'punch-in.jpg', { type: blob.type || 'image/jpeg' });
    form.append('photo', file);
    console.log('Web photo processed, blob size:', blob.size);
  } else {
    console.log('Processing photo for mobile...');
    // Fix for mobile camera picker
    const fileName = photoUri.split('/').pop() || 'punch-in.jpg';
    form.append('photo', {
      uri: photoUri,
      name: fileName,
      type: 'image/jpeg',
    });
    console.log('Mobile photo processed, filename:', fileName);
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
    console.log('Location data added to form');
  }

  try {
    console.log('Making punch-in API request...');
    const resp = await api.post('/attendance/punch-in', form);
    console.log('Punch-in API response:', resp.data);
    return resp.data;
  } catch (error) {
    // Try with explicit multipart content type as fallback (this is crucial!)
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const directApi = axios.create({
          baseURL: API_BASE_URL,
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          timeout: 30000,
        });

        const resp = await directApi.post('/attendance/punch-in', form);
        console.log('Direct API response:', resp.data);
        return resp.data;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }

    throw error;
  }
}

export async function punchOutWithPhoto(photoUri, coords) {
  console.log('punchOutWithPhoto called with URI:', photoUri);

  const form = new FormData();

  if (Platform.OS === 'web') {
    console.log('Processing photo for web...');
    const r = await fetch(photoUri);
    const blob = await r.blob();
    const file = new File([blob], 'punch-out.jpg', { type: blob.type || 'image/jpeg' });
    form.append('photo', file);
    console.log('Web photo processed, blob size:', blob.size);
  } else {
    console.log('Processing photo for mobile...');
    // Fix for mobile camera picker
    const fileName = photoUri.split('/').pop() || 'punch-out.jpg';
    form.append('photo', {
      uri: photoUri,
      name: fileName,
      type: 'image/jpeg',
    });
    console.log('Mobile photo processed, filename:', fileName);
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
    console.log('Location data added to form');
  }

  try {
    console.log('Making punch-out API request...');
    const resp = await api.post('/attendance/punch-out', form);
    console.log('Punch-out API response:', resp.data);
    return resp.data;
  } catch (error) {
    // Try with explicit multipart content type as fallback (this is crucial!)
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const directApi = axios.create({
          baseURL: API_BASE_URL,
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          timeout: 30000,
        });

        const resp = await directApi.post('/attendance/punch-out', form);
        console.log('Direct punch-out API response:', resp.data);
        return resp.data;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }

    throw error;
  }
}

export async function pingLocation({ lat, lng, accuracy }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return { success: false };
  const resp = await api.post('/attendance/location/ping', {
    lat,
    lng,
    accuracyMeters: typeof accuracy === 'number' ? Math.round(accuracy) : undefined,
  });
  return resp.data;
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

    // Try with explicit multipart content type as fallback (same as punch-in)
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      console.log('Trying visit form with explicit multipart content type...');
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const directApi = axios.create({
          baseURL: API_BASE_URL,
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          timeout: 30000,
        });

        const resp = await directApi.post('/sales/visit', form);
        console.log('Direct visit form API response:', resp.data);
        return resp.data;
      } catch (fallbackError) {
        console.error('Direct visit form API also failed:', fallbackError);
        console.error('Fallback error response:', fallbackError.response);
        throw fallbackError;
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

    // Try with explicit multipart content type as fallback (this is crucial!)
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error') || error.response?.status === 415) {
      console.log('Trying order with explicit multipart content type...');
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const directApi = axios.create({
          baseURL: API_BASE_URL,
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          timeout: 30000,
        });

        const resp = await directApi.post('/sales/orders', form);
        console.log('Direct order API response:', resp.data);
        return resp.data;
      } catch (fallbackError) {
        console.error('Direct order API also failed:', fallbackError);
        console.error('Fallback error response:', fallbackError.response);
        throw fallbackError;
      }
    }

    throw error;
  }
}

// Expenses (mobile: staff submit expenses)
export async function submitExpense({ expenseType, expenseDate, amount, billNumber, description, attachment } = {}) {
  const form = new FormData();
  if (expenseType) form.append('expenseType', expenseType);
  if (expenseDate) form.append('expenseDate', typeof expenseDate === 'string' ? expenseDate : new Date(expenseDate).toISOString());
  if (amount !== undefined) form.append('amount', String(Number(amount) || 0));
  if (billNumber) form.append('billNumber', billNumber);
  if (description) form.append('description', description);

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

  const resp = await api.post('/me/expenses', form);
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
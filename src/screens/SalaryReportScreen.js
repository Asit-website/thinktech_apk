import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Dimensions } from 'react-native';
import api, { getMe, getAttendanceHistory } from '../config/api';
// Using a simpler approach without jsPDF for React Native compatibility

const { width: screenWidth } = Dimensions.get('window');

// Normalize salary data from /me/salary-compute or /me
// Normalize salary data from /me/salary-compute or /me
function extractFromUser(user) {
  const parseMaybe = (v) => {
    if (!v) return v;
    if (typeof v !== 'string') return v;
    try { v = JSON.parse(v); } catch { return v; }
    if (typeof v === 'string') {
      try { v = JSON.parse(v); } catch { }
    }
    return v;
  };

  const norm = (s = '') => s.toLowerCase().replace(/[_\s]/g, '');

  let tpl = user?.salaryTemplate;
  let tplEarnKeys = null;
  let tplDedKeys = null;
  if (tpl) {
    try {
      const e = parseMaybe(tpl.earnings) || [];
      const d = parseMaybe(tpl.deductions) || [];
      tplEarnKeys = e.map(it => it.name || it.key).filter(Boolean).filter(k => !norm(k).includes('employer'));
      tplDedKeys = d.map(it => it.name || it.key).filter(Boolean).filter(k => !norm(k).includes('employer'));
    } catch(e){}
  }

  let sv = parseMaybe(user?.salaryValues || user?.salary_values || user?.salaryDetails || user?.salary_details || null);

  let earnings = {};
  let deductions = {};
  let incentives = {};

  if (sv && typeof sv === 'object' && (sv.earnings || sv.deductions || sv.incentives)) {
    earnings = (sv.earnings && typeof sv.earnings === 'object') ? sv.earnings : {};
    deductions = (sv.deductions && typeof sv.deductions === 'object') ? sv.deductions : {};
    incentives = (sv.incentives && typeof sv.incentives === 'object') ? sv.incentives : {};
  } else {
    // extract from flat user object or defaults
    const pick = (k) => Number(user?.[k]) || 0;
    earnings = {
      basic_salary: pick('basic_salary'),
      hra: pick('hra'),
      da: pick('da'),
      special_allowance: pick('special_allowance'),
      conveyance_allowance: pick('conveyance_allowance'),
      medical_allowance: pick('medical_allowance'),
      telephone_allowance: pick('telephone_allowance'),
      other_allowances: pick('other_allowances'),
    };
    deductions = {
      provident_fund: pick('provident_fund'),
      esi: pick('esi'),
      professional_tax: pick('professional_tax'),
      tds: pick('tds'),
      other_deductions: pick('other_deductions'),
    };
  }

  const filterFields = (obj, tplKeys) => {
    const res = {};
    Object.entries(obj).forEach(([k, v]) => {
      const nk = norm(k);
      const inTpl = tplKeys ? tplKeys.some(tk => norm(tk) === nk) : false;
      
      // CRITICAL FIX: Only show if non-zero OR it's explicitly in the template
      if (Number(v) !== 0 || inTpl) {
        res[k] = v;
      }
    });
    return res;
  };

  const filteredEarnings = filterFields(earnings, tplEarnKeys);
  const filteredDeductions = filterFields(deductions, tplDedKeys);

  const sum = (o) => Object.values(o || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalEarnings = sum(filteredEarnings);
  const totalIncentives = sum(incentives);
  const totalDeductions = sum(filteredDeductions);
  const grossSalary = totalEarnings + totalIncentives;
  const netSalary = grossSalary - totalDeductions;

  return {
    earnings: filteredEarnings, deductions: filteredDeductions, incentives,
    totalEarnings, totalIncentives, totalDeductions,
    grossSalary, netSalary,
    tplEarnKeys, tplDedKeys
  };
}

export default function SalaryReportScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showNativeMonthPicker, setShowNativeMonthPicker] = useState(false);
  const [salaryData, setSalaryData] = useState({
    earnings: {},
    incentives: {},
    deductions: {},
    grossSalary: 0,
    netSalary: 0,
    finalNetSalary: 0,
    paymentStatus: 'DUE',
    paidAmount: 0
  });
  const [salaryTemplate, setSalaryTemplate] = useState(null);
  const [staffStartMonth, setStaffStartMonth] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasAnyAttendance, setHasAnyAttendance] = useState(true);
  const [earliestMonth, setEarliestMonth] = useState(null);

  useEffect(() => {
    const fetchRange = async () => {
      try {
        const res = await api.get('/me/salary-history-range');
        if (res.data?.success && res.data.earliestMonth) {
          setEarliestMonth(res.data.earliestMonth);
        }
      } catch (e) {
        console.error('Error fetching range:', e);
      }
    };
    fetchRange();
  }, []);

  useEffect(() => {
    fetchSalaryData();
  }, [selectedDate]);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const currentMonthStart = monthStart(new Date());
  const selectedMonthStart = monthStart(selectedDate);
  const canGoPrevMonth = (() => {
    const limit = earliestMonth ? new Date(earliestMonth) : new Date(new Date().getFullYear() - 3, 0, 1);
    return selectedMonthStart > monthStart(limit);
  })();
  const canGoNextMonth = selectedMonthStart < currentMonthStart;

  const prevMonth = () => {
    if (!canGoPrevMonth) return;
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const nextMonth = () => {
    if (!canGoNextMonth) return;
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const selectMonth = (date) => {
    setSelectedDate(new Date(date));
  };

  const handleWebDateChange = (dateStr) => {
    const newDate = new Date(dateStr);
    setSelectedDate(newDate);
  };

  const handleNativeDateChange = (event, selectedDate) => {
    setShowNativePicker(false);
    if (event.type === 'set' && selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const handleWebMonthChange = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const newDate = new Date(year, month - 1, 1);
    const limit = earliestMonth ? new Date(earliestMonth) : new Date(new Date().getFullYear() - 3, 0, 1);
    if (monthStart(newDate) < monthStart(limit)) return;
    if (monthStart(newDate) > currentMonthStart) return;
    setSelectedDate(newDate);
  };

  const handleNativeMonthChange = (event, selectedDate) => {
    setShowNativeMonthPicker(false);
    if (event.type === 'set' && selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const openMonthPicker = () => {
    if (Platform.OS === 'web') {
      setShowMonthPicker(true);
    } else {
      setShowNativeMonthPicker(true);
    }
  };

  const fetchSalaryData = async () => {
    setIsLoading(true);
    try {
      // Base user info (template)
      const userResponse = await getMe();
      const user = userResponse?.success ? userResponse.user : null;
      if (user) {
        setSalaryTemplate(user.salaryTemplate || null);
        const candidates = [
          user?.profile?.dateOfJoining,
          user?.createdAt,
          user?.profile?.createdAt,
        ].filter(Boolean);
        let found = null;
        for (const c of candidates) {
          const d = new Date(c);
          if (!Number.isNaN(d.getTime())) {
            found = new Date(d.getFullYear(), d.getMonth(), 1);
            break;
          }
        }
        setStaffStartMonth(found);
      }

      // Unified compute for the selected month
      const y = selectedDate.getFullYear();
      const mIdx = selectedDate.getMonth(); // 0-11
      const ym = `${y}-${String(mIdx + 1).padStart(2, '0')}`;

      const comp = await api.get('/me/salary-compute', { params: { monthKey: ym } });
      if (comp?.data?.success) {
        const e = comp.data.earnings || {};
        const i = comp.data.incentives || {};
        const d = comp.data.deductions || {};
        const t = comp.data.totals || {};
        const s = comp.data.attendanceSummary || {};
        // Use recomputed totals from backend (already summed from actual earnings/deductions)
        const sumObj = (o) => Object.values(o || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
        const totalEarnings = Number(t.totalEarnings ?? sumObj(e));
        const totalIncentives = Number(t.totalIncentives ?? sumObj(i));
        const totalDeductions = Number(t.totalDeductions ?? sumObj(d));
        const grossSalary = Number(t.grossSalary ?? (totalEarnings + totalIncentives));
        const netSalary = Number(t.netSalary ?? (grossSalary - totalDeductions));

        const base = user ? extractFromUser(user) : { earnings: {}, incentives: {}, deductions: {}, grossSalary: 0, netSalary: 0 };
        
        // Final template keys from base (respecting the primary template)
        const finalTplEarnKeys = base.tplEarnKeys || Object.keys(e);
        const finalTplDedKeys = base.tplDedKeys || Object.keys(d);

        // Apply filtering to backend response
        const norm = (s = '') => s.toLowerCase().replace(/[_\s]/g, '');
        const filter = (obj, keys) => {
          const r = {};
          Object.entries(obj).forEach(([k, v]) => {
            if (Number(v) !== 0 || (keys && keys.some(tk => norm(tk) === norm(k)))) {
              r[k] = v;
            }
          });
          return r;
        };

        const filteredE = filter(e, finalTplEarnKeys);
        const filteredD = filter(d, finalTplDedKeys);

        setSalaryData({
          earnings: filteredE,
          incentives: i,
          deductions: filteredD,
          grossSalary,
          netSalary,
          finalNetSalary: netSalary,
          totalEarnings,
          totalIncentives,
          totalDeductions,
          attendanceSummary: s,
          ratio: Number(t.ratio ?? s.ratio ?? 1),
          isGenerated: comp.data.isGenerated === true,
          payslipPath: comp.data.payslipPath,
          paymentStatus: comp.data.paymentStatus || 'DUE',
          paidAmount: comp.data.paidAmount || 0,
          tplEarnKeys: finalTplEarnKeys,
          tplDedKeys: finalTplDedKeys,
        });

        // For past months, only zero if absolutely no payable indicators
        const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
        const payableUnits = Number(s.ratio || 0) * daysInMonth;
        const today = new Date();
        const isPastMonth = (y < today.getFullYear()) || (y === today.getFullYear() && mIdx < today.getMonth());
        setHasAnyAttendance(isPastMonth ? payableUnits > 0 : true);
      } else {
        // fallback to base
        const base = user ? extractFromUser(user) : { earnings: {}, incentives: {}, deductions: {}, grossSalary: 0, netSalary: 0 };
        setSalaryData({
          ...base,
          finalNetSalary: base.netSalary,
          attendanceSummary: {},
          ratio: 0,
        });
        setHasAnyAttendance(true);
      }
    } catch (error) {
      console.error('Error fetching salary data:', error);
      setHasAnyAttendance(true);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    }).format(Number(amount || 0));
  };

  const openNotifications = () => {
    setNotifOpen(true);
  };

  const onMarkRead = async () => {
    setNotifOpen(false);
  };

  const handleDownloadReport = async () => {
    try {
      if (salaryData && salaryData.isGenerated && salaryData.payslipPath) {
        // Construct full URL to the static file
        const baseURL = api.defaults.baseURL || 'http://192.168.1.5:3000';
        // Ensure payslipPath starts with /
        const path = salaryData.payslipPath.startsWith('/') ? salaryData.payslipPath : '/' + salaryData.payslipPath;
        const url = `${baseURL}${path}`;
        console.log('Opening payslip:', url);
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Payslip path not found');
      }
    } catch (error) {
      console.error('Error opening payslip:', error);
      Alert.alert('Error', 'Failed to open payslip');
    }
  };



  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={styles.headerTitle}>Salary Report</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.datePickerCard}>
          <View style={styles.datePickerRow}>
            <TouchableOpacity
              style={[styles.monthNavButton, !canGoPrevMonth ? styles.monthNavButtonDisabled : null]}
              activeOpacity={0.7}
              onPress={prevMonth}
              disabled={!canGoPrevMonth}
            >
              <Text style={styles.monthNavText}>◀</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.datePickerButton} activeOpacity={0.7} onPress={openMonthPicker}>
              <Image source={require('../assets/desti.png')} style={{ width: 16, height: 16 }} />
              <Text style={styles.datePickerText}>{formatMonthYear(selectedDate)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.monthNavButton, !canGoNextMonth ? styles.monthNavButtonDisabled : null]}
              activeOpacity={0.7}
              onPress={nextMonth}
              disabled={!canGoNextMonth}
            >
              <Text style={styles.monthNavText}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#125EC9" />
            <Text style={styles.loadingText}>Loading salary data...</Text>
          </View>
        ) : (
          <>
            {/* Calculate actual salary based on attendance */}
            <>
              <View style={styles.salaryCardRow}>
                <View style={styles.salaryCard}>
                  <View style={styles.salaryContent}>
                    <Image source={require('../assets/clock-fill.png')} style={styles.salaryIcon} />
                    <View>
                      <Text style={styles.salaryLabel}>Gross Salary</Text>
                      <Text style={styles.salaryAmount}>{formatCurrency(salaryData.grossSalary)}</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.salaryCard, styles.salaryCard1]}>
                  <View style={styles.salaryContent}>
                    <Image source={require('../assets/clock-fill.png')} style={styles.salaryIcon} />
                    <View>
                      <Text style={[styles.salaryLabel, styles.salaryLabel1]}>Net Salary</Text>
                      <Text style={styles.salaryAmount}>{formatCurrency(salaryData.netSalary)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.salaryCardRow}>
                <View style={[styles.salaryCard, styles.salaryCard2]}>
                  <View style={styles.salaryContent}>
                    <Image source={require('../assets/clock-fill.png')} style={styles.salaryIcon} />
                    <View>
                      <Text style={[styles.salaryLabel, styles.salaryLabel2]}>Final Net Salary</Text>
                      <Text style={styles.salaryAmount}>{formatCurrency(salaryData.finalNetSalary || salaryData.netSalary)}</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.salaryCard, { backgroundColor: salaryData.paymentStatus === 'PAID' ? '#D1FAE5' : '#DBEAFE' }]}>
                  <View style={styles.salaryContent}>
                    <Image 
                      source={salaryData.paymentStatus === 'PAID' ? require('../assets/vix.png') : require('../assets/clock-fill.png')} 
                      style={[styles.salaryIcon, { tintColor: salaryData.paymentStatus === 'PAID' ? '#10B981' : '#1D4ED8' }]} 
                    />
                    <View>
                      <Text style={[styles.salaryLabel, { color: salaryData.paymentStatus === 'PAID' ? '#10B981' : '#1D4ED8' }]}>Payment Status</Text>
                      <Text style={[styles.salaryAmount, { color: salaryData.paymentStatus === 'PAID' ? '#065F46' : '#1E40AF' }]}>
                        {salaryData.paymentStatus === 'PAID' ? 'PAID' : 'DUE'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Earnings</Text>
              {Object.entries(salaryData.earnings || {}).map(([key, value]) => {
                const norm = (s = '') => s.toLowerCase().replace(/[_\s]/g, '');
                const nk = norm(key);
                const match = (salaryData.tplEarnKeys || []).find(tk => norm(tk) === nk);
                const label = match || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                return (
                  <View key={key} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{formatCurrency(value)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Incentives</Text>
              {Object.entries(salaryData.incentives || {}).map(([key, value]) => (
                key !== 'total' && (
                  <View key={key} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                    <Text style={styles.detailValue}>{formatCurrency(value)}</Text>
                  </View>
                )
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, styles.deductionTitle]}>Deductions</Text>
              {Object.entries(salaryData.deductions || {}).map(([key, value]) => {
                const norm = (s = '') => s.toLowerCase().replace(/[_\s]/g, '');
                const nk = norm(key);
                const match = (salaryData.tplDedKeys || []).find(tk => norm(tk) === nk);
                const label = match || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                return (
                  <View key={key} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={[styles.detailValue, styles.deductionValue]}>{formatCurrency(value)}</Text>
                  </View>
                );
              })}
            </View>

            {salaryData && salaryData.isGenerated ? (
              <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadReport}>
                <Image source={require('../assets/vix.png')} style={styles.downloadIcon} />
                <Text style={styles.downloadButtonText}>View Payslip</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                <Text style={{ color: '#999', fontSize: 13, fontFamily: 'Inter_500Medium' }}>Payslip not yet generated by Admin</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {showMonthPicker && (
        <Modal transparent animationType="slide">
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerContainer}>
              <Text style={styles.datePickerTitle}>Select Month</Text>
              <input
                type="month"
                value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => handleWebMonthChange(e.target.value)}
                min={(new Date(new Date().getFullYear() - 3, 0, 1)).toISOString().slice(0, 7)}
                max={`${currentMonthStart.getFullYear()}-${String(currentMonthStart.getMonth() + 1).padStart(2, '0')}`}
                style={styles.webDatePicker}
              />
              <View style={styles.datePickerButtons}>
                <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowMonthPicker(false)}>
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.datePickerConfirm} onPress={() => setShowMonthPicker(false)}>
                  <Text style={styles.datePickerConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {showNativeMonthPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleNativeMonthChange}
          minimumDate={new Date(new Date().getFullYear() - 3, 0, 1)}
          maximumDate={currentMonthStart}
        />
      )}

      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <View style={styles.notifBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setNotifOpen(false)} />
          <View style={styles.notifPanel}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotifOpen(false)}><Text style={styles.notifClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.notifEmpty}>No notifications</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'start',
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 30,
    marginLeft: 5,
    marginRight: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#B3B3B3',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  backBtn: { paddingTop: 6, paddingBottom: 6 },
  backChevron: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Inter_400Regular',
  },
  datePickerCard: {
    marginBottom: 16,
    marginTop: 20,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    width: '100%',
  },
  datePickerText: {
    color: '#454545',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  monthNavButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavButtonDisabled: {
    opacity: 0.45,
  },
  monthNavText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter_600SemiBold',
  },
  salaryCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  salaryCard: {
    flex: 1,
    backgroundColor: '#DAFFD7',
    borderRadius: 12,
    paddingVertical: 25,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    alignItems: 'flex-start',
  },
  salaryCard1: {
    backgroundColor: '#FFD7D7',
  },
  salaryCard2: {
    backgroundColor: '#F4FFD7',
  },
  salaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  salaryIcon: {
    width: 15,
    height: 15,
    marginTop: 2,
    position: 'relative',
    top: -8,
  },
  salaryLabel: {
    color: '#35C800',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    marginBottom: 6,
  },
  salaryLabel1: {
    color: '#E80000',
  },
  salaryLabel2: {
    color: '#929700',
  },
  salaryAmount: {
    color: '#454545',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6EEFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#125EC9',
    marginBottom: 12,
  },
  deductionTitle: {
    color: '#DC2626',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Inter_400Regular',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Inter_600SemiBold',
  },
  deductionValue: {
    color: '#DC2626',
  },
  downloadButton: {
    backgroundColor: '#125EC9',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    width: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  downloadIcon: {
    width: 16,
    height: 16,
    tintColor: '#FFFFFF',
  },
  datePickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  datePickerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#454545',
    marginBottom: 16,
    textAlign: 'center',
  },
  webDatePicker: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6EEFF',
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 20,
    outline: 'none',
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  datePickerCancel: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  datePickerCancelText: {
    color: '#6B7280',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  datePickerConfirm: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#125EC9',
    borderRadius: 8,
  },
  datePickerConfirmText: {
    color: '#ffffff',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  notifBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  notifPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  notifTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#454545',
  },
  notifClose: {
    fontSize: 18,
    color: '#6B7280',
  },
  notifEmpty: {
    textAlign: 'center',
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
    paddingVertical: 40,
  },
});

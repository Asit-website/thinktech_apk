import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
import api, { listMyLeaveRequests, getMe, getAttendanceHistory, getMyWeeklyOffDates } from '../config/api';

// Parse and normalize salary values into a uniform structure with totals
// Parse and normalize salary values into a uniform structure with totals
function extractSalaryValues(user) {
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

  const prefEarn = ['basic_salary', 'hra', 'da', 'special_allowance', 'conveyance_allowance', 'medical_allowance', 'telephone_allowance', 'other_allowances'];
  const prefDed = ['provident_fund', 'esi', 'professional_tax', 'income_tax', 'loan_deduction', 'other_deductions'];

  let earnings = {};
  let deductions = {};
  let incentives = {};

  if (sv && typeof sv === 'object' && (sv.earnings || sv.deductions || sv.incentives)) {
    earnings = (sv.earnings && typeof sv.earnings === 'object') ? sv.earnings : {};
    deductions = (sv.deductions && typeof sv.deductions === 'object') ? sv.deductions : {};
    incentives = (sv.incentives && typeof sv.incentives === 'object') ? sv.incentives : {};
  } else {
    let sd = (user?.salaryDetails || user?.salary_details || {});
    earnings = {
      basic_salary: Number(sd.basicSalary || 0),
      hra: Number(sd.hra || 0),
      da: Number(sd.da || 0),
      special_allowance: Number(sd.specialAllowance || 0),
      conveyance_allowance: Number(sd.conveyanceAllowance || 0),
      medical_allowance: Number(sd.medicalAllowance || 0),
      telephone_allowance: Number(sd.telephoneAllowance || 0),
      other_allowances: Number(sd.otherAllowances || 0),
      hospitality_allowance: Number(sd.hospitalityAllowance || sd.hospitilityAllowance || 0),
    };
    deductions = {
      provident_fund: Number(sd.pfDeduction || 0),
      esi: Number(sd.esiDeduction || 0),
      professional_tax: Number(sd.professionalTax || 0),
      tds: Number(sd.tdsDeduction || 0),
      other_deductions: Number(sd.otherDeductions || 0),
    };
  }

  const filterFields = (obj, pref, tplKeys) => {
    const res = {};
    const norm = (s = '') => s.toLowerCase().replace(/[_\s]/g, '');
    Object.entries(obj).forEach(([k, v]) => {
      const nk = norm(k);
      const inTpl = tplKeys ? tplKeys.some(tk => norm(tk) === nk) : false;
      const inPref = !tplKeys && pref.includes(k);
      
      // CRITICAL FIX: Only show if non-zero OR it's explicitly in the template
      if (Number(v) !== 0 || inTpl) {
        res[k] = v;
      }
    });
    return res;
  };

  const filteredEarnings = filterFields(earnings, prefEarn, tplEarnKeys);
  const filteredDeductions = filterFields(deductions, prefDed, tplDedKeys);

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
    tplEarnKeys, tplDedKeys,
    basicSalary: Number(earnings.basic_salary || earnings.basicSalary || 0),
  };
}

export default function SalaryScreen({ navigation }) {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifLeaves, setNotifLeaves] = React.useState([]);
  const [unseenCount, setUnseenCount] = React.useState(0);
  const [salaryData, setSalaryData] = useState(null);
  const [salaryTemplate, setSalaryTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [computedMonth, setComputedMonth] = useState(null);
  const [salaryCalcMode, setSalaryCalcMode] = useState('calendar');
  const [allowSalaryReport, setAllowSalaryReport] = useState(false);
  const [hasSalaryAccess, setHasSalaryAccess] = useState(null);
  const [rawSalaryJson, setRawSalaryJson] = useState(null);
  const [user, setUser] = useState(null);

  // Fetch salary data from user
  useEffect(() => {
    const fetchSalaryData = async () => {
      try {
        setSalaryCalcMode('calendar');
        let canViewSalary = true;
        try {
          const access = await api.get('/me/salary/access');
          canViewSalary = !!access?.data?.allowCurrentCycle;
        } catch (_) {
          canViewSalary = true;
        }
        setAllowSalaryReport(canViewSalary);
        setHasSalaryAccess(canViewSalary);

        if (!canViewSalary) {
          setSalaryData(null);
          return;
        }

        const userResponse = await getMe();
        if (userResponse.success && userResponse.user) {
          const userData = userResponse.user;
          setUser(userData);
          setSalaryTemplate(userData.salaryTemplate || null);

          // Keep raw salaryValues JSON (handle double-encoded)
          let raw = userData?.salaryValues || userData?.salary_values || null;
          if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { /* keep as is */ } }
          if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }
          setRawSalaryJson(raw);

          const sv = extractSalaryValues(userData);
          setSalaryData(sv);
        }
      } catch (error) {
        console.error('Error fetching salary data:', error);
        setHasSalaryAccess(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSalaryData();
  }, []);

  // Notifications
  React.useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      try {
        const [ap, rj] = await Promise.all([
          listMyLeaveRequests({ status: 'APPROVED' }),
          listMyLeaveRequests({ status: 'REJECTED' }),
        ]);
        const approved = (ap?.leaves || []).map((x) => ({ ...x, _notifStatus: 'APPROVED' }));
        const rejected = (rj?.leaves || []).map((x) => ({ ...x, _notifStatus: 'REJECTED' }));
        const items = [...approved, ...rejected].sort((a, b) => (
          new Date(b.reviewedAt || b.updatedAt || b.createdAt).getTime() - new Date(a.reviewedAt || a.updatedAt || a.createdAt).getTime()
        ));
        if (cancelled) return;
        setNotifLeaves(items);
        setUnseenCount(items.length);
      } catch { }
    };
    compute();
    const intv = setInterval(compute, 60000);
    return () => { cancelled = true; clearInterval(intv); };
  }, []);

  const openNotifications = async () => {
    setNotifOpen(true);
    try {
      const latest = notifLeaves
        .map((it) => new Date(it.reviewedAt || it.updatedAt || it.createdAt).getTime())
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => b - a)[0];
      const toStore = latest ? new Date(latest).toISOString() : new Date().toISOString();
      await AsyncStorage.setItem('notif:lastSeenApprovedAt', toStore);
    } catch { }
  };

  const onMarkRead = () => {
    setNotifLeaves([]);
    setUnseenCount(0);
    setNotifOpen(false);
  };

  const formatDate = (d) => {
    if (!d) return '--';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '--';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  };

  // Month state and handlers
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const staffStartMonth = React.useMemo(() => {
    const candidates = [
      user?.profile?.dateOfJoining,
      user?.createdAt,
      user?.profile?.createdAt,
    ].filter(Boolean);
    for (const c of candidates) {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return null;
  }, [user]);

  const currentMonthStart = React.useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);

  const today = new Date();
  const [monthIdx, setMonthIdx] = React.useState(today.getMonth());
  const [year, setYear] = React.useState(today.getFullYear());
  const selectedMonthStart = React.useMemo(() => new Date(year, monthIdx, 1), [year, monthIdx]);
  const canGoPrevMonth = React.useMemo(() => {
    if (!staffStartMonth) return true;
    return selectedMonthStart > staffStartMonth;
  }, [selectedMonthStart, staffStartMonth]);
  const canGoNextMonth = React.useMemo(() => selectedMonthStart < currentMonthStart, [selectedMonthStart, currentMonthStart]);

  // Month computation: always try backend /me/salary-compute first (actual PayrollLine data),
  // only fall back to local monthStore if no payroll line exists for that month.
  useEffect(() => {
    const run = async () => {
      if (isLoading || !salaryData) return;
      const baseNet = Number(salaryData.netSalary || 0);
      const ym = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

      // ALWAYS try backend first - it returns actual PayrollLine data (pro-rated)
      try {
        const comp = await api.get('/me/salary-compute', { params: { monthKey: ym } });
        console.log('💰 Salary compute response:', comp?.data);
        if (comp?.data?.success) {
          const t = comp.data.totals || {};
          const s = comp.data.attendanceSummary || {};

          const paymentStatus = comp.data.paymentStatus || 'DUE';
          const paidAmount = comp.data.paidAmount || 0;

          const e = comp.data.earnings || {};
          const d = comp.data.deductions || {};
          const i = comp.data.incentives || {};

          const sumObj = (o) => Object.values(o || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
          const totalEarnings = Number(t.totalEarnings ?? sumObj(e));
          const totalIncentives = Number(t.totalIncentives ?? sumObj(i));
          const totalDeductions = Number(t.totalDeductions ?? sumObj(d));
          const grossSalary = Number(t.grossSalary ?? (totalEarnings + totalIncentives));
          const netSalary = Number(t.netSalary ?? (grossSalary - totalDeductions));

          // Build tplEarnKeys ONLY if no template keys exist in salaryData
          const finalTplEarnKeys = salaryData?.tplEarnKeys || Object.keys(e);
          const finalTplDedKeys = salaryData?.tplDedKeys || Object.keys(d);

          // Apply filtering to the backend response as well
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

          setComputedMonth({
            netSalary,
            totalEarnings,
            totalIncentives,
            totalDeductions,
            grossSalary,
            tplEarnKeys: finalTplEarnKeys,
            tplDedKeys: finalTplDedKeys,
            tplIncentiveKeys: Object.keys(i),
            earnings: filteredE,
            deductions: filteredD,
            incentives: i,
            basicSalary: Number(e.basic_salary || e.basicSalary || 0),
            paymentStatus,
            paidAmount,
            attendanceData: {
              workingDays: daysInMonth,
              presentDays: Number(s.present || 0),
              halfDays: Number(s.half || 0),
              approvedLeaveDays: Number(s.paidLeave || 0) + Number(s.unpaidLeave || 0),
              absentDays: Number(s.absent || 0),
              weeklyOffDays: Number(s.weeklyOff || 0),
              holidays: Number(s.holidays || 0),
              unpaidDays: Number(s.unpaidLeave || 0),
              lateCount: Number(s.lateCount || 0),
              latePenaltyDays: Number(s.latePenaltyDays || 0),
            },
            attendanceInfo: {
              payableDays: (Number(s.present || 0) + Number(s.half || 0) * 0.5 + Number(s.weeklyOff || 0) + Number(s.holidays || 0) + Number(s.paidLeave || 0)) - Number(s.latePenaltyDays || 0),
              totalWorkingDays: daysInMonth,
              attendancePercentage: ((Number(s.present || 0) + Number(s.half || 0) * 0.5) / Math.max(1, daysInMonth)) * 100,
            },
          });
          return;
        }
      } catch (_) { }

      // Fallback: use local monthStore from salaryValues.months (no payroll line exists)
      const monthStore = rawSalaryJson && rawSalaryJson.months ? rawSalaryJson.months[ym] : null;
      if (monthStore && typeof monthStore === 'object') {
        const e = (monthStore.earnings && typeof monthStore.earnings === 'object') ? monthStore.earnings : {};
        const i = (monthStore.incentives && typeof monthStore.incentives === 'object') ? monthStore.incentives : {};
        const d = (monthStore.deductions && typeof monthStore.deductions === 'object') ? monthStore.deductions : {};
        const t = (monthStore.totals && typeof monthStore.totals === 'object') ? monthStore.totals : {};
        const sum = (o) => Object.values(o || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        const totalEarnings = Number(t.totalEarnings ?? sum(e));
        const totalIncentives = Number(t.totalIncentives ?? sum(i));
        const totalDeductions = Number(t.totalDeductions ?? sum(d));
        const grossSalary = Number(t.grossSalary ?? (totalEarnings + totalIncentives));
        const netSalary = Number(t.netSalary ?? (grossSalary - totalDeductions));
        const isPast = (year < today.getFullYear()) || (year === today.getFullYear() && monthIdx < today.getMonth());
        const monthTemplate = {
          earnings: Object.keys(e).reduce((o, k) => { o[k] = {}; return o; }, {}),
          incentives: Object.keys(i).reduce((o, k) => { o[k] = {}; return o; }, {}),
          deductions: Object.keys(d).reduce((o, k) => { o[k] = {}; return o; }, {}),
        };
        setComputedMonth({
          earnings: e, incentives: i, deductions: d,
          totalEarnings, totalIncentives, totalDeductions, grossSalary, netSalary,
          basicSalary: Number(e.basic_salary || e.basicSalary || 0),
          monthStore: true, templateFields: monthTemplate, isPastMonth: isPast,
          paymentStatus: 'DUE', paidAmount: 0,
        });
        return;
      }

      // Last resort: use base salary data
      setComputedMonth({ netSalary: baseNet });
    };
    run();
  }, [monthIdx, year, isLoading, salaryData, salaryCalcMode, rawSalaryJson]);

  function getFieldLabel(field, tplKeys = null) {
    const norm = (s = '') => s.toLowerCase().replace(/[_\s]/g, '');
    const nk = norm(field);
    const match = tplKeys ? tplKeys.find(tk => norm(tk) === nk) : null;
    if (match) return match;

    const known = { pf: 'Provident Fund', pf_deduction: 'Provident Fund', esi_deduction: 'ESI', tds_deduction: 'TDS' };
    if (known[field]) return known[field];
    return String(field).split('_').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  }

  const prevMonth = () => {
    if (!canGoPrevMonth) return;
    setMonthIdx((idx) => {
      if (idx === 0) { setYear((y) => y - 1); return 11; }
      return idx - 1;
    });
  };

  const nextMonth = () => {
    if (!canGoNextMonth) return;
    setMonthIdx((idx) => {
      if (idx === 11) { setYear((y) => y + 1); return 0; }
      return idx + 1;
    });
  };

  // Debug: Check what's being merged
  console.log('🔍 salaryData.attendanceInfo:', salaryData?.attendanceInfo);
  console.log('🔍 computedMonth.attendanceInfo:', computedMonth?.attendanceInfo);

  const monthSpecificData = computedMonth ? { ...salaryData, ...computedMonth, monthSpecific: true } : salaryData;

  // Debug log for attendance percentage
  if (monthSpecificData?.attendanceInfo) {
    console.log('📊 [UI Render] Attendance %:', monthSpecificData.attendanceInfo.attendancePercentage);
  }


  const handleOpenSalaryReport = () => {
    if (!allowSalaryReport) {
      Alert.alert('Access Denied', 'Your organization has not granted access to view the salary report for the current cycle.');
      return;
    }
    navigation.navigate('SalaryReport');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Salary</Text>
        <TouchableOpacity style={styles.bellButton} activeOpacity={0.7} onPress={openNotifications}>
          <Image source={require('../assets/bell (2).png')} style={{ width: 18, height: 18 }} />
          {unseenCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : String(unseenCount)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#125EC9" />
            <Text style={styles.loadingText}>Loading salary details...</Text>
          </View>
        ) : hasSalaryAccess === false ? (
          <View style={styles.noAccessCard}>
            <Text style={styles.noAccessTitle}>Access Restricted</Text>
            <Text style={styles.noAccessText}>You don't have access to salary.</Text>
          </View>
        ) : !salaryData ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Salary data not available.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.dateHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 7, paddingVertical: 7 }}>
                  <Image source={require('../assets/cal.png')} style={{ width: 14, height: 14, tintColor: '#ffffff' }} />
                  <Text style={styles.dateText}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' })}</Text>
                </View>
              </View>
              <View style={styles.statsBox}>
                <View style={styles.summaryTop}>
                  <View>
                    <Text style={styles.summaryCaption}>
                      {salaryTemplate ? salaryTemplate.name : 'Monthly Salary'} - {monthNames[monthIdx]} {year}
                    </Text>
                  </View>
                  <View style={styles.summaryRight}>
                    <View style={styles.timerClusterRow}>
                      <View style={styles.timerCol}>
                        <View style={styles.timerPill}>
                          <Text style={styles.timerText}>
                            {monthSpecificData?.isFutureMonth
                              ? 'TBD'
                              : formatCurrency(monthSpecificData?.netSalary || 0)}
                          </Text>
                        </View>
                        <View>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: monthSpecificData?.paymentStatus === 'PAID' ? "#10b981" : "#0b4ee5",
                            textAlign: "center"
                          }}>
                            {monthSpecificData?.paymentStatus === 'PAID' ? 'Paid' : 'Due'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.muted}>Gross Salary</Text>
                    <Text style={styles.value}>
                      {monthSpecificData?.isFutureMonth ? "TBD" : formatCurrency(monthSpecificData?.grossSalary || 0)}
                    </Text>
                  </View>
                  <View style={styles.col1}>
                    <Text style={styles.muted}>Total Earnings</Text>
                    <Text style={styles.value}>
                      {monthSpecificData?.isFutureMonth ? "TBD" : formatCurrency(monthSpecificData?.totalEarnings || 0)}
                    </Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.col2}>
                    <Text style={styles.muted}>Total Deductions</Text>
                    <Text style={styles.value}>
                      {monthSpecificData?.isFutureMonth ? "TBD" : formatCurrency((monthSpecificData?.totalDeductions ?? 0))}
                    </Text>
                  </View>
                  <View style={styles.col3}>
                    <Text style={styles.muted}>Basic Salary</Text>
                    <Text style={styles.value}>
                      {formatCurrency(salaryData?.basicSalary || 0)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Month section with accordions (detail) */}
            <View style={styles.monthSection}>
              <View style={styles.monthHeader}>
                <TouchableOpacity
                  onPress={prevMonth}
                  style={[styles.monthArrow, !canGoPrevMonth ? styles.monthArrowDisabled : null]}
                  activeOpacity={0.7}
                  disabled={!canGoPrevMonth}
                >
                  <Image source={require('../assets/leftie.png')} style={{ width: 12, height: 12 }} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{monthNames[monthIdx]} {year}</Text>
                <TouchableOpacity
                  onPress={nextMonth}
                  style={[styles.monthArrow, !canGoNextMonth ? styles.monthArrowDisabled : null]}
                  activeOpacity={0.7}
                  disabled={!canGoNextMonth}
                >
                  <Image source={require('../assets/rightie.png')} style={{ width: 12, height: 12 }} />
                </TouchableOpacity>
              </View>

              <Accordion title="Attendance Details">
                {monthSpecificData?.attendanceInfo ? (
                  <>
                    <Row label="Working Days" amount={monthSpecificData.attendanceData?.workingDays?.toString?.() || '--'} />
                    <Row label="Present Days" amount={monthSpecificData.attendanceData?.presentDays?.toString?.() || '--'} />
                    <Row label="Half Days" amount={monthSpecificData.attendanceData?.halfDays?.toString?.() || '--'} />
                    <Row label="Approved Leaves" amount={(monthSpecificData.attendanceData?.approvedLeaveDays || 0).toString()} />
                    <Row label="Weekly Off Days" amount={(monthSpecificData.attendanceData?.weeklyOffDays || 0).toString()} />
                    <Row label="Holidays" amount={(monthSpecificData.attendanceData?.holidays || 0).toString()} />
                    <Row label="Absent Days" amount={(monthSpecificData.attendanceData?.absentDays || 0).toString()} />
                    <Row label="Late Count" amount={(monthSpecificData.attendanceData?.lateCount || 0).toString()} />
                    <Row label="Late Penalty (Days)" amount={(monthSpecificData.attendanceData?.latePenaltyDays || 0).toString()} />
                    <Row label="Payable Days" amount={monthSpecificData.attendanceInfo?.payableDays?.toString?.() || '--'} />
                  </>
                ) : (
                  <Row label="Status" amount={monthSpecificData?.isFutureMonth ? 'Future month - Attendance not yet recorded' : 'Current/past month'} />
                )}
              </Accordion>

              <Accordion title="Earnings">
                {monthSpecificData?.earnings ? (
                  Object.keys(monthSpecificData.earnings).map(field => {
                    const amt = Number(monthSpecificData.earnings?.[field] || 0);
                    return (
                      <Row
                        key={field}
                        label={getFieldLabel(field, monthSpecificData.tplEarnKeys)}
                        amount={formatCurrency(amt)}
                      />
                    );
                  })
                ) : (
                  <>
                    <Row label="Basic Salary" amount={formatCurrency(monthSpecificData?.basicSalary || 0)} />
                  </>
                )}
              </Accordion>

              <Accordion title="Deductions">
                {monthSpecificData?.deductions ? (
                  Object.keys(monthSpecificData.deductions).map(field => {
                    const amt = Number(monthSpecificData.deductions?.[field] || 0);
                    return (
                      <Row
                        key={field}
                        label={getFieldLabel(field, monthSpecificData.tplDedKeys)}
                        amount={formatCurrency(amt)}
                      />
                    );
                  })
                ) : (
                  <></>
                )}
              </Accordion>

              <Accordion title="Payslip">
                {allowSalaryReport ? (
                  <TouchableOpacity style={styles.payslipButton} onPress={handleOpenSalaryReport}>
                    <Text style={styles.payslipButtonText}>View Detailed Salary Report</Text>
                    <Image source={require('../assets/rightie.png')} style={{ width: 12, height: 12 }} />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.payslipButton, { backgroundColor: '#E5E7EB' }]}>
                    <Text style={[styles.payslipButtonText, { color: '#6B7280' }]}>View Detailed Salary Report</Text>
                    <Image source={require('../assets/rightie.png')} style={{ width: 12, height: 12, tintColor: '#9CA3AF' }} />
                  </View>
                )}
              </Accordion>
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav navigation={navigation} activeKey="Salary" />

      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <View style={styles.notifBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setNotifOpen(false)} />
          <View style={styles.notifPanel}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotifOpen(false)}><Text style={styles.notifClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {notifLeaves.length === 0 ? (
                <Text style={styles.notifEmpty}>No approved leaves yet.</Text>
              ) : (
                notifLeaves.slice(0, 20).map((lv) => (
                  <View key={String(lv.id)} style={styles.notifItem}>
                    <Text style={styles.notifItemTitle}>{lv._notifStatus}</Text>
                    <Text style={styles.notifItemText}>{lv.reason || 'Leave updated'}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.markReadBtn} onPress={onMarkRead}>
              <Text style={styles.markReadText}>Mark all as read</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Accordion({ title, children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={styles.accordion}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.accordionHeader} activeOpacity={0.7}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Text style={styles.accordionChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

function Row({ label, amount }) {
  return (
    <View style={styles.rowItem}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowAmount}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30,
    marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  headerTitle: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  bellButton: { padding: 6, position: 'relative' },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, paddingHorizontal: 3, backgroundColor: '#EF4444', borderRadius: 8, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: 'Inter_600SemiBold' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  noAccessCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  noAccessTitle: { fontSize: 16, fontWeight: '700', color: '#991B1B', marginBottom: 8 },
  noAccessText: { fontSize: 14, color: '#7F1D1D' },

  summaryCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E6EEFF', marginBottom: 16 },
  dateHeader: { backgroundColor: '#125EC9', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  dateText: { color: '#fff', fontSize: 12 },
  statsBox: { padding: 12 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryCaption: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  summaryRight: {},
  timerClusterRow: { flexDirection: 'row' },
  timerCol: { alignItems: 'center' },
  timerPill: { backgroundColor: '#E8F1FF', borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12 },
  timerText: { color: '#0b4ee5', fontWeight: '800', fontSize: 18 },

  row: { flexDirection: 'row', marginTop: 10 },
  col: { flex: 1 },
  col1: { flex: 1 },
  col2: { flex: 1 },
  col3: { flex: 1 },
  muted: { color: '#6B7280', fontSize: 12, marginBottom: 4 },
  value: { color: '#111827', fontWeight: '700' },

  monthSection: { marginTop: 10 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthArrow: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 6 },
  monthArrowDisabled: { opacity: 0.45 },
  monthTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },

  accordion: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6EEFF', borderRadius: 12, marginBottom: 12 },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  accordionTitle: { fontSize: 14, fontWeight: '700', color: '#125EC9' },
  accordionChevron: { color: '#6B7280', fontSize: 12 },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 12 },

  rowItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel: { color: '#666', fontSize: 14 },
  rowAmount: { color: '#333', fontWeight: '700' },

  payslipButton: { backgroundColor: '#125EC9', borderRadius: 6, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 8, flexDirection: 'row' },
  payslipButtonText: { color: '#fff', fontWeight: '600' },

  notifBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  notifPanel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  notifTitle: { fontSize: 16, color: '#454545', fontWeight: '600' },
  notifClose: { fontSize: 18, color: '#6B7280' },
  notifEmpty: { textAlign: 'center', color: '#6B7280', paddingVertical: 40 },
  notifItem: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  notifItemTitle: { fontWeight: '700', color: '#111827' },
  notifItemText: { color: '#4B5563' },
  markReadBtn: { padding: 12, alignItems: 'center' },
  markReadText: { color: '#125EC9', fontWeight: '700' },
});

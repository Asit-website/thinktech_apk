import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getMyAdvances, submitAdvanceRequest, cancelAdvanceRequest } from '../config/api';
import { notifySuccess, notifyError } from '../utils/notify';
import BottomNav from '../components/BottomNav';

// Currency Formatter
const fmtCurrency = (val) =>
  `₹${(Number(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdvanceScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [advances, setAdvances] = useState([]);
  const [summary, setSummary] = useState({
    totalAdvanceAmount: 0,
    totalRecoveredAmount: 0,
    totalOutstandingBalance: 0,
    pendingRequestsCount: 0,
    totalCount: 0
  });

  const [activeTab, setActiveTab] = useState('advances'); // 'advances' | 'schedule'

  // Apply Modal States
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [advanceDate, setAdvanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [advanceCategory, setAdvanceCategory] = useState('salary'); // 'salary' | 'expense'
  const [reason, setReason] = useState('');

  // Deduction / Repayment Schedule (Matches Admin Advances.js)
  const defaultNextMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [singleDeductionMonth, setSingleDeductionMonth] = useState(defaultNextMonth);
  const [installments, setInstallments] = useState([]);
  const [pickerTarget, setPickerTarget] = useState(null); // 'single' | installmentId
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Details Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState(null);

  // Format Date for display
  const formatDisplayDate = (isoStr) => {
    if (!isoStr) return 'Select Date';
    const parts = String(isoStr).split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return isoStr;
  };

  // Upcoming days for date picker
  const upcomingDays = useMemo(() => {
    const arr = [];
    const base = new Date();
    for (let i = -7; i < 60; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      arr.push({ iso, label, weekday, isToday: i === 0 });
    }
    return arr;
  }, []);

  // Month options (Next 24 months)
  const availableMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const shortLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      list.push({ key, label, shortLabel });
    }
    return list;
  }, []);

  const formatMonthLabel = (mKey) => {
    if (!mKey) return 'Select Month';
    const found = availableMonths.find((m) => m.key === mKey);
    if (found) return found.label;
    const parts = String(mKey).split('-').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const d = new Date(parts[0], parts[1] - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return mKey;
  };

  // Add Installment row
  const handleAddInstallment = () => {
    const numAmount = Number(amount) || 0;
    const currentSum = installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const remaining = Math.max(0, numAmount - currentSum);

    let nextMonth = singleDeductionMonth || defaultNextMonth;
    if (installments.length > 0) {
      const lastMonth = installments[installments.length - 1].month;
      const parts = String(lastMonth).split('-').map(Number);
      if (parts.length === 2) {
        const d = new Date(parts[0], parts[1], 1); // parts[1] is 1-indexed, so next month
        nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
    }

    const newInst = {
      id: String(Date.now()) + '_' + Math.random().toString(36).substring(2, 6),
      month: nextMonth,
      amount: remaining > 0 ? String(remaining) : ''
    };
    setInstallments((prev) => [...prev, newInst]);
  };

  // Remove Installment row
  const handleRemoveInstallment = (id) => {
    setInstallments((prev) => prev.filter((i) => i.id !== id));
  };

  // Update Installment row
  const handleUpdateInstallment = (id, field, value) => {
    setInstallments((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  // Total Installment Sum
  const totalInstallmentAmount = useMemo(() => {
    return installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [installments]);

  // Load Advances
  const loadAdvances = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await getMyAdvances();
      if (resp?.success) {
        setAdvances(resp.advances || []);
        if (resp.summary) {
          setSummary(resp.summary);
        }
      }
    } catch (err) {
      console.error('Failed to load advances:', err);
      notifyError(err.response?.data?.message || 'Failed to load advances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAdvances();
  }, [loadAdvances]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAdvances();
  };

  // Submit Advance Request
  const handleSubmitAdvance = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      notifyError('Please enter a valid amount');
      return;
    }

    let deductionsPayload = [];
    let deductionMonthPayload = singleDeductionMonth || defaultNextMonth;

    if (advanceCategory === 'expense') {
      deductionsPayload = null;
      deductionMonthPayload = advanceDate ? String(advanceDate).slice(0, 7) : defaultNextMonth;
    } else {
      if (installments.length > 0) {
        for (let i = 0; i < installments.length; i++) {
          const item = installments[i];
          if (!item.month) {
            notifyError(`Please select month for installment #${i + 1}`);
            return;
          }
          const instAmt = Number(item.amount);
          if (!instAmt || instAmt <= 0) {
            notifyError(`Please enter a valid amount for installment #${i + 1}`);
            return;
          }
        }

        if (totalInstallmentAmount > numAmount) {
          notifyError(
            `Total installments (${fmtCurrency(totalInstallmentAmount)}) exceed advance amount (${fmtCurrency(numAmount)})`
          );
          return;
        }

        deductionsPayload = installments.map((i) => ({
          month: i.month,
          amount: Number(i.amount),
          status: 'pending'
        }));
        deductionMonthPayload = deductionsPayload[0].month;
      } else {
        if (!deductionMonthPayload) {
          notifyError('Please select deduction month');
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        amount: numAmount,
        advanceDate: advanceDate || new Date().toISOString().slice(0, 10),
        advanceCategory,
        reason: reason.trim(),
        deductionMonth: deductionMonthPayload,
        deductions: deductionsPayload
      };

      const resp = await submitAdvanceRequest(payload);
      if (resp?.success) {
        notifySuccess('Advance request submitted successfully!');
        setShowApplyModal(false);
        setReason('');
        setAmount('10000');
        setAdvanceDate(new Date().toISOString().slice(0, 10));
        setInstallments([]);
        setSingleDeductionMonth(defaultNextMonth);
        loadAdvances();
      } else {
        notifyError(resp?.message || 'Failed to submit advance request');
      }
    } catch (err) {
      console.error('Error submitting advance request:', err);
      notifyError(err.response?.data?.message || 'Error submitting advance request');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Pending Advance
  const handleCancelAdvance = (id) => {
    const doCancel = async () => {
      try {
        const resp = await cancelAdvanceRequest(id);
        if (resp?.success) {
          notifySuccess('Advance request cancelled successfully');
          loadAdvances();
        } else {
          notifyError(resp?.message || 'Failed to cancel advance request');
        }
      } catch (err) {
        console.error('Error cancelling advance request:', err);
        notifyError(err.response?.data?.message || 'Failed to cancel advance request');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to cancel this advance request?')) {
        doCancel();
      }
    } else {
      Alert.alert('Cancel Request', 'Are you sure you want to cancel this advance request?', [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: doCancel }
      ]);
    }
  };

  // Helper to parse deductions safely
  const parseDeductions = (adv) => {
    if (!adv) return [];
    let d = adv.deductions;
    while (typeof d === 'string') {
      try {
        d = JSON.parse(d);
      } catch (e) {
        break;
      }
    }
    return Array.isArray(d) ? d : [];
  };

  // Consolidated Repayment Schedule across all advances
  const allInstallments = useMemo(() => {
    const list = [];
    advances.forEach((adv) => {
      const deductions = parseDeductions(adv);
      if (deductions.length > 0) {
        deductions.forEach((d, idx) => {
          list.push({
            id: `${adv.id}_${idx}`,
            advanceId: adv.id,
            advanceType: adv.notes?.match(/^\[(.*?)\]/)?.[1] || 'Salary Advance',
            advanceDate: adv.advanceDate,
            month: d.month,
            amount: Number(d.amount || 0),
            status: d.status || 'pending',
            totalAdvance: Number(adv.amount || 0)
          });
        });
      } else if (adv.deductionMonth) {
        list.push({
          id: `${adv.id}_single`,
          advanceId: adv.id,
          advanceType: adv.notes?.match(/^\[(.*?)\]/)?.[1] || 'Salary Advance',
          advanceDate: adv.advanceDate,
          month: adv.deductionMonth,
          amount: Number(adv.amount || 0),
          status: adv.status === 'deducted' ? 'deducted' : 'pending',
          totalAdvance: Number(adv.amount || 0)
        });
      }
    });

    return list.sort((a, b) => (a.month > b.month ? 1 : -1));
  }, [advances]);

  return (
    <SafeAreaView style={styles.screen}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Salary Advances</Text>
        <TouchableOpacity style={styles.headerRefreshBtn} onPress={onRefresh}>
          <Text style={styles.headerRefreshText}>⟳</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Banner Card */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerTitle}>🏦 Advances</Text>
            <Text style={styles.bannerSubtitle}>
              Apply for advance salary, track approvals, monthly installments & outstanding balance
            </Text>
          </View>
          <TouchableOpacity
            style={styles.applyBtn}
            activeOpacity={0.85}
            onPress={() => setShowApplyModal(true)}
          >
            <Text style={styles.applyBtnText}>+ Apply for Advance</Text>
          </TouchableOpacity>
        </View>

        {/* 4 Summary Cards Grid */}
        <View style={styles.statsGrid}>
          {/* Card 1: Outstanding Balance */}
          <View style={[styles.statCard, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
            <Text style={[styles.statLabel, { color: '#9F1239' }]}>OUTSTANDING BALANCE</Text>
            <Text style={[styles.statValue, { color: '#E11D48' }]}>
              {fmtCurrency(summary.totalOutstandingBalance)}
            </Text>
            <Text style={styles.statSub}>Amount remaining to be deducted from payroll</Text>
          </View>

          {/* Card 2: Total Advance Taken */}
          <View style={[styles.statCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Text style={[styles.statLabel, { color: '#1E40AF' }]}>TOTAL ADVANCE TAKEN</Text>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>
              {fmtCurrency(summary.totalAdvanceAmount)}
            </Text>
            <Text style={styles.statSub}>Across {summary.totalCount || advances.length} advance records</Text>
          </View>

          {/* Card 3: Total Recovered */}
          <View style={[styles.statCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Text style={[styles.statLabel, { color: '#166534' }]}>TOTAL RECOVERED</Text>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>
              {fmtCurrency(summary.totalRecoveredAmount)}
            </Text>
            <Text style={styles.statSub}>Deducted automatically via monthly salary</Text>
          </View>

          {/* Card 4: Pending Review - Commented out */}
          {/*
          <View style={[styles.statCard, { backgroundColor: '#FEFCE8', borderColor: '#FEF08A' }]}>
            <Text style={[styles.statLabel, { color: '#854D0E' }]}>PENDING REVIEW</Text>
            <Text style={[styles.statValue, { color: '#D97706' }]}>
              {summary.pendingRequestsCount} Request(s)
            </Text>
            <Text style={styles.statSub}>Awaiting admin / HR verification</Text>
          </View>
          */}
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'advances' && styles.tabButtonActive]}
            onPress={() => setActiveTab('advances')}
          >
            <Text style={[styles.tabText, activeTab === 'advances' && styles.tabTextActive]}>
              My Advances ({advances.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'schedule' && styles.tabButtonActive]}
            onPress={() => setActiveTab('schedule')}
          >
            <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>
              Repayment Schedule ({allInstallments.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: ADVANCES LIST */}
        {activeTab === 'advances' && (
          <View style={{ marginTop: 12 }}>
            {loading && !refreshing ? (
              <ActivityIndicator size="large" color="#0F3B8C" style={{ marginVertical: 30 }} />
            ) : advances.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🏦</Text>
                <Text style={styles.emptyTitle}>No Advances Found</Text>
                <Text style={styles.emptySubtitle}>You have not applied for any salary advances yet.</Text>
                <TouchableOpacity
                  style={[styles.applyBtn, { marginTop: 14 }]}
                  onPress={() => setShowApplyModal(true)}
                >
                  <Text style={styles.applyBtnText}>+ Apply for Advance</Text>
                </TouchableOpacity>
              </View>
            ) : (
              advances.map((adv) => {
                const total = Number(adv.amount || 0);
                const deductions = parseDeductions(adv);
                let recovered = 0;
                deductions.forEach((d) => {
                  if (d.status === 'deducted') recovered += Number(d.amount || 0);
                });
                const outstanding = Math.max(0, total - recovered);
                const progressPct = total > 0 ? Math.min(100, Math.round((recovered / total) * 100)) : 0;

                const match = (adv.notes || '').match(/^\[(.*?)\]\s*(.*)$/);
                const typeName = match ? match[1] : 'Salary Advance';
                const reasonText = match ? match[2] : adv.notes || '--';

                const isPending = adv.status === 'pending';
                const isApproved = adv.status === 'approved';
                const isRejected = adv.status === 'rejected';
                const isFullyDeducted = adv.status === 'deducted' || outstanding <= 0;

                return (
                  <View key={String(adv.id)} style={styles.advCard}>
                    {/* Top Row: Type & Status */}
                    <View style={styles.advCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{typeName}</Text>
                        </View>
                        <Text style={styles.advIdText}>#{adv.id}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          // isPending && styles.statusPending,
                          (isApproved || isPending) && styles.statusApproved,
                          isRejected && styles.statusRejected,
                          isFullyDeducted && styles.statusDeducted
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            // isPending && { color: '#D97706' },
                            (isApproved || isPending) && { color: '#16A34A' },
                            isRejected && { color: '#DC2626' },
                            isFullyDeducted && { color: '#2563EB' }
                          ]}
                        >
                          {/* isPending
                            ? 'Pending Approval'
                            : */}
                          {isRejected
                            ? 'Rejected'
                            : isFullyDeducted
                            ? 'Fully Deducted'
                            : 'Active / Approved'}
                        </Text>
                      </View>
                    </View>

                    {/* Applied Date */}
                    <Text style={styles.appliedDateText}>
                      Applied: {adv.advanceDate ? adv.advanceDate : adv.createdAt?.slice(0, 10)}
                    </Text>

                    {/* Reason */}
                    {reasonText ? (
                      <Text style={styles.reasonText} numberOfLines={2}>
                        "{reasonText}"
                      </Text>
                    ) : null}

                    {/* Three Column Breakdown */}
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownCol}>
                        <Text style={styles.breakdownLabel}>Requested</Text>
                        <Text style={styles.breakdownVal}>{fmtCurrency(total)}</Text>
                      </View>
                      <View style={styles.breakdownCol}>
                        <Text style={styles.breakdownLabel}>Recovered</Text>
                        <Text style={[styles.breakdownVal, { color: '#16A34A' }]}>
                          {fmtCurrency(recovered)}
                        </Text>
                      </View>
                      <View style={styles.breakdownCol}>
                        <Text style={styles.breakdownLabel}>Outstanding</Text>
                        <Text style={[styles.breakdownVal, { color: '#E11D48' }]}>
                          {fmtCurrency(outstanding)}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                      </View>
                      <Text style={styles.progressPctText}>{progressPct}%</Text>
                    </View>

                    {/* Repayment Info & Actions */}
                    <View style={styles.advFooter}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.repayPlanTitle}>
                          {deductions.length > 1
                            ? `${deductions.length} Monthly Installments`
                            : 'Single Month Deduction'}
                        </Text>
                        <Text style={styles.repayPlanSub}>
                          {deductions.length > 0
                            ? `${fmtCurrency(deductions[0]?.amount)} / month`
                            : fmtCurrency(total)}
                          {deductions.length > 1
                            ? ` (${deductions.filter((d) => d.status === 'deducted').length} of ${
                                deductions.length
                              } Deducted)`
                            : ''}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={styles.viewPlanBtn}
                          onPress={() => {
                            setSelectedAdvance(adv);
                            setShowDetailsModal(true);
                          }}
                        >
                          <Text style={styles.viewPlanBtnText}>View Plan</Text>
                        </TouchableOpacity>

                        {/* {isPending ? (
                          <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => handleCancelAdvance(adv.id)}
                          >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        ) : null} */}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: REPAYMENT SCHEDULE & EMIs */}
        {activeTab === 'schedule' && (
          <View style={{ marginTop: 12 }}>
            {allInstallments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyTitle}>No Repayment Schedule</Text>
                <Text style={styles.emptySubtitle}>No upcoming or past salary deduction installments.</Text>
              </View>
            ) : (
              allInstallments.map((inst) => {
                const isDeducted = inst.status === 'deducted';
                return (
                  <View key={inst.id} style={styles.scheduleItem}>
                    <View style={styles.scheduleLeft}>
                      <Text style={styles.scheduleMonth}>{inst.month}</Text>
                      <Text style={styles.scheduleAdvRef}>
                        Advance #{inst.advanceId} • {inst.advanceType}
                      </Text>
                    </View>

                    <View style={styles.scheduleRight}>
                      <Text style={styles.scheduleAmount}>{fmtCurrency(inst.amount)}</Text>
                      <View
                        style={[
                          styles.scheduleStatusBadge,
                          isDeducted ? styles.statusApproved : styles.statusPending
                        ]}
                      >
                        <Text
                          style={[
                            styles.scheduleStatusText,
                            { color: isDeducted ? '#16A34A' : '#D97706' }
                          ]}
                        >
                          {isDeducted ? '✓ Deducted' : '⏳ Pending'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ============================================================== */}
      {/* MODAL 1: APPLY FOR ADVANCE                                     */}
      {/* ============================================================== */}
      <Modal
        visible={showApplyModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowApplyModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalHeaderTitle}>Apply for Salary Advance</Text>
              <Text style={styles.modalHeaderSub}>Request advance salary with flexible EMI plans</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowApplyModal(false)}>
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            {/* Advance Category Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Advance Type *</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={[styles.radioCard, advanceCategory === 'salary' && styles.radioCardSelected]}
                  onPress={() => setAdvanceCategory('salary')}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioTopRow}>
                    <View style={[styles.radioCircle, advanceCategory === 'salary' && styles.radioCircleSelected]}>
                      {advanceCategory === 'salary' && <View style={styles.radioDot} />}
                    </View>
                    <Text style={{ fontSize: 18 }}>💳</Text>
                  </View>
                  <Text style={[styles.radioTitle, advanceCategory === 'salary' && styles.radioTitleSelected]}>
                    Salary Advance
                  </Text>
                  <Text style={[styles.radioSub, advanceCategory === 'salary' && styles.radioSubSelected]}>
                    Payroll deduction / EMI
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.radioCard, advanceCategory === 'expense' && styles.radioCardSelected]}
                  onPress={() => setAdvanceCategory('expense')}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioTopRow}>
                    <View style={[styles.radioCircle, advanceCategory === 'expense' && styles.radioCircleSelected]}>
                      {advanceCategory === 'expense' && <View style={styles.radioDot} />}
                    </View>
                    <Text style={{ fontSize: 18 }}>🧾</Text>
                  </View>
                  <Text style={[styles.radioTitle, advanceCategory === 'expense' && styles.radioTitleSelected]}>
                    Against Expense
                  </Text>
                  <Text style={[styles.radioSub, advanceCategory === 'expense' && styles.radioSubSelected]}>
                    Settle via claims
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Advance Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Total Advance Amount (₹) *</Text>
              <View style={styles.inputPrefixWrap}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.textInputWithPrefix}
                  keyboardType="numeric"
                  placeholder="e.g. 10000"
                  placeholderTextColor="#94A3B8"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>

            {/* Date Given / Required Date (Matching Admin Advances.js) */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Date Given / Required Date *</Text>
              {Platform.OS === 'web' ? (
                <View style={styles.dateInputWebWrap}>
                  <Text style={styles.datePickerIcon}>📅</Text>
                  <input
                    type="date"
                    value={advanceDate}
                    onChange={(e) => setAdvanceDate(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#0F172A',
                      backgroundColor: 'transparent',
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.monthSelectTrigger}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.monthSelectTriggerText}>
                    📅  {formatDisplayDate(advanceDate)}
                  </Text>
                  <Text style={styles.monthSelectDropdownArrow}>▾</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Repayment / Deduction Schedule (Only for Salary Advance) */}
            {advanceCategory === 'expense' ? (
              <View style={styles.expenseInfoBox}>
                <Text style={styles.expenseInfoTitle}>ℹ️ Advance Against Expense</Text>
                <Text style={styles.expenseInfoText}>
                  This advance will NOT be deducted via monthly EMIs. It will automatically adjust against your approved expense claims in the payroll.
                </Text>
              </View>
            ) : (
            <View style={styles.scheduleSection}>
              <View style={styles.scheduleSectionHeader}>
                <Text style={styles.scheduleSectionTitle}>Repayment / Deduction Schedule</Text>
                <Text style={styles.scheduleSectionHint}>
                  Add multiple installments for monthly recovery. If no installments added, a single deduction month is required.
                </Text>
              </View>

              {/* Single deduction month (Shown ONLY when no installments added) */}
              {installments.length === 0 && (
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Deduction Month (single) *</Text>
                  <TouchableOpacity
                    style={styles.monthSelectTrigger}
                    onPress={() => {
                      setPickerTarget('single');
                      setShowMonthPicker(true);
                    }}
                  >
                    <Text style={styles.monthSelectTriggerText}>
                      📅  {formatMonthLabel(singleDeductionMonth)}
                    </Text>
                    <Text style={styles.monthSelectDropdownArrow}>▾</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Dynamic Installments List */}
              {installments.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  {installments.map((inst, idx) => (
                    <View key={inst.id} style={styles.installmentRow}>
                      <View style={styles.installmentMonthCol}>
                        <Text style={styles.installmentColLabel}>Month #{idx + 1}</Text>
                        <TouchableOpacity
                          style={styles.installmentMonthBtn}
                          onPress={() => {
                            setPickerTarget(inst.id);
                            setShowMonthPicker(true);
                          }}
                        >
                          <Text style={styles.installmentMonthBtnText} numberOfLines={1}>
                            {formatMonthLabel(inst.month)}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>▾</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.installmentAmountCol}>
                        <Text style={styles.installmentColLabel}>Deduct Amount</Text>
                        <View style={styles.installmentAmountWrap}>
                          <Text style={styles.installmentCurrencyPrefix}>₹</Text>
                          <TextInput
                            style={styles.installmentAmountInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            value={inst.amount}
                            onChangeText={(txt) => handleUpdateInstallment(inst.id, 'amount', txt)}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.installmentDeleteBtn}
                        onPress={() => handleRemoveInstallment(inst.id)}
                      >
                        <Text style={styles.installmentDeleteText}>⊖</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Summary / Balance check */}
                  <View
                    style={[
                      styles.allocationSummaryBox,
                      totalInstallmentAmount === Number(amount) && styles.allocationSummaryBoxSuccess,
                      totalInstallmentAmount > Number(amount) && styles.allocationSummaryBoxDanger
                    ]}
                  >
                    <Text
                      style={[
                        styles.allocationSummaryText,
                        totalInstallmentAmount === Number(amount) && styles.allocationSummaryTextSuccess,
                        totalInstallmentAmount > Number(amount) && styles.allocationSummaryTextDanger
                      ]}
                    >
                      {totalInstallmentAmount === Number(amount)
                        ? `✓ Total Installments: ${fmtCurrency(totalInstallmentAmount)} (Fully Allocated)`
                        : totalInstallmentAmount > Number(amount)
                        ? `⚠️ Total installments (${fmtCurrency(totalInstallmentAmount)}) exceed advance (${fmtCurrency(amount)})`
                        : `Allocated: ${fmtCurrency(totalInstallmentAmount)} | Remaining: ${fmtCurrency(Math.max(0, Number(amount) - totalInstallmentAmount))}`}
                    </Text>
                  </View>
                </View>
              )}

              {/* Add Installment Button */}
              <TouchableOpacity
                style={styles.addInstallmentBtn}
                onPress={handleAddInstallment}
              >
                <Text style={styles.addInstallmentBtnText}>+ Add Installment</Text>
              </TouchableOpacity>
            </View>
            )}

            {/* Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={2}
                placeholder="Optional notes"
                placeholderTextColor="#94A3B8"
                value={reason}
                onChangeText={setReason}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.modalSubmitBtn}
              activeOpacity={0.85}
              disabled={submitting}
              onPress={handleSubmitAdvance}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Submit Advance Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 2: VIEW REPAYMENT PLAN DETAILS                           */}
      {/* ============================================================== */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailsModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Repayment Plan Details</Text>
                <Text style={styles.modalHeaderSub}>Advance #{selectedAdvance?.id}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {selectedAdvance && (
                <>
                  <View style={styles.detailsSummaryBox}>
                    <View style={styles.detailsSummaryRow}>
                      <Text style={styles.detailsSummaryLabel}>Total Advance:</Text>
                      <Text style={styles.detailsSummaryVal}>{fmtCurrency(selectedAdvance.amount)}</Text>
                    </View>
                    <View style={styles.detailsSummaryRow}>
                      <Text style={styles.detailsSummaryLabel}>Applied Date:</Text>
                      <Text style={styles.detailsSummaryVal}>{selectedAdvance.advanceDate}</Text>
                    </View>
                    <View style={styles.detailsSummaryRow}>
                      <Text style={styles.detailsSummaryLabel}>Status:</Text>
                      <Text
                        style={[
                          styles.detailsSummaryVal,
                          {
                            color:
                              selectedAdvance.status === 'approved'
                                ? '#16A34A'
                                : selectedAdvance.status === 'pending'
                                ? '#D97706'
                                : '#E11D48'
                          }
                        ]}
                      >
                        {selectedAdvance.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 16, marginBottom: 8 }]}>
                    Deduction Installments:
                  </Text>

                  {parseDeductions(selectedAdvance).length === 0 ? (
                    <View style={styles.singleDeductBox}>
                      <Text style={{ fontSize: 13, color: '#1E293B', fontWeight: '600' }}>
                        Single Month Deduction
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        Month: {selectedAdvance.deductionMonth || 'Next cycle'} • Amount:{' '}
                        {fmtCurrency(selectedAdvance.amount)}
                      </Text>
                    </View>
                  ) : (
                    parseDeductions(selectedAdvance).map((d, idx) => (
                      <View key={String(idx)} style={styles.planItemRow}>
                        <View>
                          <Text style={styles.planItemMonth}>Installment #{idx + 1}</Text>
                          <Text style={styles.planItemSub}>Month: {d.month}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.planItemAmount}>{fmtCurrency(d.amount)}</Text>
                          <Text
                            style={[
                              styles.planItemStatus,
                              { color: d.status === 'deducted' ? '#16A34A' : '#D97706' }
                            ]}
                          >
                            {d.status === 'deducted' ? '✓ Deducted' : '⏳ Pending'}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.detailsCloseBtn}
              onPress={() => setShowDetailsModal(false)}
            >
              <Text style={styles.detailsCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 3: MONTH PICKER MODAL                                    */}
      {/* ============================================================== */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={styles.monthPickerCard}>
            <View style={styles.monthPickerHeader}>
              <View>
                <Text style={styles.monthPickerTitle}>Select Deduction Month</Text>
                <Text style={styles.monthPickerSub}>Choose salary cycle for recovery</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowMonthPicker(false)}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={true}>
              {availableMonths.map((m) => {
                const isSelected =
                  pickerTarget === 'single'
                    ? singleDeductionMonth === m.key
                    : installments.find((i) => i.id === pickerTarget)?.month === m.key;

                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.monthOptionItem, isSelected && styles.monthOptionItemSelected]}
                    onPress={() => {
                      if (pickerTarget === 'single') {
                        setSingleDeductionMonth(m.key);
                      } else if (pickerTarget) {
                        handleUpdateInstallment(pickerTarget, 'month', m.key);
                      }
                      setShowMonthPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthOptionText,
                        isSelected && styles.monthOptionTextSelected
                      ]}
                    >
                      {m.label}
                    </Text>
                    {isSelected ? (
                      <Text style={{ color: '#1D4ED8', fontWeight: '800', fontSize: 16 }}>✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL 4: DATE PICKER MODAL (NATIVE / FALLBACK)                 */}
      {/* ============================================================== */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View style={styles.monthPickerCard}>
            <View style={styles.monthPickerHeader}>
              <View>
                <Text style={styles.monthPickerTitle}>Select Advance Date</Text>
                <Text style={styles.monthPickerSub}>Required by / date given</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {upcomingDays.map((d) => {
                const isSelected = advanceDate === d.iso;
                return (
                  <TouchableOpacity
                    key={d.iso}
                    style={[styles.monthOptionItem, isSelected && styles.monthOptionItemSelected]}
                    onPress={() => {
                      setAdvanceDate(d.iso);
                      setShowDatePicker(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text
                        style={[
                          styles.monthOptionText,
                          isSelected && styles.monthOptionTextSelected
                        ]}
                      >
                        {d.label} ({d.weekday})
                      </Text>
                      {d.isToday && (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>Today</Text>
                        </View>
                      )}
                    </View>
                    {isSelected ? (
                      <Text style={{ color: '#1D4ED8', fontWeight: '800', fontSize: 16 }}>✓</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <BottomNav navigation={navigation} activeKey="Salary" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0F3B8C',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  backArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  headerRefreshBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerRefreshText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  // Banner
  bannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  bannerLeft: { marginBottom: 12 },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  bannerSubtitle: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  applyBtn: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  applyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Summary Stat Cards
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    minHeight: 90,
    justifyContent: 'space-between'
  },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statSub: { fontSize: 10, color: '#64748B', lineHeight: 14 },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabButtonActive: { backgroundColor: '#FFFFFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#1D4ED8', fontWeight: '700' },

  // Advance Cards
  advCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2
  },
  advCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  typeBadgeText: { color: '#1D4ED8', fontSize: 11, fontWeight: '700' },
  advIdText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusApproved: { backgroundColor: '#DCFCE7' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusDeducted: { backgroundColor: '#DBEAFE' },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  appliedDateText: { fontSize: 11, color: '#64748B', marginBottom: 6 },
  reasonText: { fontSize: 12, color: '#334155', fontStyle: 'italic', marginBottom: 10 },

  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  breakdownCol: { alignItems: 'center' },
  breakdownLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  breakdownVal: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  progressPctText: { fontSize: 11, fontWeight: '700', color: '#10B981', minWidth: 32 },

  advFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10
  },
  repayPlanTitle: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  repayPlanSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  viewPlanBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC'
  },
  viewPlanBtnText: { fontSize: 11, fontWeight: '600', color: '#334155' },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2'
  },
  cancelBtnText: { fontSize: 11, fontWeight: '600', color: '#E11D48' },

  // Schedule Tab Items
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8
  },
  scheduleLeft: { flex: 1 },
  scheduleMonth: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  scheduleAdvRef: { fontSize: 11, color: '#64748B', marginTop: 2 },
  scheduleRight: { alignItems: 'flex-end' },
  scheduleAmount: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  scheduleStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 3 },
  scheduleStatusText: { fontSize: 10, fontWeight: '700' },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 4 },
  emptySubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 20 },

  // Modal Styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  modalHeaderSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalCloseBtnText: { fontSize: 18, color: '#64748B', fontWeight: '700' },

  formGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  radioRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4
  },
  radioCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  radioCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2
  },
  radioTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  radioCircleSelected: {
    borderColor: '#2563EB'
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB'
  },
  radioTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2
  },
  radioTitleSelected: {
    color: '#1D4ED8'
  },
  radioSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15
  },
  radioSubSelected: {
    color: '#2563EB'
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF'
  },
  chipSelected: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  chipTextSelected: { color: '#1D4ED8', fontWeight: '700' },

  inputPrefixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12
  },
  currencyPrefix: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginRight: 6 },
  textInputWithPrefix: { flex: 1, paddingVertical: 9, fontSize: 15, fontWeight: '700', color: '#0F172A' },

  // Repayment / Deduction Schedule (Admin Match)
  scheduleSection: {
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  scheduleSectionHeader: { marginBottom: 12 },
  scheduleSectionTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  scheduleSectionHint: { fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 16 },

  monthSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  monthSelectTriggerText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  monthSelectDropdownArrow: { fontSize: 14, color: '#64748B', fontWeight: '700' },

  dateInputWebWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  datePickerIcon: { fontSize: 14, marginRight: 8 },
  todayBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  todayBadgeText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  expenseInfoBox: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16
  },
  expenseInfoTitle: { fontSize: 13, fontWeight: '700', color: '#6D28D9', marginBottom: 4 },
  expenseInfoText: { fontSize: 11, color: '#5B21B6', lineHeight: 16 },

  installmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  installmentMonthCol: { flex: 1.2 },
  installmentAmountCol: { flex: 1 },
  installmentColLabel: { fontSize: 10, fontWeight: '700', color: '#475569', marginBottom: 4 },
  installmentMonthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  installmentMonthBtnText: { fontSize: 12, fontWeight: '600', color: '#0F172A', flex: 1 },

  installmentAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8
  },
  installmentCurrencyPrefix: { fontSize: 12, fontWeight: '700', color: '#64748B', marginRight: 4 },
  installmentAmountInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },

  installmentDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  },
  installmentDeleteText: { fontSize: 18, fontWeight: '800', color: '#DC2626', lineHeight: 20 },

  allocationSummaryBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
    marginTop: 4
  },
  allocationSummaryBoxSuccess: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  allocationSummaryBoxDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  allocationSummaryText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  allocationSummaryTextSuccess: { color: '#16A34A' },
  allocationSummaryTextDanger: { color: '#DC2626' },

  addInstallmentBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  addInstallmentBtnText: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },

  // Month Picker Card
  monthPickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    width: '90%',
    alignSelf: 'center',
    maxHeight: 420
  },
  monthPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC'
  },
  monthPickerTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  monthPickerSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  monthOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  monthOptionItemSelected: { backgroundColor: '#EFF6FF' },
  monthOptionText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  monthOptionTextSelected: { color: '#1D4ED8', fontWeight: '700' },

  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    textAlignVertical: 'top'
  },

  modalSubmitBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Details Modal Backdrop & Card
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  detailsModalContent: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', maxHeight: '80%' },
  detailsSummaryBox: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, gap: 6 },
  detailsSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailsSummaryLabel: { fontSize: 12, color: '#64748B' },
  detailsSummaryVal: { fontSize: 12, fontWeight: '700', color: '#0F172A' },

  singleDeductBox: { padding: 12, backgroundColor: '#F1F5F9', borderRadius: 8 },
  planItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  planItemMonth: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  planItemSub: { fontSize: 11, color: '#64748B' },
  planItemAmount: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  planItemStatus: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  detailsCloseBtn: {
    padding: 12,
    backgroundColor: '#0F3B8C',
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailsCloseBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }
});

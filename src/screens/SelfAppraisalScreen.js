import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import api from '../config/api';
import BottomNav from '../components/BottomNav';

export default function SelfAppraisalScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cycle, setCycle] = useState(null);
  const [appraisal, setAppraisal] = useState(null);
  const [goals, setGoals] = useState([]);
  const [ratingScale, setRatingScale] = useState(null);
  const [overallComments, setOverallComments] = useState('');
  const [overallRating, setOverallRating] = useState(null);

  const fetchSelfAppraisal = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/pms/self-appraisals/my');
      if (res.data?.success) {
        setCycle(res.data.cycle || null);
        setAppraisal(res.data.appraisal || null);
        const fetchedGoals = Array.isArray(res.data.goals) ? res.data.goals : [];
        setGoals(
          fetchedGoals.map((g) => ({
            id: g.id,
            goal: g.goal,
            description: g.description,
            target: g.target,
            weightage: g.weightage,
            achievement: g.achievement || '',
            selfRating: g.selfRating !== undefined && g.selfRating !== null ? String(g.selfRating) : '',
            employeeComment: g.employeeComment || '',
            kraTitle: g.kpi?.kra?.title || 'General',
            kpiTitle: g.kpi?.title || 'KPI',
          }))
        );
        setRatingScale(res.data.activeRatingScale || null);
        setOverallComments(res.data.appraisal?.overallSelfComments || '');
        setOverallRating(
          res.data.appraisal?.overallSelfRating !== undefined && res.data.appraisal?.overallSelfRating !== null
            ? String(res.data.appraisal.overallSelfRating)
            : ''
        );
      } else {
        Alert.alert('Notice', res.data?.message || 'No active appraisal cycle found.');
      }
    } catch (e) {
      console.error('Fetch self appraisal error:', e);
      Alert.alert('Error', e.response?.data?.message || 'Failed to load self appraisal');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSelfAppraisal();
  }, [fetchSelfAppraisal]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSelfAppraisal();
  };

  const isSubmitted = appraisal?.status === 'SUBMITTED';

  const updateGoalItem = (index, field, value) => {
    if (isSubmitted) return;
    const updated = [...goals];
    updated[index][field] = value;
    setGoals(updated);
  };

  // Calculate weighted average score automatically if items have selfRatings
  const calculateWeightedAverage = () => {
    let totalWeightedScore = 0;
    let totalWeightage = 0;
    goals.forEach((g) => {
      const w = parseFloat(g.weightage) || 0;
      const r = parseFloat(g.selfRating) || 0;
      if (w > 0 && r > 0) {
        totalWeightedScore += r * (w / 100);
        totalWeightage += w;
      }
    });
    if (totalWeightage > 0) {
      return (totalWeightedScore * (100 / totalWeightage)).toFixed(2);
    }
    return null;
  };

  const handleSaveDraft = async () => {
    if (isSubmitted) {
      const msg = 'Appraisal is submitted and locked. Contact HR to reopen.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Locked', msg);
      return;
    }
    try {
      setSaving(true);
      const itemsPayload = goals.map((g) => ({
        id: g.id,
        achievement: g.achievement,
        selfRating: g.selfRating ? parseFloat(g.selfRating) : null,
        employeeComment: g.employeeComment,
      }));

      const computedScore = calculateWeightedAverage();

      const payload = {
        cycleId: cycle?.id,
        items: itemsPayload,
        overallSelfRating: overallRating ? parseFloat(overallRating) : (computedScore ? parseFloat(computedScore) : null),
        overallSelfComments: overallComments,
      };

      const res = await api.post('/admin/pms/self-appraisals/save-draft', payload);
      if (res.data?.success) {
        if (Platform.OS === 'web') alert('Draft saved successfully!');
        else Alert.alert('Success', 'Draft saved successfully!');
        if (res.data.appraisal) setAppraisal(res.data.appraisal);
      } else {
        const errMsg = res.data?.message || 'Failed saving draft.';
        if (Platform.OS === 'web') alert(errMsg);
        else Alert.alert('Error', errMsg);
      }
    } catch (e) {
      console.error('Save draft error:', e);
      const errMsg = e.response?.data?.message || 'Failed to save draft';
      if (Platform.OS === 'web') alert(errMsg);
      else Alert.alert('Error', errMsg);
    } finally {
      setSaving(false);
    }
  };

  const doSubmitAppraisal = async () => {
    try {
      setSaving(true);
      const itemsPayload = goals.map((g) => ({
        id: g.id,
        achievement: g.achievement,
        selfRating: g.selfRating ? parseFloat(g.selfRating) : null,
        employeeComment: g.employeeComment,
      }));

      const computedScore = calculateWeightedAverage();

      const payload = {
        cycleId: cycle?.id,
        items: itemsPayload,
        overallSelfRating: overallRating ? parseFloat(overallRating) : (computedScore ? parseFloat(computedScore) : null),
        overallSelfComments: overallComments,
      };

      const res = await api.post('/admin/pms/self-appraisals/submit', payload);
      if (res.data?.success) {
        if (Platform.OS === 'web') alert('Self-Appraisal submitted successfully! Editing is now locked.');
        else Alert.alert('Submitted!', 'Your Self-Appraisal has been submitted successfully.');
        if (res.data.appraisal) setAppraisal(res.data.appraisal);
      } else {
        const errMsg = res.data?.message || 'Failed submitting appraisal.';
        if (Platform.OS === 'web') alert(errMsg);
        else Alert.alert('Error', errMsg);
      }
    } catch (e) {
      console.error('Submit error:', e);
      const errMsg = e.response?.data?.message || 'Failed to submit appraisal';
      if (Platform.OS === 'web') alert(errMsg);
      else Alert.alert('Error', errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAppraisal = async () => {
    if (isSubmitted) return;

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to submit your appraisal? Once submitted, editing will be locked until HR reopens it.')) {
        doSubmitAppraisal();
      }
    } else {
      Alert.alert(
        'Submit Self-Appraisal',
        'Are you sure you want to submit your appraisal? Once submitted, editing will be locked until HR reopens it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit Now',
            onPress: () => doSubmitAppraisal(),
          },
        ]
      );
    }
  };

  const maxPoints = ratingScale?.maxPoints ? parseFloat(ratingScale.maxPoints) : 5;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Appraisal (Self-Assessment)</Text>
        <TouchableOpacity onPress={fetchSelfAppraisal} style={styles.refreshButton}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#0F3B8C" />
          <Text style={styles.loaderText}>Loading Appraisal Data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Cycle Info Banner */}
          {cycle && (
            <View style={styles.cycleCard}>
              <View style={styles.cycleHeaderRow}>
                <Text style={styles.cycleTitle}>{cycle.cycleName || 'Appraisal Cycle'}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    isSubmitted
                      ? styles.statusSubmitted
                      : appraisal?.status === 'REOPENED'
                      ? styles.statusReopened
                      : styles.statusDraft,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {isSubmitted ? 'SUBMITTED (LOCKED)' : appraisal?.status === 'REOPENED' ? 'REOPENED BY HR' : 'DRAFT IN PROGRESS'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cycleDates}>
                Period: {cycle.startDate || 'N/A'} to {cycle.endDate || 'N/A'} | Type: {cycle.cycleType || 'Annual'}
              </Text>
              {appraisal?.reopenReason && appraisal?.status === 'REOPENED' && (
                <View style={styles.reopenReasonBox}>
                  <Text style={styles.reopenReasonText}>HR Note: {appraisal.reopenReason}</Text>
                </View>
              )}
            </View>
          )}

          {/* Status Alert Banner */}
          <View style={[styles.alertBanner, isSubmitted ? styles.alertSubmitted : styles.alertDraft]}>
            <Text style={styles.alertBannerText}>
              {isSubmitted
                ? '🔒 Your self-appraisal has been submitted. Editing is locked. Contact HR if you need changes.'
                : '📝 Enter your achievement, self rating score, and comments for each goal below, then tap Submit.'}
            </Text>
          </View>

          {/* Rating Scale Indicator */}
          {ratingScale && (
            <View style={styles.scaleInfoCard}>
              <Text style={styles.scaleInfoTitle}>
                Active Rating Scale: {ratingScale.scaleName || 'Standard Scale'} (Max Score: {maxPoints})
              </Text>
              {Array.isArray(ratingScale.levels) && ratingScale.levels.length > 0 && (
                <View style={styles.levelsRow}>
                  {ratingScale.levels.slice(0, 5).map((l, idx) => (
                    <View key={idx} style={[styles.levelTag, { backgroundColor: l.color || '#E2E8F0' }]}>
                      <Text style={styles.levelTagText}>
                        {l.score}: {l.title}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Goals / KRAs / KPIs List */}
          <Text style={styles.sectionHeading}>My KRAs & Goals ({goals.length})</Text>

          {goals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No goals assigned for this appraisal cycle yet.</Text>
            </View>
          ) : (
            goals.map((item, idx) => (
              <View key={idx} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.kraTag}>
                    <Text style={styles.kraTagText}>KRA: {item.kraTitle}</Text>
                  </View>
                  <Text style={styles.weightageText}>Weightage: {item.weightage}%</Text>
                </View>

                <Text style={styles.kpiTitleText}>KPI: {item.kpiTitle}</Text>
                <Text style={styles.goalTitleText}>{item.goal}</Text>
                {item.description ? <Text style={styles.goalDescText}>{item.description}</Text> : null}

                <View style={styles.metricRow}>
                  <Text style={styles.targetText}>Target: {item.target || 'N/A'}</Text>
                </View>

                {/* Achievement Input */}
                <Text style={styles.inputLabel}>My Actual Achievement:</Text>
                <TextInput
                  style={[styles.textInput, isSubmitted && styles.inputDisabled]}
                  value={item.achievement}
                  onChangeText={(val) => updateGoalItem(idx, 'achievement', val)}
                  placeholder="Enter actual achievement..."
                  editable={!isSubmitted}
                />

                {/* Self Rating Score Input */}
                <Text style={styles.inputLabel}>My Self Rating Score (Max {maxPoints}):</Text>
                <TextInput
                  style={[styles.textInput, isSubmitted && styles.inputDisabled]}
                  value={item.selfRating}
                  onChangeText={(val) => updateGoalItem(idx, 'selfRating', val)}
                  placeholder={`Score e.g. ${maxPoints}`}
                  keyboardType="numeric"
                  editable={!isSubmitted}
                />

                {/* Self Comments Input */}
                <Text style={styles.inputLabel}>My Comments & Key Remarks:</Text>
                <TextInput
                  style={[styles.textArea, isSubmitted && styles.inputDisabled]}
                  value={item.employeeComment}
                  onChangeText={(val) => updateGoalItem(idx, 'employeeComment', val)}
                  placeholder="Describe your achievements and work done..."
                  multiline
                  numberOfLines={2}
                  editable={!isSubmitted}
                />
              </View>
            ))
          )}

          {/* Overall Remarks */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Overall Self-Assessment Summary</Text>

            <Text style={styles.inputLabel}>Overall Self Rating Score (Optional / Auto-weighted):</Text>
            <TextInput
              style={[styles.textInput, isSubmitted && styles.inputDisabled]}
              value={overallRating}
              onChangeText={setOverallRating}
              placeholder={`Overall Score e.g. ${maxPoints}`}
              keyboardType="numeric"
              editable={!isSubmitted}
            />

            <Text style={styles.inputLabel}>Overall Comments & Key Achievements Summary:</Text>
            <TextInput
              style={[styles.textArea, isSubmitted && styles.inputDisabled]}
              value={overallComments}
              onChangeText={setOverallComments}
              placeholder="Provide an overall summary of your performance during this appraisal period..."
              multiline
              numberOfLines={3}
              editable={!isSubmitted}
            />
          </View>

          {/* Bottom Action Buttons */}
          {!isSubmitted && (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.button, styles.saveDraftButton, saving && styles.buttonDisabled]}
                onPress={handleSaveDraft}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#0F3B8C" size="small" />
                ) : (
                  <Text style={styles.saveDraftButtonText}>Save Draft</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.submitButton, saving && styles.buttonDisabled]}
                onPress={handleSubmitAppraisal}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Appraisal</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <BottomNav navigation={navigation} activeKey="Profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    height: 56,
    backgroundColor: '#0F3B8C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: { padding: 4 },
  backText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  refreshButton: { padding: 4 },
  refreshText: { color: '#FFFFFF', fontSize: 20 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 12, color: '#64748B', fontSize: 14, fontFamily: 'Inter_400Regular' },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  cycleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  cycleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cycleTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#0F3B8C', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusDraft: { backgroundColor: '#FEF3C7' },
  statusSubmitted: { backgroundColor: '#D1FAE5' },
  statusReopened: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#1E293B' },
  cycleDates: { fontSize: 12, color: '#64748B', marginTop: 4, fontFamily: 'Inter_400Regular' },
  reopenReasonBox: { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6, marginTop: 8 },
  reopenReasonText: { fontSize: 11, color: '#991B1B', fontFamily: 'Inter_500Medium' },
  alertBanner: { padding: 12, borderRadius: 10, marginBottom: 14 },
  alertDraft: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  alertSubmitted: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  alertBannerText: { fontSize: 12, color: '#1E293B', fontFamily: 'Inter_500Medium', lineHeight: 17 },
  scaleInfoCard: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, marginBottom: 14 },
  scaleInfoTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#334155', marginBottom: 4 },
  levelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  levelTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  levelTagText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: '#0F172A' },
  sectionHeading: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#0F3B8C', marginBottom: 10 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  emptyText: { color: '#64748B', fontSize: 13, fontFamily: 'Inter_400Regular' },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  kraTag: { backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  kraTagText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#0369A1' },
  weightageText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#0F3B8C' },
  kpiTitleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#475569', marginTop: 2 },
  goalTitleText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#0F172A', marginTop: 4 },
  goalDescText: { fontSize: 12, color: '#64748B', marginTop: 2, fontFamily: 'Inter_400Regular' },
  metricRow: { flexDirection: 'row', marginTop: 6, marginBottom: 8 },
  targetText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#2563EB' },
  inputLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#475569', marginTop: 8, marginBottom: 4 },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Inter_400Regular',
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top',
    minHeight: 60,
  },
  inputDisabled: { backgroundColor: '#F1F5F9', color: '#64748B' },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  summaryTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#0F3B8C', marginBottom: 8 },
  actionButtonsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  button: { flex: 1, height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveDraftButton: { backgroundColor: '#E2E8F0', borderWidth: 1, borderColor: '#CBD5E1' },
  saveDraftButtonText: { color: '#0F3B8C', fontSize: 14, fontFamily: 'Inter_700Bold' },
  submitButton: { backgroundColor: '#0F3B8C' },
  submitButtonText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  buttonDisabled: { opacity: 0.6 },
});

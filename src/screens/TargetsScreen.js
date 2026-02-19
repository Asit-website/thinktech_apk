import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getCurrentTarget, getSalesSummary, getCurrentIncentive } from '../config/api';

export default function TargetsScreen() {
  const navigation = useNavigation();

  // State
  const [period, setPeriod] = React.useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [loading, setLoading] = React.useState(false);
  const [target, setTarget] = React.useState({ targetAmount: 0, targetOrders: 0 });
  const [achieved, setAchieved] = React.useState({ amount: 0, orders: 0 });
  const [incentive, setIncentive] = React.useState(null);

  // Helpers
  const fmtMoney = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
  const percent = React.useMemo(() => {
    const amt = Number(achieved.amount || 0);
    const tgtAmt = Number(target.targetAmount || 0);
    if (!tgtAmt) return 0;
    return Math.max(0, Math.min(100, Math.round((amt / tgtAmt) * 100)));
  }, [achieved, target]);

  // Load target + achieved + incentive
  const load = React.useCallback(async (p) => {
    try {
      setLoading(true);

      // Target for selected period
      const t = await getCurrentTarget(p);
      const tgt = t?.target || {};
      setTarget({
        targetAmount: Number(tgt.targetAmount || 0),
        targetOrders: Number(tgt.targetOrders || 0),
      });

      // Achieved for Daily (extend later for weekly/monthly)
      if (p === 'daily') {
        const todayIso = new Date().toISOString().slice(0, 10);
        const s = await getSalesSummary(todayIso);
        const sum = s?.summary || {};
        setAchieved({ amount: Number(sum.totalAmount || 0), orders: Number(sum.totalOrders || 0) });
      } else {
        setAchieved({ amount: 0, orders: 0 });
      }

      // Incentive for selected period
      const inc = await getCurrentIncentive(p);
      setIncentive(inc?.incentive || null);
    } catch (_) {
      setTarget({ targetAmount: 0, targetOrders: 0 });
      setAchieved({ amount: 0, orders: 0 });
      setIncentive(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(period); }, [period, load]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30, marginLeft: 5, marginRight: 5, borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingTop: 6, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={{ fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' }}>Targets</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 }}>
        {/* Intro */}
        <View style={{ padding: 12, marginBottom: 14 }}>
          <Text style={{ color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20 }}>
            Track your daily, weekly, and monthly progress. Aim to close deals by meeting the targets.
          </Text>
        </View>

        {/* Period selector + Progress card */}
        <View style={{ backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 }}>
          {/* Tabs */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 2, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                {['daily', 'weekly', 'monthly'].map((p) => (
                  <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 }}>
                    <Text style={{ color: period === p ? '#0A7CE6' : '#454545', fontFamily: period === p ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 12 }}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Sales target row with badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ color: '#454545', fontFamily: 'Inter_500Medium', fontSize: 12 }}>Sales target</Text>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0E7FF' }}>
              <Text style={{ color: '#1D4ED8', fontFamily: 'Inter_700Bold', fontSize: 12 }}>{percent}%</Text>
            </View>
          </View>

          {/* Progress bar and values */}
          <View style={{ marginTop: 6 }}>
            <View style={{ height: 6, backgroundColor: '#1e1e1e', borderRadius: 999, overflow: 'hidden' }}>
              <View style={{ width: `${percent}%`, height: '100%', backgroundColor: '#3D8EFF', borderRadius: 999 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: '#454545', fontFamily: 'Inter_500Medium', fontSize: 12 }}>{`${fmtMoney(achieved.amount)} / ${fmtMoney(target.targetAmount)}`}</Text>
              <Text style={{ color: '#454545', fontFamily: 'Inter_500Medium', fontSize: 12 }}>{`Orders: ${achieved.orders}/${target.targetOrders || 0}`}</Text>
            </View>
            {loading ? (
              <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
                <ActivityIndicator size="small" color="#3D8EFF" />
              </View>
            ) : null}
          </View>
        </View>

        {/* Incentive card (dynamic) */}
        <View style={{ backgroundColor: '#F3F4F6', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 }}>
          <Text style={{ color: '#454545', fontFamily: 'Inter_500Medium', marginBottom: 8 }}>Incentive</Text>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 18, marginTop: 18 }}>
            <Text style={{ color: '#1F2937', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
              {incentive?.title || 'Incentive Target'}
            </Text>
            <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ height: 2, backgroundColor: '#16A34A', width: '38%', borderRadius: 2 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={require('../assets/Subtract.png')} style={{ width: 16, height: 16, marginLeft: 12 }} />
                  <Text style={{ color: '#454545', fontFamily: 'Inter_700Bold', fontSize: 10, marginLeft: 6 }}>
                    {`Bonus: ${fmtMoney(incentive?.rewardAmount || 0)}`}
                  </Text>
                </View>
                <Image source={require('../assets/vt.png')} style={{ width: 28, height: 28, marginLeft: 12 }} />
              </View>
            </View>
            <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', fontSize: 11 }}>
                {incentive?.ordersThreshold ? `Reach ${incentive.ordersThreshold} orders` : 'Reach 100% of the target'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
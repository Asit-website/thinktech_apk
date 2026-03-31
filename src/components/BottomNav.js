import React from 'react';
import { View, TouchableOpacity, Image, Text, StyleSheet } from 'react-native';
import { usePermissions } from '../contexts/PermissionsContext';

export default function BottomNav({ navigation, activeKey = 'home', items }) {
  const { hasPermission, subscriptionInfo } = usePermissions();
  const showSales = hasPermission('sales_access');

  const defaultTabs = [
    { key: 'home', label: 'Home', icon: require('../assets/tab1.png'), route: 'Home' },
    { key: 'sales', label: 'Sales', icon: require('../assets/tab2.png'), route: 'Sales', featureFlag: 'salesEnabled' },
    { key: 'Attendance', label: 'Attendance', icon: require('../assets/tab3.png'), route: 'Attendance' },
    { key: 'Salary', label: 'Salary', icon: require('../assets/tab4.png'), route: 'Salary', featureFlag: 'payrollEnabled' },
    { key: 'Profile', label: 'Profile', icon: require('../assets/person-circle.png'), route: 'Profile' },
  ];

  // Filter tabs based on permissions AND subscription info
  const tabs = items || defaultTabs.filter(tab => {
    // 1. Check Permissions
    if (tab.key === 'sales' && !showSales) {
      return false;
    }

    // 2. Check Subscription Feature Flags
    if (tab.featureFlag && subscriptionInfo && subscriptionInfo[tab.featureFlag] === false) {
      return false;
    }

    return true;
  });

  const onPressTab = (t) => {
    if (navigation && t.route) {
      try { navigation.navigate(t.route); } catch (e) {}
    }
  };

  return (
    <View style={styles.wrap}> 
      {tabs.map((t) => {
        const active = activeKey === t.key;
        return (
          <TouchableOpacity key={t.key} style={styles.item} onPress={() => onPressTab(t)} activeOpacity={0.85}>
            <Image source={t.icon} style={{ width: 20, height: 20, opacity: active ? 1 : 0.8 }} />
            <Text style={[styles.label, active && styles.labelActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    backgroundColor: '#0F3B8C', flexDirection: 'row', justifyContent: 'space-between',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { color: '#BFD6FF', fontSize: 10, fontFamily: 'Inter_400Regular' },
  labelActive: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
});

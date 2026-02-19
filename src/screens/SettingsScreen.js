import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';

export default function SettingsScreen({ navigation }) {
  const items = [
    { label: 'Bank Details', icon: require('../assets/setting1.png'), route: 'BankDetails' },
    { label: 'Account Settings', icon: require('../assets/setting2.png'), route: 'AccountSettings' },
    { label: 'General Info', icon: require('../assets/setting3.png'), route: 'GeneralInfo' },
    { label: 'Documents', icon: require('../assets/setting4.png'), route: 'MyDocuments' },
    { label: 'Help and support', icon: require('../assets/setting5.png'), route: 'HelpSupport' },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          {items.map((it, idx) => (
            <View key={it.label}>
              <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => (it.route ? navigation.navigate(it.route) : undefined)}>
                <View style={styles.iconWrap}>
                  <Image source={it.icon} style={{ width: 16, height: 16 }} />
                </View>
                <Text style={styles.rowText}>{it.label}</Text>
                <Image source={require('../assets/pie.png')} style={{ width: 10, height: 10 }} />
              </TouchableOpacity>
              {idx < items.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
    paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30,
    marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3', backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  backBtn: { paddingVertical: 6, paddingRight: 8 },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold', marginLeft: 8 },

  card: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8 },
  iconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#0F3B8C', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowText: { flex: 1, color: '#454545', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#E3E3E3' },
});

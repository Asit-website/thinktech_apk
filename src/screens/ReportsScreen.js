import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';

export default function ReportsScreen({ navigation }) {
  const Item = ({ icon, title, subtitle, onPress }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardLeft}>
        <Image source={icon} style={styles.icon} />
        <View style={styles.cardTexts}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Image source={require('../assets/rightie.png')} style={{ width: 12, height: 12, tintColor: '#125EC9' }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
             <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
               <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
               <Text style={styles.headerTitle}>Reports</Text>
             </TouchableOpacity>
           </View>
     

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Item
          icon={require('../assets/jt1.png')}
          title="Attendance Report"
          subtitle="View your total attendance cycle"
          onPress={() => navigation.navigate('AttendanceReport')}
        />
        {/* <Item
          icon={require('../assets/jt2.png')}
          title="Payment Report"
          subtitle="View your total payment history"
          onPress={() => navigation.navigate('Salary')}
        />
        <Item
          icon={require('../assets/jt3.png')}
          title="Work Report"
          subtitle="View your total work report"
          onPress={() => navigation.navigate('History')}
        /> */}
        <Item
          icon={require('../assets/jt4.png')}
          title="Sales Report"
          subtitle="View your total sales report"
          onPress={() => navigation.navigate('SalesReport')}
        />
        <Item
          icon={require('../assets/jt3.png')}
          title="Salary Report"
          subtitle="View your salary details and breakdown"
          onPress={() => navigation.navigate('SalaryReport')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'start',
    paddingHorizontal: 16, paddingTop: 30, paddingBottom: 30,
    marginLeft: 5, marginRight: 5,
    borderBottomWidth: 1, borderBottomColor: '#B3B3B3',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    // shadowOffset intentionally omitted to match other screens
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    marginBottom:20
  },
  backBtn: { paddingTop:6,paddingBottom:6 },
  backChevron: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 },

  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#125EC9', backgroundColor: '#F3F4F6',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 16,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#E9F1FF', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 20, height: 20, tintColor: '#125EC9' },
  cardTexts: {},
  cardTitle: { color: '#454545', fontFamily: 'Inter_500Medium', fontSize: 14 },
  cardSubtitle: { color: '#454545', fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
});

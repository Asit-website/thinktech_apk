import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { usePermissions } from '../contexts/PermissionsContext';

export default function HomeScreen({ navigation }) {
  const { hasPermission, loading } = usePermissions();

  const showSales = hasPermission('sales_access');

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.phoneFrame}>
        <Text style={styles.heading}>Please choose your preference</Text>

        <View style={styles.menu}>
          <MenuItem
            title="AI Assistant"
            LeftIcon={<Image source={require('../assets/uki.png')} style={{ width: 22, height: 22, tintColor: '#125EC9' }} />}
            onPress={() => navigation.navigate('AIChat')}
          />

          <MenuItem
            title="Attendance"
            LeftIcon={<Image source={require('../assets/journal-text.png')} style={{ width: 18, height: 18 }} />}
            onPress={() => navigation.navigate('Attendance')}
          />

          {showSales && (
            <MenuItem
              title="Sales"
              LeftIcon={<Image source={require('../assets/bar-chart-line.png')} style={{ width: 18, height: 18 }} />}
              onPress={() => navigation.navigate('Sales')}
            />
          )}

          <MenuItem
            title="Report"
            LeftIcon={<Image source={require('../assets/journal-check.png')} style={{ width: 18, height: 18 }} />}
            onPress={() => navigation.navigate('Reports')}
          />

          <MenuItem
            title="Salary"
            LeftIcon={<Image source={require('../assets/currency-rupee.png')} style={{ width: 18, height: 18 }} />}
            onPress={() => navigation.navigate('Salary')}
          />

          <MenuItem
            title="My Task"
            LeftIcon={<Image source={require('../assets/journal-check.png')} style={{ width: 18, height: 18 }} />}
            onPress={() => navigation.navigate('TodoList')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function MenuItem({ title, LeftIcon, onPress, isAI }) {
  return (
    <TouchableOpacity 
      style={[styles.item, isAI && styles.aiItem]} 
      activeOpacity={0.8} 
      onPress={onPress}
    >
      <View style={styles.itemLeft}>
        <View style={styles.iconWrap}>{LeftIcon}</View>
        <Text style={[styles.itemText, isAI && styles.aiItemText]}>{title}</Text>
      </View>
      <Image
        source={require('../assets/Path (Stroke).png')}
        style={[{ width: 12, height: 12 }, isAI && { tintColor: '#fff' }]}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  phoneFrame: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  heading: {
    textAlign: 'center',
    color: '#454545',
    fontSize: 18,
    marginBottom: 45,
    fontFamily: 'Inter_600SemiBold',
  },
  menu: {
    gap: 18,
  },
  item: {
    borderWidth: 1,
    borderColor: '#125EC9',
    backgroundColor: '#F6F9FF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 66,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: '#125EC9',
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
  },
  aiItem: {
    backgroundColor: '#125EC9',
    borderColor: '#125EC9',
  },
  aiItemText: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
});

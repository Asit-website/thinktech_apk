import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
// import { LineChart } from 'react-native-chart-kit';
import { getSalesSummary, getWeeklySales } from '../config/api';
import { Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function SalesReportScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNativePicker, setShowNativePicker] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLeaves, setNotifLeaves] = useState([]);
  const [salesData, setSalesData] = useState({
    totalSales: '--',
    ordersCount: '--',
    revenue: '--',
    weeklySales: [0, 0, 0, 0, 0, 0, 0]
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchSalesData();
  }, [selectedDate]);

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      // Fetch sales notifications if needed
      setNotifLeaves([]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchSalesData = async () => {
    setIsLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      console.log('Fetching sales data for date:', dateStr);
      
      // Fetch real sales summary
      const summaryResponse = await getSalesSummary(dateStr);
      if (summaryResponse.success && summaryResponse.summary) {
        const summary = summaryResponse.summary;
        setSalesData({
          totalSales: summary.totalAmount || 0,
          ordersCount: summary.totalOrders || 0,
          revenue: summary.totalAmount || 0
        });
      }
      
      // Calculate week start and end dates
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const startDateStr = weekStart.toISOString().split('T')[0];
      const endDateStr = weekEnd.toISOString().split('T')[0];
      
      // Fetch weekly sales data
      const weeklyResponse = await getWeeklySales(startDateStr, endDateStr);
      if (weeklyResponse.success && weeklyResponse.data) {
        setSalesData(prev => ({
          ...prev,
          weeklySales: weeklyResponse.data
        }));
      }
      
    } catch (error) {
      console.error('Error fetching sales data:', error);
      // Set default values on error
      setSalesData({
        totalSales: 0,
        ordersCount: 0,
        revenue: 0,
        weeklySales: [0, 0, 0, 0, 0, 0, 0]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

  const openDatePicker = () => {
    if (Platform.OS === 'web') {
      setShowDatePicker(true);
    } else {
      setShowNativePicker(true);
    }
  };

  const openNotifications = () => {
    setNotifOpen(true);
  };

  const onMarkRead = async () => {
    try {
      const latest = notifLeaves
        .map((it) => new Date(it.reviewedAt || it.updatedAt || it.createdAt).getTime())
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => b - a)[0];
      const toStore = latest ? new Date(latest).toISOString() : new Date().toISOString();
      await AsyncStorage.setItem('notif:lastSeenApprovedAt', toStore);
    } catch { }
  };

  const handleDownloadReport = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      console.log('Generating sales report image for date:', dateStr);

      // Create a canvas element to draw the report
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size (A4 ratio)
      canvas.width = 794; // A4 width in pixels at 96 DPI
      canvas.height = 1123; // A4 height in pixels at 96 DPI

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add header
      ctx.fillStyle = '#125EC9';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Sales Report', canvas.width / 2, 80);

      ctx.font = '18px Arial';
      ctx.fillStyle = '#333333';
      ctx.fillText(`Date: ${formatDate(selectedDate)}`, canvas.width / 2, 120);

      // Draw table
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';

      const tableStartY = 180;
      const rowHeight = 40;
      const col1X = 100;
      const col2X = 400;

      // Table headers
      ctx.fillStyle = '#125EC9';
      ctx.fillRect(col1X - 20, tableStartY - 30, canvas.width - 160, 40);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Metric', col1X, tableStartY);
      ctx.fillText('Value', col2X, tableStartY);

      // Table data
      ctx.fillStyle = '#333333';
      ctx.fillText('Total Sales', col1X, tableStartY + rowHeight);
      ctx.fillText(`₹${salesData.totalSales.toLocaleString()}`, col2X, tableStartY + rowHeight);

      ctx.fillText('Orders Count', col1X, tableStartY + rowHeight * 2);
      ctx.fillText(salesData.ordersCount, col2X, tableStartY + rowHeight * 2);

      ctx.fillText('Revenue', col1X, tableStartY + rowHeight * 3);
      ctx.fillText(`₹${salesData.revenue.toLocaleString()}`, col2X, tableStartY + rowHeight * 3);

      // Add footer
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Generated on: ${new Date().toLocaleString()}`, canvas.width / 2, canvas.height - 60);
      ctx.fillText('ThinkTech Sales System', canvas.width / 2, canvas.height - 30);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-report-${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('Sales report image downloaded successfully');
      }, 'image/png');

    } catch (error) {
      console.error('Error generating sales report image:', error);
      alert('Error generating report');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
          <Text style={styles.headerTitle}>Sales Report</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Date Picker Card */}
        <View style={styles.datePickerCard}>
          <View style={styles.datePickerRow}>
            <TouchableOpacity style={styles.datePickerButton} activeOpacity={0.7} onPress={openDatePicker}>
              <Image source={require('../assets/desti.png')} style={{ width: 16, height: 16 }} />
              <Text style={styles.datePickerText}>{formatDate(selectedDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sales Metrics Cards */}
        <View style={styles.salesCardRow}>
          <View style={styles.salesCard}>
            {/* <Image source={require('../assets/clocks.png')} style={styles.salesIcon} /> */}
            <Text style={styles.salesLabel}>Total Sales</Text>
            <Text style={styles.salesValue}>₹{salesData.totalSales}</Text>
          </View>

          <View style={styles.salesCard1}>
            {/* <Image source={require('../assets/hots.png')} style={styles.salesIcon} /> */}
            <Text style={styles.salesLabel1}>Orders</Text>
            <Text style={styles.salesValue}>{salesData.ordersCount}</Text>
          </View>

          <View style={styles.salesCard2}>
            {/* <Image source={require('../assets/desti.png')} style={styles.salesIcon} /> */}
            <Text style={styles.salesLabel2}>Revenue</Text>
            <Text style={styles.salesValue}>₹{salesData.revenue}</Text>
          </View>
        </View>

        {/* Weekly Sales Chart */}
        {/* Weekly Sales Progress */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Weekly Sales Progress</Text>
          <View style={styles.salesProgressCard}>
            {salesData.weeklySales && salesData.weeklySales.length > 0 ? (
              <View style={styles.salesProgressContainer}>
                {salesData.weeklySales.map((amount, index) => {
                  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                  const maxAmount = Math.max(...salesData.weeklySales, 1000); // Scale based on max or minimum 1000
                  const percentage = Math.min((amount / maxAmount) * 100, 100);
                  const colors = ['#10B981', '#059669', '#047857', '#065F46', '#064E3B', '#022C22', '#011F1A'];
                  
                  return (
                    <View key={days[index]} style={styles.salesProgressItem}>
                      <View style={styles.salesProgressHeader}>
                        <Text style={styles.salesProgressLabel}>{days[index]}</Text>
                        <Text style={styles.salesProgressValue}>₹{amount.toLocaleString()}</Text>
                      </View>
                      <View style={styles.salesProgressBarContainer}>
                        <View 
                          style={[
                            styles.salesProgressBar, 
                            { 
                              backgroundColor: colors[index],
                              width: `${Math.max(percentage, 3)}%` // Minimum 3% width for visibility
                            }
                          ]} 
                        />
                      </View>
                      <Text style={styles.salesProgressPercentage}>{percentage.toFixed(0)}%</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
                <Text style={{ color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
                  No sales data available
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* <TouchableOpacity style={styles.downloadButton} activeOpacity={0.85} onPress={handleDownloadReport}>
          <Image source={require('../assets/vix.png')} style={styles.downloadIcon} />
          <Text style={styles.downloadButtonText}>Download</Text>
        </TouchableOpacity> */}
      </ScrollView>

      {/* <BottomNav navigation={navigation} activeKey="Sales" /> */}

      {showDatePicker && (
          <Modal transparent animationType="slide">
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerContainer}>
                <Text style={styles.datePickerTitle}>Select Date</Text>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => handleWebDateChange(e.target.value)}
                  style={styles.webDatePicker}
                />
                <View style={styles.datePickerButtons}>
                  <TouchableOpacity style={styles.datePickerCancel} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.datePickerConfirm} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerConfirmText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Native Date Picker for Android and iOS */}
        {showNativePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleNativeDateChange}
          />
        )}

      {/* Notifications Modal */}
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
                <Text style={styles.notifEmpty}>No notifications yet.</Text>
              ) : (
                notifLeaves.slice(0, 20).map((lv) => (
                  <View key={String(lv.id)} style={styles.notifItem}>
                    <Text style={styles.notifItemTitle}>{lv.title}</Text>
                    <Text style={styles.notifItemText}>{lv.message}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              <TouchableOpacity onPress={onMarkRead} activeOpacity={0.85} style={{ alignSelf: 'flex-end', backgroundColor: '#125EC9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Mark read</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
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
  },
  backBtn: { paddingTop: 6, paddingBottom: 6 },
  backChevron: { fontSize: 18, color: '#125EC9', fontFamily: 'Inter_600SemiBold' },
  headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' },

  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 },
  // content: {
  //   padding: 16,
  //   paddingBottom: 100,
  // },
  datePickerCard: {
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 20
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
    width: "100%"
  },
  datePickerText: {
    color: '#454545',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  salesCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  salesCard: {
    flex: 1,
    backgroundColor: '#DAFFD7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  salesCard1: {
    flex: 1,
    backgroundColor: '#FFD7D7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  salesCard2: {
    flex: 1,
    backgroundColor: '#F4FFD7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  salesIcon: {
    width: 24,
    height: 24,
    marginBottom: 8,
    tintColor: '#ffffff',
  },
  salesLabel: {
    fontSize: 12,
    color: '#35C800',
    marginBottom: 4,
    fontFamily: 'Inter_500Medium',
  },
  salesLabel1: {
    fontSize: 12,
    color: '#E80000',
    marginBottom: 4,
    fontFamily: 'Inter_500Medium',
  },
  salesLabel2: {
    fontSize: 12,
    color: '#929700',
    marginBottom: 4,
    fontFamily: 'Inter_500Medium',
  },
  salesValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#454545',
    fontFamily: 'Inter_700Bold',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#454545',
    marginBottom: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  chart: {
    borderRadius: 16,
  },

  // Sales progress bar styles
  salesProgressCard: { 
    padding: 16, 
    backgroundColor: '#fff', 
    borderRadius: 12,
  },
  salesProgressContainer: { gap: 12 },
  salesProgressItem: { gap: 6 },
  salesProgressHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  salesProgressLabel: { 
    fontFamily: 'Inter_500Medium', 
    color: '#1f2c3a', 
    fontSize: 13,
    width: 40,
  },
  salesProgressValue: { 
    fontFamily: 'Inter_600SemiBold', 
    color: '#10B981', 
    fontSize: 13,
    width: 60,
    textAlign: 'right',
  },
  salesProgressBarContainer: { 
    height: 6, 
    backgroundColor: '#F3F4F6', 
    borderRadius: 3, 
    overflow: 'hidden' 
  },
  salesProgressBar: { 
    height: '100%', 
    borderRadius: 3,
    minWidth: 1, // Ensure minimum visibility
  },
  salesProgressPercentage: { 
    fontFamily: 'Inter_400Regular', 
    color: '#6B7280', 
    fontSize: 11,
    textAlign: 'right',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#125EC9',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 4,
    width: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    position:"fixed",
    bottom:30
  },
  downloadIcon: {
    width: 16,
    height: 16,
    // marginRight: 8,
    tintColor: '#FFFFFF',
  },
  downloadButtonText: {
     color: '#ffffff',
  fontFamily: 'Inter_400Regular',
  fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#454545',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  dateInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#125EC9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  notifPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 300,
    maxHeight: '70%',
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  notifTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#454545',
    fontFamily: 'Inter_600SemiBold',
  },
  notifClose: {
    fontSize: 18,
    color: '#6B7280',
  },
  notifEmpty: {
    textAlign: 'center',
    color: '#6B7280',
    padding: 20,
    fontFamily: 'Inter_400Regular',
  },
  notifItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  notifItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#454545',
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  notifItemText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
});

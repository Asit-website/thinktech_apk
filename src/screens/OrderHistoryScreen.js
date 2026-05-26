import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import BottomNav from '../components/BottomNav';
import { listMyOrders, API_BASE_URL } from '../config/api';

export default function OrderHistoryScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'UPI', 'CASH', 'CREDIT'

  const fetchOrders = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await listMyOrders();
      if (res?.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
      } else {
        console.warn('Failed to load order history:', res?.message);
      }
    } catch (e) {
      console.error('Error fetching order history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders(false);
  };

  const handleCall = (phone) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Calling is not supported on this device');
        }
      })
      .catch((err) => console.error('Error making call:', err));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  };

  const getBadgeStyle = (method) => {
    const m = String(method || '').toUpperCase();
    if (m.includes('ONLINE') || m.includes('UPI')) return [styles.badge, styles.badgeOnline];
    if (m.includes('CASH')) return [styles.badge, styles.badgeCash];
    if (m.includes('CHEQUE')) return [styles.badge, styles.badgeCheque];
    return [styles.badge, styles.badgeOther];
  };

  const getBadgeTextStyle = (method) => {
    const m = String(method || '').toUpperCase();
    if (m.includes('ONLINE') || m.includes('UPI')) return styles.badgeTextOnline;
    if (m.includes('CASH')) return styles.badgeTextCash;
    if (m.includes('CHEQUE')) return styles.badgeTextCheque;
    return styles.badgeTextOther;
  };

  const formatPaymentMethod = (method) => {
    if (!method) return 'N/A';
    const m = String(method).toUpperCase();
    if (m === 'ONLINE' || m === 'UPI') return 'Online';
    if (m === 'CASH') return 'Cash';
    if (m === 'CHEQUE') return 'Cheque';
    return m.charAt(0) + m.slice(1).toLowerCase();
  };

  const renderOrderCard = (order) => {
    const totalQty = (order.items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);

    return (
      <TouchableOpacity
        key={String(order.id)}
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => setSelectedOrder(order)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderDate}>{formatDate(order.orderDate)}</Text>
            <Text style={styles.orderTime}>{formatTime(order.orderDate || order.createdAt)}</Text>
          </View>
          <View style={styles.badgesContainer}>
            <View style={getBadgeStyle(order.paymentMethod)}>
              <Text style={getBadgeTextStyle(order.paymentMethod)}>
                {formatPaymentMethod(order.paymentMethod)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <View style={styles.clientDetails}>
              <Text style={styles.clientName}>{order.client?.name || order.remarks || 'Direct Sales'}</Text>
              <Text style={styles.itemsSummary}>
                {order.items?.length || 0} Products ({totalQty} units)
              </Text>
            </View>
            <View style={styles.amountContainer}>
              <Text style={styles.currencyLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>₹{(Number(order.totalAmount || 0)).toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {order.client?.phone ? (
            <View style={styles.phoneRow}>
              <Image source={require('../assets/telephone.png')} style={styles.phoneIcon} />
              <Text style={styles.phoneText}>{order.client.phone}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.detailsBtnText}>Tap to view full details</Text>
          <Image
            source={require('../assets/stoke.png')}
            style={styles.arrowIcon}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Filter Logic
  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'ALL') return true;
    const m = String(o.paymentMethod || '').toUpperCase();
    if (activeTab === 'CASH') return m.includes('CASH');
    if (activeTab === 'ONLINE') return m.includes('ONLINE') || m.includes('UPI');
    if (activeTab === 'CHEQUE') return m.includes('CHEQUE');
    return true;
  });

  const countOrders = (tab) => {
    return orders.filter((o) => {
      if (tab === 'ALL') return true;
      const m = String(o.paymentMethod || '').toUpperCase();
      if (tab === 'CASH') return m.includes('CASH');
      if (tab === 'ONLINE') return m.includes('ONLINE') || m.includes('UPI');
      if (tab === 'CHEQUE') return m.includes('CHEQUE');
      return false;
    }).length;
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* White Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Image
            source={require('../assets/arrow.png')}
            style={styles.backArrowIcon}
          />
          <Text style={styles.headerTitle}>Order History</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented control tabs (identical to Visit History) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ALL' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
            All ({countOrders('ALL')})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'CASH' && styles.tabButtonActive]}
          onPress={() => setActiveTab('CASH')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'CASH' && styles.tabTextActive]}>
            Cash ({countOrders('CASH')})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ONLINE' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ONLINE')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'ONLINE' && styles.tabTextActive]}>
            Online ({countOrders('ONLINE')})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'CHEQUE' && styles.tabButtonActive]}
          onPress={() => setActiveTab('CHEQUE')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'CHEQUE' && styles.tabTextActive]}>
            Cheque ({countOrders('CHEQUE')})
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#125EC9" />
          <Text style={styles.loaderText}>Loading orders...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#125EC9']}
            />
          }
        >
          {filteredOrders.length > 0 ? (
            filteredOrders.map(renderOrderCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No Orders Found</Text>
              <Text style={styles.emptySubText}>
                {activeTab === 'ALL'
                  ? "You haven't placed any orders yet."
                  : `No orders found with payment mode: ${activeTab}.`}
              </Text>
            </View>
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Detailed Modal */}
      {selectedOrder && (
        <Modal
          visible={!!selectedOrder}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedOrder(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalHeaderTitle}>Order Details</Text>
                  <Text style={styles.modalHeaderSubtitle}>ID: #{selectedOrder.id}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedOrder(null)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Client / Business Details */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Client Details</Text>
                  <View style={styles.detailsBox}>
                    <Text style={styles.detailName}>{selectedOrder.client?.name || 'Direct Sales'}</Text>
                    {selectedOrder.client?.clientType ? (
                      <Text style={styles.detailSub}>{selectedOrder.client.clientType}</Text>
                    ) : null}

                    {selectedOrder.client?.phone ? (
                      <View style={styles.detailCallRow}>
                        <Text style={styles.detailPhone}>{selectedOrder.client.phone}</Text>
                        <TouchableOpacity
                          style={styles.modalCallBtn}
                          onPress={() => handleCall(selectedOrder.client.phone)}
                        >
                          <Image source={require('../assets/telephone.png')} style={styles.callBtnIcon} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Items Checklist Table */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Products Ordered</Text>
                  <View style={styles.itemsTableBox}>
                    {(selectedOrder.items || []).map((item, idx) => (
                      <View key={item.id || String(idx)} style={styles.itemRow}>
                        <View style={styles.itemMain}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {item.size ? (
                            <Text style={styles.itemSize}>Size: {item.size}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.itemQty}>x{item.qty}</Text>
                        <Text style={styles.itemTotal}>₹{(Number(item.qty || 0) * Number(item.price || 0)).toLocaleString('en-IN')}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Pricing Summary */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Pricing Summary</Text>
                  <View style={styles.summaryBox}>
                    <View style={styles.priceSummaryRow}>
                      <Text style={styles.summaryLabel}>Net Amount</Text>
                      <Text style={styles.summaryVal}>₹{(Number(selectedOrder.netAmount || 0)).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.priceSummaryRow}>
                      <Text style={styles.summaryLabel}>GST (18%)</Text>
                      <Text style={styles.summaryVal}>₹{(Number(selectedOrder.gstAmount || 0)).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={[styles.priceSummaryRow, styles.grandTotalRow]}>
                      <Text style={styles.grandLabel}>Grand Total</Text>
                      <Text style={styles.grandVal}>₹{(Number(selectedOrder.totalAmount || 0)).toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>

                {/* Payment Info */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Payment & Details</Text>
                  <View style={styles.detailsBox}>
                    <View style={styles.infoGridRow}>
                      <Text style={styles.infoLabel}>Payment Mode:</Text>
                      <Text style={styles.infoValue}>{formatPaymentMethod(selectedOrder.paymentMethod)}</Text>
                    </View>
                    {selectedOrder.remarks ? (
                      <View style={[styles.infoGridRow, { marginTop: 8 }]}>
                        <Text style={styles.infoLabel}>Remarks:</Text>
                        <Text style={styles.infoValue}>{selectedOrder.remarks}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Location captured details */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Capture Geo-Location</Text>
                  <View style={styles.detailsBox}>
                    {selectedOrder.checkInLat && selectedOrder.checkInLng ? (
                      <View>
                        <View style={styles.geoCoordsRow}>
                          <Text style={styles.coordLabel}>Latitude:</Text>
                          <Text style={styles.coordVal}>{Number(selectedOrder.checkInLat).toFixed(6)}</Text>
                        </View>
                        <View style={[styles.geoCoordsRow, { marginTop: 4 }]}>
                          <Text style={styles.coordLabel}>Longitude:</Text>
                          <Text style={styles.coordVal}>{Number(selectedOrder.checkInLng).toFixed(6)}</Text>
                        </View>
                        {selectedOrder.checkInAltitude ? (
                          <View style={[styles.geoCoordsRow, { marginTop: 4 }]}>
                            <Text style={styles.coordLabel}>Altitude:</Text>
                            <Text style={styles.coordVal}>{Number(selectedOrder.checkInAltitude).toFixed(2)} m</Text>
                          </View>
                        ) : null}
                        {selectedOrder.checkInAddress ? (
                          <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 }}>
                            <Text style={styles.coordLabel}>Address:</Text>
                            <Text style={styles.addressText}>{selectedOrder.checkInAddress}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.noGeoText}>No Location data captured</Text>
                    )}
                  </View>
                </View>

                {/* Attachment Proof */}
                {selectedOrder.proofUrl ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Proof Attachment</Text>
                    <View style={styles.proofContainer}>
                      <Image
                        source={{ uri: `${API_BASE_URL}${selectedOrder.proofUrl}` }}
                        style={styles.proofImage}
                        resizeMode="cover"
                      />
                    </View>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      <BottomNav navigation={navigation} activeKey="sales" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 70,
    paddingTop: 6,
    paddingBottom: 6,
  },
  backArrowIcon: {
    width: 18,
    height: 12,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: '#125EC9',
    fontFamily: 'Inter_600SemiBold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#125EC9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loaderText: {
    marginTop: 12,
    color: '#6B7280',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#F8FAFF',
    borderColor: '#E6EEFF',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E6EEFF',
    paddingBottom: 10,
    marginBottom: 10,
  },
  orderDate: {
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
  },
  orderTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOnline: {
    backgroundColor: '#ECFDF5',
  },
  badgeCash: {
    backgroundColor: '#EFF6FF',
  },
  badgeCheque: {
    backgroundColor: '#FAF5FF',
  },
  badgeOther: {
    backgroundColor: '#F3F4F6',
  },
  badgeTextOnline: {
    color: '#059669',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeTextCash: {
    color: '#2563EB',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeTextCheque: {
    color: '#7C3AED',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeTextOther: {
    color: '#4B5563',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  cardContent: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientDetails: {
    flex: 1,
    paddingRight: 8,
  },
  clientName: {
    fontSize: 15,
    color: '#1E293B',
    fontFamily: 'Inter_600SemiBold',
  },
  itemsSummary: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  currencyLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'Inter_400Regular',
  },
  totalAmount: {
    fontSize: 16,
    color: '#10B981',
    fontFamily: 'Inter_700Bold',
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6EEFF',
  },
  phoneIcon: {
    width: 14,
    height: 14,
    tintColor: '#94A3B8',
  },
  phoneText: {
    fontSize: 12,
    color: '#475569',
    marginLeft: 6,
    fontFamily: 'Inter_400Regular',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#475569',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 18,
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#475569',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  modalScroll: {
    // No flex: 1 to prevent layout collapse in unbounded containers on Android
  },
  modalScrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
  },
  detailsBox: {
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EEFF',
  },
  detailName: {
    fontSize: 16,
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
  },
  detailSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  detailCallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6EEFF',
    paddingTop: 8,
  },
  detailPhone: {
    fontSize: 14,
    color: '#1E293B',
    fontFamily: 'Inter_500Medium',
  },
  modalCallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnIcon: {
    width: 14,
    height: 14,
    tintColor: '#059669',
  },
  itemsTableBox: {
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EEFF',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EEFF',
  },
  itemMain: {
    flex: 2,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
  },
  itemSize: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  itemQty: {
    flex: 0.5,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  itemTotal: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'right',
    fontFamily: 'Inter_600SemiBold',
  },
  summaryBox: {
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6EEFF',
  },
  priceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  summaryVal: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Inter_500Medium',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E6EEFF',
    paddingTop: 10,
    marginTop: 6,
  },
  grandLabel: {
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Inter_700Bold',
  },
  grandVal: {
    fontSize: 16,
    color: '#10B981',
    fontFamily: 'Inter_700Bold',
  },
  infoGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  infoValue: {
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
  },
  geoCoordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coordLabel: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
  },
  coordVal: {
    fontSize: 12,
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
  },
  addressText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 4,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },
  noGeoText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  proofContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6EEFF',
    height: 200,
    backgroundColor: '#F1F5F9',
  },
  proofImage: {
    width: '100%',
    height: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E6EEFF',
    paddingTop: 10,
    marginTop: 12,
  },
  detailsBtnText: {
    fontFamily: 'Inter_500Medium',
    color: '#125EC9',
    fontSize: 12,
  },
  arrowIcon: {
    width: 12,
    height: 12,
    tintColor: '#125EC9',
  },
});

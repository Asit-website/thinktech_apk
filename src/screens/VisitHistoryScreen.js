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
import { listMyVisits, API_BASE_URL } from '../config/api';

export default function VisitHistoryScreen({ navigation }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'VERIFIED', 'PENDING'

  const fetchVisits = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await listMyVisits();
      if (res?.success && Array.isArray(res.visits)) {
        setVisits(res.visits);
      } else {
        console.warn('Failed to load visit history:', res?.message);
      }
    } catch (e) {
      console.error('Error fetching visit history:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVisits(false);
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

  const renderVisitCard = (visit) => {
    const isVerified = visit.verified === true || visit.verified === 1 || String(visit.verified) === 'true';
    const hasOrder = visit.madeOrder === true || visit.madeOrder === 1 || String(visit.madeOrder) === 'true';

    return (
      <TouchableOpacity
        key={String(visit.id)}
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => setSelectedVisit(visit)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.visitDate}>{formatDate(visit.visitDate)}</Text>
            <Text style={styles.visitTime}>{formatTime(visit.visitDate || visit.createdAt)}</Text>
          </View>
          <View style={styles.badgesContainer}>
            {isVerified ? (
              <View style={[styles.badge, styles.badgeVerified]}>
                <Text style={styles.badgeTextVerified}>Verified</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgePending]}>
                <Text style={styles.badgeTextPending}>Pending</Text>
              </View>
            )}
            {hasOrder && (
              <View style={[styles.badge, styles.badgeOrder]}>
                <Text style={styles.badgeTextOrder}>Order Made</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <View style={styles.clientDetails}>
              <Text style={styles.clientName}>{visit.clientName || 'Unnamed Client'}</Text>
              {visit.clientType ? (
                <Text style={styles.clientType}>{visit.clientType}</Text>
              ) : null}
            </View>
            {visit.phone ? (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(visit.phone)}
              >
                <Image
                  source={require('../assets/telephone.png')}
                  style={styles.callIcon}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {visit.visitType ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Visit Type:</Text>
              <Text style={styles.metaValue}>{visit.visitType}</Text>
            </View>
          ) : null}

          {visit.checkInAddress || visit.location ? (
            <View style={styles.addressRow}>
              <Image
                source={require('../assets/desti.png')}
                style={styles.addressIcon}
              />
              <Text style={styles.addressText} numberOfLines={2}>
                {visit.checkInAddress || visit.location}
              </Text>
            </View>
          ) : null}

          {hasOrder && visit.amount > 0 ? (
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Order Value:</Text>
              <Text style={styles.amountValue}>₹ {Number(visit.amount).toLocaleString('en-IN')}</Text>
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

  const filteredVisits = visits.filter(visit => {
    const isVerified = visit.verified === true || visit.verified === 1 || String(visit.verified) === 'true';
    if (activeTab === 'VERIFIED') return isVerified;
    if (activeTab === 'PENDING') return !isVerified;
    return true;
  });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Image
            source={require('../assets/arrow.png')}
            style={styles.backArrowIcon}
          />
          <Text style={styles.headerTitle}>Visit History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ALL' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
            All ({visits.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'VERIFIED' && styles.tabButtonActive]}
          onPress={() => setActiveTab('VERIFIED')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'VERIFIED' && styles.tabTextActive]}>
            Verified ({visits.filter(v => v.verified === true || v.verified === 1 || String(v.verified) === 'true').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'PENDING' && styles.tabButtonActive]}
          onPress={() => setActiveTab('PENDING')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'PENDING' && styles.tabTextActive]}>
            Unverified ({visits.filter(v => !(v.verified === true || v.verified === 1 || String(v.verified) === 'true')).length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading && visits.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#125EC9" />
          <Text style={styles.loaderText}>Loading history...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#125EC9']}
            />
          }
        >
          {filteredVisits.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Image
                source={require('../assets/cal.png')}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyText}>
                {activeTab === 'ALL'
                  ? 'No visit history found'
                  : activeTab === 'VERIFIED'
                  ? 'No verified visits found'
                  : 'No unverified visits found'}
              </Text>
              <Text style={styles.emptySubText}>
                Visits submitted using the Visit Form will show up here.
              </Text>
            </View>
          ) : (
            filteredVisits.map(renderVisitCard)
          )}
        </ScrollView>
      )}

      {/* Detailed Visit Modal */}
      <Modal
        visible={!!selectedVisit}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedVisit(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Visit Details</Text>
              <TouchableOpacity onPress={() => setSelectedVisit(null)}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedVisit ? (
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Client Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Client Name</Text>
                    <Text style={styles.detailValue}>
                      {selectedVisit.clientName || '--'}
                    </Text>
                  </View>
                  {selectedVisit.phone && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phone Number</Text>
                      <TouchableOpacity onPress={() => handleCall(selectedVisit.phone)}>
                        <Text style={[styles.detailValue, styles.linkText]}>
                          {selectedVisit.phone}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {selectedVisit.clientType && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Client Type</Text>
                      <Text style={styles.detailValue}>{selectedVisit.clientType}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Visit Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedVisit.visitDate)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Time</Text>
                    <Text style={styles.detailValue}>
                      {formatTime(selectedVisit.visitDate || selectedVisit.createdAt)}
                    </Text>
                  </View>
                  {selectedVisit.visitType && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Visit Type</Text>
                      <Text style={styles.detailValue}>{selectedVisit.visitType}</Text>
                    </View>
                  )}
                  {selectedVisit.salesPerson && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Salesperson</Text>
                      <Text style={styles.detailValue}>{selectedVisit.salesPerson}</Text>
                    </View>
                  )}
                  {selectedVisit.madeOrder && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Order Amount</Text>
                      <Text style={styles.detailValue}>
                        ₹ {Number(selectedVisit.amount).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        selectedVisit.verified ? styles.textVerified : styles.textPending,
                      ]}
                    >
                      {selectedVisit.verified ? 'Verified' : 'Pending Verification'}
                    </Text>
                  </View>
                </View>

                {(selectedVisit.checkInLat || selectedVisit.checkInAddress) && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>GPS & Location Info</Text>
                    {selectedVisit.checkInAddress && (
                      <View style={styles.detailRowCol}>
                        <Text style={styles.detailLabel}>Check-In Address</Text>
                        <Text style={styles.addressValueText}>
                          {selectedVisit.checkInAddress}
                        </Text>
                      </View>
                    )}
                    {selectedVisit.checkInLat && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Coordinates</Text>
                        <Text style={styles.detailValue}>
                          {Number(selectedVisit.checkInLat).toFixed(6)}, {Number(selectedVisit.checkInLng).toFixed(6)}
                        </Text>
                      </View>
                    )}
                    {selectedVisit.checkInAltitude ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Altitude</Text>
                        <Text style={styles.detailValue}>
                          {Number(selectedVisit.checkInAltitude).toFixed(1)} m
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {(selectedVisit.clientOtp || selectedVisit.clientSignatureUrl) && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Verification Data</Text>
                    {selectedVisit.clientOtp && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>OTP Code Used</Text>
                        <Text style={styles.detailValue}>{selectedVisit.clientOtp}</Text>
                      </View>
                    )}
                    {selectedVisit.clientSignatureUrl && (
                      <View style={styles.signatureContainer}>
                        <Text style={styles.detailLabel}>Client Signature</Text>
                        <Image
                          source={{ uri: `${API_BASE_URL}${selectedVisit.clientSignatureUrl}` }}
                          style={styles.signatureImage}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <BottomNav navigation={navigation} activeKey="sales" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 220,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    tintColor: '#CBD5E1',
    marginBottom: 16,
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
  visitDate: {
    fontFamily: 'Inter_600SemiBold',
    color: '#1E293B',
    fontSize: 14,
  },
  visitTime: {
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  badgesContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeVerified: {
    backgroundColor: '#D1FAE5',
  },
  badgePending: {
    backgroundColor: '#FFEDD5',
  },
  badgeOrder: {
    backgroundColor: '#DDBEFE',
  },
  badgeTextVerified: {
    color: '#065F46',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeTextPending: {
    color: '#9A3412',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  badgeTextOrder: {
    color: '#6B21A8',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  cardContent: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontFamily: 'Inter_600SemiBold',
    color: '#1E293B',
    fontSize: 15,
  },
  clientType: {
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  callButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#125EC9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  callIcon: {
    width: 14,
    height: 14,
    tintColor: '#ffffff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    fontSize: 12,
  },
  metaValue: {
    fontFamily: 'Inter_500Medium',
    color: '#334155',
    fontSize: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  addressIcon: {
    width: 14,
    height: 14,
    tintColor: '#64748B',
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  amountLabel: {
    fontFamily: 'Inter_400Regular',
    color: '#475569',
    fontSize: 11,
    marginRight: 4,
  },
  amountValue: {
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
    fontSize: 12,
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

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    backgroundColor: '#ffffff',
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
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  modalCloseBtn: {
    fontSize: 20,
    color: '#94A3B8',
    paddingHorizontal: 8,
  },
  modalScrollContent: {
    padding: 16,
  },
  modalSection: {
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#125EC9',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailRowCol: {
    flexDirection: 'column',
    gap: 4,
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#1E293B',
    textAlign: 'right',
  },
  addressValueText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#1E293B',
    lineHeight: 18,
  },
  linkText: {
    color: '#125EC9',
    textDecorationLine: 'underline',
  },
  textVerified: {
    color: '#059669',
    fontFamily: 'Inter_600SemiBold',
  },
  textPending: {
    color: '#D97706',
    fontFamily: 'Inter_600SemiBold',
  },
  signatureContainer: {
    marginTop: 10,
    alignItems: 'center',
    gap: 8,
  },
  signatureImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
});

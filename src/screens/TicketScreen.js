import React, { useState, useEffect } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    FlatList,
    Modal,
    TextInput,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
    Alert,
    Platform,
    Linking
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { listMyTickets, createTicket, updateTicket, updateTicketStatus, listStaffForAllocation, API_BASE_URL } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STATUS_OPTIONS = [
    { label: 'Schedule', value: 'SCHEDULE', color: '#6366F1', bg: '#EEF2FF' },
    { label: 'In Progress', value: 'IN_PROGRESS', color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Review', value: 'REVIEW', color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Done', value: 'DONE', color: '#10B981', bg: '#ECFDF5' },
];

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];

export default function TicketScreen({ navigation, route }) {
    const [tickets, setTickets] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterTab, setFilterTab] = useState(route?.params?.initialStatus || 'SCHEDULE');

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);

    // New Ticket State
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newPriority, setNewPriority] = useState('MEDIUM');
    const [newAllocatedTo, setNewAllocatedTo] = useState(null);
    const [newDueDate, setNewDueDate] = useState(new Date());
    const [newTicketId, setNewTicketId] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Update State
    const [updateRemarks, setUpdateRemarks] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingTicketId, setEditingTicketId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 3;

    useEffect(() => {
        fetchData();
    }, []);

    const filtered = tickets.filter(t => t.status === filterTab);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        if (route?.params?.initialStatus) {
            setFilterTab(route.params.initialStatus);
        }
    }, [route?.params?.initialStatus]);

    const fetchData = async () => {
        try {
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) setCurrentUser(JSON.parse(userStr));

            const [tData, sData] = await Promise.all([
                listMyTickets(),
                listStaffForAllocation()
            ]);
            setTickets(tData);
            setStaff(sData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setCurrentPage(1);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });
        if (!result.canceled) {
            setAttachment(result.assets[0]);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied', 'Camera access is required to take photos');
            return;
        }
        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.7,
        });
        if (!result.canceled) {
            setAttachment(result.assets[0]);
        }
    };

    const handleCreate = async () => {
        if (!newTitle || !newAllocatedTo || !newTicketId) {
            Alert.alert('Error', 'Please enter Title, Ticket ID and select staff');
            return;
        }
        try {
            const formData = new FormData();
            formData.append('title', newTitle);
            formData.append('ticketId', newTicketId);
            formData.append('description', newDesc);
            formData.append('priority', newPriority);
            formData.append('allocatedTo', String(newAllocatedTo));
            formData.append('dueDate', newDueDate ? (newDueDate instanceof Date ? newDueDate.toISOString().split('T')[0] : newDueDate) : '');

            if (attachment && attachment.uri) {
                const fileName = attachment.uri.split('/').pop() || 'ticket_attachment.jpg';
                formData.append('attachment', {
                    uri: attachment.uri,
                    name: fileName,
                    type: 'image/jpeg',
                });
            }

            const res = isEditMode
                ? await updateTicket(editingTicketId, formData)
                : await createTicket(formData);

            setShowCreateModal(false);
            resetCreateForm();
            fetchData();
        } catch (e) {
            const errMsg = e?.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} ticket`;
            Alert.alert('Error', errMsg);
        }
    };

    const openEditModal = (ticket) => {
        setIsEditMode(true);
        setEditingTicketId(ticket.id);
        setNewTitle(ticket.title || '');
        setNewTicketId(ticket.ticketId || '');
        setAttachment(null);
        setNewDesc(ticket.description || '');
        setNewPriority(ticket.priority || 'MEDIUM');
        setNewAllocatedTo(ticket.allocatedTo);
        setNewDueDate(ticket.dueDate ? new Date(ticket.dueDate) : new Date());
        setShowCreateModal(true);
    };

    const resetCreateForm = () => {
        setNewTitle('');
        setNewTicketId('');
        setAttachment(null);
        setNewDesc('');
        setNewPriority('MEDIUM');
        setNewAllocatedTo(null);
        setNewDueDate(new Date());
        setIsEditMode(false);
        setEditingTicketId(null);
    };

    const handleUpdateStatus = async (ticketId, newStatus) => {
        try {
            await updateTicketStatus(ticketId, { status: newStatus, remarks: updateRemarks });
            setShowDetailModal(false);
            setUpdateRemarks('');
            fetchData();
        } catch (e) {
            const errMsg = e?.response?.data?.message || 'Failed to update ticket';
            Alert.alert('Error', errMsg);
        }
    };

    const renderTicketItem = ({ item }) => {
        const currentStatus = STATUS_OPTIONS.find(s => s.value === item.status) || STATUS_OPTIONS[0];
        const isCreator = Number(item.allocatedBy) === Number(currentUser?.id);
        const isAssignedToMe = Number(item.allocatedTo) === Number(currentUser?.id);

        const isOverdue = item.dueDate && new Date(item.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && item.status !== 'DONE';
        const isDueToday = item.dueDate && new Date(item.dueDate).setHours(0,0,0,0) === new Date().setHours(0,0,0,0) && item.status !== 'DONE';

        let closedByText = "CLOSED BY ADMIN";
        if (item.isClosed && item.closedBy?.profile?.name) {
            closedByText = `CLOSED BY ${item.closedBy.profile.name.toUpperCase()}`;
        }

        return (
            <TouchableOpacity
                style={styles.ticketCard}
                onPress={() => {
                    setSelectedTicket(item);
                    setUpdateRemarks(item.remarks || '');
                    setShowDetailModal(true);
                }}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
                        <Text style={styles.priorityText}>{item.priority}</Text>
                    </View>
                    <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#F3F4F6', borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#6B7280' }}>ID: {item.ticketId}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: currentStatus.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: currentStatus.color }]}>{currentStatus.label}</Text>
                    </View>
                    {(isOverdue || isDueToday) && (
                        <View style={[styles.overdueBadge, { backgroundColor: isOverdue ? '#FEE2E2' : '#FEF3C7' }]}>
                            <Text style={[styles.overdueBadgeText, { color: isOverdue ? '#EF4444' : '#D97706' }]}>
                                {isOverdue ? 'OVERDUE' : 'DUE TODAY'}
                            </Text>
                        </View>
                    )}
                </View>

                <Text style={styles.ticketTitle}>{item.title}</Text>
                <Text style={styles.ticketDesc} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.timestampText}>
                    Created: {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
                {item.dueDate && (
                    <Text style={[styles.timestampText, { color: isOverdue ? '#EF4444' : '#6B7280' }]}>
                        Due Date: {new Date(item.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </Text>
                )}

                {item.remarks ? (
                    <View style={styles.remarksBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.remarksLabel}>
                                Update by {item.updater?.profile?.name || (item.updater ? 'Staff' : 'Unknown')}:
                            </Text>
                            <Text style={styles.remarksTime}>
                                {new Date(item.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </Text>
                        </View>
                        <Text style={styles.remarksText}>{item.remarks}</Text>
                    </View>
                ) : null}

                <View style={[styles.cardFooter, { justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {isCreator && !item.isClosed && (
                            <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
                                <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                        )}
                        {item.attachment && (
                            <TouchableOpacity 
                                style={[styles.editBtn, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]} 
                                onPress={() => {
                                    const url = `${API_BASE_URL}${item.attachment}`;
                                    Linking.openURL(url).catch(err => Alert.alert('Error', 'Cannot open link'));
                                }}
                            >
                                <Text style={[styles.editBtnText, { color: '#10B981' }]}>View Attachment</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.allocationText}>
                        To: <Text style={{ fontWeight: '700' }}>{item.assignee?.profile?.name || 'Staff'}</Text>
                        {'  |  '}By: <Text style={{ fontWeight: '700' }}>{item.creator?.profile?.name || 'Admin'}</Text>
                    </Text>
                </View>
                {item.isClosed && (
                    <View style={{ marginTop: 10, padding: 6, backgroundColor: '#FFF1F2', borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ color: '#E11D48', fontWeight: '800', fontSize: 10 }}>🔒 {closedByText}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const getPriorityColor = (p) => {
        if (p === 'HIGH') return '#FEE2E2';
        if (p === 'MEDIUM') return '#FEF3C7';
        return '#F3F4F6';
    };

    const filteredTickets = tickets.filter(t => t.status === filterTab);

    return (
        <SafeAreaView style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Image source={require('../assets/arrow.png')} style={styles.backIcon} />
                    <Text style={styles.headerTitle}>Tickets</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabBar}>
                {STATUS_OPTIONS.map(tab => (
                    <TouchableOpacity
                        key={tab.value}
                        style={[styles.tab, filterTab === tab.value && styles.activeTab]}
                        onPress={() => {
                        setFilterTab(tab.value);
                        setCurrentPage(1);
                    }}
                    >
                        <Text style={[styles.tabText, filterTab === tab.value && styles.activeTabText]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#125EC9" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={paginated}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderTicketItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyText}>No {filterTab.toLowerCase().replace('_', ' ')} tickets found</Text>
                        </View>
                    }
                    ListFooterComponent={totalPages > 1 ? (
                        <View style={styles.paginationContainer}>
                            <TouchableOpacity 
                                style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} 
                                onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
                            </TouchableOpacity>
                            
                            <Text style={styles.pageIndicator}>{currentPage} / {totalPages}</Text>

                            <TouchableOpacity 
                                style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]} 
                                onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                            </TouchableOpacity>
                        </View>
                    ) : <View style={{ height: 100 }} />}
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.8}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Create Modal */}
            <Modal visible={showCreateModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalHeader}>{isEditMode ? 'Edit Ticket' : 'Assign New Ticket'}</Text>
                        <ScrollView>
                            <Text style={styles.label}>Ticket ID (Mandatory & Unique)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="E.g. TKT-001"
                                value={newTicketId}
                                onChangeText={setNewTicketId}
                            />

                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="E.g. Fix login issue"
                                value={newTitle}
                                onChangeText={setNewTitle}
                            />

                            <Text style={styles.label}>Attachment</Text>
                            <View style={styles.attachmentRow}>
                                <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                                    <Text style={styles.attachBtnText}>Gallery</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.attachBtn} onPress={takePhoto}>
                                    <Text style={styles.attachBtnText}>Camera</Text>
                                </TouchableOpacity>
                                {attachment && (
                                    <View style={styles.attachmentBadge}>
                                        <Text style={styles.attachmentBadgeText}>Selected</Text>
                                        <TouchableOpacity onPress={() => setAttachment(null)}>
                                            <Text style={{ marginLeft: 5, color: '#EF4444' }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, { height: 80 }]}
                                multiline
                                placeholder="Detail of the task..."
                                value={newDesc}
                                onChangeText={setNewDesc}
                            />

                            <Text style={styles.label}>Priority</Text>
                            <View style={styles.optionRow}>
                                {PRIORITY_OPTIONS.map(p => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[styles.optionBtn, newPriority === p && styles.activeOption]}
                                        onPress={() => setNewPriority(p)}
                                    >
                                        <Text style={[styles.optionText, newPriority === p && styles.activeOptionText]}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Allocate To</Text>
                            <View style={styles.staffGrid}>
                                {staff.map(s => (
                                    <TouchableOpacity
                                        key={s.id}
                                        style={[styles.staffBtn, newAllocatedTo === s.id && styles.activeStaff]}
                                        onPress={() => setNewAllocatedTo(s.id)}
                                    >
                                        <Text style={[styles.staffText, newAllocatedTo === s.id && styles.activeStaffText]}>{s.profile?.name || 'Unknown'}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Due Date</Text>
                            <TouchableOpacity
                                style={styles.input}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={{ color: newDueDate ? '#1F2937' : '#9CA3AF' }}>
                                    {newDueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                </Text>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={newDueDate || new Date()}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) {
                                            setNewDueDate(selectedDate);
                                        }
                                    }}
                                />
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity 
                                onPress={() => { setShowCreateModal(false); resetCreateForm(); }} 
                                style={styles.cancelBtn}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreate} style={styles.submitBtn}>
                                <Text style={styles.submitText}>{isEditMode ? 'Update Ticket' : 'Assign Ticket'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Detail Modal */}
            <Modal visible={showDetailModal} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        {selectedTicket && (
                            <>
                                <Text style={styles.modalHeader}>{selectedTicket.title}</Text>
                                <ScrollView>
                                    <Text style={styles.detailDesc}>{selectedTicket.description || 'No description'}</Text>

                                    <View style={styles.detailMeta}>
                                        <Text style={styles.metaLabel}>Assigned By: <Text style={styles.metaValue}>{selectedTicket.creator?.profile?.name || '-'}</Text></Text>
                                        <Text style={styles.metaLabel}>Assigned To: <Text style={styles.metaValue}>{selectedTicket.assignee?.profile?.name || '-'}</Text></Text>
                                        {selectedTicket.updater && (
                                            <Text style={styles.metaLabel}>Last Updated By: <Text style={styles.metaValue}>{selectedTicket.updater?.profile?.name || '-'}</Text></Text>
                                        )}
                                    </View>

                                    <Text style={[styles.label, { marginTop: 20 }]}>Remarks (Update as progress happens)</Text>
                                    <TextInput
                                        style={[styles.input, { height: 60 }, selectedTicket.isClosed && { opacity: 0.6 }]}
                                        multiline
                                        editable={!selectedTicket.isClosed}
                                        placeholder="Your latest update..."
                                        value={updateRemarks}
                                        onChangeText={setUpdateRemarks}
                                    />

                                    {selectedTicket.attachment && (
                                        <View style={{ marginTop: 16 }}>
                                            <Text style={styles.label}>Attachment</Text>
                                            <TouchableOpacity 
                                                style={styles.attachBtn} 
                                                onPress={() => {
                                                    const url = `${API_BASE_URL}${selectedTicket.attachment}`;
                                                    Linking.openURL(url).catch(err => Alert.alert('Error', 'Cannot open link'));
                                                }}
                                            >
                                                <Text style={styles.attachBtnText}>View Attachment</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <Text style={styles.label}>Change Status To:</Text>
                                    <View style={styles.statusRow}>
                                        {STATUS_OPTIONS.map(s => (
                                            <TouchableOpacity
                                                key={s.value}
                                                disabled={selectedTicket.isClosed}
                                                style={[
                                                    styles.statusBtn,
                                                    { borderColor: s.color },
                                                    selectedTicket.status === s.value && { backgroundColor: s.color },
                                                    selectedTicket.isClosed && { opacity: 0.5 }
                                                ]}
                                                onPress={() => {
                                                    if (selectedTicket.isClosed) {
                                                        Alert.alert('Locked', 'This ticket is closed by admin and cannot be modified');
                                                        return;
                                                    }
                                                    handleUpdateStatus(selectedTicket.id, s.value);
                                                }}
                                            >
                                                <Text style={[styles.statusBtnText, { color: s.color }, selectedTicket.status === s.value && { color: '#fff' }]}>{s.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {selectedTicket.isClosed && (
                                        <View style={{ marginTop: 20, padding: 12, backgroundColor: '#FFF1F2', borderRadius: 12, alignItems: 'center' }}>
                                            <Text style={{ color: '#E11D48', fontWeight: '800', fontSize: 13 }}>
                                                🔒 {selectedTicket.closedBy?.profile?.name ? `CLOSED BY ${selectedTicket.closedBy.profile.name.toUpperCase()}` : 'CLOSED BY ADMIN'}
                                            </Text>
                                            <Text style={{ color: '#E11D48', fontSize: 11, marginTop: 2 }}>This ticket is finished and locked</Text>
                                        </View>
                                    )}
                                </ScrollView>

                                <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeBtn}>
                                    <Text style={styles.closeText}>Close</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    backIcon: { width: 18, height: 12, marginRight: 10, tintColor: '#125EC9' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },

    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#125EC9',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#125EC9',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    fabText: {
        color: '#fff',
        fontSize: 32,
        marginTop: -4,
    },

    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    activeTab: { backgroundColor: '#125EC9', borderColor: '#125EC9' },
    tabText: { fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' },
    activeTabText: { color: '#fff' },

    list: { padding: 16 },
    ticketCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    priorityText: { fontSize: 10, fontWeight: '800', color: '#4B5563' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusBadgeText: { fontSize: 10, fontWeight: '800' },
    overdueBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
    overdueBadgeText: { fontSize: 10, fontWeight: '800' },
    ticketTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
    ticketDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 18 },

    remarksBox: {
        backgroundColor: '#F3F4F6',
        padding: 10,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#D1D5DB'
    },
    remarksLabel: { fontSize: 10, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' },
    remarksTime: { fontSize: 9, fontWeight: '600', color: '#9CA3AF' },
    remarksText: { fontSize: 13, color: '#374151', fontStyle: 'italic', marginTop: 2 },

    timestampText: { fontSize: 10, color: '#9CA3AF', marginBottom: 8, fontStyle: 'italic' },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
    allocationText: { fontSize: 11, color: '#9CA3AF' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: '60%' },
    modalHeader: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 20 },
    label: { fontSize: 12, color: '#6B7280', fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
    input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 14 },

    optionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    optionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
    activeOption: { backgroundColor: '#EBF3FF', borderColor: '#125EC9' },
    optionText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
    activeOptionText: { color: '#125EC9' },

    staffGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    staffBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6', backgroundColor: '#F9FAFB' },
    activeStaff: { backgroundColor: '#125EC9', borderColor: '#125EC9' },
    staffText: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
    activeStaffText: { color: '#fff' },

    modalFooter: { flexDirection: 'row', gap: 12, marginTop: 10 },
    cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
    cancelText: { color: '#6B7280', fontWeight: '700' },
    submitBtn: { flex: 2, backgroundColor: '#125EC9', paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
    submitText: { color: '#fff', fontWeight: '800' },

    detailDesc: { fontSize: 15, color: '#4B5563', lineHeight: 22, marginBottom: 20 },
    detailMeta: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, gap: 4 },
    metaLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
    metaValue: { color: '#111827', fontWeight: '700' },

    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    statusBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    statusBtnText: { fontSize: 12, fontWeight: '700' },

    closeBtn: { marginTop: 24, paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    closeText: { color: '#125EC9', fontWeight: '800' },

    emptyBox: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
    editBtn: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    editBtnText: {
        fontSize: 11,
        color: '#6366F1',
        fontWeight: '800',
    },
    paginationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 30,
        marginVertical: 20,
        borderRadius: 30,
        paddingVertical: 10,
        paddingHorizontal: 15,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        marginBottom: 100,
    },
    pageBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#EEF2FF',
    },
    pageBtnText: {
        color: '#125EC9',
        fontSize: 13,
        fontWeight: '700',
    },
    pageBtnDisabled: {
        backgroundColor: '#F3F4F6',
        opacity: 0.5,
    },
    pageBtnTextDisabled: {
        color: '#9CA3AF',
    },
    pageIndicator: {
        marginHorizontal: 15,
        fontSize: 14,
        color: '#1F2937',
        fontWeight: '700',
    },
    attachmentRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'center' },
    attachBtn: { 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderRadius: 10, 
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#125EC9'
    },
    attachBtnText: { color: '#125EC9', fontSize: 12, fontWeight: '700' },
    attachmentBadge: { 
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#10B981'
    },
    attachmentBadgeText: { fontSize: 10, color: '#10B981', fontWeight: '800' }
});

import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, Pressable, Platform, TextInput, Alert, ActivityIndicator } from 'react-native';
import BottomNav from '../components/BottomNav';
import { claimLeaveEncashment, getMyLeaveCategories } from '../config/api';
import { notifyError, notifyInfo, notifySuccess } from '../utils/notify';

export default function ClaimEncashmentScreen({ navigation }) {
    const [categories, setCategories] = useState([]);
    const [categoryKey, setCategoryKey] = useState('');
    const [days, setDays] = useState('');
    const [monthKey, setMonthKey] = useState('');
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showMonthModal, setShowMonthModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Generate current and next 5 months for encashment selection
    const months = useMemo(() => {
        const arr = [];
        const date = new Date();
        for (let i = 0; i < 6; i++) {
            const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            arr.push({ key: `${yyyy}-${mm}`, label });
        }
        return arr;
    }, []);

    useEffect(() => {
        let running = true;
        (async () => {
            try {
                const res = await getMyLeaveCategories();
                if (running && res?.success) {
                    // Only show categories with balance
                    const filtered = (Array.isArray(res.categories) ? res.categories : []).filter(c => !c.unlimited && c.remaining > 0);
                    setCategories(filtered);
                }
            } catch (e) { }
        })();
        return () => { running = false; };
    }, []);

    const categoryLabel = (c) => `${c.name} (${Math.max(0, Number(c.remaining || 0))} left)`;

    const handleSubmit = async () => {
        if (!categoryKey || !days || !monthKey) {
            notifyInfo('Please fill all fields.');
            return;
        }

        const numDays = parseFloat(days);
        if (isNaN(numDays) || numDays <= 0) {
            notifyError('Invalid number of days.');
            return;
        }

        const cat = categories.find(c => c.key === categoryKey);
        if (cat && numDays > cat.remaining) {
            notifyError(`Only ${cat.remaining} days available for encashment.`);
            return;
        }

        setLoading(true);
        try {
            const res = await claimLeaveEncashment({
                categoryKey,
                days: numDays,
                monthKey
            });
            if (res?.success) {
                notifySuccess('Encashment claim submitted successfully.');
                navigation.goBack();
            } else {
                notifyError(res?.message || 'Unable to submit claim.');
            }
        } catch (e) {
            notifyError('Unable to submit claim. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12, marginRight: 8 }} />
                    <Text style={styles.headerTitle}>Claim Leave Encashment</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.field}>
                    <Text style={styles.label}>Leave Category</Text>
                    <TouchableOpacity onPress={() => setShowCategoryModal(true)} activeOpacity={0.8} style={styles.inputRow}>
                        <Text style={[styles.placeholder, categoryKey ? styles.valueText : null]}>
                            {categoryKey ? categoryLabel(categories.find(c => c.key === categoryKey) || { name: categoryKey, remaining: 0 }) : 'Select category'}
                        </Text>
                        <Image source={require('../assets/down.png')} style={{ width: 12, height: 12 }} />
                    </TouchableOpacity>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Number of Days</Text>
                    <View style={styles.inputWrap}>
                        <TextInput
                            value={days}
                            onChangeText={setDays}
                            placeholder="Enter days"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            style={styles.input}
                        />
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Payroll Month</Text>
                    <TouchableOpacity onPress={() => setShowMonthModal(true)} activeOpacity={0.8} style={styles.inputRow}>
                        <Text style={[styles.placeholder, monthKey ? styles.valueText : null]}>
                            {monthKey ? (months.find(m => m.key === monthKey)?.label || monthKey) : 'Select month'}
                        </Text>
                        <Image source={require('../assets/down.png')} style={{ width: 12, height: 12 }} />
                    </TouchableOpacity>
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                        Note: Encashed leaves will be paid along with your salary for the selected month after admin approval.
                    </Text>
                </View>
            </ScrollView>

            <TouchableOpacity
                style={styles.applyBtn}
                activeOpacity={0.9}
                disabled={loading}
                onPress={handleSubmit}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyText}>Submit Claim</Text>}
            </TouchableOpacity>

            {/* Category Modal */}
            <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
                <View style={styles.modalContainer}>
                    <Pressable style={styles.modalBackdropFill} onPress={() => setShowCategoryModal(false)} />
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select Leave Category</Text>
                        {categories.length === 0 ? (
                            <Text style={{ padding: 16, textAlign: 'center' }}>No available leaves for encashment</Text>
                        ) : (
                            categories.map((c) => (
                                <TouchableOpacity key={c.key} style={styles.modalRow} onPress={() => { setCategoryKey(c.key); setShowCategoryModal(false); }}>
                                    <Text style={styles.modalText}>{categoryLabel(c)}</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>
            </Modal>

            {/* Month Modal */}
            <Modal visible={showMonthModal} transparent animationType="fade" onRequestClose={() => setShowMonthModal(false)}>
                <View style={styles.modalContainer}>
                    <Pressable style={styles.modalBackdropFill} onPress={() => setShowMonthModal(false)} />
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select Payroll Month</Text>
                        {months.map((m) => (
                            <TouchableOpacity key={m.key} style={styles.modalRow} onPress={() => { setMonthKey(m.key); setShowMonthModal(false); }}>
                                <Text style={styles.modalText}>{m.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
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
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
    backBtn: { paddingTop: 6, paddingBottom: 6 },
    headerTitle: { fontSize: 18, color: '#454545', fontFamily: 'Inter_600SemiBold' },
    content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 160 },
    field: { marginBottom: 18 },
    label: { color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 6 },
    inputRow: {
        height: 40,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    inputWrap: {
        height: 40,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
    input: {
        color: '#1f2c3a',
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
    },
    placeholder: { color: '#616161', fontFamily: 'Inter_400Regular', fontSize: 12 },
    valueText: { color: '#1f2c3a', fontFamily: 'Inter_500Medium' },
    infoBox: {
        backgroundColor: '#E6EEFF',
        padding: 12,
        borderRadius: 8,
        marginTop: 20,
    },
    infoText: {
        color: '#125EC9',
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        lineHeight: 18,
    },
    applyBtn: {
        position: 'absolute', left: 16, right: 16, bottom: 30,
        height: 44, borderRadius: 8,
        backgroundColor: '#125EC9', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
    },
    applyText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    modalContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    modalBackdropFill: {
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    modalSheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    modalTitle: { color: '#125EC9', fontFamily: 'Inter_600SemiBold', marginBottom: 12, fontSize: 16 },
    modalRow: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E6EEFF',
    },
    modalText: { color: '#1f2c3a', fontFamily: 'Inter_500Medium' },
});

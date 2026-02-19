import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput } from 'react-native';

export default function HelpSupportScreen({ navigation }) {
  const supportEmail = 'support@thinktechsoftware.in';
  const supportPhone = '+91 99831052038';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/arrow.png')} style={{ width: 18, height: 12 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Support Email (Read only)</Text>
          <TextInput value={supportEmail} editable={false} style={[styles.input, styles.inputDisabled]} />

          <Text style={styles.label}>Support Mobile (Read only)</Text>
          <TextInput value={supportPhone} editable={false} style={[styles.input, styles.inputDisabled]} />

          <Text style={styles.note}>For any issue, contact on above details.</Text>
        </View>

        <View style={{ height: 30 }} />
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

  content: { padding: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12 },

  label: { marginTop: 10, marginBottom: 6, color: '#374151', fontFamily: 'Inter_500Medium', fontSize: 12 },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
    color: '#111827',
  },
  inputDisabled: { backgroundColor: '#F9FAFB', color: '#6B7280' },
  note: { marginTop: 12, color: '#6B7280', fontFamily: 'Inter_400Regular', fontSize: 12 },
});

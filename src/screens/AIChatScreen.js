import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { askAI } from '../config/api';
import { notifyError } from '../utils/notify';
import dayjs from 'dayjs';

const { width } = Dimensions.get('window');

export default function AIChatScreen() {
  const navigation = useNavigation();
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: 'Hello! I am your VetanSutra AI Assistant. How can I help you today with your attendance, leaves, tasks, or sales?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef();

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim(), timestamp: new Date() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await askAI(newMessages.map(({role, content}) => ({role, content})));
      if (response.success) {
        setMessages([...newMessages, { role: 'assistant', content: response.message, timestamp: new Date() }]);
      } else {
        notifyError(response.message || 'AI Assistant is currently busy.');
      }
    } catch (error) {
      console.error('AI Chat Error:', error);
      notifyError('Unable to connect to AI Assistant.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assets/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.aiAvatarSmall}>
             <Text style={styles.aiAvatarTextSmall}>AI</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.onlineStatus}>Online</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, index) => (
          <View
            key={index}
            style={[
              styles.messageWrapper,
              msg.role === 'user' ? styles.userWrapper : styles.assistantWrapper
            ]}
          >
            {msg.role === 'assistant' && (
              <View style={styles.aiAvatar}>
                 <Text style={styles.aiAvatarText}>AI</Text>
              </View>
            )}
            <View style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble
            ]}>
              <Text style={[
                styles.messageText,
                msg.role === 'user' ? styles.userText : styles.assistantText
              ]}>
                {msg.content}
              </Text>
              <Text style={[
                styles.timestamp,
                msg.role === 'user' ? styles.userTimestamp : styles.assistantTimestamp
              ]}>
                {dayjs(msg.timestamp).format('hh:mm A')}
              </Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={styles.assistantWrapper}>
             <View style={styles.aiAvatar}>
                 <Text style={styles.aiAvatarText}>AI</Text>
              </View>
            <View style={[styles.messageBubble, styles.assistantBubble, { paddingVertical: 15 }]}>
              <ActivityIndicator size="small" color="#125EC9" />
            </View>
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' }]}
              placeholder="Type your message..."
              value={input}
              onChangeText={setInput}
              multiline
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={[styles.sendButtonCircle, !input.trim() && styles.disabledButton]}
              onPress={handleSend}
              disabled={!input.trim() || loading}
            >
              <Image 
                source={require('../assets/arrow.png')} 
                style={[styles.sendIcon, { transform: [{ rotate: '-90deg' }] }]} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Slightly lighter background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    paddingRight: 12,
  },
  backIcon: {
    width: 25,
    height: 18,
    tintColor: '#125EC9',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  onlineStatus: {
    fontSize: 12,
    color: '#10B981',
    fontFamily: 'Inter_400Regular',
  },
  aiAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#125EC9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  aiAvatarTextSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  assistantWrapper: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#125EC9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  aiAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: width * 0.78,
    padding: 12,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: '#125EC9',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#374151',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  assistantTimestamp: {
    color: '#9BA3AF',
  },
  inputArea: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#1F2937',
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#125EC9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendIcon: {
    width: 18,
    height: 18,
    tintColor: '#fff',
  },
  disabledButton: {
    backgroundColor: '#93C5FD',
  },
});

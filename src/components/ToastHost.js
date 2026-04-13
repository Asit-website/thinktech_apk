import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setToastHandler } from '../utils/toastBus';

export default function ToastHost() {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setToastHandler((next) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast(next);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
          setToast(null);
        });
      }, 1600);
    });

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToastHandler(null);
    };
  }, [opacity]);

  if (!toast) return null;

  const type = toast.type || 'info';
  const title = toast.title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info');
  const message = toast.message || '';
  const bg = type === 'success' ? '#16A34A' : type === 'error' ? '#DC2626' : '#125EC9';

  return (
    <Animated.View style={[styles.wrap, { opacity, paddingTop: 54 + insets.top }]} pointerEvents="none">
      <View style={[styles.card, { backgroundColor: bg }]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.msg}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingTop: 54,
    paddingHorizontal: 14,
    zIndex: 9999,
  },
  card: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  title: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  msg: {
    marginTop: 2,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
});

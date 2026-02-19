import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import OTPScreen from './src/screens/OTPScreen';
import HomeScreen from './src/screens/HomeScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import AttendanceReportScreen from './src/screens/AttendanceReportScreen';
import LeaveScreen from './src/screens/LeaveScreen';
import ApplyLeaveScreen from './src/screens/ApplyLeaveScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SalesScreen from './src/screens/SalesScreen';
import SalesReportScreen from './src/screens/SalesReportScreen';
import SalaryScreen from './src/screens/SalaryScreen';
import SalaryReportScreen from './src/screens/SalaryReportScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import OrderFormScreen from './src/screens/OrderFormScreen';
import AssignedJobsScreen from './src/screens/AssignedJobsScreen';
import AssignedJobDetailScreen from './src/screens/AssignedJobDetailScreen';
import TargetsScreen from './src/screens/TargetsScreen';
import VisitFormScreen from './src/screens/VisitFormScreen';
import MyDocumentsScreen from './src/screens/MyDocumentsScreen';
import BankDetailsScreen from './src/screens/BankDetailsScreen';
import AccountSettingsScreen from './src/screens/AccountSettingsScreen';
import GeneralInfoScreen from './src/screens/GeneralInfoScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import ToastHost from './src/components/ToastHost';
import AndroidNotification from './src/components/AndroidNotification';
import { setNotificationRef } from './src/utils/notify';
import { PermissionsProvider } from './src/contexts/PermissionsContext';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [initialRoute, setInitialRoute] = useState(null);
  const [notification, setNotification] = useState({ visible: false, title: '', message: '', type: 'success' });
  const notificationRef = useRef();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (mounted) setInitialRoute(token ? 'Home' : 'Login');
      } catch (e) {
        if (mounted) setInitialRoute('Login');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Set up notification ref
    notificationRef.current = {
      show: (title, message, type) => {
        setNotification({ visible: true, title, message, type });
      }
    };
    setNotificationRef(notificationRef.current);
  }, []);

  const handleNotificationClose = () => {
    setNotification({ visible: false, title: '', message: '', type: 'success' });
  };

  if (!fontsLoaded || !initialRoute) return null;

  return (
    <PermissionsProvider>
      <NavigationContainer>
        <ToastHost />
        <AndroidNotification
          visible={notification.visible}
          title={notification.title}
          message={notification.message}
          type={notification.type}
          onClose={handleNotificationClose}
        />
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OTP" component={OTPScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AttendanceReport" component={AttendanceReportScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Leave" component={LeaveScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ApplyLeave" component={ApplyLeaveScreen} options={{ headerShown: false }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Calendar" component={CalendarScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MyDocuments" component={MyDocumentsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BankDetails" component={BankDetailsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="GeneralInfo" component={GeneralInfoScreen} options={{ headerShown: false }} />
          <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Sales" component={SalesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SalesReport" component={SalesReportScreen} options={{ headerShown: false }} />
          <Stack.Screen name="VisitForm" component={VisitFormScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Salary" component={SalaryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SalaryReport" component={SalaryReportScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Reports" component={ReportsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AssignedJobs" component={AssignedJobsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AssignedJobDetail" component={AssignedJobDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Targets" component={TargetsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OrderForm" component={OrderFormScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </PermissionsProvider>
  );
}


import React, { useEffect, useState, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';
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
import ClaimEncashmentScreen from './src/screens/ClaimEncashmentScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SalesScreen from './src/screens/SalesScreen';
import SalesReportScreen from './src/screens/SalesReportScreen';
import SalaryScreen from './src/screens/SalaryScreen';
import SalaryReportScreen from './src/screens/SalaryReportScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import OrderFormScreen from './src/screens/OrderFormScreen';
import ExpenseScreen from './src/screens/ExpenseScreen';
import AssignedJobsScreen from './src/screens/AssignedJobsScreen';
import AssignedJobDetailScreen from './src/screens/AssignedJobDetailScreen';
import TargetsScreen from './src/screens/TargetsScreen';
import VisitFormScreen from './src/screens/VisitFormScreen';
import MyDocumentsScreen from './src/screens/MyDocumentsScreen';
import BankDetailsScreen from './src/screens/BankDetailsScreen';
import AccountSettingsScreen from './src/screens/AccountSettingsScreen';
import GeneralInfoScreen from './src/screens/GeneralInfoScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import TodoListScreen from './src/screens/TodoListScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import MeetingScreen from './src/screens/MeetingScreen';
import TicketScreen from './src/screens/TicketScreen';
import AIChatScreen from './src/screens/AIChatScreen';
import ToastHost from './src/components/ToastHost';
import AndroidNotification from './src/components/AndroidNotification';
import { setNotificationRef } from './src/utils/notify';
import { PermissionsProvider } from './src/contexts/PermissionsContext';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { defineBackgroundTask } from './src/services/locationService';

// Register background location task (must be called at module level, before app renders)
defineBackgroundTask();

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

  //this is sync

  useEffect(() => {
    async function onFetchUpdateAsync() {
      try {
        console.info(`[Updates] Checking for update... Runtime: ${Updates.runtimeVersion}, Channel: ${Updates.channel || 'N/A'}`);
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          console.info(`[Updates] New update available: ${update.manifest.id}`);
          Alert.alert(
            'Update Available',
            'A new version of the app is available. Please update now to get the latest features.',
            [
              {
                text: 'Update Now',
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (error) {
                    console.error(`[Updates] Fetch error: ${error}`);
                    Alert.alert('Error', 'Failed to fetch the update. Please try again later.');
                  }
                },
              },
            ],
            { cancelable: false }
          );
        } else {
          console.info('[Updates] No new update available.');
        }
      } catch (error) {
        console.error(`[Updates] Check error: ${error}`);
        // Only alert on check error if we're in a non-dev environment and troubleshooting
        // Alert.alert('Update Check Failed', `Error: ${error.message}`);
      }
    }

    if (!__DEV__) {
      onFetchUpdateAsync();

      // Check for updates when the app returns from background to foreground
      const subscription = AppState.addEventListener('change', nextAppState => {
        if (nextAppState === 'active') {
          onFetchUpdateAsync();
        }
      });

      return () => {
        subscription.remove();
      };
    }
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
          <Stack.Screen name="ClaimEncashment" component={ClaimEncashmentScreen} options={{ headerShown: false }} />
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
          <Stack.Screen name="Expense" component={ExpenseScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TodoList" component={TodoListScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Activity" component={ActivityScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Meeting" component={MeetingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Ticket" component={TicketScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AIChat" component={AIChatScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </PermissionsProvider>
  );
}


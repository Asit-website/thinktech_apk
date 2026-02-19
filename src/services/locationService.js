import api from '../config/api';

// Lazy-load expo-location (avoids static import crash on web)
let _Location = null;
function getLocation() {
  if (!_Location) _Location = require('expo-location');
  return _Location;
}

// Location tracking service
export async function sendLocationPing(latitude, longitude, accuracy, source = 'mobile') {
  console.log('Sending location ping:', { latitude, longitude, accuracy, source });

  try {
    const resp = await api.post('/location/ping', {
      latitude,
      longitude,
      accuracy,
      source
    });
    console.log('Location ping response:', resp.data);
    return resp.data;
  } catch (error) {
    console.error('Location ping error:', error);
    throw error;
  }
}

// Background location tracking service using expo-location
class LocationTrackingService {
  constructor() {
    this.isTracking = false;
    this.watchSubscription = null;
    this.intervalId = null;
  }

  // Start tracking location
  async startTracking(intervalMinutes = 2) {
    if (this.isTracking) {
      console.log('Location tracking already started');
      return;
    }

    console.log('Starting location tracking with interval:', intervalMinutes, 'minutes');

    try {
      const Location = getLocation();
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission not granted');
        return;
      }

      this.isTracking = true;

      // Send current location immediately
      await this.getCurrentAndSendLocation();

      // Set up interval for periodic updates
      this.intervalId = setInterval(async () => {
        if (this.isTracking) {
          await this.getCurrentAndSendLocation();
        }
      }, intervalMinutes * 60 * 1000);

      // Also watch position for real-time movement updates
      try {
        this.watchSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 60000,       // min 1 minute between updates
            distanceInterval: 50,      // or 50 meters movement
          },
          (location) => {
            if (this.isTracking) {
              this.sendLocationToServer(location.coords);
            }
          }
        );
      } catch (watchErr) {
        console.error('watchPositionAsync error (non-fatal):', watchErr);
      }

      console.log('Location tracking started successfully');
    } catch (e) {
      console.error('Failed to start location tracking:', e);
      this.isTracking = false;
    }
  }

  // Stop tracking location
  stopTracking() {
    console.log('Stopping location tracking');
    this.isTracking = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }

  // Get current location and send to server
  async getCurrentAndSendLocation() {
    try {
      const Location = getLocation();
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await this.sendLocationToServer(loc.coords);
    } catch (error) {
      console.error('getCurrentAndSendLocation error:', error);
    }
  }

  // Send location to server
  async sendLocationToServer(coords) {
    try {
      await sendLocationPing(
        coords.latitude,
        coords.longitude,
        coords.accuracy || null,
        'mobile_background'
      );
      console.log('Location sent successfully');
    } catch (error) {
      console.error('Failed to send location:', error);
    }
  }

  // Check if tracking is active
  isActive() {
    return this.isTracking;
  }
}

// Export singleton instance
export const locationTrackingService = new LocationTrackingService();


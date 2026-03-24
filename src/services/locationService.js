import api from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Task name for background location updates
const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

// Lazy-load expo-location and expo-task-manager
let _Location = null;
let _TaskManager = null;

function getLocation() {
  if (!_Location) _Location = require('expo-location');
  return _Location;
}

function getTaskManager() {
  if (!_TaskManager) _TaskManager = require('expo-task-manager');
  return _TaskManager;
}

function isPermissionDeniedError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const code = Number(error?.code);
  return code === 1 || msg.includes('denied') || msg.includes('permission');
}

/**
 * Formats a GeocodedAddress object into a human-readable string.
 * Prioritizes street-level details and avoids redundancy.
 */
export function formatAddress(g) {
  if (!g) return null;

  // Components in order from specific to broad
  const components = [
    g.streetNumber,
    g.name,
    g.street,
    g.district,
    g.subregion,
    g.city,
    g.region,
    g.postalCode,
    g.country
  ];

  const seen = new Set();
  const addressParts = components
    .map(x => String(x || '').trim())
    .filter(x => {
      if (!x || x.toLowerCase() === 'unnamed road') return false;

      const lower = x.toLowerCase();

      // Filter out broad divisions if they end with ' Division' and we already have more specific data
      // This handles "Presidency Division" etc which are often redundant
      if (lower.endsWith(' division') && (g.district || g.city || g.street)) return false;

      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

  if (addressParts.length > 0) {
    return addressParts.join(', ');
  }

  // Fallback to coordinates if no address strings are found
  if (g.latitude && g.longitude) {
    return `Location: ${g.latitude.toFixed(4)}, ${g.longitude.toFixed(4)}`;
  }

  return null;
}

// ─── Helper: Distance Calculation ─────────────────────────────────────────────
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// ─── Location Ping ────────────────────────────────────────────────────────────
export async function sendLocationPing(latitude, longitude, accuracy, source = 'mobile', address = null) {
  console.log('Sending location ping:', { latitude, longitude, accuracy, source, address });
  try {
    const deviceId = await getOrCreateDeviceTrackId();
    const resp = await api.post('/attendance/location/ping', {
      lat: latitude,
      lng: longitude,
      accuracyMeters: typeof accuracy === 'number' ? Math.round(accuracy) : undefined,
      source,
      address: address || undefined,
      deviceId,
      platform: Platform.OS,
    });
    console.log('Location ping response:', resp.data);
    return resp.data;
  } catch (error) {
    console.error('Location ping error:', error);
    throw error;
  }
}

// ─── Location Tracking Service ────────────────────────────────────────────────
const TRACKING_ACTIVE_KEY = 'is_tracking_active';
const DEVICE_TRACK_ID_KEY = 'device_track_id';

async function getOrCreateDeviceTrackId() {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_TRACK_ID_KEY);
    if (existing) return existing;
    const seed = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(DEVICE_TRACK_ID_KEY, seed);
    return seed;
  } catch (_) {
    return `${Platform.OS}-fallback`;
  }
}

class LocationTrackingService {
  constructor() {
    this.isTracking = false;
    this.lastSentCoords = null; // Store {lat, lng} of last successful ping
  }

  // ─── Define Background Task ───────────────────────────────────────────────────
  // This runs even when screen is off / app is backgrounded
  defineBackgroundTask() {
    try {
      const TaskManager = getTaskManager();
      if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
        TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
          if (error) {
            console.error('Background location task error:', error);
            return;
          }

          // 1. Double-check if we SHOULD be tracking (memory + persistent storage)
          const persistentState = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
          const shouldTrack = this.isTracking || persistentState === 'true';

          if (!shouldTrack) {
            console.log('Background task triggered but tracking is inactive. Stopping updates.');
            try {
              const Location = getLocation();
              await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            } catch (_) { }
            return;
          }

          if (data) {
            const { locations } = data;
            if (locations && locations.length > 0) {
              const loc = locations[0];
              const { latitude, longitude, accuracy } = loc.coords;

              // 2. Filter out poor accuracy
              if (accuracy && accuracy > 100) {
                console.log(`Ignoring low accuracy ping: ${accuracy.toFixed(1)}m`);
                return;
              }

              // 3. Manual distance check against last sent coords
              if (this.lastSentCoords) {
                const dist = calculateDistance(
                  this.lastSentCoords.lat,
                  this.lastSentCoords.lng,
                  latitude,
                  longitude
                );
                // Even though OS says 100m, GPS drift can trick it. 
                // We double check if it's at least 80m (giving some tolerance).
                if (dist < 80) {
                  console.log(`Ignoring drift: moved only ${dist.toFixed(1)}m from last ping`);
                  return;
                }
              }

              try {
                const Location = getLocation();
                let address = null;
                try {
                  const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
                  const a = Array.isArray(rev) ? rev[0] : null;
                  address = formatAddress(a) || `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                } catch (_) {
                  address = `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                }

                await sendLocationPing(latitude, longitude, accuracy || null, 'mobile_background', address);

                // Update last sent coordinates after success
                this.lastSentCoords = { lat: latitude, lng: longitude };

              } catch (e) {
                console.error('Background task send error:', e);
              }
            }
          }
        });
      }
    } catch (e) {
      console.error('defineBackgroundTask error:', e);
    }
  }

  // Start background location tracking
  async startTracking() {
    if (this.isTracking) return true;

    console.log('Starting background location tracking (distance-based: 100m, high accuracy)');

    try {
      const Location = getLocation();

      // 1. Request foreground permission first
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') return false;

      // 2. Request background permission (needed when screen is off)
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('Background location permission not granted');
      }

      // Reset state
      this.lastSentCoords = null;
      this.isTracking = true;
      await AsyncStorage.setItem(TRACKING_ACTIVE_KEY, 'true');

      // 3. Send current location immediately
      await this.getCurrentAndSendLocation();

      // 4. Register the background task with OS (persists when app is suspended)
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High, // Use High accuracy to reduce drift
        distanceInterval: 100,                        // every 100m movement as requested
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,       // iOS: shows blue bar
        foregroundService: {
          notificationTitle: 'Location Active',
          notificationBody: 'Tracking your movement for attendance (100m intervals).',
          notificationColor: '#1677ff',
        },
      });

      console.log('Background location tracking started ✓');
      return true;
    } catch (e) {
      console.error('Failed to start background tracking:', e);
      this.isTracking = false;
      return false;
    }
  }

  // Stop background location tracking
  async stopTracking() {
    console.log('Stopping background location tracking');
    this.isTracking = false;
    this.lastSentCoords = null;
    await AsyncStorage.removeItem(TRACKING_ACTIVE_KEY);

    try {
      const Location = getLocation();
      const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (e) { console.error('stopTracking error:', e); }
  }

  // Get current location and send to server
  async getCurrentAndSendLocation() {
    try {
      const Location = getLocation();
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, accuracy } = loc.coords;

      let address = null;
      try {
        const items = await Location.reverseGeocodeAsync({ latitude, longitude });
        address = formatAddress(items?.[0]) || `Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      } catch (_) {
        address = `Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      }

      await sendLocationPing(latitude, longitude, accuracy || null, 'mobile_background', address);

      // Mark as last sent
      this.lastSentCoords = { lat: latitude, lng: longitude };
      return true;
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        await this.stopTracking();
        return false;
      }
      return false;
    }
  }

  // Check if tracking is active
  isActive() {
    return this.isTracking;
  }
}

// Export singleton instance
export const locationTrackingService = new LocationTrackingService();

// Backward-compatible named export used by App.js
export const defineBackgroundTask = () => {
  locationTrackingService.defineBackgroundTask();
};

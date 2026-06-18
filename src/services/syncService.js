import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { punchInWithPhoto, punchOutWithPhoto, startBreak, endBreak, getAttendanceStatus } from '../config/api';

const SYNC_QUEUE_KEY = 'offline_sync_queue';
const OFFLINE_STATUS_KEY = 'offline_attendance_status';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.networkFailed = false;
  }

  resetNetworkFailed() {
    if (this.networkFailed) {
      this.networkFailed = false;
      console.log('Network status restored, resetting offline sync flag.');
      this.sync();
    }
  }

  /**
   * Add an item to the sync queue
   * @param {Object} item { type: 'PUNCH_IN'|'PUNCH_OUT'|'START_BREAK'|'END_BREAK', data: {}, timestamp: Date }
   */
  async addToQueue(item) {
    console.log('[SyncService] addToQueue started');
    try {
      let queue = [];
      try {
        console.log('[SyncService] Reading SYNC_QUEUE_KEY');
        const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
        console.log('[SyncService] Raw queue JSON:', queueJson);
        queue = queueJson ? JSON.parse(queueJson) : [];
        if (!Array.isArray(queue)) {
          queue = [];
        }
      } catch (parseError) {
        console.error('Failed to parse sync queue, resetting:', parseError);
        queue = [];
      }
      
      // If item has a photo, save it locally to a permanent location
      if (item.data && item.data.photoUri) {
        console.log('[SyncService] Processing photo:', item.data.photoUri);
        try {
          const fileName = `offline_${Date.now()}_${item.type.toLowerCase()}.jpg`;
          const localPath = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.copyAsync({
            from: item.data.photoUri,
            to: localPath
          });
          item.data.photoUri = localPath; // Update URI to local path
        } catch (photoError) {
          console.error('Failed to copy offline photo, proceeding with original URI:', photoError);
        }
      }

      queue.push({
        ...item,
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString()
      });

      console.log('[SyncService] Saving queue');
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      
      // Update local status so UI reflects the change immediately
      console.log('[SyncService] Updating local status');
      await this.updateLocalStatus(item);
      
      console.log('[SyncService] addToQueue finishing');
      return true;
    } catch (error) {
      console.error('Failed to add to sync queue:', error);
      return false;
    }
  }

  /**
   * Update the cached attendance status based on an offline action
   */
  async updateLocalStatus(item) {
    console.log('[SyncService] updateLocalStatus started');
    try {
      console.log('[SyncService] Reading OFFLINE_STATUS_KEY');
      const statusJson = await AsyncStorage.getItem(OFFLINE_STATUS_KEY);
      console.log('[SyncService] Raw status JSON:', statusJson);
      let status;
      try {
        status = statusJson ? JSON.parse(statusJson) : null;
      } catch (parseErr) {
        console.error('Failed to parse local status JSON, resetting:', parseErr);
        status = null;
      }
      if (!status || typeof status !== 'object') {
        status = {
          punchedInAt: null,
          punchedOutAt: null,
          isOnBreak: false,
          workingSeconds: 0,
          breakSeconds: 0
        };
      }

      const nowIso = new Date().toISOString();

      switch (item.type) {
        case 'PUNCH_IN':
          status.punchedInAt = nowIso;
          status.punchedOutAt = null;
          status.isOnBreak = false;
          break;
        case 'PUNCH_OUT':
          status.punchedOutAt = nowIso;
          status.isOnBreak = false;
          break;
        case 'START_BREAK':
          status.isOnBreak = true;
          status.breakStartedAt = nowIso;
          break;
        case 'END_BREAK':
          status.isOnBreak = false;
          status.breakStartedAt = null;
          break;
      }

      console.log('[SyncService] Saving OFFLINE_STATUS_KEY');
      await AsyncStorage.setItem(OFFLINE_STATUS_KEY, JSON.stringify(status));
      console.log('[SyncService] updateLocalStatus completed');
    } catch (error) {
      console.error('Failed to update local status:', error);
    }
  }

  /**
   * Get the cached attendance status
   */
  async getLocalStatus() {
    try {
      const statusJson = await AsyncStorage.getItem(OFFLINE_STATUS_KEY);
      return statusJson ? JSON.parse(statusJson) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set the latest status from server (to keep cache fresh)
   */
  async setServerStatus(status) {
    try {
      await AsyncStorage.setItem(OFFLINE_STATUS_KEY, JSON.stringify(status));
    } catch (error) {}
  }

  /**
   * Process the sync queue
   */
  async sync() {
    if (this.isSyncing) return;
    if (this.networkFailed) {
      console.log('Offline: Sync skipped because network is marked as offline.');
      return;
    }
    this.isSyncing = true;

    try {
      let queue = [];
      try {
        const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
        queue = queueJson ? JSON.parse(queueJson) : [];
        if (!Array.isArray(queue)) {
          queue = [];
        }
      } catch (parseErr) {
        console.error('Failed to parse sync queue in sync(), resetting:', parseErr);
        queue = [];
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
      }

      if (queue.length > 0) {
        console.log(`Starting sync for ${queue.length} items...`);
        const remainingQueue = [];
        
        for (const item of queue) {
          let success = false;
          try {
            switch (item.type) {
              case 'PUNCH_IN':
                const resIn = await punchInWithPhoto(item.data.photoUri, item.data.coords);
                success = resIn?.success;
                if (success) {
                  try {
                    const { locationTrackingService } = require('./locationService');
                    await locationTrackingService.startTracking();
                    console.log('Background location tracking started after offline punch-in sync.');
                  } catch (e) {
                    console.error('Failed to start tracking after offline sync:', e);
                  }
                }
                break;
              case 'PUNCH_OUT':
                const resOut = await punchOutWithPhoto(item.data.photoUri, item.data.coords);
                success = resOut?.success;
                if (success) {
                  try {
                    const { locationTrackingService } = require('./locationService');
                    await locationTrackingService.stopTracking();
                    console.log('Background location tracking stopped after offline punch-out sync.');
                  } catch (e) {
                    console.error('Failed to stop tracking after offline sync:', e);
                  }
                }
                break;
              case 'START_BREAK':
                const resSB = await startBreak();
                success = resSB?.success;
                break;
              case 'END_BREAK':
                const resEB = await endBreak();
                success = resEB?.success;
                break;
            }

            if (success) {
              // Clean up local photo if it exists
              if (item.data && item.data.photoUri && item.data.photoUri.startsWith('file://')) {
                try {
                  await FileSystem.deleteAsync(item.data.photoUri, { idempotent: true });
                } catch (e) {}
              }
            } else {
              remainingQueue.push(item);
            }
          } catch (error) {
            console.error(`Sync failed for item ${item.id}:`, error.message);
            
            const isTemporaryError = !error.response || 
              error.code === 'ERR_NETWORK' || 
              error.code === 'NETWORK_ERROR' || 
              error.code === 'ECONNABORTED' || 
              error.message?.includes('Network') || 
              error.message?.includes('timeout') ||
              error.response?.status === 408 ||
              error.response?.status === 429 ||
              (error.response?.status >= 500 && error.response?.status <= 599);

            if (isTemporaryError) {
              remainingQueue.push(item);
              this.networkFailed = true;
              break; // Stop syncing remaining items since network/server is down
            } else {
              console.warn(`Discarding item ${item.id} due to permanent API error:`, error.response?.status);
              // Clean up local photo since we are discarding the item
              if (item.data && item.data.photoUri && item.data.photoUri.startsWith('file://')) {
                try {
                  await FileSystem.deleteAsync(item.data.photoUri, { idempotent: true });
                } catch (e) {}
              }
            }
          }
        }

        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));

        // If the queue has been successfully cleared, refresh the local cache status
        if (remainingQueue.length === 0) {
          try {
            const statusRes = await getAttendanceStatus();
            if (statusRes?.success) {
              await this.setServerStatus(statusRes.status);
            }
          } catch (statusError) {
            console.error('Failed to refresh status after successful sync:', statusError.message);
          }
        }
      }

      // Sync offline location pings too if network is still fine
      if (!this.networkFailed) {
        await this.syncOfflineLocationPings();
      }
    } catch (error) {
      console.error('Sync process failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync offline background location pings
   */
  async syncOfflineLocationPings() {
    try {
      const pingsJson = await AsyncStorage.getItem('offline_location_pings');
      if (!pingsJson) return;
      
      let pings = [];
      try {
        pings = JSON.parse(pingsJson);
        if (!Array.isArray(pings)) {
          pings = [];
        }
      } catch (parseErr) {
        console.error('Failed to parse offline location pings, resetting:', parseErr);
        await AsyncStorage.setItem('offline_location_pings', JSON.stringify([]));
        return;
      }
      
      if (pings.length === 0) return;
      
      console.log(`Starting sync for ${pings.length} offline location pings...`);
      
      // Lazy load api
      const api = require('../config/api').default;
      
      const remainingPings = [];
      for (const ping of pings) {
        try {
          await api.post('/attendance/location/ping', {
            lat: ping.lat,
            lng: ping.lng,
            accuracyMeters: ping.accuracyMeters,
            source: ping.source,
            address: ping.address,
            deviceId: ping.deviceId,
            platform: ping.platform,
            timestamp: ping.timestamp
          });
        } catch (error) {
          console.error('Failed to sync offline location ping:', error.message);
          
          const isTemporaryError = !error.response || 
            error.code === 'ERR_NETWORK' || 
            error.code === 'NETWORK_ERROR' || 
            error.code === 'ECONNABORTED' || 
            error.message?.includes('Network') || 
            error.message?.includes('timeout') ||
            error.response?.status === 408 ||
            error.response?.status === 429 ||
            (error.response?.status >= 500 && error.response?.status <= 599);

          if (isTemporaryError) {
            remainingPings.push(ping);
            this.networkFailed = true;
            break; // Stop syncing since network failed again
          } else {
            console.warn('Discarding offline location ping due to permanent error status:', error.response?.status);
          }
        }
      }
      
      await AsyncStorage.setItem('offline_location_pings', JSON.stringify(remainingPings));
      console.log('Offline location sync completed. Remaining:', remainingPings.length);
    } catch (error) {
      console.error('Error syncing offline location pings:', error);
    }
  }

  /**
   * Get count of pending sync items
   */
  async getPendingCount() {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (!queueJson) return 0;
      const queue = JSON.parse(queueJson);
      return Array.isArray(queue) ? queue.length : 0;
    } catch (error) {
      return 0;
    }
  }
}

export const syncService = new SyncService();

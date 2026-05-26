import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { punchInWithPhoto, punchOutWithPhoto, startBreak, endBreak } from '../config/api';

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
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      const queue = queueJson ? JSON.parse(queueJson) : [];
      
      // If item has a photo, save it locally to a permanent location
      if (item.data && item.data.photoUri) {
        const fileName = `offline_${Date.now()}_${item.type.toLowerCase()}.jpg`;
        const localPath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({
          from: item.data.photoUri,
          to: localPath
        });
        item.data.photoUri = localPath; // Update URI to local path
      }

      queue.push({
        ...item,
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString()
      });

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      
      // Update local status so UI reflects the change immediately
      await this.updateLocalStatus(item);
      
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
    try {
      const statusJson = await AsyncStorage.getItem(OFFLINE_STATUS_KEY);
      let status = statusJson ? JSON.parse(statusJson) : {
        punchedInAt: null,
        punchedOutAt: null,
        isOnBreak: false,
        workingSeconds: 0,
        breakSeconds: 0
      };

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

      await AsyncStorage.setItem(OFFLINE_STATUS_KEY, JSON.stringify(status));
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
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      let queue = queueJson ? JSON.parse(queueJson) : [];

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
                break;
              case 'PUNCH_OUT':
                const resOut = await punchOutWithPhoto(item.data.photoUri, item.data.coords);
                success = resOut?.success;
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
            remainingQueue.push(item);
            // If it's a network error (or server offline), stop syncing for now
            if (!error.response || error.message.includes('Network') || error.code === 'ERR_NETWORK' || error.code === 'NETWORK_ERROR') {
               this.networkFailed = true;
               break;
            }
          }
        }

        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
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
      
      const pings = JSON.parse(pingsJson);
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
          remainingPings.push(ping);
          
          const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network');
          if (isNetworkError) {
            this.networkFailed = true;
            break; // Stop syncing since network failed again
          }
        }
      }
      
      await AsyncStorage.setItem('offline_location_pings', JSON.stringify(remainingPings));
      console.log(`Offline location sync completed. Remaining: ${remainingPings.length}`);
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
      return queue.length;
    } catch (error) {
      return 0;
    }
  }
}

export const syncService = new SyncService();

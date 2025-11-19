// sw.js - Enhanced Service Worker untuk Real-Time GPS Tracking
const CACHE_NAME = 'dt-gps-realtime-v4.0';
const GPS_DATA_CACHE = 'gps-realtime-data-v4.0';
const SYNC_QUEUE_CACHE = 'gps-sync-queue-v4.0';
const INFINITY_SYNC_TAG = 'infinity-gps-sync';
const BACKGROUND_SYNC_TAG = 'background-gps-sync';
const HEALTH_SYNC_TAG = 'gps-health-check';
const MONITOR_CONTEXT = 'monitor';
const MOBILE_CONTEXT = 'mobile';
const INFINITY_SYNC_INTERVAL_MS = 30000;
const INFINITY_HEALTH_INTERVAL_MS = 60000;

let infinitySyncLoopStarted = false;
let infinitySyncTimer = null;
let infinityHealthTimer = null;
const urlsToCache = [
  './',
  './mobile.html',
  './manifest.json',
  './script-mobile.js',
  '/SAGM-DUMP-TRUCK-TRACKING/',
  '/SAGM-DUMP-TRUCK-TRACKING/mobile.html',
  '/SAGM-DUMP-TRUCK-TRACKING/manifest.json'
];

let infinityClientState = {
  isBackground: false,
  isOffline: false,
  lockScreen: false,
  infinityMode: false,
  pendingFlush: false,
  pendingReason: null,
  lastUpdate: null,
  offlineSince: null
};

function getOnlineStatus() {
  if (typeof self !== 'undefined' && self.navigator && typeof self.navigator.onLine === 'boolean') {
    return self.navigator.onLine;
  }
  return true;
}

function updateInfinityState(update = {}) {
  const previousState = { ...infinityClientState };
  infinityClientState = {
    ...infinityClientState,
    ...update,
    lastUpdate: Date.now()
  };

  const justCameOnline = previousState.isOffline && !infinityClientState.isOffline;
  const newPendingWhileOnline =
    infinityClientState.pendingFlush &&
    !previousState.pendingFlush &&
    !infinityClientState.isOffline;

  if ((justCameOnline || newPendingWhileOnline) && infinityClientState.pendingFlush) {
    triggerImmediateInfinitySync(update.triggerReason || 'state-change').catch((error) => {
      console.warn('⚠️ Failed to trigger immediate infinity sync after state change:', error);
    });
  }
}

async function ensureBackgroundSyncRegistration(tag = INFINITY_SYNC_TAG, context = 'generic') {
  if (!self.registration || !self.registration.sync) {
    if (tag === INFINITY_SYNC_TAG) {
      console.warn(`⚠️ SyncManager unavailable for ${context}, relying on manual trigger`);
      await triggerImmediateInfinitySync(`fallback-${context}`);
    }
    return;
  }

  try {
    await self.registration.sync.register(tag);
    console.log(`🔁 Background sync registered: ${tag} (${context})`);
  } catch (error) {
    console.warn(`⚠️ Background sync registration failed for ${tag} (${context}):`, error);
    if (tag === INFINITY_SYNC_TAG) {
      await triggerImmediateInfinitySync(`fallback-${context}`);
    }
  }
}

function markInfinityPending(reason = 'unspecified') {
  updateInfinityState({
    pendingFlush: true,
    pendingReason: reason,
    offlineSince: infinityClientState.isOffline ? (infinityClientState.offlineSince || Date.now()) : infinityClientState.offlineSince
  });
  scheduleInfinityBackgroundSync(reason);
}

function scheduleInfinityBackgroundSync(reason = 'unspecified') {
  ensureBackgroundSyncRegistration(INFINITY_SYNC_TAG, reason).catch((error) => {
    console.warn('⚠️ Failed to schedule infinity background sync:', error);
  });
}

function handleNetworkStatusChange(isOnline, payload = {}) {
  if (isOnline) {
    updateInfinityState({
      isOffline: false,
      offlineSince: null,
      pendingReason: infinityClientState.pendingReason
    });
    scheduleInfinityBackgroundSync(payload.reason || 'network-online');
    triggerImmediateInfinitySync(payload.reason || 'network-online').catch((error) => {
      console.warn('⚠️ Failed to trigger infinity sync on network recovery:', error);
    });
  } else {
    updateInfinityState({
      isOffline: true,
      offlineSince: Date.now()
    });
    markInfinityPending('network-offline');
  }
}

function handleLockScreenStateChange(payload = {}) {
  updateInfinityState({
    lockScreen: Boolean(payload.active ?? payload.lockScreen),
    infinityMode: payload.infinityMode ?? infinityClientState.infinityMode
  });
  if (payload.active) {
    startInfinitySync();
    startInfinityHealthLoop();
  }
}

async function refreshInfinityPendingFlag() {
  try {
    const cache = await caches.open(SYNC_QUEUE_CACHE);
    const remaining = await cache.keys();
    updateInfinityState({
      pendingFlush: remaining.length > 0,
      pendingReason: remaining.length > 0 ? infinityClientState.pendingReason : null
    });
    return remaining.length;
  } catch (error) {
    console.warn('⚠️ Unable to refresh infinity pending flag:', error);
    return null;
  }
}

// ✅ INSTALL EVENT - Setup cache untuk offline support
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker: Installing Real-Time GPS Tracker...');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('✅ App Cache opened');
          return cache.addAll(urlsToCache);
        }),
      caches.open(GPS_DATA_CACHE)
        .then((cache) => {
          console.log('✅ GPS Data Cache opened - Ready for offline tracking');
          return cache;
        }),
      caches.open(SYNC_QUEUE_CACHE)
        .then((cache) => {
          console.log('✅ Sync Queue Cache opened');
          return cache;
        })
    ]).then(() => {
      console.log('✅ All caches ready - Skipping waiting');
      return self.skipWaiting();
    }).catch(error => {
      console.error('❌ Cache installation failed:', error);
      return self.skipWaiting();
    })
  );
});

// ✅ ACTIVATE EVENT - Cleanup cache lama
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activated - Real-Time GPS Tracking Ready');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Hapus cache lama yang tidak digunakan
          if (![CACHE_NAME, GPS_DATA_CACHE, SYNC_QUEUE_CACHE].includes(cacheName)) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Cache cleanup completed');
      startInfinitySync();
      startInfinityHealthLoop();
      return self.clients.claim();
    }).catch(error => {
      console.error('❌ Activation failed:', error);
    })
  );
});

// ✅ ENHANCED FETCH HANDLER - Real-time GPS data priority
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Handle GPS data requests dengan strategy khusus
  if (url.includes('/units/') || 
      url.includes('/gps-data') || 
      url.includes('/waypoints') ||
      url.includes('firebaseio.com')) {
    
    event.respondWith(handleGPSFetch(event.request));
    return;
  }
  
  // Untuk static assets - Cache First strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version jika ada
        if (response) {
          return response;
        }
        
        // Jika tidak ada di cache, fetch dari network
        return fetch(event.request)
          .then(fetchResponse => {
            // Cache response baru untuk future use
            if (fetchResponse && fetchResponse.status === 200) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });
            }
            return fetchResponse;
          })
          .catch(error => {
            console.log('📴 Offline - Cannot fetch:', event.request.url);
            
            // Fallback untuk halaman utama
            if (event.request.destination === 'document') {
              return caches.match('./mobile.html');
            }
            
            return new Response('Offline - GPS Tracking Active', {
              status: 200,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// ✅ GPS FETCH HANDLER - Offline First dengan real-time caching
async function handleGPSFetch(request) {
  const isWriteOperation = request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH';
  
  try {
    // Untuk write operations, cache dulu lalu try sync
    if (isWriteOperation) {
      return await handleGPSWriteOperation(request);
    }
    
    // Untuk read operations, try network first
    return await handleGPSReadOperation(request);
    
  } catch (error) {
    console.error('❌ GPS fetch handler error:', error);
    
    // Return success response untuk prevent client errors
    return new Response(JSON.stringify({ 
      status: 'offline_cached',
      message: 'GPS data cached offline - will sync when online',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
// ✅ INFINITY SYNC STRATEGY - Tidak pernah berhenti sync
async function runInfinitySyncCycle(source = 'scheduled') {
  const isOnline = getOnlineStatus();
  
  if (!isOnline) {
      console.log(`📴 Skipping infinity sync (${source}) - offline`);
      markInfinityPending(`offline-${source}`);
      return;
  }
  
  try {
      await syncCachedGPSData();
  } catch (error) {
      console.error(`❌ Infinity sync cycle error [${source}]:`, error);
  }
}

function scheduleInfinitySyncCycle(delay = INFINITY_SYNC_INTERVAL_MS) {
  if (infinitySyncTimer) {
      clearTimeout(infinitySyncTimer);
  }
  
  infinitySyncTimer = setTimeout(async () => {
      await runInfinitySyncCycle('loop');
      scheduleInfinitySyncCycle(INFINITY_SYNC_INTERVAL_MS);
  }, Math.max(0, delay));
}

async function startInfinitySync() {
  if (infinitySyncLoopStarted) {
      return;
  }
  
  infinitySyncLoopStarted = true;
  console.log('♾️ Infinity sync loop initialized');
  
  await runInfinitySyncCycle('bootstrap');
  scheduleInfinitySyncCycle(0);
}

async function triggerImmediateInfinitySync(reason = 'manual') {
  startInfinitySync();
  await runInfinitySyncCycle(reason);
}

// ✅ ENHANCED BACKGROUND SYNC dengan infinity retry
self.addEventListener('sync', (event) => {
  console.log('🔄 Infinity Background Sync:', event.tag);
  
  switch (event.tag) {
      case INFINITY_SYNC_TAG:
          event.waitUntil(performInfinitySync());
          break;
          
      case HEALTH_SYNC_TAG:
          event.waitUntil(performInfinityHealthCheck());
          break;
      
      case BACKGROUND_SYNC_TAG:
          event.waitUntil(syncCachedGPSData());
          break;
          
      default:
          // Untuk sync event lainnya, tetap process
          event.waitUntil(syncCachedGPSData());
  }
});

// ✅ INFINITY SYNC FUNCTION
async function performInfinitySync() {
  console.log('♾️ Starting infinity sync process...');
  
  let attempt = 0;
  const maxAttempts = 5;
  
  while (attempt < maxAttempts) {
      try {
          await syncCachedGPSData();
          console.log(`✅ Infinity sync completed on attempt ${attempt + 1}`);
          await refreshInfinityPendingFlag();
          
          // Notify clients tentang sync success
          await notifyClients({
              type: 'INFINITY_SYNC_COMPLETED',
              data: {
                  attempt: attempt + 1,
                  timestamp: new Date().toISOString(),
                  status: 'success'
              }
          });
          
          return; // Berhasil, keluar dari loop
          
      } catch (error) {
          attempt++;
          console.warn(`❌ Infinity sync attempt ${attempt} failed:`, error.message);
          
          if (attempt >= maxAttempts) {
              console.error('🚨 Maximum infinity sync attempts reached');
              markInfinityPending('infinity-sync-retry');
              scheduleInfinityBackgroundSync('infinity-sync-retry');
              
              // Notify clients tentang failure
              await notifyClients({
                  type: 'INFINITY_SYNC_FAILED',
                  data: {
                      attempt: attempt,
                      error: error.message,
                      timestamp: new Date().toISOString()
                  }
              });
              
              break;
          }
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
      }
  }
}

// ✅ INFINITY HEALTH CHECK FUNCTION
async function performInfinityHealthCheck() {
  try {
      console.log('🔍 Performing infinity health check...');
      
      const healthStatus = {
          timestamp: new Date().toISOString(),
          online: getOnlineStatus(),
          cacheStatus: await getCacheStatus(),
          syncQueue: await getSyncQueueStatus(),
          storage: await getStorageEstimate(),
          serviceWorker: 'active',
          infinityMode: true
      };
      
      console.log('🔍 Infinity Health Check:', healthStatus);
      
      // Notify clients tentang health status
      await notifyClients({
          type: 'INFINITY_HEALTH_CHECK',
          data: healthStatus
      });
      
      // Schedule next health check jika dalam infinity mode
      if (healthStatus.infinityMode) {
          setTimeout(() => {
              ensureBackgroundSyncRegistration(HEALTH_SYNC_TAG, 'health-check-followup')
                  .then(() => console.log('🔍 Next infinity health check scheduled'))
                  .catch(err => console.error('Health check scheduling failed:', err));
          }, 60000); // Setiap 1 menit
      }
      
      return healthStatus;
      
  } catch (error) {
      console.error('❌ Infinity health check failed:', error);
      
      await notifyClients({
          type: 'INFINITY_HEALTH_CHECK_FAILED',
          data: {
              error: error.message,
              timestamp: new Date().toISOString()
          }
      });
  }
}

function startInfinityHealthLoop() {
  if (infinityHealthTimer) {
      return;
  }
  
  const runHealthCheck = async () => {
      try {
          await performInfinityHealthCheck();
      } catch (error) {
          console.error('❌ Periodic infinity health check failed:', error);
      } finally {
          infinityHealthTimer = setTimeout(runHealthCheck, INFINITY_HEALTH_INTERVAL_MS);
      }
  };
  
  infinityHealthTimer = setTimeout(runHealthCheck, INFINITY_HEALTH_INTERVAL_MS);
}

// ✅ HELPER FUNCTION: Get Cache Status
async function getCacheStatus() {
  try {
      const syncCache = await caches.open(SYNC_QUEUE_CACHE);
      const gpsCache = await caches.open(GPS_DATA_CACHE);
      
      const syncRequests = await syncCache.keys();
      const gpsRequests = await gpsCache.keys();
      
      return {
          syncQueueSize: syncRequests.length,
          gpsCacheSize: gpsRequests.length,
          totalItems: syncRequests.length + gpsRequests.length,
          lastUpdate: new Date().toISOString()
      };
  } catch (error) {
      return { error: error.message };
  }
}

// ✅ HELPER FUNCTION: Get Sync Queue Status
async function getSyncQueueStatus() {
  try {
      const cache = await caches.open(SYNC_QUEUE_CACHE);
      const requests = await cache.keys();
      
      let highPriority = 0;
      let mediumPriority = 0;
      let lowPriority = 0;
      let totalSize = 0;
      
      for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
              const item = await response.json();
              switch (item.priority) {
                  case 'realtime_high': highPriority++; break;
                  case 'waypoints_medium': mediumPriority++; break;
                  case 'status_low': lowPriority++; break;
              }
              
              // Estimate size
              const itemSize = new Blob([JSON.stringify(item)]).size;
              totalSize += itemSize;
          }
      }
      
      return {
          total: requests.length,
          byPriority: { highPriority, mediumPriority, lowPriority },
          estimatedSize: (totalSize / 1024).toFixed(2) + ' KB',
          oldestItem: await getOldestCachedItem()
      };
  } catch (error) {
      return { error: error.message };
  }
}
async function getOldestCachedItem() {
  try {
      const cache = await caches.open(SYNC_QUEUE_CACHE);
      const requests = await cache.keys();
      
      let oldestTimestamp = Date.now();
      for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
              const item = await response.json();
              const itemTime = new Date(item.timestamp).getTime();
              if (itemTime < oldestTimestamp) {
                  oldestTimestamp = itemTime;
              }
          }
      }
      
      return new Date(oldestTimestamp).toISOString();
  } catch (error) {
      return null;
  }
}
// ✅ HANDLE GPS WRITE OPERATIONS - Cache dulu, sync nanti
async function handleGPSWriteOperation(request) {
  console.log('📝 GPS Write Operation - Caching for offline sync');
  
  // Clone request untuk caching dan network forwarding
  const requestCloneForBody = request.clone();
  const requestCloneForNetwork = request.clone();
  let requestBody = {};
  
  try {
      requestBody = await requestCloneForBody.json();
  } catch (error) {
      console.warn('⚠️ Failed to parse request body, using empty payload', error);
      requestBody = {};
  }
  
  // Cache data untuk sync nanti
  await cacheGPSDataForSync(request.url, request.method, requestBody);
  
  // Try to send to server jika online
  const isOnline = getOnlineStatus();
  if (isOnline) {
    try {
      const response = await fetch(requestCloneForNetwork);
      if (response.ok) {
        console.log('📡 GPS data sent to server successfully');
        
        // Hapus dari cache jika berhasil dikirim
        await removeFromSyncCache(request.url, requestBody);
        return response;
      }
    } catch (serverError) {
      console.log('📴 Server offline - data remains in cache');
    }
  }
  
  // Return success response ke client
  return new Response(JSON.stringify({ 
    status: 'cached_offline',
    message: 'Data disimpan offline - akan sync otomatis',
    cachedAt: new Date().toISOString(),
    data: requestBody
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ✅ HANDLE GPS READ OPERATIONS - Network First
async function handleGPSReadOperation(request) {
  // Try network first
  if (getOnlineStatus()) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        return response;
      }
    } catch (error) {
      console.log('📴 Network offline for read operation');
    }
  }
  
  // Fallback ke cache jika ada
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log('💾 Serving cached GPS data for read');
    return cachedResponse;
  }
  
  // Return empty response jika tidak ada cache
  return new Response(JSON.stringify({ 
    status: 'offline_no_cache',
    message: 'Offline - no cached data available'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ✅ CACHE GPS DATA FOR SYNC
async function cacheGPSDataForSync(url, method, data) {
  try {
    const cache = await caches.open(SYNC_QUEUE_CACHE);
    const cacheKey = `./sync-queue/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const cacheItem = {
      url: url,
      method: method,
      data: data,
      timestamp: new Date().toISOString(),
      attemptCount: 0,
      lastAttempt: null,
      priority: getSyncPriority(data)
    };
    
    const response = new Response(JSON.stringify(cacheItem));
    await cache.put(cacheKey, response);
    markInfinityPending('cache-gps-data');
    
    console.log('💾 GPS data cached for sync:', {
      type: cacheItem.priority,
      lat: data.lat,
      lng: data.lng,
      speed: data.speed,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Update sync status ke clients
    await notifyClients({
      type: 'DATA_CACHED',
      data: {
        cachedItems: await getCachedItemsCount(),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to cache GPS data for sync:', error);
    await notifyClients({
      type: 'CACHE_ERROR',
      data: {
        error: error.message,
        url,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// ✅ GET SYNC PRIORITY - Prioritaskan data penting
function getSyncPriority(data) {
  // Real-time position data - highest priority
  if (data.lat && data.lng && data.speed !== undefined) {
    return 'realtime_high';
  }
  
  // Waypoint data - medium priority
  if (data.waypoints || data.sessionId) {
    return 'waypoints_medium';
  }
  
  // Status updates - low priority
  return 'status_low';
}

// ✅ BACKGROUND SYNC EVENT - Real-time data sync
// ✅ ENHANCED BACKGROUND SYNC EVENT
self.addEventListener('sync', (event) => {
  console.log('🔄 Background Sync Event:', event.tag);
  
  switch (event.tag) {
      case 'infinity-gps-sync':
      case 'background-gps-sync':
          event.waitUntil(performInfinitySync());
          break;
          
      case 'gps-health-check':
      case 'health-check-sync':
          event.waitUntil(performInfinityHealthCheck());
          break;
          
      case 'emergency-gps-backup':
          event.waitUntil(performEmergencyBackup());
          break;
          
      default:
          console.log('🔄 Unknown sync tag:', event.tag);
          // Fallback ke sync normal
          event.waitUntil(syncCachedGPSData());
  }
});
// ✅ SYNC CACHED GPS DATA - Process semua data yang tertahan
async function syncCachedGPSData() {
  try {
    const cache = await caches.open(SYNC_QUEUE_CACHE);
    const requests = await cache.keys();
    
    console.log(`📡 Starting sync: ${requests.length} items in queue`);
    if (requests.length === 0) {
      updateInfinityState({ pendingFlush: false, pendingReason: null });
      await notifyClients({
        type: 'SYNC_COMPLETED',
        data: { message: 'No data to sync', items: 0 }
      });
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    let retryItems = [];
    
    // Process items berdasarkan priority
    const prioritizedRequests = await prioritizeSyncRequests(requests);
    
    for (const request of prioritizedRequests) {
      try {
        const response = await cache.match(request);
        if (!response) continue;
        
        const cachedItem = await response.json();
        
        // Try to send to server
        const syncSuccess = await sendToServer(cachedItem);
        
        if (syncSuccess) {
          // Hapus dari cache jika berhasil
          await cache.delete(request);
          successCount++;
          
          console.log(`✅ Synced: ${cachedItem.data.lat}, ${cachedItem.data.lng}`);
        } else {
          // Update attempt count untuk retry nanti
          cachedItem.attemptCount++;
          cachedItem.lastAttempt = new Date().toISOString();
          
          const updatedResponse = new Response(JSON.stringify(cachedItem));
          await cache.put(request, updatedResponse);
          
          failCount++;
          retryItems.push(cachedItem);
        }
        
      } catch (itemError) {
        console.error('❌ Error processing sync item:', itemError);
        failCount++;
      }
    }
    
    // Report sync results
    const syncResult = {
      successCount,
      failCount,
      totalItems: requests.length,
      retryItems: retryItems.length,
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 Sync completed:', syncResult);
    
    await notifyClients({
      type: 'SYNC_COMPLETED',
      data: syncResult
    });
    
    // Schedule retry untuk failed items
    if (failCount > 0) {
      setTimeout(() => {
        ensureBackgroundSyncRegistration(BACKGROUND_SYNC_TAG, 'failed-item-retry')
          .then(() => console.log('🔄 Retry scheduled for failed items'))
          .catch(err => console.error('Retry scheduling failed:', err));
      }, 30000);
    }

    await refreshInfinityPendingFlag();
    
  } catch (error) {
    console.error('❌ GPS sync failed completely:', error);
    
    await notifyClients({
      type: 'SYNC_FAILED',
      data: { 
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// ✅ PRIORITIZE SYNC REQUESTS - Urutkan berdasarkan priority
async function prioritizeSyncRequests(requests) {
  const items = [];
  
  for (const request of requests) {
    const response = await caches.match(request);
    if (response) {
      const item = await response.json();
      items.push({ request, item });
    }
  }
  
  // Urutkan berdasarkan priority dan timestamp
  items.sort((a, b) => {
    const priorityOrder = { 'realtime_high': 0, 'waypoints_medium': 1, 'status_low': 2 };
    const aPriority = priorityOrder[a.item.priority] || 3;
    const bPriority = priorityOrder[b.item.priority] || 3;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    return new Date(a.item.timestamp) - new Date(b.item.timestamp);
  });
  
  return items.map(item => item.request);
}

// ✅ SEND TO SERVER - Simulasi pengiriman ke Firebase/Server
async function sendToServer(cachedItem) {
  return new Promise((resolve) => {
    // Simulasi pengiriman data ke server
    setTimeout(() => {
      // Simulasi: 90% success rate untuk testing
      const success = Math.random() > 0.1;
      
      if (success) {
        console.log('📤 Data sent to server successfully:', {
          url: cachedItem.url,
          lat: cachedItem.data.lat,
          lng: cachedItem.data.lng,
          speed: cachedItem.data.speed
        });
        resolve(true);
      } else {
        console.log('❌ Failed to send data to server');
        resolve(false);
      }
    }, 500);
  });
}

// ✅ EMERGENCY BACKUP - Ketika battery low atau kondisi kritis
async function performEmergencyBackup() {
  try {
    console.log('🚨 Performing emergency backup...');
    
    const syncCache = await caches.open(SYNC_QUEUE_CACHE);
    const requests = await syncCache.keys();
    
    // Backup hanya 100 data terbaru
    const backupData = [];
    const recentRequests = requests.slice(-100);
    
    for (const request of recentRequests) {
      const response = await syncCache.match(request);
      if (response) {
        const data = await response.json();
        backupData.push(data);
      }
    }
    
    // Simpan backup ke GPS data cache
    const gpsCache = await caches.open(GPS_DATA_CACHE);
    const backupKey = `./emergency-backup/${Date.now()}`;
    const backupResponse = new Response(JSON.stringify({
      data: backupData,
      timestamp: new Date().toISOString(),
      itemCount: backupData.length
    }));
    
    await gpsCache.put(backupKey, backupResponse);
    
    console.log(`🚨 Emergency backup completed: ${backupData.length} items saved`);
    
    await notifyClients({
      type: 'EMERGENCY_BACKUP_CREATED',
      data: {
        itemCount: backupData.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Emergency backup failed:', error);
  }
}

// ✅ HEALTH CHECK SYNC
async function performHealthCheckSync() {
  try {
    const syncCache = await caches.open(SYNC_QUEUE_CACHE);
    const gpsCache = await caches.open(GPS_DATA_CACHE);
    
    const syncItems = await syncCache.keys();
    const gpsItems = await gpsCache.keys();
    
    const healthStatus = {
      syncQueueSize: syncItems.length,
      gpsCacheSize: gpsItems.length,
      lastCheck: new Date().toISOString(),
      online: getOnlineStatus(),
      storage: await getStorageEstimate()
    };
    
    console.log('🔍 Health Check Sync:', healthStatus);
    
    await notifyClients({
      type: 'HEALTH_CHECK',
      data: healthStatus
    });
    
    // Cleanup old data jika storage hampir penuh
    if (healthStatus.storage.percentage > 80) {
      await performStorageCleanup();
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}
async function syncPositions() {
    try {
        const offlinePositions = JSON.parse(localStorage.getItem('offline_positions') || '[]');
        if (offlinePositions.length === 0) {
            console.log('📡 No offline positions to sync');
            return;
        }

        console.log(`📡 Syncing ${offlinePositions.length} offline positions`);
        
        // Use the existing GPS_DATA_CACHE for storing positions
        const cache = await caches.open(GPS_DATA_CACHE);
        const cacheKey = `./offline-positions/${Date.now()}`;
        const response = new Response(JSON.stringify(offlinePositions));
        await cache.put(cacheKey, response);
        
        // Clear localStorage after successful caching
        localStorage.removeItem('offline_positions');
        
        console.log('✅ Offline positions synced to cache');
        
        // Notify clients about the sync
        await notifyClients({
            type: 'POSITIONS_SYNCED',
            data: {
                count: offlinePositions.length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to sync offline positions:', error);
        throw error; // This will trigger a retry
    }
}

// ✅ MESSAGE HANDLER - Komunikasi dengan client
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  console.log('📩 Service Worker received message:', type);
  
  try {
    switch (type) {
      case 'CACHE_GPS_DATA':
        await handleCacheGPSData(data);
        break;
        
      case 'GET_CACHED_DATA':
        const cachedData = await getCachedGPSData();
        event.ports[0]?.postMessage({
          type: 'CACHED_DATA_RESPONSE',
          data: cachedData
        });
        break;
        
      case 'GET_SYNC_STATUS':
        const syncStatus = await getSyncStatus();
        event.ports[0]?.postMessage({
          type: 'SYNC_STATUS_RESPONSE',
          data: syncStatus
        });
        break;
        
      case 'TRIGGER_SYNC':
        await triggerManualSync();
        break;
      
      case 'TRIGGER_INFINITY_SYNC':
        await triggerImmediateInfinitySync('client-request');
        break;
        
      case 'CLEAR_CACHE':
        await clearSpecificCache(data);
        break;
        
      case 'LOGOUT_CLEANUP':
        await handleLogoutCleanup();
        break;
        
      case 'BACKGROUND_STATE_CHANGE':
        handleBackgroundStateChange(data);
        break;
      
      case 'NETWORK_ONLINE':
        handleNetworkStatusChange(true, data);
        break;
      
      case 'NETWORK_OFFLINE':
        handleNetworkStatusChange(false, data);
        break;
      
      case 'LOCKSCREEN_STATE_CHANGE':
        handleLockScreenStateChange(data);
        break;
        
      case 'GET_STORAGE_INFO':
        const storageInfo = await getStorageInfo();
        event.ports[0]?.postMessage({
          type: 'STORAGE_INFO_RESPONSE',
          data: storageInfo
        });
        break;
        case 'GET_OFFLINE_POSITIONS':
          const positions = await getOfflinePositions();
          event.ports[0]?.postMessage({
              type: 'OFFLINE_POSITIONS_RESPONSE',
              data: positions
          });
          break;
        
      default:
        console.log('📩 Unknown message type:', type);
    }
  } catch (error) {
    console.error('❌ Message handler error:', error);
    
    event.ports[0]?.postMessage({
      type: 'ERROR_RESPONSE',
      data: { error: error.message }
    });
  }
});

async function getOfflinePositions() {
  try {
      const cache = await caches.open(GPS_DATA_CACHE);
      const requests = await cache.keys();
      const positions = [];
      
      for (const request of requests) {
          if (request.url.includes('/offline-positions/')) {
              const response = await cache.match(request);
              if (response) {
                  const data = await response.json();
                  positions.push(...data);
              }
          }
      }
      
      return positions;
  } catch (error) {
      console.error('❌ Failed to get offline positions:', error);
      return [];
  }
}

// ✅ HANDLE CACHE GPS DATA - Direct caching dari client
async function handleCacheGPSData(gpsData) {
  try {
    const cache = await caches.open(GPS_DATA_CACHE);
    const cacheKey = `./gps-realtime/${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const cacheItem = {
      data: gpsData,
      timestamp: new Date().toISOString(),
      type: 'realtime_position',
      sessionId: gpsData.sessionId,
      unit: gpsData.unit,
      accuracy: gpsData.accuracy
    };
    
    const response = new Response(JSON.stringify(cacheItem));
    await cache.put(cacheKey, response);
    
    console.log('💾 Real-time GPS data cached:', {
      lat: gpsData.lat?.toFixed(6),
      lng: gpsData.lng?.toFixed(6),
      speed: gpsData.speed?.toFixed(1),
      accuracy: gpsData.accuracy?.toFixed(1),
      time: new Date().toLocaleTimeString()
    });
    
    // Juga tambahkan ke sync queue untuk dikirim ke server
    await cacheGPSDataForSync('/api/gps/realtime', 'POST', gpsData);
    
  } catch (error) {
    console.error('❌ Failed to cache GPS data:', error);
  }
}

// ✅ GET CACHED GPS DATA
async function getCachedGPSData() {
  try {
    const cache = await caches.open(GPS_DATA_CACHE);
    const requests = await cache.keys();
    
    const gpsData = [];
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const data = await response.json();
        gpsData.push(data);
      }
    }
    
    // Urutkan berdasarkan timestamp
    gpsData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return {
      items: gpsData,
      count: gpsData.length,
      lastUpdate: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Failed to get cached GPS data:', error);
    return { items: [], count: 0, error: error.message };
  }
}

// ✅ GET SYNC STATUS
async function getSyncStatus() {
  try {
    const syncCache = await caches.open(SYNC_QUEUE_CACHE);
    const requests = await syncCache.keys();
    
    let highPriority = 0;
    let mediumPriority = 0;
    let lowPriority = 0;
    
    for (const request of requests) {
      const response = await syncCache.match(request);
      if (response) {
        const item = await response.json();
        switch (item.priority) {
          case 'realtime_high': highPriority++; break;
          case 'waypoints_medium': mediumPriority++; break;
          case 'status_low': lowPriority++; break;
        }
      }
    }
    
    return {
      totalItems: requests.length,
      byPriority: { highPriority, mediumPriority, lowPriority },
      online: getOnlineStatus(),
      lastUpdate: new Date().toISOString()
    };
    
  } catch (error) {
    return { error: error.message };
  }
}

// ✅ TRIGGER MANUAL SYNC
async function triggerManualSync() {
  if (!getOnlineStatus()) {
    await notifyClients({
      type: 'SYNC_STATUS',
      data: { status: 'offline', message: 'Tidak dapat sync - perangkat offline' }
    });
    return;
  }
  
  try {
    await ensureBackgroundSyncRegistration(BACKGROUND_SYNC_TAG, 'manual-trigger');
    
    await notifyClients({
      type: 'SYNC_STATUS',
      data: { status: 'triggered', message: 'Sync manual dimulai...' }
    });
    
  } catch (error) {
    await notifyClients({
      type: 'SYNC_STATUS',
      data: { status: 'error', message: 'Gagal trigger sync' }
    });
  }
}

// ✅ HANDLE LOGOUT CLEANUP - Hapus semua data user
async function handleLogoutCleanup() {
  console.log('🚪 Logout cleanup initiated');
  
  try {
    const syncCache = await caches.open(SYNC_QUEUE_CACHE);
    const gpsCache = await caches.open(GPS_DATA_CACHE);
    
    const syncRequests = await syncCache.keys();
    const gpsRequests = await gpsCache.keys();
    
    // Hapus semua data dari cache
    for (const request of syncRequests) {
      await syncCache.delete(request);
    }
    
    for (const request of gpsRequests) {
      await gpsCache.delete(request);
    }
    
    console.log(`🗑️ Logout cleanup completed: ${syncRequests.length} sync + ${gpsRequests.length} GPS data removed`);
    
    await notifyClients({
      type: 'LOGOUT_CLEANUP_COMPLETED',
      data: {
        syncItems: syncRequests.length,
        gpsItems: gpsRequests.length,
        timestamp: new Date().toISOString()
      }
    });
    
    updateInfinityState({ pendingFlush: false, pendingReason: null });
    
  } catch (error) {
    console.error('❌ Logout cleanup failed:', error);
  }
}

// ✅ HANDLE BACKGROUND STATE CHANGE
function handleBackgroundStateChange(data) {
  console.log('📱 Background state changed:', data.isBackground);
  
  updateInfinityState({
    isBackground: Boolean(data.isBackground),
    lockScreen: data.lockScreen ?? infinityClientState.lockScreen,
    infinityMode: data.infinityMode ?? infinityClientState.infinityMode
  });
  
  if (data.isBackground) {
    console.log('🎯 Background mode - optimizing for battery');
  } else {
    console.log('🎯 Foreground mode - full features enabled');
  }
  
  startInfinitySync();
  startInfinityHealthLoop();
}

// ✅ CLEAR SPECIFIC CACHE
async function clearSpecificCache(cacheName) {
  try {
    if (cacheName === 'all') {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('🗑️ All caches cleared');
    } else {
      await caches.delete(cacheName);
      console.log(`🗑️ Cache cleared: ${cacheName}`);
    }
  } catch (error) {
    console.error('❌ Cache clearance failed:', error);
  }
}

// ✅ GET STORAGE INFO
async function getStorageInfo() {
  try {
    const syncCache = await caches.open(SYNC_QUEUE_CACHE);
    const gpsCache = await caches.open(GPS_DATA_CACHE);
    
    const syncItems = await syncCache.keys();
    const gpsItems = await gpsCache.keys();
    
    return {
      syncQueue: syncItems.length,
      gpsCache: gpsItems.length,
      storage: await getStorageEstimate(),
      lastUpdate: new Date().toISOString()
    };
  } catch (error) {
    return { error: error.message };
  }
}

// ✅ HELPER FUNCTIONS
async function getCachedItemsCount() {
  try {
    const syncCache = await caches.open(SYNC_QUEUE_CACHE);
    const requests = await syncCache.keys();
    return requests.length;
  } catch (error) {
    return 0;
  }
}

async function removeFromSyncCache(url, data) {
  try {
    const cache = await caches.open(SYNC_QUEUE_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const item = await response.json();
        if (item.url === url && JSON.stringify(item.data) === JSON.stringify(data)) {
          await cache.delete(request);
          console.log('✅ Removed synced item from cache');
          break;
        }
      }
    }
  } catch (error) {
    console.error('Failed to remove from sync cache:', error);
  }
}

async function getStorageEstimate() {
  const nav = (typeof self !== 'undefined') ? self.navigator : undefined;
  if (nav?.storage?.estimate) {
    try {
      const estimate = await nav.storage.estimate();
      const percentage = estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0;
      
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: percentage.toFixed(1),
        status: percentage > 80 ? 'warning' : percentage > 90 ? 'critical' : 'normal'
      };
    } catch (error) {
      return { error: error.message };
    }
  }
  return { unavailable: true };
}

async function performStorageCleanup() {
  try {
    const syncCache = await caches.open(SYNC_QUEUE_CACHE);
    const requests = await syncCache.keys();
    
    // Hapus 20% data tertua jika storage penuh
    const deleteCount = Math.floor(requests.length * 0.2);
    const oldRequests = requests.slice(0, deleteCount);
    
    for (const request of oldRequests) {
      await syncCache.delete(request);
    }
    
    console.log(`🗑️ Storage cleanup: ${deleteCount} old items removed`);
    
  } catch (error) {
    console.error('Storage cleanup failed:', error);
  }
}

async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage(message);
    });
  } catch (error) {
    console.error('Failed to notify clients:', error);
  }
}

// ✅ PERIODIC SYNC untuk maintenance
self.addEventListener('periodicsync', (event) => {
  if (event.tag === HEALTH_SYNC_TAG) {
    console.log('🔍 Periodic GPS Health Check');
    event.waitUntil(performHealthCheckSync());
  }
});

// ✅ PUSH NOTIFICATION handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'GPS Tracking aktif di background',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'gps-tracking',
    requireInteraction: true,
    data: data
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'DT GPS Tracker', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});
cleanup = () => {
  console.log('🧹 Comprehensive system cleanup with analytics support...');
  
  // Cleanup Service Worker
  if (this.serviceWorkerRegistration) {
      this.serviceWorkerRegistration.unregister().then(() => {
          console.log('✅ Service Worker unregistered');
      });
  }
}

console.log('✅ Service Worker loaded successfully - Real-Time GPS Tracking Ready');

// ===== FIREBASE CONFIG =====
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBMiER_5b51IEEoxivkCliRC0WID1f-yzk",
    authDomain: "joi-gps-tracker.firebaseapp.com",
    databaseURL: "https://joi-gps-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "joi-gps-tracker",
    storageBucket: "joi-gps-tracker.firebasestorage.app",
    messagingSenderId: "216572191895",
    appId: "1:216572191895:web:a4fef1794daf200a2775d2"
};

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const database = firebase.database();

// ===== ENHANCED KALMAN FILTER FOR REAL-TIME ACCURACY =====
class EnhancedKalmanFilter {
    constructor(processNoise = 0.01, measurementNoise = 0.1, error = 0.1) {
        this.Q = processNoise;
        this.R = measurementNoise;
        this.P = error;
        this.X = 0;
        this.K = 0;
    }

    update(measurement) {
        this.P = this.P + this.Q;
        this.K = this.P / (this.P + this.R);
        this.X = this.X + this.K * (measurement - this.X);
        this.P = (1 - this.K) * this.P;
        return this.X;
    }

    reset() {
        this.P = 0.1;
        this.X = 0;
        this.K = 0;
    }
}

class GPSKalmanFilter {
    constructor() {
        this.latitudeFilter = new EnhancedKalmanFilter(0.005, 0.05, 0.05);
        this.longitudeFilter = new EnhancedKalmanFilter(0.005, 0.05, 0.05);
        this.speedFilter = new EnhancedKalmanFilter(0.05, 0.3, 0.5);
        this.bearingFilter = new EnhancedKalmanFilter(0.05, 0.2, 0.5);
    }

    updatePosition(rawLat, rawLng, rawSpeed, rawBearing) {
        const filteredLat = this.latitudeFilter.update(rawLat);
        const filteredLng = this.longitudeFilter.update(rawLng);
        const filteredSpeed = Math.max(0, this.speedFilter.update(rawSpeed));
        const filteredBearing = rawBearing !== null ? this.bearingFilter.update(rawBearing) : null;

        return {
            lat: filteredLat,
            lng: filteredLng,
            speed: filteredSpeed,
            bearing: filteredBearing,
            accuracy: Math.max(5, this.calculateAccuracy())
        };
    }

    calculateAccuracy() {
        const latVariance = this.latitudeFilter.P;
        const lngVariance = this.longitudeFilter.P;
        return Math.sqrt(latVariance + lngVariance) * 50000;
    }

    reset() {
        this.latitudeFilter.reset();
        this.longitudeFilter.reset();
        this.speedFilter.reset();
        this.bearingFilter.reset();
    }
}

// ===== ENHANCED GPS PROCESSOR =====
class EnhancedGPSProcessor {
    constructor() {
        this.kalmanFilter = new GPSKalmanFilter();
        this.lastValidPosition = null;
        this.consecutiveBadReadings = 0;
        this.accuracyThreshold = 35;
        this.speedThreshold = 180;
        this.jumpThreshold = 0.02;
    }

    processRawPosition(position) {
        const rawCoords = position.coords;
        
        if (!this.isValidCoordinate(rawCoords.latitude, rawCoords.longitude)) {
            return null;
        }

        if (rawCoords.accuracy > 50) {
            this.consecutiveBadReadings++;
            if (this.consecutiveBadReadings > 3) return null;
        } else {
            this.consecutiveBadReadings = 0;
        }

        const rawSpeed = rawCoords.speed !== null ? Math.max(0, rawCoords.speed * 3.6) : 0;

        const filtered = this.kalmanFilter.updatePosition(
            rawCoords.latitude,
            rawCoords.longitude,
            rawSpeed,
            rawCoords.heading
        );

        if (this.lastValidPosition && !this.isValidMovement(this.lastValidPosition, filtered)) {
            return { ...this.lastValidPosition, accuracy: Math.max(filtered.accuracy, 30) };
        }

        this.lastValidPosition = { ...filtered, timestamp: new Date() };
        return filtered;
    }

    isValidCoordinate(lat, lng) {
        return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }

    isValidMovement(previous, current) {
        if (!previous) return true;
        
        const distance = this.calculateDistance(previous.lat, previous.lng, current.lat, current.lng);
        const timeDiff = (current.timestamp - previous.timestamp) / 1000;
        const maxPossibleDistance = (this.speedThreshold / 3.6) * timeDiff;
        
        return distance <= Math.max(maxPossibleDistance, this.jumpThreshold * 1000);
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    reset() {
        this.kalmanFilter.reset();
        this.lastValidPosition = null;
        this.consecutiveBadReadings = 0;
    }
}

// ===== ENHANCED SPEED CALCULATOR =====
class EnhancedSpeedCalculator {
    constructor() {
        this.speedHistory = [];
        this.gpsSpeedWeight = 0.7;
        this.calcSpeedWeight = 0.3;
        this.maxHistorySize = 3;
    }

    calculateEnhancedSpeed(currentPosition, previousPosition, gpsSpeed) {
        if (!previousPosition) return gpsSpeed || 0;

        const timeDiffMs = currentPosition.timestamp - previousPosition.timestamp;
        if (timeDiffMs < 500) return this.getLastValidSpeed();

        const distanceKm = this.calculateHaversineDistance(
            previousPosition.lat, previousPosition.lng,
            currentPosition.lat, currentPosition.lng
        );
        
        const timeDiffHours = timeDiffMs / 3600000;
        const calculatedSpeed = timeDiffHours > 0 ? distanceKm / timeDiffHours : 0;

        let finalSpeed = gpsSpeed;
        if (calculatedSpeed > 0 && Math.abs(gpsSpeed - calculatedSpeed) < 10) {
            finalSpeed = (gpsSpeed * 0.8) + (calculatedSpeed * 0.2);
        }

        finalSpeed = this.applyLightSmoothing(finalSpeed);
        return Math.max(0, finalSpeed);
    }

    applyLightSmoothing(newSpeed) {
        this.speedHistory.push(newSpeed);
        if (this.speedHistory.length > this.maxHistorySize) {
            this.speedHistory.shift();
        }
        return this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;
    }

    getLastValidSpeed() {
        return this.speedHistory.length > 0 ? this.speedHistory[this.speedHistory.length - 1] : 0;
    }

    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    reset() {
        this.speedHistory = [];
    }
}

// ===== CIRCULAR BUFFER =====
class CircularBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.head = 0;
        this.tail = 0;
        this._count = 0;
        this.isFull = false;
    }

    push(item) {
        this.buffer[this.tail] = item;
        this.tail = (this.tail + 1) % this.capacity;
        
        if (this.isFull) {
            this.head = (this.head + 1) % this.capacity;
        } else {
            this._count++;
            if (this._count === this.capacity) this.isFull = true;
        }
    }

    getAll() {
        if (this._count === 0) return [];
        
        const result = [];
        if (this.isFull) {
            for (let i = 0; i < this.capacity; i++) {
                result.push(this.buffer[(this.head + i) % this.capacity]);
            }
        } else {
            for (let i = 0; i < this._count; i++) {
                result.push(this.buffer[i]);
            }
        }
        return result;
    }

    getUnsynced() {
        return this.getAll().filter(wp => !wp.synced);
    }

    clear() {
        this.head = 0;
        this.tail = 0;
        this._count = 0;
        this.isFull = false;
        this.buffer = new Array(this.capacity);
    }

    get count() {
        return this.isFull ? this.capacity : this._count;
    }
}

// ===== STORAGE MANAGER =====
class EnhancedStorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            WAYPOINTS: 'enhanced_gps_waypoints',
            SYNC_STATUS: 'enhanced_sync_status',
            SESSION_DATA: 'enhanced_session_data',
            DRIVER_PROFILES: 'driver_profiles',
            VEHICLE_PROFILES: 'vehicle_profiles'
        };
    }

    saveWaypoint(waypoint) {
        try {
            const existing = this.loadAllWaypoints();
            
            if (existing.length >= 61200) {
                existing.splice(0, Math.floor(existing.length * 0.1));
            }
            
            existing.push(waypoint);
            this.saveToStorage(existing);
            
            this.updateSyncStatus({
                totalWaypoints: existing.length,
                unsyncedCount: existing.filter(w => !w.synced).length,
                lastSave: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Failed to save waypoint:', error);
        }
    }

    loadAllWaypoints() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.WAYPOINTS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load waypoints:', error);
            return [];
        }
    }

    loadUnsyncedWaypoints() {
        const all = this.loadAllWaypoints();
        return all.filter(waypoint => !waypoint.synced);
    }

    markWaypointsAsSynced(waypointIds) {
        const all = this.loadAllWaypoints();
        const updated = all.map(waypoint => {
            if (waypointIds.includes(waypoint.id)) {
                return { ...waypoint, synced: true };
            }
            return waypoint;
        });
        
        this.saveToStorage(updated);
        this.updateSyncStatus({
            totalWaypoints: updated.length,
            unsyncedCount: updated.filter(w => !w.synced).length,
            lastSync: new Date().toISOString()
        });
    }

    saveToStorage(waypoints) {
        try {
            localStorage.setItem(this.STORAGE_KEYS.WAYPOINTS, JSON.stringify(waypoints));
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    updateSyncStatus(status) {
        const existing = this.getSyncStatus();
        localStorage.setItem(this.STORAGE_KEYS.SYNC_STATUS, JSON.stringify({
            ...existing, ...status, updatedAt: new Date().toISOString()
        }));
    }

    getSyncStatus() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.SYNC_STATUS);
            return data ? JSON.parse(data) : {
                totalWaypoints: 0, unsyncedCount: 0, lastSync: null, lastSave: null
            };
        } catch (error) {
            return { totalWaypoints: 0, unsyncedCount: 0, lastSync: null, lastSave: null };
        }
    }

    // ===== DRIVER PROFILES =====
    saveDriverProfile(profile) {
        try {
            const profiles = this.loadDriverProfiles();
            const existingIndex = profiles.findIndex(p => p.driverId === profile.driverId);
            
            if (existingIndex >= 0) {
                profiles[existingIndex] = profile;
            } else {
                profiles.push(profile);
            }
            
            localStorage.setItem(this.STORAGE_KEYS.DRIVER_PROFILES, JSON.stringify(profiles));
        } catch (error) {
            console.error('Error saving driver profile:', error);
        }
    }

    loadDriverProfiles() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.DRIVER_PROFILES);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    }

    getDriverProfile(driverId) {
        const profiles = this.loadDriverProfiles();
        return profiles.find(p => p.driverId === driverId) || null;
    }

    // ===== VEHICLE PROFILES =====
    saveVehicleProfile(profile) {
        try {
            const profiles = this.loadVehicleProfiles();
            const existingIndex = profiles.findIndex(p => p.unit === profile.unit);
            
            if (existingIndex >= 0) {
                profiles[existingIndex] = profile;
            } else {
                profiles.push(profile);
            }
            
            localStorage.setItem(this.STORAGE_KEYS.VEHICLE_PROFILES, JSON.stringify(profiles));
        } catch (error) {
            console.error('Error saving vehicle profile:', error);
        }
    }

    loadVehicleProfiles() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.VEHICLE_PROFILES);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    }

    getVehicleProfile(unit) {
        const profiles = this.loadVehicleProfiles();
        return profiles.find(p => p.unit === unit) || null;
    }
}

// ===== FIREBASE CLEANUP MANAGER =====
class FirebaseCleanupManager {
    constructor(database) {
        this.database = database;
        this.cleanupQueue = [];
        this.isCleaning = false;
    }

    async scheduleCleanup(unitId, sessionId) {
        this.cleanupQueue.push({ unitId, sessionId, timestamp: new Date() });
        console.log(`🗑️ Cleanup scheduled for: ${unitId}`);
        
        if (navigator.onLine) {
            await this.processCleanup();
        }
    }

    async processCleanup() {
        if (this.isCleaning || this.cleanupQueue.length === 0) return;

        this.isCleaning = true;
        console.log(`🧹 Processing ${this.cleanupQueue.length} cleanup tasks...`);

        const successfulCleanups = [];
        const failedCleanups = [];

        for (const task of this.cleanupQueue) {
            try {
                await this.executeCleanup(task);
                successfulCleanups.push(task);
            } catch (error) {
                console.error(`❌ Cleanup failed for ${task.unitId}:`, error);
                failedCleanups.push(task);
            }
        }

        this.cleanupQueue = failedCleanups;
        this.isCleaning = false;

        if (successfulCleanups.length > 0) {
            console.log(`🎉 ${successfulCleanups.length} cleanup tasks completed`);
        }
    }

    async executeCleanup(task) {
        const { unitId, sessionId } = task;
        
        console.log(`🔥 Starting cleanup for: ${unitId}`);

        const unitRef = this.database.ref('/units/' + unitId);
        const waypointsRef = this.database.ref('/waypoints/' + unitId);
        const sessionRef = this.database.ref('/sessions/' + sessionId);
        const chatRef = this.database.ref('/chat/' + unitId);

        await unitRef.remove();
        await waypointsRef.remove();
        await sessionRef.remove();
        await chatRef.remove();

        console.log(`🔥 Cleanup completed for: ${unitId}`);
    }

    getQueueSize() {
        return this.cleanupQueue.length;
    }
}

// ===== OFFLINE QUEUE MANAGER =====
class OfflineQueueManager {
    constructor() {
        this.queue = [];
        this.isOnline = navigator.onLine;
    }

    addToQueue(gpsData) {
        this.queue.push({
            ...gpsData,
            queueTimestamp: new Date().toISOString()
        });
    }

    getQueueSize() {
        return this.queue.length;
    }

    async processQueue() {
        if (this.queue.length === 0 || !this.isOnline) return;

        console.log(`🔄 Processing ${this.queue.length} queued items...`);
        
        const successItems = [];
        const failedItems = [];

        for (const item of this.queue) {
            try {
                await this.sendQueuedData(item);
                successItems.push(item);
            } catch (error) {
                failedItems.push(item);
            }
        }

        this.queue = failedItems;
        console.log(`✅ Sent ${successItems.length} items, ${failedItems.length} failed`);
    }

    async sendQueuedData(queuedData) {
        if (!window.dtLogger?.firebaseRef) {
            throw new Error('No Firebase reference');
        }

        const { queueTimestamp, ...cleanData } = queuedData;
        await window.dtLogger.firebaseRef.set(cleanData);
    }
}

// ===== ROUTE MANAGER =====
class RouteManager {
    constructor() {
        this.currentRoute = null;
        this.routeWaypoints = [];
        this.routeDistance = 0;
        this.routeStartTime = null;
    }

    startNewRoute(routeName) {
        this.currentRoute = {
            id: 'route_' + Date.now(),
            name: routeName,
            startTime: new Date(),
            waypoints: [],
            totalDistance: 0,
            status: 'active'
        };
        this.routeStartTime = new Date();
        console.log(`🛣️ New route started: ${routeName}`);
    }

    addWaypointToRoute(waypoint) {
        if (!this.currentRoute) return;

        this.currentRoute.waypoints.push(waypoint);
        
        // Calculate route distance
        if (this.currentRoute.waypoints.length > 1) {
            const lastWaypoint = this.currentRoute.waypoints[this.currentRoute.waypoints.length - 2];
            const distance = this.calculateDistance(
                lastWaypoint.lat, lastWaypoint.lng,
                waypoint.lat, waypoint.lng
            );
            this.currentRoute.totalDistance += distance;
        }

        return this.currentRoute.totalDistance;
    }

    endCurrentRoute() {
        if (!this.currentRoute) return null;

        this.currentRoute.endTime = new Date();
        this.currentRoute.status = 'completed';
        this.currentRoute.duration = this.currentRoute.endTime - this.currentRoute.startTime;

        const completedRoute = { ...this.currentRoute };
        this.currentRoute = null;
        this.routeStartTime = null;

        console.log(`🛣️ Route completed: ${completedRoute.name}, Distance: ${completedRoute.totalDistance.toFixed(3)}km`);
        return completedRoute;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    getCurrentRoute() {
        return this.currentRoute;
    }

    getRouteStatistics() {
        if (!this.currentRoute) return null;

        const currentTime = new Date();
        const duration = (currentTime - this.currentRoute.startTime) / 1000; // seconds
        const avgSpeed = duration > 0 ? (this.currentRoute.totalDistance / duration) * 3600 : 0;

        return {
            routeName: this.currentRoute.name,
            distance: this.currentRoute.totalDistance,
            duration: duration,
            waypointCount: this.currentRoute.waypoints.length,
            averageSpeed: avgSpeed
        };
    }
}

// ===== MAINTENANCE MANAGER =====
class MaintenanceManager {
    constructor() {
        this.maintenanceRecords = [];
        this.loadMaintenanceRecords();
    }

    addMaintenanceRecord(record) {
        record.id = 'maint_' + Date.now();
        record.timestamp = new Date().toISOString();
        record.status = 'pending';
        
        this.maintenanceRecords.push(record);
        this.saveMaintenanceRecords();
        
        console.log(`🔧 Maintenance record added: ${record.type} for ${record.unit}`);
        return record.id;
    }

    completeMaintenance(recordId, notes = '') {
        const record = this.maintenanceRecords.find(r => r.id === recordId);
        if (record) {
            record.status = 'completed';
            record.completedAt = new Date().toISOString();
            record.completionNotes = notes;
            this.saveMaintenanceRecords();
        }
    }

    getPendingMaintenance() {
        return this.maintenanceRecords.filter(record => record.status === 'pending');
    }

    getMaintenanceHistory(unit = null) {
        if (unit) {
            return this.maintenanceRecords.filter(record => record.unit === unit);
        }
        return this.maintenanceRecords;
    }

    saveMaintenanceRecords() {
        try {
            localStorage.setItem('maintenance_records', JSON.stringify(this.maintenanceRecords));
        } catch (error) {
            console.error('Error saving maintenance records:', error);
        }
    }

    loadMaintenanceRecords() {
        try {
            const data = localStorage.getItem('maintenance_records');
            this.maintenanceRecords = data ? JSON.parse(data) : [];
        } catch (error) {
            this.maintenanceRecords = [];
        }
    }
}

// ===== NOTIFICATION MANAGER =====
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.permission = null;
        this.checkNotificationPermission();
    }

    async checkNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('Browser tidak mendukung notifications');
            return;
        }

        this.permission = Notification.permission;
        
        if (this.permission === 'default') {
            this.permission = await Notification.requestPermission();
        }
    }

    showNotification(title, options = {}) {
        if (this.permission !== 'granted') return;

        const notification = new Notification(title, {
            icon: '/icon.png',
            badge: '/badge.png',
            ...options
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => {
            notification.close();
        }, 5000);

        return notification;
    }

    addSystemNotification(message, type = 'info', data = null) {
        const notification = {
            id: 'notif_' + Date.now(),
            message: message,
            type: type,
            timestamp: new Date().toISOString(),
            read: false,
            data: data
        };

        this.notifications.unshift(notification);
        
        // Keep only last 50 notifications
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }

        this.saveNotifications();
        
        // Show browser notification for important alerts
        if (type === 'alert' || type === 'warning') {
            this.showNotification('GPS Tracker Alert', {
                body: message,
                tag: 'gps-alert'
            });
        }

        return notification.id;
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.saveNotifications();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(notification => {
            notification.read = true;
        });
        this.saveNotifications();
    }

    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    getNotifications() {
        return this.notifications;
    }

    saveNotifications() {
        try {
            localStorage.setItem('system_notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('Error saving notifications:', error);
        }
    }

    loadNotifications() {
        try {
            const data = localStorage.getItem('system_notifications');
            this.notifications = data ? JSON.parse(data) : [];
        } catch (error) {
            this.notifications = [];
        }
    }
}

// ===== MAIN ENHANCED GPS LOGGER =====
class EnhancedDTGPSLogger {
    constructor() {
        // Configuration
        this.waypointConfig = {
            collectionInterval: 1000,
            maxWaypoints: 61200,
            batchSize: 100,
            syncInterval: 30000,
        };

        // Enhanced Components
        this.gpsProcessor = new EnhancedGPSProcessor();
        this.speedCalculator = new EnhancedSpeedCalculator();
        this.cleanupManager = new FirebaseCleanupManager(database);
        this.kalmanFilter = new GPSKalmanFilter();
        this.routeManager = new RouteManager();
        this.maintenanceManager = new MaintenanceManager();
        this.notificationManager = new NotificationManager();

        // Storage & Buffers
        this.waypointBuffer = new CircularBuffer(this.waypointConfig.maxWaypoints);
        this.unsyncedWaypoints = new Set();
        this.storageManager = new EnhancedStorageManager();
        
        // State Management
        this.driverData = null;
        this.watchId = null;
        this.isTracking = false;
        this.sendInterval = null;
        this.sessionStartTime = null;
        this.totalDistance = 0;
        this.lastPosition = null;
        this.dataPoints = 0;
        this.isOnline = false;
        this.journeyStatus = 'ready';
        this.firebaseRef = null;
        
        // Real-time Tracking
        this.lastUpdateTime = null;
        this.currentSpeed = 0;
        this.speedHistory = [];
        
        this.completeHistory = this.loadCompleteHistory();
        
        // Chat System
        this.chatRef = null;
        this.chatMessages = [];
        this.unreadCount = 0;
        this.isChatOpen = false;
        this.chatInitialized = false;
        this.lastMessageId = null;

        // Additional Features
        this.offlineQueue = new OfflineQueueManager();
        this.autoPause = true;
        this.idleDetection = true;
        this.idleStartTime = null;
        this.idleThreshold = 300000; // 5 minutes
        
        console.log('🚀 ENHANCED GPS Logger - All Features Activated');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateTime();
        this.checkNetworkStatus();
        this.setupPeriodicTasks();
        this.loadUnsyncedWaypoints();
        this.setupIdleDetection();
        
        console.log('✅ System initialized with all features');
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Journey Controls
        document.getElementById('startJourneyBtn')?.addEventListener('click', () => this.startJourney());
        document.getElementById('pauseJourneyBtn')?.addEventListener('click', () => this.pauseJourney());
        document.getElementById('endJourneyBtn')?.addEventListener('click', () => this.endJourney());
        document.getElementById('reportIssueBtn')?.addEventListener('click', () => this.reportIssue());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // Chat System
        document.getElementById('chatToggle')?.addEventListener('click', () => this.toggleChat());
        document.getElementById('closeChatBtn')?.addEventListener('click', () => this.toggleChat());
        document.getElementById('sendChatBtn')?.addEventListener('click', () => this.sendChatMessage());
        
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
        }

        // Route Management
        document.getElementById('startRouteBtn')?.addEventListener('click', () => this.startNewRoute());
        document.getElementById('endRouteBtn')?.addEventListener('click', () => this.endCurrentRoute());

        // Maintenance
        document.getElementById('reportMaintenanceBtn')?.addEventListener('click', () => this.showMaintenanceModal());

        // Notifications
        document.getElementById('clearNotificationsBtn')?.addEventListener('click', () => this.clearAllNotifications());

        // Settings
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettingsModal());
    }

    setupPeriodicTasks() {
        // Update time every second
        setInterval(() => this.updateTime(), 1000);
        
        // Check network every 5 seconds
        setInterval(() => this.checkNetworkStatus(), 5000);
        
        // Update session duration every second
        setInterval(() => this.updateSessionDuration(), 1000);
        
        // Cleanup retry every minute
        setInterval(() => {
            if (this.cleanupManager.getQueueSize() > 0 && navigator.onLine) {
                this.cleanupManager.processCleanup();
            }
        }, 60000);

        // Auto-save every 30 seconds
        setInterval(() => this.autoSaveSystemState(), 30000);

        // Check for idle time every minute
        setInterval(() => this.checkIdleStatus(), 60000);
    }

    setupIdleDetection() {
        // Reset idle timer on user interaction
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.idleStartTime = Date.now();
            }, { passive: true });
        });
    }

    checkIdleStatus() {
        if (!this.idleDetection || !this.idleStartTime) return;

        const idleTime = Date.now() - this.idleStartTime;
        if (idleTime > this.idleThreshold && this.journeyStatus === 'started') {
            this.addLog('System mendeteksi idle, otomatis pause perjalanan', 'warning');
            this.pauseJourney();
        }
    }

    // ===== REAL-TIME GPS TRACKING =====
    startRealGPSTracking() {
        if (!navigator.geolocation) {
            this.addLog('❌ GPS tidak didukung', 'error');
            return;
        }

        console.log('📍 Starting REAL-TIME GPS tracking...');
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleRealPositionUpdate(position),
            (error) => this.handleGPSError(error),
            options
        );

        this.isTracking = true;
        this.addLog('📍 GPS Real-Time diaktifkan dengan Kalman Filter', 'success');
    }

    stopRealGPSTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
    }

    handleRealPositionUpdate(position) {
        try {
            const accuracy = position.coords.accuracy;
            console.log(`📍 GPS Raw - Lat: ${position.coords.latitude.toFixed(6)}, Lng: ${position.coords.longitude.toFixed(6)}, Accuracy: ${accuracy}m`);

            const processedPosition = this.gpsProcessor.processRawPosition(position);
            
            if (!processedPosition) {
                console.log('🔇 Position filtered out');
                return;
            }

            const currentPosition = {
                lat: parseFloat(processedPosition.lat.toFixed(6)),
                lng: parseFloat(processedPosition.lng.toFixed(6)),
                accuracy: parseFloat(accuracy.toFixed(1)),
                speed: processedPosition.speed,
                bearing: processedPosition.bearing,
                timestamp: new Date(),
                isOnline: this.isOnline,
                processed: true,
                kalmanAccuracy: processedPosition.accuracy
            };

            const enhancedSpeed = this.speedCalculator.calculateEnhancedSpeed(
                currentPosition, 
                this.lastPosition, 
                currentPosition.speed
            );

            this.currentSpeed = enhancedSpeed;

            const distanceKm = this.calculateEnhancedDistance(currentPosition);
            
            this.processEnhancedWaypoint({
                ...currentPosition,
                id: `wp_rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                sessionId: this.driverData?.sessionId || 'unknown',
                unit: this.driverData?.unit || 'unknown',
                driver: this.driverData?.name || 'unknown',
                synced: false,
                enhancedSpeed: this.currentSpeed,
                distanceIncrement: distanceKm,
                kalmanFiltered: true,
                timestamp: new Date().toISOString()
            });

            this.lastPosition = currentPosition;
            this.updateEnhancedGPSDisplay(currentPosition);

        } catch (error) {
            console.error('❌ Error in real-time position handling:', error);
        }
    }

    calculateEnhancedDistance(currentPosition) {
        if (!this.lastPosition || !this.lastPosition.timestamp) return 0;

        const timeDiffMs = currentPosition.timestamp - this.lastPosition.timestamp;
        if (timeDiffMs < 800) return 0;

        const distanceKm = this.haversineDistance(
            this.lastPosition.lat, this.lastPosition.lng,
            currentPosition.lat, currentPosition.lng
        );

        const minDistance = 0.0001;
        if (distanceKm < minDistance) return 0;

        if (this.journeyStatus === 'started') {
            this.totalDistance += distanceKm;
            document.getElementById('todayDistance').textContent = this.totalDistance.toFixed(3);
            this.updateAverageSpeed();

            // Add to current route if active
            if (this.routeManager.getCurrentRoute()) {
                this.routeManager.addWaypointToRoute({
                    lat: currentPosition.lat,
                    lng: currentPosition.lng,
                    timestamp: new Date(),
                    speed: this.currentSpeed
                });
            }

            return distanceKm;
        }
        
        return 0;
    }

    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    processEnhancedWaypoint(waypoint) {
        if (!this.isValidCoordinate(waypoint.lat, waypoint.lng)) return;

        this.waypointBuffer.push(waypoint);
        this.unsyncedWaypoints.add(waypoint.id);
        this.storageManager.saveWaypoint(waypoint);
        
        this.updateWaypointDisplay();
        
        this.dataPoints++;
        document.getElementById('dataPoints').textContent = this.dataPoints;

        console.log(`📍 Enhanced GPS: ${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}, Speed: ${this.currentSpeed.toFixed(1)}km/h`);
    }

    updateEnhancedGPSDisplay(waypoint) {
        document.getElementById('currentLat').textContent = waypoint.lat.toFixed(6);
        document.getElementById('currentLng').textContent = waypoint.lng.toFixed(6);
        document.getElementById('currentSpeed').textContent = this.currentSpeed.toFixed(1);
        document.getElementById('gpsAccuracy').textContent = waypoint.accuracy.toFixed(1) + ' m';
        document.getElementById('gpsBearing').textContent = waypoint.bearing ? waypoint.bearing + '°' : '-';
        
        const enhancedInfo = document.getElementById('enhancedInfo');
        if (enhancedInfo) {
            enhancedInfo.textContent = `🎯 Real-Time GPS | Kalman Active`;
            enhancedInfo.className = 'text-success';
        }
    }

    updateWaypointDisplay() {
        const waypointCount = document.getElementById('waypointCount');
        const unsyncedCount = document.getElementById('unsyncedCount');
        const waypointStatus = document.getElementById('waypointStatus');

        if (waypointCount) waypointCount.textContent = this.waypointBuffer.count;
        if (unsyncedCount) unsyncedCount.textContent = this.unsyncedWaypoints.size;
        if (waypointStatus) {
            waypointStatus.textContent = this.isOnline ? 
                '🟢 Mengumpulkan waypoint...' : 
                `🔴 Offline (${this.unsyncedWaypoints.size} menunggu sync)`;
        }
    }

    // ===== CORE APPLICATION METHODS =====
    handleLogin() {
        const driverName = document.getElementById('driverName');
        const unitNumber = document.getElementById('unitNumber');

        if (driverName && unitNumber && driverName.value && unitNumber.value) {
            this.driverData = {
                name: driverName.value,
                unit: unitNumber.value,
                year: this.getVehicleYear(unitNumber.value),
                sessionId: this.generateSessionId(),
                driverId: 'driver_' + Date.now()
            };

            // Save driver profile
            this.storageManager.saveDriverProfile({
                driverId: this.driverData.driverId,
                name: this.driverData.name,
                unit: this.driverData.unit,
                lastLogin: new Date().toISOString()
            });

            this.firebaseRef = database.ref('/units/' + this.driverData.unit);
            
            const cleanData = {
                driver: this.driverData.name,
                unit: this.driverData.unit,
                sessionId: this.driverData.sessionId,
                journeyStatus: 'ready',
                lastUpdate: new Date().toLocaleTimeString('id-ID'),
                lat: 0, lng: 0, speed: 0, distance: 0,
                fuel: 100, accuracy: 0, timestamp: new Date().toISOString(),
                gpsMode: 'real-time'
            };

            this.firebaseRef.set(cleanData);
            this.showDriverApp();
            this.startDataTransmission();
            
            setTimeout(() => {
                this.startJourney();
            }, 1000);
        } else {
            alert('Harap isi semua field!');
        }
    }

    getVehicleYear(unit) {
        const yearMap = {
            'DT-06': '2018', 'DT-07': '2018', 'DT-12': '2020', 'DT-13': '2020', 
            'DT-15': '2020', 'DT-16': '2020', 'DT-17': '2020', 'DT-18': '2020',
            'DT-23': '2021', 'DT-24': '2021', 'DT-25': '2022', 'DT-26': '2022',
            'DT-27': '2022', 'DT-28': '2022', 'DT-29': '2022', 'DT-32': '2024',
            'DT-33': '2025', 'DT-34': '2025', 'DT-35': '2025', 'DT-36': '2020',
            'DT-37': '2020', 'DT-38': '2020', 'DT-39': '2020'
        };
        return yearMap[unit] || 'Unknown';
    }

    generateSessionId() {
        return 'SESS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    showDriverApp() {
        const loginScreen = document.getElementById('loginScreen');
        const driverApp = document.getElementById('driverApp');
        
        if (loginScreen) loginScreen.style.display = 'none';
        if (driverApp) driverApp.style.display = 'block';
        
        const vehicleName = document.getElementById('vehicleName');
        const driverDisplayName = document.getElementById('driverDisplayName');
        
        if (vehicleName) vehicleName.textContent = this.driverData.unit;
        if (driverDisplayName) driverDisplayName.textContent = this.driverData.name;
        
        this.sessionStartTime = new Date();
        this.lastUpdateTime = new Date();
        this.updateSessionDuration();
        this.updateWaypointDisplay();
        this.setupChatSystem();
        this.updateNotificationBadge();
        
        setTimeout(() => {
            this.startRealGPSTracking();
        }, 500);
        
        this.addLog(`✅ Login berhasil - ${this.driverData.name} (${this.driverData.unit}) - GPS Real-Time Enhanced`, 'success');
        this.notificationManager.addSystemNotification(`Driver ${this.driverData.name} logged in`, 'info');
    }

    startDataTransmission() {
        this.sendInterval = setInterval(() => {
            if (this.lastPosition) {
                this.sendToFirebase();
            }
        }, 3000);
    }

    async sendToFirebase() {
        if (!this.firebaseRef || !this.lastPosition) return;

        try {
            const gpsData = {
                driver: this.driverData.name,
                unit: this.driverData.unit,
                lat: parseFloat(this.lastPosition.lat.toFixed(6)),
                lng: parseFloat(this.lastPosition.lng.toFixed(6)),
                speed: parseFloat(this.currentSpeed.toFixed(1)),
                accuracy: parseFloat(this.lastPosition.accuracy.toFixed(1)),
                bearing: this.lastPosition.bearing ? parseFloat(this.lastPosition.bearing.toFixed(0)) : null,
                timestamp: new Date().toISOString(),
                lastUpdate: new Date().toLocaleTimeString('id-ID'),
                distance: parseFloat(this.totalDistance.toFixed(3)),
                journeyStatus: this.journeyStatus,
                batteryLevel: this.getBatteryLevel(),
                sessionId: this.driverData.sessionId,
                isOfflineData: false,
                fuel: this.calculateFuelLevel(),
                gpsMode: 'real-time-enhanced',
                processed: true
            };

            if (this.isOnline) {
                await this.firebaseRef.set(gpsData);
                this.addLog(`📡 Real-time data: ${this.currentSpeed.toFixed(1)} km/h | ${this.totalDistance.toFixed(3)} km`, 'success');
                this.updateConnectionStatus(true);
            } else {
                this.offlineQueue.addToQueue(gpsData);
                this.updateConnectionStatus(false);
            }
            
        } catch (error) {
            console.error('Error sending to Firebase:', error);
        }
    }

    calculateFuelLevel() {
        const baseFuel = 100;
        const fuelConsumptionRate = 0.25;
        const fuelUsed = this.totalDistance * fuelConsumptionRate;
        return Math.max(0, Math.min(100, Math.round(baseFuel - fuelUsed)));
    }

    getBatteryLevel() {
        return Math.max(20, Math.floor(Math.random() * 100));
    }

    checkNetworkStatus() {
        const wasOnline = this.isOnline;
        this.isOnline = navigator.onLine;
        
        if (wasOnline !== this.isOnline) {
            if (this.isOnline) {
                this.addLog('📱 Koneksi pulih - sync data', 'success');
                this.updateConnectionStatus(true);
                
                setTimeout(() => {
                    this.syncWaypointsToServer();
                    this.offlineQueue.processQueue();
                    this.cleanupManager.processCleanup();
                }, 1000);
                
            } else {
                this.addLog('📱 Koneksi terputus - mode offline', 'warning');
                this.updateConnectionStatus(false);
            }
        }
    }

    updateConnectionStatus(connected) {
        const dot = document.getElementById('connectionDot');
        const status = document.getElementById('connectionStatus');
        
        if (connected) {
            if (dot) dot.className = 'connection-status connected';
            if (status) {
                status.textContent = 'TERHUBUNG';
                status.className = 'text-success';
            }
        } else {
            if (dot) dot.className = 'connection-status disconnected';
            if (status) {
                status.textContent = `OFFLINE (${this.unsyncedWaypoints.size} waypoint menunggu)`;
                status.className = 'text-danger';
            }
        }
    }

    addLog(message, type = 'info') {
        const logContainer = document.getElementById('dataLogs');
        if (!logContainer) return;

        const alertClass = {
            'info': 'alert-info',
            'success': 'alert-success', 
            'error': 'alert-danger',
            'warning': 'alert-warning'
        }[type] || 'alert-info';

        const logEntry = document.createElement('div');
        logEntry.className = `alert ${alertClass} py-2 mb-2`;
        logEntry.innerHTML = `<small>${new Date().toLocaleTimeString('id-ID')}: ${message}</small>`;
        
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        if (logContainer.children.length > 6) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    updateTime() {
        const currentTimeEl = document.getElementById('currentTime');
        if (currentTimeEl) {
            currentTimeEl.textContent = new Date().toLocaleTimeString('id-ID');
        }
    }

    updateSessionDuration() {
        if (!this.sessionStartTime) return;
        
        const now = new Date();
        const diff = now - this.sessionStartTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        const sessionDurationEl = document.getElementById('sessionDuration');
        if (sessionDurationEl) {
            sessionDurationEl.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    updateAverageSpeed() {
        if (this.dataPoints > 0 && this.sessionStartTime && this.totalDistance > 0) {
            const durationHours = (new Date() - this.sessionStartTime) / 3600000;
            const avgSpeed = durationHours > 0 ? this.totalDistance / durationHours : 0;
            document.getElementById('avgSpeed').textContent = avgSpeed.toFixed(1);
        }
    }

    startJourney() {
        this.journeyStatus = 'started';
        this.lastUpdateTime = new Date();
        const vehicleStatus = document.getElementById('vehicleStatus');
        if (vehicleStatus) {
            vehicleStatus.textContent = 'ON TRIP';
            vehicleStatus.className = 'bg-success text-white rounded px-2 py-1';
        }
        this.addLog('Perjalanan dimulai - Real-time tracking aktif', 'success');
        this.sendToFirebase();
        this.notificationManager.addSystemNotification('Perjalanan dimulai', 'info');
    }

    pauseJourney() {
        this.journeyStatus = 'paused';
        const vehicleStatus = document.getElementById('vehicleStatus');
        if (vehicleStatus) {
            vehicleStatus.textContent = 'PAUSED';
            vehicleStatus.className = 'bg-warning text-dark rounded px-2 py-1';
        }
        this.addLog('Perjalanan dijeda', 'warning');
        this.sendToFirebase();
        this.notificationManager.addSystemNotification('Perjalanan dijeda', 'warning');
    }

    endJourney() {
        this.journeyStatus = 'ended';
        const vehicleStatus = document.getElementById('vehicleStatus');
        if (vehicleStatus) {
            vehicleStatus.textContent = 'COMPLETED';
            vehicleStatus.className = 'bg-info text-white rounded px-2 py-1';
        }
        this.addLog(`Perjalanan selesai - Total: ${this.totalDistance.toFixed(3)} km`, 'info');
        this.sendToFirebase();
        
        if (this.isOnline) {
            this.syncWaypointsToServer();
        }

        this.notificationManager.addSystemNotification(`Perjalanan selesai - ${this.totalDistance.toFixed(3)} km`, 'success');
    }

    reportIssue() {
        const issues = [
            'Mesin bermasalah', 'Ban bocor', 'Bahan bakar habis',
            'Kecelakaan kecil', 'Lainnya'
        ];
        
        const issue = prompt('Lapor masalah:\n' + issues.join('\n'));
        if (issue) {
            this.addLog(`Laporan: ${issue}`, 'warning');
            this.notificationManager.addSystemNotification(`Laporan masalah: ${issue}`, 'warning');
            
            // Create maintenance record for mechanical issues
            if (issue.includes('Mesin') || issue.includes('Ban') || issue.includes('Bahan bakar')) {
                this.maintenanceManager.addMaintenanceRecord({
                    unit: this.driverData.unit,
                    type: 'repair',
                    description: issue,
                    priority: 'medium',
                    reportedBy: this.driverData.name
                });
            }
        }
    }

    // ===== ROUTE MANAGEMENT =====
    startNewRoute() {
        const routeName = prompt('Masukkan nama rute:');
        if (routeName) {
            this.routeManager.startNewRoute(routeName);
            this.addLog(`Rute "${routeName}" dimulai`, 'success');
            this.notificationManager.addSystemNotification(`Rute "${routeName}" dimulai`, 'info');
            
            // Update UI
            const routeStatus = document.getElementById('routeStatus');
            if (routeStatus) {
                routeStatus.textContent = `Active: ${routeName}`;
                routeStatus.className = 'text-success';
            }
        }
    }

    endCurrentRoute() {
        const completedRoute = this.routeManager.endCurrentRoute();
        if (completedRoute) {
            this.addLog(`Rute "${completedRoute.name}" selesai - ${completedRoute.totalDistance.toFixed(3)} km`, 'success');
            this.notificationManager.addSystemNotification(
                `Rute "${completedRoute.name}" selesai - ${completedRoute.totalDistance.toFixed(3)} km`, 
                'success'
            );
            
            // Update UI
            const routeStatus = document.getElementById('routeStatus');
            if (routeStatus) {
                routeStatus.textContent = 'No Active Route';
                routeStatus.className = 'text-muted';
            }
        }
    }

    // ===== MAINTENANCE MANAGEMENT =====
    showMaintenanceModal() {
        const modal = document.getElementById('maintenanceModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    reportMaintenance() {
        const type = document.getElementById('maintenanceType')?.value;
        const description = document.getElementById('maintenanceDescription')?.value;
        const priority = document.getElementById('maintenancePriority')?.value;

        if (type && description) {
            const recordId = this.maintenanceManager.addMaintenanceRecord({
                unit: this.driverData.unit,
                type: type,
                description: description,
                priority: priority || 'medium',
                reportedBy: this.driverData.name
            });

            this.addLog(`Maintenance dilaporkan: ${type}`, 'warning');
            this.notificationManager.addSystemNotification(`Maintenance dilaporkan: ${type}`, 'warning');
            
            // Close modal
            const modal = document.getElementById('maintenanceModal');
            if (modal) {
                modal.style.display = 'none';
            }

            // Reset form
            const form = document.getElementById('maintenanceForm');
            if (form) {
                form.reset();
            }
        }
    }

    // ===== NOTIFICATION SYSTEM =====
    updateNotificationBadge() {
        const unreadCount = this.notificationManager.getUnreadCount();
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = unreadCount > 0 ? unreadCount : '';
            badge.style.display = unreadCount > 0 ? 'inline' : 'none';
        }
    }

    showNotificationsPanel() {
        const panel = document.getElementById('notificationsPanel');
        if (panel) {
            panel.style.display = 'block';
            this.renderNotifications();
            this.notificationManager.markAllAsRead();
            this.updateNotificationBadge();
        }
    }

    renderNotifications() {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        const notifications = this.notificationManager.getNotifications();
        container.innerHTML = '';

        if (notifications.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3">Tidak ada notifikasi</div>';
            return;
        }

        notifications.forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
            notificationElement.innerHTML = `
                <div class="notification-content">
                    <div class="notification-message">${this.escapeHtml(notification.message)}</div>
                    <div class="notification-time">${new Date(notification.timestamp).toLocaleTimeString('id-ID')}</div>
                </div>
            `;
            container.appendChild(notificationElement);
        });
    }

    clearAllNotifications() {
        this.notificationManager.notifications = [];
        this.notificationManager.saveNotifications();
        this.renderNotifications();
        this.updateNotificationBadge();
    }

    // ===== SETTINGS MANAGEMENT =====
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            // Load current settings
            document.getElementById('autoPauseSetting').checked = this.autoPause;
            document.getElementById('idleDetectionSetting').checked = this.idleDetection;
            document.getElementById('gpsAccuracySetting').value = this.gpsProcessor.accuracyThreshold;
            
            modal.style.display = 'block';
        }
    }

    saveSettings() {
        this.autoPause = document.getElementById('autoPauseSetting').checked;
        this.idleDetection = document.getElementById('idleDetectionSetting').checked;
        this.gpsProcessor.accuracyThreshold = parseInt(document.getElementById('gpsAccuracySetting').value);

        this.addLog('Pengaturan disimpan', 'success');
        
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ===== CHAT SYSTEM =====
    setupChatSystem() {
        if (!this.driverData) return;
        
        this.chatRef = database.ref('/chat/' + this.driverData.unit);
        this.chatRef.off();
        
        this.chatRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            if (message && message.id !== this.lastMessageId) {
                this.handleNewMessage(message);
            }
        });
        
        this.chatInitialized = true;
        this.addLog('Sistem chat aktif', 'success');
    }

    handleNewMessage(message) {
        if (!message || message.sender === this.driverData.name) return;
        
        const messageExists = this.chatMessages.some(msg => 
            msg.id === message.id || 
            (msg.timestamp === message.timestamp && msg.sender === message.sender)
        );
        
        if (messageExists) return;
        
        this.chatMessages.push(message);
        
        if (!this.isChatOpen || message.sender !== this.driverData.name) {
            this.unreadCount++;
        }
        
        this.updateChatUI();
        
        if (!this.isChatOpen && message.sender !== this.driverData.name) {
            this.showChatNotification(message);
        }
        
        this.playNotificationSound();
    }

    async sendMessage(messageText) {
        if (!messageText.trim() || !this.chatRef || !this.driverData) return;
        
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const messageData = {
            id: messageId,
            text: messageText.trim(),
            sender: this.driverData.name,
            unit: this.driverData.unit,
            timestamp: new Date().toISOString(),
            timeDisplay: new Date().toLocaleTimeString('id-ID', { 
                hour: '2-digit', minute: '2-digit' 
            }),
            type: 'driver',
            status: 'sent'
        };
        
        try {
            await this.chatRef.push(messageData);
            this.lastMessageId = messageId;
            
            this.chatMessages.push(messageData);
            this.updateChatUI();
            
        } catch (error) {
            console.error('Failed to send message:', error);
            messageData.status = 'failed';
            this.chatMessages.push(messageData);
            this.updateChatUI();
        }
    }

    sendChatMessage() {
        const input = document.getElementById('chatInput');
        if (input && input.value.trim()) {
            this.sendMessage(input.value);
            input.value = '';
        }
    }

    updateChatUI() {
        const messageList = document.getElementById('chatMessages');
        const unreadBadge = document.getElementById('unreadBadge');
        const chatToggle = document.getElementById('chatToggle');
        
        if (!messageList) return;
        
        if (unreadBadge) {
            unreadBadge.textContent = this.unreadCount > 0 ? this.unreadCount : '';
            unreadBadge.style.display = this.unreadCount > 0 ? 'inline' : 'none';
        }
        
        if (chatToggle) {
            chatToggle.innerHTML = this.unreadCount > 0 ? 
                `💬 Chat <span class="badge bg-danger">${this.unreadCount}</span>` : 
                '💬 Chat';
        }
        
        messageList.innerHTML = '';
        
        if (this.chatMessages.length === 0) {
            messageList.innerHTML = `
                <div class="chat-placeholder text-center text-muted py-4">
                    <small>Mulai percakapan dengan monitor...</small>
                </div>
            `;
            return;
        }
        
        this.chatMessages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messageList.appendChild(messageElement);
        });
        
        messageList.scrollTop = messageList.scrollHeight;
    }

    createMessageElement(message) {
        const messageElement = document.createElement('div');
        const isSentMessage = message.sender === this.driverData.name;
        
        messageElement.className = `chat-message ${isSentMessage ? 'message-sent' : 'message-received'}`;
        
        messageElement.innerHTML = `
            <div class="message-content ${message.status === 'failed' ? 'message-failed' : ''}">
                ${!isSentMessage ? 
                    `<div class="message-sender">${this.escapeHtml(message.sender)}</div>` : ''}
                <div class="message-text">${this.escapeHtml(message.text)}</div>
                <div class="message-footer">
                    <span class="message-time">${message.timeDisplay}</span>
                    ${isSentMessage ? 
                        `<span class="message-status">${message.status === 'failed' ? '❌' : '✓'}</span>` : ''}
                </div>
            </div>
        `;
        
        return messageElement;
    }

    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        const chatWindow = document.getElementById('chatWindow');
        
        if (chatWindow) {
            chatWindow.style.display = this.isChatOpen ? 'flex' : 'none';
            
            if (this.isChatOpen) {
                this.unreadCount = 0;
                this.updateChatUI();
                setTimeout(() => {
                    const chatInput = document.getElementById('chatInput');
                    if (chatInput) chatInput.focus();
                }, 100);
            }
        }
    }

    showChatNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'chat-notification alert alert-info';
        notification.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>💬 Pesan Baru dari ${message.sender}</strong>
                    <div class="small">${message.text}</div>
                </div>
                <button type="button" class="btn-close btn-sm" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.log('Notification sound not supported');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== DATA MANAGEMENT =====
    loadUnsyncedWaypoints() {
        const unsynced = this.storageManager.loadUnsyncedWaypoints();
        unsynced.forEach(waypoint => {
            this.waypointBuffer.push(waypoint);
            if (!waypoint.synced) {
                this.unsyncedWaypoints.add(waypoint.id);
            }
        });
    }

    loadCompleteHistory() {
        try {
            const saved = localStorage.getItem('gps_complete_history');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            return [];
        }
    }

    async syncWaypointsToServer() {
        if (!this.isOnline || !this.driverData) return;

        const unsynced = this.getUnsyncedWaypoints();
        if (unsynced.length === 0) return;

        console.log(`🔄 Syncing ${unsynced.length} waypoints...`);
        
        const batches = this.createBatches(unsynced, this.waypointConfig.batchSize);
        let successfulBatches = 0;

        for (const [index, batch] of batches.entries()) {
            try {
                await this.uploadBatch(batch, index);
                successfulBatches++;
                
                batch.forEach(waypoint => {
                    waypoint.synced = true;
                    this.unsyncedWaypoints.delete(waypoint.id);
                });
                
                this.storageManager.markWaypointsAsSynced(batch.map(wp => wp.id));
                
            } catch (error) {
                console.error(`❌ Batch ${index + 1} sync failed:`, error);
                break;
            }
        }

        if (successfulBatches > 0) {
            this.addLog(`✅ ${successfulBatches} batches synced`, 'success');
            this.updateWaypointDisplay();
        }
    }

    async uploadBatch(batch, batchIndex) {
        const batchId = `batch_${this.driverData.unit}_${Date.now()}_${batchIndex}`;
        const batchRef = database.ref(`/waypoints/${this.driverData.unit}/batches/${batchId}`);
        
        const batchData = {
            batchId: batchId,
            unit: this.driverData.unit,
            sessionId: this.driverData.sessionId,
            driver: this.driverData.name,
            waypoints: batch,
            uploadedAt: new Date().toISOString(),
            batchSize: batch.length
        };

        await batchRef.set(batchData);
    }

    getUnsyncedWaypoints() {
        return this.waypointBuffer.getAll().filter(wp => !wp.synced);
    }

    createBatches(array, batchSize) {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    autoSaveSystemState() {
        const systemState = {
            totalDistance: this.totalDistance,
            dataPoints: this.dataPoints,
            sessionStartTime: this.sessionStartTime,
            journeyStatus: this.journeyStatus,
            lastPosition: this.lastPosition,
            currentSpeed: this.currentSpeed,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem('system_auto_save', JSON.stringify(systemState));
        } catch (error) {
            console.error('Error auto-saving system state:', error);
        }
    }

    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        if (this.sendInterval) {
            clearInterval(this.sendInterval);
        }
        if (this.firebaseRef) {
            this.firebaseRef.remove();
        }
        this.isTracking = false;
    }

    // ===== ENHANCED LOGOUT WITH AUTO-CLEANUP =====
    async logout() {
        if (confirm('Yakin ingin logout? Semua data Firebase untuk unit ini akan dihapus.')) {
            try {
                // Sync terakhir jika online
                if (this.isOnline) {
                    await this.syncWaypointsToServer();
                    await this.offlineQueue.processQueue();
                }
                
                // Stop tracking
                this.stopRealGPSTracking();
                this.stopTracking();
                
                // Schedule Firebase cleanup
                if (this.driverData && this.driverData.unit && this.driverData.sessionId) {
                    await this.cleanupManager.scheduleCleanup(this.driverData.unit, this.driverData.sessionId);
                }
                
                // Reset enhanced components
                this.gpsProcessor.reset();
                this.speedCalculator.reset();
                this.kalmanFilter.reset();
                
                // Session summary
                const sessionSummary = {
                    driver: this.driverData?.name,
                    unit: this.driverData?.unit,
                    duration: document.getElementById('sessionDuration')?.textContent || '00:00:00',
                    totalDistance: this.totalDistance.toFixed(3),
                    dataPoints: this.dataPoints,
                    waypointsCollected: this.waypointBuffer.count,
                    cleanupScheduled: true
                };
                
                console.log('Session Summary:', sessionSummary);
                this.addLog(`Session ended - ${this.waypointBuffer.count} waypoints - Firebase cleanup scheduled`, 'info');
                
                // Clear local data
                this.waypointBuffer.clear();
                this.unsyncedWaypoints.clear();
                
                // Reset state
                this.driverData = null;
                this.firebaseRef = null;
                this.chatRef = null;
                this.chatMessages = [];
                this.unreadCount = 0;
                this.isChatOpen = false;
                
                // Show login screen
                const loginScreen = document.getElementById('loginScreen');
                const driverApp = document.getElementById('driverApp');
                const loginForm = document.getElementById('loginForm');
                
                if (loginScreen) loginScreen.style.display = 'block';
                if (driverApp) driverApp.style.display = 'none';
                if (loginForm) loginForm.reset();
                
                // Reset metrics
                this.totalDistance = 0;
                this.dataPoints = 0;
                this.lastPosition = null;
                
                this.addLog('✅ Logout berhasil - Data Firebase dijadwalkan untuk cleanup', 'success');
                this.notificationManager.addSystemNotification('Driver logged out', 'info');
                
            } catch (error) {
                console.error('Error during logout:', error);
                this.addLog('❌ Error during logout', 'error');
            }
        }
    }

    // ===== VALIDATION METHODS =====
    isValidCoordinate(lat, lng) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
        if (isNaN(lat) || isNaN(lng)) return false;
        return true;
    }

    handleGPSError(error) {
        let message = '';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = '❌ Izin GPS Ditolak';
                break;
            case error.POSITION_UNAVAILABLE:
                message = '❌ GPS Device Tidak Aktif';
                break;
            case error.TIMEOUT:
                message = '⏱️ Timeout GPS';
                break;
            default:
                message = '❌ Error GPS';
                break;
        }
        this.addLog(message, 'error');
        this.notificationManager.addSystemNotification(message, 'error');
    }
}

// ===== INITIALIZE APPLICATION =====
document.addEventListener('DOMContentLoaded', function() {
    window.dtLogger = new EnhancedDTGPSLogger();
});

// Handle page visibility
document.addEventListener('visibilitychange', function() {
    if (window.dtLogger && window.dtLogger.driverData) {
        if (document.hidden) {
            window.dtLogger.addLog('Aplikasi di background', 'warning');
        } else {
            window.dtLogger.addLog('Aplikasi aktif kembali', 'success');
        }
    }
});

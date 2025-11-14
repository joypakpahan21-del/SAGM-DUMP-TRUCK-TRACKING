// ===== FIREBASE CONFIGURATION =====
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
try {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}
const database = firebase.database();

(function() {

    class IndependentStopwatch {
    constructor() {
        this.startTime = null;
        this.pausedTime = 0;
        this.isRunning = false;
        this.lastUpdate = null;
        
    }

    start() {
        if (this.isRunning) return;
        
        this.startTime = Date.now();
        this.isRunning = true;
        this.lastUpdate = Date.now();
        console.log('⏱️ Independent Stopwatch STARTED');
    }

    pause() {
        if (!this.isRunning) return;
        
        this.updatePausedTime();
        this.isRunning = false;
        console.log('⏱️ Independent Stopwatch PAUSED');
    }

    resume() {
        if (this.isRunning) return;
        
        this.startTime = Date.now() - this.pausedTime;
        this.isRunning = true;
        this.lastUpdate = Date.now();
        console.log('⏱️ Independent Stopwatch RESUMED');
    }

    stop() {
        this.updatePausedTime();
        this.isRunning = false;
        console.log('⏱️ Independent Stopwatch STOPPED');
    }

    reset() {
        this.startTime = null;
        this.pausedTime = 0;
        this.isRunning = false;
        this.lastUpdate = null;
        console.log('⏱️ Independent Stopwatch RESET');
    }

    updatePausedTime() {
        if (this.isRunning && this.startTime) {
            this.pausedTime = Date.now() - this.startTime;
        }
    }

    getElapsedTime() {
        if (!this.isRunning || !this.startTime) {
            return this.pausedTime;
        }
        return Date.now() - this.startTime;
    }

    getCurrentTimestamp() {
        // ✅ TIMESTAMP YANG TIDAK PERNAH STUCK OFFLINE
        return this.getElapsedTime();
    }

    getFormattedTime() {
        const totalSeconds = Math.floor(this.getElapsedTime() / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}


setupSpeedStopwatch= () => {
    console.log('⏱️ Setting up speed stopwatch system...');
    if (this.distanceCalculator) {
        this.distanceCalculator.getTimestampFn = () => {
            return this.stopwatch.getCurrentTimestamp();
        };
    }
    if (this.realTimeProcessor) {
        this.realTimeProcessor.getTimestampFn = () => {
            return this.stopwatch.getCurrentTimestamp();
        };
        if (this.realTimeProcessor.distanceCalculator) {
            this.realTimeProcessor.distanceCalculator.getTimestampFn = () => {
                return this.stopwatch.getCurrentTimestamp();
            };
        }
    }

    console.log('✅ Speed stopwatch setup completed');
}

startJourney= () => {
    this.journeyStatus = 'started';
    this.sessionStartTime = new Date();
    this.totalDistance = 0;
    this.dataPoints = 0;

    if (this.stopwatch) {
        this.stopwatch.start();
        console.log('⏱️ MAIN STOPWATCH STARTED for distance calculation');
        }
    this.resetRealTimeTracking();
    this.startRealGPSTracking();
    this.startDataTransmission();
    this.addLog('Perjalanan dimulai - Stopwatch aktif', 'success');
    this.updateJourneyDisplay();
}


// ===== HAVERSINE DISTANCE & REAL-TIME SPEED CALCULATOR =====
class HaversineDistanceSpeedCalculator {
    constructor(mainStopwatch) {
        this.positionHistory = [];
        this.totalDistance = 0;
        this.currentSpeed = 0;
        this.lastPosition = null;
        this.lastCalculationTime = null;
        this.lastFirebaseSend = 0;
        this.firebaseDebounceDelay = 1000;
        this.EARTH_RADIUS_KM = 6371;
        this.MIN_TIME_DIFF = 0.1; 
        this.getTimestampFn = null;
        this.mainStopwatch = mainStopwatch;
        this.getTimestampFn = () => {
            if (this.mainStopwatch) {
                return this.mainStopwatch.getCurrentTimestamp();
            }
            console.error('❌ Main stopwatch not available');
            return Date.now();
        };
        this.setupStopwatchSystem();
    }

    setTimestampGetter(getTimestampFn) {
        if (typeof getTimestampFn === 'function') {
            this.getTimestampFn = getTimestampFn;
            console.log('⏱️ Stopwatch di-set ke Haversine Calculator');
        } else {
            console.warn('❌ getTimestampFn bukan function:', getTimestampFn);
        }
    }

    setupStopwatchSystem() {
        this.getSessionTimestamp = () => {
            return this.stopwatch.getCurrentTimestamp();
        };
        if (this.realTimeProcessor) {
            this.realTimeProcessor.setStopwatch(this.getSessionTimestamp);
        }

        console.log('⏱️ Independent Stopwatch system initialized');
    }
    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        // Validasi input
        if (!this.isValidCoordinate(lat1, lon1) || !this.isValidCoordinate(lat2, lon2)) {
            console.warn('❌ Invalid coordinates:', { lat1, lon1, lat2, lon2 });
            return 0;
        }

        // Convert degrees to radians
        const dLat = this.degreesToRadians(lat2 - lat1);
        const dLon = this.degreesToRadians(lon2 - lon1);
        
        const lat1Rad = this.degreesToRadians(lat1);
        const lat2Rad = this.degreesToRadians(lat2);

        // Haversine formula
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
                  
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = this.EARTH_RADIUS_KM * c;

        return distance;
    }



    calculateDistanceAndSpeed(currentPosition) {
        if (!currentPosition || !currentPosition.lat || !currentPosition.lng) {
            return { distance: 0, speed: 0, totalDistance: this.totalDistance };
        }
    
        const now = this.getTimestampFn();
        const currentPoint = {
            lat: currentPosition.lat,
            lng: currentPosition.lng,
            timestamp: now
        };
    
        let distance = 0;
        let speed = 0;
    
        // Jika ada posisi sebelumnya, hitung jarak dan kecepatan
        if (this.lastPosition) {
            // 1. HITUNG JARAK dengan Haversine
            distance = this.calculateHaversineDistance(
                this.lastPosition.lat, this.lastPosition.lng,
                currentPoint.lat, currentPoint.lng
            );
            const timeDiffMs = currentPoint.timestamp - this.lastPosition.timestamp;
            const timeDiffHours = timeDiffMs / 1000 / 3600;
    
            if (timeDiffHours > 0.0000278) { // ~0.1 detik
                speed = distance / timeDiffHours;
                speed = this.validateSpeed(speed);
            }
            console.log(`📏 Distance Calc: ${(distance * 1000).toFixed(1)}m, Time: ${timeDiffMs}ms, Speed: ${speed.toFixed(1)}km/h`);
            this.totalDistance += distance;
        }
    
        this.lastPosition = currentPoint;
        this.currentSpeed = speed;
    
        // Simpan data ke localStorage SEBELUM return
        const positionData = {
            lat: currentPosition.lat,
            lng: currentPosition.lng,
            timestamp: now,
            speed: speed,
            distance: distance,
            unit: this.unitNumber,
            driver: this.driverName
        };
    
        const offlinePositions = JSON.parse(localStorage.getItem('offline_positions') || '[]');
        offlinePositions.push(positionData);
        localStorage.setItem('offline_positions', JSON.stringify(offlinePositions));

        if (!navigator.onLine) {
            navigator.serviceWorker.ready.then(registration => {
                registration.sync.register('sync-positions')
                    .then(() => console.log('🔄 Registered sync for offline positions'))
                    .catch(err => console.error('Error registering sync:', err));
            });
        }
    
        return {
            distance: distance,
            speed: speed,
            totalDistance: this.totalDistance,
            timestamp: now,
            lastPosition: this.lastPosition,
            currentSpeed: this.currentSpeed
        };
    }
    
    isValidCoordinate(lat, lng) {
        if (lat === null || lng === null || lat === undefined || lng === undefined) {
            return false;
        }
        if (isNaN(lat) || isNaN(lng)) {
            return false;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return false;
        }
        return true;
    }

    /**
     * Convert degrees to radians
     */
    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Validasi kecepatan realistis
     */
    validateSpeed(speed) {
        const MAX_SPEED = 200;
        const MIN_SPEED = 0;
        
        if (speed < MIN_SPEED || speed > MAX_SPEED || isNaN(speed)) {
            console.warn(`🚨 Invalid speed detected: ${speed} km/h, resetting to 0`);
            return 0;
        }
        
        return speed;
    }

    /**
     * Update dengan data GPS langsung
     */
    updateWithGPSPosition(gpsPosition) {
        if (!gpsPosition || !gpsPosition.coords) {
            console.warn('❌ Invalid GPS position provided to calculator');
            return { 
                distance: 0, 
                speed: 0, 
                totalDistance: this.totalDistance,
                timestamp: Date.now(),
                error: 'invalid_position'
            };
        }
        const processedPosition = {
            lat: gpsPosition.coords.latitude,
            lng: gpsPosition.coords.longitude,
            timestamp: this.getTimestampFn ? this.getTimestampFn() : Date.now()
        };
        const result = this.calculateDistanceAndSpeed(processedPosition);
        if (!result || typeof result !== 'object') {
            console.error('❌ calculateDistanceAndSpeed returned invalid result:', result);
            return { 
                distance: 0, 
                speed: 0, 
                totalDistance: this.totalDistance,
                timestamp: processedPosition.timestamp,
                error: 'calculation_failed'
            };
        }


        return this.calculateDistanceAndSpeed(processedPosition);
    }

    /**
     * Get metrics saat ini
     */
    getCurrentMetrics() {
        return {
            currentSpeed: this.currentSpeed,
            totalDistance: this.totalDistance,
            lastPosition: this.lastPosition,
            lastCalculation: this.lastCalculationTime
        };
    }

    /**
     * Get persistent state snapshot untuk disimpan
     */
    getState() {
        return {
            totalDistance: this.totalDistance,
            lastPosition: this.lastPosition
                ? {
                    lat: this.lastPosition.lat,
                    lng: this.lastPosition.lng,
                    timestamp: this.lastPosition.timestamp ? this.lastPosition.timestamp.toISOString() : null
                }
                : null,
            lastCalculationTime: this.lastCalculationTime ? this.lastCalculationTime.toISOString() : null
        };
    }

    restoreState(state) {
        if (!state || typeof state !== 'object') return;

        if (typeof state.totalDistance === 'number' && isFinite(state.totalDistance)) {
            this.totalDistance = state.totalDistance;
        }

        if (state.lastPosition && state.lastPosition.lat !== undefined && state.lastPosition.lng !== undefined) {
            this.lastPosition = {
                lat: state.lastPosition.lat,
                lng: state.lastPosition.lng,
                timestamp: state.lastPosition.timestamp ? new Date(state.lastPosition.timestamp) : new Date()
            };
        }

        if (state.lastCalculationTime) {
            this.lastCalculationTime = new Date(state.lastCalculationTime);
        }
    }
}

   
// ===== REAL-TIME GPS PROCESSOR =====
class RealTimeGPSProcessor {
    constructor(mainStopwatch) {
        this.distanceCalculator = new HaversineDistanceSpeedCalculator();
        this.updateInterval = 1000; 
        this.isProcessing = false;
        this.strictRealtime = true;
        this.distanceCalculator = new HaversineDistanceSpeedCalculator(mainStopwatch);
        this.mainStopwatch = mainStopwatch;
        this.isProcessing = false;
        this.getTimestampFn = () => {
            if (this.mainStopwatch) {
                return this.mainStopwatch.getCurrentTimestamp();
            }
            return Date.now();
        };
        this.tuning = {
            idleSnapKmh: 0,
            minMoveMeters: 0,
            antiZigzagAccuracy: 0
        };
        this.strictRealtime = false;
        
        // Real-time data
        this.currentData = {
            position: null,
            distance: 0,
            speed: 0,
            totalDistance: 0,
            timestamp: null
        };

        this.callbacks = [];
    }
        
    processPosition(gpsPosition, context = {}) {
        if (this.isProcessing) {
            return null;
        }
        this.isProcessing = true;
        try {
            // ✅ DETEKSI BACKGROUND/OFFLINE DARI CONTEXT
            const isBackground = context.background || document.hidden;
            const isOffline = context.offline || !navigator.onLine;
            const processedPosition = {
                lat: gpsPosition.coords.latitude,
                lng: gpsPosition.coords.longitude,
                timestamp: this.getTimestampFn(), // ✅ PAKAI STOPWATCH UTAMA
                accuracy: gpsPosition.coords.accuracy
            };
            const result = this.distanceCalculator.calculateDistanceAndSpeed(processedPosition);
            
            if (!result) {
                console.warn('❌ Distance calculator returned null result');
                return null;
            }
            const finalResult = {
                position: {
                    lat: processedPosition.lat,
                    lng: processedPosition.lng
                },
                distance: result.distance || 0,
                speed: result.speed || 0,
                totalDistance: result.totalDistance || 0,
                timestamp: result.timestamp,
                quality: this.assessQuality(processedPosition),
                processed: isBackground ? 'background' : 'foreground',
                accuracy: processedPosition.accuracy,
                background: isBackground,
                offline: isOffline
            };
            console.log(`📍 Real-time Processed: ${finalResult.distance.toFixed(4)}km, Total: ${finalResult.totalDistance.toFixed(3)}km, Speed: ${finalResult.speed.toFixed(1)}km/h`);
            this.notifyCallbacks(finalResult);
            return finalResult;
        } catch (error) {
            console.error('❌ Error processing GPS position:', error);
            return null;
        } finally {
            this.isProcessing = false;
        }
    }
    assessQuality(position) {
        if (position.accuracy <= 10) return 'excellent';
        if (position.accuracy <= 25) return 'good';
        if (position.accuracy <= 50) return 'fair';
        return 'poor';
    }

    processWithRelaxedFiltering(gpsPosition, isBackground, isOffline) {
        // ✅ LONGAR CRITERIA DI BACKGROUND/OFFLINE
        const accuracyThreshold = isBackground ? 75 : 35; // 75m di background vs 35m foreground
        const minMoveMeters = isBackground ? 1.0 : 2.0;   // 1m di background vs 2m foreground
        const maxSpeed = isBackground ? 250 : 180;
        if (this.lastPosition) {
            const distance = this.calculateDistanceMeters(
                this.lastPosition.lat, this.lastPosition.lng,
                gpsPosition.coords.latitude, gpsPosition.coords.longitude
            );
            if (isBackground || isOffline) {
                console.log(`🔄 Background/Offline movement: ${distance.toFixed(1)}m (min: ${minMoveMeters}m)`);
                // Terima semua movement, termasuk yang kecil
            } else {
                // Hanya filter di foreground jika movement terlalu kecil
                if (distance < minMoveMeters) {
                    console.log(`⏸️ Small movement filtered in foreground: ${distance.toFixed(1)}m < ${minMoveMeters}m`);
                    return null;
                }
            }
        }
        
        // ✅ JANGAN BUANG DATA, TAPI FLAG QUALITY
        const positionQuality = gpsPosition.coords.accuracy <= accuracyThreshold ? 'high' : 'low';
        
        // Process data anyway, jangan return null!
        const result = this.distanceCalculator.updateWithGPSPosition(gpsPosition);
        if (!result) {
            console.warn('❌ Distance calculator returned null result');
            return null;
        }
        
        const adjustedDistance = result.distance;
        const adjustedSpeed = result.speed;
        
        this.currentData = {
            position: {
                lat: gpsPosition.coords.latitude,
                lng: gpsPosition.coords.longitude
            },
            distance: result.distance || 0,
            speed: result.speed || 0,
            totalDistance: result.totalDistance,
            timestamp: result.timestamp,
            quality: positionQuality, // ✅ FLAG QUALITY, JANGAN BUANG
            processed: isBackground ? 'background_minimal' : 'standard',
            accuracy: gpsPosition.coords.accuracy,
            background: isBackground,
            offline: isOffline,
            movement: this.lastPosition ? this.calculateDistanceMeters(
                this.lastPosition.lat, this.lastPosition.lng,
                gpsPosition.coords.latitude, gpsPosition.coords.longitude
            ) : 0,
            // ✅ TAMBAHKAN CALCULATOR METADATA
            calculatorData: {
                hasDistance: !!result.distance,
                hasSpeed: !!result.speed,
                hasTotalDistance: !!result.totalDistance,
                timestamp: result.timestamp
            }
        };
        
        this.notifyCallbacks(this.currentData);
        return this.currentData;
    }
    calculateDistanceMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in meters
    }

    processWithStandardFiltering(gpsPosition) {
        // ✅ GUNAKAN minMoveMeters DI FOREGROUND
        const minMoveMeters = 2.0;
        const accuracyThreshold = 35;
        
        // Filter accuracy di foreground
        if (gpsPosition.coords.accuracy > accuracyThreshold) {
            console.warn('⚠️ Low accuracy position filtered in foreground');
            return null;
        }
        
        if (this.lastPosition) {
            const distance = this.calculateDistanceMeters(
                this.lastPosition.lat, this.lastPosition.lng,
                gpsPosition.coords.latitude, gpsPosition.coords.longitude
            );


         if (distance < minMoveMeters) {
                console.log(`⏸️ Small movement filtered: ${distance.toFixed(1)}m < ${minMoveMeters}m`);
                return null;
            }
            
        }
        
        const result = this.distanceCalculator.updateWithGPSPosition(gpsPosition);
        if (!result) {
            console.warn('❌ Distance calculator returned null result');
            return null;
        }
        const extendedResult = {
            ...result,
            processed: 'standard',
            accuracy: gpsPosition.coords.accuracy,
            quality: 'high'
        };
        
        this.currentData = extendedResult;
        this.notifyCallbacks(extendedResult);
        
        return extendedResult;
    }

    
    
    setTuning(tuning) {
        this.tuning = { ...this.tuning, ...(tuning || {}) };
    }

    /**
     * Aktifkan mode strict realtime (tanpa filter/jeda)
     */
    setStrictRealtime(enabled = true) {
        this.strictRealtime = !!enabled;
        if (this.strictRealtime) {
            this.processingDelay = 0;
            this.tuning.idleSnapKmh = 0;
            this.tuning.minMoveMeters = 0;
            // antiZigzagAccuracy tidak relevan jika minMoveMeters=0
        }
    }

    
    /**
     * Get current data
     */
    getCurrentData() {
        return { ...this.currentData };
    }

    /**
     * Get calculator untuk akses langsung
     */
    getCalculator() {
        return this.distanceCalculator;
    }

    /**
     * Get persistent state
     */
    getState() {
        return this.distanceCalculator.getState();
    }

    /**
     * Restore persistent state
     */
    restoreState(state) {
        this.distanceCalculator.restoreState(state);
        if (state && state.lastPosition) {
            this.currentData.position = {
                lat: state.lastPosition.lat,
                lng: state.lastPosition.lng
            };
        }
        if (state && typeof state.totalDistance === 'number') {
            this.currentData.totalDistance = state.totalDistance;
        }
    }

    /**
     * Reset processor
     */
    reset() {
        this.distanceCalculator.reset();
        this.currentData = {
            position: null,
            distance: 0,
            speed: 0,
            totalDistance: 0,
            timestamp: null
        };
        console.log('🔄 Real-time GPS Processor reset');
    }

    getState() {
        return this.distanceCalculator.getState();
    }

    restoreState(state) {
        this.distanceCalculator.restoreState(state);
    }
}



// ===== BACKGROUND GPS POLLER =====
class BackgroundGPSPoller {
    constructor(logger, options = {}) {
        this.logger = logger;
        this.pollInterval = null;
        this.isActive = false; // ✅ HAPUS DUPLICATE
        this.isPolling = false;
        this.pollDelay = options.pollDelay || 1000;
        this.adaptiveTimeout = 5000; // ✅ CONSISTENT 5 DETIK AWAL
        this.pollAttempts = 0;
        this.lastSuccessPoll = Date.now();
        this.enableHighAccuracy = options.enableHighAccuracy !== false;

        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleNetworkChange = this.handleNetworkChange.bind(this);

        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('online', this.handleNetworkChange);
        window.addEventListener('offline', this.handleNetworkChange);
    }

    start() {
        if (this.isPolling) return;
        
        this.isActive = true;
        this.isPolling = true;
        
        console.log('⚡ Starting RELIABLE background polling');
        this.startReliablePolling();
    }

    startReliablePolling() {
        const pollWithRetry = async () => {
            if (!this.isActive || !this.isPolling) {
                console.log('🛑 Polling stopped');
                return;
            }

            try {
                await this.attemptPoll();
                this.pollAttempts = 0;
                this.adaptiveTimeout = 5000; // ✅ CONSISTENT
                console.log('✅ Poll successful');
            } catch (error) {
                this.pollAttempts++;
                this.adaptiveTimeout = Math.min(30000, 5000 * Math.min(this.pollAttempts, 6));
                console.warn(`❌ Poll failed (attempt ${this.pollAttempts}): ${error.message}`);
            }

            // Adaptive delay based on conditions
            const delay = this.calculateOptimalDelay();
            setTimeout(pollWithRetry, delay);
        };

        pollWithRetry();
    }

    attemptPoll() {
        return new Promise((resolve, reject) => {
            if (!this.isActive || !navigator.geolocation) {
                reject(new Error('Not active or no geolocation'));
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error(`Poll timeout after ${this.adaptiveTimeout}ms`));
            }, this.adaptiveTimeout);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(timeoutId);
                    if (this.logger && this.logger.handleBackgroundPoll) {
                        this.logger.handleBackgroundPoll(position, { 
                            source: 'background',
                            background: document.hidden,
                            accuracy: position.coords.accuracy
                        });
                    }
                    this.lastSuccessPoll = Date.now();
                    resolve(position);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                },
                {
                    enableHighAccuracy: this.enableHighAccuracy,
                    maximumAge: document.hidden ? 30000 : 0,
                    timeout: this.adaptiveTimeout
                }
            );
        });
    }

    calculateOptimalDelay() {
        // Background: lebih sering (1-2 detik) untuk hindari gaps
        if (document.hidden) {
            return 1000 + Math.random() * 1000; 
        }
        // Foreground: lebih jarang (2-4 detik) untuk hemat battery
        return 2000 + Math.random() * 2000;
    }

    stop() {
        this.isActive = false;
        this.isPolling = false;
        console.log('🛑 Background polling stopped');
    }

    setActive(active) {
        this.isActive = active;
        if (!active) {
            this.stop();
        } else if (this.shouldPoll()) {
            this.start();
        }
    }

    shouldPoll() {
        if (!this.isActive) return false;
        return document.hidden || !navigator.onLine;
    }

    handleVisibilityChange() {
        const isBackground = document.hidden;
        if (isBackground && this.shouldPoll()) {
            console.log('📱 App masuk background - starting reliable polling');
            this.start();
        } else if (!isBackground) {
            console.log('📱 App kembali foreground - stopping background polling');
            this.stop();
        }
    }

    handleNetworkChange() {
        if (this.shouldPoll()) {
            this.start();
        } else {
            this.stop();
        }
    }

    getStats() {
        return {
            isActive: this.isActive,
            isPolling: this.isPolling,
            pollAttempts: this.pollAttempts,
            adaptiveTimeout: this.adaptiveTimeout,
            lastSuccessPoll: new Date(this.lastSuccessPoll).toLocaleTimeString(),
            optimalDelay: this.calculateOptimalDelay()
        };
    }
}

// ===== ENHANCED KALMAN FILTER FOR GPS SMOOTHING =====
class EnhancedKalmanFilter {
    constructor(processNoise = 0.01, measurementNoise = 0.1, error = 0.1) {
        this.Q = processNoise;      // Process noise covariance
        this.R = measurementNoise;  // Measurement noise covariance  
        this.P = error;             // Estimation error covariance
        this.X = 0;                 // Estimated value
        this.K = 0;                 // Kalman gain
    }

    update(measurement) {
        // Prediction phase
        this.P = this.P + this.Q;
        
        // Kalman gain calculation
        this.K = this.P / (this.P + this.R);
        
        // Correction phase
        this.X = this.X + this.K * (measurement - this.X);
        this.P = (1 - this.K) * this.P;
        
        return this.X;
    }

    reset() {
        this.P = 0.1;
        this.X = 0;
        this.K = 0;
    }

    getState() {
        return {
            value: this.X,
            variance: this.P,
            gain: this.K
        };
    }
}

class GPSKalmanFilter {
    constructor() {
        this.latitudeFilter = new EnhancedKalmanFilter(0.005, 0.05, 0.05);
        this.longitudeFilter = new EnhancedKalmanFilter(0.005, 0.05, 0.05);
        this.speedFilter = new EnhancedKalmanFilter(0.05, 0.3, 0.5);
        this.bearingFilter = new EnhancedKalmanFilter(0.05, 0.2, 0.5);
        this.accuracyHistory = [];
    }

    updatePosition(rawLat, rawLng, rawSpeed, rawBearing) {
        const filteredLat = this.latitudeFilter.update(rawLat);
        const filteredLng = this.longitudeFilter.update(rawLng);
        const filteredSpeed = Math.max(0, this.speedFilter.update(rawSpeed));
        const filteredBearing = rawBearing !== null ? this.bearingFilter.update(rawBearing) : null;

        // Update accuracy history for trend analysis
        const currentAccuracy = this.calculateAccuracy();
        this.accuracyHistory.push(currentAccuracy);
        if (this.accuracyHistory.length > 10) {
            this.accuracyHistory.shift();
        }

        return {
            lat: filteredLat,
            lng: filteredLng,
            speed: filteredSpeed,
            bearing: filteredBearing,
            accuracy: Math.max(5, currentAccuracy),
            confidence: this.calculateConfidence()
        };
    }

    calculateAccuracy() {
        const latVariance = this.latitudeFilter.P;
        const lngVariance = this.longitudeFilter.P;
        const positionVariance = Math.sqrt(latVariance * latVariance + lngVariance * lngVariance);
        return positionVariance * 50000; // Convert to meters approximation
    }

    calculateConfidence() {
        if (this.accuracyHistory.length === 0) return 0.5;
        
        const avgAccuracy = this.accuracyHistory.reduce((a, b) => a + b, 0) / this.accuracyHistory.length;
        const stability = Math.max(0, 1 - (avgAccuracy / 100)); // Higher accuracy = higher confidence
        return Math.min(1, Math.max(0.1, stability));
    }

    reset() {
        this.latitudeFilter.reset();
        this.longitudeFilter.reset();
        this.speedFilter.reset();
        this.bearingFilter.reset();
        this.accuracyHistory = [];
    }

    getFilterStatus() {
        return {
            latitude: this.latitudeFilter.getState(),
            longitude: this.longitudeFilter.getState(),
            speed: this.speedFilter.getState(),
            bearing: this.bearingFilter.getState(),
            accuracyHistory: [...this.accuracyHistory],
            confidence: this.calculateConfidence()
        };
    }
}

// ===== MOVEMENT DETECTOR =====
class MovementDetector {
    constructor() {
        this.positionHistory = [];
        this.movementThreshold = 2.0; // meters
        this.stationaryThreshold = 5; // consecutive readings
        this.stationaryCount = 0;
        this.isMoving = false;
    }

    updatePosition(position) {
        this.positionHistory.push({
            lat: position.lat,
            lng: position.lng,
            timestamp: position.timestamp || new Date()
        });

        // Keep only recent positions
        if (this.positionHistory.length > 10) {
            this.positionHistory.shift();
        }

        return this.analyzeMovement();
    }

    analyzeMovement() {
        if (this.positionHistory.length < 2) {
            return { isMoving: false, confidence: 0 };
        }

        const recentPositions = this.positionHistory.slice(-5);
        let totalDistance = 0;
        let movementCount = 0;

        for (let i = 1; i < recentPositions.length; i++) {
            const distance = this.calculateDistance(
                recentPositions[i-1].lat, recentPositions[i-1].lng,
                recentPositions[i].lat, recentPositions[i].lng
            );
            totalDistance += distance;

            if (distance > this.movementThreshold) {
                movementCount++;
            }
        }

        const avgDistance = totalDistance / (recentPositions.length - 1);
        const movementRatio = movementCount / (recentPositions.length - 1);

        // Update stationary count
        if (movementRatio > 0.3) {
            this.stationaryCount = 0;
            this.isMoving = true;
        } else {
            this.stationaryCount++;
            if (this.stationaryCount >= this.stationaryThreshold) {
                this.isMoving = false;
            }
        }

        return {
            isMoving: this.isMoving,
            confidence: movementRatio,
            averageDistance: avgDistance,
            stationaryTime: this.stationaryCount
        };
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    reset() {
        this.positionHistory = [];
        this.stationaryCount = 0;
        this.isMoving = false;
    }
}

// ===== REAL TIME DISTANCE CALCULATOR =====
class RealTimeDistanceCalculator {
    constructor() {
        this.positionHistory = [];
        this.totalDistance = 0;
        this.currentSpeed = 0;
        this.speedHistory = [];
        this.maxHistorySize = 10;
    }

    updatePosition(newPosition) {
        if (!newPosition || !newPosition.lat || !newPosition.lng) {
            return { distance: 0, speed: 0, totalDistance: this.totalDistance };
        }

        const now = Date.now();
        this.positionHistory.push({
            ...newPosition,
            timestamp: now
        });

        // Keep history manageable
        if (this.positionHistory.length > this.maxHistorySize) {
            this.positionHistory.shift();
        }

        // Calculate distance and speed
        if (this.positionHistory.length >= 2) {
            const latest = this.positionHistory[this.positionHistory.length - 1];
            const previous = this.positionHistory[this.positionHistory.length - 2];
            
            const distance = this.calculateDistance(
                previous.lat, previous.lng,
                latest.lat, latest.lng
            );

            const timeDiff = (latest.timestamp - previous.timestamp) / 1000; // seconds
            const speed = timeDiff > 0 ? (distance / timeDiff) * 3.6 : 0; // km/h

            this.totalDistance += distance;
            this.currentSpeed = speed;

            // Update speed history
            this.speedHistory.push(speed);
            if (this.speedHistory.length > 5) {
                this.speedHistory.shift();
            }
        }

        return {
            distance: this.currentDistance,
            speed: this.currentSpeed,
            totalDistance: this.totalDistance,
            averageSpeed: this.calculateAverageSpeed()
        };
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    calculateAverageSpeed() {
        if (this.speedHistory.length === 0) return 0;
        return this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;
    }

    reset() {
        this.positionHistory = [];
        this.totalDistance = 0;
        this.currentSpeed = 0;
        this.speedHistory = [];
    }

    getMetrics() {
        return {
            totalDistance: this.totalDistance,
            currentSpeed: this.currentSpeed,
            averageSpeed: this.calculateAverageSpeed(),
            positionCount: this.positionHistory.length
        };
    }
}

// ===== BACKGROUND AWARE GPS PROCESSOR =====
class BackgroundAwareGPSProcessor {
    constructor() {
        this.backgroundMode = false;
        this.offlineMode = false;
        this.positionQueue = [];
        this.maxQueueSize = 1000;
        this.distanceCalculator = new RealTimeDistanceCalculator();
        this.movementDetector = new MovementDetector();
        this.kalmanFilter = new GPSKalmanFilter();
        this.lastProcessedPosition = null;
        
        this.setupBackgroundDetection();
    }

    setupBackgroundDetection() {
        document.addEventListener('visibilitychange', () => {
            this.backgroundMode = document.hidden;
            if (this.backgroundMode) {
                console.log('📱 Entering background mode');
            } else {
                console.log('📱 Returning to foreground');
                this.processQueuedPositions();
            }
        });

        window.addEventListener('online', () => {
            this.offlineMode = false;
            console.log('🌐 Online mode restored');
        });

        window.addEventListener('offline', () => {
            this.offlineMode = true;
            console.log('🌐 Offline mode activated');
        });
    }

    processPosition(position, isBackground = false, isOffline = false) {
        const processedPosition = this.kalmanFilter.updatePosition(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.speed || 0,
            position.coords.heading
        );

        processedPosition.timestamp = new Date();
        processedPosition.isBackground = isBackground;
        processedPosition.isOffline = isOffline;

        // Update movement detection
        const movement = this.movementDetector.updatePosition(processedPosition);

        // Update distance calculation
        const distanceData = this.distanceCalculator.updatePosition(processedPosition);

        return {
            ...processedPosition,
            movement: movement,
            distance: distanceData,
            quality: this.assessQuality(processedPosition, movement)
        };
    }

    assessQuality(position, movement) {
        let qualityScore = 1.0;

        // Accuracy impact
        if (position.accuracy > 50) qualityScore -= 0.3;
        else if (position.accuracy > 25) qualityScore -= 0.1;

        // Movement confidence impact
        if (movement.confidence < 0.3) qualityScore -= 0.2;

        // Background mode impact
        if (position.isBackground) qualityScore -= 0.1;

        // Offline mode impact
        if (position.isOffline) qualityScore -= 0.1;

        return Math.max(0.1, Math.min(1.0, qualityScore));
    }

    queuePosition(position) {
        if (this.positionQueue.length >= this.maxQueueSize) {
            this.positionQueue.shift(); // Remove oldest if queue full
        }
        this.positionQueue.push(position);
    }

    processQueuedPositions() {
        if (this.positionQueue.length === 0) return;

        console.log(`🔄 Processing ${this.positionQueue.length} queued positions`);
        
        const processed = [];
        while (this.positionQueue.length > 0) {
            const position = this.positionQueue.shift();
            const processedPosition = this.processPosition(position, true, true);
            processed.push(processedPosition);
        }

        return processed;
    }

    reset() {
        this.positionQueue = [];
        this.distanceCalculator.reset();
        this.movementDetector.reset();
        this.kalmanFilter.reset();
        this.lastProcessedPosition = null;
    }

    getStatus() {
        return {
            backgroundMode: this.backgroundMode,
            offlineMode: this.offlineMode,
            queuedPositions: this.positionQueue.length,
            distanceMetrics: this.distanceCalculator.getMetrics(),
            movementStatus: this.movementDetector.analyzeMovement(),
            filterStatus: this.kalmanFilter.getFilterStatus()
        };
    }
}

// ===== UNLIMITED OPERATION MANAGER =====
class UnlimitedOperationManager {
    constructor() {
        this.operationStartTime = Date.now();
        this.backgroundStartTime = null;
        this.offlineStartTime = null;
        this.positionCount = 0;
        this.dataPointsProcessed = 0;
        this.lastCleanupTime = Date.now();
        
        // Unlimited configuration
        this.cleanupInterval = 30 * 60 * 1000; // 30 menit sekali cleanup
        this.memorySafetyThreshold = 0.8; // 80% memory usage
        this.maxQueueSize = 1000000; // 1 juta items (very high)
        this.autoArchiveThreshold = 100000; // Archive setelah 100k points
        
        this.performanceMetrics = {
            totalUptime: 0,
            backgroundUptime: 0,
            offlineUptime: 0,
            positionsProcessed: 0,
            dataPointsSaved: 0,
            recoveryCount: 0
        };
        
        this.startUnlimitedOperation();
    }

    startUnlimitedOperation() {
        // Start background processing yang tidak pernah berhenti
        this.startInfiniteBackgroundProcessor();
        this.startMemoryManagement();
        this.startAutoRecovery();
        this.startDataArchiving();
        
        console.log('♾️ Unlimited operation manager started');
    }

    startInfiniteBackgroundProcessor() {
        // Gunakan recursive setTimeout untuk menghindari interval blockage
        const processInBackground = () => {
            if (this.isInBackground()) {
                this.processBackgroundOperations();
            }
            // Schedule next execution dengan jitter untuk menghindari blockage
            const nextDelay = 1000 + Math.random() * 2000; // 1-3 detik
            setTimeout(processInBackground, nextDelay);
        };
        
        processInBackground();
    }

    startMemoryManagement() {
        const manageMemory = () => {
            this.performMemoryCleanup();
            this.checkMemoryUsage();
            setTimeout(manageMemory, 60000); // Check setiap 1 menit
        };
        
        manageMemory();
    }

    startAutoRecovery() {
        const autoRecover = () => {
            this.checkSystemHealth();
            this.performAutoRecoveryIfNeeded();
            setTimeout(autoRecover, 30000); // Check setiap 30 detik
        };
        
        autoRecover();
    }

    startDataArchiving() {
        const autoArchive = () => {
            this.performAutoArchiving();
            setTimeout(autoArchive, 5 * 60 * 1000); // Archive setiap 5 menit
        };
        
        autoArchive();
    }

    processBackgroundOperations() {
        // Process semua background operations tanpa batas
        this.processPositionQueue();
        this.processStorageOperations();
        this.updatePerformanceMetrics();
    }

    performMemoryCleanup() {
        const now = Date.now();
        if (now - this.lastCleanupTime > this.cleanupInterval) {
            console.log('🧹 Performing memory cleanup...');
            
            // Cleanup circular buffers
            if (window.dtLogger?.waypointBuffer) {
                const oldSize = window.dtLogger.waypointBuffer.count;
                // Keep only last 50k points in memory
                if (oldSize > 50000) {
                    const recent = window.dtLogger.waypointBuffer.getRecent(50000);
                    window.dtLogger.waypointBuffer.clear();
                    recent.forEach(point => window.dtLogger.waypointBuffer.push(point));
                    console.log(`🧹 Reduced waypoint buffer from ${oldSize} to ${window.dtLogger.waypointBuffer.count}`);
                }
            }
            
            // Cleanup processing queues
            if (window.dtLogger?.gpsProcessor?.positionQueue) {
                const queueSize = window.dtLogger.gpsProcessor.positionQueue.length;
                if (queueSize > 1000) {
                    window.dtLogger.gpsProcessor.positionQueue = 
                        window.dtLogger.gpsProcessor.positionQueue.slice(-1000);
                    console.log(`🧹 Reduced processing queue from ${queueSize} to 1000`);
                }
            }
            
            // Force garbage collection jika available
            if (window.gc) {
                window.gc();
            }
            
            this.lastCleanupTime = now;
        }
    }

    performAutoArchiving() {
        // Auto-archive data lama ke compressed storage
        const storageManager = window.dtLogger?.storageManager;
        if (!storageManager) return;

        try {
            const waypoints = storageManager.loadAllWaypoints();
            if (waypoints.length > this.autoArchiveThreshold) {
                console.log(`🗃️ Auto-archiving ${waypoints.length} waypoints...`);
                
                // Archive points yang sudah synced dan berusia > 1 jam
                const now = new Date();
                const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
                
                const toArchive = waypoints.filter(wp => 
                    wp.synced && new Date(wp.timestamp) < oneHourAgo
                );
                
                const toKeep = waypoints.filter(wp => 
                    !wp.synced || new Date(wp.timestamp) >= oneHourAgo
                );
                
                if (toArchive.length > 0) {
                    storageManager.saveToStorage(toKeep);
                    
                    // Add to compressed storage
                    const compressed = storageManager.loadCompressedData();
                    compressed.push({
                        archiveId: `auto_archive_${Date.now()}`,
                        archivedAt: new Date().toISOString(),
                        count: toArchive.length,
                        data: toArchive
                    });
                    
                    localStorage.setItem(
                        storageManager.STORAGE_KEYS.COMPRESSED_DATA, 
                        JSON.stringify(compressed)
                    );
                    
                    console.log(`✅ Auto-archived ${toArchive.length} waypoints`);
                }
            }
        } catch (error) {
            console.error('❌ Auto-archiving failed:', error);
        }
    }

    checkMemoryUsage() {
        // Check memory usage dan lakukan emergency cleanup jika needed
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize;
            const total = performance.memory.totalJSHeapSize;
            const usageRatio = used / total;
            
            if (usageRatio > this.memorySafetyThreshold) {
                console.warn('🚨 High memory usage detected, performing emergency cleanup');
                this.emergencyMemoryCleanup();
            }
        }
    }

    emergencyMemoryCleanup() {
        // Emergency cleanup untuk hindari crash
        console.warn('🚨 PERFORMING EMERGENCY MEMORY CLEANUP');
        
        // Clear semua large buffers
        if (window.dtLogger) {
            // Keep only essential data
            window.dtLogger.waypointBuffer.clear();
            window.dtLogger.gpsProcessor.positionQueue = [];
            window.dtLogger.speedHistory = [];
            window.dtLogger.distanceHistory = [];
        }
        
        // Clear processing histories
        if (window.dtLogger?.gpsProcessor) {
            window.dtLogger.gpsProcessor.distanceCalculator.distanceHistory = [];
            window.dtLogger.gpsProcessor.distanceCalculator.speedHistory = [];
        }
        
        // Force garbage collection
        if (window.gc) {
            window.gc();
        }
        
        console.log('✅ Emergency memory cleanup completed');
    }

    checkSystemHealth() {
        const now = Date.now();
        const uptime = now - this.operationStartTime;
        
        this.performanceMetrics.totalUptime = uptime;
        
        // Log status setiap 10 menit
        if (uptime % (10 * 60 * 1000) < 1000) {
            console.log(`🕒 System uptime: ${this.formatUptime(uptime)}`);
            this.printSystemStatus();
        }
        
        // Auto-recover jika ada komponen yang stuck
        this.autoRecoverStuckComponents();
    }

    autoRecoverStuckComponents() {
        const logger = window.dtLogger;
        if (!logger) return;
        
        // Check GPS tracking status
        if (logger.isTracking && logger.healthMetrics.gpsUpdates === 0) {
            console.warn('🔄 GPS seems stuck, attempting recovery...');
            this.performanceMetrics.recoveryCount++;
            
            logger.stopRealGPSTracking();
            setTimeout(() => {
                if (logger.journeyStatus === 'started') {
                    logger.startRealGPSTracking();
                }
            }, 1000);
        }
        
        // Check data transmission
        if (logger.isOnline && logger.unsyncedWaypoints.size > 1000) {
            console.warn('🔄 Large unsynced data, forcing sync...');
            logger.syncWaypointsToServer();
        }
    }

    updatePerformanceMetrics() {
        const now = Date.now();
        
        if (this.isInBackground() && !this.backgroundStartTime) {
            this.backgroundStartTime = now;
        } else if (!this.isInBackground() && this.backgroundStartTime) {
            this.performanceMetrics.backgroundUptime += (now - this.backgroundStartTime);
            this.backgroundStartTime = null;
        }
        
        if (!navigator.onLine && !this.offlineStartTime) {
            this.offlineStartTime = now;
        } else if (navigator.onLine && this.offlineStartTime) {
            this.performanceMetrics.offlineUptime += (now - this.offlineStartTime);
            this.offlineStartTime = null;
        }
    }

    isInBackground() {
        return document.hidden || !document.hasFocus();
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    printSystemStatus() {
        const logger = window.dtLogger;
        if (!logger) return;
        
        console.group('📊 UNLIMITED SYSTEM STATUS');
        console.log('🕒 Total Uptime:', this.formatUptime(this.performanceMetrics.totalUptime));
        console.log('📱 Background Time:', this.formatUptime(this.performanceMetrics.backgroundUptime));
        console.log('🌐 Offline Time:', this.formatUptime(this.performanceMetrics.offlineUptime));
        console.log('📍 Positions Processed:', this.performanceMetrics.positionsProcessed);
        console.log('💾 Data Points Saved:', this.performanceMetrics.dataPointsSaved);
        console.log('🔄 Recovery Count:', this.performanceMetrics.recoveryCount);
        console.log('📡 GPS Updates:', logger.healthMetrics.gpsUpdates);
        console.log('💾 Waypoint Buffer:', logger.waypointBuffer?.count || 0);
        console.log('🔄 Unsynced Waypoints:', logger.unsyncedWaypoints?.size || 0);
        console.log('📶 Online Status:', navigator.onLine);
        console.log('🎯 Journey Status:', logger.journeyStatus);
        console.groupEnd();
    }

    getUnlimitedMetrics() {
        return {
            ...this.performanceMetrics,
            currentUptime: this.formatUptime(Date.now() - this.operationStartTime),
            systemHealth: this.getSystemHealthStatus(),
            memoryInfo: this.getMemoryInfo(),
            storageInfo: this.getStorageInfo()
        };
    }

    getSystemHealthStatus() {
        const logger = window.dtLogger;
        if (!logger) return 'unknown';
        
        if (!logger.isTracking && logger.journeyStatus === 'started') {
            return 'needs_recovery';
        }
        
        if (logger.unsyncedWaypoints.size > 5000) {
            return 'sync_backlog';
        }
        
        return 'healthy';
    }

    getMemoryInfo() {
        if (!performance.memory) return 'not_available';
        
        const used = performance.memory.usedJSHeapSize / 1048576; // MB
        const total = performance.memory.totalJSHeapSize / 1048576; // MB
        const limit = performance.memory.jsHeapSizeLimit / 1048576; // MB
        
        return {
            used: used.toFixed(2) + ' MB',
            total: total.toFixed(2) + ' MB',
            limit: limit.toFixed(2) + ' MB',
            usagePercentage: ((used / total) * 100).toFixed(1) + '%'
        };
    }

    getStorageInfo() {
        try {
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length * 2; // UTF-16 bytes
                }
            }
            
            const totalMB = totalSize / 1048576;
            
            return {
                totalSize: totalMB.toFixed(2) + ' MB',
                estimatedCapacity: '5-10 MB (typical browser limit)',
                health: totalMB > 8 ? 'critical' : totalMB > 5 ? 'warning' : 'healthy'
            };
        } catch (error) {
            return { error: 'cannot_calculate' };
        }
    }
}

// ===== ENHANCED UNLIMITED GPS PROCESSOR =====
class UnlimitedGPSProcessor extends BackgroundAwareGPSProcessor {
    constructor() {
        super();
        this.unlimitedMode = true;
        this.lastPositionTime = Date.now();
        this.stuckDetectionThreshold = 30000; // 30 detik
        this.backgroundProcessingEnabled = true;
        
        this.startUnlimitedProcessing();
    }

    startUnlimitedProcessing() {
        // Background processing yang never stops
        this.startBackgroundPositionProcessor();
        this.startStuckDetection();
    }

    startBackgroundPositionProcessor() {
        const processPositions = () => {
            if (this.backgroundMode || this.offlineMode) {
                this.processAllQueuedPositions();
            }
            
            // Gunakan recursive timeout untuk infinite loop
            setTimeout(processPositions, 2000); // Process setiap 2 detik
        };
        
        processPositions();
    }

    startStuckDetection() {
        const checkStuck = () => {
            const now = Date.now();
            if (now - this.lastPositionTime > this.stuckDetectionThreshold) {
                console.warn('⚠️ No position updates, checking GPS...');
                this.recoverFromStuckState();
            }
            setTimeout(checkStuck, 10000); // Check setiap 10 detik
        };
        
        checkStuck();
    }

    processAllQueuedPositions() {
        let processedCount = 0;
        const maxProcessPerCycle = 100; // Batasi per cycle untuk hindari blockage
        
        while (this.positionQueue.length > 0 && processedCount < maxProcessPerCycle) {
            const position = this.positionQueue.shift();
            if (this.processQueuedPosition(position)) {
                processedCount++;
            }
        }
        
        if (processedCount > 0) {
            console.log(`🔄 Processed ${processedCount} queued positions in background`);
        }
        
        return processedCount;
    }

    processQueuedPosition(position) {
        try {
            // Update distance calculator dengan position yang queued
            if (this.lastProcessedPosition) {
                const distance = this.calculateDistance(
                    this.lastProcessedPosition.lat, this.lastProcessedPosition.lng,
                    position.lat, position.lng
                );
                
                if (distance > 1.0) { // Only update jika ada movement meaningful
                    this.distanceCalculator.updatePosition(position);
                    this.lastProcessedPosition = position;
                    return true;
                }
            } else {
                this.lastProcessedPosition = position;
                this.distanceCalculator.updatePosition(position);
                return true;
            }
        } catch (error) {
            console.error('Error processing queued position:', error);
        }
        
        return false;
    }

    recoverFromStuckState() {
        console.log('🔄 Recovering from stuck state...');
        
        // Reset processors
        this.distanceCalculator.reset();
        this.kalmanFilter.reset();
        
        // Clear queue yang mungkin corrupt
        if (this.positionQueue.length > 1000) {
            this.positionQueue = this.positionQueue.slice(-500); // Keep only recent 500
        }
        
        this.lastPositionTime = Date.now();
        
        console.log('✅ Stuck state recovery completed');
    }

    // Override untuk handle unlimited operation
    processPosition(position, isBackground = false, isOffline = false) {
        this.lastPositionTime = Date.now();
        return super.processPosition(position, isBackground, isOffline);
    }
}

// ===== ENHANCED UNLIMITED STORAGE MANAGER =====
class UnlimitedStorageManager extends EnhancedStorageManager {
    constructor() {
        super();
        this.unlimitedMode = true;
        this.totalDataPointsStored = 0;
        this.startUnlimitedStorageManagement();
    }

    startUnlimitedStorageManagement() {
        // Continuous storage management
        this.startStorageHealthMonitor();
        this.startAutoCompression();
    }

    startStorageHealthMonitor() {
        const monitorStorage = () => {
            this.checkUnlimitedStorageHealth();
            setTimeout(monitorStorage, 60000); // Check setiap 1 menit
        };
        
        monitorStorage();
    }

    startAutoCompression() {
        const autoCompress = () => {
            this.performSmartCompression();
            setTimeout(autoCompress, 2 * 60 * 1000); // Compress setiap 2 menit
        };
        
        autoCompress();
    }

    checkUnlimitedStorageHealth() {
        try {
            const waypoints = this.loadAllWaypoints();
            const compressed = this.loadCompressedData();
            const archived = this.loadArchivedData();
            
            const totalPoints = waypoints.length + 
                compressed.reduce((sum, batch) => sum + batch.compressedCount, 0) +
                archived.reduce((sum, archive) => sum + archive.count, 0);
            
            this.totalDataPointsStored = totalPoints;
            
            // Emergency cleanup jika mendekati limit
            if (totalPoints > this.QUOTA_LIMITS.CRITICAL_THRESHOLD) {
                console.warn('🚨 CRITICAL: Storage near limit, performing emergency compression');
                this.emergencyStorageCleanup();
            }
            
            return {
                totalPoints,
                health: this.checkStorageHealth(),
                needsCompression: waypoints.length > this.QUOTA_LIMITS.COMPRESSION_THRESHOLD
            };
            
        } catch (error) {
            console.error('Storage health check failed:', error);
            return { error: 'check_failed' };
        }
    }

    performSmartCompression() {
        const waypoints = this.loadAllWaypoints();
        
        if (waypoints.length > this.QUOTA_LIMITS.COMPRESSION_THRESHOLD) {
            console.log('🔧 Performing smart compression...');
            
            // Compress points yang sudah synced dan berusia > 30 menit
            const now = new Date();
            const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000));
            
            const toCompress = waypoints.filter(wp => 
                wp.synced && new Date(wp.timestamp) < thirtyMinutesAgo
            );
            
            const toKeep = waypoints.filter(wp => 
                !wp.synced || new Date(wp.timestamp) >= thirtyMinutesAgo
            );
            
            if (toCompress.length > 0) {
                this.saveToStorage(toKeep);
                
                // Add to compressed storage dengan smart grouping
                this.addToCompressedStorage(toCompress);
                
                console.log(`✅ Smart compression: ${toCompress.length} points compressed, ${toKeep.length} kept active`);
            }
        }
    }

    addToCompressedStorage(waypoints) {
        const compressed = this.loadCompressedData();
        
        // Group by time windows (1 hour chunks) untuk efficiency
        const grouped = this.groupWaypointsByTime(waypoints, 60 * 60 * 1000); // 1 hour
        
        grouped.forEach(group => {
            compressed.push({
                batchId: `compressed_${group.startTime}_${group.endTime}`,
                compressedAt: new Date().toISOString(),
                originalCount: group.waypoints.length,
                startTime: new Date(group.startTime).toISOString(),
                endTime: new Date(group.endTime).toISOString(),
                data: this.compressWaypoints(group.waypoints)
            });
        });
        
        // Keep hanya compressed data yang diperlukan
        if (compressed.length > 100) {
            compressed.splice(0, compressed.length - 80); // Keep last 80 batches
        }
        
        localStorage.setItem(this.STORAGE_KEYS.COMPRESSED_DATA, JSON.stringify(compressed));
    }

    groupWaypointsByTime(waypoints, timeWindowMs) {
        if (waypoints.length === 0) return [];
        
        const groups = [];
        let currentGroup = [];
        let currentWindowStart = new Date(waypoints[0].timestamp).getTime();
        
        waypoints.forEach(waypoint => {
            const pointTime = new Date(waypoint.timestamp).getTime();
            
            if (pointTime - currentWindowStart < timeWindowMs) {
                currentGroup.push(waypoint);
            } else {
                if (currentGroup.length > 0) {
                    groups.push({
                        startTime: currentWindowStart,
                        endTime: currentWindowStart + timeWindowMs,
                        waypoints: currentGroup
                    });
                }
                currentGroup = [waypoint];
                currentWindowStart = pointTime;
            }
        });
        
        // Add the last group
        if (currentGroup.length > 0) {
            groups.push({
                startTime: currentWindowStart,
                endTime: currentWindowStart + timeWindowMs,
                waypoints: currentGroup
            });
        }
        
        return groups;
    }

    emergencyStorageCleanup() {
        console.warn('🚨 PERFORMING EMERGENCY STORAGE CLEANUP');
        
        try {
            const waypoints = this.loadAllWaypoints();
            
            // Keep only:
            // 1. Unsynced points
            // 2. Points from last 15 minutes
            const fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000));
            
            const toKeep = waypoints.filter(wp => 
                !wp.synced || new Date(wp.timestamp) >= fifteenMinutesAgo
            );
            
            const removedCount = waypoints.length - toKeep.length;
            
            this.saveToStorage(toKeep);
            
            console.log(`✅ Emergency cleanup: Removed ${removedCount} points, kept ${toKeep.length}`);
            
            return removedCount;
            
        } catch (error) {
            console.error('❌ Emergency storage cleanup failed:', error);
            return 0;
        }
    }

    getUnlimitedStorageStats() {
        const health = this.checkUnlimitedStorageHealth();
        const metadata = this.getStorageMetadata();
        
        return {
            totalDataPoints: this.totalDataPointsStored,
            storageHealth: health,
            compressionEnabled: this.compressionEnabled,
            autoArchiveEnabled: this.autoArchiveEnabled,
            metadata: metadata,
            usage: this.getStorageUsage()
        };
    }
}

// ===== ENHANCED GPS PROCESSOR WITH MULTI-LAYER VALIDATION =====
class EnhancedGPSProcessor {
    constructor() {
        this.kalmanFilter = new GPSKalmanFilter();
        this.lastValidPosition = null;
        this.consecutiveBadReadings = 0;
        this.positionHistory = [];
        this.accuracyThreshold = 35; // meters
        this.speedThreshold = 180;   // km/h maximum realistic speed
        this.jumpThreshold = 0.02;   // 2km max jump between readings
        this.maxHistorySize = 10;
        this.qualityMetrics = {
            totalProcessed: 0,
            filteredOut: 0,
            accuracyRejects: 0,
            jumpRejects: 0
        };
    }

    processRawPosition(position) {
        this.qualityMetrics.totalProcessed++;
        
        const rawCoords = position.coords;
        
        // Stage 1: Basic coordinate validation
        if (!this.isValidCoordinate(rawCoords.latitude, rawCoords.longitude)) {
            console.warn('❌ Invalid coordinate values');
            this.qualityMetrics.filteredOut++;
            return null;
        }

        // Stage 2: Accuracy validation with adaptive threshold
        const accuracyScore = this.evaluateAccuracy(rawCoords.accuracy);
        if (accuracyScore < 0.3) {
            this.consecutiveBadReadings++;
            this.qualityMetrics.accuracyRejects++;
            
            if (this.consecutiveBadReadings > 5) {
                console.warn(`🎯 Consecutive bad accuracy readings: ${this.consecutiveBadReadings}`);
                return null;
            }
            
            // Allow some bad readings but with lower confidence
            console.warn(`⚠️ Low accuracy: ${rawCoords.accuracy}m, score: ${accuracyScore.toFixed(2)}`);
        } else {
            this.consecutiveBadReadings = 0;
        }

        // Convert speed from m/s to km/h
        const rawSpeed = rawCoords.speed !== null ? Math.max(0, rawCoords.speed * 3.6) : 0;

        // Stage 3: Apply Kalman Filter for smoothing
        const filtered = this.kalmanFilter.updatePosition(
            rawCoords.latitude,
            rawCoords.longitude,
            rawSpeed,
            rawCoords.heading
        );

        // Add timestamp for movement validation
        filtered.timestamp = new Date();

        // Stage 4: Movement validation and jump detection
        if (this.lastValidPosition && !this.isValidMovement(this.lastValidPosition, filtered)) {
            console.warn('🚨 Position jump detected, using last valid position with lower confidence');
            this.qualityMetrics.jumpRejects++;
            
            const fallbackPosition = {
                ...this.lastValidPosition,
                accuracy: Math.max(filtered.accuracy, 50),
                confidence: Math.max(0.3, filtered.confidence * 0.7),
                isFallback: true
            };
            
            this.updatePositionHistory(fallbackPosition);
            return fallbackPosition;
        }

        // Stage 5: Update position history and return valid position
        this.lastValidPosition = { ...filtered };
        this.updatePositionHistory(filtered);
        
        return filtered;
    }

    isValidCoordinate(lat, lng) {
        // Comprehensive coordinate validation
        if (lat === null || lng === null || lat === undefined || lng === undefined) {
            return false;
        }
        if (isNaN(lat) || isNaN(lng)) {
            return false;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return false;
        }
        if (lat === 0 && lng === 0) {
            return false; // Reject null island
        }
        return true;
    }

    evaluateAccuracy(accuracy) {
        // Convert accuracy to confidence score (0-1)
        if (accuracy <= 10) return 1.0;    // Excellent
        if (accuracy <= 20) return 0.8;    // Good
        if (accuracy <= 35) return 0.6;    // Fair
        if (accuracy <= 50) return 0.4;    // Poor
        if (accuracy <= 100) return 0.2;   // Very poor
        return 0.1;                        // Unreliable
    }

    isValidMovement(previous, current) {
        if (!previous || !previous.timestamp) return true;
        
        const distance = this.calculateDistance(
            previous.lat, previous.lng, 
            current.lat, current.lng
        );
        
        const timeDiff = (current.timestamp - previous.timestamp) / 1000; // seconds
        if (timeDiff <= 0) return true; // Same timestamp
        
        // Calculate maximum physically possible distance
        const maxPossibleDistance = (this.speedThreshold / 3.6) * timeDiff; // meters
        
        // Also consider minimum movement threshold (avoid micro-movements)
        const minSignificantDistance = 2.0; // meters
        
        const isValid = distance <= Math.max(maxPossibleDistance, this.jumpThreshold * 1000) && 
                       distance >= minSignificantDistance;
        
        if (!isValid) {
            console.warn(`🚨 Invalid movement: ${distance.toFixed(1)}m in ${timeDiff.toFixed(1)}s, max possible: ${maxPossibleDistance.toFixed(1)}m`);
        }
        
        return isValid;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        // High-precision Haversine distance calculation
        const R = 6371000; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in meters
    }

    updatePositionHistory(position) {
        this.positionHistory.push({
            lat: position.lat,
            lng: position.lng,
            timestamp: position.timestamp,
            accuracy: position.accuracy,
            confidence: position.confidence
        });
        
        // Keep history size manageable
        if (this.positionHistory.length > this.maxHistorySize) {
            this.positionHistory.shift();
        }
    }

    getQualityMetrics() {
        const acceptanceRate = this.qualityMetrics.totalProcessed > 0 ? 
            ((this.qualityMetrics.totalProcessed - this.qualityMetrics.filteredOut) / this.qualityMetrics.totalProcessed * 100).toFixed(1) : 0;
            
        return {
            ...this.qualityMetrics,
            acceptanceRate: acceptanceRate + '%',
            currentConfidence: this.kalmanFilter.calculateConfidence(),
            filterStatus: this.kalmanFilter.getFilterStatus()
        };
    }

    reset() {
        this.kalmanFilter.reset();
        this.lastValidPosition = null;
        this.consecutiveBadReadings = 0;
        this.positionHistory = [];
        this.qualityMetrics = {
            totalProcessed: 0,
            filteredOut: 0,
            accuracyRejects: 0,
            jumpRejects: 0
        };
    }
}

// ===== ENHANCED SPEED CALCULATOR WITH SENSOR FUSION =====
class EnhancedSpeedCalculator {
    constructor() {
        this.positionHistory = [];
        this.speedHistory = [];
        this.accelerationHistory = [];
        this.gpsSpeedWeight = 0.7;    // Priority for GPS speed when available
        this.calcSpeedWeight = 0.3;   // Weight for calculated speed
        this.maxHistorySize = 5;
        this.lastCalculationTime = null;
        this.smoothingFactor = 0.3;
        this.accelerationThreshold = 3.0; // m/s² maximum reasonable acceleration
    }

    calculateEnhancedSpeed(currentPosition, previousPosition, gpsSpeed) {
        if (!previousPosition) {
            return this.validateAndReturnSpeed(gpsSpeed || 0, 'initial');
        }

        const timeDiffMs = currentPosition.timestamp - previousPosition.timestamp;
        
        // For real-time responsiveness, use minimal delay but ensure stability
        if (timeDiffMs < 500) {
            return this.getLastValidSpeed();
        }

        // Calculate speed from position change (calculated speed)
        const distanceKm = this.calculateHaversineDistance(
            previousPosition.lat, previousPosition.lng,
            currentPosition.lat, currentPosition.lng
        );
        
        const timeDiffHours = timeDiffMs / 3600000;
        const calculatedSpeed = timeDiffHours > 0 ? distanceKm / timeDiffHours : 0;

        // Debug information
        console.log(`📊 Speed Analysis - GPS: ${gpsSpeed.toFixed(1)} km/h, Calc: ${calculatedSpeed.toFixed(1)} km/h, Distance: ${(distanceKm * 1000).toFixed(1)}m, Time: ${timeDiffMs}ms`);

        // Advanced sensor fusion algorithm
        let finalSpeed = this.sensorFusion(gpsSpeed, calculatedSpeed, currentPosition.accuracy, timeDiffMs);

        // Apply intelligent smoothing based on data quality
        finalSpeed = this.applyAdaptiveSmoothing(finalSpeed, currentPosition.accuracy);

        // Validate against acceleration limits
        finalSpeed = this.validateAcceleration(finalSpeed, timeDiffMs);

        // Update history for future calculations
        this.updateSpeedHistory(finalSpeed, timeDiffMs);

        this.lastCalculationTime = currentPosition.timestamp;
        
        console.log(`🎯 Final Speed: ${finalSpeed.toFixed(1)} km/h`);
        return finalSpeed;
    }

    sensorFusion(gpsSpeed, calculatedSpeed, accuracy, timeDiffMs) {
        // Dynamic weighting based on accuracy and time difference
        let dynamicGPSWeight = this.gpsSpeedWeight;
        let dynamicCalcWeight = this.calcSpeedWeight;

        // Adjust weights based on GPS accuracy
        if (accuracy > 30) {
            // Reduce GPS weight when accuracy is poor
            const accuracyPenalty = Math.min(0.4, (accuracy - 30) / 50);
            dynamicGPSWeight = Math.max(0.3, dynamicGPSWeight - accuracyPenalty);
            dynamicCalcWeight = Math.min(0.7, dynamicCalcWeight + accuracyPenalty);
        }

        // Adjust weights based on time stability
        if (timeDiffMs > 2000) {
            // For longer intervals, trust calculated speed more
            dynamicCalcWeight += 0.1;
            dynamicGPSWeight -= 0.1;
        }

        // Normalize weights
        const totalWeight = dynamicGPSWeight + dynamicCalcWeight;
        dynamicGPSWeight /= totalWeight;
        dynamicCalcWeight /= totalWeight;

        // Validate both speed sources
        const validGPSSpeed = this.validateSpeed(gpsSpeed, 'gps');
        const validCalcSpeed = this.validateSpeed(calculatedSpeed, 'calculated');

        if (validGPSSpeed && validCalcSpeed) {
            // Both sources valid - use weighted fusion
            const fusedSpeed = (gpsSpeed * dynamicGPSWeight) + (calculatedSpeed * dynamicCalcWeight);
            console.log(`🔄 Sensor Fusion - GPS: ${gpsSpeed.toFixed(1)} (${(dynamicGPSWeight*100).toFixed(0)}%), Calc: ${calculatedSpeed.toFixed(1)} (${(dynamicCalcWeight*100).toFixed(0)}%), Fused: ${fusedSpeed.toFixed(1)}`);
            return fusedSpeed;
        } else if (validGPSSpeed) {
            // Only GPS speed valid
            console.log(`📡 Using GPS Speed: ${gpsSpeed.toFixed(1)} km/h`);
            return gpsSpeed;
        } else if (validCalcSpeed) {
            // Only calculated speed valid
            console.log(`📐 Using Calculated Speed: ${calculatedSpeed.toFixed(1)} km/h`);
            return calculatedSpeed;
        }

        // Both invalid - return 0 or last valid speed
        console.warn('🚨 No valid speed sources available');
        return this.getLastValidSpeed();
    }

    validateSpeed(speed, type) {
        if (speed === null || speed === undefined || isNaN(speed)) {
            return false;
        }

        const maxSpeed = 200; // km/h - maximum realistic speed
        const minSpeed = 0;

        // Check for physically impossible values
        if (speed < minSpeed || speed > maxSpeed) {
            console.warn(`🚨 Invalid ${type} speed: ${speed} km/h`);
            return false;
        }

        // Additional validation for calculated speed
        if (type === 'calculated' && speed > 0) {
            // Check for sudden jumps in calculated speed
            const lastSpeed = this.getLastValidSpeed();
            if (lastSpeed > 0 && Math.abs(speed - lastSpeed) > 50) { // 50 km/h jump
                console.warn(`🚨 Calculated speed jump: ${lastSpeed.toFixed(1)} → ${speed.toFixed(1)} km/h`);
                return false;
            }
        }

        return true;
    }

    validateAcceleration(newSpeed, timeDiffMs) {
        const lastSpeed = this.getLastValidSpeed();
        if (lastSpeed === 0 || timeDiffMs === 0) return newSpeed;

        const acceleration = Math.abs(newSpeed - lastSpeed) / (timeDiffMs / 1000) * (1000 / 3600); // m/s²
        
        if (acceleration > this.accelerationThreshold) {
            console.warn(`🚨 High acceleration detected: ${acceleration.toFixed(1)} m/s², limiting change`);
            // Limit the speed change to reasonable acceleration
            const maxSpeedChange = this.accelerationThreshold * (timeDiffMs / 1000) * (3600 / 1000); // km/h
            const limitedSpeed = lastSpeed + Math.sign(newSpeed - lastSpeed) * maxSpeedChange;
            return limitedSpeed;
        }

        return newSpeed;
    }

    applyAdaptiveSmoothing(newSpeed, accuracy) {
        // Adjust smoothing based on accuracy and speed consistency
        let smoothingFactor = this.smoothingFactor;
        
        if (accuracy > 25) {
            // More smoothing when accuracy is poor
            smoothingFactor = Math.min(0.7, this.smoothingFactor + 0.2);
        }
        
        this.speedHistory.push(newSpeed);
        
        if (this.speedHistory.length > this.maxHistorySize) {
            this.speedHistory.shift();
        }

        // Weighted moving average with emphasis on recent values
        let total = 0;
        let weightSum = 0;
        
        this.speedHistory.forEach((speed, index) => {
            const weight = Math.pow(2, index); // Exponential weighting
            total += speed * weight;
            weightSum += weight;
        });

        const smoothedSpeed = total / weightSum;
        
        // Apply final smoothing
        const lastValid = this.getLastValidSpeed();
        if (lastValid > 0) {
            return lastValid * (1 - smoothingFactor) + smoothedSpeed * smoothingFactor;
        }
        
        return smoothedSpeed;
    }

    getLastValidSpeed() {
        return this.speedHistory.length > 0 ? this.speedHistory[this.speedHistory.length - 1] : 0;
    }

    updateSpeedHistory(speed, timeDiffMs) {
        this.speedHistory.push(speed);
        
        if (this.speedHistory.length > this.maxHistorySize) {
            this.speedHistory.shift();
        }

        // Update acceleration history
        if (this.speedHistory.length >= 2) {
            const currentSpeed = this.speedHistory[this.speedHistory.length - 1];
            const previousSpeed = this.speedHistory[this.speedHistory.length - 2];
            const acceleration = (currentSpeed - previousSpeed) / (timeDiffMs / 1000) * (1000 / 3600); // m/s²
            
            this.accelerationHistory.push(acceleration);
            if (this.accelerationHistory.length > 5) {
                this.accelerationHistory.shift();
            }
        }
    }

    validateAndReturnSpeed(speed, context) {
        if (this.validateSpeed(speed, context)) {
            this.speedHistory.push(speed);
            if (this.speedHistory.length > this.maxHistorySize) {
                this.speedHistory.shift();
            }
            return speed;
        }
        return 0;
    }

    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        // High-precision distance calculation
        const R = 6371; // Earth radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return distance;
    }

    getSpeedMetrics() {
        return {
            currentSpeed: this.getLastValidSpeed(),
            speedHistory: [...this.speedHistory],
            accelerationHistory: [...this.accelerationHistory],
            historySize: this.speedHistory.length
        };
    }

    reset() {
        this.positionHistory = [];
        this.speedHistory = [];
        this.accelerationHistory = [];
        this.lastCalculationTime = null;
    }
}

// ===== ENHANCED RETRY MANAGER =====
class EnhancedRetryManager {
    constructor() {
        this.retryStrategies = {
            'critical': { 
                maxAttempts: 10, 
                baseDelay: 1000, 
                maxDelay: 60000,
                backoffMultiplier: 2,
                priority: 100
            },
            'high': { 
                maxAttempts: 8, 
                baseDelay: 2000, 
                maxDelay: 30000,
                backoffMultiplier: 1.5,
                priority: 80
            },
            'normal': { 
                maxAttempts: 5, 
                baseDelay: 5000, 
                maxDelay: 15000,
                backoffMultiplier: 1.2,
                priority: 50
            },
            'low': { 
                maxAttempts: 3, 
                baseDelay: 10000, 
                maxDelay: 30000,
                backoffMultiplier: 1,
                priority: 20
            },
            'maintenance': { 
                maxAttempts: 20, 
                baseDelay: 30000, 
                maxDelay: 300000,
                backoffMultiplier: 2,
                priority: 5
            }
        };

        this.retryQueues = {};
        this.isProcessing = false;
        this.retryStats = {
            totalAttempts: 0,
            successfulRetries: 0,
            failedRetries: 0,
            totalSavedByRetry: 0
        };
        this.retryCallbacks = [];

        this.init();
    }

    init() {
        // Initialize queues for each priority
        Object.keys(this.retryStrategies).forEach(priority => {
            this.retryQueues[priority] = [];
        });
    }

    scheduleRetry(item, priority = 'normal', context = {}) {
        const strategy = this.retryStrategies[priority];
        if (!strategy) {
            console.warn(`Unknown priority: ${priority}, using normal`);
            return this.scheduleRetry(item, 'normal', context);
        }

        const retryItem = {
            id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            data: item,
            priority: priority,
            strategy: strategy,
            attempts: 0,
            lastAttempt: null,
            nextRetry: Date.now(),
            context: context,
            createdAt: new Date().toISOString(),
            status: 'scheduled'
        };

        this.retryQueues[priority].push(retryItem);
        this.retryQueues[priority].sort((a, b) => a.nextRetry - b.nextRetry);

        console.log(`🔄 Retry scheduled [${priority}]: ${retryItem.id}`);
        
        // Start processing if not already running
        if (!this.isProcessing) {
            this.processRetries();
        }

        return retryItem.id;
    }

    async processRetries() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        try {
            // Process queues in priority order
            const priorities = Object.keys(this.retryStrategies)
                .sort((a, b) => this.retryStrategies[b].priority - this.retryStrategies[a].priority);

            for (const priority of priorities) {
                await this.processPriorityQueue(priority);
            }
        } catch (error) {
            console.error('❌ Error in retry processor:', error);
        } finally {
            this.isProcessing = false;
            
            // Schedule next processing if there are still items
            if (this.hasPendingRetries()) {
                setTimeout(() => this.processRetries(), 1000);
            }
        }
    }

    async processPriorityQueue(priority) {
        const queue = this.retryQueues[priority];
        const now = Date.now();
        
        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            
            if (item.nextRetry > now) continue;
            if (item.attempts >= item.strategy.maxAttempts) {
                // Max attempts reached, remove from queue
                console.warn(`🚨 Max attempts reached for: ${item.id}`);
                this.retryStats.failedRetries++;
                queue.splice(i, 1);
                i--;
                continue;
            }

            // Remove from queue temporarily
            queue.splice(i, 1);
            i--;

            try {
                item.attempts++;
                item.lastAttempt = new Date();
                item.status = 'processing';
                
                console.log(`🔄 Retry attempt ${item.attempts}/${item.strategy.maxAttempts} for: ${item.id}`);
                
                await this.executeRetry(item);
                
                // Success - no need to reschedule
                item.status = 'completed';
                this.retryStats.successfulRetries++;
                this.retryStats.totalSavedByRetry++;
                
                console.log(`✅ Retry successful: ${item.id}`);
                
                // Notify callbacks
                this.notifyCallbacks({
                    id: item.id,
                    status: 'completed',
                    attempts: item.attempts,
                    data: item.data
                });
                
            } catch (error) {
                // Calculate next retry with exponential backoff
                const delay = Math.min(
                    item.strategy.baseDelay * Math.pow(item.strategy.backoffMultiplier, item.attempts - 1),
                    item.strategy.maxDelay
                );
                
                item.nextRetry = Date.now() + delay;
                item.status = 'failed';
                item.lastError = error.message;
                
                console.warn(`❌ Retry failed: ${item.id}, next attempt in ${delay}ms`);
                
                // Put back in queue for next retry
                this.retryQueues[priority].push(item);
                this.retryQueues[priority].sort((a, b) => a.nextRetry - b.nextRetry);
                
                // Notify callbacks
                this.notifyCallbacks({
                    id: item.id,
                    status: 'failed',
                    attempts: item.attempts,
                    error: error.message,
                    nextRetry: item.nextRetry
                });
            }

            this.retryStats.totalAttempts++;
        }
    }

    async executeRetry(retryItem) {
        const { data, context } = retryItem;
        
        switch (context.type) {
            case 'firebase_sync':
                return await this.retryFirebaseSync(data, context);
            case 'waypoint_upload':
                return await this.retryWaypointUpload(data, context);
            case 'cleanup_operation':
                return await this.retryCleanup(data, context);
            default:
                return await this.retryGeneric(data, context);
        }
    }

    async retryFirebaseSync(data, context) {
        if (!window.dtLogger?.firebaseRef) {
            throw new Error('Firebase reference not available');
        }

        // Add retry metadata
        const enhancedData = {
            ...data,
            retryAttempt: context.attemptNumber || 1,
            lastRetry: new Date().toISOString(),
            originalTimestamp: data.timestamp
        };

        await window.dtLogger.firebaseRef.set(enhancedData);
    }

    async retryWaypointUpload(data, context) {
        // Implementation for waypoint batch upload
        const batchRef = database.ref(`/waypoints/${data.unit}/batches/${data.batchId}`);
        await batchRef.set(data);
    }

    async retryCleanup(data, context) {
        // Implementation for cleanup operations
        const { unitId, sessionId } = data;
        const cleanupPromises = [
            database.ref('/units/' + unitId).remove(),
            database.ref('/waypoints/' + unitId).remove(),
            database.ref('/sessions/' + sessionId).remove()
        ];

        await Promise.all(cleanupPromises);
    }

    async retryGeneric(data, context) {
        // Generic retry implementation
        if (typeof context.operation === 'function') {
            return await context.operation(data);
        }
        throw new Error('No retry operation defined');
    }

    hasPendingRetries() {
        return Object.values(this.retryQueues).some(queue => queue.length > 0);
    }

    getQueueStats() {
        const stats = {
            totalPending: 0,
            byPriority: {},
            nextRetryTime: null,
            overallStats: this.retryStats
        };

        Object.keys(this.retryQueues).forEach(priority => {
            const queue = this.retryQueues[priority];
            stats.byPriority[priority] = {
                count: queue.length,
                nextRetry: queue.length > 0 ? queue[0].nextRetry : null
            };
            stats.totalPending += queue.length;
        });

        // Find earliest next retry time
        const nextRetries = Object.values(stats.byPriority)
            .map(stat => stat.nextRetry)
            .filter(time => time !== null);
        
        stats.nextRetryTime = nextRetries.length > 0 ? Math.min(...nextRetries) : null;

        return stats;
    }

    addRetryCallback(callback) {
        this.retryCallbacks.push(callback);
    }

    notifyCallbacks(result) {
        this.retryCallbacks.forEach(callback => {
            try {
                callback(result);
            } catch (error) {
                console.error('Error in retry callback:', error);
            }
        });
    }

    cancelRetry(retryId) {
        for (const priority in this.retryQueues) {
            const queue = this.retryQueues[priority];
            const index = queue.findIndex(item => item.id === retryId);
            if (index !== -1) {
                queue.splice(index, 1);
                console.log(`🗑️ Cancelled retry: ${retryId}`);
                return true;
            }
        }
        return false;
    }

    clearCompleted() {
        let clearedCount = 0;
        
        Object.keys(this.retryQueues).forEach(priority => {
            const queue = this.retryQueues[priority];
            const initialLength = queue.length;
            this.retryQueues[priority] = queue.filter(item => 
                item.attempts < item.strategy.maxAttempts
            );
            clearedCount += (initialLength - this.retryQueues[priority].length);
        });

        console.log(`🧹 Cleared ${clearedCount} completed/failed retries`);
        return clearedCount;
    }

    getRetryHealth() {
        const stats = this.getQueueStats();
        const totalPending = stats.totalPending;
        
        if (totalPending === 0) return 'healthy';
        if (totalPending > 100) return 'critical';
        if (totalPending > 50) return 'warning';
        return 'normal';
    }
}

// ===== ENHANCED STORAGE MANAGER =====
// ===== PERBAIKAN ENHANCED STORAGE MANAGER =====
class EnhancedStorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            WAYPOINTS: 'enhanced_gps_waypoints_v2',
            COMPRESSED_DATA: 'compressed_gps_data',
            ARCHIVED_DATA: 'archived_gps_data',
            SYNC_STATUS: 'enhanced_sync_status_v2',
            STORAGE_METADATA: 'storage_metadata',
            SESSION_DATA: 'enhanced_session_data',
            DRIVER_PROFILES: 'driver_profiles',
            VEHICLE_PROFILES: 'vehicle_profiles',
            SYSTEM_STATE: 'system_state_backup',
            APP_SETTINGS: 'app_settings'
        };
        
        this.QUOTA_LIMITS = {
            MAX_WAYPOINTS: 250000,
            WARNING_THRESHOLD: 200000,
            CRITICAL_THRESHOLD: 230000,
            COMPRESSION_THRESHOLD: 50000,
            ARCHIVE_THRESHOLD: 100000,
            CLEANUP_PERCENTAGE: 0.15
        };
        
        this.compressionEnabled = true;
        this.autoArchiveEnabled = true;
        
        this.init();
    }

    // === METHOD YANG DIPERBAIKI DAN DITAMBAHKAN ===

    init() {
        this.ensureStorageStructure();
        this.migrateOldData();
        this.startStorageMonitor();
    }

    ensureStorageStructure() {
        try {
            // Initialize dengan empty arrays jika tidak exists
            if (!localStorage.getItem(this.STORAGE_KEYS.WAYPOINTS)) {
                localStorage.setItem(this.STORAGE_KEYS.WAYPOINTS, JSON.stringify([]));
            }
            if (!localStorage.getItem(this.STORAGE_KEYS.COMPRESSED_DATA)) {
                localStorage.setItem(this.STORAGE_KEYS.COMPRESSED_DATA, JSON.stringify([]));
            }
            if (!localStorage.getItem(this.STORAGE_KEYS.ARCHIVED_DATA)) {
                localStorage.setItem(this.STORAGE_KEYS.ARCHIVED_DATA, JSON.stringify([]));
            }

            console.log('✅ Enhanced storage structure initialized');
        } catch (error) {
            console.error('❌ Error initializing storage structure:', error);
        }
    }

    // === METHOD BARU YANG DIPERLUKAN ===

    loadAllWaypoints() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.WAYPOINTS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Failed to load waypoints:', error);
            return [];
        }
    }

    loadUnsyncedWaypoints() {
        const all = this.loadAllWaypoints();
        return all.filter(waypoint => !waypoint.synced);
    }

    markWaypointsAsSynced(waypointIds) {
        try {
            const all = this.loadAllWaypoints();
            let markedCount = 0;
            
            const updated = all.map(waypoint => {
                if (waypointIds.includes(waypoint.id)) {
                    markedCount++;
                    return { 
                        ...waypoint, 
                        synced: true,
                        syncedAt: new Date().toISOString()
                    };
                }
                return waypoint;
            });
            
            this.saveToStorage(updated);
            console.log(`✅ Marked ${markedCount} waypoints as synced`);
            return markedCount;
            
        } catch (error) {
            console.error('❌ Failed to mark waypoints as synced:', error);
            return 0;
        }
    }

    saveToStorage(waypoints) {
        try {
            localStorage.setItem(this.STORAGE_KEYS.WAYPOINTS, JSON.stringify(waypoints));
        } catch (error) {
            console.error('❌ Error saving to storage:', error);
        }
    }

    saveWaypoint(waypoint) {
        try {
            if (!waypoint || !waypoint.id) {
                throw new Error('Invalid waypoint data');
            }

            let allWaypoints = this.loadAllWaypoints();
            
            const existingIndex = allWaypoints.findIndex(wp => wp.id === waypoint.id);
            
            if (existingIndex >= 0) {
                // Update existing waypoint
                allWaypoints[existingIndex] = {
                    ...allWaypoints[existingIndex],
                    ...waypoint,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // Add new waypoint
                const enhancedWaypoint = {
                    ...waypoint,
                    createdAt: new Date().toISOString(),
                    storageVersion: '2.0'
                };
                allWaypoints.push(enhancedWaypoint);
            }

            this.saveToStorage(allWaypoints);
            console.log('✅ Waypoint saved successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to save waypoint:', error);
            return false;
        }
    }

    checkStorageHealth() {
        try {
            const waypoints = this.loadAllWaypoints();
            const usagePercentage = (waypoints.length / this.QUOTA_LIMITS.MAX_WAYPOINTS) * 100;
            
            if (usagePercentage >= 95) return 'critical';
            if (usagePercentage >= 80) return 'warning';
            if (usagePercentage >= 50) return 'normal';
            return 'healthy';
        } catch (error) {
            return 'error';
        }
    }

    getEnhancedStorageStatistics() {
        const waypoints = this.loadAllWaypoints();
        
        return {
            capacity: {
                maxWaypoints: this.QUOTA_LIMITS.MAX_WAYPOINTS,
                currentUsage: waypoints.length,
                usagePercentage: ((waypoints.length / this.QUOTA_LIMITS.MAX_WAYPOINTS) * 100).toFixed(1) + '%',
                health: this.checkStorageHealth()
            },
            breakdown: {
                active: waypoints.length,
                total: waypoints.length
            }
        };
    }

    // === IMPLEMENTASI LENGKAP DARI METHOD-METHOD YANG ADA DI KODE LAMA ===

    saveSystemState(systemState) {
        try {
            const stateToSave = {
                ...systemState,
                savedAt: new Date().toISOString(),
                version: '2.0',
                checksum: this.generateChecksum(systemState)
            };
            
            localStorage.setItem(this.STORAGE_KEYS.SYSTEM_STATE, JSON.stringify(stateToSave));
            console.log('✅ System state saved successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to save system state:', error);
            return false;
        }
    }

    loadSystemState() {
        try {
            const savedState = localStorage.getItem(this.STORAGE_KEYS.SYSTEM_STATE);
            if (!savedState) return null;
            
            const state = JSON.parse(savedState);
            
            // Validate checksum
            if (!this.validateChecksum(state)) {
                console.warn('⚠️ System state checksum validation failed');
                return null;
            }
            
            console.log('✅ System state loaded successfully');
            return state;
        } catch (error) {
            console.error('❌ Failed to load system state:', error);
            return null;
        }
    }

    saveAppSettings(settings) {
        try {
            const settingsToSave = {
                ...settings,
                lastModified: new Date().toISOString(),
                version: '1.0'
            };
            
            localStorage.setItem(this.STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settingsToSave));
            console.log('✅ App settings saved successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to save app settings:', error);
            return false;
        }
    }

    loadAppSettings() {
        try {
            const savedSettings = localStorage.getItem(this.STORAGE_KEYS.APP_SETTINGS);
            return savedSettings ? JSON.parse(savedSettings) : {
                gpsInterval: 1000,
                enableKalmanFilter: true,
                enableSpeedSmoothing: true,
                autoSync: true,
                offlineStorage: true,
                theme: 'dark',
                language: 'id-ID',
                units: 'metric'
            };
        } catch (error) {
            console.error('❌ Failed to load app settings:', error);
            return {};
        }
    }

    saveDriverProfile(profile) {
        try {
            const profiles = this.loadDriverProfiles();
            const existingIndex = profiles.findIndex(p => p.driverId === profile.driverId);
            
            if (existingIndex >= 0) {
                profiles[existingIndex] = {
                    ...profiles[existingIndex],
                    ...profile,
                    updatedAt: new Date().toISOString()
                };
            } else {
                profiles.push({
                    ...profile,
                    createdAt: new Date().toISOString(),
                    profileId: `driver_${Date.now()}`
                });
            }
            
            localStorage.setItem(this.STORAGE_KEYS.DRIVER_PROFILES, JSON.stringify(profiles));
            console.log('✅ Driver profile saved successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to save driver profile:', error);
            return false;
        }
    }

    loadDriverProfiles() {
        try {
            const profiles = localStorage.getItem(this.STORAGE_KEYS.DRIVER_PROFILES);
            return profiles ? JSON.parse(profiles) : [];
        } catch (error) {
            console.error('❌ Failed to load driver profiles:', error);
            return [];
        }
    }

    saveVehicleProfile(profile) {
        try {
            const profiles = this.loadVehicleProfiles();
            const existingIndex = profiles.findIndex(p => p.vehicleId === profile.vehicleId);
            
            if (existingIndex >= 0) {
                profiles[existingIndex] = {
                    ...profiles[existingIndex],
                    ...profile,
                    updatedAt: new Date().toISOString()
                };
            } else {
                profiles.push({
                    ...profile,
                    createdAt: new Date().toISOString(),
                    profileId: `vehicle_${Date.now()}`
                });
            }
            
            localStorage.setItem(this.STORAGE_KEYS.VEHICLE_PROFILES, JSON.stringify(profiles));
            console.log('✅ Vehicle profile saved successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to save vehicle profile:', error);
            return false;
        }
    }

    loadVehicleProfiles() {
        try {
            const profiles = localStorage.getItem(this.STORAGE_KEYS.VEHICLE_PROFILES);
            return profiles ? JSON.parse(profiles) : [];
        } catch (error) {
            console.error('❌ Failed to load vehicle profiles:', error);
            return [];
        }
    }

    saveSessionData(sessionData) {
        try {
            const sessions = this.loadSessionData();
            const existingIndex = sessions.findIndex(s => s.sessionId === sessionData.sessionId);
            
            if (existingIndex >= 0) {
                sessions[existingIndex] = {
                    ...sessions[existingIndex],
                    ...sessionData,
                    updatedAt: new Date().toISOString()
                };
            } else {
                sessions.push({
                    ...sessionData,
                    createdAt: new Date().toISOString()
                });
            }
            
            localStorage.setItem(this.STORAGE_KEYS.SESSION_DATA, JSON.stringify(sessions));
            console.log('✅ Session data saved successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to save session data:', error);
            return false;
        }
    }

    loadSessionData() {
        try {
            const sessions = localStorage.getItem(this.STORAGE_KEYS.SESSION_DATA);
            return sessions ? JSON.parse(sessions) : [];
        } catch (error) {
            console.error('❌ Failed to load session data:', error);
            return [];
        }
    }

    generateChecksum(data) {
        // Simple checksum generation for data validation
        const str = JSON.stringify(data);
        let checksum = 0;
        for (let i = 0; i < str.length; i++) {
            checksum = (checksum + str.charCodeAt(i)) % 256;
        }
        return checksum.toString(16);
    }

    validateChecksum(data) {
        if (!data.checksum) return false;
        const originalChecksum = data.checksum;
        const { checksum, ...dataWithoutChecksum } = data;
        const calculatedChecksum = this.generateChecksum(dataWithoutChecksum);
        return originalChecksum === calculatedChecksum;
    }

    performStorageMaintenance() {
        console.log('🔧 Performing storage maintenance...');
        
        try {
            // Clean up old compressed data
            const compressed = this.loadCompressedData();
            const now = new Date();
            const compressedThreshold = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
            
            const filteredCompressed = compressed.filter(batch => {
                const batchDate = new Date(batch.compressedAt);
                return batchDate >= compressedThreshold;
            });
            
            if (filteredCompressed.length < compressed.length) {
                localStorage.setItem(this.STORAGE_KEYS.COMPRESSED_DATA, JSON.stringify(filteredCompressed));
                console.log(`🧹 Cleaned up ${compressed.length - filteredCompressed.length} old compressed batches`);
            }
            
            // Update metadata
            this.updateStorageMetadata({
                lastMaintenance: new Date().toISOString(),
                maintenanceCount: (this.getStorageMetadata().maintenanceCount || 0) + 1
            });
            
            console.log('✅ Storage maintenance completed');
            return true;
            
        } catch (error) {
            console.error('❌ Storage maintenance failed:', error);
            return false;
        }
    }

    clearAllData() {
        try {
            // Clear all storage keys
            Object.values(this.STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            
            // Reinitialize storage structure
            this.ensureStorageStructure();
            
            console.log('🗑️ All storage data cleared and reinitialized');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to clear storage data:', error);
            return false;
        }
    }

    getStorageUsage() {
        let totalSize = 0;
        
        Object.values(this.STORAGE_KEYS).forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                totalSize += new Blob([data]).size;
            }
        });
        
        return {
            totalBytes: totalSize,
            totalKB: (totalSize / 1024).toFixed(2),
            totalMB: (totalSize / (1024 * 1024)).toFixed(2)
        };
    }

    exportData() {
        try {
            const exportData = {};
            
            Object.entries(this.STORAGE_KEYS).forEach(([key, storageKey]) => {
                const data = localStorage.getItem(storageKey);
                if (data) {
                    exportData[key] = JSON.parse(data);
                }
            });
            
            const exportBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(exportBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gps_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('📤 Data exported successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Data export failed:', error);
            return false;
        }
    }

    importData(file) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importData = JSON.parse(e.target.result);
                        
                        Object.entries(this.STORAGE_KEYS).forEach(([key, storageKey]) => {
                            if (importData[key]) {
                                localStorage.setItem(storageKey, JSON.stringify(importData[key]));
                            }
                        });
                        
                        console.log('📥 Data imported successfully');
                        resolve(true);
                        
                    } catch (parseError) {
                        console.error('❌ Failed to parse import file:', parseError);
                        reject(parseError);
                    }
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsText(file);
                
            } catch (error) {
                console.error('❌ Data import failed:', error);
                reject(error);
            }
        });
    }
}

// ===== INTELLIGENT SYNC MANAGER =====
class IntelligentSyncManager {
    constructor() {
        this.syncStrategies = {
            '4g': {
                name: '4G_FULL_SYNC',
                batchSize: 100,
                concurrency: 3,
                timeout: 30000,
                retryAttempts: 2,
                compression: false
            },
            '3g': {
                name: '3G_OPTIMIZED_SYNC',
                batchSize: 50,
                concurrency: 2,
                timeout: 45000,
                retryAttempts: 3,
                compression: true
            },
            '2g': {
                name: '2G_ESSENTIAL_SYNC',
                batchSize: 20,
                concurrency: 1,
                timeout: 60000,
                retryAttempts: 5,
                compression: true
            },
            'slow-2g': {
                name: 'SLOW_2G_CRITICAL_SYNC',
                batchSize: 10,
                concurrency: 1,
                timeout: 90000,
                retryAttempts: 8,
                compression: true
            },
            'offline': {
                name: 'OFFLINE_QUEUE_ONLY',
                batchSize: 0,
                concurrency: 0,
                timeout: 0,
                retryAttempts: 0,
                compression: false
            }
        };

        this.currentStrategy = null;
        this.networkInfo = {
            effectiveType: '4g',
            downlink: 10,
            rtt: 50,
            saveData: false
        };

        this.syncHistory = [];
        this.performanceMetrics = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            totalDataSent: 0,
            averageSyncTime: 0
        };
        this.syncListeners = [];

        this.init();
    }

    init() {
        this.detectNetworkCapabilities();
        this.setupNetworkListeners();
        this.startNetworkMonitor();
    }

    detectNetworkCapabilities() {
        if (navigator.connection) {
            const connection = navigator.connection;
            this.networkInfo = {
                effectiveType: connection.effectiveType || '4g',
                downlink: connection.downlink || 10,
                rtt: connection.rtt || 50,
                saveData: connection.saveData || false
            };
        } else {
            // Fallback detection
            this.networkInfo.effectiveType = this.estimateNetworkType();
        }

        this.currentStrategy = this.selectSyncStrategy();
        console.log(`📶 Network detected: ${this.networkInfo.effectiveType}, using strategy: ${this.currentStrategy.name}`);
    }

    estimateNetworkType() {
        // Simple network type estimation based on navigator properties
        if (navigator.onLine) {
            // Check for WiFi (crude detection)
            const isWifi = navigator.connection ? 
                navigator.connection.downlink > 5 : 
                window.performance && performance.memory; // Rough proxy
            
            return isWifi ? '4g' : '3g';
        }
        return 'offline';
    }

    selectSyncStrategy() {
        const { effectiveType, downlink, rtt, saveData } = this.networkInfo;

        if (!navigator.onLine) {
            return this.syncStrategies.offline;
        }

        if (saveData) {
            // Data saver mode - use most conservative strategy
            return this.syncStrategies['slow-2g'];
        }

        // Select strategy based on network type and quality
        switch (effectiveType) {
            case '4g':
                if (downlink > 10 && rtt < 100) {
                    return this.syncStrategies['4g'];
                } else {
                    return this.syncStrategies['3g']; // Degraded 4g
                }
            case '3g':
                if (downlink > 5 && rtt < 200) {
                    return this.syncStrategies['3g'];
                } else {
                    return this.syncStrategies['2g']; // Poor 3g
                }
            case '2g':
                return this.syncStrategies['2g'];
            case 'slow-2g':
                return this.syncStrategies['slow-2g'];
            default:
                return this.syncStrategies['3g']; // Default fallback
        }
    }

    setupNetworkListeners() {
        if (navigator.connection) {
            navigator.connection.addEventListener('change', () => {
                this.handleNetworkChange();
            });
        }

        window.addEventListener('online', () => {
            this.handleNetworkChange();
            this.triggerSmartSync();
        });

        window.addEventListener('offline', () => {
            this.handleNetworkChange();
        });
    }

    startNetworkMonitor() {
        // Monitor network quality every 30 seconds
        setInterval(() => {
            this.checkNetworkQuality();
        }, 30000);
    }

    handleNetworkChange() {
        const previousStrategy = this.currentStrategy?.name;
        this.detectNetworkCapabilities();
        
        if (previousStrategy !== this.currentStrategy.name) {
            console.log(`🔄 Network strategy changed: ${previousStrategy} → ${this.currentStrategy.name}`);
            
            // Trigger sync if network improved
            if (this.isNetworkImproved(previousStrategy, this.currentStrategy.name)) {
                this.triggerSmartSync();
            }
        }
    }

    isNetworkImproved(oldStrategy, newStrategy) {
        const strategyOrder = ['offline', 'slow-2g', '2g', '3g', '4g'];
        const oldIndex = strategyOrder.findIndex(s => oldStrategy.includes(s));
        const newIndex = strategyOrder.findIndex(s => newStrategy.includes(s));
        
        return newIndex > oldIndex;
    }

    async triggerSmartSync() {
        if (!navigator.onLine) {
            console.log('📴 Offline - skipping sync');
            return;
        }

        const strategy = this.currentStrategy;
        
        try {
            console.log(`🚀 Starting smart sync with strategy: ${strategy.name}`);
            
            const startTime = Date.now();
            
            // Execute sync based on strategy
            switch (strategy.name) {
                case '4G_FULL_SYNC':
                    await this.executeFullSync(strategy);
                    break;
                case '3G_OPTIMIZED_SYNC':
                    await this.executeOptimizedSync(strategy);
                    break;
                case '2G_ESSENTIAL_SYNC':
                    await this.executeEssentialSync(strategy);
                    break;
                case 'SLOW_2G_CRITICAL_SYNC':
                    await this.executeCriticalSync(strategy);
                    break;
                default:
                    await this.executeOptimizedSync(strategy);
            }

            const syncTime = Date.now() - startTime;
            this.recordSyncSuccess(syncTime);
            
            // Notify listeners
            this.notifySyncListeners({
                type: 'success',
                strategy: strategy.name,
                duration: syncTime
            });
            
        } catch (error) {
            console.error('❌ Smart sync failed:', error);
            this.recordSyncFailure(error);
            
            // Notify listeners
            this.notifySyncListeners({
                type: 'error',
                strategy: strategy.name,
                error: error.message
            });
        }
    }

    async executeFullSync(strategy) {
        console.log('🔄 Executing FULL sync (4G mode)');
        
        // Sync everything with high concurrency
        await Promise.all([
            this.syncWaypoints(strategy),
            this.syncRealTimeData(strategy),
            this.syncChatMessages(strategy),
            this.syncSystemState(strategy)
        ]);

        // Additional non-critical syncs
        await this.syncAnalyticsData(strategy);
    }

    async executeOptimizedSync(strategy) {
        console.log('🔄 Executing OPTIMIZED sync (3G mode)');
        
        // Priority-based sync
        await this.syncRealTimeData(strategy); // Highest priority
        await this.syncWaypoints(strategy);    // High priority
        await this.syncChatMessages(strategy); // Medium priority
        
        // Skip non-critical data
    }

    async executeEssentialSync(strategy) {
        console.log('🔄 Executing ESSENTIAL sync (2G mode)');
        
        // Only essential data
        await this.syncRealTimeData(strategy);
        await this.syncWaypoints(strategy, true); // Compressed waypoints only
    }

    async executeCriticalSync(strategy) {
        console.log('🔄 Executing CRITICAL sync (Slow 2G mode)');
        
        // Only most critical data with compression
        await this.syncRealTimeData(strategy, true); // Ultra-compressed
        // Waypoints are queued but not sent in this mode
    }

    async syncWaypoints(strategy, compressedOnly = false) {
        const unsyncedWaypoints = window.dtLogger?.storageManager?.loadUnsyncedWaypoints() || [];
        
        if (unsyncedWaypoints.length === 0) {
            console.log('✅ No waypoints to sync');
            return;
        }

        console.log(`📤 Syncing ${unsyncedWaypoints.length} waypoints...`);

        if (compressedOnly && unsyncedWaypoints.length > strategy.batchSize) {
            // Compress waypoints before sending
            const compressed = this.compressWaypoints(unsyncedWaypoints);
            await this.uploadCompressedWaypoints(compressed, strategy);
        } else {
            // Send in batches
            const batches = this.createBatches(unsyncedWaypoints, strategy.batchSize);
            await this.uploadBatches(batches, strategy);
        }
    }

    async syncRealTimeData(strategy, compressed = false) {
        if (!window.dtLogger?.firebaseRef) return;

        const realTimeData = window.dtLogger.getRealTimeData();
        
        if (compressed) {
            // Send minimal real-time data
            const minimalData = {
                lat: realTimeData.lat,
                lng: realTimeData.lng,
                sp: realTimeData.speed, // compressed key
                t: new Date().toISOString()
            };
            await window.dtLogger.firebaseRef.set(minimalData);
        } else {
            await window.dtLogger.firebaseRef.set(realTimeData);
        }
    }

    compressWaypoints(waypoints) {
        // Simple compression for waypoints
        return waypoints.map(wp => ({
            i: wp.id,
            la: wp.lat,
            ln: wp.lng,
            t: wp.timestamp,
            s: wp.speed,
            a: wp.accuracy
        }));
    }

    async uploadBatches(batches, strategy) {
        const uploadPromises = [];
        
        for (let i = 0; i < Math.min(batches.length, strategy.concurrency); i++) {
            uploadPromises.push(this.uploadBatchWithRetry(batches[i], i, strategy));
        }

        await Promise.all(uploadPromises);
    }

    async uploadBatchWithRetry(batch, batchIndex, strategy) {
        const retryManager = window.dtLogger?.retryManager;
        
        if (retryManager) {
            return retryManager.scheduleRetry(
                { batch, batchIndex },
                this.getRetryPriority(strategy),
                {
                    type: 'waypoint_upload',
                    operation: async (data) => {
                        await this.uploadBatch(data.batch, data.batchIndex, strategy);
                    }
                }
            );
        } else {
            // Fallback to direct upload
            return this.uploadBatch(batch, batchIndex, strategy);
        }
    }

    getRetryPriority(strategy) {
        switch (strategy.name) {
            case '4G_FULL_SYNC': return 'normal';
            case '3G_OPTIMIZED_SYNC': return 'high';
            case '2G_ESSENTIAL_SYNC': return 'high';
            case 'SLOW_2G_CRITICAL_SYNC': return 'critical';
            default: return 'normal';
        }
    }

    checkNetworkQuality() {
        // Implement network quality checks
        if (navigator.connection) {
            const connection = navigator.connection;
            
            // Check if network quality has degraded
            if (connection.rtt > 1000 || connection.downlink < 0.5) {
                console.warn('📶 Network quality degraded');
                this.handleNetworkChange();
            }
        }
    }

    recordSyncSuccess(syncTime) {
        this.performanceMetrics.totalSyncs++;
        this.performanceMetrics.successfulSyncs++;
        this.performanceMetrics.averageSyncTime = 
            (this.performanceMetrics.averageSyncTime * (this.performanceMetrics.totalSyncs - 1) + syncTime) / 
            this.performanceMetrics.totalSyncs;

        this.syncHistory.push({
            timestamp: new Date().toISOString(),
            strategy: this.currentStrategy.name,
            duration: syncTime,
            status: 'success',
            networkType: this.networkInfo.effectiveType
        });

        // Keep only last 100 sync records
        if (this.syncHistory.length > 100) {
            this.syncHistory.shift();
        }
    }

    recordSyncFailure(error) {
        this.performanceMetrics.totalSyncs++;
        this.performanceMetrics.failedSyncs++;

        this.syncHistory.push({
            timestamp: new Date().toISOString(),
            strategy: this.currentStrategy.name,
            error: error.message,
            status: 'failed',
            networkType: this.networkInfo.effectiveType
        });
    }

    addSyncListener(callback) {
        this.syncListeners.push(callback);
    }

    notifySyncListeners(result) {
        this.syncListeners.forEach(callback => {
            try {
                callback(result);
            } catch (error) {
                console.error('Error in sync listener:', error);
            }
        });
    }

    getSyncAnalytics() {
        return {
            performance: this.performanceMetrics,
            currentStrategy: this.currentStrategy,
            networkInfo: this.networkInfo,
            recentSyncs: this.syncHistory.slice(-10),
            successRate: this.performanceMetrics.totalSyncs > 0 ? 
                (this.performanceMetrics.successfulSyncs / this.performanceMetrics.totalSyncs * 100).toFixed(1) + '%' : '0%'
        };
    }

    createBatches(array, batchSize) {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    // === IMPLEMENTASI LENGKAP DARI METHOD-METHOD YANG ADA DI KODE LAMA ===

    async syncChatMessages(strategy) {
        if (!window.dtLogger?.chatRef) {
            console.log('💬 Chat not initialized, skipping chat sync');
            return;
        }

        try {
            const unsyncedMessages = window.dtLogger.chatMessages.filter(msg => !msg.synced);
            if (unsyncedMessages.length === 0) {
                console.log('✅ No chat messages to sync');
                return;
            }

            console.log(`💬 Syncing ${unsyncedMessages.length} chat messages...`);
            
            for (const message of unsyncedMessages) {
                await window.dtLogger.chatRef.push().set({
                    ...message,
                    synced: true,
                    syncedAt: new Date().toISOString()
                });
                
                message.synced = true;
                message.syncedAt = new Date().toISOString();
            }
            
            console.log('✅ Chat messages synced successfully');
            
        } catch (error) {
            console.error('❌ Chat sync failed:', error);
            throw error;
        }
    }

    async syncSystemState(strategy) {
        try {
            const systemState = window.dtLogger.getSystemState();
            if (!systemState) {
                console.log('💾 No system state to sync');
                return;
            }

            console.log('💾 Syncing system state...');
            
            const systemRef = database.ref('/system/' + window.dtLogger.driverData.unit);
            await systemRef.set({
                ...systemState,
                lastSync: new Date().toISOString(),
                syncStrategy: strategy.name
            });
            
            console.log('✅ System state synced successfully');
            
        } catch (error) {
            console.error('❌ System state sync failed:', error);
            throw error;
        }
    }

    async syncAnalyticsData(strategy) {
        try {
            const analyticsData = window.dtLogger.getAnalyticsData();
            if (!analyticsData || Object.keys(analyticsData).length === 0) {
                console.log('📊 No analytics data to sync');
                return;
            }

            console.log('📊 Syncing analytics data...');
            
            const analyticsRef = database.ref('/analytics/' + window.dtLogger.driverData.unit);
            await analyticsRef.set({
                ...analyticsData,
                syncedAt: new Date().toISOString(),
                syncStrategy: strategy.name
            });
            
            console.log('✅ Analytics data synced successfully');
            
        } catch (error) {
            console.error('❌ Analytics sync failed:', error);
            // Don't throw error for analytics - it's non-critical
        }
    }

    async uploadBatch(batch, batchIndex, strategy) {
        const batchId = `batch_${Date.now()}_${batchIndex}`;
        const batchRef = database.ref(`/waypoints/${window.dtLogger?.driverData?.unit}/batches/${batchId}`);
        
        const batchData = {
            batchId: batchId,
            unit: window.dtLogger?.driverData?.unit,
            sessionId: window.dtLogger?.driverData?.sessionId,
            driver: window.dtLogger?.driverData?.name,
            waypoints: batch,
            uploadedAt: new Date().toISOString(),
            batchSize: batch.length,
            batchIndex: batchIndex,
            syncStrategy: strategy.name
        };

        await batchRef.set(batchData);
        console.log(`✅ Batch ${batchIndex} uploaded successfully (${batch.length} waypoints)`);
    }

    async uploadCompressedWaypoints(compressed, strategy) {
        const batchId = `compressed_${Date.now()}`;
        const batchRef = database.ref(`/waypoints/${window.dtLogger?.driverData?.unit}/compressed/${batchId}`);
        
        const batchData = {
            batchId: batchId,
            unit: window.dtLogger?.driverData?.unit,
            sessionId: window.dtLogger?.driverData?.sessionId,
            driver: window.dtLogger?.driverData?.name,
            compressedWaypoints: compressed,
            originalCount: compressed.length,
            uploadedAt: new Date().toISOString(),
            compressionRatio: 'high',
            syncStrategy: strategy.name
        };

        await batchRef.set(batchData);
        console.log(`✅ Compressed batch uploaded successfully (${compressed.length} waypoints)`);
    }

    forceSync() {
        console.log('🚀 Manual force sync triggered');
        this.triggerSmartSync();
    }

    getSyncStatus() {
        return {
            isOnline: navigator.onLine,
            currentStrategy: this.currentStrategy,
            networkInfo: this.networkInfo,
            performance: this.performanceMetrics,
            lastSync: this.syncHistory.length > 0 ? this.syncHistory[this.syncHistory.length - 1] : null
        };
    }

    resetStats() {
        this.performanceMetrics = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            totalDataSent: 0,
            averageSyncTime: 0
        };
        this.syncHistory = [];
        console.log('🔄 Sync statistics reset');
    }
}

// ===== CIRCULAR BUFFER FOR WAYPOINT MANAGEMENT =====
class CircularBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.head = 0;
        this.tail = 0;
        this._count = 0;
        this.isFull = false;
        this.overflowCount = 0;
    }

    push(item) {
        if (!item || typeof item !== 'object') {
            console.warn('❌ Invalid item pushed to CircularBuffer');
            return;
        }

        // Add metadata to the waypoint
        const enhancedItem = {
            ...item,
            bufferIndex: this.tail,
            timestamp: item.timestamp || new Date().toISOString(),
            processedAt: new Date().toISOString()
        };

        this.buffer[this.tail] = enhancedItem;
        this.tail = (this.tail + 1) % this.capacity;
        
        if (this.isFull) {
            this.head = (this.head + 1) % this.capacity;
            this.overflowCount++;
        } else {
            this._count++;
            if (this._count === this.capacity) {
                this.isFull = true;
            }
        }
    }

    getAll() {
        if (this._count === 0) return [];
        
        const result = [];
        if (this.isFull) {
            for (let i = 0; i < this.capacity; i++) {
                const index = (this.head + i) % this.capacity;
                result.push(this.buffer[index]);
            }
        } else {
            for (let i = 0; i < this._count; i++) {
                result.push(this.buffer[i]);
            }
        }
        return result;
    }

    getRecent(count) {
        const all = this.getAll();
        return all.slice(-count);
    }

    getUnsynced() {
        return this.getAll().filter(wp => !wp.synced);
    }

    getSynced() {
        return this.getAll().filter(wp => wp.synced);
    }

    markAsSynced(waypointIds) {
        let markedCount = 0;
        for (let i = 0; i < this.capacity; i++) {
            const waypoint = this.buffer[i];
            if (waypoint && waypointIds.includes(waypoint.id)) {
                waypoint.synced = true;
                waypoint.syncedAt = new Date().toISOString();
                markedCount++;
            }
        }
        return markedCount;
    }

    clear() {
        this.head = 0;
        this.tail = 0;
        this._count = 0;
        this.isFull = false;
        this.buffer = new Array(this.capacity);
        this.overflowCount = 0;
        console.log('🔄 CircularBuffer cleared');
    }

    get count() {
        return this.isFull ? this.capacity : this._count;
    }

    get capacityUsed() {
        return this.isFull ? 100 : (this._count / this.capacity) * 100;
    }

    getStats() {
        return {
            count: this.count,
            capacity: this.capacity,
            capacityUsed: this.capacityUsed.toFixed(1) + '%',
            isFull: this.isFull,
            overflowCount: this.overflowCount,
            unsyncedCount: this.getUnsynced().length,
            syncedCount: this.getSynced().length
        };
    }

    findWaypoint(predicate) {
        return this.getAll().find(predicate);
    }

    filterWaypoints(predicate) {
        return this.getAll().filter(predicate);
    }
}

// ===== FIREBASE CLEANUP MANAGER =====
class FirebaseCleanupManager {
    constructor(database) {
        this.database = database;
        this.cleanupQueue = [];
        this.isCleaning = false;
        this.cleanupHistory = [];
        this.maxHistorySize = 50;
    }

    async scheduleCleanup(unitId, sessionId, reason = 'manual') {
        const cleanupTask = { 
            unitId, 
            sessionId, 
            reason,
            timestamp: new Date(),
            status: 'scheduled',
            attempts: 0
        };
        
        this.cleanupQueue.push(cleanupTask);
        this.addToHistory(cleanupTask);
        
        console.log(`🗑️ Cleanup scheduled for unit: ${unitId}, reason: ${reason}`);
        
        // Process immediately if online
        if (navigator.onLine) {
            await this.processCleanup();
        } else {
            console.log('📴 Offline - cleanup queued for when online');
        }
        
        return cleanupTask;
    }

    async processCleanup() {
        if (this.isCleaning || this.cleanupQueue.length === 0) {
            return;
        }

        this.isCleaning = true;
        console.log(`🧹 Processing ${this.cleanupQueue.length} cleanup tasks...`);

        const successfulCleanups = [];
        const failedCleanups = [];

        for (const task of this.cleanupQueue) {
            try {
                task.attempts++;
                task.startedAt = new Date();
                task.status = 'processing';
                
                await this.executeCleanup(task);
                
                task.status = 'completed';
                task.completedAt = new Date();
                successfulCleanups.push(task);
                
                console.log(`✅ Cleanup completed for unit: ${task.unitId}`);
                
            } catch (error) {
                console.error(`❌ Cleanup failed for unit ${task.unitId}:`, error);
                
                task.status = 'failed';
                task.error = error.message;
                task.lastAttempt = new Date();
                
                if (task.attempts < 3) {
                    failedCleanups.push(task); // Retry later
                } else {
                    task.status = 'max_attempts_reached';
                    console.error(`🚨 Max cleanup attempts reached for unit: ${task.unitId}`);
                }
            }
        }

        this.cleanupQueue = failedCleanups;
        this.isCleaning = false;

        if (successfulCleanups.length > 0) {
            console.log(`🎉 ${successfulCleanups.length} cleanup tasks completed successfully`);
            
            // Update history
            successfulCleanups.forEach(task => {
                this.updateHistory(task);
            });
        }

        if (failedCleanups.length > 0) {
            console.warn(`⚠️ ${failedCleanups.length} cleanup tasks failed, will retry later`);
            
            // Schedule retry after 30 seconds
            setTimeout(() => {
                this.processCleanup();
            }, 30000);
        }
    }

    async executeCleanup(task) {
        const { unitId, sessionId } = task;
        
        console.log(`🔥 Starting cleanup for unit: ${unitId}`);
        
        // Cleanup all related data paths
        const cleanupPromises = [
            this.database.ref('/units/' + unitId).remove(),
            this.database.ref('/waypoints/' + unitId).remove(),
            this.database.ref('/sessions/' + sessionId).remove(),
            this.database.ref('/chat/' + unitId).remove(),
            this.database.ref('/drivers/' + unitId).remove(),
            this.database.ref('/realtime/' + unitId).remove()
        ];

        // Execute all cleanup operations
        await Promise.all(cleanupPromises);
        
        console.log(`🔥 Cleanup completed for unit: ${unitId}`);
    }

    addToHistory(task) {
        this.cleanupHistory.unshift(task);
        
        // Keep history size manageable
        if (this.cleanupHistory.length > this.maxHistorySize) {
            this.cleanupHistory = this.cleanupHistory.slice(0, this.maxHistorySize);
        }
    }

    updateHistory(updatedTask) {
        const index = this.cleanupHistory.findIndex(t => 
            t.unitId === updatedTask.unitId && t.timestamp === updatedTask.timestamp
        );
        
        if (index !== -1) {
            this.cleanupHistory[index] = updatedTask;
        }
    }

    getQueueSize() {
        return this.cleanupQueue.length;
    }

    getQueueStatus() {
        return {
            queueSize: this.cleanupQueue.length,
            isProcessing: this.isCleaning,
            recentHistory: this.cleanupHistory.slice(0, 10),
            successRate: this.calculateSuccessRate()
        };
    }

    calculateSuccessRate() {
        const completed = this.cleanupHistory.filter(t => t.status === 'completed').length;
        const total = this.cleanupHistory.length;
        
        return total > 0 ? (completed / total * 100).toFixed(1) + '%' : '0%';
    }

    clearHistory() {
        this.cleanupHistory = [];
        console.log('🧹 Cleanup history cleared');
    }
}

// ===== OFFLINE QUEUE MANAGER =====
class OfflineQueueManager {
    constructor() {
        this.queue = [];
        this.isOnline = navigator.onLine;
        this.maxQueueSize = Infinity;
        this.autoCompressThreshold = Infinity;
        this.processCallbacks = [];
        this.stats = {
            totalQueued: 0,
            totalProcessed: 0,
            totalFailed: 0,
            lastProcessed: null
        };
    }

    addToQueue(gpsData) {
        const queueItem = {
            ...gpsData,
            queueId: 'queue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            queueTimestamp: new Date().toISOString(),
            attempts: 0,
            status: 'queued',
            priority: priority
        };

        if (priority === 'high') {
            this.highPriorityQueue.push(queueItem);
        } else {
            this.lowPriorityQueue.push(queueItem);
        }

        this.stats.totalQueued++;
        
        // 🚀 UBAH: Management berdasarkan storage health, bukan queue size
        this.manageQueueByStorageHealth();
        
        console.log(`💾 Added ${priority} item. High: ${this.highPriorityQueue.length}, Low: ${this.lowPriorityQueue.length}, Total: ${this.getTotalQueueSize()}`);
        
        return queueItem.queueId;
    }
    manageQueueByStorageHealth() {
        // Check storage health instead of queue size
        this.checkStorageHealth().then(health => {
            if (health.usagePercentage >= this.storageHealthThreshold * 100) {
                console.log('📦 Storage nearing limit, compressing low priority data...');
                this.compressLowPriorityData();
            }
            
            if (health.health === 'critical') {
                console.warn('🚨 Critical storage health, emergency compression...');
                this.emergencyCompression();
            }
        });
    }

    // 🚀 METHOD BARU: Check storage health
    async checkStorageHealth() {
        try {
            // Estimate storage usage
            const totalItems = this.getTotalQueueSize();
            const estimatedUsage = (totalItems * 500) / (5 * 1024 * 1024); // 500 bytes per item, 5MB limit
            
            return {
                totalItems: totalItems,
                estimatedUsageMB: (totalItems * 500 / 1024 / 1024).toFixed(2),
                usagePercentage: (estimatedUsage * 100).toFixed(1),
                health: estimatedUsage > 0.9 ? 'critical' : estimatedUsage > 0.7 ? 'warning' : 'healthy'
            };
        } catch (error) {
            return { health: 'unknown', error: error.message };
        }
    }

    getTotalQueueSize() {
        return this.highPriorityQueue.length + this.lowPriorityQueue.length;
    }

    // 🚀 MODIFIKASI: Compression berdasarkan kebutuhan, bukan threshold tetap
    compressLowPriorityData() {
        if (this.lowPriorityQueue.length < 1000) return;
        
        // Smart compression: keep data based on importance
        const compressed = [];
        let keepInterval = 1;
        
        // Semakin banyak data, semakin agresif kompresi
        if (this.lowPriorityQueue.length > 10000) keepInterval = 3;
        if (this.lowPriorityQueue.length > 50000) keepInterval = 5;
        
        for (let i = 0; i < this.lowPriorityQueue.length; i += keepInterval) {
            compressed.push(this.lowPriorityQueue[i]);
        }
        
        const originalSize = this.lowPriorityQueue.length;
        this.lowPriorityQueue = compressed;
        console.log(`📦 Compressed low priority: ${originalSize} → ${compressed.length} (ratio: ${keepInterval}x)`);
    }

    // 🚀 MODIFIKASI: Emergency compression hanya untuk low priority
    emergencyCompression() {
        const originalHighSize = this.highPriorityQueue.length;
        const originalLowSize = this.lowPriorityQueue.length;
        
        // High priority data TIDAK PERNAH dikompres/dihapus
        // Hanya kompres low priority data secara agresif
        
        if (this.lowPriorityQueue.length > 1000) {
            const compressed = [];
            for (let i = 0; i < this.lowPriorityQueue.length; i += 10) { // Keep 10% data
                compressed.push(this.lowPriorityQueue[i]);
            }
            this.lowPriorityQueue = compressed;
        }
        
        console.log(`🚨 Emergency compression. High: ${originalHighSize}→${this.highPriorityQueue.length}, Low: ${originalLowSize}→${this.lowPriorityQueue.length}`);
    }

    getQueueStats() {
        const totalSize = this.getTotalQueueSize();
        const health = this.checkStorageHealth();
        
        return {
            ...this.stats,
            currentQueueSize: totalSize,
            highPriorityCount: this.highPriorityQueue.length,
            lowPriorityCount: this.lowPriorityQueue.length,
            storageHealth: health,
            queueHealth: totalSize > 100000 ? 'high' : totalSize > 50000 ? 'medium' : 'low',
            oldestItem: this.highPriorityQueue.length > 0 ? this.highPriorityQueue[0].queueTimestamp : 
                       this.lowPriorityQueue.length > 0 ? this.lowPriorityQueue[0].queueTimestamp : null
        };
    }

    addToQueueWithPriority(gpsData, priority = 'normal') {
        const queueItem = {
            ...gpsData,
            queueId: 'queue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            queueTimestamp: new Date().toISOString(),
            attempts: 0,
            status: 'queued',
            priority: priority
        };

        if (priority === 'high') {
            this.queue.unshift(queueItem); // Add to front
        } else {
            this.queue.push(queueItem); // Add to end
        }

        this.stats.totalQueued++;
        console.log(`💾 Added ${priority} priority item to queue. Total: ${this.queue.length}`);
        
        return queueItem.queueId;
    }

    getQueueSize() {
        return this.queue.length;
    }

    getQueueStats() {
        return {
            ...this.stats,
            currentQueueSize: this.queue.length,
            queueHealth: this.getQueueHealth(),
            oldestItem: this.queue.length > 0 ? this.queue[0].queueTimestamp : null,
            newestItem: this.queue.length > 0 ? this.queue[this.queue.length - 1].queueTimestamp : null
        };
    }

    getQueueHealth() {
        const usage = (this.queue.length / this.maxQueueSize) * 100;
        if (usage >= 90) return 'critical';
        if (usage >= 70) return 'warning';
        if (usage >= 50) return 'normal';
        return 'healthy';
    }

    async processQueue() {
        if (this.queue.length === 0 || !this.isOnline) {
            return;
        }

        console.log(`🔄 Processing offline queue: ${this.queue.length} items...`);
        
        const successItems = [];
        const failedItems = [];
        const processingBatch = this.queue.splice(0, 50); // Process in batches of 50

        for (const item of processingBatch) {
            try {
                item.attempts++;
                item.status = 'processing';
                item.lastAttempt = new Date().toISOString();
                
                await this.sendQueuedData(item);
                
                item.status = 'sent';
                item.sentAt = new Date().toISOString();
                successItems.push(item);
                
                this.stats.totalProcessed++;
                
            } catch (error) {
                console.error('❌ Failed to send queued data:', error);
                
                item.status = 'failed';
                item.error = error.message;
                item.lastError = new Date().toISOString();
                
                if (item.attempts < 3) {
                    failedItems.push(item); // Retry later
                } else {
                    this.stats.totalFailed++;
                    console.error(`🚨 Max attempts reached for queue item: ${item.queueId}`);
                }
            }
        }

        // Add failed items back to the front of the queue for retry
        if (failedItems.length > 0) {
            this.queue.unshift(...failedItems);
        }

        this.stats.lastProcessed = new Date().toISOString();
        
        console.log(`✅ Queue processing: ${successItems.length} sent, ${failedItems.length} failed, ${this.queue.length} remaining`);

        // Notify callbacks
        this.notifyCallbacks({
            sent: successItems.length,
            failed: failedItems.length,
            remaining: this.queue.length,
            batchSize: processingBatch.length
        });

        // Continue processing if queue is not empty
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    async sendQueuedData(queuedData) {
        if (!window.dtLogger?.firebaseRef) {
            throw new Error('No Firebase reference available');
        }

        // Extract queue metadata and send clean data
        const { queueId, queueTimestamp, attempts, status, priority, ...cleanData } = queuedData;
        
        // Add offline data marker
        cleanData.isOfflineData = true;
        cleanData.originalTimestamp = cleanData.timestamp;
        cleanData.processedTimestamp = new Date().toISOString();
        cleanData.offlineQueueId = queueId;
        
        await window.dtLogger.firebaseRef.set(cleanData);
    }

    addProcessCallback(callback) {
        this.processCallbacks.push(callback);
    }

    notifyCallbacks(results) {
        this.processCallbacks.forEach(callback => {
            try {
                callback(results);
            } catch (error) {
                console.error('Error in queue process callback:', error);
            }
        });
    }

    clearQueue() {
        const clearedCount = this.queue.length;
        this.queue = [];
        console.log(`🧹 Offline queue cleared: ${clearedCount} items removed`);
        return clearedCount;
    }

    getQueueItems() {
        return [...this.queue];
    }

    removeQueueItem(queueId) {
        const initialLength = this.queue.length;
        this.queue = this.queue.filter(item => item.queueId !== queueId);
        const removedCount = initialLength - this.queue.length;
        
        if (removedCount > 0) {
            console.log(`🗑️ Removed ${removedCount} item(s) from queue`);
        }
        
        return removedCount;
    }

    updateOnlineStatus(online) {
        this.isOnline = online;
        
        if (online && this.queue.length > 0) {
            console.log('🌐 Online - starting queue processing');
            setTimeout(() => this.processQueue(), 2000);
        }
    }
}

// ===== RESUME MANAGER FOR BACKGROUND/OFFLINE RECOVERY =====
class ResumeManager {
    constructor(gpsLogger) {
        this.gpsLogger = gpsLogger; 
        this.lastActiveTime = Date.now();
        this.wasInBackground = false;
        this.resumeCallbacks = [];
        this.backgroundStartTime = null;
        // Hapus batasan waktu 5 menit
        this.recoveryStats = {
            totalResumes: 0,
            backgroundResumes: 0,
            networkResumes: 0,
            crashRecoveries: 0,
            lastResume: null
        };
        
        this.setupVisibilityHandlers();
        this.setupNetworkHandlers();
        this.setupUnloadHandlers();
        
        console.log('🔄 Resume Manager initialized');
    }

    setupVisibilityHandlers() {
        // Page Visibility API for background/foreground detection
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleBackground();
            } else {
                this.handleForeground();
            }
        });

        // Window focus/blur as backup
        window.addEventListener('focus', () => {
            if (this.wasInBackground) {
                this.handleForeground();
            }
        });

        window.addEventListener('blur', () => {
            this.handleBackground();
        });

        // Page show/hide events
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                console.log('🔄 Page restored from back/forward cache');
                this.handleForeground();
            }
        });

        window.addEventListener('pagehide', () => {
            this.handleBackground();
        });
    }

    setupNetworkHandlers() {
        // Network status monitoring
        window.addEventListener('online', () => {
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.handleOffline();
        });
    }

    setupUnloadHandlers() {
        // Save state before unload
        window.addEventListener('beforeunload', (event) => {
            this.handleBeforeUnload(event);
        });

        // Page freeze (when page is put in back/forward cache)
        document.addEventListener('freeze', () => {
            this.handleFreeze();
        });

        // Page resume (when page is restored from back/forward cache)
        document.addEventListener('resume', () => {
            this.handleResume();
        });

        // Error handling for crash recovery
        window.addEventListener('error', (event) => {
            this.handleError(event);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handlePromiseRejection(event);
        });
    }

    handleBackground() {
        console.log('📱 App entering background');
        this.wasInBackground = true;
        this.backgroundStartTime = Date.now();
        this.lastActiveTime = Date.now();
        
        // Save comprehensive state before backgrounding
        this.gpsLogger.saveSystemState();
        
        // Reduce GPS accuracy to save battery
        if (this.gpsLogger.isTracking) {
            this.gpsLogger.addLog('Aplikasi masuk background - mengurangi frekuensi GPS', 'warning');
        }
    }

    handleForeground() {
        if (!this.wasInBackground) return;
        
        const backgroundTime = Date.now() - (this.backgroundStartTime || Date.now());
        console.log(`📱 App returning to foreground after ${(backgroundTime/1000).toFixed(1)} seconds`);
        
        this.wasInBackground = false;
        this.backgroundStartTime = null;
        this.recoveryStats.backgroundResumes++;
        this.recoveryStats.totalResumes++;
        this.recoveryStats.lastResume = new Date().toISOString();
        
        // Hapus pengecekan batas waktu - selalu lakukan resume normal
        // Tidak peduli berapa lama di background, tetap lakukan resume normal
        this.resumeTracking();
        
        // Restore normal GPS accuracy
        if (this.gpsLogger.isTracking) {
            this.gpsLogger.addLog('Aplikasi kembali ke foreground - memulihkan GPS normal', 'success');
        }
    }

    handleOnline() {
        console.log('🌐 Network connection restored');
        this.gpsLogger.isOnline = true;
        this.gpsLogger.updateConnectionStatus(true);
        this.recoveryStats.networkResumes++;
        this.recoveryStats.totalResumes++;
        
        // Sync all pending data
        setTimeout(() => {
            this.gpsLogger.syncWaypointsToServer();
            this.gpsLogger.offlineQueue.processQueue();
            this.gpsLogger.cleanupManager.processCleanup();
        }, 2000);
        
        this.gpsLogger.addLog('Koneksi internet pulih - sinkronisasi data', 'success');
    }

    handleOffline() {
        console.log('🌐 Network connection lost');
        this.gpsLogger.isOnline = false;
        this.gpsLogger.updateConnectionStatus(false);
        this.gpsLogger.addLog('Koneksi internet terputus - menyimpan data lokal', 'warning');
    }

    handleBeforeUnload(event) {
        console.log('📦 Saving state before unload');
        
        // Save comprehensive state
        this.gpsLogger.saveSystemState();
        
        // If journey is active, show confirmation
        if (this.gpsLogger.journeyStatus === 'started') {
            event.preventDefault();
            event.returnValue = 'Perjalanan masih aktif. Yakin ingin meninggalkan halaman?';
            return event.returnValue;
        }
    }

    handleFreeze() {
        console.log('❄️ Page frozen (entering back/forward cache)');
        this.gpsLogger.saveSystemState();
    }

    handleResume() {
        console.log('🔥 Page resumed (from back/forward cache)');
        this.recoveryStats.totalResumes++;
        this.resumeTracking();
    }

    handleError(event) {
        console.error('🚨 Global error detected:', event.error);
        this.gpsLogger.saveSystemState(); // Emergency save
    }

    handlePromiseRejection(event) {
        console.error('🚨 Unhandled promise rejection:', event.reason);
        this.gpsLogger.saveSystemState(); // Emergency save
    }

    resumeTracking() {
        console.log('🔄 Initiating tracking resume...');
        
        // Reset all GPS processing components
        this.gpsLogger.gpsProcessor.reset();
        this.gpsLogger.speedCalculator.reset();
        
        // Restart GPS tracking if it was active
        if (this.gpsLogger.driverData && this.gpsLogger.journeyStatus === 'started') {
            this.gpsLogger.stopRealGPSTracking();
            
            setTimeout(() => {
                this.gpsLogger.startRealGPSTracking();
                this.gpsLogger.addLog('GPS tracking di-resume setelah interruption', 'success');
            }, 1000);
        }

        // Force update all displays
        this.gpsLogger.updateAllDisplays();
        
        // Reset recovery attempts
        this.gpsLogger.recoveryAttempts = 0;
        
        // Execute all registered resume callbacks
        this.executeResumeCallbacks();
        
        console.log('✅ Tracking resume completed');
    }

    performFullRecovery() {
        console.log('🔄 Performing full system recovery...');
        
        // Comprehensive system reset
        this.gpsLogger.gpsProcessor.reset();
        this.gpsLogger.speedCalculator.reset();
        this.gpsLogger.kalmanFilter.reset();
        
        // Reload system state
        this.gpsLogger.loadSystemState();
        
        // Restart all tracking
        if (this.gpsLogger.driverData && this.gpsLogger.journeyStatus === 'started') {
            setTimeout(() => {
                this.gpsLogger.startRealGPSTracking();
                this.gpsLogger.startDataTransmission();
                this.gpsLogger.addLog('Sistem fully recovered setelah interruption panjang', 'success');
            }, 2000);
        }
        
        this.gpsLogger.updateAllDisplays();
    }

    addResumeCallback(callback) {
        this.resumeCallbacks.push(callback);
        console.log(`✅ Resume callback registered. Total: ${this.resumeCallbacks.length}`);
    }

    executeResumeCallbacks() {
        console.log(`🔄 Executing ${this.resumeCallbacks.length} resume callbacks...`);
        
        this.resumeCallbacks.forEach((callback, index) => {
            try {
                callback();
            } catch (error) {
                console.error(`❌ Resume callback ${index} failed:`, error);
            }
        });
    }

    getTimeSinceLastActive() {
        return Date.now() - this.lastActiveTime;
    }

    getRecoveryStats() {
        return {
            ...this.recoveryStats,
            timeSinceLastActive: this.getTimeSinceLastActive(),
            isInBackground: this.wasInBackground,
            backgroundTime: this.backgroundStartTime ? Date.now() - this.backgroundStartTime : 0
        };
    }

    forceResume() {
        console.log('🔄 Manual resume triggered');
        this.resumeTracking();
    }

    simulateBackground(timeMs = 10000) {
        console.log(`🧪 Simulating background for ${timeMs}ms...`);
        this.handleBackground();
        
        setTimeout(() => {
            this.handleForeground();
        }, timeMs);
    }
}

// ===== ENHANCED LOGOUT MANAGER =====
class LogoutManager {
    constructor(gpsLogger) {
        this.gpsLogger = gpsLogger;
        this.isLoggingOut = false;
        this.pendingOperations = 0;
        this.logoutCallbacks = [];
    }

    async performLogout() {
        if (this.isLoggingOut) {
            console.warn('⚠️ Logout already in progress');
            return;
        }

        this.isLoggingOut = true;
        console.log('🚪 Starting controlled logout process...');

        try {
            // Step 1: Notify semua components
            this.notifyLogoutStart();

            // Step 2: Stop semua active operations
            await this.stopAllOperations();

            // Step 3: Save semua pending data
            await this.saveAllPendingData();

            // Step 4: Cleanup resources
            await this.cleanupResources();

            // Step 5: Reset state
            await this.resetSystemState();

            // Step 6: Notify completion
            this.notifyLogoutComplete();

            console.log('✅ Logout completed successfully');
            
        } catch (error) {
            console.error('❌ Logout failed:', error);
            this.handleLogoutError(error);
        } finally {
            this.isLoggingOut = false;
        }
    }

    async stopAllOperations() {
        console.log('🛑 Stopping all operations...');
        
        const stopPromises = [];

        // 1. Stop GPS tracking
        if (this.gpsLogger.isTracking) {
            stopPromises.push(this.stopGPSTracking());
        }

        // 2. Stop data transmission
        if (this.gpsLogger.sendInterval || this.gpsLogger.syncInterval) {
            stopPromises.push(this.stopDataTransmission());
        }

        // 3. Stop unlimited operations
        if (this.gpsLogger.unlimitedManager) {
            stopPromises.push(this.stopUnlimitedOperations());
        }

        // 4. Stop background processors
        if (this.gpsLogger.gpsProcessor) {
            stopPromises.push(this.stopBackgroundProcessors());
        }

        await Promise.allSettled(stopPromises);
        console.log('✅ All operations stopped');
    }

    stopGPSTracking() {
        return new Promise((resolve) => {
            console.log('📍 Stopping GPS tracking...');
            
            if (this.gpsLogger.watchId) {
                navigator.geolocation.clearWatch(this.gpsLogger.watchId);
                this.gpsLogger.watchId = null;
            }
            
            this.gpsLogger.isTracking = false;
            resolve();
        });
    }

    stopDataTransmission() {
        return new Promise((resolve) => {
            console.log('📡 Stopping data transmission...');
            
            if (this.gpsLogger.sendInterval) {
                clearInterval(this.gpsLogger.sendInterval);
                this.gpsLogger.sendInterval = null;
            }
            
            if (this.gpsLogger.syncInterval) {
                clearInterval(this.gpsLogger.syncInterval);
                this.gpsLogger.syncInterval = null;
            }
            
            resolve();
        });
    }

    stopUnlimitedOperations() {
        return new Promise((resolve) => {
            console.log('♾️ Stopping unlimited operations...');
            
            const manager = this.gpsLogger.unlimitedManager;
            if (manager) {
                // Clear semua timeouts dan intervals
                clearTimeout(manager.backgroundProcessor);
                clearTimeout(manager.memoryManager);
                clearTimeout(manager.autoRecovery);
                clearTimeout(manager.dataArchiver);
                
                // Hentikan performance monitoring
                clearTimeout(manager.performanceMonitor);
            }
            
            resolve();
        });
    }

    stopBackgroundProcessors() {
        return new Promise((resolve) => {
            console.log('🔄 Stopping background processors...');
            
            const processor = this.gpsLogger.gpsProcessor;
            if (processor) {
                clearTimeout(processor.backgroundProcessor);
                clearTimeout(processor.stuckDetector);
                
                // Clear processing queue
                processor.positionQueue = [];
            }
            
            resolve();
        });
    }

    async saveAllPendingData() {
        console.log('💾 Saving all pending data...');
        
        const savePromises = [];

        // 1. Save system state
        savePromises.push(this.saveSystemState());

        // 2. Sync remaining waypoints jika online
        if (this.gpsLogger.isOnline && this.gpsLogger.unsyncedWaypoints.size > 0) {
            savePromises.push(this.syncRemainingWaypoints());
        }

        // 3. Process offline queue
        if (this.gpsLogger.offlineQueue.getQueueSize() > 0) {
            savePromises.push(this.processOfflineQueue());
        }

        // 4. Save storage metadata
        savePromises.push(this.saveStorageMetadata());

        await Promise.allSettled(savePromises);
        console.log('✅ All data saved');
    }

    saveSystemState() {
        return new Promise((resolve) => {
            try {
                this.gpsLogger.saveSystemState();
                console.log('✅ System state saved');
                resolve();
            } catch (error) {
                console.error('❌ Failed to save system state:', error);
                resolve(); // Continue logout anyway
            }
        });
    }

    syncRemainingWaypoints() {
        return new Promise(async (resolve) => {
            try {
                console.log(`📡 Syncing ${this.gpsLogger.unsyncedWaypoints.size} remaining waypoints...`);
                
                await this.gpsLogger.syncWaypointsToServer();
                console.log('✅ Remaining waypoints synced');
                resolve();
            } catch (error) {
                console.error('❌ Failed to sync remaining waypoints:', error);
                resolve(); // Continue logout anyway
            }
        });
    }

    processOfflineQueue() {
        return new Promise(async (resolve) => {
            try {
                const queueSize = this.gpsLogger.offlineQueue.getQueueSize();
                console.log(`📦 Processing ${queueSize} offline queue items...`);
                
                await this.gpsLogger.offlineQueue.processQueue();
                console.log('✅ Offline queue processed');
                resolve();
            } catch (error) {
                console.error('❌ Failed to process offline queue:', error);
                resolve(); // Continue logout anyway
            }
        });
    }

    saveStorageMetadata() {
        return new Promise((resolve) => {
            try {
                const storageManager = this.gpsLogger.storageManager;
                if (storageManager) {
                    const metadata = storageManager.getStorageMetadata();
                    metadata.lastLogout = new Date().toISOString();
                    metadata.sessionEnd = new Date().toISOString();
                    storageManager.updateStorageMetadata(metadata);
                    console.log('✅ Storage metadata updated');
                }
                resolve();
            } catch (error) {
                console.error('❌ Failed to save storage metadata:', error);
                resolve();
            }
        });
    }

    async cleanupResources() {
        console.log('🧹 Cleaning up resources...');
        
        // 1. Clear intervals dan timeouts global
        this.clearGlobalIntervals();
        
        // 2. Cleanup Firebase references
        this.cleanupFirebase();
        
        // 3. Release memory
        this.releaseMemory();
        
        console.log('✅ Resources cleaned up');
    }

    clearGlobalIntervals() {
        // Clear interval yang mungkin terlewat
        const intervals = [
            this.gpsLogger.healthCheckInterval,
            this.gpsLogger.unlimitedHealthMonitor,
            this.gpsLogger.persistentStateSaver
        ];
        
        intervals.forEach(interval => {
            if (interval) clearInterval(interval);
        });
    }

    cleanupFirebase() {
        if (this.gpsLogger.firebaseRef) {
            // Off Firebase listeners
            this.gpsLogger.firebaseRef.off();
            this.gpsLogger.firebaseRef = null;
        }
        
        if (this.gpsLogger.chatRef) {
            this.gpsLogger.chatRef.off();
            this.gpsLogger.chatRef = null;
        }
    }

    releaseMemory() {
        // Clear large data structures
        this.gpsLogger.speedHistory = [];
        this.gpsLogger.distanceHistory = [];
        this.gpsLogger.accuracyHistory = [];
        this.gpsLogger.chatMessages = [];
        
        // Clear processor histories
        if (this.gpsLogger.gpsProcessor?.distanceCalculator) {
            this.gpsLogger.gpsProcessor.distanceCalculator.distanceHistory = [];
            this.gpsLogger.gpsProcessor.distanceCalculator.speedHistory = [];
        }
        
        // Suggest garbage collection
        if (window.gc) {
            window.gc();
        }
    }

    async resetSystemState() {
        console.log('🔄 Resetting system state...');
        
        // Reset data state (pertahankan configuration)
        this.gpsLogger.driverData = null;
        this.gpsLogger.journeyStatus = 'ready';
        this.gpsLogger.sessionStartTime = null;
        this.gpsLogger.totalDistance = 0;
        this.gpsLogger.dataPoints = 0;
        this.gpsLogger.lastPosition = null;
        this.gpsLogger.currentSpeed = 0;
        
        // Reset collections
        this.gpsLogger.unsyncedWaypoints.clear();
        this.gpsLogger.waypointBuffer.clear();
        
        // Reset processors (tapi pertahankan configuration)
        this.gpsLogger.gpsProcessor?.reset();
        this.gpsLogger.distanceCalculator?.reset();
        
        // Reset health metrics (tapi pertahankan historical data)
        this.gpsLogger.healthMetrics = {
            ...this.gpsLogger.healthMetrics,
            gpsUpdates: 0,
            waypointSaves: 0,
            firebaseSends: 0,
            errors: 0,
            recoveryAttempts: 0,
            startTime: new Date(),
            lastHealthCheck: new Date()
        };
        
        // Reset UI state
        this.gpsLogger.isChatOpen = false;
        this.gpsLogger.unreadCount = 0;
        
        console.log('✅ System state reset');
    }

    notifyLogoutStart() {
        console.log('📢 Notifying components about logout...');
        this.logoutCallbacks.forEach(callback => {
            try {
                callback('start');
            } catch (error) {
                console.error('Error in logout callback:', error);
            }
        });
    }

    notifyLogoutComplete() {
        console.log('📢 Notifying logout completion...');
        this.logoutCallbacks.forEach(callback => {
            try {
                callback('complete');
            } catch (error) {
                console.error('Error in logout callback:', error);
            }
        });
        
        // Update UI
        this.showLoginScreen();
        this.gpsLogger.addLog('Logout completed successfully', 'success');
    }

    handleLogoutError(error) {
        console.error('❌ Logout error:', error);
        this.gpsLogger.addLog(`Logout error: ${error.message}`, 'error');
        
        // Force cleanup bahkan jika error
        try {
            this.forceEmergencyCleanup();
            this.showLoginScreen();
        } catch (cleanupError) {
            console.error('❌ Emergency cleanup failed:', cleanupError);
        }
    }

    forceEmergencyCleanup() {
        console.warn('🚨 Performing emergency cleanup...');
        
        // Force stop semua intervals
        const highestIntervalId = setInterval(() => {}, 0);
        for (let i = 0; i < highestIntervalId; i++) {
            clearInterval(i);
        }
        
        // Force clear timeouts
        const highestTimeoutId = setTimeout(() => {}, 0);
        for (let i = 0; i < highestTimeoutId; i++) {
            clearTimeout(i);
        }
        
        // Clear GPS tracking
        if (this.gpsLogger.watchId) {
            navigator.geolocation.clearWatch(this.gpsLogger.watchId);
            this.gpsLogger.watchId = null;
        }
        
        console.log('✅ Emergency cleanup completed');
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainInterface').classList.add('hidden');
        
        // Reset UI displays
        this.gpsLogger.updateAllDisplays();
    }

    addLogoutCallback(callback) {
        this.logoutCallbacks.push(callback);
    }

    getLogoutStatus() {
        return {
            isLoggingOut: this.isLoggingOut,
            pendingOperations: this.pendingOperations,
            callbacksRegistered: this.logoutCallbacks.length
        };
    }
}
// ===== MODIFIKASI UNLIMITED GPS LOGGER DENGAN LOGOUT MANAGER =====
class UnlimitedDTGPSLoggerWithLogout extends UnlimitedDTGPSLogger {
    constructor() {
        super();
        this.logoutManager = new LogoutManager(this);
        this.setupLogoutHandlers();
    }

    setupLogoutHandlers() {
        // Setup logout button handler
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.initiateLogout());
        }

        // Add logout callbacks untuk components
        this.logoutManager.addLogoutCallback((phase) => {
            this.handleComponentLogout(phase);
        });

        // Handle browser tab close/window unload
        window.addEventListener('beforeunload', (event) => {
            this.handleBrowserClose(event);
        });
    }

    async initiateLogout() {
        // Konfirmasi logout jika journey aktif
        if (this.journeyStatus === 'started') {
            const confirmLogout = confirm(
                'Perjalanan masih aktif. Yakin ingin logout? ' +
                'Data akan disimpan dan bisa dilanjutkan nanti.'
            );
            
            if (!confirmLogout) {
                return;
            }
        }

        // Show loading state
        this.addLog('Memulai proses logout...', 'info');
        
        // Disable UI selama logout
        this.disableUI();

        try {
            await this.logoutManager.performLogout();
        } catch (error) {
            console.error('Logout failed:', error);
            this.addLog('Logout gagal, coba lagi', 'error');
            this.enableUI();
        }
    }

    handleComponentLogout(phase) {
        console.log(`🔧 Component logout phase: ${phase}`);
        
        switch (phase) {
            case 'start':
                // Components should prepare for logout
                this.prepareComponentsForLogout();
                break;
                
            case 'complete':
                // Components cleanup after logout
                this.cleanupComponentsAfterLogout();
                break;
        }
    }

    prepareComponentsForLogout() {
        // Stop semua real-time updates
        this.stopRealTimeUpdates();
        this.backgroundPoller.setActive(false);
        
        // Disable user interactions
        this.disableUserInteractions();
        
        // Save component states
        this.saveComponentStates();
    }

    cleanupComponentsAfterLogout() {
        // Reset component states
        this.resetComponentStates();
        
        // Clear component data
        this.clearComponentData();
        
        // Enable UI untuk login berikutnya
        this.enableUI();
    }

    handleBrowserClose(event) {
        if (this.journeyStatus === 'started') {
            // Save state sebelum tab ditutup
            this.saveSystemState();
            
            // Konfirmasi untuk hindari accidental close
            event.preventDefault();
            event.returnValue = 
                'Perjalanan masih aktif. Data telah disimpan dan bisa dilanjutkan saat membuka aplikasi kembali.';
            return event.returnValue;
        }
    }

    stopRealTimeUpdates() {
        // Stop semua real-time UI updates
        const updateElements = document.querySelectorAll('[data-real-time-update]');
        updateElements.forEach(element => {
            element.classList.add('update-paused');
        });
    }

    disableUserInteractions() {
        // Disable semua buttons dan form controls
        const interactiveElements = document.querySelectorAll(
            'button, input, select, textarea'
        );
        
        interactiveElements.forEach(element => {
            element.disabled = true;
        });
        
        // Add loading indicator
        this.showLoadingIndicator('Logging out...');
    }

    enableUI() {
        // Enable semua buttons dan form controls
        const interactiveElements = document.querySelectorAll(
            'button, input, select, textarea'
        );
        
        interactiveElements.forEach(element => {
            element.disabled = false;
        });
        
        // Remove loading indicator
        this.hideLoadingIndicator();
    }

    showLoadingIndicator(message) {
        // Create atau show loading indicator
        let loader = document.getElementById('logoutLoader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'logoutLoader';
            loader.className = 'logout-loading';
            loader.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            `;
            document.body.appendChild(loader);
        }
        loader.style.display = 'flex';
    }

    hideLoadingIndicator() {
        const loader = document.getElementById('logoutLoader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    saveComponentStates() {
        // Save state dari berbagai components
        const componentStates = {
            chat: {
                isOpen: this.isChatOpen,
                unreadCount: this.unreadCount
            },
            ui: {
                lastActiveTab: this.getActiveTab(),
                scrollPositions: this.getScrollPositions()
            }
        };
        
        this.storageManager.saveAppSettings({
            componentStates,
            lastLogout: new Date().toISOString()
        });
    }

    resetComponentStates() {
        // Reset semua component states
        this.isChatOpen = false;
        this.unreadCount = 0;
        this.chatMessages = [];
        
        // Reset UI state
        this.resetUIState();
    }

    clearComponentData() {
        // Clear data yang tidak perlu dipertahankan
        this.speedHistory = [];
        this.distanceHistory = [];
        this.accuracyHistory = [];
        this.clearPersistentDistanceState();
        
        // Clear processing buffers
        if (this.gpsProcessor) {
            this.gpsProcessor.positionQueue = [];
        }
    }

    resetUIState() {
        // Reset semua UI elements ke state awal
        const resetElements = document.querySelectorAll('[data-reset-on-logout]');
        resetElements.forEach(element => {
            if (element.type === 'text' || element.type === 'password') {
                element.value = '';
            } else if (element.classList.contains('active')) {
                element.classList.remove('active');
            }
        });
        
        // Reset chat UI
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        
        // Reset logs
        const systemLog = document.getElementById('systemLog');
        if (systemLog) {
            systemLog.innerHTML = '';
        }
    }

    getActiveTab() {
        // Get currently active tab
        const activeTab = document.querySelector('.tab.active');
        return activeTab ? activeTab.id : null;
    }

    getScrollPositions() {
        // Get scroll positions untuk nanti restore
        return {
            main: document.getElementById('mainContent')?.scrollTop || 0,
            chat: document.getElementById('chatMessages')?.scrollTop || 0,
            logs: document.getElementById('systemLog')?.scrollTop || 0
        };
    }

    // Override method logout original
    logout() {
        this.initiateLogout();
    }

    getLogoutStatus() {
        return this.logoutManager.getLogoutStatus();
    }
}

// ===== MODIFIKASI MAIN LOGGER UNTUK UNLIMITED OPERATION =====
class UnlimitedDTGPSLogger extends EnhancedDTGPSLogger {
    constructor() {
        super();
        
        // Replace components dengan unlimited versions
        this.unlimitedManager = new UnlimitedOperationManager();
        this.gpsProcessor = new UnlimitedGPSProcessor();
        this.storageManager = new UnlimitedStorageManager();
        
        this.unlimitedMode = true;
        this.startUnlimitedOperation();
        
        console.log('♾️ UNLIMITED GPS Logger initialized - designed for 24/7 operation');
    }

    startUnlimitedOperation() {
        // Start semua unlimited processes
        this.startInfiniteDataTransmission();
        this.startUnlimitedHealthMonitoring();
        this.startPersistentStateSaving();
    }

    startInfiniteDataTransmission() {
        // Ganti interval-based dengan recursive timeout untuk infinite operation
        const transmitData = () => {
            if (this.isOnline && this.lastPosition) {
                this.sendRealTimeData().catch(error => {
                    console.warn('Data transmission failed, will retry:', error);
                });
            }
            
            // Always schedule next execution
            setTimeout(transmitData, 2000);
        };
        
        const syncWaypoints = () => {
            if (this.isOnline && this.unsyncedWaypoints.size > 0) {
                this.syncWaypointsToServer().catch(error => {
                    console.warn('Sync failed, will retry:', error);
                });
            }
            
            // Always schedule next execution
            setTimeout(syncWaypoints, 30000);
        };
        
        // Start both processes
        transmitData();
        syncWaypoints();
    }

    startUnlimitedHealthMonitoring() {
        const monitorHealth = () => {
            this.checkUnlimitedSystemHealth();
            setTimeout(monitorHealth, 30000); // Check setiap 30 detik
        };
        
        monitorHealth();
    }

    startPersistentStateSaving() {
        const saveState = () => {
            this.saveSystemState();
            setTimeout(saveState, 60000); // Save setiap 1 menit
        };
        
        saveState();
    }

    checkUnlimitedSystemHealth() {
        // Comprehensive health checking untuk unlimited operation
        const now = Date.now();
        
        // Check GPS health
        if (this.isTracking && now - this.healthMetrics.lastHealthCheck > 60000) {
            console.warn('⚠️ GPS may be stuck, attempting recovery...');
            this.recoverGPSTracking();
        }
        
        // Check memory health
        if (this.waypointBuffer.count > 100000) {
            console.warn('⚠️ Large waypoint buffer, performing cleanup...');
            this.cleanupWaypointBuffer();
        }
        
        // Check storage health
        const storageHealth = this.storageManager.checkUnlimitedStorageHealth();
        if (storageHealth.health === 'critical') {
            console.warn('⚠️ Critical storage health, performing cleanup...');
            this.storageManager.emergencyStorageCleanup();
        }
        
        this.healthMetrics.lastHealthCheck = now;
    }

    recoverGPSTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        setTimeout(() => {
            if (this.journeyStatus === 'started') {
                this.startRealGPSTracking();
                console.log('✅ GPS tracking recovered');
            }
        }, 1000);
    }

    cleanupWaypointBuffer() {
        const recent = this.waypointBuffer.getRecent(50000); // Keep 50k most recent
        this.waypointBuffer.clear();
        recent.forEach(point => this.waypointBuffer.push(point));
        console.log(`🧹 Waypoint buffer cleaned: ${recent.length} points kept`);
    }

    // Override untuk unlimited operation
    handleGPSPosition(position) {
        // Update unlimited manager
        this.unlimitedManager.performanceMetrics.positionsProcessed++;
        
        // Process seperti biasa
        return super.handleGPSPosition(position);
    }

    getUnlimitedStatus() {
        return {
            operation: this.unlimitedManager.getUnlimitedMetrics(),
            storage: this.storageManager.getUnlimitedStorageStats(),
            system: {
                uptime: this.unlimitedManager.formatUptime(Date.now() - this.unlimitedManager.operationStartTime),
                journeyStatus: this.journeyStatus,
                isTracking: this.isTracking,
                isOnline: this.isOnline,
                backgroundMode: document.hidden
            },
            performance: {
                gpsUpdates: this.healthMetrics.gpsUpdates,
                waypointSaves: this.healthMetrics.waypointSaves,
                firebaseSends: this.healthMetrics.firebaseSends,
                totalDistance: this.totalDistance
            }
        };
    }
}

// ===== MAIN ENHANCED GPS LOGGER CLASS =====
class EnhancedDTGPSLogger {
    constructor() {
        // Enhanced Configuration with detailed settings
        this.waypointConfig = {
            collectionInterval: 1000,
            maxWaypoints: 250000,
            batchSize: 100,
            syncInterval: 30000,
            maxAccuracy: 50,
            minDistance: 0.0001,
            maxSpeed: 180,
            enableKalmanFilter: true,
            enableSpeedSmoothing: true,
            offlineStorage: true,
            realTimeTracking: true,
            enableCompression: true,
            autoArchive: true
        };

        // Enhanced Components dengan properti yang DITAMBAHKAN
        this.gpsProcessor = new EnhancedGPSProcessor();
        this.speedCalculator = new EnhancedSpeedCalculator();
        this.cleanupManager = new FirebaseCleanupManager(database);
        this.kalmanFilter = new GPSKalmanFilter();
        this.resumeManager = new ResumeManager(this);
        this.retryManager = new EnhancedRetryManager();
        this.storageManager = new EnhancedStorageManager();
        this.syncManager = new IntelligentSyncManager();
        this.realTimeProcessor = new RealTimeGPSProcessor();
        this.distanceCalculator= new HaversineDistanceSpeedCalculator();
        this.distanceStateKey = 'sagm_realtime_distance_state';
        this.backgroundPoller = new BackgroundGPSPoller(this, { 
            pollDelay: 1000,
            enableHighAccuracy: true
        });
    
        this.lastDistancePersistTime = 0;
        this.accuracyTuning = {
            idleSnapKmh: 0,
            minMoveMeters: 0,
            antiZigzagAccuracy: 0
        };
        this.strictRealtime = true;
        this.waypointBuffer = new CircularBuffer(this.waypointConfig.maxWaypoints);
        this.unsyncedWaypoints = new Set();
        this.driverData = null;
        this.watchId = null;
        this.isTracking = false;
        this.sendInterval = null;
        this.syncInterval = null;
        this.healthCheckInterval = null;
        this.sessionStartTime = null;
        this.totalDistance = 0;
        this.lastPosition = null;
        this.dataPoints = 0;
        this.isOnline = navigator.onLine;
        this.journeyStatus = 'ready';
        this.firebaseRef = null;
        this.lastUpdateTime = null;
        this.currentSpeed = 0;
        this.speedHistory = [];
        this.distanceHistory = [];
        this.accuracyHistory = [];
        
        this.completeHistory = this.loadCompleteHistory();
        
        // Chat System dengan enhanced features
        this.chatRef = null;
        this.chatMessages = [];
        this.unreadCount = 0;
        this.isChatOpen = false;
        this.chatInitialized = false;
        this.lastMessageId = null;

        // Additional Features dengan comprehensive management
        this.offlineQueue = new OfflineQueueManager();
        this.autoPause = true;
        this.idleDetection = true;
        this.idleStartTime = null;
        this.idleThreshold = 300000;
        
        // Recovery and Health Monitoring
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = 3;
        this.healthMetrics = {
            gpsUpdates: 0,
            waypointSaves: 0,
            firebaseSends: 0,
            errors: 0,
            recoveryAttempts: 0,
            startTime: new Date(),
            lastHealthCheck: new Date()
        };

        // Performance Monitoring
        this.performanceMetrics = {
            gpsProcessingTime: 0,
            waypointSaveTime: 0,
            firebaseSendTime: 0,
            totalUptime: 0
        };
        this.stopwatch = new IndependentStopwatch(); 
        this.distanceCalculator = new HaversineDistanceSpeedCalculator(this.stopwatch);
        this.realTimeProcessor = new RealTimeGPSProcessor(this.stopwatch);
        this.gpsProcessor = new EnhancedGPSProcessor();
        this.speedCalculator = new EnhancedSpeedCalculator();
        this.setupSpeedStopwatch();
        this.totalDistance = 0;
        this.currentSpeed = 0;
        this.lastPosition = null;
        

        this.restorePersistentDistanceState();
        console.log('🚀 ENHANCED GPS Logger - All Systems Initialized');

        this.init();
    }

    // === METHOD YANG DIPERBAIKI ===

    init() {
        try {
            this.setupEventListeners();
            this.updateTime();
            this.checkNetworkStatus();
            this.setupPeriodicTasks();
            this.loadUnsyncedWaypoints();
            this.loadSystemState();
            
            // === TAMBAHKAN INI ===
            this.setupRealTimeCallbacks();
            this.realTimeProcessor.setTuning(this.accuracyTuning);
            this.realTimeProcessor.setStrictRealtime(this.strictRealtime);
            
            
            // Setup resume callbacks
            this.resumeManager.addResumeCallback(() => {
                this.recoverFromBackground();
            });
            this.backgroundPoller.setActive(true);
        
            console.log('⚡ REAL-TIME MAX Mode: Background polling 1 SECOND');
            // Setup offline queue callbacks
            this.offlineQueue.addProcessCallback((results) => {
                this.addLog(`📡 Offline queue: ${results.sent} terkirim, ${results.failed} gagal`, 'info');
            });

            // Setup enhanced retry callbacks
            this.retryManager.addRetryCallback((result) => {
                this.addLog(`Retry ${result.status}: ${result.id}`, 
                           result.status === 'completed' ? 'success' : 'warning');
            });

            // Setup intelligent sync listeners
            this.syncManager.addSyncListener((result) => {
                if (result.type === 'success') {
                    this.addLog(`Smart sync berhasil (${result.strategy})`, 'success');
                } else {
                    this.addLog(`Smart sync gagal: ${result.error}`, 'error');
                }
            });

            console.log('✅ System fully initialized with all enhanced features');
            
            // Perform initial health check
            setTimeout(() => this.healthCheck(), 5000);
            
        } catch (error) {
            console.error('❌ Error during system initialization:', error);
            this.addLog('Error inisialisasi sistem', 'error');
        }
    }

    
    
// === METHOD REAL-TIME YANG DIPERBAIKI ===

    setupRealTimeCallbacks() {
        // Callback untuk update UI
        this.realTimeProcessor.addCallback((data) => {
            this.updateRealTimeDisplay(data);
        });

        // Callback untuk logging
        this.realTimeProcessor.addCallback((data) => {
            this.logRealTimeData(data);
        });
    }

    handleGPSPosition(position, options = {}) {
        if (!position || !position.coords) return;

        const { source = 'watch', forceBackground = false, forceOffline = false } = options;

        if (source === 'background' && this.isDuplicatePosition(position)) {
            return;
        }

        this.healthMetrics.gpsUpdates++;

        const isBackground = forceBackground || document.hidden;
        const isOffline = forceOffline || !navigator.onLine;

        try {
            const processedData = this.realTimeProcessor.processPosition(position, {
                background: isBackground,
                offline: isOffline,
                source: source
            });
            if (processedData) {
                this.currentSpeed = processedData.speed || 0;
                this.totalDistance = processedData.totalDistance || 0;
                this.lastPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    bearing: position.coords.heading,
                    timestamp: new Date()
                };
                this.updateRealTimeDisplay(processedData);
                if (this.healthMetrics.gpsUpdates % 5 === 0) {
                    console.log(`📊 GPS Update #${this.healthMetrics.gpsUpdates}:`, {
                        speed: this.currentSpeed.toFixed(1) + ' km/h',
                        totalDistance: this.totalDistance.toFixed(3) + ' km',
                        segmentDistance: (processedData.distance * 1000).toFixed(1) + ' m',
                        background: isBackground,
                        offline: isOffline,
                        stopwatchTime: this.stopwatch.getFormattedTime()
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error in handleGPSPosition:', error);
            this.addLog('Error memproses posisi GPS', 'error');
        }
    }
    debugStopwatchSystem() {
        console.group('🔍 Stopwatch System Debug');
        console.log('Stopwatch running:', this.stopwatch.isRunning);
        console.log('Stopwatch time:', this.stopwatch.getFormattedTime());
        console.log('Stopwatch timestamp:', this.stopwatch.getCurrentTimestamp());
        console.log('Total distance:', this.totalDistance);
        console.log('Current speed:', this.currentSpeed);

        if (this.realTimeProcessor && this.realTimeProcessor.distanceCalculator) {
            const calc = this.realTimeProcessor.distanceCalculator;
            console.log('Calculator total distance:', calc.totalDistance);
            console.log('Calculator last position:', calc.lastPosition);
        }
        console.groupEnd();
    }
   
    updateRealTimeDisplay(data) {
        // Update speed display
        const speedElement = document.getElementById('currentSpeed');
        if (speedElement) {
            speedElement.textContent = data.speed.toFixed(1) + ' km/h';
            speedElement.className = data.speed > 0 ? 'speed-active' : 'speed-inactive';
        }

        // Update distance display
        const distanceElement = document.getElementById('totalDistance');
        if (distanceElement) {
            distanceElement.textContent = data.totalDistance.toFixed(3) + ' km';
        }

        // Update segment distance
        const segmentElement = document.getElementById('segmentDistance');
        if (segmentElement) {
            segmentElement.textContent = (data.distance * 1000).toFixed(1) + ' m';
        }
    }

    updateSpeedDistanceDisplay() {
        this.updateRealTimeDisplay({
            speed: this.currentSpeed,
            totalDistance: this.totalDistance,
            distance: 0
        });
    }

    logRealTimeData(data) {
        if (this.healthMetrics.gpsUpdates % 10 === 0) {
            console.log(`📈 Real-time Metrics #${this.healthMetrics.gpsUpdates}:`, {
                speed: data.speed.toFixed(1) + ' km/h',
                segment: (data.distance * 1000).toFixed(1) + ' m',
                total: data.totalDistance.toFixed(3) + ' km',
                position: `${data.position.lat.toFixed(6)}, ${data.position.lng.toFixed(6)}`
            });
        }
    }

    saveWaypointFromProcessedData(processedData, originalPosition) {
        const waypoint = {
            id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            lat: processedData.position.lat,
            lng: processedData.position.lng,
            speed: processedData.speed,
            accuracy: originalPosition.coords.accuracy,
            bearing: originalPosition.coords.heading,
            timestamp: new Date().toISOString(),
            distance: processedData.distance,
            totalDistance: processedData.totalDistance,
            synced: false
        };

        this.saveWaypoint(waypoint);
    }

    /**
     * Get real-time metrics untuk monitoring
     */
getRealTimeMetrics = () => {
        return {
            calculator: this.realTimeProcessor.getCalculator().getCurrentMetrics(),
            processor: this.realTimeProcessor.getCurrentData()
        };
    }

    /**
     * Reset real-time tracking
     */
resetRealTimeTracking = () => {
        this.realTimeProcessor.reset();
        this.currentSpeed = 0;
        this.totalDistance = 0;
        this.lastPosition = null;
        this.clearPersistentDistanceState();
        console.log('🔄 Real-time tracking reset');
    }

    setupEnhancedFeatures = () => {
        // Monitor storage health
        setInterval(() => {
            this.checkEnhancedStorageHealth();
        }, 60000);

        // Setup intelligent sync triggers
        setInterval(() => {
            if (this.isOnline && this.unsyncedWaypoints.size > 0) {
                this.triggerEnhancedSync();
            }
        }, 120000);
    }

triggerEnhancedSync = async () => {
        if (!this.isOnline) return;
        
        try {
            await this.syncManager.triggerSmartSync();
        } catch (error) {
            console.error('Enhanced sync failed:', error);
            this.addLog('Smart sync gagal', 'error');
        }
    }

    checkEnhancedStorageHealth = () => {
        const storageStats = this.storageManager.getEnhancedStorageStatistics();
        
        if (storageStats.capacity.health === 'critical') {
            this.addLog('🚨 Storage hampir penuh!', 'error');
            this.triggerEmergencyCleanup();
        } else if (storageStats.capacity.health === 'warning') {
            this.addLog('⚠️ Storage menipis', 'warning');
        }
    }

    triggerEmergencyCleanup = () => {
        // Perform emergency storage cleanup
        const waypoints = this.storageManager.loadAllWaypoints();
        const cleaned = this.storageManager.performEmergencyCleanup(waypoints);
        this.storageManager.saveToStorage(cleaned);
        this.addLog('Emergency storage cleanup dilakukan', 'warning');
    }

    getEnhancedSystemStatus = () => {
        return {
            storage: this.storageManager.getEnhancedStorageStatistics(),
            retry: this.retryManager.getQueueStats(),
            sync: this.syncManager.getSyncAnalytics(),
            network: this.syncManager.networkInfo,
            performance: {
                gpsUpdates: this.healthMetrics.gpsUpdates,
                waypointSaves: this.healthMetrics.waypointSaves,
                firebaseSends: this.healthMetrics.firebaseSends
            },
            realTime: this.getRealTimeMetrics()
        };
    }

    // === IMPLEMENTASI LENGKAP DARI SEMUA METHOD YANG ADA DI KODE LAMA ===

    setupEventListeners = () => {
        // Login Form
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

        // Additional UI Controls
        document.getElementById('refreshDataBtn')?.addEventListener('click', () => this.refreshData());
        document.getElementById('clearLogsBtn')?.addEventListener('click', () => this.clearLogs());
        document.getElementById('exportDataBtn')?.addEventListener('click', () => this.exportData());

        // Settings and Maintenance
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettings());
        document.getElementById('maintenanceBtn')?.addEventListener('click', () => this.showMaintenance());

        // Emergency Buttons
        document.getElementById('emergencyStopBtn')?.addEventListener('click', () => this.emergencyStop());
        document.getElementById('forceSyncBtn')?.addEventListener('click', () => this.forceSync());

        // Window event listeners
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('orientationchange', () => this.handleOrientationChange());
        window.addEventListener('online', () => {
            console.log('🌐 Online - stopwatch tetap berjalan');
        });
        window.addEventListener('offline', () => {
            console.log('📴 Offline - stopwatch tetap berjalan');
        });
    }

    setupPeriodicTasks = () => {
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

        // Health check every 10 seconds
        setInterval(() => this.healthCheck(), 10000);

        // Performance monitoring every 30 seconds
        setInterval(() => this.updatePerformanceMetrics(), 30000);

        // Storage maintenance every hour
        setInterval(() => this.storageManager.performStorageMaintenance(), 3600000);

        // Enhanced sync every 2 minutes if online
        setInterval(() => {
            if (this.isOnline && this.unsyncedWaypoints.size > 0) {
                this.triggerEnhancedSync();
            }
        }, 120000);

        // Setup enhanced features
        this.setupEnhancedFeatures();
    }

    // === IMPLEMENTASI METHOD-METHOD UTAMA DARI KODE LAMA ===

    handleLogin = () => {
        const driverName = document.getElementById('driverName').value.trim();
        const unitNumber = document.getElementById('unitNumber').value.trim();
        
        if (!driverName || !unitNumber) {
            this.addLog('Nama driver dan nomor unit harus diisi', 'error');
            return;
        }

        this.driverData = {
            name: driverName,
            unit: unitNumber,
            sessionId: `session_${Date.now()}`,
            loginTime: new Date().toISOString()
        };
        this.stopwatch.start();

        this.applyPendingRealTimeState();

        // Initialize Firebase reference
        this.firebaseRef = database.ref('/units/' + this.driverData.unit);
        this.chatRef = database.ref('/chat/' + this.driverData.unit);

        // Show main interface
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainInterface').classList.remove('hidden');

        this.addLog(`Driver ${driverName} (Unit ${unitNumber}) login berhasil`, 'success');
        this.updateDriverDisplay();
    }


    // ===== PERBAIKAN handleBackgroundPoll =====
handleBackgroundPoll = (position, context = {}) => {
    if (!position || !this.realTimeProcessor) return;

    console.log(`🔵 Background Poll [${new Date().toLocaleTimeString()}]:`, {
        accuracy: position.coords.accuracy + 'm',
        lat: position.coords.latitude.toFixed(6),
        lng: position.coords.longitude.toFixed(6)
    });

    // ✅ PROCESS DENGAN REAL-TIME PROCESSOR YANG SUDAH TERINTEGRASI STOPWATCH
    const processedData = this.realTimeProcessor.processPosition(position, {
        ...context,
        background: true,
        offline: !navigator.onLine,
        source: 'background_poll'
    });
    
    if (processedData && processedData.speed !== undefined && processedData.totalDistance !== undefined) {
        // ✅ UPDATE DATA REAL-TIME
        this.currentSpeed = processedData.speed;
        this.totalDistance = processedData.totalDistance;
        this.lastPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            bearing: position.coords.heading,
            timestamp: new Date()
        };

        // ✅ UPDATE UI MESKI BACKGROUND
        this.updateRealTimeDisplay(processedData);

        // ✅ SIMPAN WAYPOINT
        this.saveWaypointFromProcessedData(processedData, position);
        
        // ✅ LOGGING DETAIL
        console.log(`📈 Background Update:`, {
            speed: processedData.speed.toFixed(1) + ' km/h',
            segment: (processedData.distance * 1000).toFixed(1) + ' m',
            total: processedData.totalDistance.toFixed(3) + ' km',
            quality: processedData.quality,
            stopwatch: this.stopwatch ? this.stopwatch.getFormattedTime() : 'No stopwatch'
        });
    } else {
        console.warn('❌ Background processed data invalid:', processedData);
    }
}; // ✅ TUTUP METHOD DENGAN BENAR

// ===== PERBAIKAN startJourney DENGAN STOPWATCH =====
startJourney = () => {
    if (!this.driverData) {
        this.addLog('Silakan login terlebih dahulu', 'error');
        return;
    }

    this.journeyStatus = 'started';
    this.sessionStartTime = new Date();
    this.totalDistance = 0;
    this.dataPoints = 0;

    // ✅ START STOPWATCH UTAMA
    if (this.stopwatch) {
        this.stopwatch.start();
        console.log('⏱️ MAIN STOPWATCH STARTED for distance calculation');
    } else {
        console.error('❌ Stopwatch not available');
        this.addLog('Error: Stopwatch tidak tersedia', 'error');
        return;
    }

    this.resetRealTimeTracking();
    this.startRealGPSTracking();
    this.startDataTransmission();

    this.addLog('Perjalanan dimulai - Stopwatch aktif', 'success');
    this.updateJourneyDisplay();
};

// ===== PERBAIKAN pauseJourney DENGAN STOPWATCH =====
pauseJourney = () => {
    this.journeyStatus = 'paused';
    this.stopRealGPSTracking();
    
    // ✅ PAUSE STOPWATCH
    if (this.stopwatch) {
        this.stopwatch.pause();
        console.log('⏱️ Stopwatch paused');
    }
    
    this.addLog('Perjalanan dijeda', 'warning');
    this.updateJourneyDisplay();
};

// ===== PERBAIKAN endJourney DENGAN STOPWATCH =====
endJourney = () => {
    this.journeyStatus = 'ended';
    this.stopRealGPSTracking();
    this.stopDataTransmission();

    // ✅ STOP STOPWATCH
    if (this.stopwatch) {
        this.stopwatch.stop();
        console.log('⏱️ Stopwatch stopped');
    }

    // Schedule cleanup
    if (this.driverData && this.cleanupManager) {
        this.cleanupManager.scheduleCleanup(this.driverData.unit, this.driverData.sessionId, 'journey_ended');
    }

    this.addLog('Perjalanan selesai', 'success');
    this.updateJourneyDisplay();
};

// ===== PERBAIKAN startRealGPSTracking =====
startRealGPSTracking = () => {
    if (this.watchId) {
        console.warn('GPS tracking sudah berjalan');
        return;
    }

    // ✅ OPTIONS YANG LEBIH BAIK UNTUK BACKGROUND
    const options = {
        enableHighAccuracy: true,
        timeout: 10000, // ✅ PERPANJANG TIMEOUT UNTUK BACKGROUND
        maximumAge: 2000
    };

    try {
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleGPSPosition(position),
            (error) => this.handleGPSError(error),
            options
        );

        this.isTracking = true;
        if (this.backgroundPoller) {
            this.backgroundPoller.setActive(true);
        }
        console.log('📍 GPS tracking started');
        
    } catch (error) {
        console.error('❌ Failed to start GPS tracking:', error);
        this.addLog('Gagal memulai GPS tracking', 'error');
    }
};

// ===== PERBAIKAN stopRealGPSTracking =====
stopRealGPSTracking = () => {
    if (this.watchId) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
    }
    this.isTracking = false;
    if (this.backgroundPoller) {
        this.backgroundPoller.setActive(false);
    }
    console.log('📍 GPS tracking stopped');
};

// ===== PERBAIKAN saveWaypoint =====
saveWaypoint = (waypoint) => {
    if (!waypoint || !this.storageManager) {
        console.warn('❌ Cannot save waypoint: invalid data or storage manager');
        return;
    }

    try {
        this.storageManager.saveWaypoint(waypoint);
        this.healthMetrics.waypointSaves++;
    } catch (error) {
        console.error('❌ Failed to save waypoint:', error);
    }
};

// ===== PERBAIKAN startDataTransmission =====
startDataTransmission = () => {
    // ✅ CLEAR EXISTING INTERVALS DULU
    this.stopDataTransmission();

    // Start sending real-time data to Firebase
    this.sendInterval = setInterval(() => {
        if (this.isOnline && this.lastPosition) {
            this.sendRealTimeData();
        }
    }, 2000); // Send every 2 seconds

    // Start syncing waypoints
    this.syncInterval = setInterval(() => {
        if (this.isOnline) {
            this.syncWaypointsToServer();
        }
    }, this.waypointConfig?.syncInterval || 30000);

    console.log('📡 Data transmission started');
};

// ===== PERBAIKAN stopDataTransmission =====
stopDataTransmission = () => {
    if (this.sendInterval) {
        clearInterval(this.sendInterval);
        this.sendInterval = null;
    }
    if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
    }
    console.log('📡 Data transmission stopped');
};

// ===== PERBAIKAN sendRealTimeData =====
sendRealTimeData = async () => {
    if (!this.firebaseRef || !this.lastPosition) return;

    try {
        const realTimeData = this.getRealTimeData();
        if (realTimeData) {
            await this.firebaseRef.set(realTimeData);
            this.healthMetrics.firebaseSends++;
        }
    } catch (error) {
        console.error('❌ Failed to send real-time data:', error);
        this.addLog('Gagal mengirim data real-time', 'error');
    }
};

// ===== PERBAIKAN getRealTimeData =====
getRealTimeData = () => {
    if (!this.lastPosition) return null;
    
    return {
        driver: this.driverData?.name,
        unit: this.driverData?.unit,
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
        sessionId: this.driverData?.sessionId,
        fuel: this.calculateFuelLevel(),
        gpsMode: 'real-time-enhanced',
        processed: true,
        confidence: this.lastPosition.confidence || 0.5,
        dataQuality: 'high',
        stopwatchTime: this.stopwatch ? this.stopwatch.getFormattedTime() : null // ✅ TAMBAHKAN STOPWATCH TIME
    };
};

// ===== PERBAIKAN syncWaypointsToServer =====
syncWaypointsToServer = async () => {
    if (!this.isOnline || !this.driverData) {
        console.log('❌ Cannot sync: Offline or no driver data');
        return;
    }

    const unsynced = this.getUnsyncedWaypoints();
    if (unsynced.length === 0) {
        console.log('✅ All waypoints synced');
        return;
    }

    console.log(`🔄 Syncing ${unsynced.length} waypoints to server...`);
    
    const batches = this.createBatches(unsynced, this.waypointConfig?.batchSize || 100);
    let successfulBatches = 0;

    for (const [index, batch] of batches.entries()) {
        try {
            // Use enhanced retry manager for batch upload
            await this.retryManager.scheduleRetry(
                { batch, batchIndex: index },
                'high',
                {
                    type: 'waypoint_upload',
                    operation: async (data) => {
                        await this.uploadBatch(data.batch, data.batchIndex);
                    }
                }
            );
            
            successfulBatches++;
            
            batch.forEach(waypoint => {
                waypoint.synced = true;
                this.unsyncedWaypoints.delete(waypoint.id);
            });
            
            this.storageManager.markWaypointsAsSynced(batch.map(wp => wp.id));
            this.addLog(`📡 Batch ${index + 1}/${batches.length} synced (${batch.length} waypoints)`, 'success');
            
        } catch (error) {
            console.error(`❌ Batch ${index + 1} sync failed:`, error);
            this.addLog(`❌ Batch ${index + 1} sync failed`, 'error');
            break;
        }
    }

    if (successfulBatches > 0) {
        this.addLog(`✅ ${successfulBatches} batches synced successfully`, 'success');
        this.updateWaypointDisplay();
    }
};

// ===== PERBAIKAN uploadBatch =====
uploadBatch = async (batch, batchIndex) => {
    if (!this.driverData || !batch || batch.length === 0) {
        throw new Error('Invalid batch data for upload');
    }

    const batchId = `batch_${Date.now()}_${batchIndex}`;
    const batchRef = database.ref(`/waypoints/${this.driverData.unit}/batches/${batchId}`);
    
    const batchData = {
        batchId: batchId,
        unit: this.driverData.unit,
        sessionId: this.driverData.sessionId,
        driver: this.driverData.name,
        waypoints: batch,
        uploadedAt: new Date().toISOString(),
        batchSize: batch.length,
        batchIndex: batchIndex,
        stopwatchTime: this.stopwatch ? this.stopwatch.getFormattedTime() : null // ✅ TAMBAHKAN STOPWATCH TIME
    };

    await batchRef.set(batchData);
    console.log(`✅ Batch ${batchIndex} uploaded successfully (${batch.length} waypoints)`);
};
    // === IMPLEMENTASI METHOD-METHOD TAMBAHAN ===

    getUnsyncedWaypoints() {
        return this.storageManager.loadUnsyncedWaypoints();
    }

    createBatches = (array, batchSize) => {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    getBatteryLevel() {
        // Simulate battery level - in real implementation, use navigator.getBattery()
        return Math.max(0.2, Math.min(1, Math.random() * 0.8 + 0.2));
    }

    calculateFuelLevel() {
        // Simulate fuel level
        return Math.max(0.1, Math.min(1, Math.random() * 0.9 + 0.1));
    }

    updateAllDisplays() {
        this.updateTime();
        this.updateDriverDisplay();
        this.updateJourneyDisplay();
        this.updateWaypointDisplay();
        this.updatePerformanceDisplay();
    }

    updateTime() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement && this.driverData) {
            timeElement.textContent = this.stopwatch.getFormattedTime();
        }
    }

    updateDriverDisplay() {
        const driverElement = document.getElementById('driverInfo');
        if (driverElement && this.driverData) {
            driverElement.textContent = `${this.driverData.name} - Unit ${this.driverData.unit}`;
        }
    }

    updateJourneyDisplay() {
        const statusElement = document.getElementById('journeyStatus');
        const distanceElement = document.getElementById('totalDistance');
        const speedElement = document.getElementById('currentSpeed');
        
        if (statusElement) {
            statusElement.textContent = this.journeyStatus.toUpperCase();
            statusElement.className = `status-${this.journeyStatus}`;
        }
        
        if (distanceElement) {
            distanceElement.textContent = this.totalDistance.toFixed(2) + ' km';
        }
        
        if (speedElement) {
            speedElement.textContent = this.currentSpeed.toFixed(1) + ' km/h';
        }
    }

    updateWaypointDisplay() {
        const waypointElement = document.getElementById('waypointCount');
        const unsyncedElement = document.getElementById('unsyncedCount');
        
        if (waypointElement) {
            waypointElement.textContent = this.dataPoints.toString();
        }
        
        if (unsyncedElement) {
            unsyncedElement.textContent = this.unsyncedWaypoints.size.toString();
        }
    }

    updatePerformanceDisplay() {
        const performanceElement = document.getElementById('performanceMetrics');
        if (performanceElement) {
            performanceElement.textContent = 
                `GPS: ${this.healthMetrics.gpsUpdates} | ` +
                `Saves: ${this.healthMetrics.waypointSaves} | ` +
                `Sends: ${this.healthMetrics.firebaseSends} | ` +
                `Errors: ${this.healthMetrics.errors}`;
        }
    }

    addLog(message, type = 'info') {
        const logElement = document.getElementById('systemLog');
        if (!logElement) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `
            <span class="log-time">[${new Date().toLocaleTimeString('id-ID')}]</span>
            <span class="log-message">${message}</span>
        `;

        logElement.appendChild(logEntry);
        logElement.scrollTop = logElement.scrollHeight;

        // Keep only last 100 log entries
        const entries = logElement.getElementsByClassName('log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }

        console.log(`📝 [${type.toUpperCase()}] ${message}`);
    }

    checkNetworkStatus() {
        const wasOnline = this.isOnline;
        this.isOnline = navigator.onLine;
        
        if (wasOnline !== this.isOnline) {
            this.offlineQueue.updateOnlineStatus(this.isOnline);
            this.updateConnectionStatus(this.isOnline);
            
            if (this.isOnline) {
                this.addLog('Koneksi internet tersedia', 'success');
                // Trigger immediate sync when coming online
                setTimeout(() => {
                    this.syncWaypointsToServer();
                    this.offlineQueue.processQueue();
                }, 1000);
            } else {
                this.addLog('Koneksi internet terputus', 'warning');
            }
        }
    }

    updateConnectionStatus(online) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = online ? 'ONLINE' : 'OFFLINE';
            statusElement.className = online ? 'status-online' : 'status-offline';
        }
    }

    updateSessionDuration() {
        if (!this.sessionStartTime) return;
        
        const durationElement = document.getElementById('sessionDuration');
        if (durationElement) {
            const now = new Date();
            const diff = now - this.sessionStartTime;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            
            durationElement.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    healthCheck() {
        this.healthMetrics.lastHealthCheck = new Date();
        
        // Check GPS status
        if (this.isTracking && this.healthMetrics.gpsUpdates === 0) {
            this.addLog('Peringatan: Tidak ada update GPS', 'warning');
        }
        
        // Check storage health
        const storageHealth = this.storageManager.checkStorageHealth();
        if (storageHealth === 'critical') {
            this.addLog('Peringatan: Storage hampir penuh', 'error');
        }
        
        // Check retry queue health
        const retryHealth = this.retryManager.getRetryHealth();
        if (retryHealth === 'critical') {
            this.addLog('Peringatan: Banyak operasi tertunda', 'warning');
        }
    }

    updatePerformanceMetrics() {
        const now = new Date();
        this.performanceMetrics.totalUptime = now - this.healthMetrics.startTime;
    }

    autoSaveSystemState() {
        this.saveSystemState();
    }

    saveSystemState() {
        const systemState = {
            driverData: this.driverData,
            journeyStatus: this.journeyStatus,
            totalDistance: this.totalDistance,
            dataPoints: this.dataPoints,
            lastPosition: this.lastPosition,
            sessionStartTime: this.sessionStartTime,
            healthMetrics: this.healthMetrics,
            performanceMetrics: this.performanceMetrics,
             realTimeState: this.realTimeProcessor.getState(),
            savedAt: new Date().toISOString()
        };

        this.persistRealTimeState();
        this.storageManager.saveSystemState(systemState);
    }

    loadSystemState() {
        const savedState = this.storageManager.loadSystemState();
        if (savedState) {
            this.driverData = savedState.driverData;
            this.journeyStatus = savedState.journeyStatus;
            this.totalDistance = savedState.totalDistance || 0;
            this.dataPoints = savedState.dataPoints || 0;
            this.lastPosition = savedState.lastPosition;
            this.sessionStartTime = savedState.sessionStartTime ? new Date(savedState.sessionStartTime) : null;
            this.healthMetrics = { ...this.healthMetrics, ...savedState.healthMetrics };
            this.performanceMetrics = { ...this.performanceMetrics, ...savedState.performanceMetrics };
            if (savedState.realTimeState) {
                this.realTimeProcessor.restoreState(savedState.realTimeState);
                this.pendingRealTimeState = null;
            }
            
            console.log('✅ System state loaded from storage');
            this.addLog('State sistem dipulihkan dari penyimpanan', 'success');
        }
    }

    loadUnsyncedWaypoints() {
        const unsynced = this.storageManager.loadUnsyncedWaypoints();
        unsynced.forEach(waypoint => {
            this.unsyncedWaypoints.add(waypoint.id);
        });
        console.log(`📋 Loaded ${unsynced.length} unsynced waypoints from storage`);
    }

    loadCompleteHistory() {
        return this.storageManager.loadAllWaypoints();
    }

    getSystemState() {
        return {
            driverData: this.driverData,
            journeyStatus: this.journeyStatus,
            totalDistance: this.totalDistance,
            dataPoints: this.dataPoints,
            lastPosition: this.lastPosition,
            sessionStartTime: this.sessionStartTime,
            healthMetrics: this.healthMetrics,
            performanceMetrics: this.performanceMetrics,
            isOnline: this.isOnline,
            isTracking: this.isTracking,
            currentSpeed: this.currentSpeed,
            timestamp: new Date().toISOString()
        };
    }

    getAnalyticsData() {
        return {
            gpsProcessor: this.gpsProcessor.getQualityMetrics(),
            speedCalculator: this.speedCalculator.getSpeedMetrics(),
            storage: this.storageManager.getEnhancedStorageStatistics(),
            retry: this.retryManager.getQueueStats(),
            sync: this.syncManager.getSyncAnalytics(),
            resume: this.resumeManager.getRecoveryStats(),
            realTime: this.getRealTimeMetrics(),
            health: this.healthMetrics,
            performance: this.performanceMetrics,
            collectedAt: new Date().toISOString()
        };
    }

    recoverFromBackground= () => {
        console.log('🔄 Recovering from background state...');
        
        // Reset components that might have stale state
        this.gpsProcessor.reset();
        this.speedCalculator.reset();
        
        // Force refresh of all data
        this.updateAllDisplays();
        
        // Sync any pending data
        if (this.isOnline) {
            setTimeout(() => {
                this.syncWaypointsToServer();
                this.offlineQueue.processQueue();
            }, 2000);
        }
        
        this.addLog('Sistem dipulihkan dari background state', 'success');
    }

    // === IMPLEMENTASI METHOD CHAT ===

    toggleChat= () => {
        this.isChatOpen = !this.isChatOpen;
        const chatPanel = document.getElementById('chatPanel');
        
        if (chatPanel) {
            if (this.isChatOpen) {
                chatPanel.classList.remove('hidden');
                this.initializeChat();
                this.loadChatMessages();
            } else {
                chatPanel.classList.add('hidden');
            }
        }
    }

    initializeChat= () => {
        if (this.chatInitialized || !this.chatRef) return;

        this.chatRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            this.displayChatMessage(message);
        });

        this.chatInitialized = true;
        console.log('💬 Chat system initialized');
    }

    displayChatMessage=(message) => {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${message.sender === 'system' ? 'system-message' : 'user-message'}`;
        messageElement.innerHTML = `
            <div class="message-sender">${message.sender}</div>
            <div class="message-text">${message.text}</div>
            <div class="message-time">${new Date(message.timestamp).toLocaleTimeString('id-ID')}</div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Update unread count if chat is closed
        if (!this.isChatOpen && message.sender !== 'system') {
            this.unreadCount++;
            this.updateChatBadge();
        }
    }

    updateChatBadge= () => {
        const chatBadge = document.getElementById('chatBadge');
        if (chatBadge) {
            chatBadge.textContent = this.unreadCount > 0 ? this.unreadCount.toString() : '';
            chatBadge.style.display = this.unreadCount > 0 ? 'block' : 'none';
        }
    }

    sendChatMessage = async () => {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput || !chatInput.value.trim() || !this.chatRef) return;

        const messageText = chatInput.value.trim();
        const message = {
            text: messageText,
            sender: this.driverData?.name || 'Unknown',
            timestamp: new Date().toISOString(),
            unit: this.driverData?.unit,
            synced: true
        };

        try {
            await this.chatRef.push().set(message);
            chatInput.value = '';
            
            // Also add to local messages for immediate display
            this.displayChatMessage(message);
            this.chatMessages.push(message);
            
        } catch (error) {
            console.error('❌ Failed to send chat message:', error);
            this.addLog('Gagal mengirim pesan chat', 'error');
        }
    }

    loadChatMessages= () => {
        // Clear unread count when opening chat
        this.unreadCount = 0;
        this.updateChatBadge();
    }

    // === IMPLEMENTASI METHOD TAMBAHAN ===

    reportIssue= () => {
        const issue = prompt('Deskripsikan masalah yang ditemukan:');
        if (issue) {
            this.addLog(`Laporan masalah: ${issue}`, 'warning');
            // In real implementation, send this to server
        }
    }

    logout= () => {
        // Stop all activities
        this.stopRealGPSTracking();
        this.stopDataTransmission();
        
        // Save final state
        this.saveSystemState();
        
        // Reset state
        this.driverData = null;
        this.journeyStatus = 'ready';
        this.sessionStartTime = null;
        this.totalDistance = 0;
        this.dataPoints = 0;
        this.lastPosition = null;
        this.stopwatch.stop();
        this.stopwatch.reset();
        
        // Show login screen
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainInterface').classList.add('hidden');
        
        this.addLog('Logout berhasil', 'success');
    }

    refreshData= () => {
        this.updateAllDisplays();
        this.addLog('Data diperbarui', 'info');
    }

    clearLogs= () => {
        const logElement = document.getElementById('systemLog');
        if (logElement) {
            logElement.innerHTML = '';
        }
        this.addLog('Logs dibersihkan', 'info');
    }

    exportData= () => {
        this.storageManager.exportData();
        this.addLog('Data diekspor', 'success');
    }

    showSettings= () => {
        alert('Settings panel akan ditampilkan di sini');
        // Implementation for settings dialog
    }

    showMaintenance= () => {
        alert('Maintenance panel akan ditampilkan di sini');
        // Implementation for maintenance operations
    }

    emergencyStop= () => {
        this.stopRealGPSTracking();
        this.stopDataTransmission();
        this.journeyStatus = 'ended';
        
        this.addLog('EMERGENCY STOP - Semua aktivitas dihentikan', 'error');
        this.updateJourneyDisplay();
    }

    forceSync= () => {
        this.syncManager.forceSync();
        this.addLog('Sinkronisasi paksa dimulai', 'info');
    }

    handleResize= () => {
        // Handle window resize if needed
        console.log('Window resized');
    }

    handleOrientationChange= () => {
        // Handle orientation change if needed
        console.log('Orientation changed');
    }

    printDiagnostics= () => {
        console.group('🚀 GPS Logger Diagnostics');
        console.log('Driver Data:', this.driverData);
        console.log('Journey Status:', this.journeyStatus);
        console.log('Tracking:', this.isTracking);
        console.log('Online:', this.isOnline);
        console.log('Total Distance:', this.totalDistance);
        console.log('Data Points:', this.dataPoints);
        console.log('Unsynced Waypoints:', this.unsyncedWaypoints.size);
        console.log('Health Metrics:', this.healthMetrics);
        console.log('Enhanced System Status:', this.getEnhancedSystemStatus());
        console.groupEnd();
        
        return this.getEnhancedSystemStatus();
    }
}

// ===== CSS UNTUK LOADING INDICATOR =====
const logoutStyles = `
.logout-loading {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    z-index: 10000;
    color: white;
}

.loading-spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 2s linear infinite;
    margin-bottom: 20px;
}

.loading-text {
    font-size: 16px;
    font-weight: bold;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.update-paused {
    opacity: 0.6;
    pointer-events: none;
}

[data-reset-on-logout] {
    transition: all 0.3s ease;
}
`;

// Inject styles ke document
const styleSheet = document.createElement('style');
styleSheet.textContent = logoutStyles;
document.head.appendChild(styleSheet);

// ===== APPLICATION INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Enhanced GPS Tracker with Unlimited Operation and Logout Management...');
    
    try {
        window.dtLogger = new UnlimitedDTGPSLoggerWithLogout();
        console.log('✅ Enhanced GPS Tracker with Unlimited Operation and Logout Management initialized successfully');
        
        // Expose diagnostics for debugging
        window.getGPSDiagnostics = () => window.dtLogger?.printDiagnostics();
        window.getEnhancedStatus = () => window.dtLogger?.getEnhancedSystemStatus();
        window.getUnlimitedStatus = () => window.dtLogger?.getUnlimitedStatus();
        window.getLogoutStatus = () => window.dtLogger?.getLogoutStatus();
        window.forceLogout = () => window.dtLogger?.initiateLogout();
        window.getRealTimeMetrics = () => window.dtLogger?.getRealTimeMetrics();
        window.resetRealTimeTracking = () => window.dtLogger?.resetRealTimeTracking();
        
    } catch (error) {
        console.error('❌ Failed to initialize GPS Tracker:', error);
        // Fallback ke basic version
        try {
            window.dtLogger = new EnhancedDTGPSLogger();
            console.log('🔄 Fallback to basic Enhanced GPS Tracker');
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
            alert('Gagal menginisialisasi aplikasi GPS. Silakan refresh halaman.');
        }
    }
});

// ===== GLOBAL ERROR HANDLING =====
window.addEventListener('error', function(event) {
    console.error('🚨 Global Error:', event.error);
    if (window.dtLogger) {
        window.dtLogger.addLog(`System error: ${event.message}`, 'error');
    }
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);
    if (window.dtLogger) {
        window.dtLogger.addLog(`Async error: ${event.reason}`, 'error');
    }
});

// ===== SERVICE WORKER REGISTRATION (Optional) =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('✅ Service Worker registered:', registration);
        })
        .catch(error => {
            console.log('❌ Service Worker registration failed:', error);
        });
}

// ===== PAGE VISIBILITY HANDLING UNTUK UNLIMITED OPERATION =====
document.addEventListener('visibilitychange', function() {
    if (window.dtLogger && window.dtLogger.unlimitedMode) {
        const isBackground = document.hidden;
        
        if (isBackground) {
            console.log('📱 Entering background - unlimited operation continues');
            // Tidak perlu lakukan apa-apa, system akan tetap berjalan
        } else {
            console.log('📱 Returning to foreground - checking system health');
            setTimeout(() => {
                window.dtLogger.checkUnlimitedSystemHealth();
                window.dtLogger.updateAllDisplays();
            }, 1000);
        }
    }
});

// ===== BEFOREUNLOAD HANDLING UNTUK PERSISTENCE =====
window.addEventListener('beforeunload', function(event) {
    if (window.dtLogger && window.dtLogger.unlimitedMode) {
        console.log('💾 Saving state before unload...');
        window.dtLogger.saveSystemState();
        
        // Untuk journey yang aktif, konfirmasi
        if (window.dtLogger.journeyStatus === 'started') {
            event.preventDefault();
            event.returnValue = 'Perjalanan masih aktif. Data akan terus tersimpan dan bisa dilanjutkan saat membuka kembali.';
            return event.returnValue;
        }
    }
});

console.log('🎉 script-mobile.js loaded successfully with ENHANCED UNLIMITED features, LOGOUT MANAGEMENT and HAVERSINE CALCULATION!');

})();

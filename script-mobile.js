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

// ===== ENHANCED STORAGE MANAGER =====
class EnhancedStorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            WAYPOINTS: 'enhanced_gps_waypoints',
            SYNC_STATUS: 'enhanced_sync_status',
            SESSION_DATA: 'enhanced_session_data',
            DRIVER_PROFILES: 'driver_profiles',
            VEHICLE_PROFILES: 'vehicle_profiles',
            SYSTEM_STATE: 'system_state_backup',
            APP_SETTINGS: 'app_settings',
            MAINTENANCE_RECORDS: 'maintenance_records',
            NOTIFICATIONS: 'system_notifications'
        };
        
        this.QUOTA_LIMITS = {
            MAX_WAYPOINTS: 61200,
            WARNING_THRESHOLD: 50000,
            CLEANUP_PERCENTAGE: 0.1 // Clean 10% when full
        };
        
        this.init();
    }

    init() {
        // Initialize storage with default values if needed
        this.ensureStorageStructure();
    }

    ensureStorageStructure() {
        try {
            // Initialize waypoints array if not exists
            if (!localStorage.getItem(this.STORAGE_KEYS.WAYPOINTS)) {
                localStorage.setItem(this.STORAGE_KEYS.WAYPOINTS, JSON.stringify([]));
            }

            // Initialize sync status if not exists
            if (!localStorage.getItem(this.STORAGE_KEYS.SYNC_STATUS)) {
                this.updateSyncStatus({
                    totalWaypoints: 0,
                    unsyncedCount: 0,
                    lastSync: null,
                    lastSave: new Date().toISOString(),
                    firstSave: new Date().toISOString()
                });
            }

            console.log('✅ Storage structure initialized');
        } catch (error) {
            console.error('❌ Error initializing storage structure:', error);
        }
    }

    saveWaypoint(waypoint) {
        try {
            if (!waypoint || !waypoint.id) {
                throw new Error('Invalid waypoint data');
            }

            const existing = this.loadAllWaypoints();
            const existingIndex = existing.findIndex(wp => wp.id === waypoint.id);
            
            if (existingIndex >= 0) {
                // Update existing waypoint
                existing[existingIndex] = {
                    ...existing[existingIndex],
                    ...waypoint,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // Add new waypoint with metadata
                const enhancedWaypoint = {
                    ...waypoint,
                    createdAt: new Date().toISOString(),
                    storageVersion: '1.0',
                    dataQuality: this.assessDataQuality(waypoint)
                };
                existing.push(enhancedWaypoint);
            }

            // Check storage limits and cleanup if needed
            if (existing.length >= this.QUOTA_LIMITS.MAX_WAYPOINTS) {
                console.warn(`📦 Storage near capacity (${existing.length}/${this.QUOTA_LIMITS.MAX_WAYPOINTS}), performing cleanup...`);
                this.performStorageCleanup(existing);
            } else if (existing.length >= this.QUOTA_LIMITS.WARNING_THRESHOLD) {
                console.warn(`⚠️ Storage approaching limit: ${existing.length}/${this.QUOTA_LIMITS.MAX_WAYPOINTS}`);
            }

            this.saveToStorage(existing);
            
            this.updateSyncStatus({
                totalWaypoints: existing.length,
                unsyncedCount: existing.filter(w => !w.synced).length,
                lastSave: new Date().toISOString()
            });

            return true;
            
        } catch (error) {
            console.error('❌ Failed to save waypoint:', error);
            return false;
        }
    }

    assessDataQuality(waypoint) {
        let qualityScore = 1.0;
        
        // Deduct points for poor accuracy
        if (waypoint.accuracy > 50) qualityScore -= 0.3;
        else if (waypoint.accuracy > 25) qualityScore -= 0.1;
        
        // Deduct points for low speed confidence
        if (waypoint.enhancedSpeed !== undefined) {
            if (waypoint.enhancedSpeed === 0) qualityScore -= 0.2;
        }
        
        // Bonus for Kalman filtered data
        if (waypoint.kalmanFiltered) qualityScore += 0.1;
        
        return Math.max(0.1, Math.min(1.0, qualityScore));
    }

    performStorageCleanup(waypoints) {
        const itemsToRemove = Math.floor(waypoints.length * this.QUOTA_LIMITS.CLEANUP_PERCENTAGE);
        
        // Remove oldest waypoints first, but keep unsynced ones
        const syncedWaypoints = waypoints.filter(wp => wp.synced);
        const unsyncedWaypoints = waypoints.filter(wp => !wp.synced);
        
        // Sort synced waypoints by creation date (oldest first)
        syncedWaypoints.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // Remove oldest synced waypoints
        const remainingSynced = syncedWaypoints.slice(itemsToRemove);
        
        // Combine back with unsynced waypoints
        const cleanedWaypoints = [...remainingSynced, ...unsyncedWaypoints];
        
        console.log(`🧹 Storage cleanup: Removed ${itemsToRemove} old waypoints, ${cleanedWaypoints.length} remaining`);
        
        return cleanedWaypoints;
    }

    loadAllWaypoints() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.WAYPOINTS);
            if (!data) return [];
            
            const waypoints = JSON.parse(data);
            
            // Validate loaded data
            if (!Array.isArray(waypoints)) {
                console.error('❌ Invalid waypoints data structure, resetting...');
                this.saveToStorage([]);
                return [];
            }
            
            return waypoints;
            
        } catch (error) {
            console.error('❌ Failed to load waypoints:', error);
            // Reset corrupted storage
            this.saveToStorage([]);
            return [];
        }
    }

    loadUnsyncedWaypoints() {
        const all = this.loadAllWaypoints();
        return all.filter(waypoint => !waypoint.synced);
    }

    loadRecentWaypoints(limit = 100) {
        const all = this.loadAllWaypoints();
        return all.slice(-limit).reverse(); // Most recent first
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
                        syncedAt: new Date().toISOString(),
                        syncAttempts: (waypoint.syncAttempts || 0) + 1
                    };
                }
                return waypoint;
            });
            
            this.saveToStorage(updated);
            
            this.updateSyncStatus({
                totalWaypoints: updated.length,
                unsyncedCount: updated.filter(w => !w.synced).length,
                lastSync: new Date().toISOString(),
                lastSyncCount: markedCount
            });
            
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
            
            // Handle quota exceeded error
            if (error.name === 'QuotaExceededError') {
                console.warn('📦 Storage quota exceeded, performing emergency cleanup...');
                const reducedWaypoints = this.performStorageCleanup(waypoints);
                localStorage.setItem(this.STORAGE_KEYS.WAYPOINTS, JSON.stringify(reducedWaypoints));
            }
        }
    }

    updateSyncStatus(status) {
        try {
            const existing = this.getSyncStatus();
            const updatedStatus = {
                ...existing,
                ...status,
                updatedAt: new Date().toISOString(),
                storageHealth: this.checkStorageHealth()
            };
            
            localStorage.setItem(this.STORAGE_KEYS.SYNC_STATUS, JSON.stringify(updatedStatus));
        } catch (error) {
            console.error('❌ Error updating sync status:', error);
        }
    }

    getSyncStatus() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.SYNC_STATUS);
            const defaultStatus = {
                totalWaypoints: 0,
                unsyncedCount: 0,
                lastSync: null,
                lastSave: null,
                firstSave: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                storageHealth: 'unknown'
            };
            
            return data ? JSON.parse(data) : defaultStatus;
        } catch (error) {
            console.error('❌ Error getting sync status:', error);
            return {
                totalWaypoints: 0,
                unsyncedCount: 0,
                lastSync: null,
                lastSave: null,
                firstSave: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                storageHealth: 'error'
            };
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

    // ===== SYSTEM STATE BACKUP =====
    saveSystemState(state) {
        try {
            const backupData = {
                ...state,
                backupTimestamp: new Date().toISOString(),
                appVersion: '2.0.0',
                dataIntegrity: this.calculateDataIntegrity(state)
            };
            
            localStorage.setItem(this.STORAGE_KEYS.SYSTEM_STATE, JSON.stringify(backupData));
            console.log('💾 System state saved successfully');
            return true;
        } catch (error) {
            console.error('❌ Error saving system state:', error);
            return false;
        }
    }

    loadSystemState() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.SYSTEM_STATE);
            if (!data) return null;
            
            const state = JSON.parse(data);
            
            // Validate backup integrity and age
            if (!this.validateBackup(state)) {
                console.warn('⚠️ System state backup validation failed');
                return null;
            }
            
            console.log('🔄 System state loaded successfully');
            return state;
        } catch (error) {
            console.error('❌ Error loading system state:', error);
            return null;
        }
    }

    validateBackup(state) {
        if (!state || !state.backupTimestamp) return false;
        
        // Check if backup is too old (more than 24 hours)
        const backupAge = Date.now() - new Date(state.backupTimestamp).getTime();
        const maxBackupAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (backupAge > maxBackupAge) {
            console.warn('⚠️ System state backup is too old');
            return false;
        }
        
        // Check data integrity
        if (state.dataIntegrity < 0.5) {
            console.warn('⚠️ System state backup has low integrity');
            return false;
        }
        
        return true;
    }

    calculateDataIntegrity(state) {
        let integrityScore = 1.0;
        
        // Check for essential fields
        if (!state.driverData) integrityScore -= 0.3;
        if (!state.sessionStartTime) integrityScore -= 0.2;
        if (!state.journeyStatus) integrityScore -= 0.1;
        
        // Check data consistency
        if (state.totalDistance && state.totalDistance < 0) integrityScore -= 0.2;
        if (state.dataPoints && state.dataPoints < 0) integrityScore -= 0.1;
        
        return Math.max(0, integrityScore);
    }

    clearSystemState() {
        try {
            localStorage.removeItem(this.STORAGE_KEYS.SYSTEM_STATE);
            console.log('🧹 System state cleared');
            return true;
        } catch (error) {
            console.error('❌ Error clearing system state:', error);
            return false;
        }
    }

    // ===== DRIVER PROFILES MANAGEMENT =====
    saveDriverProfile(profile) {
        try {
            const profiles = this.loadDriverProfiles();
            const existingIndex = profiles.findIndex(p => p.driverId === profile.driverId);
            
            const enhancedProfile = {
                ...profile,
                updatedAt: new Date().toISOString(),
                profileVersion: '1.0'
            };
            
            if (existingIndex >= 0) {
                profiles[existingIndex] = enhancedProfile;
            } else {
                enhancedProfile.createdAt = new Date().toISOString();
                profiles.push(enhancedProfile);
            }
            
            localStorage.setItem(this.STORAGE_KEYS.DRIVER_PROFILES, JSON.stringify(profiles));
            console.log('✅ Driver profile saved:', profile.driverId);
            return true;
        } catch (error) {
            console.error('❌ Error saving driver profile:', error);
            return false;
        }
    }

    loadDriverProfiles() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.DRIVER_PROFILES);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Error loading driver profiles:', error);
            return [];
        }
    }

    getDriverProfile(driverId) {
        const profiles = this.loadDriverProfiles();
        return profiles.find(p => p.driverId === driverId) || null;
    }

    // ===== VEHICLE PROFILES MANAGEMENT =====
    saveVehicleProfile(profile) {
        try {
            const profiles = this.loadVehicleProfiles();
            const existingIndex = profiles.findIndex(p => p.unit === profile.unit);
            
            const enhancedProfile = {
                ...profile,
                updatedAt: new Date().toISOString(),
                profileVersion: '1.0'
            };
            
            if (existingIndex >= 0) {
                profiles[existingIndex] = enhancedProfile;
            } else {
                enhancedProfile.createdAt = new Date().toISOString();
                profiles.push(enhancedProfile);
            }
            
            localStorage.setItem(this.STORAGE_KEYS.VEHICLE_PROFILES, JSON.stringify(profiles));
            console.log('✅ Vehicle profile saved:', profile.unit);
            return true;
        } catch (error) {
            console.error('❌ Error saving vehicle profile:', error);
            return false;
        }
    }

    loadVehicleProfiles() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.VEHICLE_PROFILES);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Error loading vehicle profiles:', error);
            return [];
        }
    }

    getVehicleProfile(unit) {
        const profiles = this.loadVehicleProfiles();
        return profiles.find(p => p.unit === unit) || null;
    }

    // ===== STORAGE MAINTENANCE =====
    performStorageMaintenance() {
        try {
            console.log('🔧 Performing storage maintenance...');
            
            const waypoints = this.loadAllWaypoints();
            let actionsTaken = 0;
            
            // Remove waypoints older than 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const filteredWaypoints = waypoints.filter(wp => {
                const waypointDate = new Date(wp.createdAt || wp.timestamp);
                if (waypointDate < thirtyDaysAgo && wp.synced) {
                    actionsTaken++;
                    return false;
                }
                return true;
            });
            
            if (actionsTaken > 0) {
                this.saveToStorage(filteredWaypoints);
                console.log(`🧹 Removed ${actionsTaken} old waypoints during maintenance`);
            }
            
            // Clean up corrupted data
            const validWaypoints = filteredWaypoints.filter(wp => 
                wp && wp.id && wp.lat && wp.lng && !isNaN(wp.lat) && !isNaN(wp.lng)
            );
            
            if (validWaypoints.length < filteredWaypoints.length) {
                const removedCount = filteredWaypoints.length - validWaypoints.length;
                this.saveToStorage(validWaypoints);
                console.log(`🧹 Removed ${removedCount} corrupted waypoints during maintenance`);
                actionsTaken += removedCount;
            }
            
            return actionsTaken;
        } catch (error) {
            console.error('❌ Error during storage maintenance:', error);
            return 0;
        }
    }

    getStorageStatistics() {
        const waypoints = this.loadAllWaypoints();
        const syncStatus = this.getSyncStatus();
        const driverProfiles = this.loadDriverProfiles();
        const vehicleProfiles = this.loadVehicleProfiles();
        
        return {
            waypoints: {
                total: waypoints.length,
                synced: waypoints.filter(wp => wp.synced).length,
                unsynced: waypoints.filter(wp => !wp.synced).length,
                storageHealth: this.checkStorageHealth()
            },
            profiles: {
                drivers: driverProfiles.length,
                vehicles: vehicleProfiles.length
            },
            syncStatus: syncStatus,
            lastMaintenance: new Date().toISOString()
        };
    }

    clearAllData() {
        try {
            Object.values(this.STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            console.log('🧹 All application data cleared');
            return true;
        } catch (error) {
            console.error('❌ Error clearing all data:', error);
            return false;
        }
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
        this.maxQueueSize = 1000;
        this.processCallbacks = [];
        this.stats = {
            totalQueued: 0,
            totalProcessed: 0,
            totalFailed: 0,
            lastProcessed: null
        };
    }

    addToQueue(gpsData) {
        if (this.queue.length >= this.maxQueueSize) {
            console.warn('⚠️ Offline queue full, removing oldest item');
            this.queue.shift();
        }

        const queueItem = {
            ...gpsData,
            queueId: 'queue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            queueTimestamp: new Date().toISOString(),
            attempts: 0,
            status: 'queued'
        };

        this.queue.push(queueItem);
        this.stats.totalQueued++;
        
        console.log(`💾 Added to offline queue. Total: ${this.queue.length}`);
        
        return queueItem.queueId;
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
        this.maxBackgroundTime = 5 * 60 * 1000; // 5 minutes maximum background time
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
        
        // Check if background time was too long
        if (backgroundTime > this.maxBackgroundTime) {
            console.warn('⚠️ Extended background time detected, full recovery needed');
            this.performFullRecovery();
        } else {
            // Normal background resume
            this.resumeTracking();
        }
        
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

// ===== MAIN ENHANCED GPS LOGGER CLASS =====
class EnhancedDTGPSLogger {
    constructor() {
        // Enhanced Configuration with detailed settings
        this.waypointConfig = {
            collectionInterval: 1000,      // 1 second between GPS readings
            maxWaypoints: 61200,           // Maximum waypoints in buffer
            batchSize: 100,                // Waypoints per sync batch
            syncInterval: 30000,           // 30 seconds between sync attempts
            maxAccuracy: 50,               // Maximum GPS accuracy to accept (meters)
            minDistance: 0.0001,           // Minimum distance between points (km)
            maxSpeed: 180,                 // Maximum realistic speed (km/h)
            enableKalmanFilter: true,      // Enable Kalman filtering
            enableSpeedSmoothing: true,    // Enable speed smoothing
            offlineStorage: true,          // Enable offline storage
            realTimeTracking: true         // Enable real-time tracking
        };

        // Enhanced Components with comprehensive initialization
        this.gpsProcessor = new EnhancedGPSProcessor();
        this.speedCalculator = new EnhancedSpeedCalculator();
        this.cleanupManager = new FirebaseCleanupManager(database);
        this.kalmanFilter = new GPSKalmanFilter();
        this.resumeManager = new ResumeManager(this);

        // Storage & Buffers with enhanced capabilities
        this.waypointBuffer = new CircularBuffer(this.waypointConfig.maxWaypoints);
        this.unsyncedWaypoints = new Set();
        this.storageManager = new EnhancedStorageManager();
        
        // State Management with comprehensive tracking
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
        this.journeyStatus = 'ready'; // ready, started, paused, ended
        this.firebaseRef = null;
        
        // Real-time Tracking with enhanced metrics
        this.lastUpdateTime = null;
        this.currentSpeed = 0;
        this.speedHistory = [];
        this.distanceHistory = [];
        this.accuracyHistory = [];
        
        this.completeHistory = this.loadCompleteHistory();
        
        // Chat System with enhanced features
        this.chatRef = null;
        this.chatMessages = [];
        this.unreadCount = 0;
        this.isChatOpen = false;
        this.chatInitialized = false;
        this.lastMessageId = null;

        // Additional Features with comprehensive management
        this.offlineQueue = new OfflineQueueManager();
        this.autoPause = true;
        this.idleDetection = true;
        this.idleStartTime = null;
        this.idleThreshold = 300000; // 5 minutes in milliseconds
        
        // Recovery and Health Monitoring
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = 3;
        this.healthMetrics = {
            gpsUpdates: 0,
            waypoint
// ===== MAIN ENHANCED GPS LOGGER CLASS (Lanjutan) =====
class EnhancedDTGPSLogger {
    constructor() {
        // ... (konfigurasi sebelumnya)

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

        console.log('🚀 ENHANCED GPS Logger - All Systems Initialized');
        this.init();
    }

    init() {
        try {
            this.setupEventListeners();
            this.updateTime();
            this.checkNetworkStatus();
            this.setupPeriodicTasks();
            this.loadUnsyncedWaypoints();
            this.loadSystemState();
            
            // Setup resume callbacks
            this.resumeManager.addResumeCallback(() => {
                this.recoverFromBackground();
            });

            // Setup offline queue callbacks
            this.offlineQueue.addProcessCallback((results) => {
                this.addLog(`📡 Offline queue: ${results.sent} terkirim, ${results.failed} gagal`, 'info');
            });

            console.log('✅ System fully initialized with all features');
            
            // Perform initial health check
            setTimeout(() => this.healthCheck(), 5000);
            
        } catch (error) {
            console.error('❌ Error during system initialization:', error);
            this.addLog('Error inisialisasi sistem', 'error');
        }
    }

    setupEventListeners() {
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

        // Health check every 10 seconds
        setInterval(() => this.healthCheck(), 10000);

        // Performance monitoring every 30 seconds
        setInterval(() => this.updatePerformanceMetrics(), 30000);

        // Storage maintenance every hour
        setInterval(() => this.storageManager.performStorageMaintenance(), 3600000);

        // Sync waypoints every 2 minutes if online
        setInterval(() => {
            if (this.isOnline && this.unsyncedWaypoints.size > 0) {
                this.syncWaypointsToServer();
            }
        }, 120000);
    }

    // ===== RECOVERY SYSTEM =====
    recoverFromBackground() {
        console.log('🔄 Memulai recovery dari background...');
        this.healthMetrics.recoveryAttempts++;
        
        // Reset semua komponen GPS
        this.gpsProcessor.reset();
        this.speedCalculator.reset();
        
        // Restart GPS tracking
        if (this.driverData && this.journeyStatus === 'started') {
            this.stopRealGPSTracking();
            setTimeout(() => {
                this.startRealGPSTracking();
                this.addLog('GPS tracking di-resume setelah background', 'success');
            }, 1000);
        }

        // Force update semua tampilan
        this.updateAllDisplays();
        
        // Reset recovery attempts
        this.recoveryAttempts = 0;

        // Update health metrics
        this.healthMetrics.lastHealthCheck = new Date();
    }

    healthCheck() {
        const now = Date.now();
        
        // Check jika GPS stalled
        if (this.lastPosition && this.lastPosition.timestamp) {
            const timeSinceLastUpdate = now - this.lastPosition.timestamp.getTime();
            
            if (timeSinceLastUpdate > 30000 && this.isTracking) {
                console.warn('⚠️ GPS stalled, attempting recovery...');
                this.recoverGPS();
            }
        }

        // Check jika perlu resume dari background
        if (this.resumeManager.getTimeSinceLastActive() > 60000 && this.isTracking) {
            console.log('🔍 Performing background recovery check...');
            this.recoverFromBackground();
        }

        // Update health metrics
        this.healthMetrics.lastHealthCheck = new Date();
        this.performanceMetrics.totalUptime = now - this.healthMetrics.startTime;

        // Log health status periodically
        if (now % 60000 < 1000) { // Every minute
            console.log('❤️ System Health:', {
                uptime: Math.floor(this.performanceMetrics.totalUptime / 60000) + ' minutes',
                gpsUpdates: this.healthMetrics.gpsUpdates,
                waypointSaves: this.healthMetrics.waypointSaves,
                firebaseSends: this.healthMetrics.firebaseSends,
                errors: this.healthMetrics.errors
            });
        }
    }

    recoverGPS() {
        if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
            console.error('❌ Max recovery attempts reached, stopping GPS');
            this.stopRealGPSTracking();
            this.addLog('GPS gagal pulih setelah beberapa percobaan', 'error');
            return;
        }

        this.recoveryAttempts++;
        this.healthMetrics.recoveryAttempts++;
        console.log(`🔄 GPS Recovery attempt ${this.recoveryAttempts}`);

        // Stop dan restart GPS
        this.stopRealGPSTracking();
        
        setTimeout(() => {
            this.startRealGPSTracking();
            this.addLog(`Percobaan pemulihan GPS ${this.recoveryAttempts}`, 'warning');
        }, 2000);
    }

    // ===== SYSTEM STATE MANAGEMENT =====
    saveSystemState() {
        const systemState = {
            driverData: this.driverData,
            totalDistance: this.totalDistance,
            dataPoints: this.dataPoints,
            sessionStartTime: this.sessionStartTime,
            journeyStatus: this.journeyStatus,
            lastPosition: this.lastPosition,
            currentSpeed: this.currentSpeed,
            waypointCount: this.waypointBuffer.count,
            unsyncedCount: this.unsyncedWaypoints.size,
            healthMetrics: this.healthMetrics,
            timestamp: new Date().toISOString()
        };

        const success = this.storageManager.saveSystemState(systemState);
        if (success) {
            console.log('💾 System state saved successfully');
        } else {
            console.error('❌ Failed to save system state');
        }
    }

    loadSystemState() {
        const savedState = this.storageManager.loadSystemState();
        if (!savedState) return;

        // Only restore if session was active
        if (savedState.driverData && savedState.journeyStatus !== 'ready') {
            console.log('🔄 Loading previous system state...');
            
            this.driverData = savedState.driverData;
            this.totalDistance = savedState.totalDistance || 0;
            this.dataPoints = savedState.dataPoints || 0;
            this.journeyStatus = savedState.journeyStatus || 'ready';
            this.currentSpeed = savedState.currentSpeed || 0;

            // Restore session time
            if (savedState.sessionStartTime) {
                this.sessionStartTime = new Date(savedState.sessionStartTime);
            }

            // Update Firebase reference
            if (this.driverData?.unit) {
                this.firebaseRef = database.ref('/units/' + this.driverData.unit);
            }

            // Show driver app jika ada session aktif
            if (this.driverData) {
                this.showDriverApp();
                
                // Auto-resume tracking jika dalam perjalanan
                if (this.journeyStatus === 'started') {
                    setTimeout(() => {
                        this.startRealGPSTracking();
                        this.addLog('Session sebelumnya di-resume otomatis', 'success');
                    }, 2000);
                }
            }

            this.updateAllDisplays();
        }
    }

    updateAllDisplays() {
        this.updateTime();
        this.updateSessionDuration();
        this.updateWaypointDisplay();
        this.updateConnectionStatus(this.isOnline);
        
        // Update metrics
        document.getElementById('todayDistance')?.textContent = this.totalDistance.toFixed(3);
        document.getElementById('dataPoints')?.textContent = this.dataPoints;
        document.getElementById('currentSpeed')?.textContent = this.currentSpeed.toFixed(1);
        
        // Update journey status display
        this.updateJourneyStatusDisplay();

        // Update health indicators
        this.updateHealthIndicators();
    }

    updateJourneyStatusDisplay() {
        const vehicleStatus = document.getElementById('vehicleStatus');
        if (!vehicleStatus) return;

        switch(this.journeyStatus) {
            case 'started':
                vehicleStatus.textContent = 'ON TRIP';
                vehicleStatus.className = 'bg-success text-white rounded px-2 py-1';
                break;
            case 'paused':
                vehicleStatus.textContent = 'PAUSED';
                vehicleStatus.className = 'bg-warning text-dark rounded px-2 py-1';
                break;
            case 'ended':
                vehicleStatus.textContent = 'COMPLETED';
                vehicleStatus.className = 'bg-info text-white rounded px-2 py-1';
                break;
            default:
                vehicleStatus.textContent = 'READY';
                vehicleStatus.className = 'bg-secondary text-white rounded px-2 py-1';
        }
    }

    updateHealthIndicators() {
        // Update GPS status indicator
        const gpsIndicator = document.getElementById('gpsStatusIndicator');
        if (gpsIndicator) {
            if (this.isTracking && this.lastPosition) {
                const timeSinceUpdate = Date.now() - this.lastPosition.timestamp.getTime();
                if (timeSinceUpdate < 10000) {
                    gpsIndicator.className = 'gps-status active';
                    gpsIndicator.title = 'GPS Active';
                } else {
                    gpsIndicator.className = 'gps-status warning';
                    gpsIndicator.title = 'GPS Stalled';
                }
            } else {
                gpsIndicator.className = 'gps-status inactive';
                gpsIndicator.title = 'GPS Inactive';
            }
        }

        // Update storage indicator
        const storageIndicator = document.getElementById('storageStatusIndicator');
        if (storageIndicator) {
            const storageStats = this.storageManager.getStorageStatistics();
            if (storageStats.waypoints.storageHealth === 'healthy') {
                storageIndicator.className = 'storage-status healthy';
            } else if (storageStats.waypoints.storageHealth === 'warning') {
                storageIndicator.className = 'storage-status warning';
            } else {
                storageIndicator.className = 'storage-status critical';
            }
            storageIndicator.title = `Storage: ${storageStats.waypoints.storageHealth}`;
        }
    }

    // ===== REAL-TIME GPS TRACKING =====
    startRealGPSTracking() {
        if (!navigator.geolocation) {
            this.addLog('❌ GPS tidak didukung di browser ini', 'error');
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
        this.recoveryAttempts = 0;
        this.addLog('📍 GPS Real-Time diaktifkan', 'success');
    }

    stopRealGPSTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
        console.log('📍 GPS tracking stopped');
    }

    handleRealPositionUpdate(position) {
        const startTime = performance.now();
        
        try {
            this.healthMetrics.gpsUpdates++;
            
            const accuracy = position.coords.accuracy;
            console.log(`📍 GPS Update - Lat: ${position.coords.latitude.toFixed(6)}, Lng: ${position.coords.longitude.toFixed(6)}, Accuracy: ${accuracy}m`);

            const processedPosition = this.gpsProcessor.processRawPosition(position);
            
            if (!processedPosition) {
                console.log('🔇 Position filtered out by processor');
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
                kalmanAccuracy: processedPosition.accuracy,
                confidence: processedPosition.confidence
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
                confidence: processedPosition.confidence,
                timestamp: new Date().toISOString()
            });

            this.lastPosition = currentPosition;
            this.updateEnhancedGPSDisplay(currentPosition);

            // Reset recovery attempts on successful update
            this.recoveryAttempts = 0;

            // Update performance metrics
            this.performanceMetrics.gpsProcessingTime = performance.now() - startTime;

        } catch (error) {
            console.error('❌ Error in real-time position handling:', error);
            this.healthMetrics.errors++;
            this.addLog('Error processing GPS data', 'error');
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

        const startTime = performance.now();
        
        this.waypointBuffer.push(waypoint);
        this.unsyncedWaypoints.add(waypoint.id);
        
        this.healthMetrics.waypointSaves++;
        this.storageManager.saveWaypoint(waypoint);
        
        this.updateWaypointDisplay();
        
        this.dataPoints++;
        document.getElementById('dataPoints').textContent = this.dataPoints;

        console.log(`📍 GPS Point: ${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)}, Speed: ${this.currentSpeed.toFixed(1)}km/h, Confidence: ${waypoint.confidence?.toFixed(2) || 'N/A'}`);

        this.performanceMetrics.waypointSaveTime = performance.now() - startTime;
    }

    updateEnhancedGPSDisplay(waypoint) {
        document.getElementById('currentLat').textContent = waypoint.lat.toFixed(6);
        document.getElementById('currentLng').textContent = waypoint.lng.toFixed(6);
        document.getElementById('currentSpeed').textContent = this.currentSpeed.toFixed(1);
        document.getElementById('gpsAccuracy').textContent = waypoint.accuracy.toFixed(1) + ' m';
        document.getElementById('gpsBearing').textContent = waypoint.bearing ? waypoint.bearing + '°' : '-';
        
        const enhancedInfo = document.getElementById('enhancedInfo');
        if (enhancedInfo) {
            const confidence = waypoint.confidence ? (waypoint.confidence * 100).toFixed(0) + '%' : 'N/A';
            enhancedInfo.textContent = `🎯 Real-Time GPS | Confidence: ${confidence}`;
            enhancedInfo.className = waypoint.confidence > 0.7 ? 'text-success' : 
                                   waypoint.confidence > 0.4 ? 'text-warning' : 'text-danger';
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
        this.updateHealthIndicators();
        
        setTimeout(() => {
            this.startRealGPSTracking();
        }, 500);
        
        this.addLog(`✅ Login berhasil - ${this.driverData.name} (${this.driverData.unit}) - GPS Real-Time Enhanced`, 'success');
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

        const startTime = performance.now();
        
        try {
            this.healthMetrics.firebaseSends++;

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
                processed: true,
                confidence: this.lastPosition.confidence || 0.5,
                dataQuality: 'high'
            };

            if (this.isOnline) {
                await this.firebaseRef.set(gpsData);
                this.addLog(`📡 Data: ${this.currentSpeed.toFixed(1)} km/h | ${this.totalDistance.toFixed(3)} km`, 'success');
                this.updateConnectionStatus(true);
            } else {
                this.offlineQueue.addToQueue(gpsData);
                this.updateConnectionStatus(false);
            }
            
            this.performanceMetrics.firebaseSendTime = performance.now() - startTime;
            
        } catch (error) {
            console.error('Error sending to Firebase:', error);
            this.healthMetrics.errors++;
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
        this.updateJourneyStatusDisplay();
        this.addLog('Perjalanan dimulai - Real-time tracking aktif', 'success');
        this.sendToFirebase();
    }

    pauseJourney() {
        this.journeyStatus = 'paused';
        this.updateJourneyStatusDisplay();
        this.addLog('Perjalanan dijeda', 'warning');
        this.sendToFirebase();
    }

    endJourney() {
        this.journeyStatus = 'ended';
        this.updateJourneyStatusDisplay();
        this.addLog(`Perjalanan selesai - Total: ${this.totalDistance.toFixed(3)} km`, 'info');
        this.sendToFirebase();
        
        if (this.isOnline) {
            this.syncWaypointsToServer();
        }
    }

    reportIssue() {
        const issues = [
            'Mesin bermasalah', 'Ban bocor', 'Bahan bakar habis',
            'Kecelakaan kecil', 'Lainnya'
        ];
        
        const issue = prompt('Lapor masalah:\n' + issues.join('\n'));
        if (issue) {
            this.addLog(`Laporan: ${issue}`, 'warning');
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
        console.log(`📂 Loaded ${unsynced.length} unsynced waypoints from storage`);
    }

    loadCompleteHistory() {
        try {
            const saved = localStorage.getItem('gps_complete_history');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading complete history:', error);
            return [];
        }
    }

    async syncWaypointsToServer() {
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
            batchSize: batch.length,
            totalWaypoints: this.waypointBuffer.count,
            batchIndex: batchIndex
        };

        await batchRef.set(batchData);
        console.log(`✅ Batch ${batchIndex} uploaded: ${batch.length} waypoints`);
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
        this.saveSystemState();
    }

    updatePerformanceMetrics() {
        // Update performance metrics display
        const perfElement = document.getElementById('performanceMetrics');
        if (perfElement) {
            perfElement.innerHTML = `
                <small class="text-muted">
                    GPS: ${this.performanceMetrics.gpsProcessingTime.toFixed(1)}ms | 
                    Save: ${this.performanceMetrics.waypointSaveTime.toFixed(1)}ms | 
                    Firebase: ${this.performanceMetrics.firebaseSendTime.toFixed(1)}ms
                </small>
            `;
        }
    }

    // ===== ADDITIONAL FEATURES =====
    refreshData() {
        this.updateAllDisplays();
        this.addLog('Data diperbarui manual', 'info');
    }

    clearLogs() {
        const logContainer = document.getElementById('dataLogs');
        if (logContainer) {
            logContainer.innerHTML = '';
            this.addLog('Logs dibersihkan', 'info');
        }
    }

    exportData() {
        const data = {
            waypoints: this.waypointBuffer.getAll(),
            sessionData: {
                driver: this.driverData,
                totalDistance: this.totalDistance,
                dataPoints: this.dataPoints,
                sessionDuration: document.getElementById('sessionDuration')?.textContent,
                startTime: this.sessionStartTime
            },
            exportTime: new Date().toISOString()
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gps_data_${this.driverData?.unit || 'unknown'}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        this.addLog('Data diekspor', 'success');
    }

    showSettings() {
        // Implementation for settings modal
        alert('Settings feature akan diimplementasi');
    }

    showMaintenance() {
        // Implementation for maintenance modal
        alert('Maintenance feature akan diimplementasi');
    }

    emergencyStop() {
        if (confirm('EMERGENCY STOP: Hentikan semua tracking?')) {
            this.stopRealGPSTracking();
            this.stopTracking();
            this.journeyStatus = 'ended';
            this.addLog('EMERGENCY STOP: Semua tracking dihentikan', 'error');
        }
    }

    forceSync() {
        this.addLog('Memaksa sinkronisasi data...', 'warning');
        this.syncWaypointsToServer();
        this.offlineQueue.processQueue();
    }

    handleResize() {
        // Handle window resize for responsive design
        console.log('Window resized:', window.innerWidth, 'x', window.innerHeight);
    }

    handleOrientationChange() {
        // Handle orientation change for mobile devices
        console.log('Orientation changed:', screen.orientation?.type || 'unknown');
    }

    // ===== VALIDATION METHODS =====
    isValidCoordinate(lat, lng) {
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return false;
        }
        if (isNaN(lat) || isNaN(lng)) {
            return false;
        }
        return true;
    }

    handleGPSError(error) {
        let message = '';
        let instructions = '';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = '❌ Izin GPS Ditolak';
                instructions = '📱 Buka: Settings → Site Settings → Location → Allow';
                break;
            case error.POSITION_UNAVAILABLE:
                message = '❌ GPS Device Tidak Aktif';
                instructions = 'Aktifkan GPS/Lokasi di pengaturan device';
                break;
            case error.TIMEOUT:
                message = '⏱️ Timeout GPS';
                instructions = 'Cari area dengan sinyal lebih baik';
                break;
            default:
                message = '❌ Error GPS Tidak Diketahui';
                break;
        }
        
        this.addLog(`${message} - ${instructions}`, 'error');
        this.healthMetrics.errors++;
    }

    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        if (this.sendInterval) {
            clearInterval(this.sendInterval);
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        if (this.firebaseRef) {
            this.firebaseRef.remove();
        }
        this.isTracking = false;
        console.log('🛑 All tracking stopped');
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
                
                // Stop semua tracking
                this.stopRealGPSTracking();
                this.stopTracking();
                
                // Schedule Firebase cleanup
                if (this.driverData && this.driverData.unit && this.driverData.sessionId) {
                    await this.cleanupManager.scheduleCleanup(this.driverData.unit, this.driverData.sessionId);
                }
                
                // Reset semua enhanced components
                this.gpsProcessor.reset();
                this.speedCalculator.reset();
                this.kalmanFilter.reset();
                
                // Clear system state
                this.storageManager.clearSystemState();
                
                // Session summary
                const sessionSummary = {
                    driver: this.driverData?.name,
                    unit: this.driverData?.unit,
                    duration: document.getElementById('sessionDuration')?.textContent || '00:00:00',
                    totalDistance: this.totalDistance.toFixed(3),
                    dataPoints: this.dataPoints,
                    waypointsCollected: this.waypointBuffer.count,
                    unsyncedWaypoints: this.unsyncedWaypoints.size,
                    avgSpeed: document.getElementById('avgSpeed')?.textContent || '0',
                    sessionId: this.driverData?.sessionId,
                    cleanupScheduled: true,
                    healthMetrics: this.healthMetrics
                };
                
                console.log('Session Summary:', sessionSummary);
                this.addLog(`Session ended - ${this.waypointBuffer.count} waypoints collected - Firebase cleanup scheduled`, 'info');
                
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
                this.chatInitialized = false;
                
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
                this.lastUpdateTime = null;
                this.currentSpeed = 0;
                this.journeyStatus = 'ready';
                
                // Reset health metrics
                this.healthMetrics = {
                    gpsUpdates: 0,
                    waypointSaves: 0,
                    firebaseSends: 0,
                    errors: 0,
                    recoveryAttempts: 0,
                    startTime: new Date(),
                    lastHealthCheck: new Date()
                };
                
                this.addLog('✅ Logout berhasil - Data Firebase dijadwalkan untuk cleanup', 'success');
                
            } catch (error) {
                console.error('Error during logout:', error);
                this.addLog('❌ Error during logout, but local data cleared', 'error');
            }
        }
    }

    // ===== SYSTEM DIAGNOSTICS =====
    getSystemDiagnostics() {
        return {
            app: {
                version: '2.0.0',
                uptime: this.performanceMetrics.totalUptime,
                journeyStatus: this.journeyStatus,
                isTracking: this.isTracking,
                isOnline: this.isOnline
            },
            gps: {
                isActive: this.isTracking,
                lastPosition: this.lastPosition,
                currentSpeed: this.currentSpeed,
                quality: this.gpsProcessor.getQualityMetrics(),
                recoveryAttempts: this.recoveryAttempts
            },
            data: {
                totalDistance: this.totalDistance,
                dataPoints: this.dataPoints,
                waypoints: this.waypointBuffer.getStats(),
                storage: this.storageManager.getStorageStatistics()
            },
            network: {
                status: this.isOnline ? 'online' : 'offline',
                offlineQueue: this.offlineQueue.getQueueStats(),
                cleanupQueue: this.cleanupManager.getQueueStatus()
            },
            performance: this.performanceMetrics,
            health: this.healthMetrics,
            recovery: this.resumeManager.getRecoveryStats()
        };
    }

    printDiagnostics() {
        const diagnostics = this.getSystemDiagnostics();
        console.log('🩺 System Diagnostics:', diagnostics);
        return diagnostics;
    }
}

// ===== APPLICATION INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Enhanced GPS Tracker...');
    
    try {
        window.dtLogger = new EnhancedDTGPSLogger();
        console.log('✅ Enhanced GPS Tracker initialized successfully');
        
        // Expose diagnostics for debugging
        window.getGPSDiagnostics = () => window.dtLogger?.printDiagnostics();
        
    } catch (error) {
        console.error('❌ Failed to initialize GPS Tracker:', error);
        alert('Gagal menginisialisasi aplikasi GPS. Silakan refresh halaman.');
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

console.log('🎉 script-mobile.js loaded successfully');

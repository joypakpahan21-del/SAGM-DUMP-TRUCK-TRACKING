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
            MAX_WAYPOINTS: 250000, // 250K waypoints
            WARNING_THRESHOLD: 200000,
            CRITICAL_THRESHOLD: 230000,
            COMPRESSION_THRESHOLD: 50000, // Compress after 50K points
            ARCHIVE_THRESHOLD: 100000, // Archive after 100K points
            CLEANUP_PERCENTAGE: 0.15 // Clean 15% when full
        };
        
        this.compressionEnabled = true;
        this.autoArchiveEnabled = true;
        
        this.init();
    }

    init() {
        this.ensureStorageStructure();
        this.migrateOldData();
        this.startStorageMonitor();
    }

    ensureStorageStructure() {
        try {
            // Initialize with empty arrays if not exists
            if (!localStorage.getItem(this.STORAGE_KEYS.WAYPOINTS)) {
                localStorage.setItem(this.STORAGE_KEYS.WAYPOINTS, JSON.stringify([]));
            }
            if (!localStorage.getItem(this.STORAGE_KEYS.COMPRESSED_DATA)) {
                localStorage.setItem(this.STORAGE_KEYS.COMPRESSED_DATA, JSON.stringify([]));
            }
            if (!localStorage.getItem(this.STORAGE_KEYS.ARCHIVED_DATA)) {
                localStorage.setItem(this.STORAGE_KEYS.ARCHIVED_DATA, JSON.stringify([]));
            }

            // Initialize metadata
            if (!localStorage.getItem(this.STORAGE_KEYS.STORAGE_METADATA)) {
                this.updateStorageMetadata({
                    totalStored: 0,
                    compressedCount: 0,
                    archivedCount: 0,
                    compressionRatio: 1.0,
                    lastMaintenance: new Date().toISOString(),
                    storageVersion: '2.0'
                });
            }

            // Initialize other storage keys
            const defaultKeys = [
                this.STORAGE_KEYS.SYNC_STATUS,
                this.STORAGE_KEYS.SESSION_DATA,
                this.STORAGE_KEYS.DRIVER_PROFILES,
                this.STORAGE_KEYS.VEHICLE_PROFILES,
                this.STORAGE_KEYS.SYSTEM_STATE,
                this.STORAGE_KEYS.APP_SETTINGS
            ];

            defaultKeys.forEach(key => {
                if (!localStorage.getItem(key)) {
                    localStorage.setItem(key, JSON.stringify({}));
                }
            });

            console.log('✅ Enhanced storage structure initialized');
        } catch (error) {
            console.error('❌ Error initializing storage structure:', error);
        }
    }

    migrateOldData() {
        // Migrate from old storage format if exists
        const oldWaypoints = localStorage.getItem('enhanced_gps_waypoints');
        if (oldWaypoints) {
            try {
                const waypoints = JSON.parse(oldWaypoints);
                this.saveToStorage(waypoints);
                localStorage.removeItem('enhanced_gps_waypoints');
                console.log('✅ Migrated old waypoints data');
            } catch (error) {
                console.error('❌ Error migrating old data:', error);
            }
        }
    }

    startStorageMonitor() {
        // Monitor storage every 5 minutes
        setInterval(() => {
            this.checkStorageHealth();
        }, 300000);
    }

    async saveWaypoint(waypoint) {
        try {
            if (!waypoint || !waypoint.id) {
                throw new Error('Invalid waypoint data');
            }

            let allWaypoints = this.loadAllWaypoints();
            
            // Check if we need compression or archiving
            if (allWaypoints.length >= this.QUOTA_LIMITS.COMPRESSION_THRESHOLD && this.compressionEnabled) {
                console.log('📦 Compressing waypoint data...');
                allWaypoints = await this.compressWaypoints(allWaypoints);
            }

            if (allWaypoints.length >= this.QUOTA_LIMITS.ARCHIVE_THRESHOLD && this.autoArchiveEnabled) {
                console.log('🗃️ Archiving old waypoints...');
                allWaypoints = this.archiveOldWaypoints(allWaypoints);
            }

            // Check storage limits
            if (allWaypoints.length >= this.QUOTA_LIMITS.MAX_WAYPOINTS) {
                console.warn('🚨 Storage limit reached, performing emergency cleanup');
                allWaypoints = this.performEmergencyCleanup(allWaypoints);
            }

            const existingIndex = allWaypoints.findIndex(wp => wp.id === waypoint.id);
            
            if (existingIndex >= 0) {
                // Update existing waypoint
                allWaypoints[existingIndex] = {
                    ...allWaypoints[existingIndex],
                    ...waypoint,
                    updatedAt: new Date().toISOString(),
                    updateCount: (allWaypoints[existingIndex].updateCount || 0) + 1
                };
            } else {
                // Add new waypoint with enhanced metadata
                const enhancedWaypoint = {
                    ...waypoint,
                    createdAt: new Date().toISOString(),
                    storageVersion: '2.0',
                    dataQuality: this.assessDataQuality(waypoint),
                    sizeEstimate: this.calculateSize(waypoint),
                    compressionState: 'raw'
                };
                allWaypoints.push(enhancedWaypoint);
            }

            this.saveToStorage(allWaypoints);
            
            // Update sync status
            this.updateSyncStatus({
                totalWaypoints: allWaypoints.length,
                unsyncedCount: allWaypoints.filter(w => !w.synced).length,
                lastSave: new Date().toISOString(),
                storageHealth: this.checkStorageHealth()
            });

            // Update storage metadata
            this.updateStorageMetadata({
                totalStored: allWaypoints.length,
                lastUpdate: new Date().toISOString()
            });

            return true;
            
        } catch (error) {
            console.error('❌ Failed to save waypoint:', error);
            
            // Emergency fallback: try to save with minimal data
            if (error.name === 'QuotaExceededError') {
                return this.emergencySave(waypoint);
            }
            
            return false;
        }
    }

    async compressWaypoints(waypoints) {
        if (!this.compressionEnabled) return waypoints;

        try {
            console.log('🔧 Compressing waypoint data...');
            
            // Simple compression: remove redundant data and use smaller keys
            const compressed = waypoints.map(wp => ({
                i: wp.id, // id
                la: wp.lat, // lat
                ln: wp.lng, // lng
                t: wp.timestamp, // timestamp
                s: wp.synced, // synced
                a: wp.accuracy, // accuracy
                sp: wp.speed, // speed
                c: wp.confidence // confidence
                // Remove less critical fields for compression
            }));

            // Store compressed data
            const existingCompressed = this.loadCompressedData();
            existingCompressed.push({
                batchId: `compressed_${Date.now()}`,
                originalCount: waypoints.length,
                compressedCount: compressed.length,
                compressionRatio: (waypoints.length / compressed.length).toFixed(2),
                compressedAt: new Date().toISOString(),
                data: compressed
            });

            localStorage.setItem(this.STORAGE_KEYS.COMPRESSED_DATA, JSON.stringify(existingCompressed));
            
            // Update metadata
            this.updateStorageMetadata({
                compressedCount: existingCompressed.length,
                compressionRatio: (waypoints.length / compressed.length)
            });

            console.log(`✅ Compressed ${waypoints.length} waypoints`);
            
            // Return empty array since data is now compressed
            return [];

        } catch (error) {
            console.error('❌ Compression failed:', error);
            return waypoints; // Return original data if compression fails
        }
    }

    archiveOldWaypoints(waypoints) {
        if (!this.autoArchiveEnabled) return waypoints;

        try {
            console.log('🗃️ Archiving old waypoints...');
            
            const now = new Date();
            const archiveThreshold = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
            
            const toArchive = waypoints.filter(wp => {
                const wpDate = new Date(wp.createdAt || wp.timestamp);
                return wpDate < archiveThreshold && wp.synced; // Only archive synced old data
            });

            const toKeep = waypoints.filter(wp => {
                const wpDate = new Date(wp.createdAt || wp.timestamp);
                return wpDate >= archiveThreshold || !wp.synced; // Keep recent or unsynced data
            });

            if (toArchive.length > 0) {
                const existingArchived = this.loadArchivedData();
                existingArchived.push({
                    archiveId: `archive_${Date.now()}`,
                    archivedAt: new Date().toISOString(),
                    count: toArchive.length,
                    data: toArchive
                });

                localStorage.setItem(this.STORAGE_KEYS.ARCHIVED_DATA, JSON.stringify(existingArchived));
                
                // Update metadata
                this.updateStorageMetadata({
                    archivedCount: existingArchived.length
                });

                console.log(`✅ Archived ${toArchive.length} old waypoints`);
            }

            return toKeep;

        } catch (error) {
            console.error('❌ Archiving failed:', error);
            return waypoints;
        }
    }

    performEmergencyCleanup(waypoints) {
        console.warn('🚨 Performing emergency storage cleanup');
        
        // Remove oldest synced waypoints first
        const synced = waypoints.filter(wp => wp.synced);
        const unsynced = waypoints.filter(wp => !wp.synced);
        
        // Sort synced by creation date (oldest first)
        synced.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // Remove oldest 15%
        const removeCount = Math.floor(waypoints.length * this.QUOTA_LIMITS.CLEANUP_PERCENTAGE);
        const remainingSynced = synced.slice(removeCount);
        
        // Combine back with unsynced
        const cleaned = [...remainingSynced, ...unsynced];
        
        console.log(`🧹 Emergency cleanup: Removed ${removeCount} waypoints, ${cleaned.length} remaining`);
        
        return cleaned;
    }

    emergencySave(waypoint) {
        try {
            // Extreme minimal save - only critical data
            const emergencyData = {
                id: waypoint.id,
                lat: waypoint.lat,
                lng: waypoint.lng,
                t: waypoint.timestamp, // truncated key
                s: false // synced
            };

            const emergencyKey = 'emergency_gps_data';
            let emergencyStorage = localStorage.getItem(emergencyKey);
            let data = emergencyStorage ? JSON.parse(emergencyStorage) : [];
            
            data.push(emergencyData);
            
            // Keep only last 1000 emergency points
            if (data.length > 1000) {
                data = data.slice(-1000);
            }
            
            localStorage.setItem(emergencyKey, JSON.stringify(data));
            console.warn('🚨 Saved to emergency storage');
            return true;
            
        } catch (error) {
            console.error('❌ Emergency save failed:', error);
            return false;
        }
    }

    calculateSize(obj) {
        // Rough size estimation in bytes
        return JSON.stringify(obj).length;
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
                const reducedWaypoints = this.performEmergencyCleanup(waypoints);
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
            const compressed = this.loadCompressedData();
            const archived = this.loadArchivedData();
            
            const totalPoints = waypoints.length + 
                               compressed.reduce((sum, batch) => sum + batch.compressedCount, 0) +
                               archived.reduce((sum, archive) => sum + archive.count, 0);
            
            const usagePercentage = (totalPoints / this.QUOTA_LIMITS.MAX_WAYPOINTS) * 100;
            
            if (usagePercentage >= 95) return 'critical';
            if (usagePercentage >= 80) return 'warning';
            if (usagePercentage >= 50) return 'normal';
            return 'healthy';
        } catch (error) {
            return 'error';
        }
    }

    updateStorageMetadata(metadata) {
        try {
            const existing = this.getStorageMetadata();
            const updated = {
                ...existing,
                ...metadata,
                updatedAt: new Date().toISOString()
            };
            
            localStorage.setItem(this.STORAGE_KEYS.STORAGE_METADATA, JSON.stringify(updated));
        } catch (error) {
            console.error('❌ Error updating storage metadata:', error);
        }
    }

    getStorageMetadata() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.STORAGE_METADATA);
            return data ? JSON.parse(data) : {
                totalStored: 0,
                compressedCount: 0,
                archivedCount: 0,
                compressionRatio: 1.0,
                lastMaintenance: new Date().toISOString(),
                storageVersion: '2.0',
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Error getting storage metadata:', error);
            return {};
        }
    }

    loadCompressedData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.COMPRESSED_DATA);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Error loading compressed data:', error);
            return [];
        }
    }

    loadArchivedData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.ARCHIVED_DATA);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('❌ Error loading archived data:', error);
            return [];
        }
    }

    getEnhancedStorageStatistics() {
        const waypoints = this.loadAllWaypoints();
        const compressed = this.loadCompressedData();
        const archived = this.loadArchivedData();
        const metadata = this.getStorageMetadata();
        
        const totalPoints = waypoints.length + 
                           compressed.reduce((sum, batch) => sum + batch.compressedCount, 0) +
                           archived.reduce((sum, archive) => sum + archive.count, 0);

        return {
            capacity: {
                maxWaypoints: this.QUOTA_LIMITS.MAX_WAYPOINTS,
                currentUsage: totalPoints,
                usagePercentage: ((totalPoints / this.QUOTA_LIMITS.MAX_WAYPOINTS) * 100).toFixed(1) + '%',
                health: this.checkStorageHealth()
            },
            breakdown: {
                active: waypoints.length,
                compressed: compressed.reduce((sum, batch) => sum + batch.compressedCount, 0),
                archived: archived.reduce((sum, archive) => sum + archive.count, 0),
                total: totalPoints
            },
            compression: {
                enabled: this.compressionEnabled,
                batches: compressed.length,
                averageRatio: metadata.compressionRatio || 1.0
            },
            archiving: {
                enabled: this.autoArchiveEnabled,
                archives: archived.length
            },
            syncStatus: this.getSyncStatus(),
            metadata: metadata
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
            maxWaypoints: 250000,          // 250K waypoints - ENHANCED
            batchSize: 100,                // Waypoints per sync batch
            syncInterval: 30000,           // 30 seconds between sync attempts
            maxAccuracy: 50,               // Maximum GPS accuracy to accept (meters)
            minDistance: 0.0001,           // Minimum distance between points (km)
            maxSpeed: 180,                 // Maximum realistic speed (km/h)
            enableKalmanFilter: true,      // Enable Kalman filtering
            enableSpeedSmoothing: true,    // Enable speed smoothing
            offlineStorage: true,          // Enable offline storage
            realTimeTracking: true,        // Enable real-time tracking
            enableCompression: true,       // ENHANCED: Enable data compression
            autoArchive: true              // ENHANCED: Enable auto archiving
        };

        // Enhanced Components with comprehensive initialization
        this.gpsProcessor = new EnhancedGPSProcessor();
        this.speedCalculator = new EnhancedSpeedCalculator();
        this.cleanupManager = new FirebaseCleanupManager(database);
        this.kalmanFilter = new GPSKalmanFilter();
        this.resumeManager = new ResumeManager(this);
        
        // NEW ENHANCED COMPONENTS
        this.retryManager = new EnhancedRetryManager();
        this.storageManager = new EnhancedStorageManager();
        this.syncManager = new IntelligentSyncManager();

        // Storage & Buffers with enhanced capabilities
        this.waypointBuffer = new CircularBuffer(this.waypointConfig.maxWaypoints);
        this.unsyncedWaypoints = new Set();
        
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

    setupEnhancedFeatures() {
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

    async triggerEnhancedSync() {
        if (!this.isOnline) return;
        
        try {
            await this.syncManager.triggerSmartSync();
        } catch (error) {
            console.error('Enhanced sync failed:', error);
            this.addLog('Smart sync gagal', 'error');
        }
    }

    checkEnhancedStorageHealth() {
        const storageStats = this.storageManager.getEnhancedStorageStatistics();
        
        if (storageStats.capacity.health === 'critical') {
            this.addLog('🚨 Storage hampir penuh!', 'error');
            this.triggerEmergencyCleanup();
        } else if (storageStats.capacity.health === 'warning') {
            this.addLog('⚠️ Storage menipis', 'warning');
        }
    }

    triggerEmergencyCleanup() {
        // Perform emergency storage cleanup
        const waypoints = this.storageManager.loadAllWaypoints();
        const cleaned = this.storageManager.performEmergencyCleanup(waypoints);
        this.storageManager.saveToStorage(cleaned);
        this.addLog('Emergency storage cleanup dilakukan', 'warning');
    }

    getEnhancedSystemStatus() {
        return {
            storage: this.storageManager.getEnhancedStorageStatistics(),
            retry: this.retryManager.getQueueStats(),
            sync: this.syncManager.getSyncAnalytics(),
            network: this.syncManager.networkInfo,
            performance: {
                gpsUpdates: this.healthMetrics.gpsUpdates,
                waypointSaves: this.healthMetrics.waypointSaves,
                firebaseSends: this.healthMetrics.firebaseSends
            }
        };
    }

    // === IMPLEMENTASI LENGKAP DARI SEMUA METHOD YANG ADA DI KODE LAMA ===

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

    handleLogin() {
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

        // Initialize Firebase reference
        this.firebaseRef = database.ref('/units/' + this.driverData.unit);
        this.chatRef = database.ref('/chat/' + this.driverData.unit);

        // Show main interface
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainInterface').classList.remove('hidden');

        this.addLog(`Driver ${driverName} (Unit ${unitNumber}) login berhasil`, 'success');
        this.updateDriverDisplay();
    }

    startJourney() {
        if (!this.driverData) {
            this.addLog('Silakan login terlebih dahulu', 'error');
            return;
        }

        this.journeyStatus = 'started';
        this.sessionStartTime = new Date();
        this.totalDistance = 0;
        this.dataPoints = 0;

        this.startRealGPSTracking();
        this.startDataTransmission();

        this.addLog('Perjalanan dimulai', 'success');
        this.updateJourneyDisplay();
    }

    pauseJourney() {
        this.journeyStatus = 'paused';
        this.stopRealGPSTracking();
        
        this.addLog('Perjalanan dijeda', 'warning');
        this.updateJourneyDisplay();
    }

    endJourney() {
        this.journeyStatus = 'ended';
        this.stopRealGPSTracking();
        this.stopDataTransmission();

        // Schedule cleanup
        this.cleanupManager.scheduleCleanup(this.driverData.unit, this.driverData.sessionId, 'journey_ended');

        this.addLog('Perjalanan selesai', 'success');
        this.updateJourneyDisplay();
    }

    startRealGPSTracking() {
        if (this.watchId) {
            console.warn('GPS tracking sudah berjalan');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 1000
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleGPSPosition(position),
            (error) => this.handleGPSError(error),
            options
        );

        this.isTracking = true;
        console.log('📍 GPS tracking started');
    }

    stopRealGPSTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
        console.log('📍 GPS tracking stopped');
    }

    handleGPSPosition(position) {
        this.healthMetrics.gpsUpdates++;
        
        // Process raw GPS data through enhanced processor
        const processedPosition = this.gpsProcessor.processRawPosition(position);
        if (!processedPosition) {
            console.warn('🚫 GPS position rejected by processor');
            return;
        }

        // Calculate enhanced speed
        const enhancedSpeed = this.speedCalculator.calculateEnhancedSpeed(
            processedPosition,
            this.lastPosition,
            processedPosition.speed
        );

        // Update current state
        this.lastPosition = processedPosition;
        this.currentSpeed = enhancedSpeed;

        // Calculate distance if we have previous position
        if (this.lastPosition) {
            const distance = this.calculateDistance(
                this.lastPosition.lat, this.lastPosition.lng,
                processedPosition.lat, processedPosition.lng
            );
            this.totalDistance += distance;
        }

        // Create waypoint
        const waypoint = {
            id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            lat: processedPosition.lat,
            lng: processedPosition.lng,
            speed: enhancedSpeed,
            accuracy: processedPosition.accuracy,
            bearing: processedPosition.bearing,
            timestamp: new Date().toISOString(),
            confidence: processedPosition.confidence,
            synced: false,
            kalmanFiltered: true
        };

        // Save to storage and buffers
        this.saveWaypoint(waypoint);
        this.waypointBuffer.push(waypoint);
        this.unsyncedWaypoints.add(waypoint.id);

        // Update displays
        this.updateAllDisplays();
        
        console.log(`📍 GPS Update: ${waypoint.lat.toFixed(6)}, ${waypoint.lng.toFixed(6)} | Speed: ${enhancedSpeed.toFixed(1)} km/h | Accuracy: ${waypoint.accuracy.toFixed(1)}m`);
    }

    handleGPSError(error) {
        let errorMessage = 'GPS Error: ';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage += 'Akses GPS ditolak';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage += 'Posisi tidak tersedia';
                break;
            case error.TIMEOUT:
                errorMessage += 'Timeout mendapatkan posisi';
                break;
            default:
                errorMessage += 'Error tidak diketahui';
        }
        
        console.error('❌ ' + errorMessage);
        this.addLog(errorMessage, 'error');
        
        this.healthMetrics.errors++;
    }

    saveWaypoint(waypoint) {
        this.storageManager.saveWaypoint(waypoint);
        this.healthMetrics.waypointSaves++;
    }

    startDataTransmission() {
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
        }, this.waypointConfig.syncInterval);

        console.log('📡 Data transmission started');
    }

    stopDataTransmission() {
        if (this.sendInterval) {
            clearInterval(this.sendInterval);
            this.sendInterval = null;
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        console.log('📡 Data transmission stopped');
    }

    async sendRealTimeData() {
        if (!this.firebaseRef || !this.lastPosition) return;

        try {
            const realTimeData = this.getRealTimeData();
            await this.firebaseRef.set(realTimeData);
            this.healthMetrics.firebaseSends++;
        } catch (error) {
            console.error('❌ Failed to send real-time data:', error);
            this.addLog('Gagal mengirim data real-time', 'error');
        }
    }

    getRealTimeData() {
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
            dataQuality: 'high'
        };
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
    }

    async uploadBatch(batch, batchIndex) {
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
            batchIndex: batchIndex
        };

        await batchRef.set(batchData);
    }

    // === IMPLEMENTASI METHOD-METHOD TAMBAHAN ===

    getUnsyncedWaypoints() {
        return this.storageManager.loadUnsyncedWaypoints();
    }

    createBatches(array, batchSize) {
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
        const now = new Date();
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString('id-ID');
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
            savedAt: new Date().toISOString()
        };

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
            health: this.healthMetrics,
            performance: this.performanceMetrics,
            collectedAt: new Date().toISOString()
        };
    }

    recoverFromBackground() {
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

    toggleChat() {
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

    initializeChat() {
        if (this.chatInitialized || !this.chatRef) return;

        this.chatRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            this.displayChatMessage(message);
        });

        this.chatInitialized = true;
        console.log('💬 Chat system initialized');
    }

    displayChatMessage(message) {
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

    updateChatBadge() {
        const chatBadge = document.getElementById('chatBadge');
        if (chatBadge) {
            chatBadge.textContent = this.unreadCount > 0 ? this.unreadCount.toString() : '';
            chatBadge.style.display = this.unreadCount > 0 ? 'block' : 'none';
        }
    }

    async sendChatMessage() {
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

    loadChatMessages() {
        // Clear unread count when opening chat
        this.unreadCount = 0;
        this.updateChatBadge();
    }

    // === IMPLEMENTASI METHOD TAMBAHAN ===

    reportIssue() {
        const issue = prompt('Deskripsikan masalah yang ditemukan:');
        if (issue) {
            this.addLog(`Laporan masalah: ${issue}`, 'warning');
            // In real implementation, send this to server
        }
    }

    logout() {
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
        
        // Show login screen
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainInterface').classList.add('hidden');
        
        this.addLog('Logout berhasil', 'success');
    }

    refreshData() {
        this.updateAllDisplays();
        this.addLog('Data diperbarui', 'info');
    }

    clearLogs() {
        const logElement = document.getElementById('systemLog');
        if (logElement) {
            logElement.innerHTML = '';
        }
        this.addLog('Logs dibersihkan', 'info');
    }

    exportData() {
        this.storageManager.exportData();
        this.addLog('Data diekspor', 'success');
    }

    showSettings() {
        alert('Settings panel akan ditampilkan di sini');
        // Implementation for settings dialog
    }

    showMaintenance() {
        alert('Maintenance panel akan ditampilkan di sini');
        // Implementation for maintenance operations
    }

    emergencyStop() {
        this.stopRealGPSTracking();
        this.stopDataTransmission();
        this.journeyStatus = 'ended';
        
        this.addLog('EMERGENCY STOP - Semua aktivitas dihentikan', 'error');
        this.updateJourneyDisplay();
    }

    forceSync() {
        this.syncManager.forceSync();
        this.addLog('Sinkronisasi paksa dimulai', 'info');
    }

    handleResize() {
        // Handle window resize if needed
        console.log('Window resized');
    }

    handleOrientationChange() {
        // Handle orientation change if needed
        console.log('Orientation changed');
    }

    printDiagnostics() {
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

// ===== APPLICATION INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Enhanced GPS Tracker...');
    
    try {
        window.dtLogger = new EnhancedDTGPSLogger();
        console.log('✅ Enhanced GPS Tracker initialized successfully');
        
        // Expose diagnostics for debugging
        window.getGPSDiagnostics = () => window.dtLogger?.printDiagnostics();
        window.getEnhancedStatus = () => window.dtLogger?.getEnhancedSystemStatus();
        
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

console.log('🎉 script-mobile.js loaded successfully with ENHANCED features!');

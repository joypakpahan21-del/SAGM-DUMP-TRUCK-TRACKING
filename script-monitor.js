
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBMiER_5b51IEEoxivkCliRC0WID1f-yzk",
    authDomain: "joi-gps-tracker.firebaseapp.com",
    databaseURL: "https://joi-gps-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "joi-gps-tracker",
    storageBucket: "joi-gps-tracker.firebasestorage.app",
    messagingSenderId: "216572191895",
    appId: "1:216572191895:web:a4fef1794daf200a2775d2"
};

if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
}
const database = firebase.database();
const filters = ['searchUnit', 'filterAfdeling', 'filterStatus'];

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

class AdvancedSAGMGpsTracking {
    constructor() {
        console.log('🚀 Initializing Advanced GPS Tracking System with Complete Analytics...');
        this.units = new Map();
        this.markers = new Map();
        this.unitPolylines = new Map();
        this.unitHistory = new Map();
        this.unitSessions = new Map();
        this.driverOnlineStatus = new Map();
        this.lastDataTimestamps = new Map();
        this.selectedUnit = null;
        this.analyticsEngine = new AnalyticsEngine(this);
        this.geofencingManager = new GeofencingManager(this);
        this.violationDetector = new ViolationDetector(this);
        this.performanceManager = new PerformanceManager(this);
        this.heatmapManager = new HeatmapManager(this);
        this.maintenancePredictor = new MaintenancePredictor(this);
        this.reportGenerator = new ReportGenerator(this);
        this.notificationSystem = new NotificationSystem(this);
        this.offlineQueue = new Map();
        this.isOnline = true;
        this.backgroundSyncInterval = null;
        this.serviceWorkerRegistration = null;
        this.serviceWorkerReady = false;
        this.setupServiceWorker();
        this.cleanupCallbacks = [];
        this.intervals = new Set();
        this.firebaseListeners = new Map();
        this.cleanupInterval = null;
        this.lastCleanupTime = null;
        this.inactiveUnitTracker = new Map();
        this.dataCorrectionQueue = new Map();
        this.updateDebounce = null;
        this.lastRenderTime = 0;
        this.renderThrottleMs = 500;
        this.map = null;
        this.importantMarkers = [];
        this.activeUnits = 0;
        this.totalDistance = 0;
        this.avgSpeed = 0;
        this.avgPerformanceScore = 0;
        this.totalViolations = 0;
        this.lastUpdate = new Date();
        this.autoRefreshInterval = null;
        this.firebaseListener = null;
        // ✅ HANYA SISTEM CHAT MONITOR YANG BENAR
        this.monitorChatRefs = new Map();
        this.monitorChatMessages = new Map();
        this.monitorUnreadCounts = new Map();
        this.activeChatUnit = null;
        this.isMonitorChatOpen = false;
        this.monitorChatInitialized = false;
        this.isMonitorTyping = false;
        this.monitorTypingTimeout = null;
        this.showRoutes = true;
        this.routeColors = new Map();
        this.routeControls = null;
        this.maxRoutePoints = Infinity;
        this.dataLogger = {
            logs: [],
            maxLogs: 1000,
            logLevels: {
                INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error',
                GPS: 'gps', SYSTEM: 'system', ANALYTICS: 'analytics', VIOLATION: 'violation',
                MAINTENANCE: 'maintenance'
            }
        };
        this.vehicleConfig = {
            maxSpeed: 80,
            optimalSpeed: 40,
            dailyDistanceTarget: 95,
            maxIdleTime: 30,
            maintenanceIntervals: {
                oilChange: 2500,
                tireRotation: 1000,
                gearOilChange: 10000,
                differentialOilChange: 10000,
                fuelAndOilFilterChange: 2500,
                airFilterChange: 5000,
                brakeService: 8000,
                majorService: 10000
            }   
        };
        this.importantLocations = {
            PKS_SAGM: { 
                lat: -0.43452332690449164, 
                lng: 102.96741072417917, 
                name: "PKS SAGM",
                type: "pks",
                radius: 500
            },
            KANTOR_KEBUN: { 
                lat: -0.3575865859028525, 
                lng: 102.95047687287101, 
                name: "Kantor Kebun PT SAGM",
                type: "office", 
                radius: 300
            },
            Afdeling_1: {
        lat: -0.3984773214165855,
        lng: 102.91875036695578,
        name: "Kantor Afdeling 1",
        type: "afdeling_office",
        radius: 150
    },
    Afdeling_2: {
        lat: -0.3894919960706564,
        lng: 102.93819088929065,
        name: "Kantor Afdeling 2",
        type: "afdeling_office",
        radius: 150
    },
    Afdeling_3: {
        lat: -0.35891411851916827,
        lng: 102.95544678239833,
        name: "Kantor Afdeling 3",
        type: "afdeling_office",
        radius: 150
    },
    Afdeling_4: {
        lat: -0.3357919035353224,
        lng: 102.94762208170145,
        name: "Kantor Afdeling 4",
        type: "afdeling_office",
        radius: 150
    },
    Afdeling_5: {
        lat: -0.3054707525558214,
        lng: 102.9573562242544,
        name: "Kantor Afdeling 5",
        type: "afdeling_office",
        radius: 150
    }
        };
        this.config = {
            center: [
                (this.importantLocations.PKS_SAGM.lat + this.importantLocations.KANTOR_KEBUN.lng) / 2,
                (this.importantLocations.PKS_SAGM.lng + this.importantLocations.KANTOR_KEBUN.lng) / 2
            ],
            zoom: 13
        };
        this.initializeSystem();
    }

    initializeSystem() {
        try {
            console.log('🚀 Starting Advanced GPS Tracking System with Complete Analytics...');
            this.setupMap();
            this.setupEventHandlers();
            this.connectToFirebase();
            this.startPeriodicTasks();
            this.setupDataLogger();
            this.testFirebaseConnection();
            const systems = [
                { name: 'Analytics Engine', instance: this.analyticsEngine },
                { name: 'Geofencing Manager', instance: this.geofencingManager },
                { name: 'Violation Detector', instance: this.violationDetector },
                { name: 'Performance Manager', instance: this.performanceManager },
                { name: 'Heatmap Manager', instance: this.heatmapManager },
                { name: 'Maintenance Predictor', instance: this.maintenancePredictor },
                { name: 'Notification System', instance: this.notificationSystem }
            ];
            systems.forEach(system => {
                try {
                    if (system.instance && typeof system.instance.initialize === 'function') {
                        system.instance.initialize();
                        console.log(`✅ ${system.name} initialized successfully`);
                    }
                } catch (error) {
                    console.error(`❌ ${system.name} initialization failed:`, error);
                    this.logData(`${system.name} gagal diinisialisasi`, 'warning', { error: error.message });
                }
            });
        
            this.setupMonitorChatSystem();
            this.setupChatWindowBehavior();
            setTimeout(() => this.showDebugPanel(), 2000);
            console.log('🎉 Advanced GPS Analytics System fully initialized');
        } catch (error) {
            console.error('System initialization failed:', error);
            this.displayError('Gagal memulai sistem GPS Analytics');
            this.logData('System initialization partially failed', 'error', { error: error.message });
        }
    }

    handleMonitorChatMessage(unitName, message) {
    if (!message || !message.text) return;
    
    // ✅ PERBAIKAN: Hanya proses pesan yang BUKAN dari monitor
    if (message.type === 'monitor') return;
    
    if (!this.monitorChatMessages.has(unitName)) {
        this.monitorChatMessages.set(unitName, []);
    }
    
    const messages = this.monitorChatMessages.get(unitName);
    const messageExists = messages.some(msg => msg.id === message.id);
    
    if (messageExists) return;
    
    messages.push(message);
    
    // Update unread count
    if (this.activeChatUnit !== unitName) {
        const currentCount = this.monitorUnreadCounts.get(unitName) || 0;
        this.monitorUnreadCounts.set(unitName, currentCount + 1);
    }
    
    this.updateMonitorChatUI();
    this.updateMonitorChatUnitSelect();
    
    if (this.activeChatUnit !== unitName) {
        this.showMonitorChatNotification(unitName, message);
    }
}

    async sendMonitorMessage() {
    const messageInput = document.getElementById('monitorChatInput');
    const messageText = messageInput?.value.trim();
    
    console.log('📤 Attempting to send message:', messageText);
    
    if (!messageText) {
        alert('⚠️ Silakan ketik pesan terlebih dahulu!');
        return;
    }
    
    if (!this.activeChatUnit) {
        alert('⚠️ Pilih unit terlebih dahulu!');
        return;
    }
    
    if (!this.monitorChatRefs.has(this.activeChatUnit)) {
        alert(`❌ Tidak dapat terhubung dengan ${this.activeChatUnit}`);
        return;
    }
    
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const messageData = {
        id: messageId,
        text: messageText,
        sender: 'MONITOR',
        unit: this.activeChatUnit,
        timestamp: new Date().toISOString(),
        timeDisplay: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'monitor',
        status: 'sent'
    };
    
    try {
        console.log('📝 Sending message to Firebase:', messageData);
        const chatRef = this.monitorChatRefs.get(this.activeChatUnit);
        await chatRef.push(messageData);
        
        // Tambahkan ke local messages
        if (!this.monitorChatMessages.has(this.activeChatUnit)) {
            this.monitorChatMessages.set(this.activeChatUnit, []);
        }
        this.monitorChatMessages.get(this.activeChatUnit).push(messageData);
        
        // Update UI
        this.updateMonitorChatUI();
        
        // Clear input
        if (messageInput) {
            messageInput.value = '';
        }
        
        // Stop typing indicator
        this.stopMonitorTyping();
        
        console.log('✅ Message sent successfully');
        
    } catch (error) {
        console.error('❌ Gagal mengirim pesan:', error);
        alert('❌ Gagal mengirim pesan. Coba lagi.');
    }
}

    setupUnitChatListener(unitName) {
        if (this.monitorChatRefs.has(unitName)) return;
        const chatRef = database.ref('/chat/' + unitName);
        this.monitorChatRefs.set(unitName, chatRef);
        this.monitorChatMessages.set(unitName, []);
        this.monitorUnreadCounts.set(unitName, 0);
        chatRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            this.handleMonitorChatMessage(unitName, message);
        });
        this.updateMonitorChatUnitSelect();
    }

    selectChatUnit(unitName) {
        if (unitName === this.activeChatUnit) return;
        this.activeChatUnit = unitName;
        this.clearUnreadMessages(unitName);
        this.loadChatHistory(unitName);
        this.updateMonitorChatUI();
        const chatInput = document.getElementById('monitorChatInput');
        if (chatInput) {
            setTimeout(() => { chatInput.focus(); }, 150);
        }
    }

    clearUnreadMessages(unitName) {
        this.monitorUnreadCounts.set(unitName, 0);
        this.updateMonitorChatUnitSelect();
    }

    async loadChatHistory(unitName) {
        try {
            const chatRef = database.ref('/chat/' + unitName);
            const snapshot = await chatRef.once('value');
            const chatData = snapshot.val();
            if (!chatData) {
                if (!this.monitorChatMessages.has(unitName)) {
                    this.monitorChatMessages.set(unitName, []);
                }
                return;
            }
            this.monitorChatMessages.set(unitName, []);
            Object.values(chatData).forEach(message => {
                if (message && message.text) {
                    this.monitorChatMessages.get(unitName).push(message);
                }
            });
            const messages = this.monitorChatMessages.get(unitName);
            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            this.updateMonitorChatUI();
        } catch (error) {
            console.error(`Gagal load chat history untuk ${unitName}:`, error);
        }
    }

    updateMonitorChatUI() {
        const messageList = document.getElementById('monitorChatMessages');
        if (!messageList) return;
        let totalUnread = 0;
        this.monitorUnreadCounts.forEach(count => totalUnread += count);
        const unreadBadge = document.getElementById('monitorUnreadBadge');
        if (unreadBadge) {
            unreadBadge.textContent = totalUnread > 0 ? totalUnread : '';
            unreadBadge.style.display = totalUnread > 0 ? 'inline' : 'none';
        }
        const hasActiveUnit = !!this.activeChatUnit;
        const chatInput = document.getElementById('monitorChatInput');
        const sendBtn = document.getElementById('monitorSendBtn');
        if (chatInput) chatInput.disabled = !hasActiveUnit;
        if (sendBtn) sendBtn.disabled = !hasActiveUnit;
        if (!hasActiveUnit) {
            messageList.innerHTML = '<div class="chat-placeholder text-center text-muted py-4"><small>Pilih unit untuk memulai percakapan...</small></div>';
            return;
        }
        const activeMessages = this.monitorChatMessages.get(this.activeChatUnit) || [];
        if (activeMessages.length === 0) {
            messageList.innerHTML = `<div class="chat-placeholder text-center text-muted py-4"><small>Mulai percakapan dengan driver ${this.activeChatUnit}...</small></div>`;
            return;
        }
        messageList.innerHTML = '';
        activeMessages.forEach(message => {
            const isMonitor = message.type === 'monitor';
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${isMonitor ? 'message-sent' : 'message-received'}`;
            messageEl.innerHTML = `
                <div class="message-content">
                    ${!isMonitor ? 
                        `<div class="message-sender">${this.escapeHtml(message.sender)} (${message.unit || 'Driver'})</div>` : 
                        `<div class="message-sender">Anda (MONITOR)</div>`}
                    <div class="message-text">${this.escapeHtml(message.text)}</div>
                    <div class="message-footer">
                        <span class="message-time">${message.timeDisplay || new Date(message.timestamp).toLocaleTimeString('id-ID')}</span>
                        ${isMonitor ? '<span class="message-status">✓</span>' : ''}
                    </div>
                </div>
            `;
            messageList.appendChild(messageEl);
        });
        setTimeout(() => {
            messageList.scrollTop = messageList.scrollHeight;
        }, 100);
    }

    updateMonitorChatUnitSelect() {
        const unitSelect = document.getElementById('monitorChatUnitSelect');
        if (!unitSelect) return;
        const currentValue = unitSelect.value;
        unitSelect.innerHTML = '<option value="">Pilih Unit...</option>';
        const allUnits = new Set([...this.monitorChatRefs.keys(), ...Array.from(this.units.keys())]);
        allUnits.forEach(unitName => {
            const count = this.monitorUnreadCounts.get(unitName) || 0;
            const option = document.createElement('option');
            option.value = unitName;
            option.textContent = count > 0 ? `${unitName} 💬 (${count} baru)` : unitName;
            unitSelect.appendChild(option);
        });
        if (currentValue && allUnits.has(currentValue)) {
            unitSelect.value = currentValue;
        }
    }

    showMonitorChatNotification(unitName, message) {
        const notification = document.createElement('div');
        notification.className = 'chat-notification alert alert-warning';
        notification.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>💬 Pesan Baru dari ${unitName}</strong>
                    <div class="small">${message.sender}: ${message.text}</div>
                </div>
                <button type="button" class="btn-close btn-sm" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        notification.style.cssText = `position: fixed; top: 80px; right: 20px; z-index: 9999; min-width: 300px; max-width: 400px;`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupMonitorChatSystem() {
        console.log('💬 Initializing monitor chat system...');
        database.ref('/units').on('value', (snapshot) => {
            const unitsData = snapshot.val();
            if (unitsData) {
                Object.keys(unitsData).forEach(unitName => {
                    if (!this.monitorChatRefs.has(unitName)) {
                        this.setupUnitChatListener(unitName);
                    }
                });
            }
        });
        this.setupChatEventHandlers();
        this.monitorChatInitialized = true;
        console.log('✅ Monitor chat system initialized');
    }
    setupChatWindowBehavior() {
    console.log('💬 Setting up chat window behavior...');
    this.setupBasicChatBehavior();
}

setupBasicChatBehavior() {
    this.setupChatAutoHide();
    this.setupClickOutsideToClose();
    this.setupEscapeKeyClose();
}

setupChatAutoHide() {
    let chatTimeout;
    const resetTimer = () => {
        clearTimeout(chatTimeout);
        if (this.isMonitorChatOpen) {
            chatTimeout = setTimeout(() => {
                if (this.isMonitorChatOpen) {
                    this.toggleMonitorChat();
                }
            }, 600000); // 10 menit
        }
    };
    const chatInput = document.getElementById('monitorChatInput');
    const chatWindow = document.getElementById('monitorChatWindow');
    if (chatInput) {
        chatInput.addEventListener('input', resetTimer);
        chatInput.addEventListener('focus', resetTimer);
    }
    if (chatWindow) {
        chatWindow.addEventListener('mousemove', resetTimer);
        chatWindow.addEventListener('click', resetTimer);
    }
}

setupClickOutsideToClose() {
    // Akan di-handle di toggleMonitorChat via event listeners
}

setupEscapeKeyClose() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isMonitorChatOpen) {
            this.toggleMonitorChat();
        }
    });
}

setupBasicChatBehavior() {
    // Simple auto-hide functionality
    this.setupChatAutoHide();
    // Click outside to close
    this.setupClickOutsideToClose();
    // Escape key to close
    this.setupEscapeKeyClose();
}

setupChatAutoHide() {
    // Auto-hide chat setelah 10 menit tidak aktif
    let chatTimeout;
    const resetTimer = () => {
        clearTimeout(chatTimeout);
        if (this.isMonitorChatOpen) {
            chatTimeout = setTimeout(() => {
                if (this.isMonitorChatOpen) {
                    this.toggleMonitorChat();
                    console.log('💬 Chat auto-hidden due to inactivity');
                }
            }, 600000); // 10 menit
        }
    };
    const chatInput = document.getElementById('monitorChatInput');
    const chatWindow = document.getElementById('monitorChatWindow');
    if (chatInput) {
        chatInput.addEventListener('input', resetTimer);
        chatInput.addEventListener('focus', resetTimer);
    }
    if (chatWindow) {
        chatWindow.addEventListener('mousemove', resetTimer);
        chatWindow.addEventListener('click', resetTimer);
    }
}

setupClickOutsideToClose() {
    // Akan ditangani di toggleMonitorChat via event listeners
}

setupEscapeKeyClose() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isMonitorChatOpen) {
            this.toggleMonitorChat();
        }
    });
}

    setupChatEventHandlers() {
    const chatInput = document.getElementById('monitorChatInput');
    const unitSelect = document.getElementById('monitorChatUnitSelect');
    const sendBtn = document.getElementById('monitorSendBtn');
    
    console.log('🔧 Setting up chat event handlers...');
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log('📤 Enter pressed - sending message');
                this.sendMonitorMessage();
            }
        });
        
        // Tambahkan input event untuk typing indicator
        chatInput.addEventListener('input', (e) => {
            if (this.activeChatUnit) {
                this.startMonitorTyping();
            }
        });
    }
    
    if (unitSelect) {
        unitSelect.addEventListener('change', (e) => {
            console.log('👤 Selected chat unit:', e.target.value);
            this.selectChatUnit(e.target.value);
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            console.log('📤 Send button clicked');
            this.sendMonitorMessage();
        });
    }
    
    console.log('✅ Chat event handlers setup completed');
}

    toggleMonitorChat() {
    this.isMonitorChatOpen = !this.isMonitorChatOpen;
    const chatWindow = document.getElementById('monitorChatWindow');
    const chatToggle = document.getElementById('monitorChatToggle');
    if (!chatWindow) return;

    if (this.isMonitorChatOpen) {
        this.cleanupChatEventListeners();
        this.setupChatEventListeners();
        chatWindow.style.display = 'flex';
        chatWindow.style.animation = 'slideInUp 0.3s ease-out forwards';
        this.updateMonitorChatUnitSelect();
        this.updateMonitorChatUI();
        if (this.activeChatUnit) {
            setTimeout(() => {
                const chatInput = document.getElementById('monitorChatInput');
                if (chatInput) chatInput.focus();
            }, 350);
        }
        if (chatToggle) {
            chatToggle.innerHTML = '💬 Tutup Chat <span id="monitorUnreadBadge" class="badge bg-danger" style="display: none;"></span>';
            chatToggle.classList.add('btn-secondary');
            chatToggle.classList.remove('btn-primary');
        }
    } else {
        chatWindow.style.animation = 'slideOutDown 0.25s ease-in forwards';
        this.stopMonitorTyping();
        if (chatToggle) {
            chatToggle.innerHTML = '💬 Chat dengan Driver <span id="monitorUnreadBadge" class="badge bg-danger" style="display: none;"></span>';
            chatToggle.classList.add('btn-primary');
            chatToggle.classList.remove('btn-secondary');
        }
        setTimeout(() => {
            if (!this.isMonitorChatOpen) {
                chatWindow.style.display = 'none';
                chatWindow.style.animation = '';
            }
        }, 250);
        this.cleanupChatEventListeners();
    }
}

    setupChatEventListeners() {
        const chatWindow = document.getElementById('monitorChatWindow');
        const chatToggle = document.getElementById('monitorChatToggle');
        if (!chatWindow || !chatToggle) return;
        this.chatWindowClickHandler = (e) => e.stopPropagation();
        this.documentClickHandler = (e) => {
            if (this.isMonitorChatOpen &&
                !chatWindow.contains(e.target) &&
                !chatToggle.contains(e.target)) {
                this.toggleMonitorChat();
            }
        };
        this.escapeKeyHandler = (e) => {
            if (e.key === 'Escape' && this.isMonitorChatOpen) {
                this.toggleMonitorChat();
            }
        };
        chatWindow.addEventListener('click', this.chatWindowClickHandler);
        document.addEventListener('click', this.documentClickHandler);
        document.addEventListener('keydown', this.escapeKeyHandler);
    }

    cleanupChatEventListeners() {
        const chatWindow = document.getElementById('monitorChatWindow');
        if (chatWindow && this.chatWindowClickHandler) {
            chatWindow.removeEventListener('click', this.chatWindowClickHandler);
        }
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler);
        }
        if (this.escapeKeyHandler) {
            document.removeEventListener('keydown', this.escapeKeyHandler);
        }
        this.chatWindowClickHandler = null;
        this.documentClickHandler = null;
        this.escapeKeyHandler = null;
    }

    startMonitorTyping() {
        if (!this.activeChatUnit) return;
        const typingRef = database.ref('/typing/' + this.activeChatUnit + '/monitor');
        typingRef.set({ isTyping: true, name: 'MONITOR', timestamp: Date.now() });
        this.isMonitorTyping = true;
    }

    stopMonitorTyping() {
        if (!this.activeChatUnit || !this.isMonitorTyping) return;
        const typingRef = database.ref('/typing/' + this.activeChatUnit + '/monitor');
        typingRef.set({ isTyping: false, name: 'MONITOR', timestamp: Date.now() });
        this.isMonitorTyping = false;
    }

    // ===== SEMUA METHOD LAINNYA DIKOPI LANGSUNG DARI FILE ASLI ANDA =====
    // (TANPA PERUBAHAN, TANPA HAPUS, TANPA "...")
    connectToFirebase() {
        try {
            console.log('🟡 Connecting to Firebase...');
            this.cleanupFirebaseListeners();
            database.ref('.info/connected').on('value', (snapshot) => {
                this.isOnline = snapshot.val();
                if (this.isOnline) {
                    this.syncOfflineData();
                }
            });
            this.backgroundSyncInterval = setInterval(() => {
                if (this.isOnline && this.offlineQueue.size > 0) {
                    this.syncOfflineData();
                }
            }, 1000);
            const connectionListener = database.ref('.info/connected').on('value', (snapshot) => {
                const connected = snapshot.val();
                this.updateConnectionStatus(connected);
                if (connected) {
                    this.logData('Firebase connected - Analytics system ready', 'success');
                    setTimeout(() => this.loadInitialData(), 1000);
                } else {
                    this.logData('Firebase disconnected', 'warning');
                    this.markAllUnitsOffline();
                }
            });
            this.firebaseListeners.set('connection', connectionListener);
            const unitsListener = database.ref('/units').on('value', 
                (snapshot) => {
                    try {
                        const data = snapshot.val();
                        if (data && typeof data === 'object') {
                            this.debouncedProcessRealTimeData(data);
                        } else {
                            this.logData('Empty or invalid Firebase data', 'warning');
                        }
                    } catch (processError) {
                        console.error('❌ Error processing Firebase data:', processError);
                        this.logData('Firebase data processing error', 'error', { 
                            error: processError.message
                        });
                    }
                }, 
                (error) => {
                    console.error('❌ Firebase listener error:', error);
                    this.logData('Firebase listener error', 'error', { 
                        error: error.message
                    });
                    setTimeout(() => {
                        this.connectToFirebase();
                    }, 5000);
                }
            );
            this.firebaseListeners.set('units', unitsListener);
            const removalListener = database.ref('/units').on('child_removed', (snapshot) => {
                this.handleDataRemoval(snapshot.key);
            });
            this.firebaseListeners.set('removal', removalListener);
            console.log('✅ Firebase listeners setup completed');
        } catch (error) {
            console.error('🔥 Critical Firebase error:', error);
            this.logData('Critical Firebase connection error', 'error', { 
                error: error.message
            });
            setTimeout(() => {
                this.connectToFirebase();
            }, 10000);
        }
    }

    debouncedProcessRealTimeData(data) {
        if (this.updateDebounce) {
            clearTimeout(this.updateDebounce);
        }
        this.updateDebounce = setTimeout(() => {
            this.processRealTimeData(data);
        }, 300);
    }

    processRealTimeData(firebaseData) {
        if (!firebaseData) {
            this.logData('No real-time data from Firebase', 'warning');
            return;
        }
        const unitCount = Object.keys(firebaseData).length;
        console.log(`🔄 Real-time analytics update: ${unitCount} active units`);
        const activeUnits = new Set();
        const currentTime = Date.now();
        Object.keys(firebaseData).forEach(unitName => {
            this.inactiveUnitTracker.set(unitName, 0);
        });
        Object.entries(firebaseData).forEach(([unitName, unitData]) => {
            if (!this.validateUnitData(unitName, unitData)) {
                const correctedData = this.correctUnitData(unitName, unitData);
                if (!correctedData) {
                    return;
                }
                unitData = correctedData;
            }
            activeUnits.add(unitName);
            this.lastDataTimestamps.set(unitName, currentTime);
            this.driverOnlineStatus.set(unitName, true);
            const existingUnit = this.units.get(unitName);
            if (existingUnit) {
                this.refreshUnitData(existingUnit, unitData);
                this.analyticsEngine.processUnitData(existingUnit);
                this.violationDetector.checkViolations(existingUnit);
                this.geofencingManager.checkUnitZones(existingUnit);
            } else {
                const newUnit = this.createNewUnit(unitName, unitData);
                if (newUnit) {
                    this.units.set(unitName, newUnit);
                    this.unitSessions.set(unitName, {
                        sessionId: unitData.sessionId,
                        startTime: currentTime,
                        lastActivity: currentTime
                    });
                    this.analyticsEngine.initializeUnit(newUnit);
                    this.maintenancePredictor.initializeUnit(newUnit);
                    if (!this.monitorChatRefs.has(unitName)) {
                        this.setupUnitChatListener(unitName);
                    }
                    console.log(`✅ New unit created: ${unitName}`);
                }
            }
        });
        this.gradualCleanupInactiveUnits(activeUnits);
        this.updateStatistics();
        this.updateAnalyticsDashboard();
        this.scheduleRender();
    }

    validateUnitData(unitName, unitData) {
        if (!unitData) return false;
        if (unitData.lat === undefined || unitData.lng === undefined) return false;
        const lat = parseFloat(unitData.lat);
        const lng = parseFloat(unitData.lng);
        if (isNaN(lat) || isNaN(lng)) return false;
        if (lat === 0 && lng === 0) return false;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
        return true;
    }

    correctUnitData(unitName, unitData) {
        try {
            const correctedData = { ...unitData };
            if (this.units.has(unitName)) {
                const existingUnit = this.units.get(unitName);
                correctedData.lat = existingUnit.latitude;
                correctedData.lng = existingUnit.longitude;
            } else {
                correctedData.lat = this.config.center[0];
                correctedData.lng = this.config.center[1];
            }
            correctedData.lat = parseFloat(correctedData.lat) || this.config.center[0];
            correctedData.lng = parseFloat(correctedData.lng) || this.config.center[1];
            correctedData.speed = parseFloat(correctedData.speed) || 0;
            correctedData.distance = parseFloat(correctedData.distance) || 0;
            return correctedData;
        } catch (error) {
            console.error(`❌ Failed to correct data for ${unitName}:`, error);
            return null;
        }
    }

    createNewUnit(unitName, firebaseData) {
        if (!firebaseData) {
            console.log(`❌ No firebase data for unit ${unitName}`);
            return null;
        }
        try {
            const validatedData = this.validateAndSanitizeUnitData(unitName, firebaseData);
            if (!validatedData) {
                console.log(`❌ Invalid data for unit ${unitName}, skipping creation`);
                return null;
            }
            const unit = {
                id: this.getUnitId(unitName),
                name: unitName,
                afdeling: this.determineAfdeling(unitName),
                status: this.determineStatus(validatedData.journeyStatus),
                latitude: parseFloat(validatedData.lat),
                longitude: parseFloat(validatedData.lng),
                speed: parseFloat(validatedData.speed) || 0,
                lastUpdate: validatedData.lastUpdate || new Date().toLocaleTimeString('id-ID'),
                distance: parseFloat(validatedData.distance) || 0,
                driver: validatedData.driver || 'Unknown',
                accuracy: parseFloat(validatedData.accuracy) || 0,
                batteryLevel: validatedData.batteryLevel || null,
                lastLat: parseFloat(validatedData.lat),
                lastLng: parseFloat(validatedData.lng),
                isOnline: true,
                sessionId: validatedData.sessionId,
                analytics: {
                    performanceScore: 75,
                    efficiency: 0,
                    violations: [],
                    dailyDistance: 0,
                    idleTime: 0,
                    lastScoreUpdate: Date.now(),
                    zoneEntries: [],
                    maintenanceAlerts: []
                }
            };
            console.log(`✅ Successfully created unit: ${unitName}`);
            return unit;
        } catch (error) {
            console.error(`❌ Failed to create unit ${unitName}:`, error);
            this.logData(`Unit creation failed for ${unitName}`, 'error', {
                error: error.message,
                data: firebaseData
            });
            return null;
        }
    }

    validateAndSanitizeUnitData(unitName, unitData) {
        if (!unitData) return null;
        const sanitized = { ...unitData };
        if (!sanitized.lat || !sanitized.lng) {
            console.log(`❌ Missing coordinates for ${unitName}`);
            return null;
        }
        sanitized.lat = parseFloat(sanitized.lat);
        sanitized.lng = parseFloat(sanitized.lng);
        if (isNaN(sanitized.lat) || isNaN(sanitized.lng)) {
            console.log(`❌ Invalid coordinates for ${unitName}`);
            return null;
        }
        if (sanitized.lat < -90 || sanitized.lat > 90 || 
            sanitized.lng < -180 || sanitized.lng > 180) {
            console.log(`❌ Coordinate out of range for ${unitName}`);
            return null;
        }
        sanitized.speed = sanitized.speed || 0;
        sanitized.distance = sanitized.distance || 0;
        sanitized.driver = sanitized.driver || 'Unknown';
        sanitized.journeyStatus = sanitized.journeyStatus || 'active';
        return sanitized;
    }

    getUnitId(unitName) {
        const unitIdMap = {
            'DT-06': 1, 'DT-07': 2, 'DT-12': 3, 'DT-13': 4, 'DT-15': 5, 'DT-16': 6,
            'DT-17': 7, 'DT-18': 8, 'DT-23': 9, 'DT-24': 10, 'DT-25': 11, 'DT-26': 12,
            'DT-27': 13, 'DT-28': 14, 'DT-29': 15, 'DT-32': 16, 'DT-33': 17, 'DT-34': 18,
            'DT-35': 19, 'DT-36': 20, 'DT-37': 21, 'DT-38': 22, 'DT-39': 23
        };
        return unitIdMap[unitName] || Date.now();
    }

    determineAfdeling(unitName) {
        const afdelingMap = {
            'DT-06': 'AFD I', 'DT-07': 'AFD I', 'DT-12': 'AFD II', 'DT-13': 'AFD II',
            'DT-15': 'AFD III', 'DT-16': 'AFD III', 'DT-17': 'AFD IV', 'DT-18': 'AFD IV',
            'DT-23': 'AFD V', 'DT-24': 'AFD V', 'DT-25': 'KKPA', 'DT-26': 'KKPA',
            'DT-27': 'KKPA', 'DT-28': 'AFD II', 'DT-29': 'AFD III', 'DT-32': 'AFD I',
            'DT-33': 'AFD IV', 'DT-34': 'AFD V', 'DT-35': 'KKPA', 'DT-36': 'AFD II',
            'DT-37': 'AFD III', 'DT-38': 'AFD I', 'DT-39': 'AFD IV'
        };
        return afdelingMap[unitName] || 'AFD I';
    }

    determineStatus(journeyStatus) {
        const statusMap = {
            'started': 'moving',
            'moving': 'moving', 
            'active': 'active',
            'paused': 'active',
            'ended': 'inactive',
            'ready': 'inactive'
        };
        return statusMap[journeyStatus] || 'active';
    }

    refreshUnitData(unit, firebaseData) {
        const now = Date.now();
        unit.latitude = parseFloat(firebaseData.lat) || unit.latitude;
        unit.longitude = parseFloat(firebaseData.lng) || unit.longitude;
        unit.speed = parseFloat(firebaseData.speed) || unit.speed;
        unit.status = this.determineStatus(firebaseData.journeyStatus) || unit.status;
        unit.lastUpdate = firebaseData.lastUpdate || unit.lastUpdate;
        unit.driver = firebaseData.driver || unit.driver;
        unit.accuracy = parseFloat(firebaseData.accuracy) || unit.accuracy;
        unit.batteryLevel = firebaseData.batteryLevel || unit.batteryLevel;
        unit.lastLat = parseFloat(firebaseData.lat);
        unit.lastLng = parseFloat(firebaseData.lng);
        unit.isOnline = true;
        this.addHistoryPoint(unit);
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    updateStatistics() {
        let activeUnits = 0;
        let totalDistance = 0;
        let totalSpeed = 0;
        let unitCount = 0;
        let totalScore = 0;
        let totalViolations = 0;
        this.units.forEach(unit => {
            if (unit.isOnline) {
                unitCount++;
                if (unit.status === 'active' || unit.status === 'moving') {
                    activeUnits++;
                }
                totalDistance += unit.distance || 0;
                totalSpeed += unit.speed || 0;
                totalScore += unit.analytics.performanceScore || 0;
                totalViolations += unit.analytics.violations?.length || 0;
            }
        });
        const avgSpeed = unitCount > 0 ? totalSpeed / unitCount : 0;
        const avgScore = unitCount > 0 ? totalScore / unitCount : 0;
        this.activeUnits = activeUnits;
        this.totalDistance = totalDistance;
        this.avgSpeed = avgSpeed;
        this.avgPerformanceScore = Math.round(avgScore);
        this.totalViolations = totalViolations;
        this.updateDisplayElements();
    }

    updateDisplayElements() {
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        updateElement('activeUnits', `${this.activeUnits}/${this.units.size}`);
        updateElement('totalDistance', `${this.totalDistance.toFixed(1)} km`);
        updateElement('avgSpeed', `${this.avgSpeed.toFixed(1)} km/h`);
        updateElement('avgScore', `${this.avgPerformanceScore}`);
        updateElement('totalViolations', `${this.totalViolations}`);
        updateElement('quickTotalDistance', `${this.totalDistance.toFixed(0)} km`);
        updateElement('quickViolations', `${this.totalViolations}`);
        updateElement('quickEfficiency', `${this.avgPerformanceScore}%`);
        updateElement('averageScore', this.avgPerformanceScore);
        updateElement('bestUnit', this.performanceManager.getBestUnit() || '-');
        updateElement('systemEfficiency', this.avgPerformanceScore);
    }

    updateAnalyticsDashboard() {
        this.analyticsEngine.updateDashboard();
        this.performanceManager.updateRankings();
        this.violationDetector.updateViolationsDisplay();
        this.maintenancePredictor.updateMaintenanceDisplay();
    }

    scheduleRender() {
        const now = Date.now();
        if (now - this.lastRenderTime < this.renderThrottleMs) {
            return;
        }
        this.lastRenderTime = now;
        this.refreshDisplay();
    }

    refreshDisplay() {
        this.cleanupOrphanedMarkers();
        this.updateStatistics();
        this.renderUnitList();
        this.updateMapMarkers();
        this.updateAnalyticsDashboard();
    }

    renderUnitList() {
        const unitList = document.getElementById('unitList');
        if (!unitList) return;
        if (this.units.size === 0) {
            unitList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <div class="mb-2">📭</div>
                    <small>Tidak ada unit aktif</small>
                    <br>
                    <small class="text-muted">Menunggu koneksi dari driver...</small>
                </div>
            `;
            return;
        }
        unitList.innerHTML = '';
        const sortedUnits = Array.from(this.units.values()).sort((a, b) => 
            (b.analytics.performanceScore || 0) - (a.analytics.performanceScore || 0)
        );
        sortedUnits.forEach(unit => {
            const score = unit.analytics.performanceScore || 0;
            const scoreClass = this.getScoreClass(score);
            const violationCount = unit.analytics.violations?.length || 0;
            const maintenanceAlert = unit.analytics.maintenanceAlerts?.length > 0;
            const unitElement = document.createElement('div');
            unitElement.className = `unit-item ${unit.status} ${scoreClass}`;
            unitElement.onclick = () => this.showUnitAnalytics(unit.name);
            unitElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">
                            ${unit.name} ${unit.isOnline ? '🟢' : '🔴'}
                            ${violationCount > 0 ? '<span class="badge bg-danger ms-1">⚠️ ' + violationCount + '</span>' : ''}
                            ${maintenanceAlert ? '<span class="badge bg-warning ms-1">🔧</span>' : ''}
                        </h6>
                        <small class="text-muted">${unit.afdeling} - ${unit.driver || 'No Driver'}</small>
                    </div>
                    <div class="text-end">
                        <span class="badge ${unit.status === 'active' ? 'bg-success' : unit.status === 'moving' ? 'bg-warning' : 'bg-danger'}">
                            ${unit.status === 'active' ? 'Aktif' : unit.status === 'moving' ? 'Berjalan' : 'Non-Aktif'}
                        </span>
                        <div class="mt-1">
                            <small class="text-${scoreClass.replace('score-', '')}">
                                ⭐ ${score}
                            </small>
                        </div>
                    </div>
                </div>
                <div class="mt-2">
                    <small class="text-muted">
                        Kecepatan: ${unit.speed} km/h | Jarak: ${unit.distance.toFixed(1)} km<br>
                        Update: ${unit.lastUpdate}
                    </small>
                </div>
            `;
            unitList.appendChild(unitElement);
        });
    }

    getScoreClass(score) {
        if (score >= 90) return 'score-excellent';
        if (score >= 80) return 'score-good';
        if (score >= 70) return 'score-average';
        if (score >= 60) return 'score-poor';
        return 'score-bad';
    }

    setupMap() {
        try {
            this.map = L.map('map').setView(this.config.center, this.config.zoom);
            const googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '© Google Satellite',
                maxZoom: 22,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            });
            googleSatellite.addTo(this.map);
            L.control.scale({ imperial: false }).addTo(this.map);
            L.control.zoom({ position: 'topright' }).addTo(this.map);
            this.addLocationMarkers();
        } catch (error) {
            console.error('Map setup failed:', error);
            throw new Error('Gagal menyiapkan peta');
        }
    }

    addLocationMarkers() {
    try {
        this.importantMarkers.forEach(marker => {
            if (marker && this.map) {
                this.map.removeLayer(marker);
            }
        });
        this.importantMarkers = [];

        // === MARKER PKS SAGM ===
        const pksIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-icon pks" title="PKS SAGM">🏭</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        const pksMarker = L.marker([this.importantLocations.PKS_SAGM.lat, this.importantLocations.PKS_SAGM.lng], { icon: pksIcon })
            .bindPopup(this.createLocationInfo('PKS SAGM', 'pks'))
            .addTo(this.map);
        this.importantMarkers.push(pksMarker);

        // === MARKER KANTOR KEBUN ===
        const officeIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-icon office" title="Kantor Kebun">🏢</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        const officeMarker = L.marker([this.importantLocations.KANTOR_KEBUN.lat, this.importantLocations.KANTOR_KEBUN.lng], { icon: officeIcon })
            .bindPopup(this.createLocationInfo('Kantor Kebun PT SAGM', 'office'))
            .addTo(this.map);
        this.importantMarkers.push(officeMarker);

        // === MARKER KANTOR AFDELING 1–5 ===
        const afdelingIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-icon afdeling" title="Kantor Afdeling">🏢</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const afdelingMarkers = [
            { key: 'Afdeling_1', name: 'Kantor Afdeling 1' },
            { key: 'Afdeling_2', name: 'Kantor Afdeling 2' },
            { key: 'Afdeling_3', name: 'Kantor Afdeling 3' },
            { key: 'Afdeling_4', name: 'Kantor Afdeling 4' },
            { key: 'Afdeling_5', name: 'Kantor Afdeling 5' }
        ];

        afdelingMarkers.forEach(({ key, name }) => {
            if (this.importantLocations[key]) {
                const marker = L.marker([this.importantLocations[key].lat, this.importantLocations[key].lng], { icon: afdelingIcon })
                    .bindPopup(this.createLocationInfo(name, 'afdeling_office'))
                    .addTo(this.map);
                this.importantMarkers.push(marker);
            }
        });

        console.log('✅ Location markers added');
    } catch (error) {
        console.error('Failed to add location markers:', error);
    }
}

    createLocationInfo(name, type) {
    let typeLabel = '';
    if (type === 'pks') {
        typeLabel = 'Pabrik Kelapa Sawit';
    } else if (type === 'office') {
        typeLabel = 'Kantor Operasional';
    } else if (type === 'afdeling_office') {
        typeLabel = 'Kantor Afdeling';
    } else {
        typeLabel = 'Lokasi';
    }

    return `
        <div class="unit-popup">
            <div class="popup-header">
                <h6 class="mb-0">${type === 'pks' ? '🏭' : '🏢'} ${name}</h6>
            </div>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Tipe:</span>
                    <span class="info-value">${typeLabel}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status:</span>
                    <span class="info-value">Operasional</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Lokasi:</span>
                    <span class="info-value">Kebun Tempuling</span>
                </div>
            </div>
        </div>
    `;
    }


    addHistoryPoint(unit) {
        if (!this.unitHistory.has(unit.name)) {
            this.unitHistory.set(unit.name, []);
        }
        const history = this.unitHistory.get(unit.name);
        const timestamp = new Date().toISOString();
        const point = {
            timestamp: timestamp,
            latitude: unit.latitude,
            longitude: unit.longitude,
            speed: unit.speed,
            distance: unit.distance,
            status: unit.status,
        };
        history.push(point);
        this.updateUnitRoute(unit);
    }

    updateUnitRoute(unit) {
        const history = this.unitHistory.get(unit.name);
        if (!history || history.length < 1) return;
        const routePoints = history.map(point => [
            point.latitude, point.longitude
        ]);
        const routeColor = this.getRouteColor(unit.name);
        if (this.unitPolylines.has(unit.name)) {
            try {
                this.unitPolylines.get(unit.name).setLatLngs(routePoints);
            } catch (error) {
                this.map.removeLayer(this.unitPolylines.get(unit.name));
                this.unitPolylines.delete(unit.name);
                this.createRoutePolyline(unit, routePoints, routeColor);
            }
        } else {
            this.createRoutePolyline(unit, routePoints, routeColor);
        }
    }

    createRoutePolyline(unit, routePoints, routeColor) {
        try {
            const style = this.getRouteStyle(unit.status, routeColor);
            this.unitPolylines.set(unit.name, L.polyline(routePoints, style));
            if (this.showRoutes) {
                this.unitPolylines.get(unit.name).addTo(this.map);
            }
        } catch (error) {
            this.logData(`Failed to create route for ${unit.name}`, 'error', {
                unit: unit.name,
                error: error.message
            });
        }
    }

    getRouteStyle(status, color) {
        const baseStyle = {
            color: color,
            weight: 5,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round',
            className: 'route-line smooth-route',
            smoothFactor: 1.0
        };
        switch(status) {
            case 'moving':
                return { ...baseStyle, opacity: 0.9, weight: 6, dashArray: null };
            case 'active':
                return { ...baseStyle, opacity: 0.7, weight: 5, dashArray: '8, 12' };
            case 'inactive':
                return { ...baseStyle, opacity: 0.4, weight: 4, dashArray: '4, 8' };
            default:
                return baseStyle;
        }
    }

    getRouteColor(unitName) {
        if (!this.routeColors.has(unitName)) {
            const colors = [
                '#4285F4', '#EA4335', '#FBBC05', '#34A853', '#673AB7', '#FF5722', '#009688', '#795548'
            ];
            let hash = 0;
            for (let i = 0; i < unitName.length; i++) {
                hash = unitName.charCodeAt(i) + ((hash << 5) - hash);
            }
            this.routeColors.set(unitName, colors[Math.abs(hash) % colors.length]);
        }
        return this.routeColors.get(unitName);
    }

    updateUnitPolyline(unitName) {
        this.loadOfflinePositionsForUnit(unitName);
        if (!this.showRoutes || !this.map) return;
        const history = this.unitHistory.get(unitName) || [];
        if (history.length < 2) return;
        if (!this.unitPolylines.has(unitName)) {
            const polyline = L.polyline([], {
                color: this.getRouteColor(unitName),
                weight: 5,
                opacity: 0.8,
                lineJoin: 'round',
                dashArray: null,
                smoothFactor: 1.0
            }).addTo(this.map);
            this.unitPolylines.set(unitName, polyline);
        }
        const polyline = this.unitPolylines.get(unitName);
        polyline.setLatLngs(history.map(p => [p.latitude, p.longitude]));
        polyline.setStyle({
            color: this.getRouteColor(unitName),
            weight: unitName === this.selectedUnit ? 7 : 5
        });
    }

    async loadOfflinePositionsForUnit(unitName) {
        try {
            const offlinePositions = await this.getOfflinePositionsFromSW();
            const unitOfflinePositions = offlinePositions.filter(pos => pos.unitName === unitName);
            if (unitOfflinePositions.length > 0) {
                if (!this.unitHistory.has(unitName)) {
                    this.unitHistory.set(unitName, []);
                }
                const history = this.unitHistory.get(unitName);
                unitOfflinePositions.forEach(offlinePos => {
                    const exists = history.some(pos => 
                        pos.timestamp === offlinePos.timestamp && 
                        pos.latitude === offlinePos.lat && 
                        pos.longitude === offlinePos.lng
                    );
                    if (!exists) {
                        history.push({
                            latitude: offlinePos.lat,
                            longitude: offlinePos.lng,
                            timestamp: offlinePos.timestamp,
                            speed: offlinePos.speed || 0,
                            isOffline: true
                        });
                    }
                });
                history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            }
        } catch (error) {
            console.error(`❌ Failed to load offline positions for ${unitName}:`, error);
        }
    }

    updateMapMarkers() {
        this.markers.forEach((marker, unitName) => {
            if (!this.units.has(unitName)) {
                if (marker && this.map) {
                    this.map.removeLayer(marker);
                }
                this.markers.delete(unitName);
            }
        });
        this.units.forEach((unit, unitName) => {
            if (!this.markers.has(unitName)) {
                this.createUnitMarker(unit);
            } else {
                this.refreshUnitMarker(unit);
            }
        });
    }

    createUnitMarker(unit) {
        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-icon ${unit.status} ${unit.isOnline ? '' : 'offline'}" 
                     title="${unit.name} ${unit.isOnline ? '' : '(OFFLINE)'}">🚛</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        const marker = L.marker([unit.latitude, unit.longitude], { icon: markerIcon })
            .bindPopup(this.createUnitPopup(unit))
            .addTo(this.map);
        this.markers.set(unit.name, marker);
    }

    refreshUnitMarker(unit) {
        const marker = this.markers.get(unit.name);
        if (marker) {
            marker.setLatLng([unit.latitude, unit.longitude]);
            marker.setPopupContent(this.createUnitPopup(unit));
            const markerIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div class="marker-icon ${unit.status} ${unit.isOnline ? '' : 'offline'}" 
                         title="${unit.name} ${unit.isOnline ? '' : '(OFFLINE)'}">🚛</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });
            marker.setIcon(markerIcon);
        }
    }

    createUnitPopup(unit) {
        const routePoints = this.unitHistory.get(unit.name)?.length || 0;
        const score = unit.analytics.performanceScore || 0;
        const violations = unit.analytics.violations?.length || 0;
        const efficiency = unit.analytics.efficiency || 0;
        const routeInfo = routePoints > 0 ? `
            <div class="info-item">
                <span class="info-label">Points Rute:</span>
                <span class="info-value">${routePoints}</span>
            </div>
        ` : '<div class="info-item"><span class="info-value text-muted">Belum ada data rute</span></div>';
        const onlineStatus = unit.isOnline ? 
            '<span class="badge bg-success">ONLINE</span>' : 
            '<span class="badge bg-danger">OFFLINE</span>';
        const scoreBadge = `<span class="badge bg-${this.getScoreClass(score).replace('score-', '')}">⭐ ${score}</span>`;
        return `
            <div class="unit-popup">
                <div class="popup-header">
                    <h6 class="mb-0">🚛 ${unit.name} ${onlineStatus} ${scoreBadge}</h6>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Driver:</span>
                        <span class="info-value">${unit.driver || 'Tidak diketahui'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Afdeling:</span>
                        <span class="info-value">${unit.afdeling}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status:</span>
                        <span class="info-value ${unit.status === 'moving' ? 'text-warning' : unit.status === 'active' ? 'text-success' : 'text-danger'}">
                            ${unit.status === 'moving' ? 'Dalam Perjalanan' : unit.status === 'active' ? 'Aktif' : 'Non-Aktif'}
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Kecepatan:</span>
                        <span class="info-value">${unit.speed.toFixed(1)} km/h</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Jarak Tempuh:</span>
                        <span class="info-value">${unit.distance.toFixed(2)} km</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Efisiensi:</span>
                        <span class="info-value">${efficiency}%</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Pelanggaran:</span>
                        <span class="info-value ${violations > 0 ? 'text-danger' : 'text-success'}">${violations}</span>
                    </div>
                    ${routeInfo}
                </div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-primary w-100" onclick="showUnitAnalytics('${unit.name}')">
                        📊 Lihat Analytics
                    </button>
                </div>
            </div>
        `;
    }

    showUnitAnalytics(unitName) {
        this.analyticsEngine.showUnitAnalytics(unitName);
    }


    gradualCleanupInactiveUnits(activeUnits) {
        const now = Date.now();
        
        this.units.forEach((unit, unitName) => {
        if (!activeUnits.has(unitName)) {
            const timeSinceLastUpdate = now - (this.lastDataTimestamps.get(unitName) || 0);
            if (timeSinceLastUpdate > 60000 && unit.isOnline) {
                unit.isOnline = false;
                this.logData(`Unit marked offline: ${unitName}`, 'warning');
            }
        }
    });
    }

    forceCleanupInactiveUnits() {
        console.log('🧹 FORCE CLEANUP: Removing truly inactive units');
        const now = Date.now();
        const removalThreshold = 120000;
        const unitsToRemove = [];
        this.units.forEach((unit, unitName) => {
            const timeSinceLastUpdate = now - (this.lastDataTimestamps.get(unitName) || 0);
            if (timeSinceLastUpdate > removalThreshold) {
                unitsToRemove.push(unitName);
            }
        });
        unitsToRemove.forEach(unitName => {
            this.logData(`Force removing: ${unitName}`, 'warning', {
                unit: unitName,
                inactiveTime: now - (this.lastDataTimestamps.get(unitName) || 0)
            });
            this.removeUnitCompletely(unitName);
        });
        if (unitsToRemove.length > 0) {
            console.log(`🧹 Removed ${unitsToRemove.length} inactive units`);
        }
        this.scheduleRender();
    }

    removeUnitCompletely(unitName) {
    console.log(`🗑️ Removing unit from display (keeping history): ${unitName}`);
    
    // Hanya hapus dari peta dan struktur aktif, JANGAN hapus history
    this.units.delete(unitName);
    
    const marker = this.markers.get(unitName);
    if (marker && this.map) {
        this.map.removeLayer(marker);
        this.markers.delete(unitName);
    }
    
    const polyline = this.unitPolylines.get(unitName);
    if (polyline && this.map) {
        this.map.removeLayer(polyline);
        this.unitPolylines.delete(unitName);
    }
    
    // Hapus dari status tracking aktif
    this.driverOnlineStatus.delete(unitName);
    this.lastDataTimestamps.delete(unitName);
    this.unitSessions.delete(unitName);
    this.inactiveUnitTracker.delete(unitName);
    this.routeColors.delete(unitName);
    this.cleanupUnitChatListener(unitName);
    this.analyticsEngine.cleanupUnit(unitName);
    this.violationDetector.cleanupUnit(unitName);
    this.performanceManager.cleanupUnit(unitName);
    this.maintenancePredictor.cleanupUnit(unitName);
    
    this.scheduleRender();
}

    cleanupUnitChatListener(unitName) {
        if (this.monitorChatRefs.has(unitName)) {
            this.monitorChatRefs.get(unitName).off();
            this.monitorChatRefs.delete(unitName);
        }
        this.monitorChatMessages.delete(unitName);
        this.monitorUnreadCounts.delete(unitName);
    }

    forceCleanupAllData() {
        console.log('🧹 FORCE CLEANUP ALL: Removing ALL units and data');
        const unitsToRemove = Array.from(this.units.keys());
        unitsToRemove.forEach(unitName => {
            this.logData(`Force removing ALL: ${unitName}`, 'warning');
            this.removeUnitCompletely(unitName);
        });
        this.scheduleRender();
    }

    

    cleanupFirebaseListeners() {
        this.firebaseListeners.forEach((listener, key) => {
            try {
                if (key === 'connection') {
                    database.ref('.info/connected').off('value', listener);
                } else if (key === 'units') {
                    database.ref('/units').off('value', listener);
                } else if (key === 'removal') {
                    database.ref('/units').off('child_removed', listener);
                }
            } catch (error) {
                console.warn(`Error cleaning up listener ${key}:`, error);
            }
        });
        this.firebaseListeners.clear();
    }

     setupEventHandlers() {
        const searchInput = document.getElementById('searchUnit');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.applyFilters());
        }
       filters.forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                filter.addEventListener('change', () => this.applyFilters());
            }
        });
        database.ref('.info/connected').on('value', (snapshot) => {
            this.updateConnectionStatus(snapshot.val());
        });
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('firebaseStatus');
        if (statusElement) {
            if (connected) {
                statusElement.innerHTML = '🟢 TERHUBUNG KE FIREBASE';
                statusElement.className = 'connection-status connection-online';
            } else {
                statusElement.innerHTML = '🔴 FIREBASE OFFLINE';
                statusElement.className = 'connection-status connection-offline';
            }
        }
    }

    applyFilters  () {
        const searchTerm = document.getElementById('searchUnit')?.value.toLowerCase() || '';
        const afdelingFilter = document.getElementById('filterAfdeling')?.value || '';
        const statusFilter = document.getElementById('filterStatus')?.value || '';
    }

    startPeriodicTasks() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals.clear();
        
        const healthInterval = setInterval(() => {
            this.logData('System health check', 'info', {
                activeUnits: this.units.size,
                markers: this.markers.size,
                polylines: this.unitPolylines.size,
                chatUnits: this.monitorChatRefs.size
            });
        }, 120000);
        this.intervals.add(healthInterval);
        const statusInterval = setInterval(() => {
            const now = Date.now();
            this.lastDataTimestamps.forEach((lastUpdate, unitName) => {
                const timeDiff = now - lastUpdate;
                if (timeDiff > 90000) {
                    this.markUnitOffline(unitName);
                }
            });
        }, 30000);
        this.intervals.add(statusInterval);
        const analyticsInterval = setInterval(() => {
            this.analyticsEngine.updateAllCharts();
        }, 30000);
        this.intervals.add(analyticsInterval);
    }

    markUnitOffline(unitName) {
        const unit = this.units.get(unitName);
        if (unit) {
            this.logData(`Unit marked offline: ${unitName}`, 'warning', {
                unit: unitName,
                driver: unit.driver,
                lastLocation: { lat: unit.latitude, lng: unit.longitude }
            });
            this.removeUnitCompletely(unitName);
        }
    }

    handleDataRemoval(unitName) {
        this.logData(`Data removed for unit: ${unitName}`, 'info', {
            unit: unitName,
            action: 'logout'
        });
        this.removeUnitCompletely(unitName);
    }

    markAllUnitsOffline() {
        this.units.forEach(unit => {
            unit.isOnline = false;
        });
        this.scheduleRender();
    }

    refreshData() {
        console.log('🔄 Manual refresh initiated');
        this.logData('Manual refresh initiated', 'info');
        this.loadInitialData();
    }

    async loadInitialData() {
        this.showLoadingIndicator(true);
        try {
            const snapshot = await database.ref('/units').once('value');
            const firebaseData = snapshot.val();
            this.clearAllData();
            if (firebaseData && Object.keys(firebaseData).length > 0) {
                let loadedCount = 0;
                Object.entries(firebaseData).forEach(([unitName, unitData]) => {
                    if (this.validateUnitData(unitName, unitData)) {
                        const unit = this.createNewUnit(unitName, unitData);
                        if (unit) {
                            this.units.set(unitName, unit);
                            loadedCount++;
                            this.analyticsEngine.initializeUnit(unit);
                            this.maintenancePredictor.initializeUnit(unit);
                            if (!this.monitorChatRefs.has(unitName)) {
                                this.setupUnitChatListener(unitName);
                            }
                        }
                    }
                });
                this.logData('Initial data loaded successfully', 'success', {
                    units: loadedCount,
                    total: Object.keys(firebaseData).length
                });
            } else {
                this.logData('No initial data found', 'warning');
            }
            this.scheduleRender();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.logData('Failed to load initial data', 'error', { error: error.message });
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    clearAllData() {
        console.log('🧹 Clearing ALL system data...');
        this.units.clear();
        this.markers.clear();
        this.unitPolylines.clear();
        this.unitHistory.clear();
        this.unitSessions.clear();
        this.driverOnlineStatus.clear();
        this.lastDataTimestamps.clear();
        this.inactiveUnitTracker.clear();
        this.routeColors.clear();
        // ✅ HANYA BERSIHKAN DATA CHAT MONITOR
        this.monitorChatRefs.forEach((ref, unitName) => {
            ref.off();
        });
        this.monitorChatRefs.clear();
        this.monitorChatMessages.clear();
        this.monitorUnreadCounts.clear();
        this.importantMarkers = [];
        this.dataLogger.logs = [];
        this.activeUnits = 0;
        this.totalDistance = 0;
        this.avgSpeed = 0;
        this.avgPerformanceScore = 0;
        this.totalViolations = 0;
        this.activeChatUnit = null;
        this.isMonitorChatOpen = false;
        this.analyticsEngine.clearAll();
        this.geofencingManager.clearAll();
        this.violationDetector.clearAll();
        this.performanceManager.clearAll();
        this.heatmapManager.clearAll();
        this.maintenancePredictor.clearAll();
        console.log('✅ All data cleared');
    }

    showLoadingIndicator(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
    }

    displayError(message) {
        this.logData(message, 'error');
        const notification = document.createElement('div');
        notification.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    testFirebaseConnection() {
        console.log('🔍 Testing Firebase connection...');
        database.ref('.info/connected').once('value')
            .then((snapshot) => {
                const connected = snapshot.val();
                console.log('📡 Firebase Connected:', connected);
            })
            .catch((error) => {
                console.error('❌ Firebase connection test failed:', error);
            });
    }

    showDebugPanel() {
        const debugHtml = `
            <div class="debug-panel card position-fixed" style="bottom: 10px; right: 10px; width: 400px; z-index: 9999;">
                <div class="card-header bg-dark text-white d-flex justify-content-between">
                    <span>🐛 Advanced Debug Panel</span>
                    <button class="btn btn-sm btn-outline-light" onclick="this.closest('.debug-panel').remove()">×</button>
                </div>
                <div class="card-body p-2">
                    <div class="mb-2">
                        <strong>Firebase Status:</strong> 
                        <span id="debugFirebaseStatus">Checking...</span>
                    </div>
                    <div class="mb-2">
                        <strong>Units Loaded:</strong> 
                        <span id="debugUnitsCount">${this.units.size}</span>
                    </div>
                    <div class="mb-2">
                        <strong>Analytics Score:</strong> 
                        <span id="debugAvgScore">${this.avgPerformanceScore}</span>
                    </div>
                    <div class="mb-2">
                        <strong>Violations:</strong> 
                        <span id="debugViolations">${this.totalViolations}</span>
                    </div>
                    <div class="mb-2">
                        <strong>Chat Units:</strong> 
                        <span id="debugChatUnits">${this.monitorChatRefs.size}</span>
                    </div>
                    <div class="mb-2">
                        <strong>Last Update:</strong> 
                        <span id="debugLastUpdate">${new Date().toLocaleTimeString()}</span>
                    </div>
                    <button class="btn btn-sm btn-warning w-100" onclick="window.gpsSystem.testFirebaseConnection()">
                        Test Connection
                    </button>
                    <button class="btn btn-sm btn-danger w-100 mt-1" onclick="forceCleanup()">
                        🧹 Force Cleanup
                    </button>
                    <button class="btn btn-sm btn-info w-100 mt-1" onclick="window.gpsSystem.analyticsEngine.exportAnalyticsData()">
                        📊 Export Analytics
                    </button>
                    <button class="btn btn-sm btn-success w-100 mt-1" onclick="window.gpsSystem.reportGenerator.generateDailyReport()">
                        📈 Generate Report
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', debugHtml);
        setInterval(() => {
            const statusElement = document.getElementById('debugFirebaseStatus');
            const unitsElement = document.getElementById('debugUnitsCount');
            const scoreElement = document.getElementById('debugAvgScore');
            const violationsElement = document.getElementById('debugViolations');
            const chatUnitsElement = document.getElementById('debugChatUnits');
            const updateElement = document.getElementById('debugLastUpdate');
            if (statusElement) {
                database.ref('.info/connected').once('value').then((snapshot) => {
                    statusElement.textContent = snapshot.val() ? '🟢 CONNECTED' : '🔴 DISCONNECTED';
                    statusElement.className = snapshot.val() ? 'text-success' : 'text-danger';
                });
            }
            if (unitsElement) {
                unitsElement.textContent = this.units.size;
            }
            if (scoreElement) {
                scoreElement.textContent = this.avgPerformanceScore;
            }
            if (violationsElement) {
                violationsElement.textContent = this.totalViolations;
            }
            if (chatUnitsElement) {
                chatUnitsElement.textContent = this.monitorChatRefs.size;
            }
            if (updateElement) {
                updateElement.textContent = new Date().toLocaleTimeString();
            }
        }, 2000);
    }

    downloadRouteData() {
    const exportLines = [];
    exportLines.push("NAMA DT,KECEPATAN (km/h),TOTAL JARAK (km)");

    this.units.forEach((unit, unitName) => {
        const history = this.unitHistory.get(unitName) || [];
        if (history.length === 0) {
            // Jika tidak ada history, export data real-time terakhir
            exportLines.push(`${unitName},${unit.speed},${unit.distance}`);
        } else {
            // Export setiap titik dalam history
            history.forEach(point => {
                exportLines.push(`${unitName},${point.speed || 0},${point.distance || 0}`);
            });
        }
    });

    // Buat file CSV
    const csvContent = exportLines.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gps-data-per-second-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.logData('Data per detik berhasil diekspor', 'success');
}

    setupDataLogger() {
        this.loadLogs();
        this.renderLogger();
        this.logData('Advanced GPS Analytics System initialized', 'system', {
            timestamp: new Date().toISOString(),
            version: '5.0',
            features: [
                'Real-time Analytics',
                'Performance Scoring', 
                'Violation Detection',
                'Geofencing',
                'Maintenance Prediction',
                'Heatmap Visualization',
                'Advanced Reporting'
            ]
        });
    }

    logData(message, level = 'info', metadata = {}) {
        const logEntry = {
            id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            timeDisplay: new Date().toLocaleTimeString('id-ID'),
            dateDisplay: new Date().toLocaleDateString('id-ID'),
            level: level,
            message: message,
            metadata: metadata
        };
        this.dataLogger.logs.unshift(logEntry);
        if (this.dataLogger.logs.length > this.dataLogger.maxLogs) {
            this.dataLogger.logs = this.dataLogger.logs.slice(0, this.dataLogger.maxLogs);
        }
        this.saveLogs();
        this.renderLogger();
        console.log(`[${level.toUpperCase()}] ${message}`, metadata);
    }

    loadLogs() {
        try {
            const savedLogs = localStorage.getItem('sagm_advanced_logs');
            if (savedLogs) {
                this.dataLogger.logs = JSON.parse(savedLogs);
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
            this.dataLogger.logs = [];
        }
    }

    saveLogs() {
        try {
            localStorage.setItem('sagm_advanced_logs', JSON.stringify(this.dataLogger.logs));
        } catch (error) {
            console.error('Failed to save logs:', error);
        }
    }

    renderLogger() {
        const container = document.getElementById('dataLoggerContainer');
        if (!container) return;
        let html = `
            <div class="card">
                <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">📊 Advanced Data Logger System</h6>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-light" onclick="window.gpsSystem.clearAllLogs()">
                            🗑️ Clear
                        </button>
                        <button class="btn btn-outline-light" onclick="window.gpsSystem.exportLogData()">
                            📥 Export
                        </button>
                        <button class="btn btn-outline-light" onclick="window.gpsSystem.exportAnalyticsReport()">
                            📈 Analytics Report
                        </button>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                        <table class="table table-sm table-striped mb-0">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th width="120">Waktu</th>
                                    <th width="80">Level</th>
                                    <th>Pesan</th>
                                    <th width="100">Unit</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        if (this.dataLogger.logs.length === 0) {
            html += `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        Tidak ada data log
                    </td>
                </tr>
            `;
        } else {
            this.dataLogger.logs.forEach(log => {
                const levelBadge = this.getLogLevelBadge(log.level);
                const unitInfo = log.metadata.unit ? `<span class="badge bg-primary">${log.metadata.unit}</span>` : '';
                html += `
                    <tr class="log-entry log-${log.level}">
                        <td><small>${log.timeDisplay}</small></td>
                        <td>${levelBadge}</td>
                        <td>
                            <div class="log-message">${log.message}</div>
                            ${log.metadata.details ? `<small class="text-muted">${log.metadata.details}</small>` : ''}
                        </td>
                        <td>${unitInfo}</td>
                    </tr>
                `;
            });
        }
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    getLogLevelBadge(level) {
        const badges = {
            'info': '<span class="badge bg-info">INFO</span>',
            'success': '<span class="badge bg-success">SUCCESS</span>',
            'warning': '<span class="badge bg-warning">WARNING</span>',
            'error': '<span class="badge bg-danger">ERROR</span>',
            'gps': '<span class="badge bg-primary">GPS</span>',
            'system': '<span class="badge bg-secondary">SYSTEM</span>',
            'analytics': '<span class="badge bg-info">ANALYTICS</span>',
            'violation': '<span class="badge bg-danger">VIOLATION</span>',
            'maintenance': '<span class="badge bg-warning">MAINTENANCE</span>'
        };
        return badges[level] || '<span class="badge bg-dark">UNKNOWN</span>';
    }

    clearAllLogs() {
        if (confirm('Yakin ingin menghapus semua logs?')) {
            this.dataLogger.logs = [];
            this.saveLogs();
            this.renderLogger();
            this.logData('All logs cleared', 'system');
        }
    }

    exportLogData() {
        const exportData = {
            exportedAt: new Date().toISOString(),
            totalLogs: this.dataLogger.logs.length,
            system: 'Advanced SAGM GPS Analytics System',
            logs: this.dataLogger.logs
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sagm-advanced-logs-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        this.logData('Advanced logs exported successfully', 'success', {
            file: link.download,
            totalLogs: this.dataLogger.logs.length
        });
    }

    exportAnalyticsReport() {
        this.reportGenerator.exportDailyReport();
    }

    cleanup() {
        console.log('🧹 Comprehensive system cleanup with analytics support...');
        this.analyticsEngine.cleanup();
        this.geofencingManager.cleanup();
        this.violationDetector.cleanup();
        this.performanceManager.cleanup();
        this.heatmapManager.cleanup();
        this.maintenancePredictor.cleanup();
        this.notificationSystem.cleanup();
        this.cleanupChatEventListeners();
        this.cleanupFirebaseListeners();
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals.clear();
        if (this.updateDebounce) {
            clearTimeout(this.updateDebounce);
        }
        this.monitorChatRefs.forEach(ref => ref.off());
        this.monitorChatRefs.clear();
        database.ref('/chat').off('child_added');
        database.ref('/chat').off('child_removed');
        this.clearAllData();
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        console.log('✅ Advanced system cleanup completed');
    }

    addToOfflineQueue(unitName, positionData) {
        if (!this.offlineQueue.has(unitName)) {
            this.offlineQueue.set(unitName, []);
        }
        this.offlineQueue.get(unitName).push(positionData);
        localStorage.setItem(`offline_${unitName}`, JSON.stringify(this.offlineQueue.get(unitName)));
    }

    syncOfflineData() {
        this.offlineQueue.forEach((positions, unitName) => {
            if (positions.length > 0) {
                const ref = database.ref(`/units/${unitName}`);
                positions.forEach(pos => {
                    ref.update(pos).then(() => {
                        this.offlineQueue.set(unitName, this.offlineQueue.get(unitName).filter(p => p !== pos));
                    });
                });
            }
        });
        this.offlineQueue.forEach((_, unitName) => {
            localStorage.removeItem(`offline_${unitName}`);
        });
    }

    // === SERVICE WORKER & OFFLINE ===
    async setupServiceWorker() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            this.serviceWorkerReady = true;
            setTimeout(() => this.loadOfflineData(), 3000);
        } else {
            setTimeout(() => this.setupServiceWorker(), 2000);
        }
    }

    async loadOfflineData() {
        if (!this.serviceWorkerReady) return;
        try {
            const positions = await this.getOfflinePositionsFromSW();
            this.processOfflinePositions(positions);
        } catch (error) {
            console.error('❌ Failed to load offline data:', error);
        }
    }

    async getOfflinePositionsFromSW() {
        return new Promise((resolve, reject) => {
            if (!navigator.serviceWorker.controller) {
                reject(new Error('Service Worker not available'));
                return;
            }
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (event) => {
                if (event.data.type === 'OFFLINE_POSITIONS_RESPONSE') {
                    resolve(event.data.data);
                } else if (event.data.type === 'ERROR_RESPONSE') {
                    reject(new Error(event.data.data.error));
                }
            };
            navigator.serviceWorker.controller.postMessage({
                type: 'GET_OFFLINE_POSITIONS'
            }, [messageChannel.port2]);
        });
    }

    processOfflinePositions(positions) {
        if (!positions || positions.length === 0) {
            console.log('📭 No offline positions found');
            return;
        }
        console.log(`🔄 Processing ${positions.length} offline positions`);
        const positionsByUnit = {};
        positions.forEach(position => {
            if (!positionsByUnit[position.unitName]) {
                positionsByUnit[position.unitName] = [];
            }
            positionsByUnit[position.unitName].push(position);
        });
        Object.keys(positionsByUnit).forEach(unitName => {
            const unitPositions = positionsByUnit[unitName];
            this.addOfflinePositionsToUnit(unitName, unitPositions);
        });
        this.logData(`Processed ${positions.length} offline positions for ${Object.keys(positionsByUnit).length} units`, 'gps');
    }

    addOfflinePositionsToUnit(unitName, positions) {
        if (!this.unitHistory.has(unitName)) {
            this.unitHistory.set(unitName, []);
        }
        const history = this.unitHistory.get(unitName);
        positions.forEach(position => {
            const exists = history.some(point => 
                point.timestamp === position.timestamp &&
                point.latitude === position.lat &&
                point.longitude === position.lng
            );
            if (!exists) {
                history.push({
                    latitude: position.lat,
                    longitude: position.lng,
                    timestamp: position.timestamp,
                    speed: position.speed || 0,
                    isOffline: true
                });
            }
        });
        history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        this.updateUnitPolyline(unitName);
        console.log(`📍 Added ${positions.length} offline positions to ${unitName}`);
    }

    async sendMessageToSW(type, data) {
        return new Promise((resolve, reject) => {
            if (!navigator.serviceWorker.controller) {
                reject(new Error('Service Worker controller not available'));
                return;
            }
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (event) => {
                if (event.data.type === 'ERROR_RESPONSE') {
                    reject(new Error(event.data.data.error));
                } else {
                    resolve(event.data);
                }
            };
            const timeoutId = setTimeout(() => {
                reject(new Error('Service Worker response timeout'));
            }, 5000);
            messageChannel.port1.onmessage = (event) => {
                clearTimeout(timeoutId);
                if (event.data.type === 'ERROR_RESPONSE') {
                    reject(new Error(event.data.data.error));
                } else {
                    resolve(event.data);
                }
            };
            navigator.serviceWorker.controller.postMessage({
                type: type,
                data: data
            }, [messageChannel.port2]);
        });

    }
    cleanupOrphanedMarkers(){}
}

// ==== ANALYTICS ENGINE ====
class AnalyticsEngine {
    constructor(mainSystem) {
        this.main = mainSystem;
        this.unitAnalytics = new Map();
        this.charts = new Map();
        this.dashboardData = {
            averageScore: 0,
            bestUnit: '',
            systemEfficiency: 0,
            totalViolations: 0,
        };
        
        // ✅ FIX: Inisialisasi interval tracking
        this.analyticsInterval = null;
    }

    initialize() {
        console.log('📊 Analytics Engine initialized');
        this.setupCharts();
        this.startAnalyticsProcessing(); // ✅ SEKARANG METHOD INI ADA
    }

    // ✅ FIX: Tambahkan method yang hilang
    startAnalyticsProcessing() {
        console.log('🔄 Starting analytics processing...');
        
        // Hentikan interval sebelumnya jika ada
        if (this.analyticsInterval) {
            clearInterval(this.analyticsInterval);
        }
        
        // Setup interval untuk update analytics secara berkala
        this.analyticsInterval = setInterval(() => {
            this.updateAllCharts();
            this.updateDashboard();
            this.processAllUnitsAnalytics();
        }, 30000); // Update setiap 30 detik
        
        console.log('✅ Analytics processing started');
    }

    // ✅ FIX: Tambahkan method untuk proses semua unit
    processAllUnitsAnalytics() {
        this.main.units.forEach(unit => {
            if (unit.isOnline) {
                this.processUnitData(unit);
            }
        });
    }

    // ✅ FIX: Perbaiki method processUnitData
    processUnitData(unit) {
        try {
            
             console.log(`Processing unit: ${unit.name}`);
        
    } catch (error) {
        console.error(`Error processing analytics for ${unit.name}:`, error);
        this.main.logData(`Analytics error for ${unit.name}`, 'error', {
            unit: unit.name,
            error: error.message
        });
    }
}


    initializeUnit(unit) {
        this.unitAnalytics.set(unit.name, {
            performanceScore: 75,
            lastUpdate: Date.now()
        });
    }

    updateDashboard() {
        let totalScore = 0;
        let unitCount = 0;
        let bestUnit = '';
        let bestScore = 0;

        this.main.units.forEach(unit => {
            if (unit.isOnline) {
                const score = unit.analytics.performanceScore || 0;
                totalScore += score;
                unitCount++;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestUnit = unit.name;
                }
            }
        });

        this.dashboardData.averageScore = unitCount > 0 ? Math.round(totalScore / unitCount) : 0;
        this.dashboardData.bestUnit = bestUnit;
        this.dashboardData.systemEfficiency = this.dashboardData.averageScore;

        this.updateDashboardDisplay();
    }

    updateDashboardDisplay() {
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };

        updateElement('averageScore', this.dashboardData.averageScore);
        updateElement('bestUnit', this.dashboardData.bestUnit);
        updateElement('systemEfficiency', this.dashboardData.systemEfficiency + '%');
        
        // Update progress bar
        const efficiencyBar = document.querySelector('.efficiency-bar .progress-bar');
        if (efficiencyBar) {
            efficiencyBar.style.width = this.dashboardData.systemEfficiency + '%';
            efficiencyBar.className = `progress-bar bg-${this.main.getScoreClass(this.dashboardData.systemEfficiency).replace('score-', '')}`;
        }
    }

    showUnitAnalytics(unitName) {
        try {
            const unit = this.main.units.get(unitName);
            if (!unit) {
                console.warn(`Unit ${unitName} tidak ditemukan`);
                return;
            }

            const analytics = this.unitAnalytics.get(unitName) || {};
            
            // ✅ FIX: Periksa apakah elemen modal ada sebelum mengaksesnya
            const modalTitle = document.getElementById('analyticsModalTitle');
            const modalBody = document.getElementById('analyticsModalBody');
            
            if (!modalTitle || !modalBody) {
                console.error('Modal elements not found in DOM');
                
                // Fallback: tampilkan di console atau alert
                console.log(`📊 Analytics untuk ${unitName}:`, {
                    performanceScore: analytics.performanceScore || 0,
                    efficiency: analytics.efficiency || 0,
                    speedEfficiency: analytics.speedEfficiency || 0,
                });
                
                // Atau buat modal secara dinamis
                this.createDynamicAnalyticsModal(unitName, unit, analytics);
                return;
            }

            const modalBodyContent = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>⚠️ Pelanggaran</h6>
                        <div id="unitViolationsList">
                            ${this.renderUnitViolations(unit)}
                        </div>
                        
                        <h6 class="mt-3">💡 Rekomendasi</h6>
                        <div id="unitRecommendations">
                            ${this.generateRecommendations(unit)}
                        </div>

                        <h6 class="mt-3">🔧 Maintenance</h6>
                        <div id="unitMaintenance">
                            ${this.renderUnitMaintenance(unit)}
                        </div>
                    </div>
                </div>
            `;

            modalTitle.textContent = `Analytics - ${unitName}`;
            modalBody.innerHTML = modalBodyContent;
            
            // ✅ FIX: Gunakan Bootstrap modal dengan error handling
            const modalElement = document.getElementById('analyticsModal');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
            } else {
                console.error('Analytics modal element not found');
                // Fallback: tampilkan dalam div sederhana
                this.showFallbackAnalytics(unitName, unit, analytics);
            }

        } catch (error) {
            console.error('Error showing unit analytics:', error);
            this.main.logData(`Gagal menampilkan analytics untuk ${unitName}`, 'error', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    // ✅ FIX: Tambahkan method fallback untuk menampilkan analytics
    createDynamicAnalyticsModal(unitName, unit, analytics) {
        // Cek jika modal sudah ada
        let modalElement = document.getElementById('analyticsModal');
        
        if (!modalElement) {
            // Buat modal secara dinamis
            const modalHTML = `
                <div class="modal fade" id="analyticsModal" tabindex="-1" aria-labelledby="analyticsModalTitle" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="analyticsModalTitle">Analytics</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body" id="analyticsModalBody">
                                <!-- Content will be loaded here -->
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modalElement = document.getElementById('analyticsModal');
        }

        // Sekarang tampilkan modal
        const modalTitle = document.getElementById('analyticsModalTitle');
        const modalBody = document.getElementById('analyticsModalBody');
        
        if (modalTitle && modalBody) {
            modalTitle.textContent = `Analytics - ${unitName}`;
            modalBody.innerHTML = this.createAnalyticsContent(unitName, unit, analytics);
            
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }

    // ✅ FIX: Method untuk membuat konten analytics
    createAnalyticsContent(unitName, unit, analytics) {
        return `
            <div class="row">
                <div class="col-md-6">
                    <h5>📊 Analytics Detail - ${unitName}</h5>
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-6">
                                    <div class="h2 text-${this.main.getScoreClass(analytics.performanceScore)}">
                                        ${analytics.performanceScore || 0}
                                    </div>
                                    <small>Overall Score</small>
                                </div>
                                <div class="col-6">
                                    <div class="h4 text-success">${analytics.efficiency || 0}%</div>
                                    <small>Efficiency</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <h6>📈 Metrik Detail</h6>
                    <div class="list-group">
                        <div class="list-group-item d-flex justify-content-between">
                            <span>Kecepatan:</span>
                            <span>${unit.speed} km/h</span>
                        </div>
                        <div class="list-group-item d-flex justify-content-between">
                            <span>Efisiensi Kecepatan:</span>
                            <span>${analytics.speedEfficiency || 0}%</span>
                        </div>
                        <div class="list-group-item d-flex justify-content-between">
                            <span>Jarak Tempuh:</span>
                            <span>${unit.distance.toFixed(1)} km</span>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <h6>⚠️ Pelanggaran</h6>
                    <div id="unitViolationsList">
                        ${this.renderUnitViolations(unit)}
                    </div>
                    
                    <h6 class="mt-3">💡 Rekomendasi</h6>
                    <div id="unitRecommendations">
                        ${this.generateRecommendations(unit)}
                    </div>

                    <h6 class="mt-3">🔧 Maintenance</h6>
                    <div id="unitMaintenance">
                        ${this.renderUnitMaintenance(unit)}
                    </div>
                </div>
            </div>
        `;
    }

    
    showFallbackAnalytics(unitName, unit) {
    const fallbackHTML = `
        <div class="alert alert-info position-fixed top-0 start-50 translate-middle-x mt-3" style="z-index: 9999; min-width: 300px;">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h6>📊 ${unitName} Analytics</h6>
                    <div class="small">
                        Speed: ${unit.speed} km/h<br>
                        Distance: ${unit.distance.toFixed(1)} km
                    </div>
                </div>
                <button type="button" class="btn-close btn-sm" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', fallbackHTML);
    
    setTimeout(() => {
        const alert = document.querySelector('.alert-info');
        if (alert) alert.remove();
    }, 5000);
}

    renderUnitViolations(unit) {
        const violations = unit.analytics.violations || [];
        if (violations.length === 0) {
            return '<div class="alert alert-success">✅ Tidak ada pelanggaran</div>';
        }

        return violations.map(violation => `
            <div class="alert alert-warning violation-alert">
                <strong>${violation.type}</strong><br>
                <small>${violation.message}</small>
                <br>
                <small class="text-muted">${new Date(violation.timestamp).toLocaleTimeString('id-ID')}</small>
            </div>
        `).join('');
    }

    renderUnitMaintenance(unit) {
        const maintenance = this.main.maintenancePredictor.getUnitMaintenance(unit.name);
        if (!maintenance) {
            return '<div class="alert alert-info">🔧 Data maintenance sedang dimuat...</div>';
        }

        let alerts = [];
        Object.entries(maintenance).forEach(([service, data]) => {
            if (data.remaining < 1000) {
                alerts.push(`
                    <div class="alert alert-warning">
                        <strong>${service}</strong><br>
                        <small>Tersisa: ${data.remaining} km</small>
                    </div>
                `);
            }
        });

        if (alerts.length === 0) {
            return '<div class="alert alert-success">✅ Semua maintenance dalam kondisi baik</div>';
        }

        return alerts.join('');
    }

    generateRecommendations(unit) {
        const recommendations = [];
        
        if (recommendations.length === 0) {
            return '<div class="alert alert-success">✅ Performa sudah optimal</div>';
        }

        return recommendations.map(rec => `
            <div class="alert alert-info">
                <small>${rec}</small>
            </div>
        `).join('');
    }

    setupCharts() {
        this.setupPerformanceChart();
        this.setupViolationsChart();
        this.setupMaintenanceChart();
        this.setupZonesChart();
    }

    setupPerformanceChart() {
        const ctx = document.getElementById('performanceChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.set('performance', new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 10}, (_, i) => `${i * 5}m lalu`),
                datasets: [{
                    label: 'Skor Performa Rata-rata',
                    data: Array(10).fill(75),
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        }));
    }

    setupViolationsChart() {
        const ctx = document.getElementById('violationsChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.set('violations', new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Kecepatan', 'Idle Time', 'Bahan Bakar', 'Zona'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#ff6b6b', '#ffd93d', '#6bcf7f', '#4d96ff']
                }]
            }
        }));
    }

    setupMaintenanceChart() {
    const ctx = document.getElementById('maintenanceChart')?.getContext('2d');
    if (!ctx) return;

    this.charts.set('maintenance', new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [
                'Oli Mesin', 
                'Oli Persneling', 
                'Oli Gardan', 
                'Filter Solar & Oli',
                'Filter Udara',
                'Service Rem',
                'Service Besar'
            ],
            datasets: [{
                label: 'KM Tersisa',
                data: [2500, 10000, 10000, 2500, 5000, 8000, 10000],
                backgroundColor: [
                    '#28a745', '#20c997', '#17a2b8', '#ffc107', 
                    '#fd7e14', '#dc3545', '#6f42c1'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Jadwal Maintenance Kendaraan'
                }
            }
        }
    }));
}

    setupZonesChart() {
        const ctx = document.getElementById('zonesChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.set('zones', new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['PKS', 'Kantor', 'Afdeling I', 'Afdeling II', 'Afdeling III'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: ['#6f42c1', '#e83e8c', '#28a745', '#20c997', '#ffc107']
                }]
            }
        }));
    }

    updateAllCharts() {
        this.updatePerformanceChart();
        this.updateViolationsChart();
        
    }

    updatePerformanceChart() {
        const chart = this.charts.get('performance');
        if (!chart) return;

        // Simulate real-time data updates
        const newData = chart.data.datasets[0].data.slice(1);
        newData.push(this.dashboardData.averageScore);
        chart.data.datasets[0].data = newData;
        chart.update('none');
    }

    updateViolationsChart() {
        const chart = this.charts.get('violations');
        if (!chart) return;

        let speeding = 0, idle = 0, zone = 0;

        this.main.units.forEach(unit => {
            unit.analytics.violations?.forEach(violation => {
                switch(violation.type) {
                    case 'SPEEDING': speeding++; break;
                    case 'EXCESSIVE_IDLE': idle++; break;
                    case 'ZONE_VIOLATION': zone++; break;
                }
            });
        });

        chart.data.datasets[0].data = [speeding, idle, zone];
        chart.update();
    }

    

    cleanupUnit(unitName) {
        this.unitAnalytics.delete(unitName);
    }

    clearAll() {
        this.unitAnalytics.clear();
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }

    // ✅ FIX: Perbaiki method cleanup
    cleanup() {
        console.log('🧹 Comprehensive system cleanup with analytics support...');
        
        // Cleanup Service Worker
        if (this.serviceWorkerRegistration) {
            // Kirim pesan cleanup ke Service Worker
            this.sendMessageToSW('LOGOUT_CLEANUP', {})
                .then(() => {
                    console.log('✅ Service Worker cleanup completed');
                })
                .catch(error => {
                    console.error('❌ Service Worker cleanup failed:', error);
                })
                .finally(() => {
                    // Unregister Service Worker
                    this.serviceWorkerRegistration.unregister().then(() => {
                        console.log('✅ Service Worker unregistered');
                    });
                });
        }
    }
}

// ==== GEOFENCING MANAGER ====
class GeofencingManager {
    constructor(mainSystem) {
        this.main = mainSystem;
        this.zones = new Map();
        this.zoneMarkers = new Map();
        this.zoneListeners = new Map();
        this.zoneViolations = new Map();
        this.monitoringInterval = null; // ✅ FIX: Tambahkan properti
    }

    initialize() {
        console.log('📍 Geofencing Manager initialized');
        this.setupDefaultZones();
        this.startZoneMonitoring(); // ✅ FIX: Ganti nama method
    }

    // ✅ FIX: Ganti nama method dan tambahkan properti
    startZoneMonitoring() {
        console.log('🔄 Starting zone monitoring...');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        this.monitoringInterval = setInterval(() => {
            this.checkZoneTransitions();
        }, 5000);
    }

    setupDefaultZones() {
        // Add operational zones
        this.addZone('PKS_SAGM', this.main.importantLocations.PKS_SAGM);
        this.addZone('KANTOR_KEBUN', this.main.importantLocations.KANTOR_KEBUN);
        
        // Add afdeling zones
        this.addAfdelingZones();
    }

    addAfdelingZones() {
        const afdelingZones = {
            'AFD_I': { lat: -0.4000, lng: 102.9400, radius: 2000, name: 'Afdeling I', type: 'afdeling' },
            'AFD_II': { lat: -0.4200, lng: 102.9200, radius: 2000, name: 'Afdeling II', type: 'afdeling' },
            'AFD_III': { lat: -0.3800, lng: 102.9300, radius: 2000, name: 'Afdeling III', type: 'afdeling' },
            'AFD_IV': { lat: -0.4100, lng: 102.9500, radius: 2000, name: 'Afdeling IV', type: 'afdeling' },
            'AFD_V': { lat: -0.3900, lng: 102.9600, radius: 2000, name: 'Afdeling V', type: 'afdeling' },
            'KKPA': { lat: -0.4300, lng: 102.9400, radius: 1500, name: 'KKPA', type: 'afdeling' }
        };

        Object.entries(afdelingZones).forEach(([id, zone]) => {
            this.addZone(id, zone);
        });
    }

    addZone(zoneId, zoneConfig) {
        this.zones.set(zoneId, {
            id: zoneId,
            ...zoneConfig,
            unitsInside: new Set(),
            entryLog: [],
            exitLog: []
        });

        this.createZoneMarker(zoneId, zoneConfig);
    }

    createZoneMarker(zoneId, zoneConfig) {
        if (!this.main.map) return;

        const zone = this.zones.get(zoneId);
        const circle = L.circle([zoneConfig.lat, zoneConfig.lng], {
            color: this.getZoneColor(zoneConfig.type),
            fillColor: this.getZoneColor(zoneConfig.type),
            fillOpacity: 0.1,
            radius: zoneConfig.radius
        }).addTo(this.main.map);

        circle.bindPopup(this.createZonePopup(zone));
        this.zoneMarkers.set(zoneId, circle);
    }

    getZoneColor(zoneType) {
        const colors = {
            'pks': '#6f42c1',
            'office': '#e83e8c',
            'afdeling': '#28a745',
            'restricted': '#dc3545'
        };
        return colors[zoneType] || '#6c757d';
    }

    createZonePopup(zone) {
        return `
            <div class="zone-popup">
                <h6>📍 ${zone.name}</h6>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Tipe:</span>
                        <span class="info-value">${zone.type.toUpperCase()}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Radius:</span>
                        <span class="info-value">${zone.radius}m</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Unit di dalam:</span>
                        <span class="info-value">${zone.unitsInside.size}</span>
                    </div>
                </div>
            </div>
        `;
    }

    checkUnitZones(unit) {
        this.zones.forEach((zone, zoneId) => {
            const isInside = this.isUnitInZone(unit, zone);
            const wasInside = zone.unitsInside.has(unit.name);

            if (isInside && !wasInside) {
                this.handleZoneEntry(unit, zone);
            } else if (!isInside && wasInside) {
                this.handleZoneExit(unit, zone);
            }
        });
    }

    checkZoneTransitions() {
        this.main.units.forEach(unit => {
            this.checkUnitZones(unit);
        });
    }

    isUnitInZone(unit, zone) {
        const distance = this.calculateDistance(
            unit.latitude, unit.longitude,
            zone.lat, zone.lng
        );
        return distance <= (zone.radius / 1000); // Convert to km
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    isUnitInZone(unit, zone) {
        const distance = this.calculateDistance( // PAKAI this.
            unit.latitude, unit.longitude,
            zone.lat, zone.lng
        );
        return distance <= (zone.radius / 1000);
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    handleZoneEntry(unit, zone) {
        zone.unitsInside.add(unit.name);
        zone.entryLog.push({
            unit: unit.name,
            timestamp: new Date().toISOString(),
            driver: unit.driver
        });

        this.main.logData(`Unit ${unit.name} masuk zona ${zone.name}`, 'analytics', {
            unit: unit.name,
            zone: zone.name,
            driver: unit.driver
        });

        this.main.notificationSystem.showZoneNotification(unit, zone, 'entry');
    }

    handleZoneExit(unit, zone) {
        zone.unitsInside.delete(unit.name);
        zone.exitLog.push({
            unit: unit.name,
            timestamp: new Date().toISOString(),
            driver: unit.driver
        });

        this.main.logData(`Unit ${unit.name} keluar zona ${zone.name}`, 'analytics', {
            unit: unit.name,
            zone: zone.name,
            driver: unit.driver
        });
    }

    toggleZones() {
        this.zoneMarkers.forEach((marker, zoneId) => {
            if (this.main.map.hasLayer(marker)) {
                this.main.map.removeLayer(marker);
            } else {
                marker.addTo(this.main.map);
            }
        });
    }

    showZoneManager() {
        const modalBody = `
            <div class="row">
                <div class="col-md-6">
                    <h6>📍 Zona Terkonfigurasi</h6>
                    <div class="list-group">
                        ${Array.from(this.zones.values()).map(zone => `
                            <div class="list-group-item">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <strong>${zone.name}</strong>
                                        <br>
                                        <small class="text-muted">${zone.type} - ${zone.radius}m</small>
                                    </div>
                                    <span class="badge bg-primary">${zone.unitsInside.size} unit</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="col-md-6">
                    <h6>📊 Aktivitas Zona</h6>
                    <div id="zoneActivity">
                        ${this.renderZoneActivity()}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('zoneManagerBody').innerHTML = modalBody;
        const modal = new bootstrap.Modal(document.getElementById('zoneManagerModal'));
        modal.show();
    }

    renderZoneActivity() {
        let activity = [];
        
        this.zones.forEach(zone => {
            if (zone.entryLog.length > 0) {
                const lastEntry = zone.entryLog[zone.entryLog.length - 1];
                activity.push({
                    zone: zone.name,
                    unit: lastEntry.unit,
                    time: lastEntry.timestamp,
                    type: 'entry'
                });
            }
        });

        if (activity.length === 0) {
            return '<div class="alert alert-info">Tidak ada aktivitas zona terkini</div>';
        }

        return activity.map(act => `
            <div class="alert alert-success mb-2">
                <small>
                    <strong>${act.unit}</strong> masuk ${act.zone}<br>
                    ${new Date(act.time).toLocaleTimeString('id-ID')}
                </small>
            </div>
        `).join('');
    }

    clearAll() {
        this.zoneMarkers.forEach(marker => {
            if (this.main.map) {
                this.main.map.removeLayer(marker);
            }
        });
        this.zoneMarkers.clear();
        this.zones.clear();
    }

    cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.clearAll();
        console.log('🧹 Geofencing Manager cleaned up');
    }
}

// ==== VIOLATION DETECTOR ====
class ViolationDetector {
    constructor(mainSystem) {
        this.main = mainSystem;
        this.violations = new Map();
        this.monitoringInterval = null; // ✅ FIX: Tambahkan properti
        this.violationTypes = {
            SPEEDING: {
                threshold: 60,
                message: 'Kecepatan berlebihan',
                penalty: 15
            },
            EXCESSIVE_IDLE: {
                threshold: 30, // minutes
                message: 'Idle terlalu lama',
                penalty: 10
            
            },
            ZONE_VIOLATION: {
                message: 'Pelanggaran zona operasional',
                penalty: 25
            }
        };
    }

    initialize() {
        console.log('⚠️ Violation Detector initialized');
        this.startViolationMonitoring();
    }

    // ✅ FIX: Tambahkan properti interval
    startViolationMonitoring() {
        console.log('🔄 Starting violation monitoring...');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        this.monitoringInterval = setInterval(() => {
            this.main.units.forEach(unit => {
                this.checkViolations(unit);
            });
        }, 30000);
    }

    checkViolations(unit) {
        const violations = [];
        
        // Check speeding
        if (unit.speed > this.violationTypes.SPEEDING.threshold) {
            violations.push(this.createViolation('SPEEDING', unit));
        }
        
        // Check excessive idle time
        if (this.calculateIdleTime(unit) > this.violationTypes.EXCESSIVE_IDLE.threshold) {
            violations.push(this.createViolation('EXCESSIVE_IDLE', unit));
        }
        
        // Update unit violations
        if (violations.length > 0) {
            unit.analytics.violations = violations;
            this.violations.set(unit.name, violations);
            this.logViolations(unit, violations);
        }
    }

    createViolation(type, unit) {
        const violationConfig = this.violationTypes[type];
        return {
            type: type,
            message: violationConfig.message,
            penalty: violationConfig.penalty,
            timestamp: new Date().toISOString(),
            details: this.getViolationDetails(type, unit)
        };
    }

    getViolationDetails(type, unit) {
        switch(type) {
            case 'SPEEDING':
                return `Kecepatan: ${unit.speed} km/h (Maks: ${this.violationTypes.SPEEDING.threshold} km/h)`;
            case 'EXCESSIVE_IDLE':
                return `Idle time: ${this.calculateIdleTime(unit)} menit`;
            default:
                return 'Pelanggaran terdeteksi';
        }
    }

    calculateIdleTime(unit) {
        // Simple idle time calculation - in real implementation, track movement history
        return unit.speed === 0 ? 5 : 0; // Placeholder
    }

    

    logViolations(unit, violations) {
        violations.forEach(violation => {
            this.main.logData(`Violation: ${violation.message} - ${unit.name}`, 'violation', {
                unit: unit.name,
                driver: unit.driver,
                violation: violation
            });
        });
    }

    updateViolationsDisplay() {
        const violationsList = document.getElementById('violationsList');
        if (!violationsList) return;

        let activeViolations = [];
        
        this.main.units.forEach(unit => {
            const unitViolations = unit.analytics.violations || [];
            activeViolations.push(...unitViolations.map(v => ({
                ...v,
                unit: unit.name,
                driver: unit.driver
            })));
        });

        if (activeViolations.length === 0) {
            violationsList.innerHTML = '<div class="alert alert-success">✅ Tidak ada pelanggaran aktif</div>';
            return;
        }

        // Show latest 5 violations
        const recentViolations = activeViolations
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5);

        violationsList.innerHTML = recentViolations.map(violation => `
            <div class="alert alert-warning violation-alert">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${violation.unit}</strong> - ${violation.driver}
                        <br>
                        <small>${violation.message}</small>
                        <br>
                        <small class="text-muted">${new Date(violation.timestamp).toLocaleTimeString('id-ID')}</small>
                    </div>
                    <span class="badge bg-danger">-${violation.penalty}</span>
                </div>
            </div>
        `).join('');
    }

    cleanupUnit(unitName) {
        this.violations.delete(unitName);
    }

    clearAll() {
        this.violations.clear();
    }

    cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.clearAll();
        console.log('🧹 Violation Detector cleaned up');
    }
}

class PerformanceManager {
    constructor(mainSystem) {
        this.main = mainSystem;
        this.rankings = new Map();
        this.dailyScores = new Map();
        this.rankingInterval = null; // ✅ FIX: Tambahkan properti
    }

    initialize() {
        console.log('🏆 Performance Manager initialized');
        this.startRankingUpdates();
    }

    // ✅ FIX: Tambahkan properti interval
    startRankingUpdates() {
        console.log('🔄 Starting ranking updates...');
        
        if (this.rankingInterval) {
            clearInterval(this.rankingInterval);
        }
        
        this.rankingInterval = setInterval(() => {
            this.updateRankings();
        }, 30000);
    }

    updateRankings() {
        const unitsArray = Array.from(this.main.units.values())
            .filter(unit => unit.isOnline)
            .sort((a, b) => (b.analytics.performanceScore || 0) - (a.analytics.performanceScore || 0));

        this.rankings.clear();
        unitsArray.forEach((unit, index) => {
            this.rankings.set(unit.name, {
                rank: index + 1,
                score: unit.analytics.performanceScore || 0,
                unit: unit
            });
        });

        this.updateRankingsDisplay();
    }

    getBestUnit() {
        const topRanking = Array.from(this.rankings.values())[0];
        return topRanking ? topRanking.unit.name : null;
    }

    updateRankingsDisplay() {
        const rankingList = document.getElementById('driverRanking');
        if (!rankingList) return;

        const topRankings = Array.from(this.rankings.values())
            .slice(0, 5); // Top 5 only

        if (topRankings.length === 0) {
            rankingList.innerHTML = '<div class="list-group-item text-center text-muted py-3"><small>Tidak ada data ranking</small></div>';
            return;
        }

        rankingList.innerHTML = topRankings.map(ranking => `
            <div class="list-group-item ranking-item ranking-${ranking.rank}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-${this.getRankColor(ranking.rank)} me-2">#${ranking.rank}</span>
                        <strong>${ranking.unit.name}</strong>
                        <br>
                        <small class="text-muted">${ranking.unit.driver}</small>
                    </div>
                    <div class="text-end">
                        <div class="text-success">⭐ ${ranking.score}</div>
                        <small class="text-muted">${ranking.unit.afdeling}</small>
                    </div>
                </div>
            </div>
        `).join('');
    }

    getRankColor(rank) {
        switch(rank) {
            case 1: return 'warning';
            case 2: return 'secondary';
            case 3: return 'danger';
            default: return 'light';
        }
    }

    cleanupUnit(unitName) {
        this.rankings.delete(unitName);
        this.dailyScores.delete(unitName);
    }

    clearAll() {
        this.rankings.clear();
        this.dailyScores.clear();
    }

    cleanup() {
        if (this.rankingInterval) {
            clearInterval(this.rankingInterval);
            this.rankingInterval = null;
        }
        this.clearAll();
        console.log('🧹 Performance Manager cleaned up');
    }
}

// ==== HEATMAP MANAGER ====
class HeatmapManager {
    constructor(mainSystem) {
        this.main = mainSystem;
        this.heatmapLayer = null;
        this.heatmapData = [];
        this.isHeatmapActive = false;
    }

    initialize() {
        console.log('🔥 Heatmap Manager initialized');
        this.setupHeatmapControls();
    }

    // ✅ FIX: Tambahkan method yang hilang
    setupHeatmapControls() {
        console.log('🎛️ Setting up heatmap controls...');
        const toggle = document.getElementById('heatmapToggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this.toggleHeatmap();
            });
        }
    }

    toggleHeatmap() {
        if (this.isHeatmapActive) {
            this.hideHeatmap();
        } else {
            this.showHeatmap();
        }
    }

    showHeatmap() {
        if (!this.main.map) return;
        
        this.collectHeatmapData();
        
        if (this.heatmapLayer) {
            this.main.map.removeLayer(this.heatmapLayer);
        }

        // Simple heatmap implementation using circle markers
        this.heatmapLayer = L.layerGroup();
        
        this.heatmapData.forEach(point => {
            const intensity = Math.min(point.intensity, 1);
            const radius = 20 + (intensity * 50);
            const opacity = 0.3 + (intensity * 0.4);
            
            const circle = L.circle([point.lat, point.lng], {
                radius: radius,
                color: this.getHeatmapColor(intensity),
                fillColor: this.getHeatmapColor(intensity),
                fillOpacity: opacity,
                weight: 0
            });
            
            this.heatmapLayer.addLayer(circle);
        });

        this.heatmapLayer.addTo(this.main.map);
        this.isHeatmapActive = true;
        
        // Show controls
        const controls = document.getElementById('heatmapControls');
        if (controls) {
            controls.style.display = 'block';
        }
    }

    hideHeatmap() {
        if (this.heatmapLayer && this.main.map) {
            this.main.map.removeLayer(this.heatmapLayer);
        }
        this.isHeatmapActive = false;
        
        // Hide controls
        const controls = document.getElementById('heatmapControls');
        if (controls) {
            controls.style.display = 'none';
        }
    }

    collectHeatmapData() {
        this.heatmapData = [];
        
        this.main.units.forEach(unit => {
            if (unit.isOnline) {
                // Add current position
                this.heatmapData.push({
                    lat: unit.latitude,
                    lng: unit.longitude,
                    intensity: 0.8
                });
                
                // Add historical points
                const history = this.main.unitHistory.get(unit.name) || [];
                history.forEach(point => {
                    this.heatmapData.push({
                        lat: point.latitude,
                        lng: point.longitude,
                        intensity: 0.3
                    });
                });
            }
        });
    }

    getHeatmapColor(intensity) {
        // Green to red gradient based on intensity
        if (intensity < 0.3) return '#00ff00';
        if (intensity < 0.6) return '#ffff00';
        return '#ff0000';
    }

    clearAll() {
        this.hideHeatmap();
        this.heatmapData = [];
    }

    cleanup() {
        this.clearAll();
    }
}

// ==== MAINTENANCE PREDICTOR ====
class MaintenancePredictor {
    constructor(mainSystem) {
        this.main = mainSystem;
        this.maintenanceSchedule = new Map();
    }

    initialize() {
        console.log('🔧 Maintenance Predictor initialized');
        this.setupMaintenanceSchedule();
    }

    // ✅ FIX: Tambahkan method yang hilang
    setupMaintenanceSchedule() {
        console.log('📅 Setting up maintenance schedule...');
        // Initialize maintenance schedule for existing units
        this.main.units.forEach(unit => {
            this.initializeUnit(unit);
        });
    }

   initializeUnit(unit) {
    this.maintenanceSchedule.set(unit.name, {
        oilChange: this.calculateNextMaintenance(unit.distance, this.main.vehicleConfig.maintenanceIntervals.oilChange),
        gearOilChange: this.calculateNextMaintenance(unit.distance, this.main.vehicleConfig.maintenanceIntervals.gearOilChange),
        differentialOilChange: this.calculateNextMaintenance(unit.distance, this.main.vehicleConfig.maintenanceIntervals.differentialOilChange),
        fuelAndOilFilterChange: this.calculateNextMaintenance(unit.distance, this.main.vehicleConfig.maintenanceIntervals.fuelAndOilFilterChange),
        airFilterChange: this.calculateNextMaintenance(unit.distance, this.main.vehicleConfig.maintenanceIntervals.airFilterChange),
        brakeService: this.calculateNextMaintenance(unit.distance, this.main.vehicleConfig.maintenanceIntervals.brakeService),
        majorService: this.calculateNextMaintenance(unit.distance, this.main.vehicleConfig.maintenanceIntervals.majorService)
    });
}

getServiceInterval(service) {
    const intervals = {
        'oilChange': this.main.vehicleConfig.maintenanceIntervals.oilChange,
        'gearOilChange': this.main.vehicleConfig.maintenanceIntervals.gearOilChange,
        'differentialOilChange': this.main.vehicleConfig.maintenanceIntervals.differentialOilChange,
        'fuelAndOilFilterChange': this.main.vehicleConfig.maintenanceIntervals.fuelAndOilFilterChange,
        'airFilterChange': this.main.vehicleConfig.maintenanceIntervals.airFilterChange,
        'brakeService': this.main.vehicleConfig.maintenanceIntervals.brakeService,
        'majorService': this.main.vehicleConfig.maintenanceIntervals.majorService
    };
    return intervals[service] || 10000;
}

    calculateNextMaintenance(currentDistance, interval) {
        const nextService = Math.ceil(currentDistance / interval) * interval;
        const remaining = nextService - currentDistance;
        
        return {
            nextService: nextService,
            remaining: Math.max(0, remaining),
            dueSoon: remaining < 500,
            urgent: remaining < 100,
            status: remaining < 100 ? 'urgent' : remaining < 500 ? 'warning' : 'good'
        };
    }

    getUnitMaintenance(unitName) {
        return this.maintenanceSchedule.get(unitName);
    }

    // ✅ FIX: Tambahkan method yang hilang
    updateMaintenancePredictions() {
        this.main.units.forEach(unit => {
            const schedule = this.maintenanceSchedule.get(unit.name);
            if (schedule) {
                // Update predictions based on current distance
                Object.keys(schedule).forEach(service => {
                    const interval = this.getServiceInterval(service);
                    schedule[service] = this.calculateNextMaintenance(unit.distance, interval);
                });
            }
        });
    }

    // ✅ FIX: Tambahkan method yang hilang
    getServiceInterval(service) {
        const intervals = {
            'oilChange': this.main.vehicleConfig.maintenanceIntervals.oilChange,
            'tireRotation': this.main.vehicleConfig.maintenanceIntervals.tireRotation,
            'brakeService': this.main.vehicleConfig.maintenanceIntervals.brakeService,
            'majorService': this.main.vehicleConfig.maintenanceIntervals.majorService
        };
        return intervals[service] || 10000;
    }

    updateMaintenanceDisplay() {
        const maintenanceSchedule = document.getElementById('maintenanceSchedule');
        if (!maintenanceSchedule) return;

        let urgentMaintenance = [];

        this.main.units.forEach(unit => {
            const maintenance = this.maintenanceSchedule.get(unit.name);
            if (maintenance) {
                Object.entries(maintenance).forEach(([service, data]) => {
                    if (data.urgent || data.dueSoon) {
                        urgentMaintenance.push({
                            unit: unit.name,
                            service: service,
                            remaining: data.remaining,
                            status: data.status
                        });
                    }
                });
            }
        });

        if (urgentMaintenance.length === 0) {
            maintenanceSchedule.innerHTML = '<div class="alert alert-success">✅ Tidak ada maintenance mendesak</div>';
            return;
        }

        maintenanceSchedule.innerHTML = urgentMaintenance.map(maint => `
            <div class="alert alert-${maint.status === 'urgent' ? 'danger' : 'warning'}">
                <strong>${maint.unit}</strong> - ${maint.service.replace(/([A-Z])/g, ' $1')}
                <br>
                <small>Tersisa: ${maint.remaining} km</small>
            </div>
        `).join('');
    }

    cleanupUnit(unitName) {
        this.maintenanceSchedule.delete(unitName);
    }

    clearAll() {
        this.maintenanceSchedule.clear();
    }

    cleanup() {
        this.clearAll();
    }
}

// ==== NOTIFICATION SYSTEM ====
class NotificationSystem {
    constructor(mainSystem) {
        this.main = mainSystem;
        this.notifications = new Map();
    }

    initialize() {
        console.log('🔔 Notification System initialized');
        this.setupNotificationPanel();
    }

    // ✅ FIX: Tambahkan method yang hilang
    setupNotificationPanel() {
        console.log('📋 Setting up notification panel...');
        // Pastikan panel notifikasi ada di DOM
        if (!document.getElementById('notificationPanel')) {
            const panel = document.createElement('div');
            panel.id = 'notificationPanel';
            panel.className = 'position-fixed top-0 end-0 p-3';
            panel.style.cssText = 'z-index: 9998; max-width: 400px;';
            document.body.appendChild(panel);
        }
    }

    showZoneNotification(unit, zone, type) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'entry' ? 'info' : 'warning'} notification-item`;
        notification.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>📍 ${type === 'entry' ? 'Masuk' : 'Keluar'} Zona</strong>
                    <div class="small">${unit.name} - ${zone.name}</div>
                    <div class="small text-muted">${unit.driver}</div>
                </div>
                <button type="button" class="btn-close btn-sm" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;

        this.addNotificationToPanel(notification);
    }

    addNotificationToPanel(notification) {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.appendChild(notification);
            
            // Auto-remove after 10 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 10000);
        }
    }

    clearAll() {
        this.notifications.clear();
    }

    cleanup() {
        this.clearAll();
    }
}

// ==== REPORT GENERATOR ====
class ReportGenerator {
    constructor(mainSystem) {
        this.main = mainSystem;
    }

    generateDailyReport() {
        const report = {
            date: new Date().toISOString().split('T')[0],
            summary: {
                totalUnits: this.main.units.size,
                activeUnits: this.main.activeUnits,
                totalDistance: this.main.totalDistance,
                
                averageScore: this.main.avgPerformanceScore,
                totalViolations: this.main.totalViolations
            },
            unitDetails: [],
            recommendations: this.generateRecommendations()
        };

        this.main.units.forEach(unit => {
            report.unitDetails.push({
                name: unit.name,
                driver: unit.driver,
                afdeling: unit.afdeling,
                distance: unit.distance,
                performanceScore: unit.analytics.performanceScore,
                violations: unit.analytics.violations?.length || 0,
                efficiency: unit.analytics.efficiency || 0
            });
        });

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.main.avgPerformanceScore < 70) {
            recommendations.push('Tingkatkan efisiensi operasional unit');
        }
        
        if (this.main.totalViolations > 5) {
            recommendations.push('Perketat monitoring pelanggaran');
        }
        
        

        return recommendations;
    }

    exportDailyReport() {
        const report = this.generateDailyReport();
        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `laporan-harian-${report.date}.json`;
        link.click();
        
        this.main.logData('Laporan harian diexport', 'success');
    }
}

// Initialize the advanced system
let gpsSystem;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded - Starting Advanced GPS Analytics System');
    
    if (window.gpsSystem) {
        console.log('🧹 Cleaning up existing GPS System instance');
        window.gpsSystem.cleanup();
    }
    
    try {
        gpsSystem = new AdvancedSAGMGpsTracking();
        window.gpsSystem = gpsSystem;
        console.log('✅ Advanced GPS Analytics System initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize GPS System:', error);
        const notification = document.createElement('div');
        notification.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            <strong>System Error:</strong> Gagal memulai sistem GPS Analytics. Silakan refresh halaman.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(notification);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (window.gpsSystem) {
        console.log('🧹 Cleaning up GPS System before page unload');
        window.gpsSystem.cleanup();
    }
});

// ✅ ENHANCED GLOBAL FUNCTIONS - IMPROVED ERROR HANDLING
function showUnitAnalytics(unitName) {
    try {
        if (window.gpsSystem && window.gpsSystem.analyticsEngine) {
            window.gpsSystem.analyticsEngine.showUnitAnalytics(unitName);
        } else {
            console.warn('GPS System atau Analytics Engine belum siap');
            // Fallback sederhana
            alert(`Analytics untuk ${unitName}\nSistem sedang memuat...`);
        }
    } catch (error) {
        console.error('Error in showUnitAnalytics:', error);
        alert('Terjadi error saat menampilkan analytics. Silakan coba lagi.');
    }
}

function showZoneManager() {
    try {
        if (window.gpsSystem && window.gpsSystem.geofencingManager) {
            window.gpsSystem.geofencingManager.showZoneManager();
        } else {
            console.warn('GPS System atau Geofencing Manager belum siap');
        }
    } catch (error) {
        console.error('Error in showZoneManager:', error);
    }
}

// Global functions for HTML onclick handlers
function refreshData() {
    if (window.gpsSystem) {
        window.gpsSystem.refreshData();
    }
}

function forceCleanup() {
    if (window.gpsSystem) {
        window.gpsSystem.forceCleanupAllData();
        alert('Force cleanup executed! All sticky data removed.');
    }
}

function exportData() {
    if (window.gpsSystem) {
        window.gpsSystem.downloadRouteData();
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    
    if (sidebar) {
        sidebar.classList.toggle('show');
        body.classList.toggle('sidebar-open');
    }
}

function toggleHeatmap() {
    if (window.gpsSystem && window.gpsSystem.heatmapManager) {
        window.gpsSystem.heatmapManager.toggleHeatmap();
    }
}

function toggleGeofencing() {
    if (window.gpsSystem && window.gpsSystem.geofencingManager) {
        window.gpsSystem.geofencingManager.toggleZones();
    }
}

// Chat functions
function toggleMonitorChat() {
    if (window.gpsSystem) {
        window.gpsSystem.toggleMonitorChat();
    }
}

function handleMonitorChatInput(event) {
    if (window.gpsSystem) {
        window.gpsSystem.handleMonitorChatInput(event);
    }
}

function sendMonitorMessage() {
    if (window.gpsSystem) {
        window.gpsSystem.sendMonitorMessage();
    }
}

function selectChatUnit(unitName) {
    if (window.gpsSystem) {
        window.gpsSystem.selectChatUnit(unitName);
    }
}
// Global chat functions
function toggleChat() {
    if (window.gpsSystem) {
        window.gpsSystem.toggleChat();
    }
}

function sendChatMessage() {
    if (window.gpsSystem) {
        window.gpsSystem.sendChatMessage();
    }
}

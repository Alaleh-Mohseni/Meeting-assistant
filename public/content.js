// content.js - اجرا در صفحه Google Meet
// اضافه کردن کنترل singleton
if (window.meetingRecorderInstance) {
    console.log('Meeting recorder already initialized');
} else {
    console.log('Initializing new meeting recorder');

    class MeetingRecorder {
        constructor() {
            // جلوگیری از اجرای مکرر
            if (window.meetingRecorderInstance) {
                return window.meetingRecorderInstance;
            }

            this.isRecording = false;
            this.mediaRecorder = null;
            this.audioChunks = [];
            this.recognition = null;
            this.speakerNames = []; // حذف افراد پیش‌فرض
            this.currentSpeaker = 0;
            this.recordingInterval = null;
            this.uiInjected = false;
            this.isProcessing = false;
            this.currentTranscript = ''; // برای ذخیره متن جاری
            this.meetingParticipants = new Set();
            this.isMinimized = false; // اضافه کردن state برای minimize

            // ذخیره instance در window
            window.meetingRecorderInstance = this;

            this.init();
        }

        init() {
            console.log('Meeting Assistant initialized on Google Meet');

            // پاک کردن UI‌های قبلی
            this.cleanupPreviousInstances();

            this.setupSpeechRecognition();
            this.tryInjectUI();
            this.detectMeetingParticipants();

            // listener برای تغییرات DOM با محدودیت
            this.setupDOMObserver();
        }

        cleanupPreviousInstances() {
            // حذف UI‌های قبلی
            const existingContainers = document.querySelectorAll('#meeting-assistant-container');
            existingContainers.forEach(container => {
                console.log('Removing existing UI container');
                container.remove();
            });
            this.uiInjected = false;
        }

        setupDOMObserver() {
            // observer با محدودیت برای جلوگیری از اجرای مکرر
            if (this.domObserver) {
                this.domObserver.disconnect();
            }

            this.domObserver = new MutationObserver((mutations) => {
                // فقط اگر UI inject نشده باشد
                if (!this.uiInjected) {
                    // محدود کردن تعداد تلاش‌ها
                    clearTimeout(this.retryTimeout);
                    this.retryTimeout = setTimeout(() => {
                        this.tryInjectUI();
                    }, 1000);
                }

                // تشخیص تغییر شرکت‌کنندگان
                this.detectMeetingParticipants();
            });

            this.domObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // تشخیص شرکت‌کنندگان جلسه
        detectMeetingParticipants() {
            const participantSelectors = [
                '[data-self-name]', // خود کاربر
                '[data-participant-id]', // شرکت‌کنندگان
                '.zWGUib', // نام شرکت‌کنندگان
                '[jsname="xvfV4b"]', // عنصر نام
                '.GvcuGb .zWGUib', // نام در participant grid
                '.PnqAKd .zWGUib', // نام در sidebar
                '.JcaAbe .zWGUib', // نام در لیست
                '[data-participant-name]', // نام‌های شرکت‌کنندگان
                '.uGOf1d', // نام‌های participant در grid
                '[data-initial-value]' // المان‌های نام
            ];

            let foundParticipants = new Set();

            // تشخیص افراد از DOM elements
            participantSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    let name = el.textContent?.trim();

                    // تمیز کردن نام
                    if (name && name !== '' && !name.includes('...') && name.length > 1) {
                        // حذف اطلاعات اضافی
                        name = name.replace(/\(.*?\)/g, '').trim(); // حذف متن داخل پرانتز
                        name = name.split('\n')[0].trim(); // اولین خط

                        if (name && name.length > 1 && name.length < 50) {
                            foundParticipants.add(name);
                        }
                    }
                });
            });

            // تشخیص از URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const authUser = urlParams.get('authuser');
            if (authUser) {
                // ممکن است نام کاربر در URL باشد
            }

            // محدود کردن تعداد شرکت‌کنندگان به تعداد واقعی visible participants
            const visibleParticipants = document.querySelectorAll('[data-participant-id], [data-self-name]');
            const realParticipantCount = Math.max(1, visibleParticipants.length);

            // فیلتر کردن و محدود کردن تعداد
            const participantArray = [...foundParticipants].slice(0, realParticipantCount);

            // به‌روزرسانی لیست شرکت‌کنندگان
            if (participantArray.length > 0) {
                const newParticipants = participantArray.filter(p => !this.meetingParticipants.has(p));

                if (newParticipants.length > 0) {
                    // پاک کردن لیست قبلی و اضافه کردن جدید
                    this.meetingParticipants.clear();
                    this.speakerNames = [];

                    participantArray.forEach(name => {
                        this.meetingParticipants.add(name);
                        this.speakerNames.push(name);
                    });

                    // اگر هیچ شرکت‌کننده‌ای پیدا نشد، یک نام پیش‌فرض اضافه کن
                    if (this.speakerNames.length === 0) {
                        this.speakerNames.push('شرکت‌کننده');
                    }

                    console.log('Participants detected:', this.speakerNames);
                    this.updateSpeakerButtons();
                    this.updateStatus(`شرکت‌کنندگان: ${this.speakerNames.length} نفر`);
                }
            }
        }

        setupSpeechRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = true;
                this.recognition.interimResults = true;
                this.recognition.lang = 'fa-IR';

                let finalTranscriptBuffer = '';
                let interimTranscriptBuffer = '';

                this.recognition.onresult = (event) => {
                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;

                        if (event.results[i].isFinal) {
                            finalTranscript += transcript;
                        } else {
                            interimTranscript += transcript;
                        }
                    }

                    // ترکیب متن نهایی
                    if (finalTranscript) {
                        finalTranscriptBuffer += finalTranscript;

                        // اگر متن کامل شده (حداقل یک جمله)
                        if (finalTranscriptBuffer.length > 10 && !this.isProcessing) {
                            this.handleTranscript(finalTranscriptBuffer.trim());
                            finalTranscriptBuffer = '';
                        }
                    }

                    // نمایش متن موقتی
                    this.updateStatus(
                        interimTranscript ?
                            `در حال تشخیص: "${interimTranscript}..."` :
                            (this.isRecording ? 'در حال ضبط...' : 'آماده'),
                        'info'
                    );
                };

                this.recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);

                    // تلاش مجدد در صورت خطاهای غیر بحرانی
                    if (this.isRecording && !['not-allowed', 'service-not-allowed'].includes(event.error)) {
                        setTimeout(() => {
                            if (this.isRecording && this.recognition) {
                                try {
                                    this.recognition.start();
                                } catch (e) {
                                    console.log('Failed to restart recognition:', e);
                                }
                            }
                        }, 1000);
                    }
                };

                this.recognition.onend = () => {
                    // ذخیره متن باقی‌مانده در buffer
                    if (finalTranscriptBuffer.trim() && !this.isProcessing) {
                        this.handleTranscript(finalTranscriptBuffer.trim());
                        finalTranscriptBuffer = '';
                    }

                    // اگر هنوز در حال ضبط است، دوباره شروع کن
                    if (this.isRecording) {
                        setTimeout(() => {
                            if (this.isRecording && this.recognition) {
                                try {
                                    this.recognition.start();
                                } catch (e) {
                                    console.log('Failed to restart recognition after end:', e);
                                }
                            }
                        }, 100);
                    }
                };
            } else {
                console.warn('Speech Recognition not supported in this browser');
                this.updateStatus('تشخیص گفتار پشتیبانی نمی‌شود');
            }
        }

        tryInjectUI() {
            if (this.uiInjected) {
                return;
            }

            // چک کردن اینکه آیا در صفحه Meet هستیم
            if (!window.location.hostname.includes('meet.google.com')) {
                return;
            }

            // چک کردن اینکه آیا در جلسه هستیم
            const meetingElements = document.querySelector('[data-meeting-title]') ||
                document.querySelector('[data-call-id]') ||
                document.querySelector('[jscontroller*="meeting"]');

            if (!meetingElements) {
                console.log('Not in a meeting yet, waiting...');
                return;
            }

            console.log('Attempting to inject UI...');
            this.injectUI();
        }

        injectUI() {
            if (this.uiInjected) {
                return;
            }

            // پاک کردن UI‌های قبلی
            this.cleanupPreviousInstances();

            const container = this.createUIContainer();
            document.body.appendChild(container);

            this.uiInjected = true;
            console.log('UI injected successfully');

            // به‌روزرسانی تعداد transcript‌ها
            this.updateTranscriptCount();
        }

        createUIContainer() {
            const container = document.createElement('div');
            container.id = 'meeting-assistant-container';

            // اضافه کردن فونت مخصوص فارسی
            const fontLink = document.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);

            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: oklch(21% .034 264.665);
                backdrop-filter: blur(20px);
                border-radius: 20px;
                padding: 24px;
                z-index: 10000;
                max-width: 380px;
                min-width: 320px;
                direction: rtl;
                font-family: 'Vazirmatn', 'Segoe UI', Tahoma, sans-serif;
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                animation: slideIn 0.5s ease-out;
            `;

            // اضافه کردن CSS animations
            if (!document.getElementById('meeting-assistant-styles')) {
                const style = document.createElement('style');
                style.id = 'meeting-assistant-styles';
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                    
                    .recording-pulse {
                        animation: pulse 2s infinite;
                    }
                    
                    .glass-button {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        transition: all 0.3s ease;
                    }
                    
                    .glass-button:hover {
                        background: rgba(255, 255, 255, 0.2);
                        transform: translateY(-2px);
                        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                    }
                `;
                document.head.appendChild(style);
            }

            container.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <h3 style="margin: 0; font-size: 22px; font-weight: 700; background: linear-gradient(45deg, #fff, #e0e7ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                🎙️ دستیار جلسه
                            </h3>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button id="minimize-btn" class="glass-button" style="
                                background: rgba(255, 255, 255, 0.1);
                                border: 1px solid rgba(255, 255, 255, 0.2);
                                border-radius: 12px;
                                font-size: 18px;
                                cursor: pointer;
                                color: white;
                                padding: 8px 12px;
                                width: 40px;
                                height: 40px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">−</button>
                            <button id="close-btn" class="glass-button" style="
                                background: rgba(239, 68, 68, 0.2);
                                border: 1px solid rgba(239, 68, 68, 0.3);
                                border-radius: 12px;
                                font-size: 18px;
                                cursor: pointer;
                                color: #ef4444;
                                padding: 8px 12px;
                                width: 40px;
                                height: 40px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">×</button>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-bottom: 16px;" id="main-controls">
                        <button id="record-btn" class="glass-button" style="
                            flex: 1;
                            padding: 12px 20px;
                            border: none;
                            border-radius: 16px;
                            background: linear-gradient(45deg, #10b981, #059669);
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            font-family: 'Vazirmatn', sans-serif;
                        ">🎤 شروع ضبط</button>
                        
                        <button id="export-btn" class="glass-button" style="
                            padding: 12px 16px;
                            border: none;
                            border-radius: 16px;
                            background: linear-gradient(45deg, #3b82f6, #1d4ed8);
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            font-family: 'Vazirmatn', sans-serif;
                        ">📥 دانلود</button>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;" id="speaker-section">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 14px; font-weight: 500;">👥 شرکت‌کنندگان:</span>
                        <span id="participant-count" style="
                            background: rgba(255, 255, 255, 0.2);
                            padding: 2px 8px;
                            border-radius: 12px;
                            font-size: 12px;
                        ">${Math.max(1, this.speakerNames.length)} نفر</span>
                    </div>
                    
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;" id="speaker-buttons"></div>
                    
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="new-speaker" placeholder="نام شرکت‌کننده جدید" style="
                            flex: 1;
                            padding: 10px 12px;
                            border: 1px solid rgba(255, 255, 255, 0.3);
                            border-radius: 12px;
                            font-size: 13px;
                            font-family: 'Vazirmatn', sans-serif;
                            background: rgba(255, 255, 255, 0.1);
                            backdrop-filter: blur(10px);
                            color: white;
                            outline: none;
                        ">
                        <button id="add-speaker" class="glass-button" style="
                            padding: 10px 16px;
                            border: none;
                            border-radius: 12px;
                            background: linear-gradient(45deg, #f59e0b, #d97706);
                            color: white;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 600;
                            font-family: 'Vazirmatn', sans-serif;
                        ">➕ افزودن</button>
                    </div>
                    
                    <div style="text-align: center; margin-top: 12px;">
                        <span style="font-size: 13px; opacity: 0.9;">
                            گوینده فعال:
                            <span id="current-speaker-name" style="
                                font-weight: 600;
                                background: linear-gradient(45deg, #fbbf24, #f59e0b);
                                -webkit-background-clip: text;
                                -webkit-text-fill-color: transparent;
                                background-clip: text;
                            ">${this.speakerNames.length > 0 ? this.speakerNames[this.currentSpeaker] : 'شرکت‌کننده'}</span>
                        </span>
                    </div>
                </div>
                
                <div style="
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 16px;
                    padding: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                " id="status-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 14px; font-weight: 500;">📊 وضعیت:</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div id="connection-indicator" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
                            <span id="connection-status" style="font-size: 12px;">بررسی اتصال...</span>
                        </div>
                    </div>
                    
                    <div id="status-text" style="
                        font-size: 13px;
                        font-weight: 500;
                        margin-bottom: 12px;
                        padding: 8px 12px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        text-align: center;
                    ">آماده برای ضبط</div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px;">
                        <div style="text-align: center;">
                            <div style="font-size: 20px; font-weight: 700; color: #60a5fa;" id="transcript-count">0</div>
                            <div style="opacity: 0.8;">پیام ضبط شده</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 20px; font-weight: 700; color: #34d399;" id="question-count">0</div>
                            <div style="opacity: 0.8;">سوال شناسایی شده</div>
                        </div>
                    </div>
                </div>
            `;

            this.setupUIEvents(container);
            this.updateSpeakerButtons();
            this.checkConnectionStatus();

            return container;
        }

        setupUIEvents(container) {
            const recordBtn = container.querySelector('#record-btn');
            const exportBtn = container.querySelector('#export-btn');
            const addSpeakerBtn = container.querySelector('#add-speaker');
            const newSpeakerInput = container.querySelector('#new-speaker');
            const minimizeBtn = container.querySelector('#minimize-btn');
            const closeBtn = container.querySelector('#close-btn');

            recordBtn.addEventListener('click', () => this.toggleRecording());
            exportBtn.addEventListener('click', () => this.exportTranscripts());
            addSpeakerBtn.addEventListener('click', () => this.addSpeaker());
            minimizeBtn.addEventListener('click', () => this.toggleMinimize());
            closeBtn.addEventListener('click', () => this.closeAssistant());

            newSpeakerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addSpeaker();
                }
            });

            // اضافه کردن placeholder style
            newSpeakerInput.addEventListener('focus', () => {
                newSpeakerInput.style.background = 'rgba(255, 255, 255, 0.2)';
            });

            newSpeakerInput.addEventListener('blur', () => {
                newSpeakerInput.style.background = 'rgba(255, 255, 255, 0.1)';
            });
        }

        closeAssistant() {
            // توقف ضبط در صورت فعال بودن
            if (this.isRecording) {
                this.stopRecording();
            }

            // حذف UI
            const container = document.getElementById('meeting-assistant-container');
            if (container) {
                container.style.animation = 'slideOut 0.3s ease-in forwards';

                // اضافه کردن انیمیشن خروج
                const style = document.getElementById('meeting-assistant-styles');
                if (style && !style.textContent.includes('slideOut')) {
                    style.textContent += `
                        @keyframes slideOut {
                            from { transform: translateX(0); opacity: 1; }
                            to { transform: translateX(100%); opacity: 0; }
                        }
                    `;
                }

                setTimeout(() => {
                    this.destroy();
                }, 300);
            }
        }

        toggleMinimize() {
            const speakerSection = document.getElementById('speaker-section');
            const statusSection = document.getElementById('status-section'); // اضافه کردن status section
            const minimizeBtn = document.getElementById('minimize-btn');
            const container = document.getElementById('meeting-assistant-container');

            if (this.isMinimized) {
                // باز کردن
                speakerSection.style.display = 'block';
                statusSection.style.display = 'block'; // نمایش status section
                minimizeBtn.textContent = '−';
                container.style.maxHeight = 'none';
                container.style.minWidth = '320px';
                this.isMinimized = false;
            } else {
                // بستن
                speakerSection.style.display = 'none';
                statusSection.style.display = 'none'; // مخفی کردن status section
                minimizeBtn.textContent = '+';
                container.style.maxHeight = 'auto';
                container.style.minWidth = '280px';
                this.isMinimized = true;
            }
        }

        async checkConnectionStatus() {
            try {
                const response = await fetch('http://localhost:5173/api/health');
                const isConnected = response.ok;

                const indicator = document.getElementById('connection-indicator');
                const statusEl = document.getElementById('connection-status');

                if (indicator && statusEl) {
                    if (isConnected) {
                        indicator.style.background = '#10b981';
                        statusEl.textContent = 'متصل به سرور';
                    } else {
                        indicator.style.background = '#f59e0b';
                        statusEl.textContent = 'حالت محلی';
                    }
                }
            } catch (error) {
                const indicator = document.getElementById('connection-indicator');
                const statusEl = document.getElementById('connection-status');

                if (indicator && statusEl) {
                    indicator.style.background = '#ef4444';
                    statusEl.textContent = 'عدم اتصال';
                }
            }
        }

        updateSpeakerButtons() {
            const container = document.getElementById('speaker-buttons');
            const currentSpeakerName = document.getElementById('current-speaker-name');
            const participantCount = document.getElementById('participant-count');

            if (!container) return;

            container.innerHTML = '';

            // اگر شرکت‌کننده‌ای وجود ندارد، یکی اضافه کن
            if (this.speakerNames.length === 0) {
                this.speakerNames.push('شرکت‌کننده');
            }

            this.speakerNames.forEach((name, index) => {
                const btn = document.createElement('button');
                btn.textContent = name;
                btn.className = 'glass-button';
                btn.style.cssText = `
                    padding: 6px 12px;
                    border: none;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                    font-family: 'Vazirmatn', sans-serif;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    ${index === this.currentSpeaker ?
                        'background: linear-gradient(45deg, #8b5cf6, #7c3aed); color: white; box-shadow: 0 6px 12px rgba(139, 92, 246, 0.4);' :
                        'background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); border: 1px solid rgba(255, 255, 255, 0.2);'
                    }
                `;

                btn.addEventListener('click', () => {
                    this.currentSpeaker = index;
                    this.updateSpeakerButtons();
                    console.log(`Current speaker changed to: ${name}`);
                });

                container.appendChild(btn);
            });

            // به‌روزرسانی نام گوینده فعال
            if (currentSpeakerName) {
                currentSpeakerName.textContent = this.speakerNames[this.currentSpeaker] || 'شرکت‌کننده';
            }

            // به‌روزرسانی تعداد شرکت‌کنندگان
            if (participantCount) {
                participantCount.textContent = `${this.speakerNames.length} نفر`;
            }
        }

        addSpeaker() {
            const input = document.getElementById('new-speaker');
            if (!input) return;

            const name = input.value.trim();

            if (name && !this.speakerNames.includes(name)) {
                this.speakerNames.push(name);
                input.value = '';
                this.updateSpeakerButtons();
                this.updateStatus(`شرکت‌کننده جدید افزوده شد: ${name}`, 'success');
                console.log(`Speaker added: ${name}`);
            }
        }

        updateStatus(text, type = 'info') {
            const statusEl = document.getElementById('status-text');
            if (statusEl) {
                statusEl.textContent = text;

                // تغییر رنگ بر اساس نوع
                let bgColor = 'rgba(255, 255, 255, 0.1)';
                if (type === 'error') bgColor = 'rgba(239, 68, 68, 0.2)';
                else if (type === 'success') bgColor = 'rgba(16, 185, 129, 0.2)';
                else if (type === 'recording') bgColor = 'rgba(245, 158, 11, 0.2)';

                statusEl.style.background = bgColor;
            }
            console.log(`Status: ${text}`);
        }

        updateTranscriptCount() {
            if (typeof chrome === 'undefined' || !chrome.storage) return;

            chrome.storage.local.get(['transcripts'], (result) => {
                const transcripts = result.transcripts || [];
                const questions = transcripts.filter(t => t.isQuestion);

                const countEl = document.getElementById('transcript-count');
                const questionEl = document.getElementById('question-count');

                if (countEl) countEl.textContent = transcripts.length;
                if (questionEl) questionEl.textContent = questions.length;
            });
        }

        async toggleRecording() {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                await this.startRecording();
            }
        }

        async startRecording() {
            try {
                this.updateStatus('درخواست مجوز میکروفون...', 'info');

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100  // افزایش کیفیت صدا
                    }
                });

                this.mediaRecorder = new MediaRecorder(stream, {
                    mimeType: 'audio/webm;codecs=opus',
                    audioBitsPerSecond: 128000  // افزایش کیفیت
                });
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                    }
                };

                this.mediaRecorder.onstop = () => {
                    if (this.audioChunks.length > 0) {
                        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                        this.processAudio(audioBlob);
                        this.audioChunks = []; // پاک کردن chunks
                    }
                };

                // ضبط بدون وقفه - حذف interval برای جلوگیری از قطع شدن
                this.mediaRecorder.start();

                // شروع Speech Recognition
                if (this.recognition) {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.log('Recognition already started or failed:', e);
                    }
                }

                this.isRecording = true;
                this.updateRecordButton();
                this.updateStatus('در حال ضبط...', 'recording');

                console.log('Recording started successfully');
            } catch (error) {
                console.error('Error starting recording:', error);
                this.updateStatus('خطا در شروع ضبط', 'error');

                if (error.name === 'NotAllowedError') {
                    alert('برای استفاده از این ابزار، مجوز میکروفون الزامی است.\nلطفاً از تنظیمات مرورگر مجوز را فعال کنید.');
                }
            }
        }

        stopRecording() {
            try {
                if (this.recordingInterval) {
                    clearInterval(this.recordingInterval);
                    this.recordingInterval = null;
                }

                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    this.mediaRecorder.stop();
                }

                if (this.recognition) {
                    try {
                        this.recognition.stop();
                    } catch (e) {
                        console.log('Recognition stop failed:', e);
                    }
                }

                // بستن stream
                if (this.mediaRecorder && this.mediaRecorder.stream) {
                    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }

                this.isRecording = false;
                this.updateRecordButton();
                this.updateStatus('آماده');
                console.log('Recording stopped successfully');
            } catch (error) {
                console.error('Error stopping recording:', error);
                this.updateStatus('خطا در توقف ضبط', 'error');
            }
        }

        updateRecordButton() {
            const btn = document.getElementById('record-btn');
            const container = document.getElementById('meeting-assistant-container');

            if (btn) {
                btn.innerHTML = this.isRecording ? '🛑 توقف ضبط' : '🎤 شروع ضبط';
                btn.style.background = this.isRecording ?
                    'linear-gradient(45deg, #ef4444, #dc2626)' :
                    'linear-gradient(45deg, #10b981, #059669)';
                btn.style.boxShadow = this.isRecording ?
                    '0 8px 16px rgba(239, 68, 68, 0.3)' :
                    '0 8px 16px rgba(16, 185, 129, 0.3)';
            }

            // اضافه کردن انیمیشن pulse هنگام ضبط
            if (container) {
                if (this.isRecording) {
                    container.classList.add('recording-pulse');
                } else {
                    container.classList.remove('recording-pulse');
                }
            }
        }

        handleTranscript(transcript) {
            if (this.isProcessing || !transcript.trim()) return;

            this.isProcessing = true;

            const entry = {
                text: transcript.trim(),
                speaker: this.speakerNames[this.currentSpeaker] || 'شرکت‌کننده',
                timestamp: new Date().toISOString(),
                isQuestion: transcript.includes('؟') ||
                    /\b(چی|چه|کی|کجا|چرا|چطور|آیا)\b/.test(transcript)
            };

            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['transcripts'], (result) => {
                    const transcripts = result.transcripts || [];
                    transcripts.push(entry);

                    chrome.storage.local.set({ transcripts }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Storage error:', chrome.runtime.lastError);
                        } else {
                            console.log('Transcript saved:', transcript.substring(0, 50) + '...');
                            this.updateTranscriptCount();
                            this.updateStatus('متن ذخیره شد ✓', 'success');

                            // بازگشت به وضعیت ضبط بعد از 2 ثانیه
                            setTimeout(() => {
                                if (this.isRecording) {
                                    this.updateStatus('در حال ضبط...', 'recording');
                                }
                            }, 2000);
                        }
                        this.isProcessing = false;
                    });
                });
            } else {
                console.log('Chrome storage not available');
                this.isProcessing = false;
            }
        }

        async processAudio(audioBlob) {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.log('Chrome runtime not available');
                return;
            }

            try {
                this.updateStatus('پردازش صوت توسط AI...', 'info');

                const arrayBuffer = await audioBlob.arrayBuffer();
                const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

                chrome.runtime.sendMessage({
                    action: 'transcribe',
                    audioData: base64Audio,
                    speakerCount: this.speakerNames.length
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Runtime error:', chrome.runtime.lastError);
                        this.updateStatus(this.isRecording ? 'در حال ضبط...' : 'آماده');
                        return;
                    }

                    if (response && response.success) {
                        console.log('Audio processed successfully', response.data);
                        this.handleServerTranscription(response.data);
                        this.updateStatus('متن از AI دریافت شد ✓', 'success');

                        // بازگشت به وضعیت ضبط بعد از 3 ثانیه
                        setTimeout(() => {
                            if (this.isRecording) {
                                this.updateStatus('در حال ضبط...', 'recording');
                            }
                        }, 3000);
                    } else {
                        console.error('Audio processing failed:', response?.error);
                        this.updateStatus('خطا در پردازش AI', 'error');
                    }
                });
            } catch (error) {
                console.error('Error processing audio:', error);
                this.updateStatus('خطا در پردازش', 'error');
            }
        }

        handleServerTranscription(data) {
            if (!data.transcription || data.transcription.length === 0) {
                return;
            }

            if (typeof chrome === 'undefined' || !chrome.storage) {
                console.log('Chrome storage not available for server transcription');
                return;
            }

            chrome.storage.local.get(['transcripts'], (result) => {
                const transcripts = result.transcripts || [];

                data.transcription.forEach((item) => {
                    const speakerIndex = Math.max(0, Math.min(item.speakerTag - 1, this.speakerNames.length - 1));
                    const entry = {
                        text: item.transcript.trim(),
                        speaker: this.speakerNames[speakerIndex] || 'شرکت‌کننده',
                        timestamp: new Date().toISOString(),
                        confidence: data.confidence,
                        isQuestion: item.transcript.includes('؟') ||
                            /\b(چی|چه|کی|کجا|چرا|چطور|آیا)\b/.test(item.transcript)
                    };
                    transcripts.push(entry);
                });

                chrome.storage.local.set({ transcripts }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Server transcription storage error:', chrome.runtime.lastError);
                    } else {
                        console.log('Server transcriptions saved');
                        this.updateTranscriptCount();
                    }
                });
            });
        }

        exportTranscripts() {
            if (typeof chrome === 'undefined' || !chrome.storage) {
                alert('قابلیت دسترسی به ذخیره‌سازی وجود ندارد');
                return;
            }

            chrome.storage.local.get(['transcripts'], (result) => {
                const transcripts = result.transcripts || [];

                if (transcripts.length === 0) {
                    alert('هیچ متنی برای دانلود وجود ندارد');
                    return;
                }

                const content = `متن جلسه Google Meet
============================
تاریخ: ${new Date().toLocaleDateString('fa-IR')}
زمان: ${new Date().toLocaleTimeString('fa-IR')}
تعداد پیام‌ها: ${transcripts.length}
شرکت‌کنندگان: ${this.speakerNames.join(', ')}

============================

${transcripts.map((t, i) => {
                    const time = new Date(t.timestamp).toLocaleTimeString('fa-IR');
                    const confidence = t.confidence ? ` (اعتماد: ${Math.round(t.confidence * 100)}%)` : '';
                    const question = t.isQuestion ? ' 💭' : '';

                    return `${i + 1}. [${time}] ${t.speaker}${confidence}${question}
   ${t.text}
`;
                }).join('\n')}

============================
تولید شده توسط دستیار جلسات
${new Date().toLocaleString('fa-IR')}`;

                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `google-meet-${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);

                this.updateStatus('فایل دانلود شد ✓', 'success');
                console.log('Transcripts exported successfully');
            });
        }

        // cleanup method
        destroy() {
            this.stopRecording();

            if (this.domObserver) {
                this.domObserver.disconnect();
            }

            if (this.retryTimeout) {
                clearTimeout(this.retryTimeout);
            }

            const container = document.getElementById('meeting-assistant-container');
            if (container) {
                container.remove();
            }

            // پاک کردن styles
            const styles = document.getElementById('meeting-assistant-styles');
            if (styles) {
                styles.remove();
            }

            this.uiInjected = false;
            delete window.meetingRecorderInstance;
        }
    }

    // تابع اصلی initialization
    function initRecorder() {
        // چک کردن محیط
        if (!window.location.hostname.includes('meet.google.com')) {
            console.log('Not on Google Meet, skipping initialization');
            return;
        }

        // چک کردن وجود Chrome APIs
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.storage) {
            console.error('Chrome extension APIs not available');
            return;
        }

        console.log('Attempting to initialize Meeting Recorder...');

        try {
            new MeetingRecorder();
        } catch (error) {
            console.error('Failed to initialize Meeting Recorder:', error);
        }
    }

    // اجرای اولیه فقط یک بار
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initRecorder, 3000);
        });
    } else {
        setTimeout(initRecorder, 2000);
    }

    // cleanup در صورت تغییر صفحه
    window.addEventListener('beforeunload', () => {
        if (window.meetingRecorderInstance) {
            window.meetingRecorderInstance.destroy();
        }
    });
}
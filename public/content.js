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
            this.speakerNames = ['شخص ۱', 'شخص ۲'];
            this.currentSpeaker = 0;
            this.recordingInterval = null;
            this.uiInjected = false;
            this.isProcessing = false;

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
            });

            this.domObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        setupSpeechRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = true;
                this.recognition.interimResults = true;
                this.recognition.lang = 'fa-IR';

                this.recognition.onresult = (event) => {
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }

                    if (finalTranscript && !this.isProcessing) {
                        this.handleTranscript(finalTranscript);
                    }
                };

                this.recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    // تلاش مجدد در صورت خطا
                    if (this.isRecording && event.error !== 'not-allowed') {
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
                    console.log('Speech recognition ended');
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

            // جستجوی سلکتورهای مختلف برای toolbar
            const selectors = [
                '[role="toolbar"]',
                '[data-call-controls-bar]',
                '.VfPpkd-LgbsSe.VfPpkd-LgbsSe-OWXEXe-k8QpJ',
                '[data-floating-menu-container]',
                '.FWdGkb',
                '[jscontroller="soHxf"]',
                '[jscontroller="UxhHr"]'
            ];

            let injected = false;
            for (const selector of selectors) {
                const toolbar = document.querySelector(selector);
                if (toolbar && !injected) {
                    console.log(`Found toolbar with selector: ${selector}`);
                    this.injectUI();
                    injected = true;
                    break;
                }
            }

            if (!injected) {
                console.log('No suitable toolbar found, injecting to body');
                this.injectUI();
            }
        }

        injectUI(targetElement = null) {
            if (this.uiInjected) {
                return;
            }

            // پاک کردن UI‌های قبلی
            this.cleanupPreviousInstances();

            const container = this.createUIContainer();

            // انتخاب مکان مناسب برای قرار دادن UI
            if (targetElement && targetElement.appendChild) {
                targetElement.appendChild(container);
            } else {
                // قرار دادن در body با position fixed
                document.body.appendChild(container);
            }

            this.uiInjected = true;
            console.log('UI injected successfully');

            // به‌روزرسانی تعداد transcript‌ها
            this.updateTranscriptCount();
        }

        createUIContainer() {
            const container = document.createElement('div');
            container.id = 'meeting-assistant-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                padding: 16px;
                z-index: 10000;
                max-width: 320px;
                min-width: 300px;
                direction: rtl;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                border: 1px solid #e0e0e0;
            `;

            container.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h3 style="margin: 0; font-size: 16px; color: #333;">دستیار جلسه</h3>
                        <button id="minimize-btn" style="
                            background: none;
                            border: none;
                            font-size: 16px;
                            cursor: pointer;
                            color: #666;
                            padding: 0;
                            width: 20px;
                            height: 20px;
                        ">−</button>
                    </div>
                    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                        <button id="record-btn" style="
                            flex: 1;
                            padding: 8px 16px;
                            border: none;
                            border-radius: 8px;
                            background: #4CAF50;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                            transition: background 0.2s;
                        ">شروع ضبط</button>
                        <button id="export-btn" style="
                            padding: 8px 12px;
                            border: none;
                            border-radius: 8px;
                            background: #2196F3;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                        ">دانلود</button>
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;" id="speaker-section">
                    <label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px;">گوینده فعال:</label>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px;" id="speaker-buttons"></div>
                    <div style="display: flex; gap: 4px;">
                        <input type="text" id="new-speaker" placeholder="نام جدید" style="
                            flex: 1;
                            padding: 6px 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 12px;
                        ">
                        <button id="add-speaker" style="
                            padding: 6px 12px;
                            border: none;
                            border-radius: 4px;
                            background: #FF9800;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                        ">افزودن</button>
                    </div>
                </div>
                
                <div>
                    <label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px;">
                        وضعیت: <span id="status" style="font-weight: bold;">آماده</span>
                    </label>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #888;">
                        <span>تعداد متن: <span id="transcript-count">0</span></span>
                        <span id="connection-status">بررسی اتصال...</span>
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

            recordBtn.addEventListener('click', () => this.toggleRecording());
            exportBtn.addEventListener('click', () => this.exportTranscripts());
            addSpeakerBtn.addEventListener('click', () => this.addSpeaker());
            minimizeBtn.addEventListener('click', () => this.toggleMinimize());

            newSpeakerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addSpeaker();
                }
            });
        }

        toggleMinimize() {
            const speakerSection = document.getElementById('speaker-section');
            const minimizeBtn = document.getElementById('minimize-btn');

            if (speakerSection.style.display === 'none') {
                speakerSection.style.display = 'block';
                minimizeBtn.textContent = '−';
            } else {
                speakerSection.style.display = 'none';
                minimizeBtn.textContent = '+';
            }
        }

        async checkConnectionStatus() {
            try {
                const response = await fetch('http://localhost:5173/api/health');
                const isConnected = response.ok;
                const statusEl = document.getElementById('connection-status');
                if (statusEl) {
                    statusEl.textContent = isConnected ? 'متصل به سرور' : 'حالت محلی';
                    statusEl.style.color = isConnected ? '#4CAF50' : '#FF9800';
                }
            } catch (error) {
                const statusEl = document.getElementById('connection-status');
                if (statusEl) {
                    statusEl.textContent = 'حالت محلی';
                    statusEl.style.color = '#FF9800';
                }
            }
        }

        updateSpeakerButtons() {
            const container = document.getElementById('speaker-buttons');
            if (!container) return;

            container.innerHTML = '';

            this.speakerNames.forEach((name, index) => {
                const btn = document.createElement('button');
                btn.textContent = name;
                btn.style.cssText = `
                    padding: 4px 8px;
                    border: none;
                    border-radius: 4px;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s;
                    ${index === this.currentSpeaker ?
                        'background: #673AB7; color: white;' :
                        'background: #f0f0f0; color: #333;'
                    }
                `;

                btn.addEventListener('click', () => {
                    this.currentSpeaker = index;
                    this.updateSpeakerButtons();
                    console.log(`Current speaker changed to: ${name}`);
                });

                container.appendChild(btn);
            });
        }

        addSpeaker() {
            const input = document.getElementById('new-speaker');
            if (!input) return;

            const name = input.value.trim();

            if (name && !this.speakerNames.includes(name)) {
                this.speakerNames.push(name);
                input.value = '';
                this.updateSpeakerButtons();
                console.log(`Speaker added: ${name}`);
            }
        }

        updateStatus(text, type = 'info') {
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = text;
                statusEl.style.color = type === 'error' ? '#f44336' :
                    type === 'success' ? '#4CAF50' : '#333';
            }
            console.log(`Status: ${text}`);
        }

        updateTranscriptCount() {
            if (typeof chrome === 'undefined' || !chrome.storage) return;

            chrome.storage.local.get(['transcripts'], (result) => {
                const count = result.transcripts ? result.transcripts.length : 0;
                const countEl = document.getElementById('transcript-count');
                if (countEl) {
                    countEl.textContent = count;
                }
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
                this.updateStatus('درخواست مجوز میکروفون...');

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 16000  // کاهش sample rate برای بهبود عملکرد
                    }
                });

                this.mediaRecorder = new MediaRecorder(stream, {
                    mimeType: 'audio/webm;codecs=opus'
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
                    }
                };

                // ضبط هر 15 ثانیه برای بهبود عملکرد
                this.mediaRecorder.start();
                this.recordingInterval = setInterval(() => {
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        this.mediaRecorder.stop();
                        this.mediaRecorder.start();
                    }
                }, 15000);

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
                this.updateStatus('در حال ضبط...', 'success');

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
            if (btn) {
                btn.textContent = this.isRecording ? 'توقف ضبط' : 'شروع ضبط';
                btn.style.background = this.isRecording ? '#f44336' : '#4CAF50';
            }
        }

        handleTranscript(transcript) {
            if (this.isProcessing) return;

            this.isProcessing = true;

            const entry = {
                text: transcript.trim(),
                speaker: this.speakerNames[this.currentSpeaker],
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
                            console.log('Transcript saved:', transcript);
                            this.updateTranscriptCount();
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
                this.updateStatus('پردازش صوت...');

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
                    } else {
                        console.error('Audio processing failed:', response?.error);
                    }
                    this.updateStatus(this.isRecording ? 'در حال ضبط...' : 'آماده');
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
                        speaker: this.speakerNames[speakerIndex],
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
تاریخ: ${new Date().toLocaleDateString('fa-IR')}
زمان: ${new Date().toLocaleTimeString('fa-IR')}
تعداد پیام‌ها: ${transcripts.length}
شرکت‌کنندگان: ${this.speakerNames.join(', ')}

${'='.repeat(50)}

${transcripts.map((t, i) =>
                    `${i + 1}. ${t.speaker} - ${new Date(t.timestamp).toLocaleTimeString('fa-IR')}
   ${t.text}
   ${t.isQuestion ? '   💭 (سوال)' : ''}
   ${t.confidence ? `   اعتماد: ${Math.round(t.confidence * 100)}%` : ''}
`).join('\n')}

${'='.repeat(50)}
تولید شده توسط دستیار جلسات - ${new Date().toLocaleString('fa-IR')}`;

                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `google-meet-${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);

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
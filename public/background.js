// background.js - Service Worker
chrome.runtime.onInstalled.addListener(() => {
    console.log('Meeting Assistant Extension installed');
});

// Communication with content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received in background:', request);

    if (request.action === 'transcribe') {
        // Audio processing and sending to server
        handleTranscription(request.audioData, request.speakerCount || 2)
            .then(result => {
                console.log('Transcription result:', result);
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                console.error('Transcription error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.action === 'checkConnection') {
        checkServerConnection()
            .then(isConnected => sendResponse({ connected: isConnected }))
            .catch(() => sendResponse({ connected: false }));
        return true;
    }

    if (request.action === 'generateSummary') {
        generateSummary(request.transcripts, request.speakerNames)
            .then(summary => sendResponse({ success: true, summary }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

// Function to convert base64 to blob
function base64ToBlob(base64, mime = 'audio/webm') {
    try {
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mime });
    } catch (error) {
        console.error('Error converting base64 to blob:', error);
        throw error;
    }
}

// Function for transcription processing
async function handleTranscription(audioBase64, speakerCount = 2) {
    try {
        console.log('Processing audio transcription...');

        const audioBlob = base64ToBlob(audioBase64, 'audio/webm');
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('speakerCount', speakerCount.toString());

        const response = await fetch('http://localhost:5173/api/transcribe', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log('Transcription successful:', result);
        return result;
    } catch (error) {
        console.error('Transcription error:', error);
        throw error;
    }
}

// Function to check server connection
async function checkServerConnection() {
    try {
        const response = await fetch('http://localhost:5173/api/health', {
            method: 'GET',
            timeout: 5000
        });
        return response.ok;
    } catch (error) {
        console.log('Server connection failed:', error);
        return false;
    }
}

// Function to generate summary
async function generateSummary(transcripts, speakerNames = []) {
    try {
        console.log('Generating summary...');

        const response = await fetch('http://localhost:5173/api/generate-summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transcript: transcripts,
                speakerNames: speakerNames.length > 0 ? speakerNames : ['شرکت‌کننده']
            }),
        });

        if (!response.ok) {
            throw new Error(`Summary generation failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('Summary generated successfully');
        return result.summary;
    } catch (error) {
        console.error('Summary generation error:', error);
        throw error;
    }
}

// Local storage management
chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('Storage changed:', changes, 'in', namespace);
});

// Health check endpoint for connection verification
chrome.runtime.onConnect.addListener((port) => {
    console.log('Port connected:', port.name);

    port.onMessage.addListener(async (msg) => {
        if (msg.type === 'healthCheck') {
            const isConnected = await checkServerConnection();
            port.postMessage({ type: 'healthCheckResponse', connected: isConnected });
        }
    });
});

// Alarm to clear old transcripts (optional)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanOldTranscripts') {
        chrome.storage.local.get(['transcripts'], (result) => {
            if (result.transcripts) {
                const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                const filteredTranscripts = result.transcripts.filter(t =>
                    new Date(t.timestamp).getTime() > oneWeekAgo
                );

                chrome.storage.local.set({ transcripts: filteredTranscripts }, () => {
                    console.log('Old transcripts cleaned');
                });
            }
        });
    }
});

// Set alarm for weekly cleanup
chrome.alarms.create('cleanOldTranscripts', {
    delayInMinutes: 60 * 24, // every 24 hours
    periodInMinutes: 60 * 24 * 7 // every week
});
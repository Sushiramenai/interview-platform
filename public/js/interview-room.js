// Interview Room WebRTC Implementation
class InterviewRoom {
    constructor() {
        this.localStream = null;
        this.socket = null;
        this.sessionId = this.getSessionId();
        this.currentQuestionIndex = 0;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recognition = null;
        this.aiSpeaking = false;
        
        this.init();
    }
    
    getSessionId() {
        const path = window.location.pathname;
        const parts = path.split('/');
        return parts[parts.length - 1];
    }
    
    async init() {
        try {
            // Initialize media devices
            await this.setupMedia();
            
            // Initialize WebSocket connection
            this.setupSocket();
            
            // Initialize speech recognition
            this.setupSpeechRecognition();
            
            // Setup UI event handlers
            this.setupEventHandlers();
            
            // Hide loading screen
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
                document.getElementById('interviewContainer').style.display = 'grid';
                this.updateStatus('Ready to begin');
            }, 2000);
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize interview room');
        }
    }
    
    async setupMedia() {
        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Display local video
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;
            
            // Setup audio visualizer for AI
            this.setupAudioVisualizer();
            
        } catch (error) {
            console.error('Media setup error:', error);
            this.showError('Camera/microphone access denied');
        }
    }
    
    setupSocket() {
        // Connect to server
        this.socket = io();
        
        // Join interview session
        this.socket.emit('join-interview', {
            sessionId: this.sessionId,
            role: 'candidate'
        });
        
        // Socket event handlers
        this.socket.on('interview-started', (data) => {
            console.log('Interview started:', data);
            this.updateStatus('Interview in progress');
            this.startRecording();
            
            // Set interview details
            document.getElementById('roleTitle').textContent = data.role;
            document.getElementById('totalQuestions').textContent = data.totalQuestions;
            
            // AI introduces itself
            this.handleAIMessage({
                type: 'greeting',
                text: data.greeting,
                audioUrl: data.greetingAudio
            });
        });
        
        this.socket.on('ai-question', (data) => {
            console.log('AI question:', data);
            this.currentQuestionIndex = data.questionIndex;
            document.getElementById('currentQuestion').textContent = data.questionIndex + 1;
            
            this.handleAIMessage({
                type: 'question',
                text: data.text,
                audioUrl: data.audioUrl
            });
        });
        
        this.socket.on('ai-response', (data) => {
            console.log('AI response:', data);
            this.handleAIMessage({
                type: 'response',
                text: data.text,
                audioUrl: data.audioUrl
            });
        });
        
        this.socket.on('interview-ended', (data) => {
            console.log('Interview ended:', data);
            this.updateStatus('Interview completed');
            this.stopRecording();
            this.showCompletionScreen(data);
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showError(error.message);
        });
    }
    
    setupSpeechRecognition() {
        // Check if browser supports speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported');
            return;
        }
        
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        let finalTranscript = '';
        let silenceTimer = null;
        
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Clear existing silence timer
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            
            // Set new silence timer (2 seconds of silence = end of response)
            silenceTimer = setTimeout(() => {
                if (finalTranscript.trim() && !this.aiSpeaking) {
                    this.handleCandidateResponse(finalTranscript.trim());
                    finalTranscript = '';
                }
            }, 2000);
            
            // Update live transcript display
            if (interimTranscript) {
                this.updateLiveTranscript(interimTranscript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
        };
        
        // Start recognition
        this.recognition.start();
    }
    
    setupEventHandlers() {
        // Microphone toggle
        document.getElementById('micBtn').addEventListener('click', () => {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const btn = document.getElementById('micBtn');
                btn.classList.toggle('muted', !audioTrack.enabled);
                btn.querySelector('span').textContent = audioTrack.enabled ? '🎤' : '🔇';
            }
        });
        
        // Video toggle
        document.getElementById('videoBtn').addEventListener('click', () => {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const btn = document.getElementById('videoBtn');
                btn.classList.toggle('off', !videoTrack.enabled);
                btn.querySelector('span').textContent = videoTrack.enabled ? '📹' : '🚫';
            }
        });
        
        // End interview
        document.getElementById('endBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to end the interview?')) {
                this.endInterview();
            }
        });
    }
    
    setupAudioVisualizer() {
        const visualizer = document.getElementById('audioVisualizer');
        
        // Create audio bars
        for (let i = 0; i < 20; i++) {
            const bar = document.createElement('div');
            bar.className = 'audio-bar';
            bar.style.height = '5px';
            visualizer.appendChild(bar);
        }
    }
    
    animateAudioVisualizer(speaking) {
        const visualizer = document.getElementById('audioVisualizer');
        const bars = visualizer.querySelectorAll('.audio-bar');
        
        if (speaking) {
            visualizer.style.display = 'flex';
            // Animate bars
            bars.forEach((bar, i) => {
                const animate = () => {
                    if (!this.aiSpeaking) return;
                    const height = Math.random() * 40 + 5;
                    bar.style.height = `${height}px`;
                    setTimeout(() => animate(), 100 + Math.random() * 100);
                };
                setTimeout(() => animate(), i * 50);
            });
        } else {
            // Reset bars
            bars.forEach(bar => {
                bar.style.height = '5px';
            });
            setTimeout(() => {
                visualizer.style.display = 'none';
            }, 300);
        }
    }
    
    async handleAIMessage(data) {
        // Add message to transcript
        this.addMessage('ai', data.text);
        
        // Update AI avatar state
        const avatar = document.getElementById('aiAvatar');
        avatar.classList.add('speaking');
        this.aiSpeaking = true;
        
        // Animate audio visualizer
        this.animateAudioVisualizer(true);
        
        // Pause speech recognition while AI is speaking
        if (this.recognition) {
            this.recognition.stop();
        }
        
        // Play AI audio
        if (data.audioUrl) {
            try {
                const audio = new Audio(data.audioUrl);
                audio.addEventListener('ended', () => {
                    avatar.classList.remove('speaking');
                    this.aiSpeaking = false;
                    this.animateAudioVisualizer(false);
                    
                    // Resume speech recognition
                    if (this.recognition) {
                        setTimeout(() => {
                            this.recognition.start();
                        }, 500);
                    }
                });
                
                await audio.play();
            } catch (error) {
                console.error('Error playing AI audio:', error);
                // Fallback: just wait 3 seconds
                setTimeout(() => {
                    avatar.classList.remove('speaking');
                    this.aiSpeaking = false;
                    this.animateAudioVisualizer(false);
                    if (this.recognition) {
                        this.recognition.start();
                    }
                }, 3000);
            }
        }
    }
    
    handleCandidateResponse(text) {
        console.log('Candidate said:', text);
        
        // Add to transcript
        this.addMessage('candidate', text);
        
        // Send to server for AI processing
        this.socket.emit('candidate-response', {
            sessionId: this.sessionId,
            text: text,
            questionIndex: this.currentQuestionIndex
        });
        
        // Update status
        this.updateStatus('AI is thinking...');
    }
    
    addMessage(type, text) {
        const transcript = document.getElementById('transcript');
        const message = document.createElement('div');
        message.className = `message ${type}`;
        
        const time = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        message.innerHTML = `
            <div class="message-header">
                <span>${type === 'ai' ? '🤖 AI Interviewer' : '👤 You'}</span>
                <span>${time}</span>
            </div>
            <div class="message-content">${text}</div>
        `;
        
        transcript.appendChild(message);
        transcript.scrollTop = transcript.scrollHeight;
    }
    
    updateLiveTranscript(text) {
        // Could show interim results in UI if desired
        console.log('Interim:', text);
    }
    
    updateStatus(text) {
        document.getElementById('statusText').textContent = text;
    }
    
    startRecording() {
        if (!this.localStream) return;
        
        const options = {
            mimeType: 'video/webm;codecs=vp8,opus'
        };
        
        try {
            this.mediaRecorder = new MediaRecorder(this.localStream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            console.log('Recording started');
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Process recording
            setTimeout(() => {
                const blob = new Blob(this.recordedChunks, {
                    type: 'video/webm'
                });
                
                // Could upload to server or offer download
                console.log('Recording size:', blob.size);
            }, 100);
        }
    }
    
    endInterview() {
        this.socket.emit('end-interview', {
            sessionId: this.sessionId
        });
    }
    
    showCompletionScreen(data) {
        document.getElementById('interviewContainer').innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a;">
                <div style="text-align: center; max-width: 600px; padding: 40px;">
                    <h1 style="font-size: 48px; margin-bottom: 20px;">🎉</h1>
                    <h2 style="margin-bottom: 20px;">Interview Completed!</h2>
                    <p style="opacity: 0.8; margin-bottom: 30px;">
                        Thank you for completing the interview. 
                        We'll review your responses and get back to you soon.
                    </p>
                    <div style="background: #2a2a2a; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
                        <p>Duration: ${data.duration}</p>
                        <p>Questions Answered: ${data.questionsAnswered}</p>
                    </div>
                    <button onclick="window.close()" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 6px;
                        font-size: 16px;
                        cursor: pointer;
                    ">Close Window</button>
                </div>
            </div>
        `;
    }
    
    showError(message) {
        // Could show error in UI
        alert('Error: ' + message);
    }
}

// Initialize interview room when page loads
document.addEventListener('DOMContentLoaded', () => {
    new InterviewRoom();
});
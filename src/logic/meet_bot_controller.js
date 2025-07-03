const EventEmitter = require('events');
const RecallService = require('../utils/recall_service');
const ElevenLabsService = require('../utils/elevenlabs_service');
const InterviewAI = require('./interview_ai');

class MeetBotController extends EventEmitter {
  constructor() {
    super();
    this.recallService = new RecallService();
    this.elevenLabsService = new ElevenLabsService();
    this.interviewAI = new InterviewAI();
    this.activeBots = new Map();
    
    // Listen to Recall.ai events
    this.recallService.on('botJoined', this.handleBotJoined.bind(this));
    this.recallService.on('botLeft', this.handleBotLeft.bind(this));
    this.recallService.on('transcription', this.handleTranscription.bind(this));
    this.recallService.on('recordingReady', this.handleRecordingReady.bind(this));
  }

  async createInterviewBot(session) {
    try {
      // Create bot with custom settings
      const bot = await this.recallService.createBot({
        meetingUrl: session.meetUrl,
        botName: 'Claude - AI Interviewer',
        transcription: {
          provider: 'assembly_ai',
          assembly_ai: {
            final_model: 'best',
            speaker_labels: true,
            language_detection: true,
            punctuate: true,
            format_text: true
          }
        },
        recording: {
          mode: 'speaker_view',
          video_settings: {
            resolution: '1080p',
            frame_rate: 30
          }
        }
      });
      
      // Store bot info
      this.activeBots.set(bot.id, {
        bot,
        session,
        state: 'waiting_to_join',
        currentQuestionIndex: -1,
        silenceTimer: null,
        responseBuffer: '',
        lastSpeaker: null
      });
      
      return bot;
    } catch (error) {
      console.error('Error creating interview bot:', error);
      throw error;
    }
  }

  async handleBotJoined({ botId, data }) {
    console.log(`Bot ${botId} joined the call`);
    const botInfo = this.activeBots.get(botId);
    if (!botInfo) return;
    
    botInfo.state = 'in_call';
    
    // Wait a moment for everyone to settle
    setTimeout(() => {
      this.startInterview(botId);
    }, 3000);
  }

  async startInterview(botId) {
    const botInfo = this.activeBots.get(botId);
    if (!botInfo) return;
    
    botInfo.state = 'interviewing';
    
    // Play opening greeting
    await this.askQuestion(botId, 0);
  }

  async askQuestion(botId, questionIndex) {
    const botInfo = this.activeBots.get(botId);
    if (!botInfo) return;
    
    const { session } = botInfo;
    
    if (questionIndex >= session.questions.length) {
      // Interview complete
      await this.endInterview(botId);
      return;
    }
    
    const question = session.questions[questionIndex];
    botInfo.currentQuestionIndex = questionIndex;
    botInfo.responseBuffer = '';
    
    try {
      // Generate speech for the question
      const audioUrl = await this.elevenLabsService.generateSpeech(question.text, {
        voice: 'rachel',
        model: 'eleven_monolingual_v1'
      });
      
      // Play the audio in the Meet call
      await this.recallService.playAudio(botId, audioUrl);
      
      // If we expect a response, start listening for it
      if (question.waitForResponse) {
        botInfo.state = 'waiting_for_response';
        this.startSilenceDetection(botId);
      } else {
        // Move to next question after a short delay
        setTimeout(() => {
          this.askQuestion(botId, questionIndex + 1);
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error asking question:', error);
      // Try to continue with next question
      setTimeout(() => {
        this.askQuestion(botId, questionIndex + 1);
      }, 5000);
    }
  }

  startSilenceDetection(botId) {
    const botInfo = this.activeBots.get(botId);
    if (!botInfo) return;
    
    // Clear any existing timer
    if (botInfo.silenceTimer) {
      clearTimeout(botInfo.silenceTimer);
    }
    
    // Set a timer to detect end of response
    botInfo.silenceTimer = setTimeout(() => {
      this.handleEndOfResponse(botId);
    }, 5000); // 5 seconds of silence = end of response
  }

  async handleTranscription({ botId, transcript }) {
    const botInfo = this.activeBots.get(botId);
    if (!botInfo || botInfo.state !== 'waiting_for_response') return;
    
    // Process new transcript segments
    if (transcript.segments && transcript.segments.length > 0) {
      const latestSegment = transcript.segments[transcript.segments.length - 1];
      
      // Check if it's the candidate speaking (not the bot)
      if (latestSegment.speaker !== 'AI Interviewer') {
        botInfo.responseBuffer += latestSegment.text + ' ';
        botInfo.lastSpeaker = latestSegment.speaker;
        
        // Reset silence timer
        this.startSilenceDetection(botId);
      }
    }
  }

  async handleEndOfResponse(botId) {
    const botInfo = this.activeBots.get(botId);
    if (!botInfo) return;
    
    const { session } = botInfo;
    const currentQuestion = session.questions[botInfo.currentQuestionIndex];
    
    // Save the response
    if (botInfo.responseBuffer.trim()) {
      session.responses.push({
        question: currentQuestion.text,
        response: botInfo.responseBuffer.trim(),
        timestamp: new Date().toISOString()
      });
    }
    
    // Add a natural pause
    await this.playTransitionPhrase(botId);
    
    // Move to next question
    setTimeout(() => {
      this.askQuestion(botId, botInfo.currentQuestionIndex + 1);
    }, 2000);
  }

  async playTransitionPhrase(botId) {
    const phrases = [
      "Thank you for that response.",
      "I appreciate your answer.",
      "That's helpful to know.",
      "Thanks for sharing that.",
      "Interesting perspective."
    ];
    
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    
    try {
      const audioUrl = await this.elevenLabsService.generateSpeech(phrase, {
        voice: 'rachel',
        model: 'eleven_monolingual_v1'
      });
      
      await this.recallService.playAudio(botId, audioUrl);
    } catch (error) {
      console.error('Error playing transition phrase:', error);
    }
  }

  async endInterview(botId) {
    const botInfo = this.activeBots.get(botId);
    if (!botInfo) return;
    
    botInfo.state = 'ending';
    
    // Play closing message
    const closingMessage = "Thank you so much for your time today. We'll review your interview and get back to you soon. Have a great day!";
    
    try {
      const audioUrl = await this.elevenLabsService.generateSpeech(closingMessage, {
        voice: 'rachel',
        model: 'eleven_monolingual_v1'
      });
      
      await this.recallService.playAudio(botId, audioUrl);
      
      // Leave the call after the message
      setTimeout(() => {
        this.recallService.leaveCall(botId);
      }, 10000);
      
    } catch (error) {
      console.error('Error ending interview:', error);
      // Leave anyway
      this.recallService.leaveCall(botId);
    }
  }

  async handleBotLeft({ botId, data }) {
    console.log(`Bot ${botId} left the call`);
    const botInfo = this.activeBots.get(botId);
    if (!botInfo) return;
    
    // Clean up
    if (botInfo.silenceTimer) {
      clearTimeout(botInfo.silenceTimer);
    }
    
    this.activeBots.delete(botId);
    
    // Emit event for interview completion
    this.emit('interviewCompleted', {
      session: botInfo.session,
      botId
    });
  }

  async handleRecordingReady({ botId, recordingUrl }) {
    console.log(`Recording ready for bot ${botId}: ${recordingUrl}`);
    
    // Emit event for recording availability
    this.emit('recordingReady', {
      botId,
      recordingUrl
    });
  }

  // Handle follow-up questions based on responses
  async generateFollowUp(botId, response) {
    const botInfo = this.activeBots.get(botId);
    if (!botInfo) return null;
    
    // Use Claude to generate a contextual follow-up if needed
    const followUp = await this.interviewAI.generateFollowUpQuestion(
      botInfo.session.questions[botInfo.currentQuestionIndex].text,
      response,
      botInfo.session.role
    );
    
    return followUp;
  }
}

module.exports = MeetBotController;
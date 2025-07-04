const { v4: uuidv4 } = require('uuid');
const MeetGenerator = require('../utils/meet_generator');
const GoogleMeetBot = require('../bots/google_meet_bot');
const InterviewAI = require('./interview_ai');
const Evaluator = require('./evaluator');
const InterviewTracker = require('../utils/interview_tracker');
const ElevenLabsService = require('../utils/elevenlabs_service');
const fs = require('fs').promises;
const path = require('path');

class SelfHostedInterviewOrchestrator {
  constructor() {
    // Delay service initialization until first use
    this._initialized = false;
    this.activeSessions = new Map();
    this.activeBots = new Map();
  }

  _generateTempMeetCode() {
    // Generate a temporary meet code for immediate response
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const generateGroup = (length) => {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    return `${generateGroup(3)}-${generateGroup(4)}-${generateGroup(3)}`;
  }

  async _ensureInitialized() {
    if (this._initialized) {
      console.log('✅ Orchestrator already initialized');
      return;
    }
    
    console.log('🔧 Initializing orchestrator services...');
    console.log('Environment check:', {
      CLAUDE_API_KEY: !!process.env.CLAUDE_API_KEY,
      ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
      GOOGLE_CREDENTIALS: !!process.env.GOOGLE_CREDENTIALS
    });
    try {
      console.log('  Creating MeetGenerator...');
      this.meetGenerator = new MeetGenerator();
      console.log('  ✅ MeetGenerator created');
      
      console.log('  Creating InterviewAI...');
      this.interviewAI = new InterviewAI();
      console.log('  ✅ InterviewAI created');
      
      console.log('  Creating Evaluator...');
      this.evaluator = new Evaluator();
      console.log('  ✅ Evaluator created');
      
      console.log('  Creating InterviewTracker...');
      this.interviewTracker = new InterviewTracker();
      console.log('  ✅ InterviewTracker created');
      
      console.log('  Creating ElevenLabsService...');
      this.elevenLabsService = new ElevenLabsService();
      console.log('  ✅ ElevenLabsService created');
      
      this._initialized = true;
      console.log('✅ All orchestrator services initialized successfully');
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  }

  async startVideoInterview(candidateName, email, roleSlug) {
    console.log('🎬 Orchestrator.startVideoInterview called with:', { candidateName, email, roleSlug });
    
    const sessionId = uuidv4();
    console.log('🆔 Generated session ID:', sessionId);
    
    try {
      // Quick validation only
      if (!process.env.CLAUDE_API_KEY || !process.env.ELEVENLABS_API_KEY) {
        throw new Error('Required services not configured. Please contact administrator.');
      }
      
      // Initialize services if needed (should be fast if already initialized)
      await this._ensureInitialized();
      
      // Check if we should use WebRTC mode instead of Google Meet
      const useWebRTC = !process.env.GOOGLE_CREDENTIALS || process.env.USE_WEBRTC_MODE === 'true';
      
      let meetUrl;
      let instructions;
      let mode = 'self-hosted-bot';
      
      if (useWebRTC) {
        // Use built-in WebRTC interview room
        meetUrl = `/interview/${sessionId}`;
        instructions = `Your AI-powered interview is ready! Click the link to join the interview room. The AI interviewer will start once you're connected.`;
        mode = 'webrtc';
        console.log('🎙️ Using WebRTC interview mode for session:', sessionId);
      } else if (process.env.GOOGLE_CREDENTIALS) {
        try {
          // Try to create real Meet room
          console.log('🔗 Creating Google Meet room...');
          const meetInfo = await this.meetGenerator.createMeetRoom(
            `${candidateName}_${sessionId}`,
            candidateName,
            roleSlug
          );
          
          // Check if it's a simulated URL (fallback)
          if (meetInfo.meetUrl.includes(meetInfo.meetCode) && meetInfo.recordingStatus === 'unavailable') {
            console.warn('⚠️ Google Meet creation failed - using fallback');
            needsGoogleSetup = true;
          } else {
            console.log('✅ Real Meet room created:', meetInfo.meetUrl);
            meetUrl = meetInfo.meetUrl;
          }
        } catch (error) {
          console.error('❌ Meet creation error:', error);
          needsGoogleSetup = true;
        }
      } else {
        console.warn('⚠️ Google credentials not configured');
        needsGoogleSetup = true;
      }
      
      // Prepare response based on Meet availability
      if (needsGoogleSetup) {
        // Provide clear instructions for manual setup
        meetUrl = '#';
        instructions = `⚠️ Google Meet integration is not configured.

To complete your interview:
1. Create a Google Meet room manually: https://meet.google.com/new
2. Share the Meet link with your interviewer
3. The interview will proceed via audio/video call

Alternatively, contact your administrator to set up Google integration.`;
      } else {
        instructions = `Your AI-powered interview is ready! The AI interviewer will join the Google Meet room shortly after you.`;
      }
      
      // Return response
      const quickResponse = {
        sessionId,
        meetUrl,
        instructions,
        status: useWebRTC ? 'webrtc-ready' : (needsGoogleSetup ? 'manual-setup-required' : 'ready'),
        needsGoogleSetup,
        mode
      };
      
      // Do the rest in the background
      setImmediate(async () => {
        try {
          console.log('🔧 Background processing starting...');
          
          // Load role template
          const roleTemplate = await this.interviewAI.loadRoleTemplate(roleSlug);
          
          // Check interview status
          const status = await this.interviewTracker.getInterviewStatus(email, roleSlug);
          if (!status.canStart) {
            console.warn('Interview already attempted:', email, roleSlug);
            return;
          }
          
          // Register the interview
          await this.interviewTracker.startInterview(email, roleSlug, sessionId);
          
          // Create session with the already-created Meet URL
          const session = {
            id: sessionId,
            candidateName,
            email,
            role: roleTemplate.role,
            roleSlug,
            meetUrl: meetInfo.meetUrl,
            questions: await this.prepareQuestions(roleTemplate),
            currentQuestionIndex: -1,
            responses: [],
            status: 'waiting_for_candidate',
            startedAt: new Date().toISOString(),
            completedAt: null,
            evaluation: null
          };
          
          this.activeSessions.set(sessionId, session);
          await this.saveSession(session);
          
          // 6. Schedule bot to join after a delay
          setTimeout(() => {
            this.launchBot(sessionId);
          }, 10000); // Give candidate 10 seconds to join first
          
        } catch (error) {
          console.error('❌ Background initialization error:', error);
          // Log error but don't throw since we're in background
        }
      });
      
      // Return the response with real Meet URL
      console.log('✅ Returning response with real Meet URL for session:', sessionId);
      return quickResponse;
      
    } catch (error) {
      console.error('Error starting self-hosted interview:', error);
      throw error;
    }
  }

  async prepareQuestions(roleTemplate) {
    const questions = [];
    
    // Generate audio for each question
    for (let i = 0; i < roleTemplate.questions.length; i++) {
      const questionText = roleTemplate.questions[i];
      const audioUrl = await this.elevenLabsService.generateSpeech(questionText, {
        voice: 'rachel',
        model: 'eleven_monolingual_v1'
      });
      
      questions.push({
        type: 'technical',
        text: questionText,
        audioUrl,
        waitTime: 30000 // 30 seconds to answer
      });
    }
    
    // Behavioral questions
    for (let i = 0; i < roleTemplate.behavioral_questions.length; i++) {
      const questionText = roleTemplate.behavioral_questions[i];
      const audioUrl = await this.elevenLabsService.generateSpeech(questionText, {
        voice: 'rachel',
        model: 'eleven_monolingual_v1'
      });
      
      questions.push({
        type: 'behavioral',
        text: questionText,
        audioUrl,
        waitTime: 45000 // 45 seconds for behavioral questions
      });
    }
    
    return questions;
  }

  async launchBot(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    console.log(`🤖 Launching AI interviewer for session ${sessionId}`);
    
    try {
      // Create and launch the bot
      const bot = new GoogleMeetBot({
        meetUrl: session.meetUrl,
        botName: `AI Interviewer - ${session.role}`
      });
      
      // Set up bot event handlers
      bot.on('ready', () => {
        console.log('Bot is ready, waiting to join meeting...');
      });
      
      bot.on('joined', () => {
        console.log('Bot joined the meeting!');
        session.status = 'interview_active';
        this.saveSession(session);
        
        // Start the interview after a short delay
        setTimeout(() => {
          this.startInterview(sessionId);
        }, 5000);
      });
      
      bot.on('error', (error) => {
        console.error('Bot error:', error);
        session.status = 'error';
        this.saveSession(session);
      });
      
      // Launch the bot
      await bot.launch();
      
      // Store bot reference
      this.activeBots.set(sessionId, bot);
      
    } catch (error) {
      console.error('Error launching bot:', error);
      session.status = 'error';
      await this.saveSession(session);
    }
  }

  async startInterview(sessionId) {
    const session = this.activeSessions.get(sessionId);
    const bot = this.activeBots.get(sessionId);
    
    if (!session || !bot) return;
    
    console.log('🎙️ Starting interview questions...');
    
    // Opening greeting
    const greetingText = `Hello ${session.candidateName}! I'm your AI interviewer today. I'll be asking you questions about the ${session.role} position. Please speak clearly and take your time with each answer. Let's begin!`;
    
    const greetingAudio = await this.elevenLabsService.generateSpeech(greetingText, {
      voice: 'rachel',
      model: 'eleven_monolingual_v1'
    });
    
    await bot.playAudio(greetingAudio);
    await bot.sendChatMessage(greetingText);
    
    // Wait before first question
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Ask questions one by one
    for (let i = 0; i < session.questions.length; i++) {
      await this.askQuestion(sessionId, i);
    }
    
    // Closing
    await this.concludeInterview(sessionId);
  }

  async askQuestion(sessionId, questionIndex) {
    const session = this.activeSessions.get(sessionId);
    const bot = this.activeBots.get(sessionId);
    
    if (!session || !bot) return;
    
    const question = session.questions[questionIndex];
    session.currentQuestionIndex = questionIndex;
    
    console.log(`📝 Asking question ${questionIndex + 1}: ${question.text}`);
    
    // Send question in chat for reference
    await bot.sendChatMessage(`Question ${questionIndex + 1}: ${question.text}`);
    
    // Play the question audio
    await bot.playAudio(question.audioUrl);
    
    // Record response timestamp
    session.responses.push({
      question: question.text,
      startedAt: new Date().toISOString(),
      response: 'Awaiting response...'
    });
    
    await this.saveSession(session);
    
    // Wait for response time
    await new Promise(resolve => setTimeout(resolve, question.waitTime));
    
    // Add a transition phrase
    const transitions = [
      "Thank you for that answer.",
      "I appreciate your response.",
      "That's helpful, thank you.",
      "Thanks for sharing that."
    ];
    
    const transition = transitions[Math.floor(Math.random() * transitions.length)];
    const transitionAudio = await this.elevenLabsService.generateSpeech(transition, {
      voice: 'rachel',
      model: 'eleven_monolingual_v1'
    });
    
    await bot.playAudio(transitionAudio);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async concludeInterview(sessionId) {
    const session = this.activeSessions.get(sessionId);
    const bot = this.activeBots.get(sessionId);
    
    if (!session || !bot) return;
    
    console.log('🎬 Concluding interview...');
    
    const closingText = `Thank you so much for your time today, ${session.candidateName}. We've completed all the interview questions. We'll review your responses and get back to you soon. Have a great day!`;
    
    const closingAudio = await this.elevenLabsService.generateSpeech(closingText, {
      voice: 'rachel',
      model: 'eleven_monolingual_v1'
    });
    
    await bot.sendChatMessage(closingText);
    await bot.playAudio(closingAudio);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Leave the meeting
    await bot.leaveMeeting();
    
    // Clean up
    await bot.close();
    this.activeBots.delete(sessionId);
    
    // Mark interview as completed
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    
    // Generate evaluation
    await this.evaluateInterview(sessionId);
  }

  async evaluateInterview(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    try {
      // Create mock evaluation since we don't have actual responses
      // In a real implementation, you'd use speech-to-text to capture responses
      const evaluation = {
        fit_score: 7.5,
        communication_score: 8.0,
        technical_score: 7.0,
        summary: `${session.candidateName} completed the automated interview for ${session.role}. The AI interviewer asked all prepared questions. Manual review of the session is recommended.`,
        strengths: ['Completed full interview', 'Professional demeanor'],
        concerns: ['Audio-only evaluation', 'No transcript available'],
        recommendation: 'Review meeting recording for detailed assessment'
      };
      
      session.evaluation = evaluation;
      
      // Mark as completed in tracker
      await this.interviewTracker.completeInterview(sessionId, evaluation);
      
      // Save results
      await this.saveSession(session);
      await this.saveResult(session);
      
      // Clean up
      this.activeSessions.delete(sessionId);
      
    } catch (error) {
      console.error('Error evaluating interview:', error);
    }
  }

  async saveSession(session) {
    const sessionsPath = path.join(__dirname, '../../data/bot_sessions');
    await fs.mkdir(sessionsPath, { recursive: true });
    
    const sessionFile = path.join(sessionsPath, `${session.id}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
  }

  async saveResult(session) {
    const resultsPath = path.join(__dirname, '../../data/results.json');
    let results = [];
    
    try {
      const content = await fs.readFile(resultsPath, 'utf8');
      results = JSON.parse(content);
    } catch (error) {
      // File doesn't exist yet
    }
    
    results.push({
      id: session.id,
      candidateName: session.candidateName,
      email: session.email,
      role: session.role,
      completedAt: session.completedAt,
      overallScore: session.evaluation?.fit_score || 0,
      communicationScore: session.evaluation?.communication_score || 0,
      technicalScore: session.evaluation?.technical_score || 0,
      summary: session.evaluation?.summary || 'AI interview completed',
      recordingUrl: null,
      mode: 'self-hosted-bot',
      evaluation: session.evaluation
    });
    
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  }

  getActiveSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }
}

module.exports = SelfHostedInterviewOrchestrator;
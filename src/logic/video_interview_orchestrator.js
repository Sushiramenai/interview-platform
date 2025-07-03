const { v4: uuidv4 } = require('uuid');
const MeetGenerator = require('../utils/meet_generator');
const MeetBotController = require('./meet_bot_controller');
const InterviewAI = require('./interview_ai');
const Evaluator = require('./evaluator');
const InterviewTracker = require('../utils/interview_tracker');
const fs = require('fs').promises;
const path = require('path');

class VideoInterviewOrchestrator {
  constructor() {
    this.meetGenerator = new MeetGenerator();
    this.botController = new MeetBotController();
    this.interviewAI = new InterviewAI();
    this.evaluator = new Evaluator();
    this.interviewTracker = new InterviewTracker();
    this.activeSessions = new Map();
    
    // Listen to bot controller events
    this.botController.on('interviewCompleted', this.handleInterviewCompleted.bind(this));
    this.botController.on('recordingReady', this.handleRecordingReady.bind(this));
  }

  async startVideoInterview(candidateName, email, roleSlug) {
    const sessionId = uuidv4();
    
    try {
      // Check required services are configured
      if (!process.env.CLAUDE_API_KEY) {
        throw new Error('Claude AI is not configured. Please contact administrator.');
      }
      if (!process.env.ELEVENLABS_API_KEY) {
        throw new Error('Voice synthesis (ElevenLabs) is not configured. Please contact administrator.');
      }
      if (!process.env.RECALL_API_KEY) {
        throw new Error('Recall.ai is not configured. Using manual interview mode instead.');
      }
      
      // 1. Check if candidate has already attempted this interview
      const status = await this.interviewTracker.getInterviewStatus(email, roleSlug);
      if (!status.canStart) {
        throw new Error(status.message || 'You have already attempted this interview.');
      }
      
      // 2. Load role template
      const roleTemplate = await this.interviewAI.loadRoleTemplate(roleSlug);
      
      // 3. Register the interview start
      await this.interviewTracker.startInterview(email, roleSlug, sessionId);
      
      // 2. Create Google Meet room
      const meetInfo = await this.meetGenerator.createMeetRoom(
        `${candidateName}_${sessionId}`,
        candidateName,
        roleTemplate.role
      );
      
      // 3. Create interview bot using bot controller
      const bot = await this.botController.createInterviewBot({
        id: sessionId,
        candidateName,
        email,
        role: roleTemplate.role,
        roleSlug,
        meetUrl: meetInfo.meetUrl,
        questions: this.prepareQuestions(roleTemplate),
        responses: []
      });
      
      // 4. Prepare interview session
      const session = {
        id: sessionId,
        candidateName,
        email,
        role: roleTemplate.role,
        roleSlug,
        meetUrl: meetInfo.meetUrl,
        botId: bot.id,
        questions: this.prepareQuestions(roleTemplate),
        currentQuestionIndex: 0,
        responses: [],
        status: 'waiting_for_candidate',
        startedAt: new Date().toISOString(),
        completedAt: null,
        evaluation: null
      };
      
      this.activeSessions.set(sessionId, session);
      
      // 6. Save session to file
      await this.saveSession(session);
      
      return {
        sessionId,
        meetUrl: meetInfo.meetUrl,
        instructions: "Please join the Google Meet room using the link above. The AI interviewer will join shortly and begin the interview."
      };
      
    } catch (error) {
      console.error('Error starting video interview:', error);
      throw error;
    }
  }

  prepareQuestions(roleTemplate) {
    const questions = [];
    
    // Opening
    questions.push({
      type: 'opening',
      text: `Hello! I'm Claude, and I'll be conducting your interview today for the ${roleTemplate.role} position. I want this to be a comfortable conversation where you can showcase your skills and experience. Before we begin, do you have any questions about the interview process?`,
      waitForResponse: true
    });
    
    // Role-specific questions
    roleTemplate.questions.forEach((q, index) => {
      questions.push({
        type: 'technical',
        text: q,
        index: index + 1,
        waitForResponse: true
      });
    });
    
    // Behavioral questions
    roleTemplate.behavioral_questions.forEach((q, index) => {
      questions.push({
        type: 'behavioral',
        text: q,
        index: index + 1,
        waitForResponse: true
      });
    });
    
    // Closing
    questions.push({
      type: 'closing',
      text: "Thank you so much for your time today. Do you have any questions for me about the role or the company?",
      waitForResponse: true
    });
    
    questions.push({
      type: 'farewell',
      text: "Thank you again for interviewing with us. We'll review your responses and get back to you within the next few days. Have a great day!",
      waitForResponse: false
    });
    
    return questions;
  }

  async handleInterviewCompleted({ session, botId }) {
    console.log(`Interview completed for session ${session.id}`);
    
    // Update session with responses from bot controller
    const activeSession = this.activeSessions.get(session.id);
    if (activeSession) {
      activeSession.responses = session.responses;
      activeSession.status = 'interview_completed';
      await this.saveSession(activeSession);
      
      // Finalize the interview
      await this.finalizeInterview(session.id);
    }
  }
  
  async handleRecordingReady({ botId, recordingUrl }) {
    // Find session by bot ID
    let sessionId = null;
    for (const [id, session] of this.activeSessions.entries()) {
      if (session.botId === botId) {
        sessionId = id;
        break;
      }
    }
    
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      session.recordingUrl = recordingUrl;
      await this.saveSession(session);
    }
  }

  async finalizeInterview(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    try {
      // Evaluate the interview
      const roleTemplate = await this.interviewAI.loadRoleTemplate(session.roleSlug);
      const evaluation = await this.evaluator.evaluateInterview({
        sessionId: session.id,
        candidateName: session.candidateName,
        responses: session.responses
      }, roleTemplate);
      
      session.evaluation = evaluation;
      session.completedAt = new Date().toISOString();
      session.status = 'completed';
      
      // Mark interview as completed in tracker
      await this.interviewTracker.completeInterview(sessionId, evaluation);
      
      // Save final session state
      await this.saveSession(session);
      
      // Save to results
      await this.saveResult(session);
      
      // Clean up
      this.activeSessions.delete(sessionId);
      
    } catch (error) {
      console.error('Error finalizing interview:', error);
      session.status = 'error';
      await this.saveSession(session);
    }
  }

  parseTranscript(transcript, questions) {
    // Parse the transcript to match questions with responses
    // This is a simplified version - real implementation would use
    // more sophisticated NLP to match Q&A pairs
    const responses = [];
    
    questions.forEach((question, index) => {
      if (question.waitForResponse) {
        responses.push({
          question: question.text,
          response: transcript.segments?.[index]?.text || 'No response captured',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return responses;
  }

  async saveSession(session) {
    const sessionsPath = path.join(__dirname, '../../data/video_sessions');
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
      overallScore: session.evaluation.fit_score,
      communicationScore: session.evaluation.communication_score,
      technicalScore: session.evaluation.fit_score,
      summary: session.evaluation.summary,
      recordingUrl: session.recordingUrl,
      evaluation: session.evaluation
    });
    
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  }

  getActiveSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }
}

module.exports = VideoInterviewOrchestrator;
const { v4: uuidv4 } = require('uuid');
const MeetGenerator = require('../utils/meet_generator');
const InterviewAI = require('./interview_ai');
const Evaluator = require('./evaluator');
const InterviewTracker = require('../utils/interview_tracker');
const ElevenLabsService = require('../utils/elevenlabs_service');
const fs = require('fs').promises;
const path = require('path');

class ManualInterviewOrchestrator {
  constructor() {
    this.meetGenerator = new MeetGenerator();
    this.interviewAI = new InterviewAI();
    this.evaluator = new Evaluator();
    this.interviewTracker = new InterviewTracker();
    this.elevenLabsService = new ElevenLabsService();
    this.activeSessions = new Map();
  }

  async startVideoInterview(candidateName, email, roleSlug) {
    const sessionId = uuidv4();
    
    try {
// Check required services
      if (!process.env.CLAUDE_API_KEY) {
        throw new Error('Claude AI is not configured. Please contact administrator.');
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
      
      // 4. Create Google Meet room
      const meetInfo = await this.meetGenerator.createMeetRoom(
        `${candidateName}_${sessionId}`,
        candidateName,
        roleTemplate.role
      );
      
      // 5. Generate interview guide with questions
      const interviewGuide = await this.generateInterviewGuide(roleTemplate, sessionId);
      
      // 6. Prepare interview session
      const session = {
        id: sessionId,
        candidateName,
        email,
        role: roleTemplate.role,
        roleSlug,
        meetUrl: meetInfo.meetUrl,
        questions: this.prepareQuestions(roleTemplate),
        interviewGuide: interviewGuide,
        status: 'ready',
        startedAt: new Date().toISOString(),
        mode: 'manual' // Indicates no bot recording
      };
      
      this.activeSessions.set(sessionId, session);
      await this.saveSession(session);
      
      return {
        sessionId,
        meetUrl: meetInfo.meetUrl,
        interviewGuideUrl: `/api/interview/guide/${sessionId}`,
        instructions: `
Interview Ready! Here's how it works:

1. Click the Google Meet link to join the video call
2. Share the interview guide link with the interviewer
3. The interviewer will ask you the prepared questions
4. Since recording is not enabled, please ensure you:
   - Have a quiet environment
   - Test your camera and microphone
   - Are ready for a 30-45 minute interview

Note: This is a one-time interview. You cannot restart once begun.
        `.trim()
      };
      
    } catch (error) {
      console.error('Error starting manual interview:', error);
      throw error;
    }
  }

  prepareQuestions(roleTemplate) {
    const questions = [];
    
    // Opening
    questions.push({
      type: 'opening',
      text: `Hello! I'm conducting your interview today for the ${roleTemplate.role} position. Before we begin, do you have any questions about the interview process?`,
      notes: 'Make the candidate feel comfortable. Allow 1-2 minutes for questions.'
    });
    
    // Role-specific questions
    roleTemplate.questions.forEach((q, index) => {
      questions.push({
        type: 'technical',
        number: index + 1,
        text: q,
        notes: 'Listen for specific examples and relevant experience. Follow up if answer is too general.'
      });
    });
    
    // Behavioral questions
    roleTemplate.behavioral_questions.forEach((q, index) => {
      questions.push({
        type: 'behavioral',
        number: index + 1,
        text: q,
        notes: 'Look for STAR method (Situation, Task, Action, Result). Probe for specific details.'
      });
    });
    
    // Closing
    questions.push({
      type: 'closing',
      text: "Thank you for your time today. Do you have any questions for me about the role or the company?",
      notes: 'Allow 5-10 minutes for candidate questions. Note the quality of their questions.'
    });
    
    return questions;
  }

  async generateInterviewGuide(roleTemplate, sessionId) {
    const guide = {
      sessionId,
      role: roleTemplate.role,
      jobDescription: roleTemplate.job_description,
      requirements: roleTemplate.requirements,
      traits: roleTemplate.traits,
      interviewStructure: {
        duration: '30-45 minutes',
        sections: [
          { name: 'Introduction', time: '5 minutes' },
          { name: 'Technical Questions', time: '15-20 minutes' },
          { name: 'Behavioral Questions', time: '10-15 minutes' },
          { name: 'Candidate Questions', time: '5-10 minutes' }
        ]
      },
      evaluationCriteria: {
        technical: 'Assess knowledge and experience relevant to the role',
        communication: 'Evaluate clarity, structure, and articulation',
        cultural: 'Look for alignment with company values and team fit',
        motivation: 'Understand why they want this role'
      },
      questions: this.prepareQuestions(roleTemplate),
      scoringGuide: {
        excellent: '9-10: Exceeds all requirements, exceptional responses',
        good: '7-8: Meets requirements, solid answers with examples',
        adequate: '5-6: Meets most requirements, some areas need development',
        poor: '1-4: Does not meet requirements, significant gaps'
      }
    };
    
    // Save guide for retrieval
    const guidePath = path.join(__dirname, '../../data/interview_guides');
    await fs.mkdir(guidePath, { recursive: true });
    await fs.writeFile(
      path.join(guidePath, `${sessionId}.json`),
      JSON.stringify(guide, null, 2)
    );
    
    return guide;
  }

  async completeInterview(sessionId, evaluation) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Mark interview as completed
    await this.interviewTracker.completeInterview(sessionId, evaluation);
    
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.evaluation = evaluation;
    
    await this.saveSession(session);
    await this.saveResult(session);
    
    this.activeSessions.delete(sessionId);
    
    return { success: true };
  }

  async saveSession(session) {
    const sessionsPath = path.join(__dirname, '../../data/manual_sessions');
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
      summary: session.evaluation?.summary || 'Manual interview - pending evaluation',
      recordingUrl: null,
      mode: 'manual',
      evaluation: session.evaluation
    });
    
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  }

  getActiveSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  async getInterviewGuide(sessionId) {
    const guidePath = path.join(__dirname, '../../data/interview_guides', `${sessionId}.json`);
    try {
      const content = await fs.readFile(guidePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
}

module.exports = ManualInterviewOrchestrator;
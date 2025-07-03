const fs = require('fs').promises;
const path = require('path');

class InterviewTracker {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/interview_tracking.json');
    this.cache = null;
  }

  async initialize() {
    try {
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
      const data = await fs.readFile(this.dbPath, 'utf8');
      this.cache = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, create empty structure
      this.cache = {
        candidates: {},
        sessions: {}
      };
      await this.save();
    }
  }

  async save() {
    await fs.writeFile(this.dbPath, JSON.stringify(this.cache, null, 2));
  }

  async hasCompletedInterview(email, role) {
    if (!this.cache) await this.initialize();
    
    const candidateKey = `${email.toLowerCase()}_${role.toLowerCase()}`;
    const candidate = this.cache.candidates[candidateKey];
    
    if (!candidate) return false;
    
    // Check if they have a completed or in-progress interview
    return candidate.status === 'completed' || 
           candidate.status === 'in_progress' ||
           candidate.status === 'started';
  }

  async startInterview(email, role, sessionId) {
    if (!this.cache) await this.initialize();
    
    const candidateKey = `${email.toLowerCase()}_${role.toLowerCase()}`;
    
    // Check if already attempted
    if (await this.hasCompletedInterview(email, role)) {
      throw new Error('You have already attempted this interview. Multiple attempts are not allowed.');
    }
    
    // Record the interview start
    this.cache.candidates[candidateKey] = {
      email,
      role,
      sessionId,
      startedAt: new Date().toISOString(),
      status: 'started',
      attempts: 1
    };
    
    this.cache.sessions[sessionId] = {
      candidateKey,
      startedAt: new Date().toISOString(),
      status: 'in_progress'
    };
    
    await this.save();
    
    return true;
  }

  async markInProgress(sessionId) {
    if (!this.cache) await this.initialize();
    
    const session = this.cache.sessions[sessionId];
    if (!session) return false;
    
    session.status = 'in_progress';
    
    const candidate = this.cache.candidates[session.candidateKey];
    if (candidate) {
      candidate.status = 'in_progress';
      candidate.lastActivity = new Date().toISOString();
    }
    
    await this.save();
    return true;
  }

  async completeInterview(sessionId, evaluation) {
    if (!this.cache) await this.initialize();
    
    const session = this.cache.sessions[sessionId];
    if (!session) return false;
    
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.evaluation = {
      score: evaluation.fit_score,
      summary: evaluation.summary
    };
    
    const candidate = this.cache.candidates[session.candidateKey];
    if (candidate) {
      candidate.status = 'completed';
      candidate.completedAt = new Date().toISOString();
      candidate.score = evaluation.fit_score;
    }
    
    await this.save();
    return true;
  }

  async getInterviewStatus(email, role) {
    if (!this.cache) await this.initialize();
    
    const candidateKey = `${email.toLowerCase()}_${role.toLowerCase()}`;
    const candidate = this.cache.candidates[candidateKey];
    
    if (!candidate) {
      return { status: 'not_started', canStart: true };
    }
    
    return {
      status: candidate.status,
      canStart: false,
      startedAt: candidate.startedAt,
      completedAt: candidate.completedAt,
      score: candidate.score,
      message: this.getStatusMessage(candidate.status)
    };
  }

  getStatusMessage(status) {
    switch (status) {
      case 'started':
        return 'Your interview is in progress. Please complete it in the Google Meet room.';
      case 'in_progress':
        return 'Your interview session is active. You cannot start a new one.';
      case 'completed':
        return 'You have already completed this interview. Thank you for your participation.';
      default:
        return 'Interview status unknown.';
    }
  }

  async getSessionInfo(sessionId) {
    if (!this.cache) await this.initialize();
    
    const session = this.cache.sessions[sessionId];
    if (!session) return null;
    
    const candidate = this.cache.candidates[session.candidateKey];
    
    return {
      session,
      candidate
    };
  }

  async cleanupAbandonedSessions() {
    if (!this.cache) await this.initialize();
    
    const now = new Date();
    const maxAgeHours = 3; // Consider abandoned after 3 hours
    
    for (const [sessionId, session] of Object.entries(this.cache.sessions)) {
      if (session.status === 'in_progress') {
        const startTime = new Date(session.startedAt);
        const ageHours = (now - startTime) / (1000 * 60 * 60);
        
        if (ageHours > maxAgeHours) {
          // Mark as abandoned
          session.status = 'abandoned';
          session.abandonedAt = now.toISOString();
          
          const candidate = this.cache.candidates[session.candidateKey];
          if (candidate && candidate.status === 'in_progress') {
            candidate.status = 'abandoned';
            candidate.abandonedAt = now.toISOString();
          }
        }
      }
    }
    
    await this.save();
  }
}

module.exports = InterviewTracker;
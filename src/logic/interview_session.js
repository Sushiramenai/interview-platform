class InterviewSession {
    constructor(role, candidateId) {
        this.role = role;
        this.candidateId = candidateId;
        this.meetUrl = null;
        this.sessionActive = false;
    }

    async createMeetRoom() {
        try {
            const response = await fetch('/api/meet/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: this.role,
                    candidateId: this.candidateId
                })
            });

            const data = await response.json();
            this.meetUrl = data.meetUrl;
            return this.meetUrl;
        } catch (error) {
            console.error('Failed to create Meet room:', error);
            // Fallback to demo URL
            this.meetUrl = 'https://meet.google.com/demo-interview-room';
            return this.meetUrl;
        }
    }

    async startAIInterviewer() {
        this.sessionActive = true;
        
        try {
            const response = await fetch('/api/interview/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: this.role,
                    candidateId: this.candidateId,
                    meetUrl: this.meetUrl
                })
            });

            const data = await response.json();
            console.log('AI Interviewer started:', data);
            
            // In production, this would connect to the actual AI service
            // For now, we'll simulate the interview process
            this.simulateInterview();
        } catch (error) {
            console.error('Failed to start AI interviewer:', error);
        }
    }

    async simulateInterview() {
        // This is a placeholder for the actual interview process
        // In production, this would:
        // 1. Connect to Google Meet via bot
        // 2. Use speech recognition for candidate responses
        // 3. Use text-to-speech for AI questions
        // 4. Record the session
        
        console.log('Interview simulation started');
        
        // Simulate interview duration
        setTimeout(() => {
            if (this.sessionActive) {
                console.log('Interview time limit reached');
                this.endInterview();
            }
        }, 45 * 60 * 1000); // 45 minutes
    }

    async endInterview() {
        this.sessionActive = false;
        
        try {
            const response = await fetch('/api/interview/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateId: this.candidateId
                })
            });

            const data = await response.json();
            console.log('Interview ended:', data);
            
            // Trigger evaluation
            await this.triggerEvaluation();
        } catch (error) {
            console.error('Failed to end interview:', error);
        }
    }

    async triggerEvaluation() {
        try {
            const response = await fetch('/api/interview/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateId: this.candidateId,
                    role: this.role
                })
            });

            const evaluation = await response.json();
            console.log('Evaluation completed:', evaluation);
        } catch (error) {
            console.error('Failed to trigger evaluation:', error);
        }
    }
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InterviewSession;
} else {
    window.InterviewSession = InterviewSession;
}
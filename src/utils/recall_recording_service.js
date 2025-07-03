const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class RecallRecordingService {
    constructor() {
        this.apiKey = process.env.RECALL_API_KEY;
        this.baseUrl = 'https://api.recall.ai/api/v1';
        this.webhookUrl = `${process.env.BASE_URL}/api/webhooks/recall`;
    }

    async createBot(meetUrl, sessionId, metadata) {
        if (!this.apiKey) {
            console.warn('Recall.ai API key not configured');
            return null;
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/bot`,
                {
                    meeting_url: meetUrl,
                    bot_name: 'AI Interview Assistant',
                    transcription_options: {
                        provider: 'deepgram'
                    },
                    recording_mode: 'speaker_view',
                    webhook_url: this.webhookUrl,
                    metadata: {
                        session_id: sessionId,
                        candidate_name: metadata.candidateName,
                        role: metadata.role,
                        interview_date: new Date().toISOString()
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Recall bot created:', response.data.id);

            return {
                botId: response.data.id,
                botName: response.data.bot_name,
                status: response.data.status,
                joinUrl: response.data.join_url
            };
        } catch (error) {
            console.error('Error creating Recall bot:', error.response?.data || error.message);
            throw new Error(`Failed to create recording bot: ${error.message}`);
        }
    }

    async getBotStatus(botId) {
        if (!this.apiKey) return null;

        try {
            const response = await axios.get(
                `${this.baseUrl}/bot/${botId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            return {
                id: response.data.id,
                status: response.data.status,
                recording_status: response.data.recording_status,
                transcription_status: response.data.transcription_status
            };
        } catch (error) {
            console.error('Error getting bot status:', error);
            return null;
        }
    }

    async getRecording(botId) {
        if (!this.apiKey) return null;

        try {
            const response = await axios.get(
                `${this.baseUrl}/bot/${botId}/recording`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            return {
                video_url: response.data.video_url,
                audio_url: response.data.audio_url,
                duration: response.data.duration,
                created_at: response.data.created_at
            };
        } catch (error) {
            console.error('Error getting recording:', error);
            return null;
        }
    }

    async getTranscript(botId) {
        if (!this.apiKey) return null;

        try {
            const response = await axios.get(
                `${this.baseUrl}/bot/${botId}/transcript`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            return {
                transcript: response.data.transcript,
                speakers: response.data.speakers,
                words: response.data.words
            };
        } catch (error) {
            console.error('Error getting transcript:', error);
            return null;
        }
    }

    async deleteBot(botId) {
        if (!this.apiKey) return false;

        try {
            await axios.delete(
                `${this.baseUrl}/bot/${botId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );
            return true;
        } catch (error) {
            console.error('Error deleting bot:', error);
            return false;
        }
    }

    async processWebhook(payload) {
        // Handle Recall.ai webhooks
        const { event, data } = payload;

        switch (event) {
            case 'bot.ready':
                console.log('Bot ready to join meeting:', data.bot_id);
                break;
            
            case 'bot.joined':
                console.log('Bot joined meeting:', data.bot_id);
                break;
            
            case 'bot.recording_started':
                console.log('Recording started:', data.bot_id);
                break;
            
            case 'bot.recording_stopped':
                console.log('Recording stopped:', data.bot_id);
                // Trigger download and processing
                await this.handleRecordingComplete(data.bot_id, data.metadata);
                break;
            
            case 'bot.transcription_ready':
                console.log('Transcription ready:', data.bot_id);
                break;
            
            case 'bot.error':
                console.error('Bot error:', data.error);
                break;
        }
    }

    async handleRecordingComplete(botId, metadata) {
        try {
            // Get recording URL
            const recording = await this.getRecording(botId);
            
            // Get transcript
            const transcript = await this.getTranscript(botId);
            
            // Store in database or trigger evaluation
            console.log('Recording complete, triggering evaluation');
            
            return {
                botId,
                recording,
                transcript,
                metadata
            };
        } catch (error) {
            console.error('Error handling recording completion:', error);
        }
    }
}

module.exports = RecallRecordingService;
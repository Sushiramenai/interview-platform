const axios = require('axios');
const EventEmitter = require('events');

class RecallService extends EventEmitter {
  constructor() {
    super();
    this.apiKey = process.env.RECALL_API_KEY;
    this.region = process.env.RECALL_REGION || 'us-west-2';
    this.baseUrl = `https://${this.region}.recall.ai/api/v1`;
    this.webhookUrl = process.env.RECALL_WEBHOOK_URL || 'https://your-domain.com/api/webhooks/recall';
    this.activeBots = new Map();
  }

  async initialize(apiKey) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  async createBot(options) {
    if (!this.apiKey) {
      throw new Error('Recall.ai API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/bot`,
        {
          meeting_url: options.meetingUrl,
          bot_name: options.botName || 'AI Interviewer',
          recording_config: {
            transcript: {
              provider: {
                meeting_captions: {}
              }
            }
          },
          webhook_url: this.webhookUrl,
          automatic_leave: {
            everyone_left_timeout: 60, // Leave after 60 seconds if everyone else left
            noone_joined_timeout: 300  // Leave after 5 minutes if no one joined
          }
        },
        {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const bot = response.data;
      this.activeBots.set(bot.id, bot);
      
      return bot;
    } catch (error) {
      console.error('Error creating Recall bot:', error.response?.data || error.message);
      throw error;
    }
  }

  async getBotStatus(botId) {
    if (!this.apiKey) {
      throw new Error('Recall.ai API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/bot/${botId}`,
        {
          headers: {
            'Authorization': `Token ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting bot status:', error.response?.data || error.message);
      throw error;
    }
  }

  async playAudio(botId, audioUrl) {
    // In a real implementation, this would use Recall's audio streaming API
    // to play the audio in the meeting
    console.log(`Playing audio for bot ${botId}: ${audioUrl}`);
    
    // For now, we'll simulate this functionality
    // Real implementation would stream audio to the bot
    return new Promise(resolve => {
      setTimeout(resolve, 5000); // Simulate audio playback time
    });
  }

  async getTranscript(botId) {
    if (!this.apiKey) {
      throw new Error('Recall.ai API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/bot/${botId}/transcript`,
        {
          headers: {
            'Authorization': `Token ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting transcript:', error.response?.data || error.message);
      throw error;
    }
  }

  async getRecording(botId) {
    if (!this.apiKey) {
      throw new Error('Recall.ai API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/bot/${botId}/recording`,
        {
          headers: {
            'Authorization': `Token ${this.apiKey}`
          }
        }
      );

      // Get the video URL from the response
      return response.data.video_url;
    } catch (error) {
      console.error('Error getting recording:', error.response?.data || error.message);
      throw error;
    }
  }

  async processWebhook(webhookData) {
    const { event, bot_id, data } = webhookData;
    
    console.log(`Received webhook event: ${event} for bot ${bot_id}`);
    
    switch (event) {
      case 'bot.join_call':
        this.emit('botJoined', { botId: bot_id, data });
        break;
        
      case 'bot.leave_call':
        this.emit('botLeft', { botId: bot_id, data });
        this.activeBots.delete(bot_id);
        break;
        
      case 'bot.transcription':
        this.emit('transcription', { botId: bot_id, transcript: data });
        break;
        
      case 'bot.recording_ready':
        this.emit('recordingReady', { botId: bot_id, recordingUrl: data.video_url });
        break;
        
      case 'bot.error':
        this.emit('error', { botId: bot_id, error: data });
        break;
    }
  }

  async leaveCall(botId) {
    if (!this.apiKey) {
      throw new Error('Recall.ai API key not configured');
    }

    try {
      await axios.post(
        `${this.baseUrl}/bot/${botId}/leave_call`,
        {},
        {
          headers: {
            'Authorization': `Token ${this.apiKey}`
          }
        }
      );

      this.activeBots.delete(botId);
      return true;
    } catch (error) {
      console.error('Error leaving call:', error.response?.data || error.message);
      throw error;
    }
  }

  async deleteBot(botId) {
    if (!this.apiKey) {
      throw new Error('Recall.ai API key not configured');
    }

    try {
      await axios.delete(
        `${this.baseUrl}/bot/${botId}`,
        {
          headers: {
            'Authorization': `Token ${this.apiKey}`
          }
        }
      );

      this.activeBots.delete(botId);
      return true;
    } catch (error) {
      console.error('Error deleting bot:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = RecallService;
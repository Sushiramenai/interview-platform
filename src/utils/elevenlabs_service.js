const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Default to Rachel voice
    this.tempDir = path.join(__dirname, '../../temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async initialize(apiKey) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
  }

  async generateSpeech(text, options = {}) {
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not configured, using fallback TTS');
      return this.generateFallbackSpeech(text);
    }

    try {
      const voiceId = options.voiceId || this.voiceId;
      const model = options.model || 'eleven_monolingual_v1';
      
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      // Save audio to temp file
      const filename = `speech_${uuidv4()}.mp3`;
      const filepath = path.join(this.tempDir, filename);
      
      fs.writeFileSync(filepath, response.data);
      
      // Return URL path
      return `/api/audio/${filename}`;
      
    } catch (error) {
      console.error('Error generating speech with ElevenLabs:', error.response?.data || error.message);
      // Fallback to basic TTS
      return this.generateFallbackSpeech(text);
    }
  }

  async generateFallbackSpeech(text) {
    // Use browser's built-in TTS or a simple alternative
    // In production, this could use Google Cloud TTS or another service
    console.log('Using fallback TTS for:', text.substring(0, 50) + '...');
    
    // Return null to indicate no audio file available
    // The client can use browser TTS as fallback
    return null;
  }

  async getVoices() {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/voices`,
        {
          headers: {
            'xi-api-key': this.apiKey
          }
        }
      );

      return response.data.voices;
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  // Clean up old audio files
  async cleanupOldFiles() {
    const files = fs.readdirSync(this.tempDir);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    files.forEach(file => {
      const filepath = path.join(this.tempDir, file);
      const stats = fs.statSync(filepath);
      
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filepath);
      }
    });
  }

  // Get available voice options for the UI
  getVoiceOptions() {
    return [
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Rachel', description: 'Professional female voice' },
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Drew', description: 'Professional male voice' },
      { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Young female voice' },
      { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Nicole', description: 'Warm female voice' },
      { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Confident male voice' }
    ];
  }
}

module.exports = ElevenLabsService;
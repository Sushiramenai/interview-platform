const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ElevenLabsVoiceService {
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
        this.baseUrl = 'https://api.elevenlabs.io/v1';
        this.enabled = process.env.ENABLE_VOICE === 'true' && !!this.apiKey;
    }

    async textToSpeech(text, options = {}) {
        if (!this.enabled) {
            console.log('ElevenLabs voice service disabled');
            return null;
        }

        const {
            voiceId = this.voiceId,
            stability = 0.5,
            similarityBoost = 0.5,
            modelId = 'eleven_monolingual_v1',
            outputFormat = 'mp3_44100_128'
        } = options;

        try {
            const response = await axios.post(
                `${this.baseUrl}/text-to-speech/${voiceId}`,
                {
                    text,
                    model_id: modelId,
                    voice_settings: {
                        stability,
                        similarity_boost: similarityBoost
                    }
                },
                {
                    headers: {
                        'Accept': 'audio/mpeg',
                        'xi-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'stream'
                }
            );

            // Save audio to temporary file
            const filename = `speech_${Date.now()}.mp3`;
            const filepath = path.join(__dirname, '../../temp', filename);
            
            // Ensure temp directory exists
            const tempDir = path.dirname(filepath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const writer = fs.createWriteStream(filepath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve({ filepath, filename }));
                writer.on('error', reject);
            });
        } catch (error) {
            console.error('ElevenLabs TTS error:', error.response?.data || error.message);
            throw new Error(`Failed to generate speech: ${error.message}`);
        }
    }

    async streamTextToSpeech(text, onChunk, options = {}) {
        if (!this.enabled) return null;

        const {
            voiceId = this.voiceId,
            stability = 0.5,
            similarityBoost = 0.5,
            modelId = 'eleven_monolingual_v1',
            optimizeStreamingLatency = 2
        } = options;

        try {
            const response = await axios.post(
                `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
                {
                    text,
                    model_id: modelId,
                    voice_settings: {
                        stability,
                        similarity_boost: similarityBoost
                    },
                    optimize_streaming_latency: optimizeStreamingLatency
                },
                {
                    headers: {
                        'Accept': 'audio/mpeg',
                        'xi-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'stream'
                }
            );

            response.data.on('data', onChunk);
            response.data.on('end', () => onChunk(null)); // Signal end of stream

            return response.data;
        } catch (error) {
            console.error('ElevenLabs streaming error:', error);
            throw error;
        }
    }

    async getVoices() {
        if (!this.enabled) return [];

        try {
            const response = await axios.get(
                `${this.baseUrl}/voices`,
                {
                    headers: {
                        'xi-api-key': this.apiKey
                    }
                }
            );

            return response.data.voices.map(voice => ({
                voiceId: voice.voice_id,
                name: voice.name,
                labels: voice.labels,
                description: voice.description,
                previewUrl: voice.preview_url
            }));
        } catch (error) {
            console.error('Error fetching voices:', error);
            return [];
        }
    }

    async getVoiceSettings(voiceId = this.voiceId) {
        if (!this.enabled) return null;

        try {
            const response = await axios.get(
                `${this.baseUrl}/voices/${voiceId}/settings`,
                {
                    headers: {
                        'xi-api-key': this.apiKey
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error fetching voice settings:', error);
            return null;
        }
    }

    async generateInterviewAudio(questions, outputDir) {
        if (!this.enabled) return [];

        const audioFiles = [];

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const audioFile = await this.textToSpeech(question.text, {
                stability: 0.6, // Slightly more stable for professional tone
                similarityBoost: 0.5
            });

            if (audioFile) {
                // Move to output directory
                const newPath = path.join(outputDir, `question_${i + 1}.mp3`);
                fs.renameSync(audioFile.filepath, newPath);
                
                audioFiles.push({
                    questionIndex: i,
                    questionText: question.text,
                    audioPath: newPath,
                    duration: await this.getAudioDuration(newPath)
                });
            }
        }

        return audioFiles;
    }

    async getAudioDuration(filepath) {
        // This is a placeholder - in production, use a library like 'get-audio-duration'
        // For now, estimate based on text length
        const stats = fs.statSync(filepath);
        const fileSizeInBytes = stats.size;
        const bitRate = 128000; // 128 kbps
        const durationInSeconds = (fileSizeInBytes * 8) / bitRate;
        return Math.round(durationInSeconds);
    }

    cleanup() {
        // Clean up temporary files
        const tempDir = path.join(__dirname, '../../temp');
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            files.forEach(file => {
                if (file.startsWith('speech_')) {
                    fs.unlinkSync(path.join(tempDir, file));
                }
            });
        }
    }
}

module.exports = ElevenLabsVoiceService;
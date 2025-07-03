const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../../data/config.json');
        this.algorithm = 'aes-256-gcm';
        this.secretKey = process.env.CONFIG_ENCRYPTION_KEY || 'default-encryption-key-change-this';
    }

    async initialize() {
        try {
            await fs.access(this.configPath);
        } catch (error) {
            // Create default config if doesn't exist
            await this.saveConfig({
                initialized: false,
                apiKeys: {},
                settings: {
                    intro_content: '# Welcome to Your Interview\n\nWe are excited to meet you!',
                    company_name: 'Your Company',
                    platform_name: 'AI Interview Platform'
                }
            });
        }
    }

    encrypt(text) {
        try {
            console.log('Encrypting text...');
            const iv = crypto.randomBytes(16);
            const salt = crypto.randomBytes(64);
            const key = crypto.pbkdf2Sync(this.secretKey, salt, 100000, 32, 'sha256');
            
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);
            const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
            const tag = cipher.getAuthTag();
            
            const result = Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
            console.log('Encryption successful');
            return result;
        } catch (error) {
            console.error('Encryption error:', error);
            throw error;
        }
    }

    decrypt(encryptedData) {
        try {
            const data = Buffer.from(encryptedData, 'base64');
            
            const salt = data.slice(0, 64);
            const iv = data.slice(64, 80);
            const tag = data.slice(80, 96);
            const encrypted = data.slice(96);
            
            const key = crypto.pbkdf2Sync(this.secretKey, salt, 100000, 32, 'sha256');
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(tag);
            
            return decipher.update(encrypted) + decipher.final('utf8');
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    async getConfig() {
        try {
            const content = await fs.readFile(this.configPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            await this.initialize();
            return await this.getConfig();
        }
    }

    async saveConfig(config) {
        try {
            console.log('Saving config to:', this.configPath);
            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
            console.log('Config file written successfully');
        } catch (error) {
            console.error('Error writing config file:', error);
            throw error;
        }
    }

    async getApiKeys() {
        const config = await this.getConfig();
        const decryptedKeys = {};
        
        for (const [key, value] of Object.entries(config.apiKeys || {})) {
            if (value && value.startsWith('enc:')) {
                decryptedKeys[key] = this.decrypt(value.substring(4));
            } else {
                decryptedKeys[key] = value;
            }
        }
        
        return decryptedKeys;
    }

    async setApiKey(keyName, keyValue) {
        try {
            console.log(`ConfigManager.setApiKey called for ${keyName}`);
            const config = await this.getConfig();
            
            if (!config.apiKeys) {
                config.apiKeys = {};
            }
            
            // Encrypt sensitive keys
            if (keyValue && keyValue.trim()) {
                console.log(`Encrypting key ${keyName}`);
                const encrypted = this.encrypt(keyValue);
                config.apiKeys[keyName] = 'enc:' + encrypted;
                console.log(`Key ${keyName} encrypted successfully`);
            } else {
                delete config.apiKeys[keyName];
            }
            
            console.log(`Saving config with keys:`, Object.keys(config.apiKeys));
            await this.saveConfig(config);
            console.log(`Config saved successfully for ${keyName}`);
        } catch (error) {
            console.error(`Error in setApiKey for ${keyName}:`, error);
            throw error;
        }
    }

    async updateSettings(settings) {
        const config = await this.getConfig();
        config.settings = { ...config.settings, ...settings };
        config.initialized = true;
        await this.saveConfig(config);
    }

    async isInitialized() {
        const config = await this.getConfig();
        return config.initialized === true;
    }

    async testApiKey(service, apiKey) {
        // Test connection for each service
        switch (service) {
            case 'claude':
                return await this.testClaude(apiKey);
            case 'elevenlabs':
                return await this.testElevenLabs(apiKey);
            case 'google':
                return await this.testGoogle(apiKey);
            case 'recall':
                return await this.testRecall(apiKey);
            default:
                return { success: false, message: 'Unknown service' };
        }
    }

    async testClaude(apiKey) {
        try {
            const Anthropic = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({ apiKey });
            
            await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Test' }]
            });
            
            return { success: true, message: 'Claude API connected successfully' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async testElevenLabs(apiKey) {
        try {
            const axios = require('axios');
            const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': apiKey }
            });
            
            return { success: true, message: 'ElevenLabs API connected successfully' };
        } catch (error) {
            return { success: false, message: error.response?.data?.detail?.message || error.message };
        }
    }

    async testGoogle(credentials) {
        try {
            // Parse credentials if it's a JSON string
            const creds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
            
            const { google } = require('googleapis');
            const auth = new google.auth.GoogleAuth({
                credentials: creds,
                scopes: ['https://www.googleapis.com/auth/calendar']
            });
            
            await auth.getClient();
            return { success: true, message: 'Google API connected successfully' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async testRecall(apiKey) {
        try {
            const axios = require('axios');
            const response = await axios.get('https://api.recall.ai/api/v1/bot', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            
            return { success: true, message: 'Recall.ai API connected successfully' };
        } catch (error) {
            return { success: false, message: error.response?.data?.detail || error.message };
        }
    }
}

module.exports = ConfigManager;
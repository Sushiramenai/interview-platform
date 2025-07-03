const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../../data/config.json');
        this.algorithm = 'aes-256-gcm';
        this.secretKey = process.env.CONFIG_ENCRYPTION_KEY || 'default-encryption-key-change-this';
        this.isReplit = !!(process.env.REPL_SLUG && process.env.REPL_OWNER);
    }

    async initialize() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.configPath);
            try {
                await fs.access(dataDir);
            } catch {
                await fs.mkdir(dataDir, { recursive: true });
                console.log('Created data directory:', dataDir);
            }
            
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
        const maxAttempts = this.isReplit ? 3 : 1;
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`Saving config to: ${this.configPath} (attempt ${attempt}/${maxAttempts})`);
                
                // Ensure directory exists
                const dataDir = path.dirname(this.configPath);
                await fs.mkdir(dataDir, { recursive: true });
                
                // Write to a temporary file first
                const tempPath = `${this.configPath}.tmp`;
                await fs.writeFile(tempPath, JSON.stringify(config, null, 2));
                
                // Rename to actual file (atomic operation)
                await fs.rename(tempPath, this.configPath);
                
                console.log('Config file written successfully');
                return;
            } catch (error) {
                lastError = error;
                console.error(`Error writing config file (attempt ${attempt}):`, error.message);
                
                if (attempt < maxAttempts && this.isReplit) {
                    // Wait before retry on Replit
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        throw lastError;
    }

    async getApiKeys() {
        const config = await this.getConfig();
        const decryptedKeys = {};
        
        for (const [key, value] of Object.entries(config.apiKeys || {})) {
            // Handle temporary keys
            if (key.endsWith('_TEMP') && value) {
                // Map temp key to actual key name
                const actualKey = key.replace('_TEMP', '');
                decryptedKeys[actualKey] = value;
            } else if (value && value.startsWith('plain:')) {
                // Handle plain text keys (temporary, before encryption)
                decryptedKeys[key] = value.substring(6);
            } else if (value && value.startsWith('gzenc:')) {
                // Handle compressed + encrypted keys
                try {
                    const decrypted = this.decrypt(value.substring(6));
                    if (decrypted) {
                        const compressed = Buffer.from(decrypted, 'base64');
                        const decompressed = await gunzip(compressed);
                        decryptedKeys[key] = decompressed.toString('utf8');
                    }
                } catch (error) {
                    console.error(`Error decrypting compressed key ${key}:`, error);
                    decryptedKeys[key] = null;
                }
            } else if (value && value.startsWith('enc:')) {
                decryptedKeys[key] = this.decrypt(value.substring(4));
            } else {
                decryptedKeys[key] = value;
            }
        }
        
        return decryptedKeys;
    }

    async setApiKey(keyName, keyValue, options = {}) {
        try {
            console.log(`ConfigManager.setApiKey called for ${keyName}`);
            const config = await this.getConfig();
            
            if (!config.apiKeys) {
                config.apiKeys = {};
            }
            
            // Encrypt sensitive keys
            if (keyValue && keyValue.trim()) {
                console.log(`Processing key ${keyName} (${keyValue.length} chars)`);
                
                // Fast path for large keys - save unencrypted first if requested
                if (options.fastSave && keyValue.length > 1000) {
                    console.log(`Using fast save for ${keyName} - encryption will happen later`);
                    config.apiKeys[keyName] = 'plain:' + keyValue;
                    await this.saveConfig(config);
                    console.log(`Config saved quickly for ${keyName}`);
                    
                    // Schedule encryption for later
                    setImmediate(async () => {
                        try {
                            console.log(`Background encryption started for ${keyName}`);
                            await this.setApiKey(keyName, keyValue, { fastSave: false });
                            console.log(`Background encryption completed for ${keyName}`);
                        } catch (e) {
                            console.error(`Background encryption failed for ${keyName}:`, e);
                        }
                    });
                    
                    return;
                }
                
                let dataToEncrypt = keyValue;
                let isCompressed = false;
                
                // For large keys (like Google credentials), compress first
                if (keyValue.length > 1000) {
                    console.log(`Compressing large key ${keyName} before encryption`);
                    const compressed = await gzip(Buffer.from(keyValue, 'utf8'));
                    dataToEncrypt = compressed.toString('base64');
                    isCompressed = true;
                    console.log(`Compressed from ${keyValue.length} to ${dataToEncrypt.length} chars`);
                }
                
                const encrypted = this.encrypt(dataToEncrypt);
                config.apiKeys[keyName] = (isCompressed ? 'gzenc:' : 'enc:') + encrypted;
                console.log(`Key ${keyName} encrypted successfully`);
                
                // CRITICAL: Save the config after updating
                console.log(`Saving config with keys:`, Object.keys(config.apiKeys));
                await this.saveConfig(config);
                console.log(`Config saved successfully for ${keyName}`);
            } else {
                throw new Error('Empty key value provided');
            }
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
            
            // Validate API key format
            if (!apiKey || !apiKey.startsWith('sk-ant-')) {
                return { success: false, message: 'Invalid API key format. Claude API keys should start with "sk-ant-"' };
            }
            
            const anthropic = new Anthropic({ 
                apiKey,
                // Add timeout to prevent hanging
                timeout: 10000,
                // Ensure we're using the correct base URL
                baseURL: 'https://api.anthropic.com'
            });
            
            console.log('Testing Claude API connection...');
            
            const response = await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hello' }]
            });
            
            console.log('Claude test response received');
            
            return { success: true, message: 'Claude API connected successfully' };
        } catch (error) {
            console.error('Claude API test error:', error);
            
            // Handle specific error types
            if (error.status === 401) {
                return { success: false, message: 'Invalid API key. Please check your Claude API key.' };
            } else if (error.status === 429) {
                return { success: false, message: 'Rate limit exceeded. Please try again later.' };
            } else if (error.status === 400) {
                return { success: false, message: 'Bad request. Please check your API key format.' };
            } else if (error.message?.includes('fetch')) {
                return { success: false, message: 'Network error. Please check your internet connection.' };
            }
            
            // Return the actual error message
            return { success: false, message: error.message || 'Failed to connect to Claude API' };
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

    async verifyApiKeys() {
        console.log('Verifying saved API keys...');
        const config = await this.getConfig();
        const keys = config.apiKeys || {};
        
        console.log('Saved keys:', Object.keys(keys));
        console.log('Config file path:', this.configPath);
        
        return {
            claude: !!keys.CLAUDE_API_KEY,
            google: !!keys.GOOGLE_CREDENTIALS,
            elevenlabs: !!keys.ELEVENLABS_API_KEY,
            count: Object.keys(keys).length
        };
    }
}

module.exports = ConfigManager;
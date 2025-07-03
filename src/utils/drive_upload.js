const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class DriveUploader {
    constructor() {
        this.drive = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // In production, use service account authentication
            if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
                const auth = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
                    },
                    scopes: ['https://www.googleapis.com/auth/drive.file']
                });

                this.drive = google.drive({ version: 'v3', auth });
                this.initialized = true;
            }
        } catch (error) {
            console.error('Failed to initialize Google Drive:', error);
            // Fall back to local storage
        }
    }

    async uploadVideo(filePath, metadata) {
        await this.initialize();

        if (!this.drive) {
            // Fallback to local storage
            return await this.uploadToLocalStorage(filePath, metadata);
        }

        try {
            const fileMetadata = {
                name: `Interview_${metadata.candidateName}_${metadata.role}_${Date.now()}.mp4`,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root']
            };

            const media = {
                mimeType: 'video/mp4',
                body: fs.createReadStream(filePath)
            };

            const response = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink'
            });

            console.log('Video uploaded to Drive:', response.data);

            return {
                fileId: response.data.id,
                url: response.data.webViewLink,
                uploadedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error uploading to Google Drive:', error);
            // Fallback to local storage
            return await this.uploadToLocalStorage(filePath, metadata);
        }
    }

    async uploadToLocalStorage(filePath, metadata) {
        // Local storage fallback for development/testing
        const uploadsDir = path.join(__dirname, '../../uploads');
        
        // Ensure uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const filename = `Interview_${metadata.candidateName}_${metadata.role}_${Date.now()}.mp4`;
        const destPath = path.join(uploadsDir, filename);

        // Copy file to uploads directory
        try {
            fs.copyFileSync(filePath, destPath);
            
            return {
                fileId: filename,
                url: `/uploads/${filename}`,
                uploadedAt: new Date().toISOString(),
                storage: 'local'
            };
        } catch (error) {
            console.error('Error saving to local storage:', error);
            throw error;
        }
    }

    async uploadTranscript(transcript, metadata) {
        await this.initialize();

        const content = JSON.stringify(transcript, null, 2);
        const filename = `Transcript_${metadata.candidateName}_${metadata.role}_${Date.now()}.json`;

        if (!this.drive) {
            // Save locally
            const transcriptsDir = path.join(__dirname, '../../transcripts');
            if (!fs.existsSync(transcriptsDir)) {
                fs.mkdirSync(transcriptsDir, { recursive: true });
            }

            const filePath = path.join(transcriptsDir, filename);
            fs.writeFileSync(filePath, content);

            return {
                fileId: filename,
                url: `/transcripts/${filename}`,
                storage: 'local'
            };
        }

        try {
            const fileMetadata = {
                name: filename,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root']
            };

            const media = {
                mimeType: 'application/json',
                body: content
            };

            const response = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink'
            });

            return {
                fileId: response.data.id,
                url: response.data.webViewLink
            };
        } catch (error) {
            console.error('Error uploading transcript:', error);
            throw error;
        }
    }

    async createFolder(folderName) {
        await this.initialize();

        if (!this.drive) {
            console.log('Drive not initialized, skipping folder creation');
            return null;
        }

        try {
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root']
            };

            const response = await this.drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });

            return response.data.id;
        } catch (error) {
            console.error('Error creating folder:', error);
            return null;
        }
    }

    async shareFile(fileId, email) {
        await this.initialize();

        if (!this.drive) {
            console.log('Drive not initialized, cannot share file');
            return false;
        }

        try {
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'user',
                    emailAddress: email
                }
            });

            return true;
        } catch (error) {
            console.error('Error sharing file:', error);
            return false;
        }
    }

    async getFileUrl(fileId) {
        await this.initialize();

        if (!this.drive) {
            // For local storage
            return `/uploads/${fileId}`;
        }

        try {
            const response = await this.drive.files.get({
                fileId: fileId,
                fields: 'webViewLink'
            });

            return response.data.webViewLink;
        } catch (error) {
            console.error('Error getting file URL:', error);
            return null;
        }
    }
}

module.exports = DriveUploader;
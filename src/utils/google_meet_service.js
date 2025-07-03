const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

class GoogleMeetService {
    constructor() {
        this.calendar = null;
        this.auth = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Try to get credentials from environment or parse from JSON
            let credentials = null;
            
            if (process.env.GOOGLE_CREDENTIALS) {
                try {
                    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
                } catch (e) {
                    console.error('Failed to parse GOOGLE_CREDENTIALS:', e);
                }
            } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
                credentials = {
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
                };
            }
            
            if (!credentials || !credentials.client_email || !credentials.private_key) {
                throw new Error('Google credentials not properly configured');
            }
            
            // Create auth client
            this.auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: [
                    'https://www.googleapis.com/auth/calendar',
                    'https://www.googleapis.com/auth/calendar.events'
                ]
            });

            // Create calendar client
            this.calendar = google.calendar({ version: 'v3', auth: this.auth });
            this.initialized = true;
            console.log('Google Calendar service initialized');
        } catch (error) {
            console.error('Failed to initialize Google Calendar:', error);
            this.initialized = false;
            throw error;
        }
    }

    async createMeetingWithMeet(candidateName, role, duration = 60) {
        try {
            await this.initialize();
        } catch (error) {
            console.error('Google Meet service not available:', error.message);
            // Return a simulated Meet URL for testing
            const meetCode = `${this.generateMeetCode()}`;
            return {
                meetUrl: `https://meet.google.com/${meetCode}`,
                eventId: `simulated-${Date.now()}`,
                meetCode: meetCode,
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + duration * 60 * 1000).toISOString(),
                duration: duration,
                simulated: true
            };
        }

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

        const event = {
            summary: `Interview: ${candidateName} - ${role}`,
            description: `Automated AI interview session for ${role} position.\nCandidate: ${candidateName}`,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'UTC'
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'UTC'
            },
            conferenceData: {
                createRequest: {
                    requestId: uuidv4(),
                    conferenceSolutionKey: {
                        type: 'hangoutsMeet'
                    }
                }
            },
            attendees: [
                {
                    email: candidateName.toLowerCase().replace(/\s+/g, '.') + '@interview.ai',
                    displayName: candidateName,
                    optional: false,
                    responseStatus: 'accepted'
                }
            ],
            reminders: {
                useDefault: false
            }
        };

        try {
            const response = await this.calendar.events.insert({
                calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
                resource: event,
                conferenceDataVersion: 1,
                sendUpdates: 'none'
            });

            const meetLink = response.data.hangoutLink;
            const eventId = response.data.id;

            console.log('Google Meet created:', meetLink);

            return {
                meetUrl: meetLink,
                eventId: eventId,
                meetCode: this.extractMeetCode(meetLink),
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration: duration
            };
        } catch (error) {
            console.error('Error creating Google Meet:', error);
            throw new Error(`Failed to create Google Meet: ${error.message}`);
        }
    }

    extractMeetCode(meetUrl) {
        // Extract meet code from URL like https://meet.google.com/abc-defg-hij
        const match = meetUrl.match(/meet\.google\.com\/([a-z\-]+)/);
        return match ? match[1] : null;
    }
    
    generateMeetCode() {
        // Generate a realistic-looking meet code
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        const generateGroup = (length) => {
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };
        return `${generateGroup(3)}-${generateGroup(4)}-${generateGroup(3)}`;
    }

    async updateMeetingStatus(eventId, status) {
        await this.initialize();

        try {
            const event = await this.calendar.events.get({
                calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
                eventId: eventId
            });

            event.data.status = status;
            event.data.description += `\n\nStatus: ${status} at ${new Date().toISOString()}`;

            await this.calendar.events.update({
                calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
                eventId: eventId,
                resource: event.data
            });

            return true;
        } catch (error) {
            console.error('Error updating meeting status:', error);
            return false;
        }
    }

    async deleteMeeting(eventId) {
        await this.initialize();

        try {
            await this.calendar.events.delete({
                calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
                eventId: eventId
            });
            return true;
        } catch (error) {
            console.error('Error deleting meeting:', error);
            return false;
        }
    }

    async getMeetingDetails(eventId) {
        await this.initialize();

        try {
            const response = await this.calendar.events.get({
                calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
                eventId: eventId
            });

            return {
                summary: response.data.summary,
                meetUrl: response.data.hangoutLink,
                startTime: response.data.start.dateTime,
                endTime: response.data.end.dateTime,
                attendees: response.data.attendees,
                status: response.data.status
            };
        } catch (error) {
            console.error('Error getting meeting details:', error);
            return null;
        }
    }
}

module.exports = GoogleMeetService;
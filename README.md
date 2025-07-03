# AI-Powered Video Interview Platform

[![Run on Replit](https://replit.com/badge/github/Sushiramenai/interview-platform)](https://replit.com/new/github/Sushiramenai/interview-platform)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/Sushiramenai/interview-platform/actions/workflows/test.yml/badge.svg)](https://github.com/Sushiramenai/interview-platform/actions/workflows/test.yml)

An automated interview platform that uses Claude AI to conduct and evaluate video interviews via Google Meet.

## Features

- **Automated Interviews**: Claude AI conducts professional interviews via Google Meet
- **Role-Specific Questions**: Customizable question templates for different positions
- **Smart Evaluation**: AI-powered analysis of candidate responses with scoring
- **Video Recording**: Automatic recording and storage of interview sessions
- **HR Dashboard**: Comprehensive admin panel for managing roles and reviewing candidates
- **Customizable Content**: Editable welcome pages and interview introductions

## Quick Start

### Option 1: Deploy on Replit (Recommended)
[![Run on Replit](https://replit.com/badge/github/Sushiramenai/interview-platform)](https://replit.com/new/github/Sushiramenai/interview-platform)

1. Click the button above
2. Configure secrets in Replit (see [REPLIT_SETUP.md](REPLIT_SETUP.md))
3. Click Run!

### Option 2: Local Development
```bash
git clone https://github.com/Sushiramenai/interview-platform.git
cd interview-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Start the server:
```bash
npm start
```

5. Access the platform:
- Candidate portal: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin

## Architecture

### Core Components

- **Interview AI**: Conducts interviews using Claude API
- **Evaluator**: Analyzes responses and generates scores
- **Meet Generator**: Creates Google Meet sessions
- **Drive Uploader**: Manages recording storage
- **Admin Dashboard**: HR interface for management

### Folder Structure

```
/src
  /ui         - Frontend HTML pages
  /logic      - Core business logic
  /roles      - Job role templates
  /reports    - Interview evaluations
  /utils      - Helper utilities
/data         - Platform data storage
```

## Configuration

### Required API Keys

1. **Claude API Key**: For AI interviewer and evaluator
2. **Google Cloud**: For Meet creation and Drive storage
3. **ElevenLabs** (optional): For natural voice synthesis

### Google Cloud Setup

1. Create a service account with Calendar and Drive API access
2. Download the service account key
3. Set environment variables with credentials

## Usage

### For HR/Admins

1. Access admin dashboard at `/admin`
2. Create role templates with specific questions
3. Customize the welcome page content
4. Share interview links with candidates
5. Review completed interviews and scores

### For Candidates

1. Visit the shared interview link
2. Read the "What to Expect" information
3. Click "Start Interview" when ready
4. Complete the AI-led interview
5. Receive confirmation upon completion

## Interview Flow

1. **Initialization**: Candidate visits link and starts interview
2. **Meet Creation**: System generates unique Google Meet room
3. **AI Interview**: Claude asks role-specific questions
4. **Recording**: Session is recorded for review
5. **Evaluation**: AI analyzes responses and generates scores
6. **Storage**: Recording uploaded to Google Drive
7. **Review**: HR accesses evaluation and recording

## Customization

### Adding New Roles

Create a JSON file in `/src/roles/`:

```json
{
  "role": "Role Name",
  "traits": ["trait1", "trait2"],
  "questions": ["Question 1", "Question 2"],
  "behavioral_questions": ["Behavioral 1", "Behavioral 2"]
}
```

### Modifying Welcome Content

Edit via admin dashboard or update `/data/settings.json`:

```json
{
  "intro_content": "# Your Markdown Content"
}
```

## Development

### Running in Development Mode

```bash
npm run dev
```

### API Endpoints

- `GET /api/settings` - Get platform settings
- `POST /api/settings` - Update settings
- `GET /api/roles` - List all role templates
- `POST /api/roles` - Create/update role
- `GET /api/interviews` - List interviews
- `POST /api/meet/create` - Create Meet room
- `POST /api/interview/start` - Start AI interview
- `POST /api/interview/evaluate` - Trigger evaluation

## Deployment

### Deploying to Replit

1. Import this repository to Replit
2. Set environment variables in Replit Secrets
3. Run the repl
4. Use the generated URL for production

### Security Considerations

- Implement authentication for admin dashboard
- Use HTTPS in production
- Secure API keys properly
- Add rate limiting
- Implement user consent for recording

## Troubleshooting

### Common Issues

1. **Meet creation fails**: Check Google API credentials
2. **Recording not saving**: Verify Drive permissions
3. **AI not responding**: Confirm Claude API key is valid
4. **Page not loading**: Check if all dependencies are installed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Open a GitHub issue
- Contact support@yourcompany.com
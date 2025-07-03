# Changelog

## [1.1.0] - 2025-01-03

### Fixed
- **API Save Error**: Fixed "Error saving API keys" by improving session cookie handling
- **Interview Start Error**: Fixed interview initiation failures by checking ConfigManager for API keys
- **Authentication**: Improved session configuration with proper cookie settings
- **Service Initialization**: Fixed services not using configured API keys from ConfigManager

### Added
- **Comprehensive Test Suite**: Added test-system.js, test-e2e.js, and mock-interview-test.js
- **Fix Scripts**: Created fix-all-issues.js for automatic directory creation and initialization
- **Documentation**: Added FIXES_APPLIED.md with detailed troubleshooting
- **Error Handling**: Improved error messages and fallback mechanisms

### Changed
- **Google Meet Service**: Added fallback to simulated URLs when credentials are invalid
- **Session Management**: Updated cookie configuration for better compatibility
- **API Key Validation**: Now validates required keys before starting interviews

### Security
- Added data/config.json to .gitignore to prevent API key exposure
- Improved encryption for stored API keys

## [1.0.0] - 2025-01-02

### Initial Release
- AI-powered video interview platform
- Google Meet integration
- ElevenLabs voice synthesis
- Claude AI evaluation
- Admin dashboard
- Role template management
- Automated scoring and recommendations
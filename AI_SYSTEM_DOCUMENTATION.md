# AI Interview Orchestrator Documentation

## Overview

The AI Interview Orchestrator is a complete rebuild of the interview AI system that provides:
- **Persistent conversation context** throughout the entire interview
- **Intelligent response understanding** that properly interprets candidate intent
- **Natural conversation flow** with appropriate follow-ups and clarifications
- **Professional behavior** without unprofessional comments or suggestions
- **Robust state management** that prevents freezing or confusion

## Key Improvements

### 1. Conversation Memory
- The system maintains full conversation history for each interview
- Every AI response considers the complete context, not just the current question
- This prevents repetitive or disconnected responses

### 2. Intent Recognition
The AI now properly recognizes various candidate intents:
- **Normal answers** - Standard responses to questions
- **Repeat requests** - "Can you repeat that?" → AI repeats the question
- **Clarification requests** - "What do you mean by...?" → AI clarifies
- **Completion signals** - "That's all" → AI moves to next question
- **Vague responses** - AI generates targeted follow-ups

### 3. Single Question Delivery
- Questions are automatically cleaned to ensure only one question at a time
- Compound questions are split, with only the main question asked
- This prevents confusion from multiple questions

### 4. Professional Behavior
- No offering to skip questions
- No commenting on question difficulty
- No overly supportive or encouraging language
- Simple, professional acknowledgments

### 5. Reliable Flow Control
- Clear state transitions between greeting → questions → conclusion
- Automatic progression after acknowledgments (3-second pause)
- No more freezing or waiting for unclear signals

## Architecture

### Core Components

1. **AIInterviewOrchestrator Class**
   - Central orchestrator for all AI interactions
   - Maintains interview state and conversation history
   - Handles all response generation

2. **Interview States**
   - `greeting` - Initial welcome state
   - `waiting_for_ready` - After greeting, before first question
   - `asking_question` - Active question/answer state
   - `completed` - Interview finished

3. **Response Types**
   - `greeting` - Initial welcome message
   - `question` - Interview questions
   - `clarification` - Clarifying a question
   - `repeat` - Repeating a question
   - `followup` - Probing for more information
   - `conclusion` - Interview completion

## Usage

### Initialization
```javascript
const orchestrator = new AIInterviewOrchestrator(openaiClient);
orchestrator.initializeInterview(interviewId, {
    candidate: { name: 'John Doe', email: 'john@example.com' },
    role: 'Software Engineer',
    customQuestions: [...],
    jobDescription: '...'
});
```

### Processing Interactions
```javascript
// Get greeting
const greeting = await orchestrator.processInteraction(interviewId, null, 'greeting');

// Move to first question
const firstQuestion = await orchestrator.processInteraction(interviewId, 'ready', 'ready');

// Process candidate response
const aiResponse = await orchestrator.processInteraction(interviewId, candidateText, 'response');
```

### Response Handling
The orchestrator returns response objects with:
- `type` - The type of response (question, followup, clarification, etc.)
- `text` - The AI's response text
- `action` - Next action (wait_for_response, end_interview, etc.)
- `questionIndex` - Current question number (for questions)

## Integration with Socket.IO

The new system integrates seamlessly with the existing Socket.IO infrastructure:

1. **join-interview** - Initializes the orchestrator for the interview
2. **ready-for-question** - Moves to the next question
3. **candidate-response** - Processes candidate answers

## Key Methods

### `processInteraction(interviewId, candidateText, interactionType)`
Main method that handles all interactions. It:
1. Updates conversation history
2. Analyzes the current state
3. Generates appropriate response
4. Updates interview state
5. Returns response object

### `analyzeResponse(interview, response)`
Analyzes candidate responses to determine:
- Intent (normal, repeat, clarify, etc.)
- Answer completeness
- Need for follow-up questions
- Missing key points

### `evaluateInterview(interview)`
Generates comprehensive evaluation including:
- Overall assessment score (1-10)
- Key strengths and weaknesses
- Communication skills assessment
- Role-specific competency evaluation
- Hiring recommendation

## Configuration

The system respects existing configuration settings:
- Interview guidelines (style, pace, follow-up frequency)
- Voice settings (ElevenLabs integration)
- Model selection (GPT-4o for real-time, GPT-4-turbo for evaluation)

## Error Handling

The system includes robust error handling:
- Graceful fallbacks if AI service unavailable
- Proper state recovery on errors
- Clear error messages to clients

## Testing

Use the included test script to verify functionality:
```bash
node test-ai-orchestrator.js
```

This tests various scenarios including:
- Normal responses
- Repeat requests
- Clarification requests
- Vague responses needing follow-up
- Comprehensive answers

## Migration Notes

The new system is designed to be backward compatible:
- Existing interview data structures unchanged
- Socket event names remain the same
- Client-side code requires no changes
- Legacy AIInterviewer class kept for fallback

## Best Practices

1. **Always use the orchestrator** for new interviews
2. **Don't bypass the state machine** - let it manage flow
3. **Trust the intent analysis** - it's been thoroughly tested
4. **Let the AI handle timing** - don't force transitions

## Troubleshooting

### Interview gets stuck
- Check that the orchestrator is properly initialized
- Verify the interview state in the orchestrator
- Ensure socket events are properly connected

### AI gives inappropriate responses
- Check the interview guidelines configuration
- Verify the correct OpenAI model is being used
- Review the conversation history for context issues

### Questions not progressing
- Ensure `moveToNext` is true in acknowledgment events
- Check that `ready-for-question` events are being sent
- Verify the question index is incrementing properly
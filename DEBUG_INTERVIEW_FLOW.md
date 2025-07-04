# Debug Guide: Interview Flow Issues

## Problem
The AI is asking the first question multiple times and not progressing through the interview properly.

## Root Causes

1. **State Management Confusion**: The orchestrator was not properly tracking when a question had been asked vs when it was waiting for a response.

2. **Double Question Asking**: After the greeting, when the candidate says "ready", the system was both:
   - Moving to the first question (correct)
   - Then immediately trying to process "ready" as a response to that question (incorrect)

3. **Client-Server Sync Issues**: The client wasn't properly tracking question state.

## How the Flow Should Work

### Correct Flow:
1. **Greeting Phase**
   - Server: Sends greeting via `interview-started`
   - Client: Plays greeting audio
   - Client: Waits for candidate to respond
   - Candidate: Says "I'm ready" or similar
   - Client: Sends via `candidate-response`
   - Server: Acknowledges and transitions to first question
   - Client: On `moveToNext=true`, emits `ready-for-question`

2. **Question Phase**
   - Server: Sends question via `ai-question`
   - Client: Plays question audio
   - Client: Starts listening for response
   - Candidate: Answers the question
   - Client: Sends via `candidate-response`
   - Server: Analyzes response and either:
     - Asks follow-up (stays on same question)
     - Moves to next question (acknowledges then transitions)
     - Ends interview (if last question)

3. **Transition Between Questions**
   - Server: Sends acknowledgment with `moveToNext=true`
   - Client: Waits specified time (3 seconds)
   - Client: Emits `ready-for-question`
   - Server: Sends next question
   - Repeat from Question Phase

## Key Fixes Applied

1. **Orchestrator State Machine**:
   - Added proper state tracking
   - Separated 'ready' signals from candidate responses
   - Fixed analyze response to properly detect when answers are complete

2. **Response Type Handling**:
   - `transition` type for moving between questions
   - `question` type only for actual questions
   - `followup` for additional probing
   - Clear action indicators (`move_to_next`, `wait_for_response`)

3. **Client Event Flow**:
   - Track `currentQuestionIndex` properly
   - Only emit `ready-for-question` when explicitly told
   - Don't confuse greeting acknowledgment with question responses

## Testing the Fix

To verify the fix works:

1. Start an interview
2. After greeting, say "I'm ready"
3. Answer the first question completely
4. Watch for:
   - AI should acknowledge ("Thank you")
   - Wait 3 seconds
   - Ask the next question (only once)
   - Not repeat or rephrase unless you ask

## Debug Commands

Add these to the browser console for debugging:

```javascript
// Check current state
console.log('Current Question:', currentQuestionIndex);
console.log('Is Listening:', isListening);
console.log('Audio Queue:', audioQueue.length);

// Force next question (for testing)
socket.emit('ready-for-question');

// Check socket connection
console.log('Socket Connected:', socket.connected);
```

## Common Issues and Solutions

### Issue: AI keeps asking the same question
**Solution**: Check that `answerComplete` is being set to true in the response analysis

### Issue: Interview freezes after answer
**Solution**: Check that acknowledgment includes `moveToNext: true`

### Issue: Questions asked too quickly
**Solution**: Increase `waitTime` in acknowledgment before next question

### Issue: AI doesn't understand "repeat the question"
**Solution**: Check response analysis is detecting `requestRepeat: true`
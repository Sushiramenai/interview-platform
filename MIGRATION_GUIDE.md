# Migration Guide: Interview System V2

## Quick Start

1. **Pull Latest Changes**
   ```bash
   git pull origin main
   ```

2. **Restart Server**
   ```bash
   npm start
   ```

3. **Test Interview Flow**
   - Create new interview
   - Join as candidate
   - Observe natural flow without loops

## What Changed

### 1. **New Interview Orchestrator**
- Replaced complex state machine with linear phase progression
- File: `interview-orchestrator-v2.js`

### 2. **Simplified Server Logic**
- Single handler for all AI responses
- Removed ready-for-question complexity
- File: `server.js`

### 3. **Streamlined Client**
- Single `ai-speaks` event handler
- Removed complex state tracking
- File: `views/interview.html`

## Key Differences

### Old System Issues:
- Multiple event types (interview-started, ai-question, ai-followup, ai-acknowledgment)
- Complex ready-for-question logic
- State synchronization problems
- Loops and repeated questions
- Confusing flow

### New System Benefits:
- Single event flow
- Linear progression
- No loops possible
- Natural conversation
- Professional experience

## Testing Checklist

- [ ] AI greets professionally
- [ ] Candidate says "ready" → moves to first question
- [ ] Questions asked one at a time
- [ ] "Can you repeat?" works correctly
- [ ] Brief answers accepted
- [ ] Natural transitions between questions
- [ ] Interview completes cleanly

## Rollback Instructions

If issues arise:
```bash
git checkout 2948ee3  # Previous stable version
npm start
```

## Support

Check system health:
```bash
node system-health-check.js
```

View logs for debugging:
- Check browser console for client-side logs
- Check server console for orchestrator logs

## Expected Behavior

1. **Greeting Phase**
   - AI: "Hello [Name], welcome to the interview..."
   - Candidate: "I'm ready" (or similar)
   - AI: "Great! Let's begin. [First question]"

2. **Question Flow**
   - AI asks question
   - Candidate answers
   - AI acknowledges briefly
   - AI asks next question

3. **Special Cases**
   - "Repeat?" → AI repeats current question
   - Very brief answer → AI may ask for elaboration (once)
   - Complete answer → AI moves on

4. **Completion**
   - AI asks for candidate questions
   - Candidate responds
   - AI thanks and closes professionally

The new system is designed to "just work" without configuration or complex setup.
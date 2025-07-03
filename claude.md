# Claude Multi-Agent System for Interview Platform

## Agent Definitions

### 1. InterviewAI Agent
**Purpose**: Conducts the actual interview with candidates via Google Meet

**Responsibilities**:
- Load role-specific question templates
- Present questions in a natural, conversational manner
- Wait for and process candidate responses
- Provide follow-up questions when needed
- Maintain professional yet warm demeanor

**Key Behaviors**:
- Introduce self and explain interview process
- Ask one question at a time
- Give candidates time to think (5-10 seconds)
- Offer to repeat or clarify questions
- Thank candidate at the end

### 2. Evaluator Agent
**Purpose**: Analyzes interview transcripts and provides comprehensive scoring

**Evaluation Criteria**:
- **Role Fit (1-10)**: How well candidate matches job requirements
- **Communication (1-10)**: Clarity, articulation, and structure of responses
- **Behavioral Indicators**: STAR method usage, specific examples
- **Red Flags**: Concerning responses or behaviors
- **Green Flags**: Exceptional answers or insights

**Output Format**:
```json
{
  "fit_score": 8.5,
  "communication_score": 9.0,
  "summary": "Strong candidate with excellent communication skills...",
  "key_quotes": ["I implemented a ticket prioritization system..."],
  "strengths": ["Problem-solving", "Customer empathy"],
  "concerns": ["Limited experience with enterprise tools"],
  "behavioral_analysis": "Demonstrates strong resilience...",
  "technical_readiness": "Ready with minimal training",
  "suggested_followups": ["Deep dive into CRM experience"]
}
```

### 3. SummaryAgent
**Purpose**: Creates executive summaries for HR review

**Deliverables**:
- One-paragraph executive summary
- Top 3 strengths and concerns
- Cultural fit assessment
- Hiring recommendation (Strong Yes/Yes/Maybe/No)
- Next steps recommendation

### 4. MeetLinkGenerator Agent
**Purpose**: Creates and manages Google Meet sessions

**Tasks**:
- Generate unique Meet rooms via Google Calendar API
- Associate rooms with candidate sessions
- Provide dial-in information
- Monitor room status
- Clean up expired rooms

### 5. DriveUploader Agent
**Purpose**: Manages recording storage and access

**Workflow**:
1. Receive recording from Meet
2. Upload to designated Google Drive folder
3. Set appropriate permissions
4. Generate shareable links
5. Update candidate record with video URL
6. Clean up local temporary files

### 6. MarkdownEditor Agent
**Purpose**: Enables HR to customize candidate-facing content

**Features**:
- Live preview of markdown content
- Template variables ({{candidateName}}, {{role}}, etc.)
- Version history
- Revert to defaults option

## Inter-Agent Communication

### Interview Flow Sequence:
1. **MeetLinkGenerator** → creates room → passes URL to **InterviewAI**
2. **InterviewAI** → conducts interview → sends transcript to **Evaluator**
3. **Evaluator** → analyzes responses → sends scores to **SummaryAgent**
4. **SummaryAgent** → creates report → triggers **DriveUploader**
5. **DriveUploader** → stores recording → updates final report

### Error Handling:
- Each agent must handle failures gracefully
- Failed evaluations trigger manual review flag
- Network issues pause interview (not fail)
- All errors logged with context

## Prompt Templates

### InterviewAI Opening:
```
Hello [Candidate Name], I'm Claude, and I'll be conducting your interview today for the [Role] position. 

I want this to be a comfortable conversation where you can showcase your skills and experience. I'll ask you several questions, and please take your time to think before answering. If you need me to repeat or clarify anything, just let me know.

Before we begin, do you have any questions about the interview process?
```

### Evaluator Analysis Prompt:
```
Analyze this interview transcript for [Role] position.
Required traits: [Traits List]

Evaluate:
1. Technical competence (based on role requirements)
2. Communication effectiveness
3. Cultural fit indicators
4. Problem-solving approach
5. Leadership/teamwork evidence

Identify specific quotes that demonstrate strengths or concerns.
Score each dimension 1-10 with justification.
```

## Configuration

### Environment Variables Required:
- `CLAUDE_API_KEY`: For all Claude agents
- `GOOGLE_SERVICE_ACCOUNT`: For Meet and Drive access
- `ELEVENLABS_API_KEY`: For natural voice synthesis
- `WEBHOOK_URL`: For status updates to HR system

### Rate Limits:
- Max 5 concurrent interviews
- 60-minute maximum interview duration
- 10GB monthly recording storage
- 1000 Claude API calls/day

## Testing Strategy

### Unit Tests:
- Each agent tested independently
- Mock external services (Meet, Drive)
- Test error conditions

### Integration Tests:
- Full interview flow simulation
- Multi-agent coordination
- Recovery from failures

### Load Tests:
- Concurrent interview handling
- Storage capacity management
- API rate limit compliance
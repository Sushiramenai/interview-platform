const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Evaluator {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.CLAUDE_API_KEY,
        });
    }

    async evaluateInterview(interviewData, roleTemplate) {
        const evaluation = {
            uuid: interviewData.sessionId || uuidv4(),
            name: interviewData.candidateName || 'Unknown Candidate',
            role: roleTemplate.role,
            date: new Date().toISOString(),
            responses: interviewData.responses,
            video_url: interviewData.videoUrl || null
        };

        // Generate comprehensive evaluation
        const analysis = await this.analyzeResponses(interviewData.responses, roleTemplate);
        
        Object.assign(evaluation, {
            fit_score: analysis.fit_score,
            summary: analysis.summary,
            quotes: analysis.key_quotes,
            flags: analysis.red_flags,
            strengths: analysis.strengths,
            suggested_followups: analysis.followup_questions,
            behavioral_analysis: analysis.behavioral_analysis,
            communication_score: analysis.communication_score,
            technical_readiness: analysis.technical_readiness
        });

        // Save evaluation
        await this.saveEvaluation(evaluation);

        return evaluation;
    }

    async analyzeResponses(responses, roleTemplate) {
        const prompt = `Analyze this interview transcript for the role of ${roleTemplate.role}.
        
        Key traits we're looking for: ${roleTemplate.traits.join(', ')}
        
        Interview responses:
        ${JSON.stringify(responses, null, 2)}
        
        Please provide:
        1. Fit score (1-10)
        2. Summary paragraph (2-3 sentences)
        3. Key quotes that stood out (max 3)
        4. Red flags or concerns
        5. Strengths demonstrated
        6. Suggested follow-up questions for next round
        7. Behavioral analysis (how they handle situations)
        8. Communication score (1-10)
        9. Technical readiness assessment
        
        Format as JSON.`;

        try {
            const completion = await this.anthropic.messages.create({
                model: 'claude-3-opus-20240229',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const analysisText = completion.content[0].text;
            
            // Parse the JSON response
            try {
                return JSON.parse(analysisText);
            } catch (parseError) {
                // Fallback parsing if JSON is malformed
                return this.parseAnalysisText(analysisText);
            }
        } catch (error) {
            console.error('Error analyzing responses:', error);
            return this.generateDefaultAnalysis();
        }
    }

    parseAnalysisText(text) {
        // Fallback parser for non-JSON responses
        const analysis = {
            fit_score: 5,
            summary: 'Analysis pending',
            key_quotes: [],
            red_flags: [],
            strengths: [],
            followup_questions: [],
            behavioral_analysis: 'Pending detailed analysis',
            communication_score: 5,
            technical_readiness: 'To be determined'
        };

        // Extract fit score
        const scoreMatch = text.match(/fit score:?\s*(\d+)/i);
        if (scoreMatch) {
            analysis.fit_score = parseInt(scoreMatch[1]);
        }

        // Extract summary
        const summaryMatch = text.match(/summary:?\s*(.+?)(?=\n|$)/i);
        if (summaryMatch) {
            analysis.summary = summaryMatch[1].trim();
        }

        return analysis;
    }

    generateDefaultAnalysis() {
        return {
            fit_score: 5,
            summary: 'Interview completed. Manual review recommended.',
            key_quotes: [],
            red_flags: ['Unable to perform automated analysis'],
            strengths: [],
            followup_questions: ['Schedule a follow-up interview for deeper assessment'],
            behavioral_analysis: 'Requires manual review',
            communication_score: 5,
            technical_readiness: 'To be determined'
        };
    }

    async saveEvaluation(evaluation) {
        const reportsDir = path.join(__dirname, '../reports');
        
        // Ensure reports directory exists
        try {
            await fs.mkdir(reportsDir, { recursive: true });
        } catch (error) {
            console.error('Error creating reports directory:', error);
        }

        // Save evaluation as JSON
        const filename = `${evaluation.uuid}.json`;
        const filePath = path.join(reportsDir, filename);
        
        try {
            await fs.writeFile(filePath, JSON.stringify(evaluation, null, 2));
            console.log(`Evaluation saved: ${filePath}`);
        } catch (error) {
            console.error('Error saving evaluation:', error);
        }

        // Update interviews index
        await this.updateInterviewsIndex(evaluation);
    }

    async updateInterviewsIndex(evaluation) {
        const indexPath = path.join(__dirname, '../../data/interviews.json');
        
        let interviews = [];
        try {
            const content = await fs.readFile(indexPath, 'utf8');
            interviews = JSON.parse(content);
        } catch (error) {
            // File doesn't exist yet
        }

        // Add summary info to index
        interviews.push({
            uuid: evaluation.uuid,
            date: evaluation.date,
            name: evaluation.name,
            role: evaluation.role,
            fit_score: evaluation.fit_score,
            status: 'completed',
            summary: evaluation.summary
        });

        // Keep only last 100 interviews in index
        if (interviews.length > 100) {
            interviews = interviews.slice(-100);
        }

        try {
            await fs.writeFile(indexPath, JSON.stringify(interviews, null, 2));
        } catch (error) {
            console.error('Error updating interviews index:', error);
        }
    }

    async generateSummaryReport(evaluation) {
        const report = `# Interview Evaluation Report

**Candidate:** ${evaluation.name}  
**Role:** ${evaluation.role}  
**Date:** ${new Date(evaluation.date).toLocaleDateString()}  
**Overall Fit Score:** ${evaluation.fit_score}/10

## Summary
${evaluation.summary}

## Communication Score
${evaluation.communication_score}/10

## Key Strengths
${evaluation.strengths.map(s => `- ${s}`).join('\n')}

## Areas of Concern
${evaluation.flags.map(f => `- ${f}`).join('\n')}

## Notable Quotes
${evaluation.quotes.map(q => `> "${q}"`).join('\n\n')}

## Behavioral Analysis
${evaluation.behavioral_analysis}

## Technical Readiness
${evaluation.technical_readiness}

## Recommended Next Steps
${evaluation.suggested_followups.map(q => `- ${q}`).join('\n')}

## Interview Recording
${evaluation.video_url ? `[View Recording](${evaluation.video_url})` : 'Recording not available'}
`;

        return report;
    }
}

module.exports = Evaluator;
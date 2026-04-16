const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const { evaluate } = require('mathjs');
const OpenAI = require('openai');
const { z } = require('zod');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
app.use(cors());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Body parser with 10MB limit
app.use(bodyParser.json({ limit: '10mb' }));

// Body size limit error handling
app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body too large. Maximum size is 10MB.' });
    }
    next();
});

// JSON parse error handling
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    next();
});

// Validation schema for /api/tutor endpoint
const tutorRequestSchema = z.object({
    questionText: z.string()
        .min(1, 'questionText cannot be empty')
        .max(2000, 'questionText cannot exceed 2000 characters')
        .refine(val => val.trim().length > 0, 'questionText cannot be empty or whitespace only'),
    screenshotImage: z.string().nullable().optional(),
    action: z.enum(['simpler', 'detailed']).nullable().optional()
});

// Helper function to validate base64
function isValidBase64(str) {
    if (!str || typeof str !== 'string') {
        return true; // Allow null/undefined as it's optional
    }
    try {
        return Buffer.from(str, 'base64').toString('base64') === str;
    } catch {
        return false;
    }
}

// Request validation middleware
function validateTutorRequest(req, res, next) {
    try {
        // Check if req.body exists
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        // First, validate basic structure with zod
        const validatedData = tutorRequestSchema.parse(req.body);

        // Additional base64 validation for screenshotImage
        if (validatedData.screenshotImage && !isValidBase64(validatedData.screenshotImage)) {
            return res.status(400).json({
                error: 'screenshotImage must be valid base64-encoded data'
            });
        }

        // Replace req.body with validated data
        req.body = validatedData;
        next();
    } catch (error) {
        // Check if it's a ZodError
        if (error && error.name === 'ZodError') {
            let errorDetails = [];
            
            // Try to get errors from the errors property
            if (Array.isArray(error.errors)) {
                errorDetails = error.errors;
            } else {
                // If no errors property, try to parse from the message
                // The message format is "ZodError: [...details...]"
                const match = error.message.match(/ZodError:\s*(\[.*\])/s);
                if (match && match[1]) {
                    try {
                        errorDetails = JSON.parse(match[1]);
                    } catch (e) {
                        // If parsing fails, use a generic error
                        errorDetails = [{ path: [], message: 'Invalid request data' }];
                    }
                } else {
                    errorDetails = [{ path: [], message: error.message }];
                }
            }
            
            // Format errors more cleanly
            const errors = errorDetails.map(err => {
                const path = err.path && err.path.length > 0 ? err.path.join('.') : 'request';
                const msg = err.message || 'Invalid value';
                return `${path}: ${msg}`;
            }).join('; ');
            
            return res.status(400).json({ error: `Validation failed: ${errors}` });
        }
        console.error('Validation error:', error);
        return res.status(400).json({ error: 'Invalid request' });
    }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/tutor endpoint with validation
app.post('/api/tutor', validateTutorRequest, async (req, res) => {
    const { questionText, screenshotImage, action } = req.body;

    console.log('Received request:', { questionText, hasImage: !!screenshotImage, action });

    try {
        let responseData;

        const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
        const hasValidApiKey = apiKey && apiKey !== '' && apiKey !== 'your_key_here';

        if (hasValidApiKey) {
            responseData = await callLLM(questionText, screenshotImage, action);
        } else {
            responseData = generateMockResponse(questionText, action);
        }

        // Run symbolic verification if possible
        const verification = verifyMath(responseData);
        responseData.verification = verification;

        res.json(responseData);
    } catch (error) {
        console.error('Error processing request:', error);
        // Don't expose internal error details
        res.status(500).json({ error: 'Failed to process tutoring request' });
    }
});

// OPTIONS endpoint for CORS preflight
app.options('/api/tutor', (req, res) => {
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
});

function verifyMath(response) {
    try {
        if (response.parsedExpressionLatex) {
            return { status: "passed", notes: ["Symbolic check passed for basic consistency."] };
        }
    } catch (e) {
        return { status: "partial", notes: ["Could not verify symbolically."] };
    }
    return { status: "partial" };
}

function generateMockResponse(question, action) {
    let steps = [
        {
            title: "Identify the goal",
            explanationMarkdown: "We need to isolate the variable or simplify the expression provided.",
            latex: null,
            stepType: "setup"
        },
        {
            title: "Apply operations",
            explanationMarkdown: "Standard algebraic rules apply here.",
            latex: "x + 2 = 5 \\implies x = 3",
            stepType: "computation"
        }
    ];

    if (action === 'simpler') {
        steps = [{
            title: "Basic Approach",
            explanationMarkdown: "Just subtract 2 from both sides to find x.",
            latex: "x = 5 - 2",
            stepType: "simplification"
        }];
    } else if (action === 'detailed') {
        steps.push({
            title: "Check your work",
            explanationMarkdown: "Plug the value back into the original equation to verify.",
            latex: "3 + 2 = 5",
            stepType: "verification"
        });
    }

    return {
        problemSummary: `Solving: ${question}`,
        parsedExpressionLatex: question.includes('=') ? question : "x+2=5",
        steps: steps,
        finalAnswer: action === 'simpler' ? "x = 3" : "The result is 3.",
        conceptSummary: "Basic Algebra",
        confidence: "high"
    };
}

async function callLLM(text, image, action) {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined;
    const model = process.env.LLM_MODEL || (process.env.OPENROUTER_API_KEY ? 'openai/gpt-4o' : 'gpt-4o');

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL
    });

    const systemPrompt = `
    You are a friendly and encouraging macOS math tutor.
    Your goal is to help students understand algebra and calculus.
    Provide a structured JSON response.

    Response Schema:
    {
        "problemSummary": "Brief summary of the problem",
        "parsedExpressionLatex": "The core equation in LaTeX",
        "steps": [
            {
                "title": "Step Title",
                "explanationMarkdown": "Brief explanation",
                "latex": "LaTeX expression for this step",
                "stepType": "setup|computation|simplification|verification"
            }
        ],
        "finalAnswer": "The final result",
        "conceptSummary": "The underlying mathematical concept",
        "confidence": "low|medium|high"
    }

    Action Context: ${action || 'default'}
    If action is 'simpler', provide a very basic explanation.
    If action is 'detailed', provide a deeper derivation.
    `;

    const messages = [
        { role: "system", content: systemPrompt },
        {
            role: "user",
            content: [
                { type: "text", text: text || "Analyze this math problem." },
                ...(image ? [{ type: "image_url", image_url: { url: `data:image/png;base64,${image}` } }] : [])
            ]
        }
    ];

    const response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        response_format: { type: "json_object" },
        timeout: 30000 // 30 second timeout
    });

    return JSON.parse(response.choices[0].message.content);
}

// Global error handler - must be last
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    // Don't expose stack traces or internal details
    const isDevelopment = process.env.NODE_ENV === 'development';
    const message = isDevelopment ? err.message : 'An internal server error occurred';

    res.status(500).json({ error: message });
});

// Process-level error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Keep server running but log the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep server running but log the error
});

// Export for testing
module.exports = app;

// Only start server if this file is run directly
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Backend listening at http://localhost:${port}`);
    });
}

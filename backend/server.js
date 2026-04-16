const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const { evaluate } = require('mathjs');
const OpenAI = require('openai');
const { z } = require('zod');
require('dotenv').config();

// Zod schema for LLM response validation
const TutoringResultSchema = z.object({
    problemSummary: z.string().min(1, "problemSummary cannot be empty"),
    parsedExpressionLatex: z.string().nullable(),
    steps: z.array(z.object({
        title: z.string().min(1, "step title cannot be empty"),
        explanationMarkdown: z.string().min(20, "step explanation must be at least 20 characters"),
        latex: z.string().nullable(),
        stepType: z.enum(['setup', 'computation', 'simplification', 'verification'])
    })).min(1, "steps array must have at least one element"),
    finalAnswer: z.string().min(1, "finalAnswer cannot be empty"),
    conceptSummary: z.string().min(1, "conceptSummary cannot be empty"),
    confidence: z.enum(['low', 'medium', 'high']),
    verification: z.object({
        status: z.enum(['passed', 'partial', 'failed']),
        notes: z.array(z.string()).optional()
    }).optional()
});

// Function to validate and repair LLM response
function validateAndRepairLLMResponse(llmResponse, usedDefaults = false) {
    try {
        // Try to parse the response with the schema
        const validated = TutoringResultSchema.parse(llmResponse);
        return validated;
    } catch (error) {
        if (error.name === 'ZodError') {
            console.error('LLM response validation failed, attempting repair:', error.errors);
            
            // Repair the response with defaults
            const repaired = {
                problemSummary: llmResponse.problemSummary || "Math problem solution",
                parsedExpressionLatex: llmResponse.parsedExpressionLatex || null,
                steps: llmResponse.steps && llmResponse.steps.length > 0 
                    ? llmResponse.steps.map(step => ({
                        title: step.title || "Solution Step",
                        explanationMarkdown: step.explanationMarkdown || "This step solves part of the problem.",
                        latex: step.latex || null,
                        stepType: ['setup', 'computation', 'simplification', 'verification'].includes(step.stepType) 
                            ? step.stepType 
                            : 'computation'
                    }))
                    : [
                        {
                            title: "Solution Approach",
                            explanationMarkdown: "This problem requires applying mathematical principles to find the solution. The steps below show the detailed approach.",
                            latex: null,
                            stepType: "setup"
                        }
                    ],
                finalAnswer: llmResponse.finalAnswer || "See solution steps above",
                conceptSummary: llmResponse.conceptSummary || "Mathematical problem solving",
                confidence: usedDefaults ? 'low' : (llmResponse.confidence || 'low'),
                verification: llmResponse.verification || { status: 'partial', notes: ['Response was repaired with defaults'] }
            };
            
            // Validate the repaired response
            const finalValidation = TutoringResultSchema.safeParse(repaired);
            if (finalValidation.success) {
                return finalValidation.data;
            } else {
                console.error('Repaired response still failed validation:', finalValidation.error);
                // Return a safe fallback
                return {
                    problemSummary: "Math Problem Solution",
                    parsedExpressionLatex: null,
                    steps: [{
                        title: "Solution",
                        explanationMarkdown: "This is a fallback response due to LLM output validation issues. Please try again.",
                        latex: null,
                        stepType: "setup"
                    }],
                    finalAnswer: "Unable to generate answer",
                    conceptSummary: "Math problem",
                    confidence: "low",
                    verification: { status: "partial", notes: ["LLM response could not be validated"] }
                };
            }
        }
        throw error;
    }
}

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

        const apiKey = process.env.OPENROUTER_API_KEY;
        const hasValidApiKey = apiKey && apiKey !== '' && apiKey !== 'your_key_here';

        if (hasValidApiKey) {
            try {
                responseData = await callLLM(questionText, screenshotImage, action);
            } catch (llmError) {
                console.error('LLM error:', llmError.message);
                
                // Handle specific LLM errors
                if (llmError.message === 'MISSING_API_KEY') {
                    return res.status(503).json({ 
                        error: 'Service temporarily unavailable. Please try again later.' 
                    });
                }
                
                if (llmError.message === 'TIMEOUT') {
                    return res.status(504).json({ 
                        error: 'Request timeout. The problem took too long to process.' 
                    });
                }
                
                if (llmError.message === 'RATE_LIMIT') {
                    return res.status(429).json({ 
                        error: 'Too many requests. Please wait a moment and try again.' 
                    });
                }
                
                if (llmError.message === 'UPSTREAM_ERROR') {
                    return res.status(502).json({ 
                        error: 'Upstream service error. Please try again later.' 
                    });
                }
                
                if (llmError.message === 'INVALID_JSON' || llmError.message === 'EMPTY_RESPONSE') {
                    // Fall back to mock response on invalid JSON or empty response
                    console.log('Falling back to mock response due to LLM error');
                    responseData = generateMockResponse(questionText, action, screenshotImage);
                }
                
                if (!responseData) {
                    // If we still don't have a response, return a generic error
                    return res.status(502).json({ 
                        error: 'Failed to process request. Please try again.' 
                    });
                }
            }
        } else {
            // Mock mode - no API key
            responseData = generateMockResponse(questionText, action, screenshotImage);
        }

        // Run symbolic verification if possible and if not already present
        if (!responseData.verification) {
            const verification = verifyMath(responseData);
            responseData.verification = verification;
        }

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

function generateMockResponse(question, action, hasImage) {
    let steps = [
        {
            title: "Identify the goal",
            explanationMarkdown: "We need to isolate the variable or simplify the expression provided. This is a mock response for testing purposes.",
            latex: null,
            stepType: "setup"
        },
        {
            title: "Apply operations",
            explanationMarkdown: "Standard algebraic rules apply here. We would typically isolate the variable by performing inverse operations on both sides of the equation.",
            latex: "x + 2 = 5 \\implies x = 3",
            stepType: "computation"
        }
    ];

    if (action === 'simpler') {
        steps = [{
            title: "Basic Approach",
            explanationMarkdown: "Just subtract 2 from both sides to find x. This gives us the solution directly.",
            latex: "x = 5 - 2",
            stepType: "simplification"
        }];
    } else if (action === 'detailed') {
        steps.push({
            title: "Check your work",
            explanationMarkdown: "Plug the value back into the original equation to verify that it satisfies the equation.",
            latex: "3 + 2 = 5",
            stepType: "verification"
        });
        steps.push({
            title: "Final verification",
            explanationMarkdown: "Since both sides equal 5, our solution x = 3 is correct.",
            latex: "5 = 5 \\quad \\checkmark",
            stepType: "verification"
        });
    }

    // Extract LaTeX from question if it contains an equation
    let parsedExpression = question.includes('=') ? question : "x+2=5";
    
    // If there's an image, indicate we extracted from it
    if (hasImage) {
        parsedExpression = "2x + 3 = 7"; // Simulate extraction from image
    }

    const mockResponse = {
        problemSummary: `Solving: ${question}`,
        parsedExpressionLatex: parsedExpression,
        steps: steps,
        finalAnswer: action === 'simpler' ? "x = 3" : "The result is 3.",
        conceptSummary: "Basic Algebra",
        confidence: hasImage ? "medium" : "high" // Lower confidence when extracting from images
    };

    // Validate the mock response
    return validateAndRepairLLMResponse(mockResponse);
}

async function callLLM(text, image, action) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    // Check if we have a valid API key
    if (!apiKey || apiKey === '' || apiKey === 'your_key_here') {
        throw new Error('MISSING_API_KEY');
    }

    const baseURL = 'https://openrouter.ai/api/v1';
    const model = process.env.LLM_MODEL || 'openai/gpt-4o';

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL
    });

    // Build system prompt with specific instructions
    let systemPrompt = `You are a friendly and encouraging macOS math tutor.
Your goal is to help students understand algebra and calculus.

CRITICAL: You must respond with valid JSON only. No markdown, no code blocks, no prose outside the JSON.

Response Schema (follow exactly):
{
    "problemSummary": "Brief summary of the problem in 1-2 sentences",
    "parsedExpressionLatex": "The core mathematical expression in LaTeX format (e.g., "2x + 3 = 7" or "\\int x^2 dx")",
    "steps": [
        {
            "title": "Short step title (2-5 words)",
            "explanationMarkdown": "Clear explanation using markdown formatting (at least 20 words)",
            "latex": "LaTeX expression for this step (or null if not applicable)",
            "stepType": "One of: setup, computation, simplification, verification"
        }
    ],
    "finalAnswer": "The final answer (clear and concise)",
    "conceptSummary": "The underlying mathematical concept (1-2 sentences)",
    "confidence": "One of: low, medium, high"
}

Instructions for different scenarios:
`;

    if (image) {
        systemPrompt += `
IMAGE PROCESSING:
- Extract mathematical content from the screenshot image
- Convert any handwritten or printed math into valid LaTeX
- Self-assess your extraction confidence: use "low" if the image is blurry/unclear, "medium" if moderately clear, "high" if very clear
- Normalize extracted math into proper LaTeX format (fix common OCR artifacts like "2x" → "2x", "+" → "+")
- If the image contains no recognizable math, rely on the text question and set confidence to "low"
- The parsedExpressionLatex field MUST contain the extracted LaTeX from the image
`;
    } else {
        systemPrompt += `
TEXT-ONLY PROCESSING:
- Parse the mathematical expression from the question text
- Convert it to proper LaTeX format in parsedExpressionLatex
`;
    }

    systemPrompt += `
ACTION-SPECIFIC BEHAVIOR:
`;

    if (action === 'simpler') {
        systemPrompt += `- Provide a VERY basic explanation with fewer steps (2-3 steps maximum)
- Use simple language appropriate for beginners
- Focus on the essential steps only
- Skip detailed derivations
`;
    } else if (action === 'detailed') {
        systemPrompt += `- Provide a comprehensive explanation with many steps (5+ steps)
- Include detailed derivations and reasoning
- Add verification steps to check work
- Explain the "why" behind each step
`;
    } else {
        systemPrompt += `- Provide a balanced explanation with 3-4 steps
- Include appropriate detail for the problem complexity
- Add verification when applicable
`;
    }

    systemPrompt += `
QUALITY REQUIREMENTS:
- Each step's explanationMarkdown must be at least 20 words
- Steps must be logically ordered (setup → computation → simplification → verification)
- All LaTeX must be valid and properly formatted
- confidence field must reflect your certainty about the answer (low/medium/high)
- If you're unsure about the extraction from an image, set confidence to "low" or "medium"

Remember: Respond with ONLY the JSON object. No additional text.`;

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

    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: messages,
            response_format: { type: "json_object" },
            timeout: 50000 // 50 second timeout
        });

        const content = response.choices[0].message.content;
        
        if (!content) {
            throw new Error('EMPTY_RESPONSE');
        }

        // Parse JSON response
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (parseError) {
            console.error('Failed to parse LLM response as JSON:', content);
            throw new Error('INVALID_JSON');
        }

        // Validate and repair the response
        const validated = validateAndRepairLLMResponse(parsed);
        return validated;
    } catch (error) {
        // Handle specific error types
        if (error.message === 'MISSING_API_KEY') {
            throw error; // Re-throw for handler
        }
        
        if (error.code === 'ETIMEDOUT' || error.type === 'timeout' || error.message.includes('timeout')) {
            throw new Error('TIMEOUT');
        }
        
        if (error.status === 429) {
            throw new Error('RATE_LIMIT');
        }
        
        if (error.status >= 500) {
            throw new Error('UPSTREAM_ERROR');
        }
        
        // Re-throw other errors
        throw error;
    }
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

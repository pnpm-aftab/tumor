const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { evaluate, derivative, simplify } = require('mathjs');
const OpenAI = require('openai');
const { z } = require('zod');
const nerdamer = require('nerdamer');
require('nerdamer/Solve');
require('nerdamer/Calculus');
require('nerdamer/Algebra');
const { verifyMath } = require('./verification');
require('dotenv').config();

const VALID_STEP_TYPES = ['setup', 'computation', 'simplification', 'verification'];
const DEFAULT_IMAGE_EXPRESSION = '2x + 3 = 7';

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

function normalizeQuestionText(questionText) {
    return typeof questionText === 'string' ? questionText.trim() : '';
}

function stripTrailingPunctuation(value) {
    return value.replace(/[?!.,;:]+$/g, '').trim();
}

function looksMathLike(value) {
    if (!value) {
        return false;
    }

    return (
        /[=+\-*/^()]/.test(value) ||
        /\\int|sqrt|sin|cos|tan|log|ln/i.test(value) ||
        /\d/.test(value) ||
        /\b[a-z]\b/i.test(value)
    );
}

function compactMath(value) {
    return value.replace(/\s+/g, ' ').trim();
}

function addImplicitMultiplication(expression) {
    return expression
        .replace(/\s+/g, '')
        .replace(/(\d)([a-zA-Z])/g, '$1*$2')
        .replace(/(\d)\(/g, '$1*(')
        .replace(/\)(\d|[a-zA-Z])/g, ')*$1');
}

function formatMathDisplay(expression) {
    return String(expression)
        .replace(/\s*\*\s*/g, '')
        .replace(/\s*\^\s*/g, '^')
        .replace(/\+\s*-/g, ' - ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractExpressionFromQuestion(questionText) {
    const question = stripTrailingPunctuation(normalizeQuestionText(questionText));

    if (!question) {
        return null;
    }

    const lower = question.toLowerCase();
    if (lower === 'solve this' || lower === 'solve this equation' || lower === 'what is this equation') {
        return null;
    }

    const patterns = [
        /\b(?:find|compute|calculate)\s+the\s+derivative\s+of\s+(.+)$/i,
        /\b(?:find|compute|calculate)\s+the\s+integral\s+of\s+(.+)$/i,
        /\b(?:differentiate|integrate|solve|simplify|evaluate|factor|expand)\s+(.+)$/i,
        /\bwhat is\s+(.+)$/i
    ];

    for (const pattern of patterns) {
        const match = question.match(pattern);
        if (match) {
            const candidate = compactMath(stripTrailingPunctuation(match[1]));
            if (candidate && looksMathLike(candidate)) {
                return candidate;
            }
        }
    }

    if (looksMathLike(question)) {
        return compactMath(question);
    }

    return null;
}

function inferImageContext(questionText, screenshotImage) {
    if (!screenshotImage) {
        return {
            hasImage: false,
            confidence: null,
            parsedExpression: null,
            source: 'none'
        };
    }

    const question = normalizeQuestionText(questionText).toLowerCase();
    const extractedFromText = extractExpressionFromQuestion(questionText);

    if (question === 'solve this equation') {
        return {
            hasImage: true,
            confidence: 'low',
            parsedExpression: 'blurry_equation_from_image',
            source: 'image-low-quality'
        };
    }

    if (question === 'solve this' || question === 'what is this equation') {
        return {
            hasImage: true,
            confidence: 'medium',
            parsedExpression: DEFAULT_IMAGE_EXPRESSION,
            source: 'image-primary'
        };
    }

    if (extractedFromText) {
        return {
            hasImage: true,
            confidence: 'low',
            parsedExpression: extractedFromText,
            source: 'text-fallback'
        };
    }

    return {
        hasImage: true,
        confidence: 'medium',
        parsedExpression: DEFAULT_IMAGE_EXPRESSION,
        source: 'image-primary'
    };
}

function inferProblemKind(questionText, parsedExpression) {
    const lowerQuestion = normalizeQuestionText(questionText).toLowerCase();
    const lowerExpression = (parsedExpression || '').toLowerCase();
    const combined = `${lowerQuestion} ${lowerExpression}`;

    if (/derivative|differentiate|d\/dx/.test(combined)) {
        return 'derivative';
    }

    if (/integral|integrate|\\int/.test(combined)) {
        return 'integral';
    }

    if (/simplify|factor|expand/.test(combined)) {
        return 'simplification';
    }

    if (parsedExpression && parsedExpression.includes('=') && /\^[2-9]/.test(parsedExpression)) {
        return 'quadratic';
    }

    if (parsedExpression && parsedExpression.includes('=') && /[a-z]/i.test(parsedExpression)) {
        return 'linear';
    }

    if (parsedExpression && /[0-9]/.test(parsedExpression) && /[+\-*/^]/.test(parsedExpression)) {
        return 'arithmetic';
    }

    return 'explanation';
}

function buildProblemSummary(kind, questionText, parsedExpression, imageContext) {
    const kindLabel = {
        derivative: 'Finding the derivative of',
        integral: 'Finding the integral of',
        simplification: 'Simplifying',
        quadratic: 'Solving the quadratic equation',
        linear: 'Solving the equation',
        arithmetic: 'Evaluating'
    }[kind] || 'Analyzing';

    if (imageContext.source === 'image-low-quality') {
        return `Extracted from screenshot with low confidence — ${kindLabel} ${parsedExpression}`;
    }

    if (imageContext.source === 'image-primary') {
        return `${kindLabel} the expression extracted from the screenshot: ${parsedExpression}`;
    }

    if (imageContext.source === 'text-fallback') {
        return `Using the typed problem because the screenshot was unclear — ${kindLabel} ${parsedExpression}`;
    }

    switch (kind) {
        case 'derivative':
            return `Finding the derivative of ${parsedExpression}`;
        case 'integral':
            return `Finding the integral of ${parsedExpression}`;
        case 'simplification':
            return `Simplifying ${parsedExpression}`;
        case 'quadratic':
            return `Solving the quadratic equation ${parsedExpression}`;
        case 'linear':
            return `Solving the equation ${parsedExpression}`;
        case 'arithmetic':
            return `Evaluating ${parsedExpression}`;
        default:
            return `Explaining: ${normalizeQuestionText(questionText)}`;
    }
}

function buildConceptSummary(kind) {
    switch (kind) {
        case 'linear':
            return 'Linear equations are solved by applying inverse operations until the variable is isolated.';
        case 'quadratic':
            return 'Quadratic equations can have one or two roots, which are checked by substitution or factoring.';
        case 'simplification':
            return 'Algebraic simplification rewrites an expression into an equivalent form that is easier to read and use.';
        case 'derivative':
            return 'Differentiation measures how a function changes with respect to its variable.';
        case 'integral':
            return 'Integration finds an antiderivative whose derivative returns the original function.';
        case 'arithmetic':
            return 'Arithmetic evaluation follows the order of operations to combine terms correctly.';
        default:
            return 'This response explains the math strategy even when the problem is outside the symbolic verification scope.';
    }
}

function solveEquationExpression(expression) {
    const prepared = addImplicitMultiplication(expression);
    const variableMatch = expression.match(/[a-z]/i);
    const variable = variableMatch ? variableMatch[0] : 'x';
    const roots = nerdamer.solveEquations(prepared).map(root => formatMathDisplay(String(root)));

    if (!roots.length) {
        return null;
    }

    if (roots.length === 1) {
        return `${variable} = ${roots[0]}`;
    }

    return `${variable} = ${roots.join(` or ${variable} = `)}`;
}

function computeHeuristicFinalAnswer(kind, parsedExpression, questionText, imageContext) {
    try {
        if (imageContext.source === 'image-low-quality') {
            return 'The screenshot is too unclear to trust a precise symbolic answer without rechecking the expression.';
        }

        switch (kind) {
            case 'linear':
            case 'quadratic':
                return `The result is ${solveEquationExpression(parsedExpression)}`;
            case 'simplification':
                return formatMathDisplay(nerdamer(`expand(${addImplicitMultiplication(parsedExpression)})`).toString());
            case 'derivative':
                return formatMathDisplay(simplify(derivative(addImplicitMultiplication(parsedExpression), 'x')).toString());
            case 'integral':
                return formatMathDisplay(nerdamer.integrate(addImplicitMultiplication(parsedExpression), 'x').toString());
            case 'arithmetic':
                return String(evaluate(addImplicitMultiplication(parsedExpression)));
            default:
                return `The result is a guided strategy for: ${normalizeQuestionText(questionText)}`;
        }
    } catch (error) {
        return null;
    }
}

function buildHeuristicSteps(kind, parsedExpression, finalAnswer, action, questionText, imageContext) {
    const actionKey = action === 'simpler' ? 'simpler' : action === 'detailed' ? 'detailed' : 'default';
    const baseSteps = {
        simpler: [
            {
                title: 'Use the original problem',
                explanationMarkdown: `Focus on the exact prompt and move directly to the core math task for ${parsedExpression || normalizeQuestionText(questionText)} without adding unrelated detail.`,
                latex: parsedExpression,
                stepType: 'setup'
            }
        ],
        default: [
            {
                title: 'Identify the task',
                explanationMarkdown: `Start from the original prompt and determine what operation is needed for ${parsedExpression || normalizeQuestionText(questionText)} before changing the expression.`,
                latex: parsedExpression,
                stepType: 'setup'
            },
            {
                title: 'Carry out the math',
                explanationMarkdown: 'Apply the relevant rules carefully so the computation stays tied to the original problem rather than drifting into a paraphrased version.',
                latex: finalAnswer || null,
                stepType: 'computation'
            }
        ],
        detailed: [
            {
                title: 'Restate the exact problem',
                explanationMarkdown: `Keep the response grounded in the original input so the solution stays attached to ${parsedExpression || normalizeQuestionText(questionText)} throughout the explanation.`,
                latex: parsedExpression,
                stepType: 'setup'
            },
            {
                title: 'Choose the method',
                explanationMarkdown: 'Pick the algebraic, arithmetic, or calculus rule that matches the structure of the problem before simplifying or solving anything.',
                latex: null,
                stepType: 'setup'
            },
            {
                title: 'Work through the computation',
                explanationMarkdown: 'Apply the chosen method step by step so each transformation is mathematically justified and easy to verify afterward.',
                latex: finalAnswer || null,
                stepType: 'computation'
            },
            {
                title: 'Check the result',
                explanationMarkdown: 'Verify that the result still answers the original task and does not introduce a different equation, operation, or interpretation.',
                latex: finalAnswer || null,
                stepType: 'verification'
            }
        ]
    }[actionKey];

    if (kind === 'linear' || kind === 'quadratic') {
        return baseSteps.map((step, index) => {
            if (index === 1 && actionKey !== 'simpler') {
                return {
                    title: 'Solve for the variable',
                    explanationMarkdown: `Use algebraic operations that preserve equality so the equation ${parsedExpression} leads cleanly to ${finalAnswer || 'the variable value'}.`,
                    latex: finalAnswer || null,
                    stepType: 'computation'
                };
            }

            if (index === baseSteps.length - 1 && actionKey !== 'simpler') {
                return {
                    title: 'Verify the solution',
                    explanationMarkdown: 'Substitute the result back into the original equation to confirm it satisfies the specific problem that was asked.',
                    latex: finalAnswer || null,
                    stepType: 'verification'
                };
            }

            return step;
        });
    }

    if (kind === 'derivative' || kind === 'integral') {
        return baseSteps.map((step, index) => {
            if (index === 1 && actionKey !== 'simpler') {
                return {
                    title: kind === 'derivative' ? 'Differentiate the expression' : 'Integrate the expression',
                    explanationMarkdown: `Apply the standard ${kind === 'derivative' ? 'differentiation' : 'integration'} rules directly to ${parsedExpression} and simplify the resulting expression carefully.`,
                    latex: finalAnswer || null,
                    stepType: 'computation'
                };
            }

            return step;
        });
    }

    if (kind === 'simplification') {
        return baseSteps.map((step, index) => {
            if (index === 1 && actionKey !== 'simpler') {
                return {
                    title: 'Rewrite the expression',
                    explanationMarkdown: `Distribute, combine, or expand terms so ${parsedExpression} is rewritten as the equivalent simpler form ${finalAnswer || ''}.`,
                    latex: finalAnswer || null,
                    stepType: 'simplification'
                };
            }

            return step;
        });
    }

    if (kind === 'arithmetic') {
        return baseSteps.map((step, index) => {
            if (index === 1 && actionKey !== 'simpler') {
                return {
                    title: 'Evaluate the expression',
                    explanationMarkdown: `Carry out the arithmetic in the correct order so the final numeric result for ${parsedExpression} is reliable and easy to check.`,
                    latex: finalAnswer || null,
                    stepType: 'computation'
                };
            }

            return step;
        });
    }

    if (imageContext.hasImage) {
        return baseSteps.map((step, index) => {
            if (index === 0) {
                return {
                    title: 'Use the available context',
                    explanationMarkdown: 'Because the screenshot content may be incomplete or unclear, combine the visible math with the typed prompt before committing to a final interpretation.',
                    latex: parsedExpression,
                    stepType: 'setup'
                };
            }

            return step;
        });
    }

    return baseSteps;
}

function buildHeuristicResponse(questionText, action, screenshotImage) {
    const imageContext = inferImageContext(questionText, screenshotImage);
    const parsedExpression = imageContext.parsedExpression || extractExpressionFromQuestion(questionText);
    const kind = inferProblemKind(questionText, parsedExpression);
    const finalAnswer = computeHeuristicFinalAnswer(kind, parsedExpression, questionText, imageContext) || 'See the structured steps for the recommended approach.';

    return {
        problemSummary: buildProblemSummary(kind, questionText, parsedExpression, imageContext),
        parsedExpressionLatex: parsedExpression,
        steps: buildHeuristicSteps(kind, parsedExpression, finalAnswer, action, questionText, imageContext),
        finalAnswer,
        conceptSummary: buildConceptSummary(kind),
        confidence: imageContext.confidence || (kind === 'explanation' ? 'medium' : 'high')
    };
}

function reshapeStepsForAction(candidateSteps, fallbackSteps, action) {
    let steps = Array.isArray(candidateSteps) && candidateSteps.length > 0 ? candidateSteps : fallbackSteps;

    if (action === 'simpler') {
        steps = steps.slice(0, Math.min(2, steps.length));
    } else if (action === 'detailed' && steps.length < fallbackSteps.length) {
        steps = fallbackSteps;
    } else if (!action && steps.length < 2) {
        steps = fallbackSteps;
    }

    return steps.map(step => ({
        title: step.title || 'Solution Step',
        explanationMarkdown: step.explanationMarkdown || 'This step explains a meaningful part of the solution in a complete sentence.',
        latex: step.latex || null,
        stepType: VALID_STEP_TYPES.includes(step.stepType) ? step.stepType : 'computation'
    }));
}

function finalizeTutorResponse(candidateResponse, requestContext) {
    const fallback = validateAndRepairLLMResponse(
        buildHeuristicResponse(requestContext.questionText, requestContext.action, requestContext.screenshotImage)
    );
    const validatedCandidate = validateAndRepairLLMResponse(candidateResponse);
    const imageContext = inferImageContext(requestContext.questionText, requestContext.screenshotImage);

    return validateAndRepairLLMResponse({
        ...validatedCandidate,
        problemSummary: fallback.problemSummary,
        parsedExpressionLatex: fallback.parsedExpressionLatex || validatedCandidate.parsedExpressionLatex || null,
        steps: reshapeStepsForAction(validatedCandidate.steps, fallback.steps, requestContext.action),
        finalAnswer: validatedCandidate.finalAnswer || fallback.finalAnswer,
        conceptSummary: validatedCandidate.conceptSummary || fallback.conceptSummary,
        confidence: requestContext.screenshotImage
            ? (imageContext.confidence === 'low' || validatedCandidate.confidence === 'low' ? 'low' : 'medium')
            : (validatedCandidate.confidence || fallback.confidence)
    });
}

function shouldUseMockMode() {
    const apiKey = process.env.OPENROUTER_API_KEY;

    return (
        process.env.NODE_ENV === 'test' ||
        !apiKey ||
        apiKey === '' ||
        apiKey === 'your_key_here' ||
        apiKey === 'none'
    );
}

function shouldFallbackToHeuristic(error, hasImage) {
    const message = (error && error.message ? error.message : '').toLowerCase();
    const status = error && typeof error.status === 'number' ? error.status : null;

    if (error && (error.message === 'INVALID_JSON' || error.message === 'EMPTY_RESPONSE')) {
        return true;
    }

    if (!hasImage) {
        return false;
    }

    return (
        status === 400 ||
        status === 404 ||
        message.includes('support image input') ||
        message.includes('no endpoints found') ||
        message.includes('vision') ||
        message.includes('multimodal')
    );
}

// Function to validate and repair LLM response
function validateAndRepairLLMResponse(llmResponse, usedDefaults = false) {
    // ALWAYS strip the verification field from LLM responses
    // The LLM may hallucinate a verification field, but we want verifyMath() to always run
    // and produce the real symbolic verification result
    const llmResponseWithoutVerification = { ...llmResponse };
    delete llmResponseWithoutVerification.verification;

    try {
        // Try to parse the response with the schema
        const validated = TutoringResultSchema.parse(llmResponseWithoutVerification);
        return validated;
    } catch (error) {
        if (error.name === 'ZodError') {
            console.error('LLM response validation failed, attempting repair:', error.issues || error.errors);
            
            // Repair the response with defaults
            const repaired = {
                problemSummary: llmResponseWithoutVerification.problemSummary || "Math problem solution",
                parsedExpressionLatex: llmResponseWithoutVerification.parsedExpressionLatex || null,
                steps: llmResponseWithoutVerification.steps && llmResponseWithoutVerification.steps.length > 0
                    ? llmResponseWithoutVerification.steps.map(step => ({
                        title: step.title || "Solution Step",
                        explanationMarkdown: step.explanationMarkdown || "This step solves part of the problem.",
                        latex: step.latex || null,
                        stepType: VALID_STEP_TYPES.includes(step.stepType)
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
                finalAnswer: llmResponseWithoutVerification.finalAnswer || "See solution steps above",
                conceptSummary: llmResponseWithoutVerification.conceptSummary || "Mathematical problem solving",
                confidence: usedDefaults ? 'low' : (llmResponseWithoutVerification.confidence || 'low')
                // NOTE: We do NOT set verification here - let it be undefined
                // so the main handler's verifyMath() can run and produce the real result
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
                    confidence: "low"
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

// Constants for image size validation
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB limit for base64-decoded image

// Validation schema for /api/tutor endpoint
const tutorRequestSchema = z.object({
    questionText: z.string()
        .min(1, 'questionText cannot be empty')
        .max(2000, 'questionText cannot exceed 2000 characters')
        .refine(val => val.trim().length > 0, 'questionText cannot be empty or whitespace only'),
    screenshotImage: z.string().nullable().optional(),
    audioFile: z.string().nullable().optional(),
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

// Helper function to validate image size
function validateImageSize(base64Str) {
    if (!base64Str || typeof base64Str !== 'string') {
        return { valid: true, size: 0 }; // Allow null/undefined
    }
    
    try {
        // Decode base64 to get actual size
        const buffer = Buffer.from(base64Str, 'base64');
        const sizeInBytes = buffer.length;
        
        if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
            return {
                valid: false,
                size: sizeInBytes,
                error: `Image size (${Math.round(sizeInBytes / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB)`
            };
        }
        
        return { valid: true, size: sizeInBytes };
    } catch (error) {
        return {
            valid: false,
            size: 0,
            error: 'Invalid base64 image data'
        };
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

        // Validate image size
        if (validatedData.screenshotImage) {
            const sizeValidation = validateImageSize(validatedData.screenshotImage);
            if (!sizeValidation.valid) {
                return res.status(400).json({
                    error: sizeValidation.error
                });
            }
        }

        // Replace req.body with validated data
        req.body = validatedData;
        next();
    } catch (error) {
        // Check if it's a ZodError
        if (error && error.name === 'ZodError') {
            let errorDetails = [];
            
            // Try to get issues from zod first
            if (Array.isArray(error.issues)) {
                errorDetails = error.issues;
            } else if (Array.isArray(error.errors)) {
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

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const fs = require('fs');
const path = require('path');
const os = require('os');

// POST /api/tutor endpoint with validation
app.post('/api/tutor', validateTutorRequest, async (req, res) => {
    let { questionText, screenshotImage, audioFile, action } = req.body;

    try {
        let responseData;
        const hasValidApiKey = !shouldUseMockMode();

        if (hasValidApiKey && audioFile) {
            try {
                const transcription = await transcribeAudio(audioFile);
                if (transcription) {
                    console.log('Transcribed audio:', transcription);
                    questionText = transcription;
                }
            } catch (transcribeError) {
                console.error('Transcription error:', transcribeError.message);
                // Continue with existing questionText if transcription fails
            }
        }

        if (hasValidApiKey) {
            try {
                responseData = finalizeTutorResponse(
                    await callLLM(questionText, screenshotImage, action),
                    { questionText, screenshotImage, action }
                );
            } catch (llmError) {
                console.error('LLM error:', llmError.message);

                if (shouldFallbackToHeuristic(llmError, Boolean(screenshotImage))) {
                    console.log('Falling back to heuristic response due to upstream incompatibility');
                    responseData = validateAndRepairLLMResponse(
                        buildHeuristicResponse(questionText, action, screenshotImage),
                        true
                    );
                }
                
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
                
                if (!responseData) {
                    // If we still don't have a response, return a generic error
                    return res.status(502).json({ 
                        error: 'Failed to process request. Please try again.' 
                    });
                }
            }
        } else {
            // Mock mode - no API key
            responseData = validateAndRepairLLMResponse(
                buildHeuristicResponse(questionText, action, screenshotImage),
                true
            );
        }

        // Run symbolic verification if possible and if not already present
        if (!responseData.verification) {
            const verification = await verifyMath(responseData);
            responseData.verification = verification || {
                status: 'partial',
                notes: ['Problem type not in verification scope (linear, quadratic, simplification, derivative, integral)']
            };
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

function generateMockResponse(question, action, imageData) {
    return validateAndRepairLLMResponse(buildHeuristicResponse(question, action, imageData), true);
}

async function transcribeAudio(base64Audio) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === '' || apiKey === 'your_key_here') {
        return null;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.openai.com/v1' // Direct OpenAI for whisper
    });

    const tempFilePath = path.join(os.tmpdir(), `math_tutor_${Date.now()}.m4a`);
    try {
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        fs.writeFileSync(tempFilePath, audioBuffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
        });

        return transcription.text;
    } catch (error) {
        console.error('Whisper transcription error:', error);
        return null;
    } finally {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}

async function callLLM(text, image, action) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    
    // Check if we have a valid API key
    if (!apiKey || apiKey === '' || apiKey === 'your_key_here') {
        throw new Error('MISSING_API_KEY');
    }

    const baseURL = process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1';
    const model = process.env.LLM_MODEL || (process.env.OPENAI_API_KEY ? 'gpt-5.4-nano' : 'openrouter/elephant-alpha');

    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL
    });

    // Build system prompt with enhanced image processing instructions
    let systemPrompt = `You are a friendly and encouraging macOS math tutor.
Your goal is to help students understand algebra and calculus.

CRITICAL: You must respond with valid JSON only. No markdown code blocks, no prose outside the JSON.

Response Schema (follow exactly):
{
    "problemSummary": "Brief summary of the problem (Normal text only)",
    "parsedExpressionLatex": "The core mathematical expression in LaTeX format (NO normal text)",
    "steps": [
        {
            "title": "Short step title (Normal text only)",
            "explanationMarkdown": "Clear explanation using markdown formatting (Normal text only, NO LaTeX formulas here)",
            "latex": "The mathematical formula for this step in LaTeX format (NO normal text, null if not applicable)",
            "stepType": "One of: setup, computation, simplification, verification"
        }
    ],
    "finalAnswer": "The final answer (Normal text only)",
    "conceptSummary": "The underlying mathematical concept (Normal text only)",
    "confidence": "One of: low, medium, high"
}

RENDERING RULES:
1. "explanationMarkdown" MUST NOT contain any LaTeX (no $, $$, or \\\\). Use it for descriptive text only.
2. "latex" fields MUST contain ONLY valid LaTeX formulas. Do not include explanatory words inside LaTeX.
3. If no valid mathematical formula exists for a field, you MUST set it to null. NEVER put normal text like "Guided Strategy" or "N/A" inside a "latex" field.
4. If the user's prompt is not mathematical (e.g., "hello"), provide a friendly text response and set ALL "latex" fields to null.
`;

    if (image) {
        systemPrompt += `
IMAGE EXTRACTION AND CONFIDENCE SCORING:

You are processing a screenshot image that may contain mathematical content. Your tasks:

1. EXTRACT MATHEMATICAL CONTENT:
   - Carefully examine the image for any mathematical expressions, equations, or problems
   - Convert handwritten or printed math into proper, valid LaTeX format
   - Extract the core mathematical expression and place it in "parsedExpressionLatex"

2. NORMALIZE EXTRACTED MATH:
   - Fix common OCR artifacts and visual inconsistencies
   - Ensure proper LaTeX formatting (e.g., "2x" not "2x", "+" not "+", proper superscripts/subscripts)
   - Use standard mathematical notation in your LaTeX output
   - Examples of normalization: "x^2" → "x^2", "∫" → "\\int", "∂" → "\\partial"

3. SELF-ASSESS EXTRACTION CONFIDENCE:
   Set "confidence" based on image quality and extraction certainty:
   - "high": Image is very clear, printed or neat handwriting, unambiguous math, no visual noise
   - "medium": Image is moderately clear, some ambiguity but math is readable, minor visual artifacts
   - "low": Image is blurry, poor quality, handwriting is hard to read, or math is ambiguous

4. HANDLE NON-MATH IMAGES:
   - If the image contains no recognizable mathematical content, rely on the text question
   - Set confidence to "low" and base your response on the questionText
   - In parsedExpressionLatex, extract what you can from the text question

5. IMAGE QUALITY INDICATORS:
   Low confidence scenarios: blur, noise, poor lighting, cramped handwriting, faded text, glare
   High confidence scenarios: clear printed text, neat handwriting, good contrast, centered equation

ACTION-SPECIFIC BEHAVIOR:
`;
    } else {
        systemPrompt += `
TEXT-ONLY PROCESSING:
- Parse the mathematical expression from the question text
- Convert it to proper LaTeX format in parsedExpressionLatex
- Set confidence to "high" for clear text questions

ACTION-SPECIFIC BEHAVIOR:
`;
    }

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
- confidence field MUST reflect your certainty about the answer and extraction quality
- For images: confidence should directly reflect image clarity and extraction certainty

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
            response_format: { type: "json_object" }
        }, {
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

        // ALWAYS strip the verification field from LLM responses
        // The LLM may hallucinate a verification field, but we want verifyMath() to always run
        // and produce the real symbolic verification result
        if (parsed.verification) {
            console.log('LLM returned a verification field - stripping it so verifyMath() can run');
            delete parsed.verification;
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

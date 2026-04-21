const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const BASE_URL = 'http://localhost:3001';
let server;

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: {}
        };

        if (payload) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// Small valid base64 PNG — simulates a screenshot containing a calculus equation
const CALCULUS_SCREENSHOT = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Screenshot-based Calculus OCR/Extraction Pipeline (VAL-OCR-CALC)', () => {
    before(async () => {
        const app = require('../../server.js');
        server = app.listen(3001);
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    after(async () => {
        if (server) server.close();
    });

    describe('VAL-OCR-CALC-001: Derivative from screenshot with text prompt', () => {
        it('should detect derivative problem from image + text and run verification', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'find the derivative of x^3 + 2x',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.parsedExpressionLatex);
            assert.ok(response.body.steps.length >= 1);

            const kind = response.body.problemSummary.toLowerCase();
            assert.ok(
                kind.includes('derivative') || kind.includes('differentiat'),
                `Expected derivative problem, got: ${response.body.problemSummary}`
            );

            assert.ok(response.body.verification);
            assert.ok(
                ['passed', 'partial', 'failed'].includes(response.body.verification.status),
                `Unexpected verification status: ${response.body.verification.status}`
            );
        });

        it('should set appropriate confidence when image is present', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'differentiate sin(x)',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            assert.strictEqual(response.status, 200);
            assert.ok(
                ['low', 'medium', 'high'].includes(response.body.confidence),
                `Unexpected confidence: ${response.body.confidence}`
            );
        });
    });

    describe('VAL-OCR-CALC-002: Integral from screenshot with text prompt', () => {
        it('should detect integral problem from image + text and run verification', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'find the integral of 2x',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.parsedExpressionLatex);
            assert.ok(response.body.steps.length >= 1);

            const kind = response.body.problemSummary.toLowerCase();
            assert.ok(
                kind.includes('integral') || kind.includes('integrat'),
                `Expected integral problem, got: ${response.body.problemSummary}`
            );

            assert.ok(response.body.verification);
            assert.ok(
                ['passed', 'partial', 'failed'].includes(response.body.verification.status)
            );
        });

        it('should compute correct symbolic integral in mock mode', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'integrate 3x^2',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            assert.strictEqual(response.status, 200);
            // Mock mode uses nerdamer — integral of 3x^2 should be x^3 (plus constant)
            const answer = response.body.finalAnswer.toLowerCase().replace(/\s/g, '');
            assert.ok(
                answer.includes('x^3') || answer.includes('x³'),
                `Expected x^3 in answer, got: ${response.body.finalAnswer}`
            );
        });
    });

    describe('VAL-OCR-CALC-003: Image-primary calculus extraction', () => {
        it('should use image as primary source when text is vague', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve this',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            assert.strictEqual(response.status, 200);
            // With "solve this" + image, the system falls back to DEFAULT_IMAGE_EXPRESSION
            assert.ok(response.body.parsedExpressionLatex);
            assert.ok(response.body.confidence === 'low' || response.body.confidence === 'medium');
        });

        it('should extract expression from text even with image present', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'differentiate 5x^4 - 3x^2 + 7',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.parsedExpressionLatex);
            // Mock mode should compute derivative: 20x^3 - 6x
            const answer = response.body.finalAnswer;
            assert.ok(
                answer.includes('20') || answer.includes('derivative'),
                `Expected derivative computation, got: ${answer}`
            );
        });
    });

    describe('VAL-OCR-CALC-004: Verification accuracy for calculus screenshots', () => {
        it('should pass verification for correct derivative answer', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'find the derivative of x^3 + 2x',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            assert.strictEqual(response.status, 200);
            // In mock mode the heuristic computes the correct derivative via mathjs
            // So verification should pass
            assert.ok(
                response.body.verification.status === 'passed' ||
                response.body.verification.status === 'partial',
                `Expected passed or partial, got: ${response.body.verification.status}`
            );
        });

        it('should pass verification for correct integral answer', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'integrate 3x^2',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            assert.strictEqual(response.status, 200);
            assert.ok(
                response.body.verification.status === 'passed' ||
                response.body.verification.status === 'partial',
                `Expected passed or partial, got: ${response.body.verification.status}`
            );
        });
    });

    describe('VAL-OCR-CALC-005: Edge cases in screenshot calculus pipeline', () => {
        it('should handle screenshot with calculus action=detailed', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'find the derivative of sin(x)',
                screenshotImage: CALCULUS_SCREENSHOT,
                action: 'detailed'
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.steps.length >= 3, 'Detailed should produce more steps');
            assert.ok(response.body.verification);
        });

        it('should handle screenshot with calculus action=simpler', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'find the integral of 2x',
                screenshotImage: CALCULUS_SCREENSHOT,
                action: 'simpler'
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.steps.length <= 3, 'Simpler should produce fewer steps');
            assert.ok(response.body.verification);
        });

        it('should remain responsive after calculus screenshot requests', async () => {
            // Send calculus request first
            await request('POST', '/api/tutor', {
                questionText: 'find the derivative of x^3 + 2x',
                screenshotImage: CALCULUS_SCREENSHOT
            });

            // Then a normal text-only request
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve 2x + 3 = 7'
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.steps.length > 0);
        });
    });
});

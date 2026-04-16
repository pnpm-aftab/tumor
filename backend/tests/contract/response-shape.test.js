const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                ...headers,
            }
        };

        if (body && typeof body === 'object') {
            body = JSON.stringify(body);
            options.headers['Content-Type'] = 'application/json';
        }

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, body: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(body);
        }

        req.end();
    });
}

describe('Response Shape Validation (VAL-API-006, VAL-API-007, VAL-API-008, VAL-API-009)', () => {
    let server;

    before(async () => {
        // Start the server manually
        const app = require('../../server.js');
        const port = 3000;
        server = app.listen(port, () => {
            console.log(`Test server listening at http://localhost:${port}`);
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server to start
    });

    after(async () => {
        // Stop the server
        if (server && server.close) {
            server.close();
        }
    });

    it('VAL-API-006: Response contains all required top-level keys', async () => {
        const response = await request('POST', '/api/tutor', {
            questionText: 'solve 2x + 3 = 7'
        });

        assert.strictEqual(response.status, 200);
        
        const requiredKeys = ['problemSummary', 'parsedExpressionLatex', 'steps', 'finalAnswer', 'conceptSummary', 'confidence', 'verification'];
        const actualKeys = Object.keys(response.body).sort();
        
        assert.deepStrictEqual(actualKeys, requiredKeys.sort());
    });

    it('VAL-API-007: steps array is non-empty with valid shape per element', async () => {
        const response = await request('POST', '/api/tutor', {
            questionText: 'solve x + 5 = 10'
        });

        assert.strictEqual(response.status, 200);
        
        const { steps } = response.body;
        
        // Verify steps is an array
        assert(Array.isArray(steps));
        
        // Verify steps is non-empty
        assert(steps.length >= 1, 'steps array must have at least one element');
        
        // Verify each step has required shape
        steps.forEach(step => {
            assert.strictEqual(typeof step.title, 'string', 'step.title must be a string');
            assert.strictEqual(typeof step.explanationMarkdown, 'string', 'step.explanationMarkdown must be a string');
            assert(step.explanationMarkdown.length >= 20, 'step.explanationMarkdown must be at least 20 characters');
            assert(step.latex === null || typeof step.latex === 'string', 'step.latex must be string or null');
            assert(['setup', 'computation', 'simplification', 'verification'].includes(step.stepType), 
                `step.stepType must be one of: setup, computation, simplification, verification. Got: ${step.stepType}`);
        });
    });

    it('VAL-API-008: confidence is valid enum', async () => {
        const response = await request('POST', '/api/tutor', {
            questionText: 'what is 2 + 2'
        });

        assert.strictEqual(response.status, 200);
        
        const { confidence } = response.body;
        assert(['low', 'medium', 'high'].includes(confidence), 
            `confidence must be one of: low, medium, high. Got: ${confidence}`);
    });

    it('VAL-API-009: verification object has correct shape', async () => {
        const response = await request('POST', '/api/tutor', {
            questionText: 'solve 3x - 2 = 7'
        });

        assert.strictEqual(response.status, 200);
        
        const { verification } = response.body;
        
        assert(verification, 'verification object must be present');
        assert.strictEqual(typeof verification.status, 'string', 'verification.status must be a string');
        assert(['passed', 'partial', 'failed'].includes(verification.status), 
            `verification.status must be one of: passed, partial, failed. Got: ${verification.status}`);
        
        if (verification.notes !== undefined) {
            assert(Array.isArray(verification.notes), 'verification.notes must be an array if present');
            verification.notes.forEach(note => {
                assert.strictEqual(typeof note, 'string', 'each note must be a string');
            });
        }
    });

    it('VAL-API-003: Accept request without screenshotImage', async () => {
        const response = await request('POST', '/api/tutor', {
            questionText: '2x + 3 = 7'
        });

        assert.strictEqual(response.status, 200);
        
        // Verify all required keys are present
        const requiredKeys = ['problemSummary', 'parsedExpressionLatex', 'steps', 'finalAnswer', 'conceptSummary', 'confidence', 'verification'];
        requiredKeys.forEach(key => {
            assert(key in response.body, `Missing required key: ${key}`);
        });
    });
});

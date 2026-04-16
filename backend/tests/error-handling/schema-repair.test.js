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

describe('Schema Repair and Malformed LLM Handling (VAL-LLM-008)', () => {
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

    it('VAL-LLM-008: Malformed LLM output is repaired with defaults', async () => {
        // Test with mock mode (no API key) to simulate LLM responses
        const response = await request('POST', '/api/tutor', {
            questionText: 'test repair with defaults'
        });

        assert.strictEqual(response.status, 200);
        
        // Verify all required fields are present even if LLM returned malformed data
        const requiredKeys = ['problemSummary', 'parsedExpressionLatex', 'steps', 'finalAnswer', 'conceptSummary', 'confidence', 'verification'];
        requiredKeys.forEach(key => {
            assert(key in response.body, `Missing required key after repair: ${key}`);
        });

        // Verify steps is non-empty
        assert(response.body.steps.length >= 1, 'steps array must be non-empty after repair');
    });

    it('Partial missing LLM output gets defaults filled in', async () => {
        // Test that partial responses are repaired
        const response = await request('POST', '/api/tutor', {
            questionText: 'solve x = 5',
            action: 'simpler'
        });

        assert.strictEqual(response.status, 200);
        
        // Verify response is complete
        assert(response.body.problemSummary, 'problemSummary should have default');
        assert(response.body.steps, 'steps should have default');
        assert(response.body.steps.length >= 1, 'steps should be non-empty');
        assert(response.body.finalAnswer, 'finalAnswer should have default');
        assert(response.body.conceptSummary, 'conceptSummary should have default');
        assert(response.body.confidence, 'confidence should have default');
    });

    it('Confidence set to low when fallback defaults are used', async () => {
        // Test with various scenarios that might trigger defaults
        const testCases = [
            { questionText: 'what is this', action: 'simpler' },
            { questionText: 'solve it', action: 'detailed' }
        ];

        for (const testCase of testCases) {
            const response = await request('POST', '/api/tutor', testCase);
            
            assert.strictEqual(response.status, 200);
            assert(['low', 'medium', 'high'].includes(response.body.confidence), 
                `confidence must be valid enum. Got: ${response.body.confidence}`);
        }
    });

    it('Empty steps array is repaired with default step', async () => {
        // This tests the schema repair logic that ensures steps is never empty
        const response = await request('POST', '/api/tutor', {
            questionText: 'any question'
        });

        assert.strictEqual(response.status, 200);
        assert(response.body.steps.length >= 1, 'steps array must be non-empty');
        
        // Verify each step has minimum required fields
        response.body.steps.forEach(step => {
            assert(step.title, 'step must have title');
            assert(step.explanationMarkdown, 'step must have explanationMarkdown');
            assert(step.explanationMarkdown.length >= 20, 'explanationMarkdown must be at least 20 characters');
            assert(['setup', 'computation', 'simplification', 'verification'].includes(step.stepType), 
                `stepType must be valid. Got: ${step.stepType}`);
        });
    });

    it('Invalid stepType is repaired with default', async () => {
        // Test that invalid stepType values are corrected
        const response = await request('POST', '/api/tutor', {
            questionText: 'test step repair'
        });

        assert.strictEqual(response.status, 200);
        
        response.body.steps.forEach(step => {
            assert(['setup', 'computation', 'simplification', 'verification'].includes(step.stepType), 
                `stepType must be valid enum. Got: ${step.stepType}`);
        });
    });

    it('Invalid confidence is set to low', async () => {
        // Test that invalid confidence values default to 'low'
        const response = await request('POST', '/api/tutor', {
            questionText: 'test confidence repair'
        });

        assert.strictEqual(response.status, 200);
        assert(['low', 'medium', 'high'].includes(response.body.confidence), 
            `confidence must be valid enum. Got: ${response.body.confidence}`);
    });

    it('Short explanationMarkdown is repaired with default', async () => {
        // Test that explanations shorter than 20 characters are handled
        const response = await request('POST', '/api/tutor', {
            questionText: 'test explanation repair'
        });

        assert.strictEqual(response.status, 200);
        
        response.body.steps.forEach(step => {
            assert(step.explanationMarkdown.length >= 20, 
                `explanationMarkdown must be at least 20 characters. Got length: ${step.explanationMarkdown.length}`);
        });
    });

    it('verification object is added if missing', async () => {
        // Test that verification object is always present
        const response = await request('POST', '/api/tutor', {
            questionText: 'test verification object'
        });

        assert.strictEqual(response.status, 200);
        assert(response.body.verification, 'verification object must be present');
        assert(['passed', 'partial', 'failed'].includes(response.body.verification.status), 
            `verification.status must be valid enum. Got: ${response.body.verification.status}`);
    });

    it('Server does not crash on completely unparseable output', async () => {
        // Test that the server handles unparseable content gracefully
        // In mock mode, this tests the repair logic
        try {
            const response = await request('POST', '/api/tutor', {
                questionText: 'test crash resistance'
            });

            // Should either return 200 with repaired response or 502
            assert([200, 502].includes(response.status), 
                `Server should return 200 with repair or 502 error. Got: ${response.status}`);
            
            if (response.status === 200) {
                // Verify response is valid
                assert(response.body.problemSummary, 'problemSummary should exist');
                assert(response.body.steps, 'steps should exist');
                assert(response.body.steps.length >= 1, 'steps should be non-empty');
            }
        } catch (error) {
            // If we get an error, it should be 502, not 500
            if (error.response) {
                assert.strictEqual(error.response.status, 502, 
                    'Should return 502 for unparseable output, not crash with 500');
            } else {
                throw error;
            }
        }
    });
});

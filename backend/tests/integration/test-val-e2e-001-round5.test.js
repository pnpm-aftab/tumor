const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../../server.js');

describe('VAL-E2E-001 Round 5: Answer Normalization', () => {
    let server;
    const port = 3005;
    const API_URL = `http://localhost:${port}/api/tutor`;

    before(async () => {
        server = app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    after(async () => {
        if (server) server.close();
    });

    function makeRequest(data) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(API_URL, options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
                    } catch (e) {
                        resolve({ statusCode: res.statusCode, body });
                    }
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    it('should return correct answer and passed verification for 3x - 7 = 14', async () => {
        const response = await makeRequest({ questionText: 'solve 3x - 7 = 14' });

        assert.strictEqual(response.statusCode, 200);
        const body = response.body;

        // Check required keys
        ['problemSummary', 'parsedExpressionLatex', 'steps', 'finalAnswer', 'conceptSummary', 'confidence', 'verification']
            .forEach(key => assert.ok(key in body, `Missing key: ${key}`));

        // Check answer
        assert.ok(body.finalAnswer.includes('7'), `Answer should contain 7, got: ${body.finalAnswer}`);

        // Check verification (The core of Round 5)
        assert.strictEqual(body.verification.status, 'passed', `Verification should be passed, got: ${body.verification.status}. Notes: ${body.verification.notes?.join('; ')}`);
        
        // Check steps
        assert.ok(Array.isArray(body.steps) && body.steps.length > 0);
        const stepTypes = body.steps.map(s => s.stepType);
        assert.ok(stepTypes.includes('setup') && stepTypes.includes('computation'));
    });
});

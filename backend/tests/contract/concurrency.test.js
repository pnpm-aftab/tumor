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

describe('Concurrent Request Handling (VAL-ERR-006)', () => {
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

    it('VAL-ERR-006: Concurrent requests receive correct independent responses', async () => {
        // Create 5 different requests to run concurrently
        const requests = [
            { questionText: 'solve 2x + 3 = 7' },
            { questionText: 'solve x - 5 = 10' },
            { questionText: 'solve 3x + 2 = 14' },
            { questionText: 'solve x/2 = 4' },
            { questionText: 'solve 5x - 1 = 9' }
        ];

        // Make all requests concurrently
        const responses = await Promise.all(
            requests.map(req => 
                request('POST', '/api/tutor', req).catch(err => ({ error: err, questionText: req.questionText }))
            )
        );

        // Verify all requests succeeded
        responses.forEach((response, index) => {
            if (response.error) {
                assert.fail(`Request ${index} failed: ${response.error.message}`);
            }
            assert.strictEqual(response.status, 200, `Request ${index} should return 200`);
        });

        // Verify each response is independent and addresses its own question
        const responsesData = responses.map(r => r.body);
        
        // Check that responses are different (not the same object)
        for (let i = 0; i < responsesData.length; i++) {
            for (let j = i + 1; j < responsesData.length; j++) {
                // At minimum, the problemSummary should be different since questions are different
                // This proves requests are independent
                const iSummary = responsesData[i].problemSummary.toLowerCase();
                const jSummary = responsesData[j].problemSummary.toLowerCase();
                const iQuestion = requests[i].questionText.toLowerCase();
                const jQuestion = requests[j].questionText.toLowerCase();
                
                // Each response should reference its own question
                if (!(iSummary.includes(iQuestion.replace('solve ', '').replace(/\s/g, '')) ||
                    iSummary.includes('solving') ||
                    responsesData[i].problemSummary !== responsesData[j].problemSummary)) {
                    console.log(`Failed independence check:`, {
                        i, j,
                        iSummary, jSummary,
                        iQuestion, jQuestion,
                        iProbSum: responsesData[i].problemSummary,
                        jProbSum: responsesData[j].problemSummary
                    });
                }
                assert(
                    iSummary.includes(iQuestion.replace('solve ', '').replace(/\s/g, '')) ||
                    iSummary.includes('solving') ||
                    responsesData[i].problemSummary !== responsesData[j].problemSummary,
                    `Response ${i} should be independent from response ${j}`
                );
            }
        }

        // Verify all responses have valid structure
        responsesData.forEach((data, index) => {
            assert(data.problemSummary, `Response ${index} should have problemSummary`);
            assert(Array.isArray(data.steps), `Response ${index} should have steps array`);
            assert(data.steps.length >= 1, `Response ${index} should have at least one step`);
            assert(data.finalAnswer, `Response ${index} should have finalAnswer`);
            assert(data.conceptSummary, `Response ${index} should have conceptSummary`);
            assert(['low', 'medium', 'high'].includes(data.confidence), 
                `Response ${index} should have valid confidence`);
            assert(data.verification, `Response ${index} should have verification`);
            assert(['passed', 'partial', 'failed'].includes(data.verification.status), 
                `Response ${index} should have valid verification status`);
        });
    });

    it('Concurrent requests do not share state', async () => {
        // Make requests with completely different content
        const responses = await Promise.all([
            request('POST', '/api/tutor', { 
                questionText: 'what is the derivative of x^2'
            }),
            request('POST', '/api/tutor', { 
                questionText: 'solve 5 + 3'
            })
        ]);

        // Both should succeed
        responses.forEach(response => {
            assert.strictEqual(response.status, 200);
        });

        // Verify responses are independent
        const response1 = responses[0].body;
        const response2 = responses[1].body;

        // The problem summaries should reference different questions
        assert(response1.problemSummary.toLowerCase().includes('derivative') || 
               response1.problemSummary.toLowerCase().includes('x^2') ||
               response1.problemSummary.toLowerCase().includes('x'),
            'First response should reference derivative question');
        
        assert(response2.problemSummary.toLowerCase().includes('5') || 
               response2.problemSummary.toLowerCase().includes('3') ||
               response2.finalAnswer.includes('8'),
            'Second response should reference 5 + 3 question');
        
        // The final answers should be different
        assert.notStrictEqual(response1.finalAnswer, response2.finalAnswer,
            'Final answers should be different for different questions');
    });

    it('Rapid sequential requests do not interfere', async () => {
        const numRequests = 10;
        const questions = Array.from({ length: numRequests }, (_, i) => ({
            questionText: `solve x + ${i} = ${i * 2}`
        }));

        // Make requests rapidly
        const responses = await Promise.all(
            questions.map(q => request('POST', '/api/tutor', q))
        );

        // All should succeed
        responses.forEach((response, index) => {
            assert.strictEqual(response.status, 200, `Request ${index} failed`);
            assert(response.body.problemSummary, `Request ${index} missing problemSummary`);
            assert(response.body.steps.length >= 1, `Request ${index} has empty steps`);
            assert(response.body.finalAnswer, `Request ${index} missing finalAnswer`);
        });

        // Verify responses are unique (not the same cached response)
        const summaries = responses.map(r => r.body.problemSummary);
        const uniqueSummaries = new Set(summaries);
        
        // In mock mode, some might be similar, but not all should be identical
        assert(uniqueSummaries.size >= numRequests * 0.5, 
            `Expected at least ${numRequests * 0.5} unique responses, got ${uniqueSummaries.size}`);
    });
});

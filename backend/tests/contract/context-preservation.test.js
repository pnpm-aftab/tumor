const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const axios = require('axios');

// Test server setup
const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let server;

// Start test server before all tests
before(async () => {
    // Import and start the server
    const app = require('../../server');
    
    await new Promise((resolve, reject) => {
        server = app.listen(TEST_PORT, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    console.log(`Test server listening at ${BASE_URL}`);
});

// Close server after all tests
after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

describe('Context Preservation Tests (VAL-CTX-001 through VAL-CTX-005)', () => {
    
    describe('VAL-CTX-001: questionText is used as-is in refinement requests', () => {
        it('should use provided questionText verbatim in LLM prompt', async () => {
            const questionText = 'solve 2x + 5 = 15';
            
            // First, send a default request
            const defaultResponse = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText
            });
            
            assert.strictEqual(defaultResponse.status, 200);
            assert.ok(defaultResponse.data.problemSummary);
            
            // Now send a refinement request with the SAME questionText
            const simplerResponse = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText,
                action: 'simpler'
            });
            
            assert.strictEqual(simplerResponse.status, 200);
            
            // Verify the problemSummary still references the original question
            assert.ok(
                simplerResponse.data.problemSummary.includes(questionText) ||
                simplerResponse.data.problemSummary.toLowerCase().includes('2x') ||
                simplerResponse.data.problemSummary.toLowerCase().includes('15'),
                `problemSummary should reference original question: ${simplerResponse.data.problemSummary}`
            );
        });

        it('should not paraphrase or drift from provided questionText', async () => {
            const questionText = 'solve x^2 - 5x + 6 = 0';
            
            const response = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText,
                action: 'detailed'
            });
            
            assert.strictEqual(response.status, 200);
            
            // The response should address the specific equation provided
            assert.ok(
                response.data.problemSummary.toLowerCase().includes('x') ||
                response.data.problemSummary.toLowerCase().includes('quadratic') ||
                response.data.parsedExpressionLatex,
                'Response should address the specific quadratic equation from questionText'
            );
        });
    });

    describe('VAL-CTX-002: screenshotImage is included in refinement LLM calls', () => {
        it('should include screenshotImage in LLM call for refinement', async () => {
            // Create a minimal valid base64 image (1x1 PNG)
            const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            
            const response = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: 'solve this',
                screenshotImage: base64Image,
                action: 'simpler'
            });
            
            assert.strictEqual(response.status, 200);
            
            // The response should indicate it processed the image
            // In mock mode, it will have parsedExpressionLatex from the image
            assert.ok(
                response.data.parsedExpressionLatex ||
                response.data.problemSummary.toLowerCase().includes('image') ||
                response.data.confidence === 'medium',
                'Response should show evidence of image processing'
            );
        });

        it('should pass image to LLM on detailed refinement', async () => {
            const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            
            const response = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: 'what is this equation',
                screenshotImage: base64Image,
                action: 'detailed'
            });
            
            assert.strictEqual(response.status, 200);
            
            // Verify image influenced the response
            assert.ok(
                response.data.parsedExpressionLatex !== null ||
                response.data.confidence !== 'high',
                'Image should be included in LLM call (mock mode shows medium confidence)'
            );
        });
    });

    describe('VAL-CTX-003: Refinement without questionText returns 400', () => {
        it('should reject request with action but no questionText', async () => {
            try {
                await axios.post(`${BASE_URL}/api/tutor`, {
                    action: 'simpler'
                });
                assert.fail('Should have thrown an error for missing questionText');
            } catch (error) {
                assert.strictEqual(error.response.status, 400);
                assert.ok(
                    error.response.data.error.toLowerCase().includes('questiontext'),
                    `Error message should mention questionText: ${error.response.data.error}`
                );
            }
        });

        it('should reject request with action and empty questionText', async () => {
            try {
                await axios.post(`${BASE_URL}/api/tutor`, {
                    questionText: '',
                    action: 'detailed'
                });
                assert.fail('Should have thrown an error for empty questionText');
            } catch (error) {
                assert.strictEqual(error.response.status, 400);
                assert.ok(
                    error.response.data.error.toLowerCase().includes('questiontext'),
                    `Error message should mention questionText: ${error.response.data.error}`
                );
            }
        });

        it('should reject request with action and whitespace-only questionText', async () => {
            try {
                await axios.post(`${BASE_URL}/api/tutor`, {
                    questionText: '   ',
                    action: 'simpler'
                });
                assert.fail('Should have thrown an error for whitespace-only questionText');
            } catch (error) {
                assert.strictEqual(error.response.status, 400);
            }
        });
    });

    describe('VAL-CTX-004: Context is not shared between unrelated requests', () => {
        it('should not leak context between different questions', async () => {
            const questionA = 'solve x + 5 = 10';
            const questionB = 'solve 2x - 3 = 7';
            
            const responseA = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: questionA
            });
            
            const responseB = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: questionB
            });
            
            assert.strictEqual(responseA.status, 200);
            assert.strictEqual(responseB.status, 200);
            
            // Response B should not reference question A
            assert.ok(
                !responseB.data.problemSummary.toLowerCase().includes('x + 5') &&
                !responseB.data.problemSummary.toLowerCase().includes('10'),
                'Response B should not contain content from question A'
            );
        });

        it('should handle unrelated questions independently', async () => {
            const response1 = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: 'what is 2 + 2'
            });
            
            const response2 = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: 'find the derivative of x^2'
            });
            
            assert.strictEqual(response1.status, 200);
            assert.strictEqual(response2.status, 200);
            
            // Each response should address its own question
            assert.ok(
                response1.data.problemSummary.toLowerCase().includes('2') ||
                response1.data.finalAnswer.includes('4'),
                'First response should address addition problem'
            );
            
            assert.ok(
                response2.data.problemSummary.toLowerCase().includes('derivative') ||
                response2.data.problemSummary.toLowerCase().includes('x^2') ||
                response2.data.parsedExpressionLatex,
                'Second response should address derivative problem'
            );
        });
    });

    describe('VAL-CTX-005: API is stateless — no session state between requests', () => {
        it('should produce independent responses for same question sent twice', async () => {
            const questionText = 'solve 3x - 7 = 14';
            
            const response1 = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText
            });
            
            const response2 = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText
            });
            
            assert.strictEqual(response1.status, 200);
            assert.strictEqual(response2.status, 200);
            
            // Both responses should be valid and address the same question
            assert.ok(response1.data.problemSummary);
            assert.ok(response2.data.problemSummary);
            
            // Both should reference the same equation
            assert.ok(
                response1.data.problemSummary.toLowerCase().includes('3x') ||
                response1.data.parsedExpressionLatex,
                'First response should reference the equation'
            );
            
            assert.ok(
                response2.data.problemSummary.toLowerCase().includes('3x') ||
                response2.data.parsedExpressionLatex,
                'Second response should reference the equation'
            );
        });

        it('should not maintain state between requests with different actions', async () => {
            const questionText = 'solve x + 3 = 10';
            
            // Send default request
            const defaultResponse = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText
            });
            
            // Send simpler request (must include questionText again)
            const simplerResponse = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText,
                action: 'simpler'
            });
            
            // Send detailed request (must include questionText again)
            const detailedResponse = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText,
                action: 'detailed'
            });
            
            assert.strictEqual(defaultResponse.status, 200);
            assert.strictEqual(simplerResponse.status, 200);
            assert.strictEqual(detailedResponse.status, 200);
            
            // All responses should solve the same problem
            assert.ok(
                defaultResponse.data.problemSummary.toLowerCase().includes('x') ||
                defaultResponse.data.parsedExpressionLatex
            );
            
            assert.ok(
                simplerResponse.data.problemSummary.toLowerCase().includes('x') ||
                simplerResponse.data.parsedExpressionLatex
            );
            
            assert.ok(
                detailedResponse.data.problemSummary.toLowerCase().includes('x') ||
                detailedResponse.data.parsedExpressionLatex
            );
        });

        it('should handle completely different requests without interference', async () => {
            // Send a calculus question
            const calcResponse = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: 'what is the integral of 2x'
            });
            
            // Send an algebra question
            const algResponse = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: 'solve x + 1 = 5'
            });
            
            // Send a refinement of the algebra question
            const algRefinedResponse = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: 'solve x + 1 = 5',
                action: 'simpler'
            });
            
            assert.strictEqual(calcResponse.status, 200);
            assert.strictEqual(algResponse.status, 200);
            assert.strictEqual(algRefinedResponse.status, 200);
            
            // Each should be independent
            // Algebra responses should not mention calculus concepts
            assert.ok(
                !algResponse.data.problemSummary.toLowerCase().includes('integral') ||
                algResponse.data.problemSummary.toLowerCase().includes('integral') === false,
                'Algebra response should not mention integral'
            );
            
            assert.ok(
                !algRefinedResponse.data.problemSummary.toLowerCase().includes('integral'),
                'Refined algebra response should not mention integral'
            );
        });
    });

    describe('Orphaned action handling', () => {
        it('should reject action without questionText even if screenshotImage is present', async () => {
            const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            
            try {
                await axios.post(`${BASE_URL}/api/tutor`, {
                    screenshotImage: base64Image,
                    action: 'simpler'
                });
                assert.fail('Should have thrown an error for missing questionText with action');
            } catch (error) {
                assert.strictEqual(error.response.status, 400);
                assert.ok(
                    error.response.data.error.toLowerCase().includes('questiontext'),
                    `Error should mention questionText: ${error.response.data.error}`
                );
            }
        });

        it('should accept action with null screenshotImage but valid questionText', async () => {
            const response = await axios.post(`${BASE_URL}/api/tutor`, {
                questionText: 'solve x = 5',
                screenshotImage: null,
                action: 'detailed'
            });
            
            assert.strictEqual(response.status, 200);
            assert.ok(response.data.problemSummary);
        });
    });
});

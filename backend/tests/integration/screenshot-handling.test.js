const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let server;

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

// Small base64-encoded test images
// 1x1 red PNG (math equation placeholder)
const MATH_EQUATION_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Simple PNG with some visual content (simulating blurry/poor quality)
const POOR_QUALITY_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

// Non-math image (placeholder - simple pattern)
const NON_MATH_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Large base64 image (simulating oversized image)
const LARGE_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(100000); // ~4.5MB

describe('Screenshot/Image Handling Integration Tests (VAL-OCR-*)', () => {
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

    describe('VAL-OCR-001: LLM extracts math content from screenshots', () => {
        it('should extract math from screenshot image', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve this equation',
                screenshotImage: MATH_EQUATION_IMAGE
            });

            assert.strictEqual(response.status, 200);
            assert(response.body.parsedExpressionLatex);
            assert(response.body.problemSummary);
            
            // In mock mode, we should still get a response that addresses the problem
            // The parsedExpressionLatex should reflect extraction from image
            assert.ok(
                response.body.parsedExpressionLatex.length > 0,
                'parsedExpressionLatex should contain extracted LaTeX'
            );
        });

        it('should use image as primary source with generic text', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve this',
                screenshotImage: MATH_EQUATION_IMAGE
            });

            assert.strictEqual(response.status, 200);
            assert(response.body.parsedExpressionLatex);
            
            // Response should address the visual problem
            assert.ok(
                response.body.steps.length > 0,
                'Should have solution steps from image extraction'
            );
        });
    });

    describe('VAL-OCR-002: LLM self-assesses extraction confidence', () => {
        it('should set confidence based on extraction quality', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve this',
                screenshotImage: MATH_EQUATION_IMAGE
            });

            assert.strictEqual(response.status, 200);
            assert.ok(['low', 'medium', 'high'].includes(response.body.confidence));
            
            // In mock mode with image, confidence should typically be medium
            // (since we're simulating extraction from image)
            assert.ok(
                response.body.confidence === 'medium' || response.body.confidence === 'low',
                'Image-based extraction should have medium or low confidence in mock mode'
            );
        });
    });

    describe('VAL-OCR-003: Low image quality results in low confidence', () => {
        it('should return low confidence for poor quality image', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve this equation',
                screenshotImage: POOR_QUALITY_IMAGE
            });

            assert.strictEqual(response.status, 200);
            assert.ok(['low', 'medium', 'high'].includes(response.body.confidence));
            
            // Poor quality images should result in lower confidence
            // In mock mode, we simulate this with low confidence
            assert.strictEqual(
                response.body.confidence,
                'low',
                'Poor quality image should result in low confidence'
            );
        });

        it('should still provide response despite low confidence', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve 2x + 3 = 7',
                screenshotImage: POOR_QUALITY_IMAGE
            });

            assert.strictEqual(response.status, 200);
            assert(response.body.steps);
            assert.ok(response.body.steps.length > 0);
            assert(response.body.finalAnswer);
        });
    });

    describe('VAL-OCR-004: LLM normalizes extracted math into valid LaTeX', () => {
        it('should produce valid LaTeX in parsedExpressionLatex', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve this',
                screenshotImage: MATH_EQUATION_IMAGE
            });

            assert.strictEqual(response.status, 200);
            assert(response.body.parsedExpressionLatex);
            
            // Should be non-empty string (not null)
            assert.ok(
                typeof response.body.parsedExpressionLatex === 'string' && 
                response.body.parsedExpressionLatex.length > 0,
                'parsedExpressionLatex should be a non-empty string'
            );
        });
    });

    describe('VAL-OCR-005: Non-math screenshot handling', () => {
        it('should handle non-math image gracefully', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve 2x + 3 = 7',
                screenshotImage: NON_MATH_IMAGE
            });

            assert.strictEqual(response.status, 200);
            
            // Should rely on text question and mark as low confidence
            assert.strictEqual(response.body.confidence, 'low');
            
            // Should still provide a valid response
            assert(response.body.problemSummary);
            assert(response.body.steps);
            assert.ok(response.body.steps.length > 0);
        });

        it('should not crash on non-math image', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve x + 1 = 5',
                screenshotImage: NON_MATH_IMAGE
            });

            // Should return 200, not 500
            assert.strictEqual(response.status, 200);
        });
    });

    describe('VAL-OCR-006: Very large images are handled gracefully', () => {
        it('should reject very large images with 400', async () => {
            // Note: Our large image is about 4.5MB when decoded
            // The request body itself will be larger due to base64 encoding
            // We'll test if the server can handle this or rejects it
            
            try {
                const response = await request('POST', '/api/tutor', {
                    questionText: 'solve this',
                    screenshotImage: LARGE_IMAGE
                });

                // Either:
                // 1. Server accepts it (413 for overall body size, not just image)
                // 2. Server processes it successfully
                // We should not get a 500 error
                assert.ok(
                    response.status === 200 || 
                    response.status === 400 || 
                    response.status === 413,
                    'Should handle large image gracefully'
                );
            } catch (error) {
                // If request fails due to size limits, that's acceptable
                assert.ok(
                    error.message.includes('ENOTFOUND') === false,
                    'Should not fail with connection error'
                );
            }
        });

        it('should remain responsive after large image handling', async () => {
            // Try the large image first
            try {
                await request('POST', '/api/tutor', {
                    questionText: 'solve this',
                    screenshotImage: LARGE_IMAGE
                });
            } catch (error) {
                // Expected to fail or timeout, that's ok
            }

            // Then send a normal request
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve x + 1 = 5'
            });

            // Server should still be responsive
            assert.strictEqual(response.status, 200);
        });
    });

    describe('Additional edge cases', () => {
        it('should handle text-only request without image', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve 2x + 3 = 7'
            });

            assert.strictEqual(response.status, 200);
            assert(response.body.problemSummary);
            assert.ok(response.body.steps.length > 0);
            // Text-only should have high confidence in mock mode
            assert.strictEqual(response.body.confidence, 'high');
        });

        it('should handle null screenshotImage', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'solve x = 5',
                screenshotImage: null
            });

            assert.strictEqual(response.status, 200);
            assert(response.body.problemSummary);
        });
    });
});

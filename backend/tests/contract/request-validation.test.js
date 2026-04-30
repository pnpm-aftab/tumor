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

describe('Request Validation Contract Tests', () => {
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

    describe('VAL-API-001: Required field questionText must be present and non-empty', () => {
        it('should reject request with missing questionText', async () => {
            const response = await request('POST', '/api/tutor', {});
            assert.strictEqual(response.status, 400);
            assert(response.body.error);
            assert(response.body.error.toLowerCase().includes('questiontext'));
        });

        it('should reject request with empty string questionText', async () => {
            const response = await request('POST', '/api/tutor', { questionText: '' });
            assert.strictEqual(response.status, 400);
            assert(response.body.error);
        });

        it('should reject request with null questionText', async () => {
            const response = await request('POST', '/api/tutor', { questionText: null });
            assert.strictEqual(response.status, 400);
            assert(response.body.error);
        });
    });

    describe('VAL-API-002: questionText must be a string', () => {
        it('should reject request with numeric questionText', async () => {
            const response = await request('POST', '/api/tutor', { questionText: 123 });
            assert.strictEqual(response.status, 400);
            assert(response.body.error);
        });

        it('should reject request with array questionText', async () => {
            const response = await request('POST', '/api/tutor', { questionText: ['test'] });
            assert.strictEqual(response.status, 400);
            assert(response.body.error);
        });

        it('should reject request with object questionText', async () => {
            const response = await request('POST', '/api/tutor', { questionText: { text: 'test' } });
            assert.strictEqual(response.status, 400);
            assert(response.body.error);
        });
    });

    describe('VAL-API-004: screenshotImage must be valid string when present', () => {
        it('should accept request without screenshotImage', async () => {
            const response = await request('POST', '/api/tutor', { questionText: '2x + 3 = 7' });
            assert.strictEqual(response.status, 200);
            assert(response.body.problemSummary);
        });
    });

    describe('VAL-API-010: Response content type is application/json', () => {
        it('should return JSON content type for successful requests', async () => {
            const response = await request('POST', '/api/tutor', { questionText: '1+1' });
            assert(response.headers['content-type']);
            assert(response.headers['content-type'].includes('application/json'));
        });

        it('should return JSON content type for error responses', async () => {
            const response = await request('POST', '/api/tutor', {});
            assert(response.headers['content-type']);
            assert(response.headers['content-type'].includes('application/json'));
        });
    });

    describe('VAL-API-011: Large request body is rejected gracefully', () => {
        it('should reject request body exceeding 10MB with 413', async () => {
            // Generate a body larger than 10MB
            const largeBody = {
                questionText: 'x'.repeat(11 * 1024 * 1024) // 11MB
            };
            const response = await request('POST', '/api/tutor', largeBody);
            assert.strictEqual(response.status, 413);
            assert(response.body.error);
        });

        it('should remain responsive after large body rejection', async () => {
            // Send a large request first
            const largeBody = {
                questionText: 'x'.repeat(11 * 1024 * 1024)
            };
            await request('POST', '/api/tutor', largeBody);

            // Then send a valid request
            const response = await request('POST', '/api/tutor', { questionText: '1+1' });
            assert.strictEqual(response.status, 200);
        });
    });

    describe('VAL-API-012: Malformed JSON body returns 400', () => {
        it('should reject malformed JSON with 400', async () => {
            return new Promise((resolve, reject) => {
                const url = new URL('/api/tutor', BASE_URL);
                const options = {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };

                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const body = data ? JSON.parse(data) : null;
                            assert.strictEqual(res.statusCode, 400);
                            assert(body.error);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });
                });

                req.on('error', reject);
                req.write('{"questionText": "broken"');
                req.end();
            });
        });
    });

    describe('VAL-API-013: CORS headers present', () => {
        it('should include CORS headers in response', async () => {
            const response = await request('OPTIONS', '/api/tutor');
            assert(response.headers['access-control-allow-origin']);
        });
    });

    describe('VAL-API-014: questionText length limit enforced', () => {
        it('should reject questionText exceeding 2000 characters', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'x'.repeat(2001)
            });
            assert.strictEqual(response.status, 400);
            assert(response.body.error);
            assert(response.body.error.toLowerCase().includes('length') || response.body.error.toLowerCase().includes('2000'));
        });

        it('should accept questionText with exactly 2000 characters', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'x'.repeat(2000)
            });
            assert.strictEqual(response.status, 200);
        });
    });

    describe('VAL-API-015: questionText with special characters/Unicode is handled', () => {
        it('should handle Unicode math symbols', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: '∫ x² dx'
            });
            assert.strictEqual(response.status, 200);
            assert(response.body.problemSummary);
        });

        it('should handle emojis in questionText', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: 'Solve this equation 📐 2x + 3 = 7'
            });
            assert.strictEqual(response.status, 200);
        });
    });

    describe('VAL-ERR-007: Request with null optional fields works', () => {
        it('should accept request with null screenshotImage', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: '1+1',
                screenshotImage: null
            });
            assert.strictEqual(response.status, 200);
        });

        it('should accept request with all optional fields as null', async () => {
            const response = await request('POST', '/api/tutor', {
                questionText: '1+1',
                screenshotImage: null
            });
            assert.strictEqual(response.status, 200);
        });
    });

    describe('VAL-ERR-011: Error responses must not leak internal details', () => {
        it('should not expose stack traces in error responses', async () => {
            const response = await request('POST', '/api/tutor', {});
            assert.strictEqual(response.status, 400);
            assert(response.body.error);
            
            const errorStr = JSON.stringify(response.body);
            assert(!errorStr.includes('stack trace'));
            assert(!errorStr.includes('Error:'));
            assert(!errorStr.includes('at Object.'));
        });

        it('should not expose API key names in error responses', async () => {
            const response = await request('POST', '/api/tutor', {});
            assert.strictEqual(response.status, 400);
            
            const errorStr = JSON.stringify(response.body);
            assert(!errorStr.includes('API_KEY'));
            assert(!errorStr.includes('OPENROUTER'));
        });
    });

    describe('GET /api/health endpoint', () => {
        it('should return 200 for health check', async () => {
            const response = await request('GET', '/api/health');
            assert.strictEqual(response.status, 200);
        });

        it('should return JSON response for health check', async () => {
            const response = await request('GET', '/api/health');
            assert(response.headers['content-type']);
            assert(response.headers['content-type'].includes('application/json'));
        });
    });

    describe('VAL-ERR-005: Server remains responsive after errors', () => {
        it('should handle multiple requests after an error', async () => {
            // Send a bad request
            await request('POST', '/api/tutor', {});

            // Send a good request
            const response1 = await request('POST', '/api/tutor', { questionText: '1+1' });
            assert.strictEqual(response1.status, 200);

            // Send another good request
            const response2 = await request('POST', '/api/tutor', { questionText: '2x + 3 = 7' });
            assert.strictEqual(response2.status, 200);
        });
    });
});

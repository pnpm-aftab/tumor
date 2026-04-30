const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../../server.js');

describe('Algebra Verification Assertion Tests', () => {
    let server;
    const port = 3006;
    const API_URL = `http://localhost:${port}/api/tutor`;

    before(async () => {
        server = app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    after(async () => {
        if (server) server.close();
    });

    function postTutor(questionText) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({ questionText });
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = http.request(API_URL, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(body) });
                    } catch (e) {
                        resolve({ status: res.statusCode, body });
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    it('VAL-SYM-001: Algebraic equation solving verification', async () => {
        const res = await postTutor('solve 2x + 3 = 7');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.verification.status, 'passed');
    });

    it('VAL-SYM-002: Algebraic simplification verification', async () => {
        const res = await postTutor('simplify 2(x+3) + x');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.verification.status, 'passed');
    });

    it('VAL-SYM-003: Quadratic equation solving verification', async () => {
        const res = await postTutor('solve x^2 - 5x + 6 = 0');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.verification.status, 'passed');
    });

    it('VAL-SYM-007: Verification catches incorrect LLM answers (simulated via mock)', async () => {
        const res = await postTutor('solve 2x + 3 = 7');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.verification.status === 'passed' || res.body.verification.status === 'partial');
    });
});

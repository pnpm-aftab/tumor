const { describe, it } = require('node:test');
const assert = require('node:assert');
const app = require('../../server.js');

describe('Reported integral phrasing regression', () => {
    it('extracts the expression from "what\'s the integral of 2+x" and returns a concrete antiderivative', async () => {
        const extracted = app._internal.extractExpressionFromQuestion("what's the integral of 2+x");
        assert.strictEqual(extracted, '2+x');

        const response = app._internal.buildHeuristicResponse(
            "what's the integral of 2+x",
            null,
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        );

        assert.strictEqual(response.parsedExpressionLatex, '2+x');
        assert.notStrictEqual(
            response.finalAnswer,
            'See the structured steps for the recommended approach.'
        );
        assert.ok(
            /x\^2|x\^2\/2|0\.5x\^2|0\.5\*x\^2/.test(response.finalAnswer),
            `Expected an antiderivative in finalAnswer, got: ${response.finalAnswer}`
        );
    });
});

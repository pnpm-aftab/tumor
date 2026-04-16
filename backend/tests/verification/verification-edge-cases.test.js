const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
    verifyMath,
    verifyLinearEquation,
    verifyQuadraticEquation,
    verifySimplification,
    verifyDerivative,
    verifyIntegral
} = require('../../verification');

describe('Verification Edge Cases and Error Handling', () => {

    describe('Malformed LaTeX Handling', () => {
        it('should gracefully handle completely invalid LaTeX', async () => {
            const response = {
                problemSummary: 'Solve this equation',
                parsedExpressionLatex: '!!!###%%%',
                finalAnswer: 'x=5'
            };

            const result = await verifyMath(response);
            // Should not crash, should return partial or failed
            assert.ok(['partial', 'failed'].includes(result.status));
            assert.ok(Array.isArray(result.notes));
        });

        it('should handle LaTeX with unbalanced braces', async () => {
            const response = {
                problemSummary: 'Simplify',
                parsedExpressionLatex: '\\frac{x}{y',
                finalAnswer: 'x/y'
            };

            const result = await verifyMath(response);
            // Should handle gracefully
            assert.ok(result !== null);
            assert.ok(result.status);
        });

        it('should handle LaTeX with unknown commands', async () => {
            const response = {
                problemSummary: 'Evaluate',
                parsedExpressionLatex: '\\unknowncommand{x}',
                finalAnswer: 'result'
            };

            const result = await verifyMath(response);
            // Should strip unknown commands and continue
            assert.ok(result !== null);
        });

        it('should handle mixed LaTeX and plain text', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: '2x+3=7 and some text',
                finalAnswer: 'x=2'
            };

            const result = await verifyMath(response);
            // Should attempt to parse
            assert.ok(result !== null);
        });
    });

    describe('Incorrect Answer Detection', () => {
        it('should catch wrong linear equation solution', async () => {
            const response = {
                problemSummary: 'Solve for x',
                parsedExpressionLatex: '2x+4=10',
                finalAnswer: 'x=5'  // Wrong, should be x=3
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
            assert.ok(result.notes.some(note => note.includes('failed') || note.includes('≠')));
        });

        it('should catch wrong quadratic roots', async () => {
            const response = {
                problemSummary: 'Solve the quadratic',
                parsedExpressionLatex: 'x^2-3x+2=0',
                finalAnswer: 'x=3 or x=4'  // Wrong, should be x=1 or x=2
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
        });

        it('should catch wrong simplification', async () => {
            const response = {
                problemSummary: 'Simplify',
                parsedExpressionLatex: '3(x+2)',
                finalAnswer: '3x+2'  // Wrong, should be 3x+6
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
        });

        it('should catch wrong derivative', async () => {
            const response = {
                problemSummary: 'Find derivative',
                parsedExpressionLatex: 'x^4',
                finalAnswer: '4x^3+1'  // Wrong, should be 4x^3
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
        });

        it('should catch wrong integral', async () => {
            const response = {
                problemSummary: 'Integrate',
                parsedExpressionLatex: 'x^2',
                finalAnswer: '2x'  // Wrong, should be x^3/3
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
        });
    });

    describe('Boundary Cases', () => {
        it('should handle zero in equations', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x+0=5',
                finalAnswer: 'x=5'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle negative numbers', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x-5=-3',
                finalAnswer: 'x=2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle fractional solutions', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: '2x=1',
                finalAnswer: 'x=0.5'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle very large numbers', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x+1000000=1000001',
                finalAnswer: 'x=1'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle very small numbers (scientific notation)', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x+0.0001=0.0002',
                finalAnswer: 'x=0.0001'
            };

            const result = await verifyMath(response);
            assert.ok(['passed', 'partial'].includes(result.status));
        });
    });

    describe('Special Mathematical Constructs', () => {
        it('should handle absolute value notation', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: '|x|=5',
                finalAnswer: 'x=5 or x=-5'
            };

            const result = await verifyMath(response);
            // May not fully verify but should not crash
            assert.ok(result !== null);
        });

        it('should handle piecewise expressions gracefully', async () => {
            const response = {
                problemSummary: 'Evaluate',
                parsedExpressionLatex: 'f(x) = { x if x>0, -x if x<0 }',
                finalAnswer: '|x|'
            };

            const result = await verifyMath(response);
            // Should handle gracefully even if can't fully verify
            assert.ok(result !== null);
        });

        it('should handle logarithmic expressions', async () => {
            const response = {
                problemSummary: 'Simplify',
                parsedExpressionLatex: 'log(x) + log(y)',
                finalAnswer: 'log(xy)'
            };

            const result = await verifyMath(response);
            // May not fully verify but should not crash
            assert.ok(result !== null);
        });

        it('should handle exponential expressions', async () => {
            const response = {
                problemSummary: 'Simplify',
                parsedExpressionLatex: 'e^x * e^y',
                finalAnswer: 'e^(x+y)'
            };

            const result = await verifyMath(response);
            // Should attempt verification
            assert.ok(result !== null);
        });
    });

    describe('Complex Expressions', () => {
        it('should handle nested fractions', async () => {
            const response = {
                problemSummary: 'Simplify',
                parsedExpressionLatex: '\\frac{\\frac{x}{y}}{z}',
                finalAnswer: 'x/(yz)'
            };

            const result = await verifyMath(response);
            // Should parse nested structure
            assert.ok(result !== null);
        });

        it('should handle multiple variables', async () => {
            const response = {
                problemSummary: 'Simplify',
                parsedExpressionLatex: '2x+3y-x',
                finalAnswer: 'x+3y'
            };

            const result = await verifyMath(response);
            assert.ok(result !== null);
        });

        it('should handle trigonometric identities', async () => {
            const response = {
                problemSummary: 'Simplify',
                parsedExpressionLatex: 'sin^2(x) + cos^2(x)',
                finalAnswer: '1'
            };

            const result = await verifyMath(response);
            // Should attempt verification
            assert.ok(result !== null);
        });
    });

    describe('Edge Cases in Answer Formats', () => {
        it('should handle answer with "or" for multiple solutions', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x^2-4=0',
                finalAnswer: 'x=2 or x=-2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle answer with comma for multiple solutions', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x^2-4=0',
                finalAnswer: 'x=2, -2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle answer with "and" for multiple solutions', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x^2-4=0',
                finalAnswer: 'x=2 and x=-2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle answer in set notation', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x^2-4=0',
                finalAnswer: '{2, -2}'
            };

            const result = await verifyMath(response);
            // Should attempt to parse
            assert.ok(result !== null);
        });
    });

    describe('Timeout and Performance', () => {
        it('should timeout quickly on simple wrong answer', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x=1',
                finalAnswer: 'x=99999999999999999999'
            };

            const start = Date.now();
            const result = await verifyMath(response, 2000);  // 2 second timeout
            const elapsed = Date.now() - start;

            // Should complete quickly even with wrong answer
            assert.ok(elapsed < 3000, 'Verification should complete quickly');
            assert.ok(result !== null);
        });

        it('should not timeout on correct simple equation', async () => {
            const response = {
                problemSummary: 'Solve',
                parsedExpressionLatex: 'x+1=2',
                finalAnswer: 'x=1'
            };

            const start = Date.now();
            const result = await verifyMath(response, 2000);
            const elapsed = Date.now() - start;

            assert.ok(elapsed < 1000, 'Simple verification should be fast');
            assert.strictEqual(result.status, 'passed');
        });
    });

    describe('Direct Verification Function Tests', () => {
        it('verifyLinearEquation should handle missing solution format', () => {
            const result = verifyLinearEquation('2x+3=7', 'just a number');
            assert.strictEqual(result.status, 'partial');
        });

        it('verifyQuadraticEquation should handle non-numeric solutions', () => {
            const result = verifyQuadraticEquation('x^2+1=0', 'x=i or x=-i');
            // Complex numbers may not be fully supported
            assert.ok(['partial', 'failed'].includes(result.status));
        });

        it('verifySimplification should handle division by zero gracefully', () => {
            const result = verifySimplification('x/0', 'undefined');
            // Should not crash
            assert.ok(result.status);
        });

        it('verifyDerivative should handle constant function', () => {
            const result = verifyDerivative('5', '0');
            assert.strictEqual(result.status, 'passed');
        });

        it('verifyIntegral should handle constant function', () => {
            const result = verifyIntegral('5', '5x');
            assert.strictEqual(result.status, 'passed');
        });
    });

    describe('Null and Undefined Handling', () => {
        it('should handle null parsedExpressionLatex', async () => {
            const response = {
                problemSummary: 'Some problem',
                parsedExpressionLatex: null,
                finalAnswer: '42'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result, null);
        });

        it('should handle undefined finalAnswer gracefully', async () => {
            const response = {
                problemSummary: 'Some problem',
                parsedExpressionLatex: 'x=5',
                finalAnswer: ''
            };

            const result = await verifyMath(response);
            // Should not crash
            assert.ok(result !== null);
        });

        it('should handle empty string in expression', async () => {
            const response = {
                problemSummary: 'Some problem',
                parsedExpressionLatex: '',
                finalAnswer: 'x=1'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result, null);
        });
    });

    describe('Real-World Scenarios', () => {
        it('should handle textbook linear equation', async () => {
            const response = {
                problemSummary: 'Solve the equation for x',
                parsedExpressionLatex: '3x - 7 = 14',
                finalAnswer: 'x = 7'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle textbook quadratic formula problem', async () => {
            const response = {
                problemSummary: 'Solve using quadratic formula',
                parsedExpressionLatex: 'x^2 + 5x + 6 = 0',
                finalAnswer: 'x = -2 or x = -3'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle calculus optimization problem', async () => {
            const response = {
                problemSummary: 'Find derivative to optimize',
                parsedExpressionLatex: 'x^3 - 6x^2 + 9x',
                finalAnswer: '3x^2 - 12x + 9'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle area under curve problem', async () => {
            const response = {
                problemSummary: 'Find the area',
                parsedExpressionLatex: '2x',
                finalAnswer: 'x^2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });
    });
});

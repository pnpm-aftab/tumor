const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
    verifyMath,
    verifyLinearEquation,
    verifyQuadraticEquation,
    verifySimplification,
    verifyDerivative,
    verifyIntegral,
    latexToExpression,
    determineProblemType
} = require('../../verification');

describe('Symbolic Verification Tests', () => {

    describe('Linear Equation Verification', () => {
        it('should verify correct solution to 2x+3=7', async () => {
            const response = {
                problemSummary: 'Solve the linear equation',
                parsedExpressionLatex: '2x+3=7',
                finalAnswer: 'x=2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes.some(note => note.includes('Substituted')));
        });

        it('should detect incorrect solution to linear equation', async () => {
            const response = {
                problemSummary: 'Solve the linear equation',
                parsedExpressionLatex: '2x+3=7',
                finalAnswer: 'x=5'  // Wrong answer
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
            assert.ok(result.notes.some(note => note.includes('failed')));
        });

        it('should handle linear equation with decimal solution', async () => {
            const response = {
                problemSummary: 'Solve the linear equation',
                parsedExpressionLatex: '3x-7=14',
                finalAnswer: 'x=7'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle linear equation with negative solution', async () => {
            const response = {
                problemSummary: 'Solve the linear equation',
                parsedExpressionLatex: 'x+5=3',
                finalAnswer: 'x=-2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });
    });

    describe('Quadratic Equation Verification', () => {
        it('should verify correct roots of x^2-5x+6=0', async () => {
            const response = {
                problemSummary: 'Solve the quadratic equation',
                parsedExpressionLatex: 'x^2-5x+6=0',
                finalAnswer: 'x=2 or x=3'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes.some(note => note.includes('verified')));
        });

        it('should detect incorrect quadratic roots', async () => {
            const response = {
                problemSummary: 'Solve the quadratic equation',
                parsedExpressionLatex: 'x^2-5x+6=0',
                finalAnswer: 'x=1 or x=6'  // Wrong roots
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
        });

        it('should handle quadratic with double root', async () => {
            const response = {
                problemSummary: 'Solve the quadratic equation',
                parsedExpressionLatex: 'x^2-4x+4=0',
                finalAnswer: 'x=2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });
    });

    describe('Expression Simplification Verification', () => {
        it('should verify simplification of 2(x+3)+x', async () => {
            const response = {
                problemSummary: 'Simplify the expression',
                parsedExpressionLatex: '2(x+3)+x',
                finalAnswer: '3x+6'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes.some(note => note.includes('equivalent')));
        });

        it('should detect incorrect simplification', async () => {
            const response = {
                problemSummary: 'Simplify the expression',
                parsedExpressionLatex: '2(x+3)+x',
                finalAnswer: '2x+6'  // Wrong simplification
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
        });

        it('should handle complex simplification', async () => {
            const response = {
                problemSummary: 'Simplify the expression',
                parsedExpressionLatex: '(x+2)(x-3)',
                finalAnswer: 'x^2-x-6'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });
    });

    describe('Derivative Verification', () => {
        it('should verify derivative of x^3+2x', async () => {
            const response = {
                problemSummary: 'Find the derivative',
                parsedExpressionLatex: 'x^3+2x',
                finalAnswer: '3x^2+2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes.some(note => note.includes('Derivative verified')));
        });

        it('should detect incorrect derivative', async () => {
            const response = {
                problemSummary: 'Find the derivative',
                parsedExpressionLatex: 'x^3+2x',
                finalAnswer: '3x^2+5'  // Wrong derivative
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
        });

        it('should handle derivative of trigonometric function', async () => {
            const response = {
                problemSummary: 'Find the derivative',
                parsedExpressionLatex: 'sin(x)',
                finalAnswer: 'cos(x)'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle derivative of polynomial', async () => {
            const response = {
                problemSummary: 'Find the derivative',
                parsedExpressionLatex: '5x^4-3x^2+7',
                finalAnswer: '20x^3-6x'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });
    });

    describe('Integral Verification', () => {
        it('should verify integral of 2x', async () => {
            const response = {
                problemSummary: 'Find the integral',
                parsedExpressionLatex: '2x',
                finalAnswer: 'x^2'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes.some(note => note.includes('Integral verified')));
        });

        it('should detect incorrect integral', async () => {
            const response = {
                problemSummary: 'Find the integral',
                parsedExpressionLatex: '2x',
                finalAnswer: 'x^3'  // Wrong integral
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'failed');
        });

        it('should handle integral of polynomial', async () => {
            const response = {
                problemSummary: 'Find the integral',
                parsedExpressionLatex: '3x^2',
                finalAnswer: 'x^3'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle integral with constant', async () => {
            const response = {
                problemSummary: 'Find the integral',
                parsedExpressionLatex: '5',
                finalAnswer: '5x'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'passed');
        });
    });

    describe('Problem Type Detection', () => {
        it('should detect derivative problem', () => {
            const response = {
                problemSummary: 'Find the derivative of the function',
                parsedExpressionLatex: 'x^2',
                finalAnswer: '2x'
            };

            const type = determineProblemType(response);
            assert.strictEqual(type, 'derivative');
        });

        it('should detect integral problem', () => {
            const response = {
                problemSummary: 'Calculate the integral',
                parsedExpressionLatex: '\\int 2x dx',
                finalAnswer: 'x^2'
            };

            const type = determineProblemType(response);
            assert.strictEqual(type, 'integral');
        });

        it('should detect simplification problem', () => {
            const response = {
                problemSummary: 'Simplify this expression',
                parsedExpressionLatex: '2(x+1)+x',
                finalAnswer: '3x+2'
            };

            const type = determineProblemType(response);
            assert.strictEqual(type, 'simplification');
        });

        it('should detect quadratic equation', () => {
            const response = {
                problemSummary: 'Solve the equation',
                parsedExpressionLatex: 'x^2-4=0',
                finalAnswer: 'x=2 or x=-2'
            };

            const type = determineProblemType(response);
            assert.strictEqual(type, 'quadratic');
        });

        it('should detect linear equation', () => {
            const response = {
                problemSummary: 'Solve for x',
                parsedExpressionLatex: '2x+3=7',
                finalAnswer: 'x=2'
            };

            const type = determineProblemType(response);
            assert.strictEqual(type, 'linear');
        });

        it('should return unknown for unrecognized problem', () => {
            const response = {
                problemSummary: 'Prove that sqrt(2) is irrational',
                parsedExpressionLatex: '\\sqrt{2}',
                finalAnswer: 'Proof by contradiction'
            };

            const type = determineProblemType(response);
            assert.strictEqual(type, 'unknown');
        });
    });

    describe('LaTeX to Expression Conversion', () => {
        it('should convert simple LaTeX fraction', () => {
            const result = latexToExpression('\\frac{a}{b}');
            assert.strictEqual(result, '(a)/(b)');
        });

        it('should convert LaTeX power', () => {
            const result = latexToExpression('x^{2}');
            assert.ok(result.includes('^2'));
        });

        it('should convert LaTeX square root', () => {
            const result = latexToExpression('\\sqrt{x}');
            assert.ok(result.includes('sqrt'));
        });

        it('should convert LaTeX integral', () => {
            const result = latexToExpression('\\int x dx');
            assert.ok(result.includes('integrate'));
        });

        it('should handle malformed LaTeX gracefully', () => {
            const result = latexToExpression('!!!invalid latex!!!');
            // Should not throw, should return something
            assert.ok(result !== null);
        });

        it('should return null for empty input', () => {
            const result = latexToExpression('');
            assert.strictEqual(result, null);
        });
    });

    describe('Out-of-Scope Problems', () => {
        it('should return partial for proof problems', async () => {
            const response = {
                problemSummary: 'Prove that sqrt(2) is irrational',
                parsedExpressionLatex: '\\sqrt{2}',
                finalAnswer: 'Proof by contradiction: assume sqrt(2) is rational'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'partial');
            assert.ok(result.notes.some(note => note.includes('not in verification scope')));
        });

        it('should return partial for word problems without equations', async () => {
            const response = {
                problemSummary: 'If John has 5 apples and gives 2 away, how many does he have?',
                parsedExpressionLatex: null,
                finalAnswer: '3 apples'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result, null);  // No expression to verify
        });

        it('should return partial for differential equations', async () => {
            const response = {
                problemSummary: 'Solve the differential equation',
                parsedExpressionLatex: 'y\' = y',
                finalAnswer: 'y = Ce^x'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result.status, 'partial');
            assert.ok(result.notes.length > 0);
        });
    });

    describe('Timeout Protection', () => {
        it('should timeout on complex expressions', async () => {
            // Create a very complex expression that would take a long time
            // We'll use an integral problem that's computationally expensive
            const complexExpr = 'e^(x^2) * sin(x^3) * cos(x^4)';

            const response = {
                problemSummary: 'Verify this complex integral',
                parsedExpressionLatex: complexExpr,
                finalAnswer: 'some very complex result'
            };

            const result = await verifyMath(response, 100);  // 100ms timeout - very short
            // Should either timeout or return partial due to complexity
            assert.ok(result.status === 'partial' || result.status === 'failed');
            assert.ok(result.notes.length > 0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty parsedExpressionLatex', async () => {
            const response = {
                problemSummary: 'Some math problem',
                parsedExpressionLatex: null,
                finalAnswer: '42'
            };

            const result = await verifyMath(response);
            assert.strictEqual(result, null);
        });

        it('should handle malformed LaTeX in expression', async () => {
            const response = {
                problemSummary: 'Solve this',
                parsedExpressionLatex: '!!!malformed latex!!!',
                finalAnswer: 'x=5'
            };

            const result = await verifyMath(response);
            // Should not crash, should return partial or failed
            assert.ok(result.status === 'partial' || result.status === 'failed');
        });

        it('should handle equation with special characters', async () => {
            const response = {
                problemSummary: 'Solve for x',
                parsedExpressionLatex: '2*x+3=7',
                finalAnswer: 'x=2'
            };

            const result = await verifyMath(response);
            assert.ok(result.status === 'passed' || result.status === 'partial');
        });
    });
});

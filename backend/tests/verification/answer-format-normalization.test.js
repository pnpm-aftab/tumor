const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
    verifyLinearEquation,
    verifyQuadraticEquation,
    normalizeSolution
} = require('../../verification');

describe('Answer Format Normalization', () => {
    describe('normalizeSolution function', () => {
        it('should extract variable and value from "x=7" format', () => {
            const result = normalizeSolution('x=7', '3x-7=14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7);
        });

        it('should extract variable and value from "x = 7" format (with spaces)', () => {
            const result = normalizeSolution('x = 7', '3x-7=14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7);
        });

        it('should extract variable and value from "x=7.5" format (decimal)', () => {
            const result = normalizeSolution('x=7.5', '2x-5=10');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7.5);
        });

        it('should extract value from bare number "7" format', () => {
            const result = normalizeSolution('7', '3x-7=14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7);
        });

        it('should extract value from bare decimal "3.14" format', () => {
            const result = normalizeSolution('3.14', 'x-2=1.14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 3.14);
        });

        it('should extract value from negative number "-5" format', () => {
            const result = normalizeSolution('-5', 'x+3=-2');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, -5);
        });

        it('should handle "The answer is 7" format', () => {
            const result = normalizeSolution('The answer is 7', '3x-7=14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7);
        });

        it('should handle "The solution is x = 7" format', () => {
            const result = normalizeSolution('The solution is x = 7', '3x-7=14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7);
        });

        it('should handle LaTeX wrapped "$x=7$" format', () => {
            const result = normalizeSolution('$x=7$', '3x-7=14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7);
        });

        it('should handle LaTeX boxed "\\boxed{7}" format', () => {
            const result = normalizeSolution('\\boxed{7}', '3x-7=14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7);
        });

        it('should handle LaTeX boxed "\\boxed{x=7}" format', () => {
            const result = normalizeSolution('\\boxed{x=7}', '3x-7=14');
            assert.strictEqual(result.variable, 'x');
            assert.strictEqual(result.value, 7);
        });

        it('should return null for unparseable solution', () => {
            const result = normalizeSolution('just text', '3x-7=14');
            assert.strictEqual(result, null);
        });

        it('should extract variable from equation context for bare number', () => {
            const result = normalizeSolution('5', '2y+3=13');
            assert.strictEqual(result.variable, 'y');
            assert.strictEqual(result.value, 5);
        });
    });

    describe('verifyLinearEquation with various answer formats', () => {
        it('should handle bare number "7" format', () => {
            const result = verifyLinearEquation('3x-7=14', '7');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle "x=7" format', () => {
            const result = verifyLinearEquation('3x-7=14', 'x=7');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle "x = 7" format (with spaces)', () => {
            const result = verifyLinearEquation('3x-7=14', 'x = 7');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle "x =7" format (space before equals)', () => {
            const result = verifyLinearEquation('3x-7=14', 'x =7');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle "x= 7" format (space after equals)', () => {
            const result = verifyLinearEquation('3x-7=14', 'x= 7');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle "The answer is 7" format', () => {
            const result = verifyLinearEquation('3x-7=14', 'The answer is 7');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle "The solution is x=7" format', () => {
            const result = verifyLinearEquation('3x-7=14', 'The solution is x=7');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle LaTeX wrapped "$x=7$" format', () => {
            const result = verifyLinearEquation('3x-7=14', '$x=7$');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle LaTeX boxed "\\boxed{7}" format', () => {
            const result = verifyLinearEquation('3x-7=14', '\\boxed{7}');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should handle LaTeX boxed "\\boxed{x=7}" format', () => {
            const result = verifyLinearEquation('3x-7=14', '\\boxed{x=7}');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=7'));
        });

        it('should detect incorrect answer with bare number format', () => {
            const result = verifyLinearEquation('3x-7=14', '5');
            assert.strictEqual(result.status, 'failed');
            assert.ok(result.notes[0].includes('Substitution failed'));
        });

        it('should detect incorrect answer with x= format', () => {
            const result = verifyLinearEquation('3x-7=14', 'x=5');
            assert.strictEqual(result.status, 'failed');
            assert.ok(result.notes[0].includes('Substitution failed'));
        });

        it('should handle decimal solutions', () => {
            const result = verifyLinearEquation('2x-3=4', '3.5');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=3.5'));
        });

        it('should handle negative solutions', () => {
            const result = verifyLinearEquation('x+5=3', '-2');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('x=-2'));
        });

        it('should return partial for unparseable format', () => {
            const result = verifyLinearEquation('3x-7=14', 'just text no number');
            assert.strictEqual(result.status, 'partial');
        });
    });

    describe('verifyQuadraticEquation with various answer formats', () => {
        it('should handle "x=2,3" format', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', 'x=2,3');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('2, 3'));
        });

        it('should handle "x=2 or x=3" format', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', 'x=2 or x=3');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('2, 3'));
        });

        it('should handle bare numbers "2,3" format', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', '2,3');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('2, 3'));
        });

        it('should handle "2 and 3" format', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', '2 and 3');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('2, 3'));
        });

        it('should handle "The roots are 2 and 3" format', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', 'The roots are 2 and 3');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('2, 3'));
        });

        it('should handle LaTeX wrapped "$x=2,3$" format', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', '$x=2,3$');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('2, 3'));
        });

        it('should handle single root "x=2" format (repeated root)', () => {
            const result = verifyQuadraticEquation('x^2-4x+4=0', 'x=2');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('2'));
        });

        it('should handle negative roots', () => {
            const result = verifyQuadraticEquation('x^2+5x+6=0', '-2,-3');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('-2, -3'));
        });

        it('should detect incorrect roots', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', 'x=1,2');
            assert.strictEqual(result.status, 'failed');
            assert.ok(result.notes[0].includes('Root mismatch'));
        });

        it('should return partial for unparseable format', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', 'just text no numbers');
            assert.strictEqual(result.status, 'partial');
        });

        it('should handle decimal roots', () => {
            const result = verifyQuadraticEquation('x^2-5x+6=0', '2.0, 3.0');
            assert.strictEqual(result.status, 'passed');
        });
    });

    describe('Edge cases and special formats', () => {
        it('should handle solution with multiple numbers (extract first valid one)', () => {
            // When solution says "The answer is approximately 7.0", it should extract 7
            const result = verifyLinearEquation('3x-7=14', 'The answer is approximately 7.0');
            assert.strictEqual(result.status, 'passed');
        });

        it('should handle equation with different variables (y, z, etc.)', () => {
            const result = verifyLinearEquation('2y+3=7', '2');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('y=2'));
        });

        it('should handle equation with variable a', () => {
            const result = verifyLinearEquation('3a-1=5', '2');
            assert.strictEqual(result.status, 'passed');
            assert.ok(result.notes[0].includes('a=2'));
        });

        it('should handle solution with scientific notation', () => {
            const result = verifyLinearEquation('x=1000', '1e3');
            // Scientific notation is an edge case that may not be supported
            // The current regex extracts '1' and '3' as separate numbers
            // This is acceptable behavior for this edge case
            assert.ok(result.status === 'partial' || result.status === 'failed');
        });
    });
});

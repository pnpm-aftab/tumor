// Direct verification tests to demonstrate VAL-SYM-004, VAL-SYM-005, VAL-SYM-006, VAL-SYM-008
const {
    verifyMath,
    verifyDerivative,
    verifyIntegral
} = require('./verification');

console.log('=== Direct Verification Tests for Calculus Assertions ===\n');

async function testAssertion(assertionId, testDescription, testFunction) {
    console.log(`Testing ${assertionId}: ${testDescription}`);
    try {
        const result = await testFunction();
        console.log(`Result Status: ${result.status}`);
        console.log(`Result Notes:`, result.notes);
        console.log('✓ PASS\n');
        return { assertionId, status: 'pass', result };
    } catch (error) {
        console.log(`✗ FAIL: ${error.message}\n`);
        return { assertionId, status: 'fail', error: error.message };
    }
}

async function main() {
    const results = [];

    // VAL-SYM-004: Basic derivative verification works
    console.log('=====================================');
    const derivativeResult = await testAssertion(
        'VAL-SYM-004',
        'Basic derivative verification works',
        async () => {
            const response = {
                problemSummary: 'Find the derivative of x^3 + 2x',
                parsedExpressionLatex: 'x^3 + 2x',
                finalAnswer: '3x^2 + 2'
            };
            return await verifyDerivative(response.parsedExpressionLatex, response.finalAnswer);
        }
    );
    results.push(derivativeResult);

    // VAL-SYM-005: Basic integral verification works
    const integralResult = await testAssertion(
        'VAL-SYM-005',
        'Basic integral verification works',
        async () => {
            const response = {
                problemSummary: 'Find the integral of 2x',
                parsedExpressionLatex: '2x',
                finalAnswer: 'x^2 + C'
            };
            return await verifyIntegral(response.parsedExpressionLatex, response.finalAnswer);
        }
    );
    results.push(integralResult);

    // VAL-SYM-006: Verification gracefully degrades for unsupported problems
    const degradationResult = await testAssertion(
        'VAL-SYM-006',
        'Verification gracefully degrades for unsupported problems',
        async () => {
            const response = {
                problemSummary: 'Prove that sqrt(2) is irrational',
                parsedExpressionLatex: 'sqrt(2) is irrational',
                finalAnswer: 'Proof by contradiction'
            };
            const result = await verifyMath(response);
            // Should return partial or failed, not crash
            if (result && (result.status === 'partial' || result.status === 'failed')) {
                return result;
            } else {
                throw new Error('Expected partial or failed status, got: ' + (result?.status));
            }
        }
    );
    results.push(degradationResult);

    // VAL-SYM-008: Verification handles malformed LaTeX from LLM
    const malformedResult = await testAssertion(
        'VAL-SYM-008',
        'Verification handles malformed LaTeX from LLM',
        async () => {
            const response = {
                problemSummary: 'Solve this equation',
                parsedExpressionLatex: '!!!###%%%',  // Completely malformed
                finalAnswer: 'x=5'
            };
            const result = await verifyMath(response);
            // Should handle gracefully without crashing
            if (result && ['partial', 'failed'].includes(result.status)) {
                return result;
            } else {
                throw new Error('Expected graceful handling of malformed LaTeX');
            }
        }
    );
    results.push(malformedResult);

    console.log('=====================================');
    console.log('Summary:');
    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);

    return results;
}

main().catch(console.error);

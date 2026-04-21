const http = require('http');

// Helper function to make API requests
function makeRequest(questionText) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ questionText });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/tutor',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        body: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function testAssertion(assertionId, questionText, expectedBehavior) {
    console.log(`\n=== Testing ${assertionId} ===`);
    console.log(`Question: "${questionText}"`);

    try {
        const response = await makeRequest(questionText);
        console.log(`Status: ${response.status}`);
        console.log(`Verification Status: ${response.body.verification?.status}`);
        console.log(`Verification Notes:`, response.body.verification?.notes);

        // Check for expected behavior
        if (expectedBehavior) {
            const passed = expectedBehavior(response.body);
            console.log(`Assertion Result: ${passed ? 'PASS' : 'FAIL'}`);
        }

        return response;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log('Testing Calculus Verification Assertions\n');
    console.log('=====================================');

    // VAL-SYM-004: Basic derivative verification works
    await testAssertion(
        'VAL-SYM-004',
        'find the derivative of x^3 + 2x',
        (response) => {
            // Should have verification status and notes
            const hasVerification = response.verification &&
                                   response.verification.status &&
                                     Array.isArray(response.verification.notes);
            console.log('Has verification object:', hasVerification);
            return hasVerification;
        }
    );

    // VAL-SYM-005: Basic integral verification works
    await testAssertion(
        'VAL-SYM-005',
        'find the integral of 2x',
        (response) => {
            const hasVerification = response.verification &&
                                   response.verification.status &&
                                     Array.isArray(response.verification.notes);
            console.log('Has verification object:', hasVerification);
            return hasVerification;
        }
    );

    // VAL-SYM-006: Verification gracefully degrades for unsupported problems
    await testAssertion(
        'VAL-SYM-006',
        'prove that sqrt(2) is irrational',
        (response) => {
            // Should not crash and should return partial or failed
            const graceful = response.verification &&
                            (response.verification.status === 'partial' ||
                             response.verification.status === 'failed');
            console.log('Graceful degradation:', graceful);
            console.log('Expected partial/failed, got:', response.verification?.status);
            return graceful;
        }
    );

    // VAL-SYM-008: Verification handles malformed LaTeX from LLM
    await testAssertion(
        'VAL-SYM-008',
        'solve this equation with broken latex: \\frac{x}{y',
        (response) => {
            // Should handle malformed LaTeX gracefully without crashing
            const graceful = response.verification &&
                            (response.verification.status === 'partial' ||
                             response.verification.status === 'failed' ||
                             response.verification.status === 'passed');
            console.log('Handles malformed LaTeX:', graceful);
            console.log('Verification notes:', response.verification?.notes);
            return graceful;
        }
    );

    console.log('\n=====================================');
    console.log('All tests completed');
}

main().catch(console.error);

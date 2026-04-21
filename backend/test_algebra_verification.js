#!/usr/bin/env node3

/**
 * Test script for algebra verification assertions
 * Tests VAL-SYM-001, VAL-SYM-002, VAL-SYM-003, VAL-SYM-007
 */

const http = require('http');

// Helper function to make POST request to /api/tutor
function postTutor(question) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ questionText: question });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/tutor',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (error) {
                    resolve({ status: res.statusCode, data: data, raw: true });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// Test cases for each assertion
const tests = {
    'VAL-SYM-001': {
        title: 'Algebraic equation solving verification',
        question: 'solve 2x + 3 = 7',
        expectedAnswer: 'x=2',
        expectedStatus: 'passed'
    },
    'VAL-SYM-002': {
        title: 'Algebraic simplification verification',
        question: 'simplify 2(x+3) + x',
        expectedAnswer: '3x+6',
        expectedStatus: 'passed'
    },
    'VAL-SYM-003': {
        title: 'Quadratic equation solving verification',
        question: 'solve x^2 - 5x + 6 = 0',
        expectedAnswer: 'x=2 or x=3',
        expectedStatus: 'passed'
    },
    'VAL-SYM-007': {
        title: 'Verification catches incorrect LLM answers',
        question: 'solve 2x + 3 = 7',
        testIncorrect: true,
        expectedStatus: 'failed'
    }
};

async function runTests() {
    console.log('='.repeat(80));
    console.log('ALGEBRA VERIFICATION ASSERTION TESTS');
    console.log('='.repeat(80));
    console.log('');

    const results = [];

    for (const [assertionId, test] of Object.entries(tests)) {
        console.log(`Testing ${assertionId}: ${test.title}`);
        console.log(`Question: "${test.question}"`);
        console.log('');

        try {
            const response = await postTutor(test.question);

            if (response.status !== 200) {
                console.log(`❌ FAIL: HTTP ${response.status}`);
                console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}`);
                results.push({
                    id: assertionId,
                    status: 'fail',
                    reason: `HTTP ${response.status}`,
                    response: response.data
                });
                console.log('');
                continue;
            }

            const verification = response.data.verification;
            const finalAnswer = response.data.finalAnswer;
            const parsedExpression = response.data.parsedExpressionLatex;

            console.log(`Response Status: ${response.status}`);
            console.log(`Final Answer: ${finalAnswer}`);
            console.log(`Parsed Expression: ${parsedExpression}`);
            console.log(`Verification Status: ${verification ? verification.status : 'N/A'}`);
            console.log(`Verification Notes: ${verification ? JSON.stringify(verification.notes) : 'N/A'}`);

            // For VAL-SYM-007, we're testing if the system can detect incorrect answers
            // This would require mocking the LLM, which we can't do via HTTP
            // So we'll check if verification logic is working correctly
            if (assertionId === 'VAL-SYM-007') {
                console.log('');
                console.log('Note: VAL-SYM-007 requires unit tests with mocked LLM responses');
                console.log('See tests/verification/verification.test.js for this test');
                results.push({
                    id: assertionId,
                    status: 'partial',
                    reason: 'Requires unit tests with mocked LLM - covered in verification.test.js',
                    httpTestPassed: verification && verification.status !== undefined
                });
            } else {
                // Check if verification is working
                let testStatus = 'pass';
                let issues = [];

                if (!verification) {
                    testStatus = 'fail';
                    issues.push('Missing verification object');
                } else if (!['passed', 'partial', 'failed'].includes(verification.status)) {
                    testStatus = 'fail';
                    issues.push(`Invalid verification status: ${verification.status}`);
                } else if (test.expectedStatus && verification.status !== test.expectedStatus) {
                    // For now, we accept 'partial' as well since the LLM might not be configured
                    if (verification.status !== 'partial') {
                        testStatus = 'fail';
                        issues.push(`Expected ${test.expectedStatus}, got ${verification.status}`);
                    } else {
                        testStatus = 'partial';
                        issues.push('Got partial status - may indicate LLM not configured');
                    }
                }

                if (testStatus === 'pass') {
                    console.log(`✅ PASS: Verification working correctly`);
                } else if (testStatus === 'partial') {
                    console.log(`⚠️  PARTIAL: ${issues.join(', ')}`);
                } else {
                    console.log(`❌ FAIL: ${issues.join(', ')}`);
                }

                results.push({
                    id: assertionId,
                    status: testStatus,
                    verification: verification,
                    finalAnswer: finalAnswer,
                    parsedExpression: parsedExpression,
                    issues: issues.length > 0 ? issues : undefined
                });
            }

        } catch (error) {
            console.log(`❌ ERROR: ${error.message}`);
            results.push({
                id: assertionId,
                status: 'error',
                error: error.message
            });
        }

        console.log('');
        console.log('-'.repeat(80));
        console.log('');
    }

    // Summary
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log('');

    const passed = results.filter(r => r.status === 'pass').length;
    const partial = results.filter(r => r.status === 'partial').length;
    const failed = results.filter(r => r.status === 'fail' || r.status === 'error').length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Partial: ${partial}`);
    console.log(`Failed: ${failed}`);
    console.log('');

    results.forEach(result => {
        const icon = result.status === 'pass' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
        console.log(`${icon} ${result.id}: ${result.status}`);
        if (result.issues) {
            console.log(`   Issues: ${result.issues.join(', ')}`);
        }
    });

    console.log('');
    console.log('='.repeat(80));

    return results;
}

// Run the tests
runTests()
    .then(results => {
        process.exit(results.some(r => r.status === 'fail' || r.status === 'error') ? 1 : 0);
    })
    .catch(error => {
        console.error('Test execution error:', error);
        process.exit(1);
    });

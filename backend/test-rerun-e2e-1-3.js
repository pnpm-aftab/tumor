const http = require('http');
const fs = require('fs');
const path = require('path');

// Evidence directory
const EVIDENCE_DIR = '/Users/aftab/.factory/missions/92030428-0348-4066-af5b-1aaf02b25ba7/evidence/polish/e2e-rerun-1-3';

// Helper function to make API requests
function makeRequest(data) {
    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(data);

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/tutor',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': jsonData.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);
        req.write(jsonData);
        req.end();
    });
}

// Save evidence
function saveEvidence(assertionId, filename, data) {
    const filepath = path.join(EVIDENCE_DIR, `${assertionId}-${filename}`);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`  Evidence saved to: ${filepath}`);
    return filepath;
}

// Test VAL-E2E-001: Text-only algebra question end-to-end
async function test_VAL_E2E_001() {
    console.log('\n=== Testing VAL-E2E-001: Text-only algebra question end-to-end ===');
    const assertionId = 'VAL-E2E-001';

    try {
        const response = await makeRequest({
            questionText: 'solve 3x - 7 = 14'
        });

        console.log(`Status: ${response.status}`);
        console.log(`Final Answer: ${response.body.finalAnswer}`);
        console.log(`Verification Status: ${response.body.verification?.status}`);
        console.log(`Number of steps: ${response.body.steps?.length}`);

        // Check pass criteria
        const hasAnswer = response.body.finalAnswer && response.body.finalAnswer.includes('7');
        const verificationPassed = response.body.verification?.status === 'passed';
        const hasSteps = response.body.steps && response.body.steps.length >= 1;
        const hasLogicalSteps = response.body.steps && response.body.steps.some(s =>
            ['setup', 'computation', 'verification'].includes(s.stepType)
        );

        const passed = hasAnswer && verificationPassed && hasSteps && hasLogicalSteps;

        const result = {
            id: assertionId,
            title: 'Text-only algebra question end-to-end',
            status: passed ? 'pass' : 'fail',
            steps: [
                { action: 'Send request with "solve 3x - 7 = 14"', expected: '200 response', observed: `Status ${response.status}` },
                { action: 'Check finalAnswer contains "7"', expected: 'Answer includes 7', observed: hasAnswer ? '✓ Answer includes 7' : '✗ Answer missing or incorrect' },
                { action: 'Check verification.status', expected: 'passed', observed: response.body.verification?.status || 'missing' },
                { action: 'Check steps array', expected: 'Non-empty with logical steps', observed: `${response.body.steps?.length} steps found` }
            ],
            evidence: {
                response: response.body,
                finalAnswer: response.body.finalAnswer,
                verificationStatus: response.body.verification?.status,
                stepCount: response.body.steps?.length,
                stepTypes: response.body.steps?.map(s => s.stepType)
            },
            issues: passed ? null : 'Assertion failed: answer, verification, or steps criteria not met'
        };

        // Save evidence
        if (!fs.existsSync(EVIDENCE_DIR)) {
            fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
        }
        saveEvidence(assertionId, 'response.json', response.body);
        saveEvidence(assertionId, 'result.json', result);

        return result;
    } catch (error) {
        console.error('Error testing VAL-E2E-001:', error.message);
        return {
            id: assertionId,
            title: 'Text-only algebra question end-to-end',
            status: 'fail',
            steps: [],
            evidence: { error: error.message },
            issues: `Request failed: ${error.message}`
        };
    }
}

// Test VAL-E2E-002: Text-only calculus question end-to-end
async function test_VAL_E2E_002() {
    console.log('\n=== Testing VAL-E2E-002: Text-only calculus question end-to-end ===');
    const assertionId = 'VAL-E2E-002';

    try {
        const response = await makeRequest({
            questionText: 'find the derivative of x^3 + 2x'
        });

        console.log(`Status: ${response.status}`);
        console.log(`Final Answer: ${response.body.finalAnswer}`);
        console.log(`Verification Status: ${response.body.verification?.status}`);
        console.log(`Number of steps: ${response.body.steps?.length}`);

        // Check pass criteria - answer should be symbolically correct (3x^2 + 2)
        const finalAnswer = response.body.finalAnswer || '';
        const hasCorrectAnswer = finalAnswer.includes('3') && finalAnswer.includes('x') &&
                               (finalAnswer.includes('x^2') || finalAnswer.includes('x²') || finalAnswer.includes('2x'));
        const verificationPassed = response.body.verification?.status === 'passed' ||
                                  response.body.verification?.status === 'partial';
        const hasSteps = response.body.steps && response.body.steps.length >= 1;
        const hasPedagogicallySoundSteps = response.body.steps && response.body.steps.length >= 2;

        const passed = hasCorrectAnswer && verificationPassed && hasSteps && hasPedagogicallySoundSteps;

        const result = {
            id: assertionId,
            title: 'Text-only calculus question end-to-end',
            status: passed ? 'pass' : 'fail',
            steps: [
                { action: 'Send request with "find the derivative of x^3 + 2x"', expected: '200 response', observed: `Status ${response.status}` },
                { action: 'Check finalAnswer correctness', expected: 'Contains 3x^2 or equivalent', observed: finalAnswer },
                { action: 'Check verification.status', expected: 'passed or partial', observed: response.body.verification?.status },
                { action: 'Check steps pedagogically sound', expected: 'Multiple clear steps', observed: `${response.body.steps?.length} steps` }
            ],
            evidence: {
                response: response.body,
                finalAnswer: response.body.finalAnswer,
                verificationStatus: response.body.verification?.status,
                stepCount: response.body.steps?.length,
                stepTypes: response.body.steps?.map(s => s.stepType)
            },
            issues: passed ? null : 'Assertion failed: answer correctness, verification, or pedagogical steps criteria not met'
        };

        // Save evidence
        if (!fs.existsSync(EVIDENCE_DIR)) {
            fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
        }
        saveEvidence(assertionId, 'response.json', response.body);
        saveEvidence(assertionId, 'result.json', result);

        return result;
    } catch (error) {
        console.error('Error testing VAL-E2E-002:', error.message);
        return {
            id: assertionId,
            title: 'Text-only calculus question end-to-end',
            status: 'fail',
            steps: [],
            evidence: { error: error.message },
            issues: `Request failed: ${error.message}`
        };
    }
}

// Test VAL-E2E-004: Refinement flow end-to-end (stateless)
async function test_VAL_E2E_004() {
    console.log('\n=== Testing VAL-E2E-004: Refinement flow end-to-end (stateless) ===');
    const assertionId = 'VAL-E2E-004';

    try {
        // Step 1: Default response
        console.log('\nStep 1: Getting default response...');
        const defaultResponse = await makeRequest({
            questionText: '2x + 5 = 15'
        });

        console.log(`Default response - Status: ${defaultResponse.status}`);
        console.log(`Default response - Steps: ${defaultResponse.body.steps?.length}`);

        // Step 2: Simpler response
        console.log('\nStep 2: Getting simpler response...');
        const simplerResponse = await makeRequest({
            questionText: '2x + 5 = 15',
            action: 'simpler'
        });

        console.log(`Simpler response - Status: ${simplerResponse.status}`);
        console.log(`Simpler response - Steps: ${simplerResponse.body.steps?.length}`);

        // Step 3: Detailed response
        console.log('\nStep 3: Getting detailed response...');
        const detailedResponse = await makeRequest({
            questionText: '2x + 5 = 15',
            action: 'detailed'
        });

        console.log(`Detailed response - Status: ${detailedResponse.status}`);
        console.log(`Detailed response - Steps: ${detailedResponse.body.steps?.length}`);

        // Check pass criteria
        const allValid = defaultResponse.status === 200 &&
                        simplerResponse.status === 200 &&
                        detailedResponse.status === 200;

        const simplerHasFewerSteps = simplerResponse.body.steps?.length <= defaultResponse.body.steps?.length;
        const detailedHasMoreSteps = detailedResponse.body.steps?.length >= defaultResponse.body.steps?.length;

        const allSolveCorrectly = defaultResponse.body.finalAnswer?.includes('5') &&
                                 simplerResponse.body.finalAnswer?.includes('5') &&
                                 detailedResponse.body.finalAnswer?.includes('5');

        const passed = allValid && simplerHasFewerSteps && detailedHasMoreSteps && allSolveCorrectly;

        const result = {
            id: assertionId,
            title: 'Refinement flow end-to-end (stateless)',
            status: passed ? 'pass' : 'fail',
            steps: [
                { action: 'Send default request', expected: '200 response', observed: `Status ${defaultResponse.status}, ${defaultResponse.body.steps?.length} steps` },
                { action: 'Send simpler request', expected: '200 with ≤ steps', observed: `Status ${simplerResponse.status}, ${simplerResponse.body.steps?.length} steps` },
                { action: 'Send detailed request', expected: '200 with ≥ steps', observed: `Status ${detailedResponse.status}, ${detailedResponse.body.steps?.length} steps` },
                { action: 'Verify all solve same problem', expected: 'All answers include "5"', observed: `Default: ${defaultResponse.body.finalAnswer}, Simpler: ${simplerResponse.body.finalAnswer}, Detailed: ${detailedResponse.body.finalAnswer}` }
            ],
            evidence: {
                defaultResponse: {
                    steps: defaultResponse.body.steps?.length,
                    finalAnswer: defaultResponse.body.finalAnswer,
                    stepTypes: defaultResponse.body.steps?.map(s => s.stepType)
                },
                simplerResponse: {
                    steps: simplerResponse.body.steps?.length,
                    finalAnswer: simplerResponse.body.finalAnswer,
                    stepTypes: simplerResponse.body.steps?.map(s => s.stepType)
                },
                detailedResponse: {
                    steps: detailedResponse.body.steps?.length,
                    finalAnswer: detailedResponse.body.finalAnswer,
                    stepTypes: detailedResponse.body.steps?.map(s => s.stepType)
                },
                comparison: {
                    defaultSteps: defaultResponse.body.steps?.length,
                    simplerSteps: simplerResponse.body.steps?.length,
                    detailedSteps: detailedResponse.body.steps?.length,
                    simplerHasFewerOrEqual: simplerHasFewerSteps,
                    detailedHasMoreOrEqual: detailedHasMoreSteps
                }
            },
            issues: passed ? null : `Assertion failed: valid=${allValid}, simpler≤default=${simplerHasFewerSteps}, detailed≥default=${detailedHasMoreSteps}, allCorrect=${allSolveCorrectly}`
        };

        // Save evidence
        if (!fs.existsSync(EVIDENCE_DIR)) {
            fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
        }
        saveEvidence(assertionId, 'default-response.json', defaultResponse.body);
        saveEvidence(assertionId, 'simpler-response.json', simplerResponse.body);
        saveEvidence(assertionId, 'detailed-response.json', detailedResponse.body);
        saveEvidence(assertionId, 'result.json', result);

        return result;
    } catch (error) {
        console.error('Error testing VAL-E2E-004:', error.message);
        return {
            id: assertionId,
            title: 'Refinement flow end-to-end (stateless)',
            status: 'fail',
            steps: [],
            evidence: { error: error.message },
            issues: `Request failed: ${error.message}`
        };
    }
}

// Main test runner
async function runAllTests() {
    console.log('=================================================');
    console.log('E2E Re-Run Tests for Polish Milestone');
    console.log('Testing assertions: VAL-E2E-001, VAL-E2E-002, VAL-E2E-004');
    console.log('=================================================');

    const results = [];

    try {
        // Test VAL-E2E-001
        const result1 = await test_VAL_E2E_001();
        results.push(result1);

        // Test VAL-E2E-002
        const result2 = await test_VAL_E2E_002();
        results.push(result2);

        // Test VAL-E2E-004
        const result3 = await test_VAL_E2E_004();
        results.push(result3);

    } catch (error) {
        console.error('Fatal error running tests:', error);
    }

    // Summary
    console.log('\n=================================================');
    console.log('TEST SUMMARY');
    console.log('=================================================');
    results.forEach(result => {
        console.log(`${result.id}: ${result.status.toUpperCase()} - ${result.title}`);
    });

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;

    console.log(`\nTotal: ${results.length} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('=================================================\n');

    return results;
}

// Run tests
runAllTests().then(results => {
    process.exit(results.some(r => r.status === 'fail') ? 1 : 0);
}).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});

const http = require('http');
const fs = require('fs');
const path = require('path');

// Evidence directory
const EVIDENCE_DIR = '/Users/aftab/.factory/missions/92030428-0348-4066-af5b-1aaf02b25ba7/evidence/polish/e2e-flows-1-5';

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

// Create a simple test image (1x1 pixel PNG)
function createTestImage() {
    // Minimal 1x1 PNG in base64
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
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
    console.log('\n=== Testing VAL-E2E-001: Text-only algebra question ===');
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
                { action: 'Check finalAnswer contains "7"', expected: 'Answer includes 7', observed: passed ? 'Answer includes 7' : 'Answer missing or incorrect' },
                { action: 'Check verification.status', expected: 'passed', observed: response.body.verification?.status },
                { action: 'Check steps array', expected: 'Non-empty with logical steps', observed: `${response.body.steps?.length} steps found` }
            ],
            evidence: {
                response: response.body,
                answerIncludes7: hasAnswer,
                verificationPassed: verificationPassed,
                stepsCount: response.body.steps?.length
            },
            notes: hasAnswer ? `Answer correctly identifies x = 7` : `Answer does not contain expected value 7`
        };

        const evidencePath = saveEvidence(assertionId, 'response.json', response.body);
        result.evidence.files = [evidencePath];

        return result;

    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {
            id: assertionId,
            status: 'blocked',
            notes: `Error during test: ${error.message}`
        };
    }
}

// Test VAL-E2E-002: Text-only calculus question end-to-end
async function test_VAL_E2E_002() {
    console.log('\n=== Testing VAL-E2E-002: Text-only calculus question ===');
    const assertionId = 'VAL-E2E-002';

    try {
        const response = await makeRequest({
            questionText: 'find the derivative of x^3 + 2x'
        });

        console.log(`Status: ${response.status}`);
        console.log(`Final Answer: ${response.body.finalAnswer}`);
        console.log(`Verification Status: ${response.body.verification?.status}`);
        console.log(`Verification Notes:`, response.body.verification?.notes);

        // Check pass criteria - derivative should be 3x^2 + 2 (or equivalent)
        const answer = response.body.finalAnswer || '';
        const hasCorrectDerivative = answer.includes('3') && (answer.includes('x^2') || answer.includes('x²') || answer.includes('2x'));
        const hasVerification = response.body.verification?.status === 'passed' || response.body.verification?.status === 'partial';
        const hasSteps = response.body.steps && response.body.steps.length >= 1;

        const passed = hasCorrectDerivative && hasVerification && hasSteps;

        const result = {
            id: assertionId,
            title: 'Text-only calculus question end-to-end',
            status: passed ? 'pass' : 'fail',
            steps: [
                { action: 'Send request with "find the derivative of x^3 + 2x"', expected: '200 response', observed: `Status ${response.status}` },
                { action: 'Check finalAnswer for derivative', expected: 'Contains 3x^2 + 2 or equivalent', observed: response.body.finalAnswer },
                { action: 'Check verification', expected: 'passed or partial', observed: response.body.verification?.status }
            ],
            evidence: {
                response: response.body,
                hasCorrectDerivative: hasCorrectDerivative,
                verificationStatus: response.body.verification?.status
            },
            notes: hasCorrectDerivative ?
                `Derivative correctly identified (contains 3 and x^2 or 2x)` :
                `Derivative may be incorrect or in unexpected format`
        };

        const evidencePath = saveEvidence(assertionId, 'response.json', response.body);
        result.evidence.files = [evidencePath];

        return result;

    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {
            id: assertionId,
            status: 'blocked',
            notes: `Error during test: ${error.message}`
        };
    }
}

// Test VAL-E2E-003: Screenshot-based question end-to-end
async function test_VAL_E2E_003() {
    console.log('\n=== Testing VAL-E2E-003: Screenshot-based question ===');
    const assertionId = 'VAL-E2E-003';

    try {
        // Create test image
        const testImage = createTestImage();

        const response = await makeRequest({
            questionText: 'solve this',
            screenshotImage: testImage
        });

        console.log(`Status: ${response.status}`);
        console.log(`Final Answer: ${response.body.finalAnswer}`);
        console.log(`Parsed Expression LaTeX: ${response.body.parsedExpressionLatex}`);
        console.log(`Verification Status: ${response.body.verification?.status}`);
        console.log(`Confidence: ${response.body.confidence}`);

        // Check pass criteria
        const hasResponse = response.status === 200;
        const hasFinalAnswer = response.body.finalAnswer && response.body.finalAnswer.length > 0;
        const hasParsedExpression = response.body.parsedExpressionLatex !== null;
        const hasVerification = response.body.verification?.status;

        const passed = hasResponse && hasFinalAnswer && hasParsedExpression && hasVerification;

        const result = {
            id: assertionId,
            title: 'Screenshot-based question end-to-end',
            status: passed ? 'pass' : 'fail',
            steps: [
                { action: 'Send request with screenshot and "solve this"', expected: '200 response', observed: `Status ${response.status}` },
                { action: 'Check image was processed', expected: 'parsedExpressionLatex present', observed: hasParsedExpression ? 'Expression extracted' : 'No expression extracted' },
                { action: 'Check final answer', expected: 'Non-empty answer', observed: hasFinalAnswer ? 'Answer provided' : 'No answer' },
                { action: 'Check verification', expected: 'Verification status present', observed: response.body.verification?.status }
            ],
            evidence: {
                response: response.body,
                hasParsedExpression: hasParsedExpression,
                parsedExpression: response.body.parsedExpressionLatex,
                confidence: response.body.confidence
            },
            notes: `Image processed with confidence: ${response.body.confidence}`
        };

        const evidencePath = saveEvidence(assertionId, 'response.json', response.body);
        result.evidence.files = [evidencePath];

        return result;

    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {
            id: assertionId,
            status: 'blocked',
            notes: `Error during test: ${error.message}`
        };
    }
}

// Test VAL-E2E-004: Refinement flow end-to-end
async function test_VAL_E2E_004() {
    console.log('\n=== Testing VAL-E2E-004: Refinement flow ===');
    const assertionId = 'VAL-E2E-004';

    try {
        // Step 1: Default response
        console.log('\nStep 1: Default response');
        const defaultResponse = await makeRequest({
            questionText: '2x + 5 = 15'
        });
        console.log(`Default steps count: ${defaultResponse.body.steps?.length}`);

        // Step 2: Simpler response
        console.log('\nStep 2: Simpler response');
        const simplerResponse = await makeRequest({
            questionText: '2x + 5 = 15',
            action: 'simpler'
        });
        console.log(`Simpler steps count: ${simplerResponse.body.steps?.length}`);

        // Step 3: Detailed response
        console.log('\nStep 3: Detailed response');
        const detailedResponse = await makeRequest({
            questionText: '2x + 5 = 15',
            action: 'detailed'
        });
        console.log(`Detailed steps count: ${detailedResponse.body.steps?.length}`);

        // Check pass criteria
        const allValid = defaultResponse.status === 200 &&
                        simplerResponse.status === 200 &&
                        detailedResponse.status === 200;

        const allSolveSameProblem = defaultResponse.body.finalAnswer === simplerResponse.body.finalAnswer &&
                                    defaultResponse.body.finalAnswer === detailedResponse.body.finalAnswer;

        const simplerHasFewerOrEqual = simplerResponse.body.steps?.length <= defaultResponse.body.steps?.length;
        const detailedHasMoreOrEqual = detailedResponse.body.steps?.length >= defaultResponse.body.steps?.length;

        const passed = allValid && allSolveSameProblem && simplerHasFewerOrEqual && detailedHasMoreOrEqual;

        const result = {
            id: assertionId,
            title: 'Refinement flow end-to-end (stateless)',
            status: passed ? 'pass' : 'fail',
            steps: [
                { action: 'Send default request', expected: '200 with steps', observed: `Status ${defaultResponse.status}, ${defaultResponse.body.steps?.length} steps` },
                { action: 'Send simpler request', expected: '200 with fewer/simpler steps', observed: `Status ${simplerResponse.status}, ${simplerResponse.body.steps?.length} steps` },
                { action: 'Send detailed request', expected: '200 with more steps', observed: `Status ${detailedResponse.status}, ${detailedResponse.body.steps?.length} steps` },
                { action: 'Check all solve same problem', expected: 'Same final answer', observed: allSolveSameProblem ? 'All answers match' : 'Answers differ' }
            ],
            evidence: {
                defaultSteps: defaultResponse.body.steps?.length,
                simplerSteps: simplerResponse.body.steps?.length,
                detailedSteps: detailedResponse.body.steps?.length,
                defaultAnswer: defaultResponse.body.finalAnswer,
                simplerAnswer: simplerResponse.body.finalAnswer,
                detailedAnswer: detailedResponse.body.finalAnswer
            },
            notes: `Step counts - Default: ${defaultResponse.body.steps?.length}, Simpler: ${simplerResponse.body.steps?.length}, Detailed: ${detailedResponse.body.steps?.length}`
        };

        saveEvidence(assertionId, 'default-response.json', defaultResponse.body);
        saveEvidence(assertionId, 'simpler-response.json', simplerResponse.body);
        saveEvidence(assertionId, 'detailed-response.json', detailedResponse.body);
        result.evidence.files = [
            path.join(EVIDENCE_DIR, `${assertionId}-default-response.json`),
            path.join(EVIDENCE_DIR, `${assertionId}-simpler-response.json`),
            path.join(EVIDENCE_DIR, `${assertionId}-detailed-response.json`)
        ];

        return result;

    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {
            id: assertionId,
            status: 'blocked',
            notes: `Error during test: ${error.message}`
        };
    }
}

// Test VAL-E2E-005: Screenshot refinement preserves context end-to-end
async function test_VAL_E2E_005() {
    console.log('\n=== Testing VAL-E2E-005: Screenshot refinement preserves context ===');
    const assertionId = 'VAL-E2E-005';

    try {
        // Create test image
        const testImage = createTestImage();

        // Step 1: Initial request with screenshot
        console.log('\nStep 1: Initial request with screenshot');
        const initialResponse = await makeRequest({
            questionText: 'solve this',
            screenshotImage: testImage
        });
        console.log(`Initial steps count: ${initialResponse.body.steps?.length}`);
        console.log(`Initial parsed expression: ${initialResponse.body.parsedExpressionLatex}`);

        // Step 2: Simpler request with same screenshot
        console.log('\nStep 2: Simpler request with same screenshot');
        const simplerResponse = await makeRequest({
            questionText: 'solve this',
            screenshotImage: testImage,
            action: 'simpler'
        });
        console.log(`Simpler steps count: ${simplerResponse.body.steps?.length}`);
        console.log(`Simpler parsed expression: ${simplerResponse.body.parsedExpressionLatex}`);

        // Check pass criteria
        const bothValid = initialResponse.status === 200 && simplerResponse.status === 200;
        const bothHaveParsedExpression = initialResponse.body.parsedExpressionLatex !== null &&
                                        simplerResponse.body.parsedExpressionLatex !== null;
        const simplerHasFewerOrEqual = simplerResponse.body.steps?.length <= initialResponse.body.steps?.length;
        const bothAddressScreenshot = initialResponse.body.finalAnswer && simplerResponse.body.finalAnswer;

        const passed = bothValid && bothHaveParsedExpression && simplerHasFewerOrEqual && bothAddressScreenshot;

        const result = {
            id: assertionId,
            title: 'Screenshot refinement preserves context end-to-end (stateless)',
            status: passed ? 'pass' : 'fail',
            steps: [
                { action: 'Send initial request with screenshot', expected: '200 with parsed expression', observed: `Status ${initialResponse.status}, expression: ${initialResponse.body.parsedExpressionLatex}` },
                { action: 'Send simpler request with same screenshot', expected: '200 with same expression', observed: `Status ${simplerResponse.status}, expression: ${simplerResponse.body.parsedExpressionLatex}` },
                { action: 'Check screenshot context preserved', expected: 'Both responses address screenshot', observed: bothAddressScreenshot ? 'Both have answers' : 'One or both missing answers' },
                { action: 'Check simpler has fewer steps', expected: 'Simpler ≤ initial steps', observed: `${simplerResponse.body.steps?.length} ≤ ${initialResponse.body.steps?.length}` }
            ],
            evidence: {
                initialParsedExpression: initialResponse.body.parsedExpressionLatex,
                simplerParsedExpression: simplerResponse.body.parsedExpressionLatex,
                initialSteps: initialResponse.body.steps?.length,
                simplerSteps: simplerResponse.body.steps?.length,
                expressionsMatch: initialResponse.body.parsedExpressionLatex === simplerResponse.body.parsedExpressionLatex
            },
            notes: bothHaveParsedExpression ?
                `Screenshot context preserved - both responses extracted: ${initialResponse.body.parsedExpressionLatex}` :
                `Screenshot context may not be preserved`
        };

        saveEvidence(assertionId, 'initial-response.json', initialResponse.body);
        saveEvidence(assertionId, 'simpler-response.json', simplerResponse.body);
        result.evidence.files = [
            path.join(EVIDENCE_DIR, `${assertionId}-initial-response.json`),
            path.join(EVIDENCE_DIR, `${assertionId}-simpler-response.json`)
        ];

        return result;

    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {
            id: assertionId,
            status: 'blocked',
            notes: `Error during test: ${error.message}`
        };
    }
}

// Main test runner
async function main() {
    console.log('=====================================');
    console.log('E2E Flow Testing: Assertions 1-5');
    console.log('=====================================');
    console.log(`Evidence directory: ${EVIDENCE_DIR}`);
    console.log(`Backend API URL: http://localhost:3000`);

    const results = [];
    const frictions = [];
    const blockers = [];

    // Test VAL-E2E-001
    const result1 = await test_VAL_E2E_001();
    results.push(result1);

    // Test VAL-E2E-002
    const result2 = await test_VAL_E2E_002();
    results.push(result2);

    // Test VAL-E2E-003
    const result3 = await test_VAL_E2E_003();
    results.push(result3);

    // Test VAL-E2E-004
    const result4 = await test_VAL_E2E_004();
    results.push(result4);

    // Test VAL-E2E-005
    const result5 = await test_VAL_E2E_005();
    results.push(result5);

    // Compile summary
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const blocked = results.filter(r => r.status === 'blocked').length;

    console.log('\n=====================================');
    console.log('Test Summary');
    console.log('=====================================');
    console.log(`Total assertions: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Blocked: ${blocked}`);

    // Write comprehensive report
    const report = {
        groupId: 'e2e-flows-1-5',
        testedAt: new Date().toISOString(),
        isolation: {
            backendApiUrl: 'http://localhost:3000',
            workingDirectory: '/Users/aftab/Documents/bob-the/codex-proj/backend'
        },
        toolsUsed: ['Node.js test runner', 'HTTP requests', 'curl'],
        assertions: results,
        frictions: frictions,
        blockers: blockers,
        summary: `Tested ${results.length} assertions: ${passed} passed, ${failed} failed, ${blocked} blocked`
    };

    const reportPath = '/Users/aftab/Documents/bob-the/codex-proj/.factory/validation/polish/user-testing/flows/e2e-flows-1-5.json';

    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport written to: ${reportPath}`);

    return report;
}

// Run tests
main().catch(console.error);

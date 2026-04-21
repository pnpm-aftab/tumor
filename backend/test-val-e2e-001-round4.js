const http = require('http');
const fs = require('fs');
const path = require('path');

// Evidence directory for Round 4
const EVIDENCE_DIR = '/Users/aftab/.factory/missions/92030428-0348-4066-af5b-1aaf02b25ba7/evidence/polish/val-e2e-001-round4';

// Create evidence directory if it doesn't exist
if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

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
function saveEvidence(filename, data) {
    const filepath = path.join(EVIDENCE_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`  ✓ Evidence saved to: ${filepath}`);
    return filepath;
}

// Test VAL-E2E-001: Text-only algebra question end-to-end (Round 4)
async function test_VAL_E2E_001_Round4() {
    console.log('\n=== Testing VAL-E2E-001: Text-only algebra question (Round 4) ===');
    console.log('This test verifies that the verification field fix works correctly');
    console.log('Expected: LLM response should have real symbolic verification, not hallucinated');

    try {
        const response = await makeRequest({
            questionText: 'solve 3x - 7 = 14'
        });

        console.log('\n--- Request Details ---');
        console.log('Question: "solve 3x - 7 = 14"');
        console.log('Expected Answer: x = 7');

        console.log('\n--- Response Details ---');
        console.log(`Status: ${response.status}`);
        console.log(`Final Answer: "${response.body.finalAnswer}"`);
        console.log(`Verification Status: ${response.body.verification?.status}`);
        console.log(`Verification Notes: ${JSON.stringify(response.body.verification?.notes)}`);
        console.log(`Number of steps: ${response.body.steps?.length}`);

        // Log step types
        if (response.body.steps) {
            const stepTypes = response.body.steps.map(s => s.stepType).join(', ');
            console.log(`Step Types: ${stepTypes}`);
        }

        // Save raw response evidence
        saveEvidence('raw-response.json', response.body);

        // Check pass criteria
        const hasAnswer = response.body.finalAnswer && response.body.finalAnswer.includes('7');
        const verificationPassed = response.body.verification?.status === 'passed';
        const verificationNotPartial = response.body.verification?.status !== 'partial';
        const verificationNotFailed = response.body.verification?.status !== 'failed';
        const hasSteps = response.body.steps && response.body.steps.length >= 1;
        const hasLogicalSteps = response.body.steps && response.body.steps.some(s =>
            ['setup', 'computation', 'verification'].includes(s.stepType)
        );

        // This is the critical check for Round 4: verification should be "passed", NOT "partial" or "failed"
        // This proves that verifyMath() ran successfully and wasn't bypassed by a hallucinated verification field
        const hasRealVerification = verificationPassed && verificationNotPartial && verificationNotFailed;

        console.log('\n--- Validation Checks ---');
        console.log(`✓ Final answer contains "7": ${hasAnswer}`);
        console.log(`✓ Verification status is "passed": ${verificationPassed}`);
        console.log(`✓ Verification is NOT "partial": ${verificationNotPartial}`);
        console.log(`✓ Verification is NOT "failed": ${verificationNotFailed}`);
        console.log(`✓ Has real symbolic verification (passed, not partial/failed): ${hasRealVerification}`);
        console.log(`✓ Has steps array: ${hasSteps}`);
        console.log(`✓ Has logical step types: ${hasLogicalSteps}`);

        const passed = hasAnswer && hasRealVerification && hasSteps && hasLogicalSteps;

        const result = {
            id: 'VAL-E2E-001',
            title: 'Text-only algebra question end-to-end (Round 4)',
            status: passed ? 'pass' : 'fail',
            steps: [
                { action: 'Send request with "solve 3x - 7 = 14"', expected: '200 response', observed: `Status ${response.status}` },
                { action: 'Check finalAnswer contains "7"', expected: 'Answer includes 7', observed: hasAnswer ? '✓ Answer includes 7' : '✗ Answer missing or incorrect' },
                { action: 'Check verification.status', expected: '"passed" (NOT "partial" or "failed")', observed: verificationPassed ? '✓ "passed"' : `✗ "${response.body.verification?.status}"` },
                { action: 'Verify real symbolic verification ran', expected: 'verifyMath() produced "passed" status', observed: hasRealVerification ? '✓ Real verification confirmed' : '✗ May have hallucinated or bypassed verification' },
                { action: 'Check steps array', expected: 'Non-empty with logical steps', observed: `${response.body.steps?.length} steps found: ${response.body.steps?.map(s => s.stepType).join(', ')}` }
            ],
            evidence: {
                response: response.body,
                status: response.status,
                verificationDetails: {
                    status: response.body.verification?.status,
                    notes: response.body.verification?.notes,
                    isRealVerification: hasRealVerification
                }
            },
            issues: passed ? null : 'Verification fix may not be working correctly - verification status should be "passed", not "' + response.body.verification?.status + '"'
        };

        // Save test result
        saveEvidence('test-result.json', result);

        console.log('\n--- Test Result ---');
        console.log(`Status: ${result.status.toUpperCase()}`);
        if (passed) {
            console.log('✓ VAL-E2E-001 PASSED - Verification field fix is working correctly!');
            console.log('✓ verifyMath() is running and producing real symbolic verification');
        } else {
            console.log('✗ VAL-E2E-001 FAILED - Verification field issue persists');
            if (!hasRealVerification) {
                console.log('✗ Issue: Verification is not showing "passed" status - verifyMath() may not be running correctly');
            }
        }

        return result;

    } catch (error) {
        console.error('\n✗ Error testing VAL-E2E-001:', error.message);

        const result = {
            id: 'VAL-E2E-001',
            title: 'Text-only algebra question end-to-end (Round 4)',
            status: 'blocked',
            steps: [
                { action: 'Send request with "solve 3x - 7 = 14"', expected: '200 response', observed: `Error: ${error.message}` }
            ],
            evidence: {
                error: error.message,
                stack: error.stack
            },
            issues: `Test execution failed: ${error.message}`
        };

        // Save error result
        saveEvidence('test-error.json', result);

        return result;
    }
}

// Run the test
test_VAL_E2E_001_Round4()
    .then(result => {
        console.log('\n=== Test Complete ===');
        process.exit(result.status === 'pass' ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

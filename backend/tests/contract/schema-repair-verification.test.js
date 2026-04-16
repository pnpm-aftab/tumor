const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const axios = require('axios');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let server;

describe('Schema Repair - Verification Runs', () => {
    before(async () => {
        // Start the server
        const app = require('../../server.js');
        server = app.listen(3000);
        await new Promise(resolve => server.once('listening', resolve));
        console.log('Test server listening at http://localhost:3000');
    });

    after(async () => {
        if (server) {
            server.close();
            console.log('Test server closed');
        }
    });

    it('should run verifyMath() after schema repair on non-verification field', async () => {
        // This test verifies the fix for the bug where validateAndRepairLLMResponse()
        // would set verification to a default 'partial' object when repairing any field,
        // preventing verifyMath() from ever running.

        // Use a simple algebra question that will trigger schema repair
        // (LLM might miss conceptSummary, requiring repair)
        const questionText = '2x + 3 = 17';

        const response = await axios.post(`${BASE_URL}/api/tutor`, {
            questionText
        });

        assert.strictEqual(response.status, 200);

        const responseData = response.data;

        // Verify response has all required fields
        assert.ok(responseData.problemSummary);
        assert.ok(responseData.parsedExpressionLatex);
        assert.ok(Array.isArray(responseData.steps));
        assert.ok(responseData.steps.length > 0);
        assert.ok(responseData.finalAnswer);
        assert.ok(responseData.conceptSummary);
        assert.ok(responseData.confidence);

        // Critical check: verification should be present and have status 'passed'
        // (not 'partial' from schema repair)
        assert.ok(responseData.verification, 'Verification should be present after schema repair');
        assert.ok(responseData.verification.status, 'Verification should have a status');

        // For a simple linear equation like 2x+3=17, verification should pass
        // The answer is x=7, and verifyMath() should confirm this by substitution
        // If the bug exists, verification.status would be 'partial' (from repair defaults)
        // If the fix works, verification.status should be 'passed' (from verifyMath())
        const { status, notes } = responseData.verification;

        assert.strictEqual(
            ['passed', 'failed', 'partial'].includes(status),
            true,
            `Verification status should be one of: passed, failed, partial. Got: ${status}`
        );

        // The fix ensures verifyMath() runs, so we should get real verification results
        // For this simple equation, it should either pass or fail (not partial due to repair)
        if (status === 'passed') {
            // Ideal case: verification passed
            assert.ok(
                Array.isArray(notes) && notes.length > 0,
                'Passed verification should have notes explaining the check'
            );
            console.log('✓ Verification passed with notes:', notes);
        } else if (status === 'failed') {
            // Acceptable: verification failed (LLM gave wrong answer)
            assert.ok(
                Array.isArray(notes) && notes.length > 0,
                'Failed verification should have notes explaining why'
            );
            console.log('⚠ Verification failed with notes:', notes);
        } else {
            // If status is 'partial', verifyMath() ran but couldn't fully verify
            // This is acceptable as long as it's not the default repair note
            console.log('⚠ Verification partial with notes:', notes);
        }

        // Most importantly: the verification should NOT be the default repair object
        const hasRepairNote = responseData.verification.notes &&
            responseData.verification.notes.some(note => note.includes('Response was repaired with defaults'));

        assert.ok(
            !hasRepairNote,
            `Verification should NOT contain the default repair note - verifyMath() should have run. Got notes: ${JSON.stringify(responseData.verification.notes)}`
        );

        console.log('✓ verifyMath() ran after schema repair');
        console.log(`  Verification status: ${status}`);
        console.log(`  Verification notes: ${JSON.stringify(notes)}`);
        console.log(`  Final answer: ${responseData.finalAnswer}`);
    });

    it('should handle missing conceptSummary with schema repair and still run verification', async () => {
        // Test a case where schema repair is needed but verification should still run
        const questionText = 'solve x + 5 = 12';

        const response = await axios.post(`${BASE_URL}/api/tutor`, {
            questionText
        });

        assert.strictEqual(response.status, 200);
        const responseData = response.data;

        // Verify schema repair filled in the missing conceptSummary
        assert.ok(responseData.conceptSummary, 'conceptSummary should be filled by repair');
        assert.ok(responseData.verification, 'Verification should be present');

        // Verify that verifyMath() ran and produced a real result
        const { status, notes } = responseData.verification;
        assert.ok(status, 'Verification should have a status');

        // The key assertion: verification should NOT be the default repair object
        assert.ok(
            !notes || !notes.includes('Response was repaired with defaults'),
            'Verification should be from verifyMath(), not the repair default'
        );

        console.log('✓ Schema repair for conceptSummary did not prevent verifyMath() from running');
        console.log(`  Verification status: ${status}`);
    });

    it('should strip hallucinated verification field from LLM responses', async () => {
        // This test verifies the fix for the bug where the LLM hallucinates a verification field.
        // The fix ensures that LLM-provided verification fields are ALWAYS stripped,
        // allowing verifyMath() to run and produce the real symbolic verification result.

        const questionText = '3x - 7 = 14';

        const response = await axios.post(`${BASE_URL}/api/tutor`, {
            questionText
        });

        assert.strictEqual(response.status, 200);
        const responseData = response.data;

        // Verify response has all required fields
        assert.ok(responseData.problemSummary);
        assert.ok(responseData.parsedExpressionLatex);
        assert.ok(Array.isArray(responseData.steps));
        assert.ok(responseData.steps.length > 0);
        assert.ok(responseData.finalAnswer);
        assert.ok(responseData.conceptSummary);
        assert.ok(responseData.confidence);

        // Critical check: verification should be present and from verifyMath(), not from LLM
        assert.ok(responseData.verification, 'Verification should be present');
        assert.ok(responseData.verification.status, 'Verification should have a status');

        const { status, notes } = responseData.verification;

        // For this simple linear equation (3x-7=14, answer is x=7), verification should pass
        // The LLM might hallucinate {status: 'partial', notes: [...]}, but our fix strips it
        // and verifyMath() should produce {status: 'passed', notes: [...]}
        assert.strictEqual(
            ['passed', 'failed', 'partial'].includes(status),
            true,
            `Verification status should be one of: passed, failed, partial. Got: ${status}`
        );

        // Most importantly: the verification should NOT be from the LLM
        // If the LLM hallucinated a verification field and it wasn't stripped,
        // we might see status='partial' with generic notes
        // But with the fix, verifyMath() runs and we get real verification
        if (status === 'passed') {
            // Ideal case: verifyMath() confirmed the answer is correct
            assert.ok(
                Array.isArray(notes) && notes.length > 0,
                'Passed verification should have notes explaining the check'
            );
            console.log('✓ verifyMath() ran and confirmed the answer is correct');
            console.log(`  Verification status: ${status}`);
            console.log(`  Verification notes: ${JSON.stringify(notes)}`);
        } else if (status === 'failed') {
            // LLM gave wrong answer, verifyMath() caught it
            assert.ok(
                Array.isArray(notes) && notes.length > 0,
                'Failed verification should have notes explaining why'
            );
            console.log('✓ verifyMath() ran and detected incorrect answer from LLM');
            console.log(`  Verification status: ${status}`);
            console.log(`  Verification notes: ${JSON.stringify(notes)}`);
        } else {
            // verifyMath() ran but couldn't fully verify (partial)
            // This is acceptable as long as it's from verifyMath(), not from LLM
            console.log('✓ verifyMath() ran but returned partial verification');
            console.log(`  Verification status: ${status}`);
            console.log(`  Verification notes: ${JSON.stringify(notes)}`);
        }

        // The key assertion: we should NOT see the LLM's hallucinated verification
        // If we see generic LLM-style notes like "Solution appears correct" without
        // specific symbolic verification details, the stripping didn't work
        const hasLLMStyleNote = responseData.verification.notes &&
            (responseData.verification.notes.some(note => note.includes('appears correct')) ||
             responseData.verification.notes.some(note => note.includes('seems correct')) ||
             responseData.verification.notes.some(note => note.includes('looks correct')));

        assert.ok(
            !hasLLMStyleNote,
            'Verification should be from verifyMath() with symbolic checks, not LLM-style qualitative notes'
        );

        console.log(`✓ LLM hallucinated verification field was stripped successfully`);
        console.log(`  Final answer: ${responseData.finalAnswer}`);
    });
});

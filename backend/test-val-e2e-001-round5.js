#!/usr/bin/env node

/**
 * VAL-E2E-001 Round 5 Test
 * Testing text-only algebra question end-to-end
 * 
 * Round 5 focuses on verifying that the answer format normalization fix works.
 * Previous rounds found that verifyLinearEquation() expected 'x=7' format but LLM returned '7',
 * causing verification.status to be 'partial' instead of 'passed'.
 * 
 * The fix "Fix: Add answer format normalization to verifyLinearEquation() and verifyQuadraticEquation()"
 * should handle multiple answer formats including bare numbers like '7'.
 */

const http = require('http');

const API_URL = 'http://localhost:3000/api/tutor';
const QUESTION_TEXT = 'solve 3x - 7 = 14';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body, // Raw body if JSON parsing fails
            parseError: error.message
          });
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

function validateResponse(response) {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  log('\n=== VALIDATION RESULTS ===', 'cyan');

  // Check 1: HTTP status is 200
  if (response.statusCode === 200) {
    results.passed.push('HTTP Status: 200 OK');
    log('✓ HTTP Status: 200 OK', 'green');
  } else {
    results.failed.push(`HTTP Status: ${response.statusCode} (expected 200)`);
    log(`✗ HTTP Status: ${response.statusCode} (expected 200)`, 'red');
  }

  const body = response.body;

  // Check 2: Response has all required top-level keys
  const requiredKeys = ['problemSummary', 'parsedExpressionLatex', 'steps', 'finalAnswer', 'conceptSummary', 'confidence', 'verification'];
  const missingKeys = requiredKeys.filter(key => !(key in body));

  if (missingKeys.length === 0) {
    results.passed.push('All required top-level keys present');
    log('✓ All required top-level keys present', 'green');
  } else {
    results.failed.push(`Missing top-level keys: ${missingKeys.join(', ')}`);
    log(`✗ Missing top-level keys: ${missingKeys.join(', ')}`, 'red');
  }

  // Check 3: finalAnswer contains "7" (the correct answer)
  if (body.finalAnswer && body.finalAnswer.includes('7')) {
    results.passed.push(`finalAnswer contains "7": "${body.finalAnswer}"`);
    log(`✓ finalAnswer contains "7": "${body.finalAnswer}"`, 'green');
  } else {
    results.failed.push(`finalAnswer does not contain "7": "${body.finalAnswer}"`);
    log(`✗ finalAnswer does not contain "7": "${body.finalAnswer}"`, 'red');
  }

  // Check 4: CRITICAL FOR ROUND 5: verification.status === "passed"
  if (body.verification && body.verification.status === 'passed') {
    results.passed.push(`verification.status === "passed" (ROUND 5 FIX CONFIRMED)`);
    log(`✓ verification.status === "passed" (ROUND 5 FIX CONFIRMED)`, 'green');
  } else if (body.verification && body.verification.status === 'partial') {
    results.failed.push(`verification.status === "partial" (ROUND 5 FIX FAILED - still getting partial)`);
    log(`✗ verification.status === "partial" (ROUND 5 FIX FAILED - still getting partial)`, 'red');
    if (body.verification.notes) {
      results.warnings.push(`Verification notes: ${body.verification.notes.join('; ')}`);
      log(`  Notes: ${body.verification.notes.join('; ')}`, 'yellow');
    }
  } else if (body.verification && body.verification.status === 'failed') {
    results.failed.push(`verification.status === "failed"`);
    log(`✗ verification.status === "failed"`, 'red');
  } else {
    results.failed.push(`verification.status missing or invalid: ${body.verification ? body.verification.status : 'no verification object'}`);
    log(`✗ verification.status missing or invalid: ${body.verification ? body.verification.status : 'no verification object'}`, 'red');
  }

  // Check 5: steps array is non-empty
  if (Array.isArray(body.steps) && body.steps.length > 0) {
    results.passed.push(`steps array is non-empty (${body.steps.length} steps)`);
    log(`✓ steps array is non-empty (${body.steps.length} steps)`, 'green');
  } else {
    results.failed.push('steps array is empty or missing');
    log('✗ steps array is empty or missing', 'red');
  }

  // Check 6: steps follow logical ordering (setup → computation → verification)
  if (Array.isArray(body.steps) && body.steps.length > 0) {
    const stepTypes = body.steps.map(s => s.stepType);
    const hasSetup = stepTypes.includes('setup');
    const hasComputation = stepTypes.includes('computation');
    const hasVerification = stepTypes.includes('verification');

    if (hasSetup && hasComputation) {
      results.passed.push('steps include setup and computation phases');
      log('✓ steps include setup and computation phases', 'green');
    } else {
      results.warnings.push(`steps may not follow logical order (types: ${stepTypes.join(', ')})`);
      log(`⚠ steps may not follow logical order (types: ${stepTypes.join(', ')})`, 'yellow');
    }

    if (hasVerification) {
      results.passed.push('steps include verification phase');
      log('✓ steps include verification phase', 'green');
    }
  }

  // Check 7: confidence is one of the allowed values
  const allowedConfidence = ['low', 'medium', 'high'];
  if (allowedConfidence.includes(body.confidence)) {
    results.passed.push(`confidence is valid: "${body.confidence}"`);
    log(`✓ confidence is valid: "${body.confidence}"`, 'green');
  } else {
    results.failed.push(`confidence is invalid: "${body.confidence}"`);
    log(`✗ confidence is invalid: "${body.confidence}"`, 'red');
  }

  return results;
}

async function main() {
  log('=== VAL-E2E-001 ROUND 5 TEST ===', 'cyan');
  log('Testing text-only algebra question end-to-end', 'cyan');
  log(`Question: "${QUESTION_TEXT}"`, 'blue');
  log(`API URL: ${API_URL}`, 'blue');
  log('', 'reset');

  try {
    log('Sending request...', 'blue');
    const response = await makeRequest(API_URL, {
      questionText: QUESTION_TEXT
    });

    log('\n=== RAW RESPONSE ===', 'cyan');
    log(`Status: ${response.statusCode}`, 'blue');
    log('Headers:', 'blue');
    console.log(JSON.stringify(response.headers, null, 2));
    log('\nBody:', 'blue');
    console.log(JSON.stringify(response.body, null, 2));

    const results = validateResponse(response);

    log('\n=== SUMMARY ===', 'cyan');
    log(`Passed: ${results.passed.length}`, results.failed.length === 0 ? 'green' : 'reset');
    log(`Failed: ${results.failed.length}`, results.failed.length > 0 ? 'red' : 'reset');
    log(`Warnings: ${results.warnings.length}`, 'yellow');

    if (results.failed.length === 0) {
      log('\n✓ ALL CHECKS PASSED - ROUND 5 FIX SUCCESSFUL', 'green');
      process.exit(0);
    } else {
      log('\n✗ SOME CHECKS FAILED - ROUND 5 FIX INCOMPLETE', 'red');
      process.exit(1);
    }

  } catch (error) {
    log(`\n✗ ERROR: ${error.message}`, 'red');
    log(error.stack, 'red');
    process.exit(1);
  }
}

main();

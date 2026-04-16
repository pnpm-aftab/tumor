# Testing OCR Functionality with Base64-Encoded Images

**Pattern discovered in:** `screenshot-image-handling` feature (milestone: image-handling)

## Problem

How to test OCR and image processing functionality without requiring actual image files or external dependencies?

## Solution

Use small base64-encoded test images (1x1 PNG placeholders) in integration tests. This approach:
- Avoids requiring actual image files in the test suite
- Eliminates external file dependencies
- Provides deterministic test data
- Works well for testing API contract and error handling

## Example

From `backend/tests/integration/screenshot-handling.test.js`:

```javascript
// Small base64 test images for OCR testing
const MATH_EQUATION_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const POOR_QUALITY_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const NON_MATH_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Use in tests
const response = await axios.post('http://localhost:3000/api/tutor', {
  questionText: 'solve this equation',
  screenshotImage: MATH_EQUATION_IMAGE
});
```

## When to Use

- Testing image upload endpoints
- Validating image size limits and validation
- Testing OCR/image processing contract behavior
- Mock mode testing for multimodal LLM features

## Benefits

- No external file dependencies
- Tests are self-contained
- Deterministic test data
- Easy to version control

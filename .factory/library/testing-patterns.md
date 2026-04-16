# Testing Patterns and Conventions

## Mock Mode Test Assumptions

When writing tests that use mock mode, be aware that LLM mock responses may not match initial expectations. You'll often need to iterate on test assertions to match actual mock behavior.

**Example**: The mock response logic for `POOR_QUALITY_IMAGE` expects the question to be exactly "solve this equation", but a test using "solve x + 3 = 10" with `POOR_QUALITY_IMAGE` will need adjusted expectations.

**Pattern**: Run tests, observe actual mock behavior, and update assertions accordingly.

## Character Limit Testing

When testing string length limits, account for all characters in the string construction including prefixes and repeated patterns.

**Example**: `"solve " + "x ".repeat(500)` creates `"solve xxxxxx..."` which is `6 + 500*2 = 1006` characters, not just the repeated pattern length.

**Pattern**: Calculate total length as: `prefix.length + (pattern.length * repeat_count)`

## Integration Test Best Practices

For integration tests involving LLMs or other non-deterministic systems, validate responses by checking structure and field presence rather than exact values.

**Example**: Instead of asserting exact response content:
```javascript
assert.strictEqual(response.body.finalAnswer, "x = 2"); // Too brittle
```

Check for structure and presence:
```javascript
assert.ok(response.body.finalAnswer && response.body.finalAnswer.length > 0); // Better
```

**Pattern**: Focus on response shape, field types, and structural requirements rather than specific content when dealing with non-deterministic outputs.

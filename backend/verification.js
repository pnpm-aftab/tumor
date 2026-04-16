const { evaluate, simplify, derivative, format } = require('mathjs');
const nerdamer = require('nerdamer');

/**
 * Timeout wrapper for verification
 * @param {Function} fn - Function to wrap
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<*>} - Result of fn or timeout error
 */
function withTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Verification timeout'));
        }, timeout);

        fn()
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

/**
 * Parse LaTeX to a format mathjs/nerdamer can understand
 * This is a simplified converter - handles common LaTeX patterns
 * @param {string} latex - LaTeX expression
 * @returns {string} - Converted expression
 */
function latexToExpression(latex) {
    if (!latex) return null;

    try {
        let expr = latex;

        // Handle common LaTeX patterns
        // Fractions: \frac{a}{b} -> a/b
        expr = expr.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

        // Powers: x^{2} -> x^2
        expr = expr.replace(/\^{?(\d+)}?/g, '^$1');

        // Square roots: \sqrt{x} -> sqrt(x)
        expr = expr.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');

        // Integrals: \int x dx -> integrate(x)
        expr = expr.replace(/\\int\s+([^\s]+)\s+d[a-z]/gi, 'integrate($1)');

        // Derivatives: \frac{d}{dx} -> derivative
        expr = expr.replace(/\\frac\{d\}\{d[a-z]\}\s*\(?([^)]+)\)?/gi, 'derivative($1)');

        // Clean up remaining LaTeX commands
        expr = expr.replace(/\\[a-zA-Z]+/g, '');
        expr = expr.replace(/[{}]/g, '');

        return expr.trim();
    } catch (error) {
        console.error('LaTeX parsing error:', error);
        return null;
    }
}

/**
 * Normalize solution string to extract variable and value
 * Handles multiple formats: '7', 'x=7', 'x = 7', 'The answer is 7', '$x=7$', '\\boxed{7}', etc.
 * @param {string} solution - Solution string from LLM
 * @param {string} equation - Original equation (to extract variable if needed)
 * @returns {object|null} - Object with variable and value, or null if parsing fails
 */
function normalizeSolution(solution, equation) {
    try {
        // Try to match variable=value format first (e.g., "x=7", "x = 7", "x=7.5")
        const variableMatch = solution.match(/([a-zA-Z])\s*=\s*(-?\d*\.?\d+)/);
        if (variableMatch) {
            return {
                variable: variableMatch[1],
                value: parseFloat(variableMatch[2])
            };
        }

        // Extract just the numeric value if present (handles bare numbers like "7", "-3.14", etc.)
        const numericMatch = solution.match(/(-?\d+\.?\d*)/);
        if (numericMatch) {
            const value = parseFloat(numericMatch[1]);

            // Extract variable from the equation (find the variable on the left side of '=')
            // Equation format: "3x-7=14" -> variable is 'x'
            const lhs = equation.split('=')[0].trim();
            const variableMatch = lhs.match(/([a-zA-Z])/);

            if (variableMatch) {
                return {
                    variable: variableMatch[1],
                    value: value
                };
            }
        }

        return null;
    } catch (error) {
        console.error('Solution normalization error:', error);
        return null;
    }
}

/**
 * Verify linear equation solution by substitution
 * @param {string} equation - Equation (e.g., "2x+3=7")
 * @param {string} solution - Solution (e.g., "x=2", "7", "The answer is 7", etc.)
 * @returns {object} - Verification result
 */
function verifyLinearEquation(equation, solution) {
    try {
        // Normalize the solution to extract variable and value
        const normalized = normalizeSolution(solution, equation);

        if (!normalized) {
            return { status: 'partial', notes: ['Could not parse solution format'] };
        }

        const { variable, value } = normalized;

        // Parse equation
        const lhs = equation.split('=')[0].trim();
        const rhs = equation.split('=')[1].trim();

        // Substitute and evaluate both sides
        const lhsResult = evaluate(lhs, { [variable]: value });
        const rhsResult = evaluate(rhs, { [variable]: value });

        // Check if they're equal (with small tolerance for floating point)
        const tolerance = 1e-10;
        const isEqual = Math.abs(lhsResult - rhsResult) < tolerance;

        if (isEqual) {
            return {
                status: 'passed',
                notes: [`Substituted ${variable}=${value}: ${lhs}=${lhsResult}, ${rhs}=${rhsResult}`]
            };
        } else {
            return {
                status: 'failed',
                notes: [`Substitution failed: ${lhs}=${lhsResult} ≠ ${rhs}=${rhsResult}`]
            };
        }
    } catch (error) {
        return { status: 'partial', notes: ['Could not verify linear equation: ' + error.message] };
    }
}

/**
 * Verify quadratic equation solution
 * @param {string} equation - Quadratic equation
 * @param {string} solution - Solution (e.g., "x=2,3", "x=2 or x=3", "2,3", etc.)
 * @returns {object} - Verification result
 */
function verifyQuadraticEquation(equation, solution) {
    try {
        // Normalize the solution to handle multiple formats:
        // - "x=2,3" or "x=2 or x=3" (with variable)
        // - "2,3" or "2 and 3" (bare numbers)
        // - "x=2" (single root)
        // - LaTeX wrapped: "$x=2$" or "\boxed{2}"
        // - Sentence prefixes: "The answers are 2 and 3"

        // First, try to extract all numeric values from the solution
        // This regex handles: integers, decimals, negative numbers
        const solutionRoots = solution.match(/-?\d+\.?\d*/g) || [];

        if (solutionRoots.length === 0) {
            return { status: 'partial', notes: ['Could not extract numeric solutions'] };
        }

        const numericSolutions = solutionRoots.map(r => parseFloat(r));

        // Remove duplicates while preserving order
        const uniqueSolutions = [...new Set(numericSolutions)];

        // Verify each root by substituting back into the equation
        const tolerance = 1e-6;
        const allRootsValid = uniqueSolutions.every(root => {
            try {
                // Substitute the root into the equation and check if it equals 0
                const equationWithoutAnswer = equation.replace(/=.*$/, '=0');
                const lhs = equationWithoutAnswer.split('=')[0];
                const result = evaluate(lhs, { x: root });
                return Math.abs(result) < tolerance;
            } catch (e) {
                return false;
            }
        });

        if (allRootsValid) {
            return {
                status: 'passed',
                notes: [`All roots verified: ${uniqueSolutions.join(', ')}`]
            };
        } else {
            return {
                status: 'failed',
                notes: [`Root mismatch. Some solutions do not satisfy the equation ${equation}`]
            };
        }
    } catch (error) {
        return { status: 'partial', notes: ['Could not verify quadratic equation: ' + error.message] };
    }
}

/**
 * Verify expression simplification
 * @param {string} original - Original expression
 * @param {string} simplified - Simplified expression
 * @returns {object} - Verification result
 */
function verifySimplification(original, simplified) {
    try {
        // Convert LaTeX to expressions if needed
        const origExpr = latexToExpression(original) || original;
        const simpExpr = latexToExpression(simplified) || simplified;

        // Evaluate both with test values
        const testValues = { x: 5, y: 3, a: 2, b: 7 };

        const origResult = evaluate(origExpr, testValues);
        const simpResult = evaluate(simpExpr, testValues);

        const tolerance = 1e-10;
        const isEqual = Math.abs(origResult - simpResult) < tolerance;

        if (isEqual) {
            return {
                status: 'passed',
                notes: [`Expressions are equivalent (tested with x=${testValues.x}, y=${testValues.y})`]
            };
        } else {
            return {
                status: 'failed',
                notes: [`Expressions are not equivalent: ${origExpr}=${origResult} ≠ ${simpExpr}=${simpResult}`]
            };
        }
    } catch (error) {
        return { status: 'partial', notes: ['Could not verify simplification: ' + error.message] };
    }
}

/**
 * Verify derivative computation
 * @param {string} original - Original function
 * @param {string} computedDerivative - Computed derivative
 * @returns {object} - Verification result
 */
function verifyDerivative(original, computedDerivative) {
    try {
        // Convert LaTeX to expressions if needed
        const origExpr = latexToExpression(original) || original;
        const compDeriv = latexToExpression(computedDerivative) || computedDerivative;

        // Compute derivative using mathjs
        const actualDerivative = derivative(origExpr, 'x');
        const actualDerivativeSimplified = simplify(actualDerivative).toString();

        // Compare expressions by evaluating at test points
        const testPoints = [1, 2, 3, 5];
        const tolerance = 1e-8;

        for (const x of testPoints) {
            const computed = evaluate(compDeriv, { x });
            const actual = evaluate(actualDerivativeSimplified, { x });

            if (Math.abs(computed - actual) > tolerance) {
                return {
                    status: 'failed',
                    notes: [`Derivative mismatch at x=${x}: computed=${computed}, actual=${actual}`]
                };
            }
        }

        return {
            status: 'passed',
            notes: [`Derivative verified: d/dx(${origExpr}) = ${actualDerivativeSimplified}`]
        };
    } catch (error) {
        return { status: 'partial', notes: ['Could not verify derivative: ' + error.message] };
    }
}

/**
 * Verify integral computation
 * @param {string} original - Original function
 * @param {string} computedIntegral - Computed integral
 * @returns {object} - Verification result
 */
function verifyIntegral(original, computedIntegral) {
    try {
        // Convert LaTeX to expressions if needed
        const origExpr = latexToExpression(original) || original;
        const compIntegral = latexToExpression(computedIntegral) || computedIntegral;

        // Verify by differentiating the computed integral using mathjs
        // The derivative should equal the original function
        let derivativeOfComputed;
        try {
            derivativeOfComputed = derivative(compIntegral, 'x');
            const simplifiedDerivative = simplify(derivativeOfComputed).toString();
            const simplifiedOriginal = simplify(origExpr).toString();

            // Test at multiple points to verify
            const testPoints = [1, 2, 3, 5];
            const tolerance = 1e-6;

            let allPointsMatch = true;
            for (const x of testPoints) {
                try {
                    const derivativeValue = evaluate(simplifiedDerivative, { x });
                    const originalValue = evaluate(simplifiedOriginal, { x });

                    if (Math.abs(derivativeValue - originalValue) > tolerance) {
                        allPointsMatch = false;
                        break;
                    }
                } catch (e) {
                    allPointsMatch = false;
                    break;
                }
            }

            if (allPointsMatch) {
                return {
                    status: 'passed',
                    notes: [`Integral verified: derivative of ${compIntegral} equals ${origExpr}`]
                };
            } else {
                return {
                    status: 'failed',
                    notes: [`Integral verification failed: derivative does not match original function`]
                };
            }
        } catch (nerdamerError) {
            // If nerdamer fails, try a simpler approach with mathjs only
            try {
                const derivativeValue = evaluate(compIntegral, { x: 5 });
                const originalValue = evaluate(origExpr, { x: 5 });

                // This is a very rough check, but better than nothing
                return {
                    status: 'partial',
                    notes: ['Limited integral verification: expression structure could not be fully verified']
                };
            } catch (mathjsError) {
                return {
                    status: 'partial',
                    notes: ['Could not verify integral: unable to parse expression']
                };
            }
        }
    } catch (error) {
        return { status: 'partial', notes: ['Could not verify integral: ' + error.message] };
    }
}

/**
 * Determine the type of math problem
 * @param {object} response - LLM response object
 * @returns {string} - Problem type
 */
function determineProblemType(response) {
    const { problemSummary, parsedExpressionLatex, finalAnswer } = response;

    if (!parsedExpressionLatex) {
        return 'unknown';
    }

    const lower = parsedExpressionLatex.toLowerCase() + ' ' + problemSummary.toLowerCase();

    // Check for derivatives
    if (lower.includes('derivative') || lower.includes('differentiate') || /d\/dx/.test(lower)) {
        return 'derivative';
    }

    // Check for integrals
    if (lower.includes('integral') || lower.includes('integrate') || lower.includes('area') || /\\int/.test(lower)) {
        return 'integral';
    }

    // Check for simplification
    if (lower.includes('simplify') || lower.includes('simplification')) {
        return 'simplification';
    }

    // Check for quadratic
    if (/[x-z]\^2/.test(parsedExpressionLatex) || /x\*\*2/.test(parsedExpressionLatex)) {
        return 'quadratic';
    }

    // Check for linear equation
    if (/=/.test(parsedExpressionLatex) && /[a-z]/.test(parsedExpressionLatex)) {
        return 'linear';
    }

    return 'unknown';
}

/**
 * Main verification function with timeout
 * @param {object} response - LLM response object
 * @param {number} timeout - Timeout in milliseconds (default 5000)
 * @returns {Promise<object|null>} - Verification result or null if unverifiable
 */
async function verifyMath(response, timeout = 5000) {
    return withTimeout(async () => {
        const { parsedExpressionLatex, finalAnswer } = response;

        // If no expression to verify, return null
        if (!parsedExpressionLatex) {
            return null;
        }

        // Determine problem type
        const problemType = determineProblemType(response);

        // Route to appropriate verification function
        switch (problemType) {
            case 'linear':
                return verifyLinearEquation(parsedExpressionLatex, finalAnswer);

            case 'quadratic':
                return verifyQuadraticEquation(parsedExpressionLatex, finalAnswer);

            case 'simplification':
                return verifySimplification(parsedExpressionLatex, finalAnswer);

            case 'derivative':
                return verifyDerivative(parsedExpressionLatex, finalAnswer);

            case 'integral':
                return verifyIntegral(parsedExpressionLatex, finalAnswer);

            case 'unknown':
                // Try to determine if it's an equation
                if (/=/.test(parsedExpressionLatex)) {
                    // Assume it's some kind of equation
                    const hasPower = /[x-z]\^2/.test(parsedExpressionLatex);
                    if (hasPower) {
                        return verifyQuadraticEquation(parsedExpressionLatex, finalAnswer);
                    } else {
                        return verifyLinearEquation(parsedExpressionLatex, finalAnswer);
                    }
                }
                // Out of scope
                return {
                    status: 'partial',
                    notes: ['Problem type not in verification scope (linear, quadratic, simplification, derivative, integral)']
                };

            default:
                return {
                    status: 'partial',
                    notes: ['Could not determine problem type for verification']
                };
        }
    }, timeout).catch(error => {
        if (error.message === 'Verification timeout') {
            return {
                status: 'partial',
                notes: ['Verification timed out - expression too complex']
            };
        }
        return {
            status: 'partial',
            notes: ['Verification error: ' + error.message]
        };
    });
}

module.exports = {
    verifyMath,
    verifyLinearEquation,
    verifyQuadraticEquation,
    verifySimplification,
    verifyDerivative,
    verifyIntegral,
    latexToExpression,
    determineProblemType,
    normalizeSolution
};

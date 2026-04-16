const axios = require('axios');

async function testTutor() {
    console.log("Testing text-only math problem...");
    try {
        const res = await axios.post('http://localhost:3000/api/tutor', {
            questionText: "x + 2 = 5"
        });
        console.log("Response status:", res.status);
        console.log("Problem Summary:", res.data.problemSummary);
        console.log("Final Answer:", res.data.finalAnswer);
        console.log("Steps count:", res.data.steps.length);
        console.log("Verification status:", res.data.verification.status);
    } catch (e) {
        console.error("Test failed:", e.message);
    }

    console.log("\nTesting 'simpler' action...");
    try {
        const res = await axios.post('http://localhost:3000/api/tutor', {
            questionText: "x + 2 = 5",
            action: "simpler"
        });
        console.log("Response status:", res.status);
        console.log("Final Answer (simpler):", res.data.finalAnswer);
        console.log("Steps count (simpler):", res.data.steps.length);
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

testTutor();

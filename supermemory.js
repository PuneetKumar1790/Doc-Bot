import fetch from 'node-fetch';

const SUPERMEMORY_API_KEY = "sm_vwFqRTBPD2fceRagoJCzWw_uXnGBmNxKsEoWceZTuwBzVfXvQjdUnvGXKRkyuchjlrQOmCYehbDIGpZFnGVmquK";

// Export the function
export async function addToSupermemory(content) {
    try {
        const response = await fetch("https://v2.api.supermemory.ai/add", {
            method: "POST",
            headers: {
                "x-api-key": SUPERMEMORY_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content })
        });

        const result = await response.json();
        console.log("Supermemory response:", result);
    } catch (error) {
        console.error("Failed to add to Supermemory:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const plannerForm = document.getElementById('plannerForm');
    const loadInput = document.getElementById('load');
    const payloadJsonTextarea = document.getElementById('payloadJson');
    const resultsOutputDiv = document.getElementById('resultsOutput');
    const calculateBtn = document.getElementById('calculateBtn');

    // --- IMPORTANT: API URL Configuration ---
    // The API is expected to be running on localhost:8888
    // WHEN DEPLOYING THE FRONTEND (SPA) TO GITHUB PAGES (HTTPS):
    // 1. Your local Flask API *must* run over HTTPS (e.g., https://localhost:8888)
    //    to avoid mixed content errors. Browsers block HTTP calls from HTTPS pages.
    // 2. You'll need to configure CORS on your Flask server to accept requests
    //    from your GitHub Pages domain (e.g., https://yourusername.github.io).
    // 3. A Content Security Policy (CSP) meta tag in index.html might also be needed
    //    to explicitly allow connections to https://localhost:8888.
    const API_URL = 'http://127.0.0.1:8888/productionplan';
    // For production/GitHub Pages testing against a local HTTPS server, change to:
    // const API_URL = 'https://localhost:8888/productionplan';

    plannerForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        const originalButtonText = calculateBtn.innerHTML;
        calculateBtn.disabled = true;
        calculateBtn.innerHTML = '<span class="animate-pulse">Calculating...</span>';
        resultsOutputDiv.innerHTML = '<p class="text-slate-500">Calculating plan...</p>';

        try {
            const loadValue = parseFloat(loadInput.value);
            if (isNaN(loadValue)) {
                throw new Error("Invalid 'Load' value. It must be a number.");
            }

            let jsonDataFromTextarea;
            try {
                jsonDataFromTextarea = JSON.parse(payloadJsonTextarea.value);
            } catch (parseError) {
                throw new Error(`Invalid JSON in payload: ${parseError.message}`);
            }

            // Construct the final payload for the API
            // The challenge expects a top-level "load" key, and "fuels" and "powerplants"
            // The textarea provides "fuels" and "powerplants"
            const fullPayload = {
                load: loadValue,
                fuels: jsonDataFromTextarea.fuels,
                powerplants: jsonDataFromTextarea.powerplants
            };

            if (!fullPayload.fuels || !fullPayload.powerplants) {
                throw new Error("The JSON payload must contain 'fuels' and 'powerplants' objects.");
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Accept': 'application/json' // Good practice
                },
                body: JSON.stringify(fullPayload)
            });

            if (!response.ok) {
                const errorData = await response.text(); // Try to get error text from backend
                throw new Error(`API Error (${response.status}): ${errorData || response.statusText}`);
            }

            const results = await response.json();
            displayResults(results);

        } catch (error) {
            console.error('Error during calculation:', error);
            displayError(error.message);
        } finally {
            calculateBtn.disabled = false;
            calculateBtn.innerHTML = originalButtonText;
        }
    });

function displayResults(results) {
        resultsOutputDiv.className = 'text-sm'; // Reset and apply base class
        resultsOutputDiv.innerHTML = ''; // Clear previous

        if (!results || results.length === 0) {
            resultsOutputDiv.innerHTML = '<p class="text-gray-500">No production plan returned or plan is empty.</p>';
            return;
        }

        let html = '<ul class="space-y-0">'; // Removed space-y-2 if border handles separation
        results.forEach(plant => {
            // This structure aims for: "gasfiredbig1: 200.0 MW" on the left, and a potential second value on the right
            // For now, we only have name and p. If p is the *only* value shown like in the inspo's left side:
            // "gasfiredbig1: 200.0 MW"
            html += `
               <li class="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                   <span class="text-gray-800"><span class="font-semibold">${plant.name}:</span> ${plant.p.toFixed(2)} MW</span>
                   </li>`;
        });
        html += '</ul>';
        resultsOutputDiv.innerHTML = html;
    }

    function displayError(errorMessage) {
        resultsOutputDiv.innerHTML = `<p class="text-red-500 font-semibold">Error: ${errorMessage}</p>`;
    }
});
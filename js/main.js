document.addEventListener('DOMContentLoaded', () => {
    // --- Elements for the main planner form ---
    const plannerForm = document.getElementById('plannerForm');
    const loadInput = document.getElementById('load');
    const payloadJsonTextarea = document.getElementById('payloadJson');
    const resultsOutputDiv = document.getElementById('resultsOutput');
    const calculateBtn = document.getElementById('calculateBtn');

    // --- API URL Configuration ---
    // For GitHub Pages calling a local API:
    // 1. Your local Flask API *must* run over HTTPS (e.g., https://localhost:8888)
    //    to avoid mixed content errors.
    // 2. Configure CORS on Flask to accept requests from your GitHub Pages domain.
    // 3. A CSP meta tag in index.html might be needed for https://localhost:8888.
    const API_URL = 'http://127.0.0.1:8888/productionplan';
    // If testing local Flask with HTTPS:
    // const API_URL = 'https://localhost:8888/productionplan';

    // --- Event Listener for the Planner Form ---
    if (plannerForm) {
        plannerForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            const originalButtonText = calculateBtn.innerHTML;
            calculateBtn.disabled = true;
            calculateBtn.innerHTML = '<span class="animate-pulse">Calculating...</span>';
            resultsOutputDiv.innerHTML = '<p class="text-gray-500">Calculating plan...</p>'; // Use gray-500 from your config

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
                    },
                    body: JSON.stringify(fullPayload)
                });

                if (!response.ok) {
                    const errorData = await response.text(); 
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
    }

    // --- Function to Display Results ---
    function displayResults(results) {
        resultsOutputDiv.className = 'text-sm'; // Base class
        resultsOutputDiv.innerHTML = ''; // Clear previous

        if (!results || results.length === 0) {
            resultsOutputDiv.innerHTML = '<p class="text-gray-500">No production plan returned or plan is empty.</p>';
            return;
        }

        let html = '<ul class="space-y-0">';
        results.forEach(plant => {
            html += `
                <li class="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                    <span class="text-gray-800"><span class="font-semibold">${plant.name}:</span> ${plant.p.toFixed(2)} MW</span>
                </li>`;
        });
        html += '</ul>';
        resultsOutputDiv.innerHTML = html;
    }

    // --- Function to Display Errors ---
    function displayError(errorMessage) {
        resultsOutputDiv.innerHTML = `<p class="text-red-500 font-semibold">Error: ${errorMessage}</p>`;
    }

    // --- New elements and logic for Explanation Modal ---
    const openModalButton = document.getElementById('openExplanationModal');
    const closeModalButton = document.getElementById('closeExplanationModal');
    const okModalButton = document.getElementById('okModalBtn');
    const explanationModal = document.getElementById('explanationModal');
    
    const tabEn = document.getElementById('tabEn');
    const tabEs = document.getElementById('tabEs');
    const contentEn = document.getElementById('contentEn');
    const contentEs = document.getElementById('contentEs');

    function showModal() {
        if (explanationModal) {
            explanationModal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden'); 
        }
    }

    function hideModal() {
        if (explanationModal) {
            explanationModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }
    }

    if (openModalButton) {
        openModalButton.addEventListener('click', showModal);
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', hideModal);
    }
    if (okModalButton) {
        okModalButton.addEventListener('click', hideModal);
    }

    if (explanationModal) {
        explanationModal.addEventListener('click', (event) => {
            if (event.target === explanationModal) {
                hideModal();
            }
        });
    }

    // Language tab functionality for the modal
    if (tabEn && tabEs && contentEn && contentEs) {
        tabEn.addEventListener('click', () => {
            contentEn.classList.remove('hidden');
            contentEs.classList.add('hidden');
            
            tabEn.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            tabEn.classList.add('border-inspiration-blue', 'text-inspiration-blue');
            
            tabEs.classList.remove('border-inspiration-blue', 'text-inspiration-blue');
            tabEs.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });

        tabEs.addEventListener('click', () => {
            contentEs.classList.remove('hidden');
            contentEn.classList.add('hidden');

            tabEs.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            tabEs.classList.add('border-inspiration-blue', 'text-inspiration-blue');

            tabEn.classList.remove('border-inspiration-blue', 'text-inspiration-blue');
            tabEn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });
    }
});

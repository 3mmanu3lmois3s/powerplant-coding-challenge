document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM completamente cargado. Iniciando main.js...");

    // --- Elementos para el formulario principal del planificador ---
    const plannerForm = document.getElementById('plannerForm');
    const loadInput = document.getElementById('load');
    const payloadJsonTextarea = document.getElementById('payloadJson');
    const resultsOutputDiv = document.getElementById('resultsOutput');
    const calculateBtn = document.getElementById('calculateBtn');

    console.log("Elementos del formulario recuperados:", { plannerForm, loadInput, payloadJsonTextarea, resultsOutputDiv, calculateBtn });

    // --- Configuración de la URL de la API ---
    // IMPORTANTE: Para probar tu página de GitHub (HTTPS) con tu API Flask local:
    // 1. Tu API Flask local DEBE ejecutarse también sobre HTTPS (ej. usando ssl_context='adhoc').
    // 2. Esta API_URL DEBE ser 'https://localhost:8888/productionplan'.
    // 3. Tu navegador mostrará una advertencia de seguridad para el certificado autofirmado la primera vez;
    //    necesitarás hacer clic en "Avanzado" y "Proceder a localhost (no seguro)".
    //
    // Si pruebas index.html localmente (file:/// o http://127.0.0.1:5500) Y Flask está en HTTP:
    // const API_URL = 'http://127.0.0.1:8888/productionplan';
    //
    // PARA PRUEBAS CON GITHUB PAGES (HTTPS) Y API FLASK LOCAL (HTTPS) - RECOMENDADO:
    const API_URL = 'https://localhost:8888/productionplan';
    console.log("API URL configurada para:", API_URL);


    // --- Event Listener para el Formulario del Planificador ---
    if (plannerForm && calculateBtn && loadInput && payloadJsonTextarea && resultsOutputDiv) {
        console.log("Añadiendo event listener al formulario del planificador.");
        plannerForm.addEventListener('submit', async (event) => {
            event.preventDefault(); 
            console.log("Formulario del planificador enviado.");

            const originalButtonText = calculateBtn.innerHTML;
            calculateBtn.disabled = true;
            calculateBtn.innerHTML = '<span class="animate-pulse">Calculating...</span>';
            resultsOutputDiv.innerHTML = '<p class="text-gray-500">Calculating plan...</p>';

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
                console.log("Payload a enviar a la API:", fullPayload);

                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(fullPayload)
                });
                console.log("Respuesta de fetch recibida, status:", response.status);

                if (!response.ok) {
                    const errorData = await response.text(); 
                    console.error("Error de API:", response.status, errorData);
                    throw new Error(`API Error (${response.status}): ${errorData || response.statusText}`);
                }

                const results = await response.json();
                console.log("Resultados de API parseados:", results);
                displayResults(results);

            } catch (error) {
                console.error('Error durante el cálculo (API):', error);
                if (error.message.includes("Failed to fetch")) {
                    displayError(`Failed to connect to API at ${API_URL}. Ensure the local Flask server is running (on HTTPS if this page is HTTPS) and you've accepted any self-signed certificate warnings for localhost.`);
                } else {
                    displayError(error.message);
                }
            } finally {
                calculateBtn.disabled = false;
                calculateBtn.innerHTML = originalButtonText;
            }
        });
    } else {
        console.error("Error crítico: Uno o más elementos del formulario principal no se encontraron. Revisa los IDs en index.html: plannerForm, calculateBtn, load, payloadJsonTextarea, resultsOutputDiv.");
    }

    // --- Función para Mostrar Resultados ---
    function displayResults(results) {
        if (!resultsOutputDiv) {
            console.error("Elemento resultsOutputDiv no encontrado para mostrar resultados.");
            return;
        }
        resultsOutputDiv.className = 'text-sm'; 
        resultsOutputDiv.innerHTML = ''; 

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

    // --- Función para Mostrar Errores ---
    function displayError(errorMessage) {
        if (!resultsOutputDiv) {
            console.error("Elemento resultsOutputDiv no encontrado para mostrar errores.");
            return;
        }
        resultsOutputDiv.innerHTML = `<p class="text-red-500 font-semibold">Error: ${errorMessage}</p>`;
    }

    // --- Elementos y lógica para el Modal de Explicación ---
    console.log("Configurando lógica del modal de explicación...");
    const openModalButton = document.getElementById('openExplanationModal');
    const closeModalButton = document.getElementById('closeExplanationModal');
    const okModalButton = document.getElementById('okModalBtn');
    const explanationModal = document.getElementById('explanationModal');
    
    const tabEn = document.getElementById('tabEn');
    const tabEs = document.getElementById('tabEs');
    const contentEn = document.getElementById('contentEn');
    const contentEs = document.getElementById('contentEs');

    console.log("Elementos del modal recuperados:", { openModalButton, closeModalButton, okModalButton, explanationModal, tabEn, tabEs, contentEn, contentEs });

    function showModal() {
        console.log("Función showModal llamada.");
        if (explanationModal) {
            explanationModal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden'); 
            console.log("Modal debería estar visible.");
        } else {
            console.error("Error en showModal: explanationModal es nulo. Revisa el ID en index.html.");
        }
    }

    function hideModal() {
        console.log("Función hideModal llamada.");
        if (explanationModal) {
            explanationModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            console.log("Modal debería estar oculto.");
        } else {
            console.error("Error en hideModal: explanationModal es nulo.");
        }
    }

    if (openModalButton) {
        console.log("Añadiendo event listener a openModalButton.");
        openModalButton.addEventListener('click', () => {
            console.log("Botón 'About this Demo' (#openExplanationModal) clickeado.");
            showModal();
        });
    } else {
        console.error("Error crítico: Botón 'openExplanationModal' no encontrado. El modal no se podrá abrir. Verifica el ID en index.html.");
    }

    if (closeModalButton) {
        console.log("Añadiendo event listener a closeModalButton.");
        closeModalButton.addEventListener('click', hideModal);
    } else {
        console.warn("Advertencia: Botón 'closeExplanationModal' no encontrado. Verifica el ID en index.html.");
    }

    if (okModalButton) {
        console.log("Añadiendo event listener a okModalButton.");
        okModalButton.addEventListener('click', hideModal);
    } else {
        console.warn("Advertencia: Botón 'okModalBtn' no encontrado. Verifica el ID en index.html.");
    }

    if (explanationModal) {
        console.log("Añadiendo event listener a explanationModal para cerrar al hacer clic fuera del contenido.");
        explanationModal.addEventListener('click', (event) => {
            // Cierra el modal solo si se hace clic directamente en el overlay (explanationModal)
            // y no en sus elementos hijos (el contenido del modal).
            if (event.target === explanationModal) { 
                console.log("Clic detectado en el overlay del modal (explanationModal).");
                hideModal();
            }
        });
    } else {
        console.error("Error crítico: Elemento 'explanationModal' no encontrado. La funcionalidad de clic fuera y la visibilidad del modal no funcionarán. Verifica el ID en index.html.");
    }

    // Funcionalidad de pestañas de idioma para el modal
    if (tabEn && tabEs && contentEn && contentEs) {
        console.log("Configurando listeners para pestañas de idioma del modal.");
        tabEn.addEventListener('click', () => {
            console.log("Pestaña Inglés clickeada.");
            contentEn.classList.remove('hidden');
            contentEs.classList.add('hidden');
            
            tabEn.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            tabEn.classList.add('border-inspiration-blue', 'text-inspiration-blue');
            
            tabEs.classList.remove('border-inspiration-blue', 'text-inspiration-blue');
            tabEs.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });

        tabEs.addEventListener('click', () => {
            console.log("Pestaña Español clickeada.");
            contentEs.classList.remove('hidden');
            contentEn.classList.add('hidden');

            tabEs.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            tabEs.classList.add('border-inspiration-blue', 'text-inspiration-blue');

            tabEn.classList.remove('border-inspiration-blue', 'text-inspiration-blue');
            tabEn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });
    } else {
        console.warn("Advertencia: Uno o más elementos de pestaña/contenido para el modal no se encontraron. Revisa los IDs en index.html: tabEn, tabEs, contentEn, contentEs.");
    }
    console.log("Configuración de main.js finalizada.");
});

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
    // PARA PRUEBAS CON GITHUB PAGES (HTTPS) Y API FLASK LOCAL (HTTPS):
    const API_URL = 'https://localhost:8888/productionplan';
    // Si pruebas index.html localmente (file:/// o http://127.0.0.1:5500) Y Flask está en HTTP:
    // const API_URL = 'http://127.0.0.1:8888/productionplan'; 
    console.log("API URL configurada para:", API_URL);

    // --- Helper function for rounding (JavaScript version) ---
    function roundToOneDecimalJS(value) {
        return parseFloat(Number(value).toFixed(1));
    }

    // --- Core Calculation Logic in JavaScript (mirrors Python logic.py) ---
    function calculatePlanInJS(load, fuels, powerplantsData) {
        console.log("JS Fallback: Iniciando cálculo del plan de producción para carga:", load, "MWh");
        console.log("JS Fallback: Datos de combustibles:", fuels);

        let processedPlants = [];
        let totalWindProduction = 0.0;

        const gasPricePerMwh = fuels["gas(euro/MWh)"] || 0;
        const kerosinePricePerMwh = fuels["kerosine(euro/MWh)"] || 0;
        const co2PricePerTon = fuels["co2(euro/ton)"] || 0;
        const windPercentage = fuels["wind(%)"] || 0;

        const co2EmissionFactor = 0.3;
        const co2CostPerMwhGas = co2EmissionFactor * co2PricePerTon;

        powerplantsData.forEach(plantData => {
            let plant = {
                name: plantData.name,
                type: plantData.type,
                efficiency: plantData.efficiency || 0,
                pmin: plantData.pmin || 0,
                pmax: plantData.pmax || 0,
                cost_per_mwh: Infinity,
                assigned_power: 0.0 
            };

            if (plant.type === "windturbine") {
                plant.cost_per_mwh = 0.0;
                let actualWindPower = roundToOneDecimalJS(plant.pmax * (windPercentage / 100.0));
                plant.assigned_power = actualWindPower; 
                totalWindProduction += actualWindPower;
            } else if (plant.type === "gasfired") {
                if (plant.efficiency > 0) {
                    let fuelCost = gasPricePerMwh / plant.efficiency;
                    plant.cost_per_mwh = fuelCost + co2CostPerMwhGas;
                }
            } else if (plant.type === "turbojet") {
                if (plant.efficiency > 0) {
                    plant.cost_per_mwh = kerosinePricePerMwh / plant.efficiency;
                }
            }
            processedPlants.push(plant);
        });
        
        totalWindProduction = roundToOneDecimalJS(totalWindProduction);
        console.log("JS Fallback: Producción total eólica calculada:", totalWindProduction, "MWh");

        let remainingLoad = roundToOneDecimalJS(load - totalWindProduction);
        console.log("JS Fallback: Carga restante después de eólica:", remainingLoad, "MWh");

        if (remainingLoad < 0) {
            console.warn("JS Fallback: Producción eólica excede la carga. Ajustando producción eólica.");
            if (totalWindProduction > 0.001) { 
                const scalingFactor = load / totalWindProduction;
                let currentTotalWindAdjusted = 0.0;
                
                processedPlants.forEach(p => {
                    if (p.type === "windturbine") {
                        p.assigned_power = roundToOneDecimalJS(p.assigned_power * scalingFactor);
                        currentTotalWindAdjusted += p.assigned_power;
                    }
                });
                
                totalWindProduction = roundToOneDecimalJS(currentTotalWindAdjusted);
                remainingLoad = roundToOneDecimalJS(load - totalWindProduction);
            } else { 
                remainingLoad = roundToOneDecimalJS(load); 
            }
            console.log("JS Fallback: Producción eólica ajustada:", totalWindProduction, "Nueva carga restante:", remainingLoad);
            if (remainingLoad < 0) remainingLoad = 0.0; 
        }

        processedPlants.forEach(p => {
            if (p.type !== "windturbine") {
                p.assigned_power = 0.0;
            }
        });

        let dispatchableThermalPlants = processedPlants
            .filter(p => p.type !== "windturbine")
            .sort((a, b) => a.cost_per_mwh - b.cost_per_mwh || a.name.localeCompare(b.name));
        
        console.log("\nJS Fallback: Orden de Mérito (Plantas Térmicas):");
        dispatchableThermalPlants.forEach(pThermal => {
            console.log(`- ${pThermal.name} (${pThermal.type}): Coste=${pThermal.cost_per_mwh.toFixed(2)} Euro/MWh, Pmin=${pThermal.pmin}, Pmax=${pThermal.pmax}`);
        });
        
        let currentThermalDispatchTotal = 0.0;
        if (remainingLoad > 0.001) { 
            for (const plantToDispatch of dispatchableThermalPlants) {
                let loadStillNeeded = roundToOneDecimalJS(remainingLoad - currentThermalDispatchTotal);
                if (loadStillNeeded < 0.01) break; 

                let plantInProcessedList = processedPlants.find(p => p.name === plantToDispatch.name);
                let powerOutput = 0.0;

                if (loadStillNeeded >= plantToDispatch.pmin) { 
                    powerOutput = Math.min(loadStillNeeded, plantToDispatch.pmax);
                } else if (plantToDispatch.pmin === 0 && loadStillNeeded > 0) { 
                    powerOutput = Math.min(loadStillNeeded, plantToDispatch.pmax);
                }
                
                powerOutput = roundToOneDecimalJS(powerOutput);
                
                if (powerOutput > 0) {
                    plantInProcessedList.assigned_power = powerOutput; 
                    currentThermalDispatchTotal += powerOutput;
                    currentThermalDispatchTotal = roundToOneDecimalJS(currentThermalDispatchTotal);
                }
            }
        }
        
        let finalPlanMap = {};
        processedPlants.forEach(p => {
            finalPlanMap[p.name] = p.assigned_power;
        });

        let currentTotalGeneration = roundToOneDecimalJS(Object.values(finalPlanMap).reduce((sum, p_val) => sum + p_val, 0));
        console.log("\nJS Fallback: Generación total antes del ajuste final:", currentTotalGeneration, "MWh (Objetivo:", load, "MWh)");
        
        let discrepancy = roundToOneDecimalJS(load - currentTotalGeneration);
        console.log("JS Fallback: Discrepancia para ajuste final:", discrepancy);

        let adjustablePlantsForFinalPass = processedPlants
            .filter(p => p.type !== "windturbine")
            .sort((a,b)=> a.cost_per_mwh - b.cost_per_mwh);

        if (Math.abs(discrepancy) >= 0.1) { 
            if (discrepancy > 0) { 
                console.log("JS Fallback: Discrepancia > 0. Intentando aumentar producción.");
                for (const plant of adjustablePlantsForFinalPass) { 
                    let currentAssigned = finalPlanMap[plant.name];
                    let potentialIncrease = roundToOneDecimalJS(plant.pmax - currentAssigned);
                    let increaseBy = Math.min(discrepancy, potentialIncrease);

                    if (currentAssigned < plant.pmin && plant.pmin > 0) {
                        if ((plant.pmin - currentAssigned) <= discrepancy && plant.pmin <= potentialIncrease) {
                           increaseBy = Math.min(discrepancy, plant.pmin - currentAssigned); 
                        } else {
                           if ((currentAssigned + increaseBy) < plant.pmin && currentAssigned > 0) {
                               increaseBy = 0; 
                           } else if (currentAssigned === 0 && increaseBy < plant.pmin) {
                               increaseBy = 0; 
                           }
                        }
                    }
                    increaseBy = roundToOneDecimalJS(increaseBy);
                    
                    if (increaseBy > 0) {
                        finalPlanMap[plant.name] = roundToOneDecimalJS(currentAssigned + increaseBy);
                        discrepancy = roundToOneDecimalJS(discrepancy - increaseBy);
                        if (Math.abs(discrepancy) < 0.01) break;
                    }
                }
            } else { 
                console.log("JS Fallback: Discrepancia < 0. Intentando reducir producción.");
                let amountToReduce = Math.abs(discrepancy);
                for (const plant of [...adjustablePlantsForFinalPass].reverse()) { 
                    let currentAssigned = finalPlanMap[plant.name];
                    if (currentAssigned < 0.01) continue; 

                    let canReduceByThisPlant = roundToOneDecimalJS(currentAssigned - plant.pmin);
                    if (plant.pmin === 0) { 
                        canReduceByThisPlant = currentAssigned;
                    }
                    
                    let actualReduction = Math.min(amountToReduce, canReduceByThisPlant);
                    actualReduction = roundToOneDecimalJS(actualReduction);

                    if (actualReduction > 0) {
                        finalPlanMap[plant.name] = roundToOneDecimalJS(currentAssigned - actualReduction);
                        amountToReduce = roundToOneDecimalJS(amountToReduce - actualReduction);
                        if (Math.abs(amountToReduce) < 0.01) break;
                    }
                }
            }
        }
        
        let outputPlan = [];
        powerplantsData.forEach(plantSpec => {
            const name = plantSpec.name;
            const power = finalPlanMap[name] !== undefined ? finalPlanMap[name] : 0.0;
            outputPlan.push({ name: name, p: roundToOneDecimalJS(power) }); 
        });
        
        const finalTotalGen = roundToOneDecimalJS(outputPlan.reduce((sum, p) => sum + p.p, 0));
        console.log("JS Fallback: Generación total final:", finalTotalGen, "MWh (Objetivo:", load, "MWh)");

        if (Math.abs(finalTotalGen - load) > 0.01) { 
             console.warn("JS Fallback: ALERTA: No se pudo igualar la carga exactamente. Generado:", finalTotalGen, "Carga:", load);
        }
        return outputPlan;
    }


    // --- Event Listener para el Formulario del Planificador (MODIFICADO PARA FALLBACK) ---
    if (plannerForm && calculateBtn && loadInput && payloadJsonTextarea && resultsOutputDiv) {
        console.log("Añadiendo event listener al formulario del planificador.");
        plannerForm.addEventListener('submit', async (event) => {
            event.preventDefault(); 
            console.log("Formulario del planificador enviado.");

            const originalButtonText = calculateBtn.innerHTML;
            calculateBtn.disabled = true;
            calculateBtn.innerHTML = '<span class="animate-pulse">Calculating...</span>';
            resultsOutputDiv.innerHTML = '<p class="text-gray-500">Calculating plan...</p>';

            let loadValue, jsonDataFromTextarea, fullPayload;
            try { 
                loadValue = parseFloat(loadInput.value);
                if (isNaN(loadValue)) {
                    throw new Error("Invalid 'Load' value. It must be a number.");
                }
                jsonDataFromTextarea = JSON.parse(payloadJsonTextarea.value);
                fullPayload = {
                    load: loadValue,
                    fuels: jsonDataFromTextarea.fuels,
                    powerplants: jsonDataFromTextarea.powerplants
                };
                if (!fullPayload.fuels || !fullPayload.powerplants) {
                    throw new Error("The JSON payload must contain 'fuels' and 'powerplants' objects.");
                }
                console.log("Payload parseado para API o fallback:", fullPayload);

            } catch (inputError) {
                console.error('Error procesando input:', inputError);
                displayError(inputError.message); // Muestra el error de parseo del input
                calculateBtn.disabled = false;
                calculateBtn.innerHTML = originalButtonText;
                return; 
            }

            try { 
                console.log("Intentando fetch desde API:", API_URL);
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullPayload)
                });
                console.log("Respuesta de API recibida, status:", response.status);

                if (!response.ok) {
                    const errorData = await response.text(); 
                    console.error("Error de API:", response.status, errorData);
                    // Lanzar un error para que sea capturado por el catch y se intente el fallback
                    throw new Error(`API Error (${response.status}): ${errorData || response.statusText}`);
                }

                const results = await response.json();
                console.log("Resultados de API parseados:", results);
                displayResults(results); // Muestra los resultados de la API

            } catch (apiError) {
                console.warn('Llamada a API falló:', apiError.message);
                // Verificar si es un error de red (servidor caído o problema SSL) para intentar el fallback
                if (apiError instanceof TypeError && 
                    (apiError.message.toLowerCase().includes("failed to fetch") || 
                     apiError.message.toLowerCase().includes("ssl_protocol_error") || 
                     apiError.message.toLowerCase().includes("cert_authority_invalid"))) {
                    
                    // Mostrar mensaje de intento de fallback
                    resultsOutputDiv.innerHTML = '<p class="text-orange-500 font-semibold">API connection failed or SSL issue. Attempting calculation in browser...</p>';
                    console.log("Intentando cálculo de fallback en JS porque la API no está disponible o hay un error SSL.");
                    
                    try {
                        // Ejecutar el cálculo JS
                        const jsResults = calculatePlanInJS(fullPayload.load, fullPayload.fuels, fullPayload.powerplants);
                        console.log("Resultados del fallback en JS:", jsResults);
                        
                        // Mostrar los resultados del JS después de un breve retraso
                        setTimeout(() => {
                           console.log("Dentro de setTimeout para displayResults con jsResults del fallback:", jsResults);
                           displayResults(jsResults);
                        }, 700); 
                    } catch (jsError) {
                        console.error('Error durante el cálculo de fallback en JS:', jsError);
                        displayError(`API connection/SSL error. JavaScript fallback also failed: ${jsError.message}`);
                    }
                } else {
                    // Es un error de la API (ej. 400, 500), o un error diferente
                    displayError(apiError.message);
                }
            } finally {
                calculateBtn.disabled = false;
                calculateBtn.innerHTML = originalButtonText;
            }
        });
    } else {
        console.error("Error crítico: Uno o más elementos del formulario principal no se encontraron. Revisa los IDs: plannerForm, calculateBtn, load, payloadJsonTextarea, resultsOutputDiv.");
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
            if (event.target === explanationModal) { 
                console.log("Clic detectado en el overlay del modal (explanationModal).");
                hideModal();
            }
        });
    } else {
        console.error("Error crítico: Elemento 'explanationModal' no encontrado. La funcionalidad de clic fuera y la visibilidad del modal no funcionarán. Verifica el ID en index.html.");
    }

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
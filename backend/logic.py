# backend/logic.py

def calculate_production_plan(load, fuels, powerplants_data):
    """
    Calculates the production plan for powerplants based on load, fuels, and plant specifics.

    Args:
        load (float): The total load to be met (MWh).
        fuels (dict): A dictionary containing fuel costs and wind percentage.
                      Example: {"gas(euro/MWh)": 13.4, "kerosine(euro/MWh)": 50.8, ...}
        powerplants_data (list): A list of dictionaries, each representing a powerplant.
                               Example: [{"name": "gas1", "type": "gasfired", ...}, ...]

    Returns:
        list: A list of dictionaries, where each dictionary represents a powerplant
              and its allocated power production 'p'.
              Example: [{"name": "gas1", "p": 100.0}, ...]
              Returns None or raises an exception if calculation is not possible.
    """
    print(f"Received for calculation: load={load}, fuels={fuels}") # For debugging

    # --- THIS IS WHERE YOUR CORE LOGIC WILL GO ---
    # Steps:
    # 1. Calculate actual power available from wind turbines:
    #    - Wind power = pmax * (fuels["wind(%)"] / 100.0)
    #    - Cost for wind is 0.
    #    - Wind turbines do not have a pmin in the same way as gas; they produce what they can based on wind.
    #      The challenge states "Wind-turbine are either switched-on, and in that case generate a certain
    #      amount of energy depending on the % of wind, or can be switched off."
    #      For simplicity, assume they are on if wind > 0, and off if wind = 0, up to their calculated wind power.

    # 2. Calculate the cost per MWh for other powerplants (gas-fired, turbojet):
    #    - Gas-fired cost = fuels["gas(euro/MWh)"] / efficiency
    #    - Optional CO2 cost for gas-fired: Add (0.3 * fuels["co2(euro/ton)"]) to the cost per MWh.
    #    - Turbojet cost = fuels["kerosine(euro/MWh)"] / efficiency

    # 3. Create a list of "dispatchable" plants with their costs, pmin, pmax.
    #    - Store the calculated wind power separately or as part of the initial plan.

    # 4. Adjust remaining load: load_to_meet = initial_load - total_wind_power_generated.

    # 5. Sort dispatchable plants by their cost (merit order - cheapest first).

    # 6. Distribute `load_to_meet` among sorted dispatchable plants:
    #    - Iterate through plants.
    #    - Try to meet load with cheapest plants first.
    #    - Respect `pmin`: If a plant is used, it must produce at least `pmin`.
    #    - Respect `pmax`: A plant cannot produce more than `pmax`.
    #    - Ensure power produced is a multiple of 0.1 MW.
    #    - Ensure total power from all plants matches the original `load`.

    # Placeholder response (matches the structure but with dummy values)
    processed_plan = []
    if powerplants_data: # Make sure powerplants_data is not None or empty
        for plant in powerplants_data:
            # This is a very basic placeholder. You need to calculate the actual 'p'.
            name = plant.get("name", "Unknown Plant")
            plant_type = plant.get("type")
            p_max = plant.get("pmax", 0)
            assigned_p = 0  # Default to 0

            if plant_type == "windturbine":
                wind_percentage = fuels.get("wind(%)", 0)
                # Calculate wind power based on pmax and wind percentage
                assigned_p = round((p_max * (wind_percentage / 100.0)) * 10) / 10.0 # Ensure multiple of 0.1

            # For other types, p will be determined by merit order logic
            # This placeholder just assigns 0 or wind power for now.
            processed_plan.append({"name": name, "p": assigned_p })
    
    # Example: If load is 480, and windturbines from payload1 generate 90 + 21.6 = 111.6
    # Remaining load = 480 - 111.6 = 368.4. This needs to be distributed.

    # For now, let's just use the example response for payload3 if load is 910
    # This is purely for initial testing of the API structure
    if load == 910 and fuels.get("wind(%)") == 60:
        return [
            {"name": "windpark1", "p": 90.0},
            {"name": "windpark2", "p": 21.6},
            {"name": "gasfiredbig1", "p": 460.0},
            {"name": "gasfiredbig2", "p": 338.4},
            {"name": "gasfiredsomewhatsmaller", "p": 0.0},
            {"name": "tj1", "p": 0.0}
        ]
    
    # Fallback to the processed_plan with only wind turbines for other cases for now
    # Or return the dummy '0' for all if you haven't implemented wind yet.
    # Let's return a dummy 0 for all if not the specific 910 case, to force implementation.
    if not (load == 910 and fuels.get("wind(%)") == 60):
        processed_plan = []
        if powerplants_data:
            for plant in powerplants_data:
                 processed_plan.append({"name": plant.get("name"), "p": 0.0 }) # Ensure float

    return processed_plan
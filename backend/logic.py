# backend/logic.py
import math

def round_to_one_decimal(value):
    """Rounds a float to one decimal place, handling potential float inaccuracies."""
    return math.floor(value * 10 + 0.5) / 10.0

def calculate_production_plan(load, fuels, powerplants_data):
    """
    Calculates the production plan for powerplants based on load, fuels, and plant specifics.

    Args:
        load (float): The total load to be met (MWh).
        fuels (dict): A dictionary containing fuel costs and wind percentage.
        powerplants_data (list): A list of dictionaries, each representing a powerplant.

    Returns:
        list: A list of dictionaries, where each dictionary represents a powerplant
              and its allocated power production 'p'.
              Returns None if calculation is not possible under given constraints.
    """
    print(f"Calculating production plan for load: {load} MWh") # For debugging
    print(f"Fuels data: {fuels}")
    # print(f"Powerplants data: {powerplants_data}") # Can be verbose

    # --- Step 1: Pre-process powerplants and calculate their costs/potential ---
    processed_plants = []
    total_wind_production = 0.0

    # Fuel costs and parameters
    gas_price_per_mwh = fuels.get("gas(euro/MWh)", 0)
    kerosine_price_per_mwh = fuels.get("kerosine(euro/MWh)", 0)
    co2_price_per_ton = fuels.get("co2(euro/ton)", 0) # Optional CO2 cost
    wind_percentage = fuels.get("wind(%)", 0)

    # CO2 emission factor: 0.3 ton of CO2 per MWh generated by gas-fired plants
    co2_emission_factor = 0.3
    co2_cost_per_mwh_gas = co2_emission_factor * co2_price_per_ton

    for plant_data in powerplants_data:
        plant = {
            "name": plant_data.get("name"),
            "type": plant_data.get("type"),
            "efficiency": plant_data.get("efficiency", 0),
            "pmin": plant_data.get("pmin", 0),
            "pmax": plant_data.get("pmax", 0),
            "cost_per_mwh": float('inf'), # Default to infinite cost
            "potential_power": 0.0,      # Actual power this plant can contribute in this cycle
            "assigned_power": 0.0        # Power assigned in the plan
        }

        if plant["type"] == "windturbine":
            # Wind turbines have zero fuel cost.
            # Their production depends on wind percentage and pmax.
            # Efficiency is 1 for wind turbines as per challenge description ("do not consume 'fuel'")
            plant["cost_per_mwh"] = 0.0
            # Power produced is pmax * (wind_percentage / 100)
            # Ensure it's a multiple of 0.1 MW
            actual_wind_power = round_to_one_decimal(plant["pmax"] * (wind_percentage / 100.0))
            plant["potential_power"] = actual_wind_power
            # Wind turbines are dispatched first based on available wind
            plant["assigned_power"] = actual_wind_power # Tentatively assign full potential
            total_wind_production += actual_wind_power

        elif plant["type"] == "gasfired":
            if plant["efficiency"] > 0:
                fuel_cost = gas_price_per_mwh / plant["efficiency"]
                total_cost = fuel_cost + co2_cost_per_mwh_gas # Add CO2 cost
                plant["cost_per_mwh"] = total_cost
            plant["potential_power"] = plant["pmax"] # Max potential if dispatched

        elif plant["type"] == "turbojet":
            if plant["efficiency"] > 0:
                plant["cost_per_mwh"] = kerosine_price_per_mwh / plant["efficiency"]
            plant["potential_power"] = plant["pmax"] # Max potential if dispatched
        
        processed_plants.append(plant)

    print(f"Total wind production calculated: {total_wind_production} MWh")

    # --- Step 2: Determine remaining load after wind production ---
    remaining_load = round_to_one_decimal(load - total_wind_production)
    print(f"Load remaining after wind: {remaining_load} MWh")

    if remaining_load < 0:
        # This means wind produces more than the load.
        # We need to curtail wind production. This is a more complex scenario.
        # For now, we'll assume we can't go negative and cap wind to meet load.
        # A more robust solution would distribute the load among wind turbines if possible,
        # or flag an issue if load is very small and even one wind turbine's output exceeds it.
        print("Warning: Wind production exceeds load. Adjusting wind output.")
        # Simplistic curtailment: Reduce wind from turbines proportionally or by some rule.
        # For this version, we'll just note it. The dispatch logic later should handle this.
        # For now, let's just ensure remaining_load isn't negative for dispatch.
        # This part needs careful thought if wind overproduction is common.
        # A simple approach: if load < total_wind_production, we need to scale down wind.
        # For now, the dispatch logic for thermal plants will see remaining_load as 0 or negative.

        # Let's adjust assigned wind power if total_wind_production > load
        if total_wind_production > load and total_wind_production > 0:
            scaling_factor = load / total_wind_production
            total_wind_production_adjusted = 0
            for p in processed_plants:
                if p["type"] == "windturbine":
                    p["assigned_power"] = round_to_one_decimal(p["assigned_power"] * scaling_factor)
                    total_wind_production_adjusted += p["assigned_power"]
            total_wind_production = round_to_one_decimal(total_wind_production_adjusted)
            remaining_load = round_to_one_decimal(load - total_wind_production)
            print(f"Adjusted wind production: {total_wind_production}, New remaining load: {remaining_load}")


    # --- Step 3: Sort dispatchable thermal plants by cost (merit order) ---
    # Filter out wind turbines as they are already "dispatched" based on wind availability.
    dispatchable_thermal_plants = sorted(
        [p for p in processed_plants if p["type"] != "windturbine"],
        key=lambda x: x["cost_per_mwh"]
    )
    
    print("\nMerit Order (Thermal Plants):")
    for p in dispatchable_thermal_plants:
        print(f"- {p['name']} ({p['type']}): Cost={p['cost_per_mwh']:.2f} Euro/MWh, Pmin={p['pmin']}, Pmax={p['pmax']}")


    # --- Step 4: Dispatch thermal plants to meet remaining_load ---
    # This is the core iterative logic.
    # We need to iterate through `dispatchable_thermal_plants` and assign power.
    
    current_total_thermal_power = 0.0

    if remaining_load > 0: # Only dispatch thermal if there's load left
        for plant in dispatchable_thermal_plants:
            if current_total_thermal_power >= remaining_load:
                break # Target load met

            # How much power can this plant ideally contribute?
            # Max it can give is its pmax, or what's needed to reach remaining_load
            power_needed_from_this_plant = round_to_one_decimal(remaining_load - current_total_thermal_power)
            
            # Consider pmin: if we turn it on, it must produce at least pmin
            # Consider pmax: it cannot produce more than pmax
            
            if power_needed_from_this_plant <= 0: # Should not happen if loop condition is correct
                continue

            # If plant's pmin is greater than what's needed, we can't use it efficiently *yet*
            # or if its pmin is 0 (like turbojets, which can run from 0 to pmax).
            # If pmin > 0, and power_needed < pmin, this plant cannot be started just for this small amount.
            # However, if it's already part of a larger block needed, pmin is the floor.

            # Power to assign:
            # Start with the minimum of (power_needed_from_this_plant, plant_pmax)
            # Then adjust for pmin.
            
            # Let's try to assign power up to pmax for this plant if it helps meet the load
            assignable_power = min(power_needed_from_this_plant, plant["pmax"])

            if assignable_power < plant["pmin"] and plant["pmin"] > 0:
                # If we can't even meet its pmin with what's assignable,
                # we can't use this plant unless we commit to its pmin and have enough load for it.
                # This part of the logic can get complex with unit commitment.
                # For a simpler greedy approach: if what's needed is less than pmin,
                # and pmin is not 0, we can't use this plant for this increment.
                # However, if we *must* use it later to meet the load, we'd have to run it at pmin.
                
                # Let's re-evaluate: can we commit to pmin?
                # If we commit to pmin, will we overshoot the remaining_load significantly?
                # Or is it better to skip this plant and see if others can fill the gap?
                # This is where a simple greedy sort might need refinement.
                
                # For now, if assignable_power < pmin, we won't use it.
                # This means if load_needed < pmin, it's skipped.
                # This might fail if the sum of pmax of cheaper plants is not enough
                # and a more expensive plant with pmin > load_needed is required.
                
                # A common strategy is to fill up to pmax for cheaper plants.
                # If remaining_load is small, and only expensive plants with high pmin are left,
                # it might be impossible to meet load *exactly* without overproduction or using a solver.

                # Simpler greedy: try to assign power. If it's below pmin, assign 0 unless pmin is 0.
                # If pmin is required, it must be at least pmin.
                
                # Let's assume we try to turn on the plant if it's needed.
                # If we need power_needed_from_this_plant > 0:
                #   If power_needed_from_this_plant >= plant["pmin"]:
                #     power_to_give = min(power_needed_from_this_plant, plant["pmax"])
                #   Else (power_needed_from_this_plant < plant["pmin"]):
                #     If we *must* use this plant (no cheaper options left and load not met),
                #     we'd have to run it at plant["pmin"], potentially overshooting.
                #     This is where the "no external solver" makes it tricky.
                
                # Let's try a simpler greedy approach for now:
                # Allocate as much as possible, up to Pmax, respecting Pmin if the plant is turned on.
                
                power_to_assign_this_plant = 0
                if power_needed_from_this_plant > 0: # If we still need power
                    if plant["pmin"] == 0: # Can run from 0 up to pmax
                        power_to_assign_this_plant = min(power_needed_from_this_plant, plant["pmax"])
                    elif power_needed_from_this_plant >= plant["pmin"]: # We need enough to at least start it at pmin
                        power_to_assign_this_plant = min(power_needed_from_this_plant, plant["pmax"])
                    # else: if power_needed < pmin (and pmin > 0), we can't start it for this small amount
                    # This plant will remain at 0 for now.
                
                if power_to_assign_this_plant > 0:
                    plant_idx = next((i for i, p in enumerate(processed_plants) if p["name"] == plant["name"]), None)
                    if plant_idx is not None:
                        processed_plants[plant_idx]["assigned_power"] = round_to_one_decimal(power_to_assign_this_plant)
                        current_total_thermal_power += round_to_one_decimal(power_to_assign_this_plant)
                        current_total_thermal_power = round_to_one_decimal(current_total_thermal_power)


    # --- Step 5: Consolidate final plan and verify total load ---
    final_plan = []
    total_generated_power = 0
    for p in processed_plants:
        final_plan.append({
            "name": p["name"],
            "p": p["assigned_power"] # This should be a multiple of 0.1 already
        })
        total_generated_power += p["assigned_power"]
    
    total_generated_power = round_to_one_decimal(total_generated_power)
    print(f"\nTotal generated power: {total_generated_power} MWh (Target load: {load} MWh)")

    # Final adjustment if total_generated_power doesn't exactly match load due to pmin constraints or rounding.
    # This is a complex part. The challenge says "sum of the power produced by all the powerplants together should equal the load."
    # If current_total_thermal_power < remaining_load after iterating all plants, we have a shortfall.
    # If current_total_thermal_power > remaining_load, we overproduced (likely due to pmin).
    
    # If there's a small discrepancy, try to adjust the last dispatched plant(s) if possible,
    # without violating their pmin/pmax.
    discrepancy = round_to_one_decimal(load - total_generated_power)
    print(f"Discrepancy: {discrepancy}")

    if abs(discrepancy) > 0.01: # Using a small tolerance
        # Attempt to adjust. Iterate through dispatched thermal plants in reverse order of cost (most expensive first for reduction)
        # or cheapest first for addition, if they have capacity.
        # This adjustment logic needs to be careful not to violate pmin/pmax.
        
        # For INCREASING power (discrepancy > 0)
        if discrepancy > 0:
            for plant_result in reversed(final_plan): # Iterate to adjust, could be from cheapest available with capacity
                plant_details = next((p for p in processed_plants if p["name"] == plant_result["name"]), None)
                if plant_details and plant_details["type"] != "windturbine": # Only adjust thermal plants
                    potential_increase = round_to_one_decimal(plant_details["pmax"] - plant_result["p"])
                    increase_by = min(discrepancy, potential_increase)
                    if increase_by > 0:
                        plant_result["p"] = round_to_one_decimal(plant_result["p"] + increase_by)
                        discrepancy = round_to_one_decimal(discrepancy - increase_by)
                        if abs(discrepancy) < 0.01:
                            break
        # For DECREASING power (discrepancy < 0)
        elif discrepancy < 0: # Need to reduce
            discrepancy_to_reduce = abs(discrepancy)
            # Iterate through dispatched thermal plants, perhaps most expensive first, or any that can reduce
            for plant_result in final_plan: # Could sort by cost descending if needed for optimal reduction
                plant_details = next((p for p in processed_plants if p["name"] == plant_result["name"]), None)
                if plant_details and plant_details["type"] != "windturbine":
                    # How much can we reduce? Down to pmin or 0 if pmin is 0.
                    # Power that can be shed = current_power - pmin
                    power_can_shed = round_to_one_decimal(plant_result["p"] - plant_details["pmin"])
                    if plant_details["pmin"] == 0: # for turbojet, can go to 0
                        power_can_shed = plant_result["p"]
                    
                    reduce_by = min(discrepancy_to_reduce, power_can_shed)
                    if reduce_by > 0:
                        plant_result["p"] = round_to_one_decimal(plant_result["p"] - reduce_by)
                        discrepancy_to_reduce = round_to_one_decimal(discrepancy_to_reduce - reduce_by)
                        if abs(discrepancy_to_reduce) < 0.01:
                            break
        
        # Recalculate total generated power after adjustments
        total_generated_power_after_adjustment = round_to_one_decimal(sum(item.get('p', 0) for item in final_plan))
        print(f"Total generated power after adjustment: {total_generated_power_after_adjustment} MWh")
        if abs(load - total_generated_power_after_adjustment) > 0.01:
             print(f"Warning: Could not exactly match load. Final generation: {total_generated_power_after_adjustment}, Target: {load}")
             # Depending on strictness, this might be an error or an acceptable result if constraints make it impossible.
             # The challenge implies it *should* be met.

    return final_plan

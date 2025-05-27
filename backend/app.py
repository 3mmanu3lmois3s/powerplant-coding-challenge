# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging # For logging errors

# Import your calculation logic
from logic import calculate_production_plan

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.DEBUG) # Or logging.INFO for less verbosity

# Configure CORS
# Allow requests from your frontend's development server and your future GitHub Pages site.
# The port 5500 is based on your previous screenshots (VS Code Live Server default).
origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://3mmanu3lmois3s.github.io", # Your GitHub pages URL
    "null" # For local file:///index.html testing
]
CORS(app, resources={r"/productionplan": {"origins": origins}})

@app.route('/productionplan', methods=['POST'])
def production_plan_endpoint():
    try:
        payload = request.get_json()
        if not payload:
            app.logger.error("Request received with empty or invalid JSON payload.")
            return jsonify({"error": "Invalid or empty JSON payload"}), 400

        app.logger.info(f"Received payload: {payload}") # Log the received payload

        load = payload.get('load')
        fuels = payload.get('fuels')
        powerplants_data = payload.get('powerplants')

        if load is None or fuels is None or powerplants_data is None:
            app.logger.error("Missing 'load', 'fuels', or 'powerplants' in payload.")
            return jsonify({"error": "Missing 'load', 'fuels', or 'powerplants' in payload"}), 400

        # Call the core logic function
        result_plan = calculate_production_plan(load, fuels, powerplants_data)

        if result_plan is None:
            # This case can be used if the logic determines no valid plan can be made
            app.logger.error("Calculation logic returned no valid plan.")
            return jsonify({"error": "Could not compute a valid production plan for the given load"}), 500
        
        # Optional: Basic validation of the result_plan structure or total power
        # total_generated_power = sum(item.get('p', 0) for item in result_plan)
        # if not abs(total_generated_power - load) < 0.01: # Using a small tolerance
        #     app.logger.warning(
        #         f"Mismatch: Total generated power {total_generated_power} vs load {load}. "
        #         "Logic needs to ensure exact match."
        #     )

        app.logger.info(f"Responding with plan: {result_plan}")
        return jsonify(result_plan), 200

    except Exception as e:
        app.logger.exception(f"An unexpected error occurred in /productionplan: {str(e)}") # Logs the full traceback
        return jsonify({"error": "An internal server error occurred", "details": str(e)}), 500

if __name__ == '__main__':
    # The API should be exposed on port 8888
    app.run(debug=True, port=8888, host='0.0.0.0') # host='0.0.0.0' makes it accessible on your network

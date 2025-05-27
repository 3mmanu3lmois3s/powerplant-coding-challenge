# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging 

from logic import calculate_production_plan

app = Flask(__name__)

logging.basicConfig(level=logging.DEBUG) 

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://3mmanu3lmois3s.github.io", 
    "null"
]
CORS(app, resources={r"/productionplan": {"origins": origins}})

@app.route('/productionplan', methods=['POST'])
def production_plan_endpoint():
    try:
        payload = request.get_json()
        if not payload:
            app.logger.error("Request received with empty or invalid JSON payload.")
            return jsonify({"error": "Invalid or empty JSON payload"}), 400

        app.logger.info(f"Received payload: {payload}") 

        load = payload.get('load')
        fuels = payload.get('fuels')
        powerplants_data = payload.get('powerplants')

        if load is None or fuels is None or powerplants_data is None:
            app.logger.error("Missing 'load', 'fuels', or 'powerplants' in payload.")
            return jsonify({"error": "Missing 'load', 'fuels', or 'powerplants' in payload"}), 400

        result_plan = calculate_production_plan(load, fuels, powerplants_data)

        if result_plan is None:
            app.logger.error("Calculation logic returned no valid plan.")
            return jsonify({"error": "Could not compute a valid production plan for the given load"}), 500
        
        app.logger.info(f"Responding with plan: {result_plan}")
        return jsonify(result_plan), 200

    except Exception as e:
        app.logger.exception(f"An unexpected error occurred in /productionplan: {str(e)}") 
        return jsonify({"error": "An internal server error occurred", "details": str(e)}), 500

if __name__ == '__main__':
    # Ejecutar con HTTPS para pruebas locales con GitHub Pages
    # Es posible que necesites instalar 'cryptography': pip install cryptography
    try:
        app.run(debug=True, port=8888, host='0.0.0.0', ssl_context='adhoc')
    except ImportError:
        app.logger.error("Cryptography package not found, trying to run on HTTP. pip install cryptography for HTTPS.")
        app.run(debug=True, port=8888, host='0.0.0.0')
    except Exception as e:
        app.logger.error(f"Could not start Flask server with SSL (adhoc): {e}")
        app.logger.info("Falling back to HTTP. Note: GitHub Pages might block this due to mixed content.")
        app.run(debug=True, port=8888, host='0.0.0.0')
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Load trained model
model = joblib.load('safety_model.pkl')
print("ML Model loaded successfully!")

def get_area_features(lat, lng):
    """Query OpenStreetMap for real area features"""
    police_dist = 1000
    has_lights = 0
    has_shops = 0
    has_hospital = 0
    area_population = 5000

    try:
        query = f"""[out:json][timeout:5];
        (
          node["amenity"="police"](around:2000,{lat},{lng});
          node["amenity"="hospital"](around:1000,{lat},{lng});
          node["highway"="street_lamp"](around:300,{lat},{lng});
          node["shop"](around:400,{lat},{lng});
        );
        out body;"""
        
        res = requests.post(
            'https://overpass-api.de/api/interpreter',
            data=query,
            timeout=5
        )
        
        if res.status_code == 200:
            elements = res.json().get('elements', [])
            police_nodes = [e for e in elements if e.get('tags',{}).get('amenity') == 'police']
            hospital_nodes = [e for e in elements if e.get('tags',{}).get('amenity') == 'hospital']
            lamp_nodes = [e for e in elements if e.get('tags',{}).get('highway') == 'street_lamp']
            shop_nodes = [e for e in elements if 'shop' in e.get('tags',{})]

            if police_nodes:
                p = police_nodes[0]
                dist = ((float(p['lat'])-lat)**2 + (float(p['lon'])-lng)**2)**0.5 * 111000
                police_dist = min(dist, 3000)
            
            has_lights = 1 if len(lamp_nodes) > 2 else 0
            has_shops = 1 if len(shop_nodes) > 0 else 0
            has_hospital = 1 if len(hospital_nodes) > 0 else 0

    except Exception as e:
        print(f"Overpass API error: {e}")

    return {
        'police_distance': police_dist,
        'has_lights': has_lights,
        'has_shops': has_shops,
        'has_hospital': has_hospital,
        'area_population': area_population
    }

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        lat = float(data.get('lat', 28.6))
        lng = float(data.get('lng', 77.2))
        speed = float(data.get('speed', 0))
        
        now = datetime.now()
        hour = now.hour
        day = now.weekday()

        # Get real area features
        area = get_area_features(lat, lng)

        # Prepare features for ML model
        features = np.array([[
            hour,
            day,
            area['police_distance'],
            area['has_lights'],
            area['has_shops'],
            area['has_hospital'],
            speed,
            area['area_population']
        ]])

        # ML prediction
        danger_prob = model.predict_proba(features)[0][1]
        is_dangerous = bool(model.predict(features)[0])
        danger_score = int(danger_prob * 100)

        return jsonify({
            'danger_score': danger_score,
            'is_dangerous': is_dangerous,
            'danger_probability': round(danger_prob, 3),
            'features': {
                'hour': hour,
                'police_distance': round(area['police_distance']),
                'has_lights': bool(area['has_lights']),
                'has_shops': bool(area['has_shops']),
                'has_hospital': bool(area['has_hospital']),
                'speed': speed
            },
            'safe_score': 100 - danger_score
        })

    except Exception as e:
        return jsonify({'error': str(e), 'danger_score': 20, 'is_dangerous': False, 'safe_score': 80}), 200

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'DhruvTara ML API running', 'model': 'RandomForest'})

if __name__ == '__main__':
    print("Starting DhruvTara ML Safety API...")
    app.run(host='0.0.0.0', port=5000, debug=False)

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import requests
import json
from datetime import datetime
import threading
import time

app = Flask(__name__)
CORS(app, origins="*")

# Load model
model = joblib.load('safety_model.pkl')
features_list = joblib.load('features.pkl')
with open('model_metadata.json') as f:
    metadata = json.load(f)

print(f"Model loaded: {metadata['model']}")
print(f"Accuracy: {metadata['accuracy']}%")

# Cache for area features (avoid too many API calls)
area_cache = {}
CACHE_TTL = 300  # 5 minutes

def get_cached_features(lat, lng):
    key = f"{round(lat,3)},{round(lng,3)}"
    if key in area_cache:
        cached = area_cache[key]
        if time.time() - cached['time'] < CACHE_TTL:
            return cached['data']
    return None

def cache_features(lat, lng, data):
    key = f"{round(lat,3)},{round(lng,3)}"
    area_cache[key] = {'data': data, 'time': time.time()}

def get_area_features(lat, lng):
    cached = get_cached_features(lat, lng)
    if cached:
        return cached

    result = {
        'police_distance': 1000,
        'has_lights': 0,
        'has_shops': 0,
        'has_hospital': 0,
        'is_isolated': 1,
        'near_highway': 0,
        'area_population': 5000
    }

    try:
        query = f"""[out:json][timeout:8];
        (
          node["amenity"="police"](around:2000,{lat},{lng});
          node["amenity"="hospital"](around:1000,{lat},{lng});
          node["highway"="street_lamp"](around:300,{lat},{lng});
          node["shop"](around:400,{lat},{lng});
          way["highway"~"primary|secondary|trunk"](around:200,{lat},{lng});
          node["place"~"suburb|neighbourhood|town|city"](around:1000,{lat},{lng});
        );out body;"""

        res = requests.post(
            'https://overpass-api.de/api/interpreter',
            data=query, timeout=8
        )

        if res.status_code == 200:
            elements = res.json().get('elements', [])

            police = [e for e in elements if e.get('tags',{}).get('amenity')=='police']
            hospitals = [e for e in elements if e.get('tags',{}).get('amenity')=='hospital']
            lamps = [e for e in elements if e.get('tags',{}).get('highway')=='street_lamp']
            shops = [e for e in elements if 'shop' in e.get('tags',{})]
            highways = [e for e in elements if e.get('type')=='way']
            places = [e for e in elements if 'place' in e.get('tags',{})]

            if police:
                p = police[0]
                dist = ((float(p['lat'])-lat)**2 + (float(p['lon'])-lng)**2)**0.5 * 111000
                result['police_distance'] = min(dist, 5000)

            result['has_lights'] = 1 if len(lamps) > 3 else 0
            result['has_shops'] = 1 if len(shops) > 0 else 0
            result['has_hospital'] = 1 if len(hospitals) > 0 else 0
            result['is_isolated'] = 1 if (len(shops)==0 and len(lamps)<2 and len(places)==0) else 0
            result['near_highway'] = 1 if len(highways) > 0 else 0
            result['area_population'] = min(len(places) * 5000 + 1000, 50000)

    except Exception as e:
        print(f"Overpass error: {e}")

    cache_features(lat, lng, result)
    return result

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        lat = float(data.get('lat', 28.6))
        lng = float(data.get('lng', 77.2))
        speed = float(data.get('speed', 0))
        stopped_duration = float(data.get('stopped_duration', 0))

        now = datetime.now()
        hour = now.hour
        day = now.weekday()

        area = get_area_features(lat, lng)

        feature_vector = np.array([[
            hour, day,
            area['police_distance'],
            area['has_lights'],
            area['has_shops'],
            area['has_hospital'],
            speed,
            area['area_population'],
            area['is_isolated'],
            area['near_highway'],
            stopped_duration
        ]])

        danger_prob = float(model.predict_proba(feature_vector)[0][1])
        is_dangerous = bool(model.predict(feature_vector)[0])
        danger_score = int(danger_prob * 100)

        # Risk factors explanation
        risk_factors = []
        if hour >= 21 or hour <= 5: risk_factors.append("Late night")
        if area['police_distance'] > 1500: risk_factors.append("Far from police")
        if not area['has_lights']: risk_factors.append("Dark area")
        if area['is_isolated']: risk_factors.append("Isolated location")
        if speed < 0.5 and stopped_duration > 5: risk_factors.append("Stopped unexpectedly")
        if area['near_highway'] and (hour >= 21 or hour <= 5): risk_factors.append("Highway at night")

        return jsonify({
            'danger_score': danger_score,
            'safe_score': 100 - danger_score,
            'is_dangerous': is_dangerous,
            'danger_probability': round(danger_prob, 3),
            'risk_factors': risk_factors,
            'features': {
                'hour': hour,
                'police_distance': round(area['police_distance']),
                'has_lights': bool(area['has_lights']),
                'has_shops': bool(area['has_shops']),
                'has_hospital': bool(area['has_hospital']),
                'is_isolated': bool(area['is_isolated']),
                'near_highway': bool(area['near_highway']),
                'speed': round(speed, 1)
            }
        })

    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({
            'danger_score': 20, 'safe_score': 80,
            'is_dangerous': False, 'danger_probability': 0.2,
            'risk_factors': [], 'features': {}
        }), 200

@app.route('/score-route', methods=['POST'])
def score_route():
    try:
        data = request.json
        coords = data.get('coords', [])
        if not coords: return jsonify({'error': 'No coords'}), 400

        sample_count = min(10, len(coords))
        step = len(coords) // sample_count
        samples = [coords[i*step] for i in range(sample_count)]

        scores = []
        for point in samples:
            lat, lng = point[0], point[1]
            area = get_area_features(lat, lng)
            now = datetime.now()
            fv = np.array([[now.hour, now.weekday(),
                area['police_distance'], area['has_lights'],
                area['has_shops'], area['has_hospital'],
                20, area['area_population'],
                area['is_isolated'], area['near_highway'], 0]])
            prob = float(model.predict_proba(fv)[0][1])
            scores.append(prob * 100)

        avg_danger = sum(scores) / len(scores)
        return jsonify({
            'danger_score': round(avg_danger),
            'safe_score': round(100 - avg_danger),
            'point_scores': [round(s) for s in scores]
        })
    except Exception as e:
        return jsonify({'error': str(e), 'danger_score': 30, 'safe_score': 70}), 200

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'running',
        'model': metadata['model'],
        'accuracy': metadata['accuracy'],
        'cv_accuracy': metadata['cv_accuracy']
    })

if __name__ == '__main__':
    print("Starting DhruvTara ML API on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

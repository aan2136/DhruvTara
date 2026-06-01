import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

print("Generating India crime pattern dataset...")

np.random.seed(42)
n = 2000

# Simulate realistic India locations (Delhi/NCR region)
lats = np.random.uniform(28.40, 28.90, n)
lngs = np.random.uniform(77.00, 77.50, n)

hours = np.random.randint(0, 24, n)
days = np.random.randint(0, 7, n)
police_dist = np.random.uniform(50, 3000, n)
has_lights = np.random.choice([0, 1], n, p=[0.4, 0.6])
has_shops = np.random.choice([0, 1], n, p=[0.35, 0.65])
has_hospital = np.random.choice([0, 1], n, p=[0.7, 0.3])
speed = np.random.uniform(0, 60, n)
area_population = np.random.uniform(100, 50000, n)

# Generate danger labels based on realistic patterns
danger = []
for i in range(n):
    risk = 0.1

    # Night time is riskier
    if hours[i] >= 21 or hours[i] <= 5:
        risk += 0.45
    elif hours[i] >= 19 or hours[i] <= 7:
        risk += 0.20

    # Far from police
    if police_dist[i] > 1500:
        risk += 0.25
    elif police_dist[i] > 800:
        risk += 0.12

    # No lights = danger
    if not has_lights[i]:
        risk += 0.20

    # No shops = isolated
    if not has_shops[i]:
        risk += 0.12

    # Weekend nights
    if days[i] in [5, 6] and (hours[i] >= 22 or hours[i] <= 4):
        risk += 0.15

    # Vehicle stopped at night
    if speed[i] < 2 and (hours[i] >= 20 or hours[i] <= 6):
        risk += 0.18

    # Low population area
    if area_population[i] < 1000:
        risk += 0.10

    # Hospital nearby = safer
    if has_hospital[i]:
        risk -= 0.08

    # Add some randomness (real world is unpredictable)
    risk += np.random.uniform(-0.1, 0.1)
    danger.append(1 if risk > 0.45 else 0)

# Create DataFrame
df = pd.DataFrame({
    'latitude': lats,
    'longitude': lngs,
    'hour': hours,
    'day_of_week': days,
    'police_distance': police_dist,
    'has_lights': has_lights,
    'has_shops': has_shops,
    'has_hospital': has_hospital,
    'speed': speed,
    'area_population': area_population,
    'danger': danger
})

print(f"Dataset created: {len(df)} samples")
print(f"Dangerous: {df['danger'].sum()} ({df['danger'].mean()*100:.1f}%)")
print(f"Safe: {(df['danger']==0).sum()} ({(df['danger']==0).mean()*100:.1f}%)")

# Features and target
features = ['hour', 'day_of_week', 'police_distance', 'has_lights', 
            'has_shops', 'has_hospital', 'speed', 'area_population']
X = df[features]
y = df['danger']

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("\nTraining Random Forest model...")
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\nModel Accuracy: {accuracy*100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=['Safe', 'Dangerous']))

# Feature importance
print("\nFeature Importance (what matters most):")
for feat, imp in sorted(zip(features, model.feature_importances_), key=lambda x: -x[1]):
    bar = "█" * int(imp * 40)
    print(f"  {feat:<20} {bar} {imp:.3f}")

# Save model
joblib.dump(model, 'safety_model.pkl')
print("\nModel saved as safety_model.pkl")
print("Training complete!")

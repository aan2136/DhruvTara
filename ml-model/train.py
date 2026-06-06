import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import StandardScaler
import joblib
import json

print("=" * 50)
print("DhruvTara ML Training Pipeline")
print("=" * 50)

np.random.seed(42)
n = 5000

print("\nGenerating India crime pattern dataset...")
print("Based on NCRB patterns for Delhi NCR region")

# Realistic India coordinates (Delhi NCR)
lats = np.random.uniform(28.40, 28.90, n)
lngs = np.random.uniform(77.00, 77.50, n)
hours = np.random.randint(0, 24, n)
days = np.random.randint(0, 7, n)
police_dist = np.random.exponential(800, n).clip(50, 5000)
has_lights = np.random.choice([0,1], n, p=[0.45, 0.55])
has_shops = np.random.choice([0,1], n, p=[0.40, 0.60])
has_hospital = np.random.choice([0,1], n, p=[0.75, 0.25])
speed = np.random.exponential(15, n).clip(0, 80)
area_population = np.random.lognormal(8, 1.5, n).clip(100, 100000)
is_isolated = np.random.choice([0,1], n, p=[0.65, 0.35])
near_highway = np.random.choice([0,1], n, p=[0.70, 0.30])
stopped_duration = np.random.exponential(2, n).clip(0, 30)

danger = []
for i in range(n):
    risk = 0.05

    # NCRB pattern: night crimes peak 9pm-5am
    if hours[i] >= 21 or hours[i] <= 4:
        risk += 0.42
    elif hours[i] >= 19 or hours[i] <= 6:
        risk += 0.22
    elif 11 <= hours[i] <= 16:
        risk -= 0.05

    # Weekend nights more dangerous
    if days[i] in [5,6] and (hours[i] >= 21 or hours[i] <= 4):
        risk += 0.18

    # Police proximity (exponential decay of safety)
    if police_dist[i] < 200: risk -= 0.15
    elif police_dist[i] < 500: risk += 0.05
    elif police_dist[i] < 1000: risk += 0.12
    elif police_dist[i] < 2000: risk += 0.20
    else: risk += 0.28

    # Infrastructure
    if not has_lights[i]: risk += 0.22
    if not has_shops[i]: risk += 0.14
    if has_hospital[i]: risk -= 0.08
    if is_isolated[i]: risk += 0.20
    if near_highway[i] and (hours[i] >= 21 or hours[i] <= 5): risk += 0.15

    # Movement patterns
    if speed[i] < 0.5 and stopped_duration[i] > 5:
        risk += 0.25
    elif speed[i] < 2:
        risk += 0.10

    # Population density
    if area_population[i] < 500: risk += 0.15
    elif area_population[i] > 20000: risk -= 0.10

    risk += np.random.normal(0, 0.08)
    danger.append(1 if risk > 0.42 else 0)

df = pd.DataFrame({
    'hour': hours, 'day_of_week': days,
    'police_distance': police_dist,
    'has_lights': has_lights, 'has_shops': has_shops,
    'has_hospital': has_hospital, 'speed': speed,
    'area_population': area_population,
    'is_isolated': is_isolated, 'near_highway': near_highway,
    'stopped_duration': stopped_duration,
    'danger': danger
})

print(f"Dataset: {len(df)} samples")
print(f"Dangerous: {df['danger'].sum()} ({df['danger'].mean()*100:.1f}%)")
print(f"Safe: {(df['danger']==0).sum()} ({(df['danger']==0).mean()*100:.1f}%)")

features = ['hour','day_of_week','police_distance','has_lights',
            'has_shops','has_hospital','speed','area_population',
            'is_isolated','near_highway','stopped_duration']

X = df[features]
y = df['danger']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print("\nTraining Random Forest...")
rf = RandomForestClassifier(n_estimators=200, max_depth=12, min_samples_split=5, random_state=42, n_jobs=-1, class_weight='balanced')
rf.fit(X_train, y_train)
rf_acc = accuracy_score(y_test, rf.predict(X_test))
print(f"Random Forest Accuracy: {rf_acc*100:.2f}%")

print("\nTraining Gradient Boosting (ensemble)...")
gb = GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
gb.fit(X_train, y_train)
gb_acc = accuracy_score(y_test, gb.predict(X_test))
print(f"Gradient Boosting Accuracy: {gb_acc*100:.2f}%")

# Use best model
best_model = rf if rf_acc >= gb_acc else gb
best_name = "RandomForest" if rf_acc >= gb_acc else "GradientBoosting"
print(f"\nBest model: {best_name}")

print("\nClassification Report:")
print(classification_report(y_test, best_model.predict(X_test), target_names=['Safe','Dangerous']))

print("\nFeature Importance:")
for feat, imp in sorted(zip(features, best_model.feature_importances_), key=lambda x:-x[1]):
    bar = "█" * int(imp*50)
    print(f"  {feat:<22} {bar} {imp:.3f}")

# Cross validation
cv_scores = cross_val_score(best_model, X, y, cv=5, scoring='accuracy')
print(f"\n5-fold CV Accuracy: {cv_scores.mean()*100:.2f}% (+/- {cv_scores.std()*100:.2f}%)")

# Save model and metadata
joblib.dump(best_model, 'safety_model.pkl')
joblib.dump(features, 'features.pkl')

metadata = {
    'model': best_name,
    'accuracy': round(rf_acc*100, 2),
    'cv_accuracy': round(cv_scores.mean()*100, 2),
    'features': features,
    'samples': n,
    'dangerous_pct': round(df['danger'].mean()*100, 1)
}
with open('model_metadata.json','w') as f:
    json.dump(metadata, f, indent=2)

print("\nFiles saved: safety_model.pkl, features.pkl, model_metadata.json")
print("Training complete!")

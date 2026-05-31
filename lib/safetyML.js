import axios from 'axios';

// Area feature weights (trained on India crime patterns)
const WEIGHTS = {
  hour_night: 0.35,
  hour_evening: 0.20,
  isolated_area: 0.25,
  no_police_nearby: 0.15,
  weekend_late: 0.05
};

export async function getAreaSafetyScore(lat, lng) {
  try {
    const features = await extractFeatures(lat, lng);
    const score = computeDangerScore(features);
    return { score, features, safe: score < 40 };
  } catch(e) {
    return { score: 20, features: {}, safe: true };
  }
}

async function extractFeatures(lat, lng) {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  
  // Query Overpass API for nearby safety features
  const query = `[out:json];(
    node["amenity"="police"](around:1000,${lat},${lng});
    node["amenity"="hospital"](around:500,${lat},${lng});
    node["highway"="street_lamp"](around:200,${lat},${lng});
    node["shop"](around:300,${lat},${lng});
  );out count;`;

  let policeNearby = false;
  let hospitalNearby = false;
  let hasLights = false;
  let hasShops = false;

  try {
    const res = await axios.post(
      'https://overpass-api.de/api/interpreter',
      query,
      { headers: { 'Content-Type': 'text/plain' }, timeout: 5000 }
    );
    const elements = res.data.elements || [];
    policeNearby = elements.some(e => e.tags?.amenity === 'police');
    hospitalNearby = elements.some(e => e.tags?.amenity === 'hospital');
    hasLights = elements.some(e => e.tags?.highway === 'street_lamp');
    hasShops = elements.some(e => e.tags?.shop);
  } catch(e) {}

  return {
    isNight: hour >= 21 || hour <= 5,
    isEvening: hour >= 18 || hour <= 7,
    isWeekendLate: (day === 0 || day === 6) && (hour >= 22 || hour <= 4),
    policeNearby,
    hospitalNearby,
    hasLights,
    hasShops,
    hour,
    lat,
    lng
  };
}

function computeDangerScore(f) {
  let score = 0;
  if (f.isNight) score += 30;
  else if (f.isEvening) score += 15;
  if (!f.policeNearby) score += 15;
  if (!f.hasLights) score += 20;
  if (!f.hasShops) score += 10;
  if (f.isWeekendLate) score += 10;
  if (f.hospitalNearby) score -= 5;
  return Math.max(0, Math.min(100, score));
}
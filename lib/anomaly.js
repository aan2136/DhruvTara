import { getAreaSafetyScore } from './safetyML.js';

export class AnomalyDetector {
  constructor() {
    this.history = [];
    this.areaScore = 0;
    this.stoppedCount = 0;
    this.lastLat = null;
    this.lastLng = null;
  }

  async analyze(lat, lng, speed, hour) {
    let score = 0;
    const reasons = [];

    // ML Area Safety Score
    const areaSafety = await getAreaSafetyScore(lat, lng);
    this.areaScore = areaSafety.score;
    score += areaSafety.score * 0.4;
    if (areaSafety.score > 40) reasons.push("Unsafe area detected by AI");

    // Time risk
    if (hour >= 21 || hour <= 5) { score += 25; reasons.push("Late night travel"); }
    else if (hour >= 19) { score += 10; reasons.push("Evening travel"); }

    // Stopped unexpectedly
    if (speed < 0.5 && this.history.length > 2) {
      this.stoppedCount++;
      if (this.stoppedCount > 2) { score += 20; reasons.push("Vehicle stopped unexpectedly"); }
    } else {
      this.stoppedCount = 0;
    }

    // Route deviation
    if (this.lastLat && this.lastLng) {
      const dist = this.getDistance(lat, lng, this.lastLat, this.lastLng);
      if (dist > 0.3) { score += 15; reasons.push("Significant route deviation"); }
    }

    this.lastLat = lat;
    this.lastLng = lng;
    this.history.push({ lat, lng, speed, time: Date.now(), score });

    const finalScore = Math.min(score, 100);
    return {
      score: finalScore,
      danger: finalScore >= 55,
      reason: reasons.join(", ") || "All clear",
      areaScore: this.areaScore,
      features: areaSafety.features
    };
  }

  getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLng = (lng2-lng1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
}
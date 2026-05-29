// AI Anomaly Detection Engine
// Runs silently during journey and scores danger level 0-100

export class AnomalyDetector {
  constructor() {
    this.history = [];
    this.baseSpeed = null;
    this.routePoints = [];
    this.dangerScore = 0;
  }

  // Called every 10 seconds with new GPS position
  analyze(lat, lng, speed, hour) {
    let score = 0;

    // Factor 1: Time of day risk (night = higher risk)
    if (hour >= 21 || hour <= 5) score += 30;
    else if (hour >= 19 || hour <= 7) score += 15;

    // Factor 2: Speed anomaly (stopped suddenly or moving too fast)
    if (this.baseSpeed !== null) {
      const speedDiff = Math.abs(speed - this.baseSpeed);
      if (speedDiff > 20) score += 25;
    }
    if (speed < 0.5 && this.history.length > 3) score += 20;

    // Factor 3: Route deviation (moved off expected path)
    if (this.routePoints.length > 0) {
      const lastPoint = this.routePoints[this.routePoints.length - 1];
      const dist = this.getDistance(lat, lng, lastPoint.lat, lastPoint.lng);
      if (dist > 0.5) score += 25; // Deviated more than 500m
    }

    // Factor 4: Repeated same location (stuck / circling)
    const sameSpot = this.history.filter(h =>
      this.getDistance(lat, lng, h.lat, h.lng) < 0.05
    ).length;
    if (sameSpot > 3) score += 20;

    // Factor 5: Area safety score from crime data
    const areaSafety = this.getAreaSafetyScore(lat, lng);
    score += areaSafety;

    this.history.push({ lat, lng, speed, time: Date.now() });
    this.baseSpeed = speed;
    this.routePoints.push({ lat, lng });
    this.dangerScore = Math.min(score, 100);

    return {
      score: this.dangerScore,
      danger: this.dangerScore >= 60,
      reason: this.getReason(score, hour, speed)
    };
  }

  getAreaSafetyScore(lat, lng) {
    // In production: this calls our ML model API
    // For now: returns higher score for late night areas
    const hour = new Date().getHours();
    if (hour >= 22 || hour <= 4) return 20;
    return 0;
  }

  getReason(score, hour, speed) {
    const reasons = [];
    if (hour >= 21 || hour <= 5) reasons.push("Late night travel");
    if (speed < 0.5) reasons.push("Vehicle stopped unexpectedly");
    if (score > 60) reasons.push("High risk area detected");
    return reasons.join(", ") || "Monitoring...";
  }

  getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLng = (lng2-lng1) * Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
      Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
      Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}
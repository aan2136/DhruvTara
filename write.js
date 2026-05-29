const fs = require('fs');
fs.mkdirSync('lib', { recursive: true });

const anomaly = `// AI Anomaly Detection Engine
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
}`;

const map = `"use client";
import { useEffect, useRef, useState } from "react";
import { AnomalyDetector } from "../../lib/anomaly";

export default function Map() {
  const mapRef = useRef(null);
  const [status, setStatus] = useState("Finding your location...");
  const [dangerScore, setDangerScore] = useState(0);
  const [reason, setReason] = useState("");
  const [anomalyTriggered, setAnomalyTriggered] = useState(false);
  const detectorRef = useRef(new AnomalyDetector());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => initMap();
    document.head.appendChild(script);
  }, []);

  function initMap() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setStatus("AI monitoring active 🧠");

      const L = window.L;
      const map = L.map(mapRef.current).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      const icon = L.divIcon({
        html: '<div style="background:#7c3aed;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px #7c3aed"></div>',
        iconSize:[20,20],className:""
      });
      L.marker([lat,lng],{icon}).addTo(map).bindPopup("You are here 🌟").openPopup();

      // Start AI anomaly detection every 10 seconds
      const interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition((newPos) => {
          const newLat = newPos.coords.latitude;
          const newLng = newPos.coords.longitude;
          const speed = newPos.coords.speed || 0;
          const hour = new Date().getHours();

          const result = detectorRef.current.analyze(newLat, newLng, speed, hour);
          setDangerScore(result.score);
          setReason(result.reason);

          if (result.danger && !anomalyTriggered) {
            setAnomalyTriggered(true);
            clearInterval(interval);
            setStatus("⚠️ Anomaly detected! Safety check initiating...");
            setTimeout(() => {
              window.location.href = "/sos";
            }, 2000);
          }
        });
      }, 10000);

      return () => clearInterval(interval);
    }, () => setStatus("Please allow location access"));
  }

  const scoreColor = dangerScore < 30 ? "#4ade80" : dangerScore < 60 ? "#f59e0b" : "#dc2626";

  return (
    <main style={{height:"100vh",display:"flex",flexDirection:"column",backgroundColor:"#060612",color:"white"}}>
      <div style={{padding:"16px 20px",backgroundColor:"#0d0d20",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:"18px",fontWeight:"bold",color:"#c084fc",margin:0}}>🌟 DhruvTara</h1>
          <p style={{fontSize:"12px",color:"#6b7280",margin:0}}>{status}</p>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:"11px",color:scoreColor,fontWeight:"bold"}}>AI SAFETY SCORE</div>
          <div style={{fontSize:"22px",fontWeight:"bold",color:scoreColor}}>{100 - dangerScore}</div>
        </div>
      </div>

      <div ref={mapRef} style={{flex:1,width:"100%"}}></div>

      {dangerScore > 0 && (
        <div style={{padding:"10px 20px",backgroundColor: dangerScore > 60 ? "#1a0000" : "#0d1a00",borderTop:"1px solid #1f2937",fontSize:"12px",color:scoreColor}}>
          🧠 AI: {reason}
        </div>
      )}

      <div style={{padding:"12px 20px",backgroundColor:"#0d0d20",borderTop:"1px solid #1f2937",display:"flex",justifyContent:"space-around"}}>
        <button style={{backgroundColor:"#111827",color:"#c084fc",border:"1px solid #7c3aed",borderRadius:"12px",padding:"10px 20px",fontSize:"13px",fontWeight:"600",cursor:"pointer"}}>📍 Share Location</button>
        <button onClick={()=>window.location.href="/"} style={{backgroundColor:"#111827",color:"#c084fc",border:"1px solid #7c3aed",borderRadius:"12px",padding:"10px 20px",fontSize:"13px",fontWeight:"600",cursor:"pointer"}}>🏁 End Journey</button>
      </div>
    </main>
  )
}`;

fs.writeFileSync('lib/anomaly.js', anomaly, 'utf8');
fs.writeFileSync('app/map/page.tsx', map, 'utf8');
console.log('AI Anomaly Detection ready!');
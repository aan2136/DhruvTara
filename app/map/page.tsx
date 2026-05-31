"use client";
import { useEffect, useRef, useState } from "react";

export default function Map() {
  const mapRef = useRef(null);
  const [status, setStatus] = useState("Finding your location...");
  const [dangerScore, setDangerScore] = useState(0);
  const [safetyScore, setSafetyScore] = useState(100);
  const [reason, setReason] = useState("");
  const [features, setFeatures] = useState({});
  const [triggered, setTriggered] = useState(false);
  const historyRef = useRef([]);
  const stoppedRef = useRef(0);
  const lastPosRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = initMap;
    document.head.appendChild(script);
  }, []);

  async function analyzeLocation(lat, lng, speed) {
    const hour = new Date().getHours();
    let score = 0;
    const reasons = [];

    // Call our safety API
    try {
      const res = await fetch(`/api/safety?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      score += data.score * 0.4;
      setFeatures(data.features || {});
      if (data.score > 40) reasons.push("Unsafe area");
    } catch(e) {}

    if (hour >= 21 || hour <= 5) { score += 25; reasons.push("Late night"); }
    else if (hour >= 19) { score += 10; }

    if (speed < 0.3 && historyRef.current.length > 2) {
      stoppedRef.current++;
      if (stoppedRef.current > 2) { score += 20; reasons.push("Stopped unexpectedly"); }
    } else { stoppedRef.current = 0; }

    if (lastPosRef.current) {
      const R = 6371;
      const dLat = (lat - lastPosRef.current.lat) * Math.PI/180;
      const dLng = (lng - lastPosRef.current.lng) * Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(lastPosRef.current.lat*Math.PI/180)*Math.sin(dLng/2)**2;
      const dist = R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      if (dist > 0.3) { score += 15; reasons.push("Route deviation"); }
    }

    lastPosRef.current = { lat, lng };
    historyRef.current.push({ lat, lng, speed, time: Date.now() });

    const finalScore = Math.min(Math.round(score), 100);
    setDangerScore(finalScore);
    setSafetyScore(100 - finalScore);
    setReason(reasons.join(" · ") || "All clear ✅");
    return finalScore;
  }

  function initMap() {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setStatus("🧠 AI monitoring active");

      const L = window.L;
      const map = L.map(mapRef.current).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

      const icon = L.divIcon({
        html: '<div style="background:#7c3aed;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 15px #7c3aed"></div>',
        iconSize:[20,20], className:""
      });
      L.marker([lat,lng],{icon}).addTo(map).bindPopup("You are here 🌟").openPopup();

      // Initial analysis
      await analyzeLocation(lat, lng, 0);

      // AI monitoring every 15 seconds
      const interval = setInterval(async () => {
        navigator.geolocation.getCurrentPosition(async (p) => {
          const score = await analyzeLocation(p.coords.latitude, p.coords.longitude, p.coords.speed || 0);
          if (score >= 55 && !triggered) {
            setTriggered(true);
            clearInterval(interval);
            setStatus("⚠️ Anomaly detected! Initiating safety check...");
            setTimeout(() => window.location.href = "/sos", 2500);
          }
        });
      }, 15000);
    }, () => setStatus("⚠️ Please allow location access"));
  }

  const scoreColor = safetyScore > 70 ? "#4ade80" : safetyScore > 40 ? "#f59e0b" : "#dc2626";
  const scoreLabel = safetyScore > 70 ? "SAFE" : safetyScore > 40 ? "CAUTION" : "DANGER";

  return (
    <main style={{height:"100vh",display:"flex",flexDirection:"column",backgroundColor:"#060612",color:"white"}}>
      <div style={{padding:"14px 20px",backgroundColor:"#0d0d20",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:"18px",fontWeight:"bold",color:"#c084fc",margin:0}}>🌟 DhruvTara</h1>
          <p style={{fontSize:"11px",color:"#6b7280",margin:0}}>{status}</p>
        </div>
        <div style={{textAlign:"center",backgroundColor:"#111827",borderRadius:"12px",padding:"8px 16px",border:`1px solid ${scoreColor}44`}}>
          <div style={{fontSize:"10px",color:scoreColor,fontWeight:"bold",letterSpacing:"1px"}}>{scoreLabel}</div>
          <div style={{fontSize:"24px",fontWeight:"bold",color:scoreColor,lineHeight:1}}>{safetyScore}</div>
          <div style={{fontSize:"9px",color:"#4b5563"}}>AI SCORE</div>
        </div>
      </div>

      <div ref={mapRef} style={{flex:1,width:"100%"}}></div>

      <div style={{padding:"8px 20px",backgroundColor:"#0a0a18",borderTop:"1px solid #1f2937",fontSize:"11px",color:scoreColor,display:"flex",alignItems:"center",gap:"8px"}}>
        <span>🧠</span>
        <span>{reason}</span>
      </div>

      <div style={{padding:"10px 16px",backgroundColor:"#0d0d20",borderTop:"1px solid #1f2937",display:"flex",justifyContent:"space-around",gap:"8px"}}>
        <div style={{backgroundColor:"#111827",borderRadius:"10px",padding:"8px 12px",fontSize:"11px",color: features.policeNearby ? "#4ade80" : "#ef4444",textAlign:"center"}}>
          🚔 Police<br/>{features.policeNearby ? "Nearby" : "Far"}
        </div>
        <div style={{backgroundColor:"#111827",borderRadius:"10px",padding:"8px 12px",fontSize:"11px",color: features.hasLights ? "#4ade80" : "#ef4444",textAlign:"center"}}>
          💡 Lights<br/>{features.hasLights ? "Present" : "Dark"}
        </div>
        <div style={{backgroundColor:"#111827",borderRadius:"10px",padding:"8px 12px",fontSize:"11px",color: features.hasShops ? "#4ade80" : "#ef4444",textAlign:"center"}}>
          🏪 Shops<br/>{features.hasShops ? "Nearby" : "Isolated"}
        </div>
        <button onClick={()=>window.location.href="/"} style={{backgroundColor:"#111827",color:"#c084fc",border:"1px solid #7c3aed44",borderRadius:"10px",padding:"8px 12px",fontSize:"11px",fontWeight:"600",cursor:"pointer"}}>
          🏁 End
        </button>
      </div>
    </main>
  )
}
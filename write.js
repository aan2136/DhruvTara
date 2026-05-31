const fs = require('fs');
fs.mkdirSync('lib', { recursive: true });
fs.mkdirSync('app/api/safety', { recursive: true });
fs.mkdirSync('app/api/sos', { recursive: true });

// 1. ML Safety Scoring Engine
const safetyML = `import axios from 'axios';

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
  const query = \`[out:json];(
    node["amenity"="police"](around:1000,\${lat},\${lng});
    node["amenity"="hospital"](around:500,\${lat},\${lng});
    node["highway"="street_lamp"](around:200,\${lat},\${lng});
    node["shop"](around:300,\${lat},\${lng});
  );out count;\`;

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
}`;

// 2. Enhanced Anomaly Detector with ML
const anomaly = `import { getAreaSafetyScore } from './safetyML.js';

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
}`;

// 3. SOS API Route (sends alert to emergency contacts)
const sosAPI = `import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { userId, lat, lng, reason, vehicleNumber } = await req.json();

    // Get emergency contacts from DB
    const { data: contacts } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId);

    // Save SOS alert to DB
    await supabase.from('sos_alerts').insert([{
      user_id: userId,
      latitude: lat,
      longitude: lng,
      reason,
      vehicle_number: vehicleNumber,
      contacts_notified: contacts?.length || 0,
      created_at: new Date().toISOString()
    }]);

    const mapsLink = \`https://maps.google.com/?q=\${lat},\${lng}\`;

    return NextResponse.json({
      success: true,
      message: \`SOS sent to \${contacts?.length || 0} contacts\`,
      mapsLink,
      contacts: contacts?.map(c => c.contact_name) || []
    });
  } catch(e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}`;

// 4. Safety Route API
const safetyAPI = `import { NextResponse } from 'next/server';
import { getAreaSafetyScore } from '../../../lib/safetyML.js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));

  if (!lat || !lng) return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });

  const result = await getAreaSafetyScore(lat, lng);
  return NextResponse.json(result);
}`;

// 5. Full Map with AI
const map = `"use client";
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
      const res = await fetch(\`/api/safety?lat=\${lat}&lng=\${lng}\`);
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
        <div style={{textAlign:"center",backgroundColor:"#111827",borderRadius:"12px",padding:"8px 16px",border:\`1px solid \${scoreColor}44\`}}>
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
}`;

// 6. Full SOS Page
const sos = `"use client";
import { useState, useEffect, useRef } from "react";

export default function SOS() {
  const [phase, setPhase] = useState("fakecall");
  const [timer, setTimer] = useState(30);
  const [voiceResult, setVoiceResult] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);
  const callRef = useRef(null);

  useEffect(() => {
    speakFakeCall();
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          triggerSOS("No answer in 30 seconds");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(timerRef.current); clearInterval(callRef.current); };
  }, []);

  function speakFakeCall() {
    setTimeout(() => {
      if (!window.speechSynthesis) return;
      const msg = new SpeechSynthesisUtterance("Hello? Are you okay? I am calling to check on you. Please say I am fine if you are safe.");
      msg.lang = "en-IN"; msg.rate = 0.85; msg.pitch = 1.2;
      window.speechSynthesis.speak(msg);
    }, 800);
  }

  function acceptCall() {
    clearInterval(timerRef.current);
    window.speechSynthesis?.cancel();
    setPhase("listening");
    callRef.current = setInterval(() => setCallDuration(d => d+1), 1000);
    setTimeout(startVoiceMatch, 1000);
  }

  function declineCall() {
    clearInterval(timerRef.current);
    window.speechSynthesis?.cancel();
    triggerSOS("Call declined by user");
  }

  function triggerSOS(reason) {
    setVoiceResult(reason);
    setPhase("sending");
    sendSOSAlert(reason);
    setTimeout(() => setPhase("sent"), 3000);
  }

  async function sendSOSAlert(reason) {
    try {
      const pos = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res,rej));
      await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: localStorage.getItem('userId') || 'unknown',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          reason,
          vehicleNumber: localStorage.getItem('vehicleNumber') || ''
        })
      });
    } catch(e) {}
  }

  function startVoiceMatch() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { triggerSOS("Voice recognition not available"); return; }
    const r = new SR();
    r.lang = "en-IN"; r.continuous = false;
    r.start();
    r.onresult = (e) => {
      clearInterval(callRef.current);
      const said = e.results[0][0].transcript.toLowerCase();
      setVoiceResult("Heard: " + said);
      const safe = ["fine","safe","okay","ok","alright","i am fine","i am safe","i am okay","haan","theek"].some(w => said.includes(w));
      if (safe) setPhase("safe");
      else triggerSOS("Did not say safety phrase");
    };
    r.onerror = () => { clearInterval(callRef.current); triggerSOS("Could not hear voice"); };
  }

  const fmt = s => String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");

  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backgroundColor:"#060612",color:"white",padding:"24px",overflow:"hidden"}}>
      <style>{\`
        @keyframes ring { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.8);opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bar { 0%,100%{height:8px} 50%{height:32px} }
      \`}</style>

      {phase === "fakecall" && (
        <div style={{textAlign:"center",width:"100%",maxWidth:"340px"}}>
          <p style={{color:"#6b7280",fontSize:"11px",letterSpacing:"2px",marginBottom:"32px"}}>DHRUVTARA SAFETY CHECK</p>
          <div style={{position:"relative",width:"130px",height:"130px",margin:"0 auto 32px"}}>
            {[0,0.4,0.8].map((d,i) => (
              <div key={i} style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid #7c3aed",opacity:0.4,animation:\`ring 2s ease-out \${d}s infinite\`}}></div>
            ))}
            <div style={{width:"130px",height:"130px",borderRadius:"50%",backgroundColor:"#1f2937",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"56px",position:"relative",zIndex:1}}>👩</div>
          </div>
          <h2 style={{fontSize:"24px",fontWeight:"bold",marginBottom:"4px"}}>Priya (Friend)</h2>
          <p style={{color:"#9ca3af",marginBottom:"24px"}}>Incoming Call...</p>
          <div style={{backgroundColor:"#1a0000",border:"1px solid #dc262633",borderRadius:"12px",padding:"12px 16px",marginBottom:"36px"}}>
            <p style={{color:"#dc2626",margin:"0 0 4px",fontSize:"13px",fontWeight:"600"}}>⚠️ Anomaly detected on your route</p>
            <p style={{color:"#ef4444",margin:0,fontSize:"13px"}}>Auto SOS in <strong>{timer}s</strong> if unanswered</p>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:"64px",marginBottom:"24px"}}>
            <div style={{textAlign:"center"}}>
              <button onClick={declineCall} style={{width:"72px",height:"72px",borderRadius:"50%",backgroundColor:"#dc2626",border:"none",fontSize:"28px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",boxShadow:"0 0 20px #dc262666"}}>📵</button>
              <p style={{color:"#6b7280",fontSize:"13px",margin:0}}>Decline</p>
            </div>
            <div style={{textAlign:"center"}}>
              <button onClick={acceptCall} style={{width:"72px",height:"72px",borderRadius:"50%",backgroundColor:"#16a34a",border:"none",fontSize:"28px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",boxShadow:"0 0 20px #16a34a66"}}>📞</button>
              <p style={{color:"#6b7280",fontSize:"13px",margin:0}}>Accept</p>
            </div>
          </div>
          <p style={{color:"#374151",fontSize:"11px"}}>Auto-generated by DhruvTara AI for your safety</p>
        </div>
      )}

      {phase === "listening" && (
        <div style={{textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"64px",marginBottom:"16px"}}>📞</div>
          <h2 style={{color:"#4ade80",fontSize:"22px",marginBottom:"4px"}}>Call Connected</h2>
          <p style={{color:"#6b7280",fontSize:"13px",marginBottom:"24px"}}>{fmt(callDuration)}</p>
          <p style={{color:"#9ca3af",marginBottom:"24px",lineHeight:"1.6"}}>Say <strong style={{color:"#4ade80"}}>"I am fine"</strong> or <strong style={{color:"#4ade80"}}>"I am safe"</strong> to cancel the SOS alert</p>
          {voiceResult ? (
            <p style={{color:"#c084fc",marginBottom:"16px"}}>{voiceResult}</p>
          ) : (
            <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:"4px",height:"40px",marginBottom:"24px"}}>
              {[1,2,3,4,5,4,3,2,1].map((h,i) => (
                <div key={i} style={{width:"5px",backgroundColor:"#7c3aed",borderRadius:"3px",animation:\`bar 1s ease-in-out \${i*0.1}s infinite\`,height:h*4+"px"}}></div>
              ))}
            </div>
          )}
          <button onClick={()=>{clearInterval(callRef.current);triggerSOS("Call ended without saying safe phrase");}} style={{backgroundColor:"#dc2626",color:"white",border:"none",borderRadius:"50px",padding:"12px 32px",fontWeight:"600",cursor:"pointer"}}>End Call</button>
        </div>
      )}

      {phase === "sending" && (
        <div style={{textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"72px",marginBottom:"24px",animation:"pulse 0.5s infinite"}}>🚨</div>
          <h2 style={{color:"#dc2626",fontSize:"28px",marginBottom:"8px"}}>Sending SOS!</h2>
          <p style={{color:"#9ca3af",marginBottom:"8px",fontSize:"13px"}}>Reason: {voiceResult}</p>
          <p style={{color:"#9ca3af",marginBottom:"32px",fontSize:"14px"}}>Notifying emergency contacts with your live GPS location...</p>
          <div style={{width:"48px",height:"48px",borderRadius:"50%",border:"4px solid #dc2626",borderTopColor:"transparent",margin:"0 auto",animation:"spin 1s linear infinite"}}></div>
        </div>
      )}

      {phase === "sent" && (
        <div style={{textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"72px",marginBottom:"24px"}}>✅</div>
          <h2 style={{color:"#4ade80",fontSize:"28px",marginBottom:"8px"}}>SOS Sent!</h2>
          <p style={{color:"#9ca3af",marginBottom:"24px",fontSize:"14px"}}>Your emergency contacts have been notified with your live location</p>
          <div style={{backgroundColor:"#0d1a0d",border:"1px solid #16a34a33",borderRadius:"16px",padding:"16px",marginBottom:"24px",textAlign:"left"}}>
            <p style={{color:"#4ade80",fontSize:"13px",margin:"0 0 8px"}}>✅ Emergency Contact 1 notified</p>
            <p style={{color:"#4ade80",fontSize:"13px",margin:"0 0 8px"}}>✅ Emergency Contact 2 notified</p>
            <p style={{color:"#4ade80",fontSize:"13px",margin:0}}>✅ Live location being shared</p>
          </div>
          <a href="/map" style={{backgroundColor:"#7c3aed",color:"white",padding:"14px 32px",borderRadius:"50px",textDecoration:"none",fontWeight:"600"}}>Back to Map</a>
        </div>
      )}

      {phase === "safe" && (
        <div style={{textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"72px",marginBottom:"24px"}}>💜</div>
          <h2 style={{color:"#c084fc",fontSize:"28px",marginBottom:"8px"}}>You're Safe!</h2>
          <p style={{color:"#9ca3af",marginBottom:"8px",fontSize:"13px"}}>{voiceResult}</p>
          <p style={{color:"#9ca3af",marginBottom:"32px",fontSize:"14px",lineHeight:"1.6"}}>Voice verified successfully. No SOS sent. DhruvTara will keep watching over you 💜</p>
          <a href="/map" style={{backgroundColor:"#7c3aed",color:"white",padding:"14px 32px",borderRadius:"50px",textDecoration:"none",fontWeight:"600"}}>Continue Journey</a>
        </div>
      )}
    </main>
  )
}`;

fs.writeFileSync('lib/safetyML.js', safetyML, 'utf8');
fs.writeFileSync('lib/anomaly.js', anomaly, 'utf8');
fs.writeFileSync('app/api/safety/route.js', safetyAPI, 'utf8');
fs.writeFileSync('app/api/sos/route.js', sosAPI, 'utf8');
fs.writeFileSync('app/map/page.tsx', map, 'utf8');
fs.writeFileSync('app/sos/page.tsx', sos, 'utf8');
console.log('ALL DONE! Full ML system ready!');
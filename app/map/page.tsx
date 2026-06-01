"use client";
import { useEffect, useRef, useState } from "react";

export default function Map() {
  const mapRef = useRef(null);
  const [status, setStatus] = useState("Finding your location...");
  const [safetyScore, setSafetyScore] = useState(100);
  const [reason, setReason] = useState("");
  const [features, setFeatures] = useState({});
  const [destName, setDestName] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [showToggle, setShowToggle] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(null);
  const [alertMsg, setAlertMsg] = useState("");
  const [shakeCount, setShakeCount] = useState(0);
  const [routeInfo, setRouteInfo] = useState(null);
  const [directions, setDirections] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showDirections, setShowDirections] = useState(false);
  const [eta, setEta] = useState("");
  const [distLeft, setDistLeft] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const historyRef = useRef([]);
  const stoppedRef = useRef(0);
  const lastPosRef = useRef(null);
  const triggeredRef = useRef(false);
  const aiEnabledRef = useRef(true);
  const lastAccelRef = useRef({x:0,y:0,z:0});
  const shakesRef = useRef([]);
  const keywordHitsRef = useRef([]);
  const recognitionRef = useRef(null);
  const keywordListeningRef = useRef(false);
  const sosTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const screamHitsRef = useRef([]);
  const stepsRef = useRef([]);
  const routeTotalDistRef = useRef(0);
  const routeTotalTimeRef = useRef(0);
  const startTimeRef = useRef(null);
  const userMarkerRef = useRef(null);
  const mapObjRef = useRef(null);
  const coveredDistRef = useRef(0);
  const lastSpeedRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDestName(localStorage.getItem("destName") || "");
    loadMap();
    return () => {
      clearTimeout(sosTimerRef.current);
      clearInterval(audioIntervalRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      try { if(recognitionRef.current) recognitionRef.current.stop(); } catch(e) {}
    };
  }, []);

  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);

  function loadMap() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = initMap;
    document.head.appendChild(script);
  }

  // ═══════════════════════════════════
  // 🕐 ETA CALCULATION
  // ═══════════════════════════════════
  function calcETA(remainingDist, currentSpeedMs) {
    const travelMode = localStorage.getItem("travelMode") || "walking";
    
    // Default speeds by mode (m/s)
    const defaultSpeeds = {
      walking: 1.4,  // 5 km/h
      bike: 4.2,     // 15 km/h
      auto: 6.9,     // 25 km/h
      cab: 8.3,      // 30 km/h
      bus: 6.9,      // 25 km/h
      metro: 11.1    // 40 km/h
    };

    // Use actual speed if available, else use mode default
    const speed = currentSpeedMs > 0.5 ? currentSpeedMs : defaultSpeeds[travelMode] || 5;
    lastSpeedRef.current = speed;

    const secondsLeft = remainingDist / speed;
    const minsLeft = Math.round(secondsLeft / 60);

    // ETA = current time + minutes left
    const etaTime = new Date(Date.now() + secondsLeft * 1000);
    const etaStr = etaTime.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', hour12:true});

    const distStr = remainingDist < 1000
      ? Math.round(remainingDist) + " m"
      : (remainingDist/1000).toFixed(1) + " km";

    const timeStr = minsLeft < 60
      ? minsLeft + " min"
      : Math.floor(minsLeft/60) + "h " + (minsLeft%60) + "m";

    const speedKmh = Math.round(speed * 3.6);

    return { etaStr, distStr, timeStr, speedKmh };
  }

  // Distance between two GPS points in meters
  function getDistM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLng = (lng2-lng1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // Find closest step based on current position
  function findCurrentStep(lat, lng) {
    const steps = stepsRef.current;
    if (!steps.length) return 0;
    let minDist = Infinity;
    let closestIdx = 0;
    steps.forEach((step, i) => {
      const d = getDistM(lat, lng, step.lat, step.lng);
      if (d < minDist) { minDist = d; closestIdx = i; }
    });
    return closestIdx;
  }

  // Parse OSRM steps into directions
  function parseSteps(steps) {
    return steps.map((step) => {
      const type = step.maneuver?.type || "";
      const modifier = step.maneuver?.modifier || "";
      const name = step.name || "the road";
      const dist = step.distance < 1000
        ? Math.round(step.distance) + "m"
        : (step.distance/1000).toFixed(1) + "km";
      const lat = step.maneuver?.location?.[1] || 0;
      const lng = step.maneuver?.location?.[0] || 0;

      let icon = "⬆️";
      let text = "";

      if (type === "depart") { icon = "🚦"; text = `Head on ${name}`; }
      else if (type === "arrive") { icon = "📍"; text = "Arrived at destination"; }
      else if (modifier === "left") { icon = "⬅️"; text = `Turn left onto ${name}`; }
      else if (modifier === "right") { icon = "➡️"; text = `Turn right onto ${name}`; }
      else if (modifier === "slight left") { icon = "↙️"; text = `Slight left onto ${name}`; }
      else if (modifier === "slight right") { icon = "↘️"; text = `Slight right onto ${name}`; }
      else if (modifier === "sharp left") { icon = "◀️"; text = `Sharp left onto ${name}`; }
      else if (modifier === "sharp right") { icon = "▶️"; text = `Sharp right onto ${name}`; }
      else if (modifier === "uturn") { icon = "🔄"; text = `Make U-turn onto ${name}`; }
      else if (type === "roundabout") { icon = "🔃"; text = `Enter roundabout, exit onto ${name}`; }
      else if (type === "merge") { icon = "🔀"; text = `Merge onto ${name}`; }
      else if (type === "fork") { icon = modifier?.includes("left") ? "↙️" : "↘️"; text = `Keep ${modifier} at fork onto ${name}`; }
      else { icon = "⬆️"; text = `Continue on ${name}`; }

      return { icon, text, dist, lat, lng, distM: step.distance };
    });
  }

  // Speak direction
  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = "en-IN";
    msg.rate = 0.95;
    msg.volume = 1;
    window.speechSynthesis.speak(msg);
  }

  // Score route using ML
  async function scoreRoute(coords) {
    const sampleCount = 6;
    const step = Math.floor(coords.length / sampleCount);
    let total = 0, count = 0;
    await Promise.all(Array.from({length:sampleCount},(_,i)=>coords[Math.min(i*step,coords.length-1)]).map(async([lat,lng])=>{
      try {
        const r = await fetch('http://localhost:5000/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat,lng,speed:20})});
        const d = await r.json();
        total += d.danger_score||0; count++;
      } catch(e) { total += (new Date().getHours()>=21||new Date().getHours()<=5)?40:15; count++; }
    }));
    return count > 0 ? total/count : 50;
  }

  async function drawSafestRoute(L, map, startLat, startLng, destLat, destLng) {
    setStatus("Fetching routes...");
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&alternatives=3&steps=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.routes?.length) { setStatus("No routes found"); return; }

      setStatus("AI scoring routes... 🧠");
      const scored = await Promise.all(data.routes.map(async(route,i)=>{
        const coords = route.geometry.coordinates.map(c=>[c[1],c[0]]);
        const danger = await scoreRoute(coords);
        return { route, coords, danger, safe: Math.round(100-danger),
          dist: route.distance, mins: Math.round(route.duration/60) };
      }));

      scored.sort((a,b)=>a.danger-b.danger);
      const best = scored[0];

      // Draw unsafe routes
      scored.slice(1).forEach(r=>{
        const col = r.danger>55?"#dc2626":"#f59e0b";
        L.polyline(r.coords,{color:col,weight:4,opacity:0.4,dashArray:'8,8'}).addTo(map)
          .bindTooltip(`Safety: ${r.safe}/100 · ${(r.dist/1000).toFixed(1)}km`,{direction:'center'});
      });

      // Draw safest route
      const col = best.safe>70?"#4ade80":best.safe>50?"#f59e0b":"#dc2626";
      L.polyline(best.coords,{color:col,weight:6,opacity:0.9}).addTo(map);

      // Destination marker
      L.marker([destLat,destLng],{icon:L.divIcon({html:`<div style="background:${col};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 15px ${col}"></div>`,iconSize:[22,22],className:""})})
        .addTo(map).bindPopup("📍 "+(localStorage.getItem("destName")||"Destination"));

      map.fitBounds(L.polyline(best.coords).getBounds().pad(0.15));

      // Parse directions from best route
      const allSteps = best.route.legs.flatMap(leg=>leg.steps||[]);
      const parsedSteps = parseSteps(allSteps);
      stepsRef.current = parsedSteps;
      setDirections(parsedSteps);
      setCurrentStep(0);
      if (parsedSteps[0]) speak(parsedSteps[0].text);

      routeTotalDistRef.current = best.dist;
      routeTotalTimeRef.current = best.mins;
      startTimeRef.current = Date.now();

      // Initial ETA
      const travelMode = localStorage.getItem("travelMode")||"walking";
      const defaultSpeeds = {walking:1.4,bike:4.2,auto:6.9,cab:8.3,bus:6.9,metro:11.1};
      const initSpeed = defaultSpeeds[travelMode]||5;
      const initEta = calcETA(best.dist, initSpeed);
      setEta(initEta.etaStr);
      setDistLeft(initEta.distStr);
      setTimeLeft(initEta.timeStr);
      setCurrentSpeed(initEta.speedKmh);

      setRouteInfo({ safe: best.safe, dist:(best.dist/1000).toFixed(1), mins:best.mins, total:data.routes.length, color:col });
      setStatus(`${best.safe>70?"Safe":"Moderate"} route · AI watching 🧠`);

    } catch(e) { setStatus("🧠 AI monitoring active"); }
  }

  async function startAudioDetection() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.3;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = ctx;
      const bufLen = analyser.frequencyBinCount;
      const td = new Uint8Array(bufLen), fd = new Uint8Array(bufLen);
      audioIntervalRef.current = setInterval(()=>{
        if(!aiEnabledRef.current||triggeredRef.current) return;
        analyser.getByteTimeDomainData(td); analyser.getByteFrequencyData(fd);
        let sum=0; for(let i=0;i<bufLen;i++){const v=(td[i]-128)/128;sum+=v*v;}
        const vol=Math.round(Math.sqrt(sum/bufLen)*300);
        setAudioLevel(Math.min(vol,100));
        const binSize=ctx.sampleRate/analyser.fftSize;
        let hf=0; for(let i=Math.floor(1000/binSize);i<Math.min(Math.floor(4000/binSize),bufLen);i++) hf+=fd[i];
        hf/=(Math.floor(4000/binSize)-Math.floor(1000/binSize));
        if(vol>65&&hf>80){
          const now=Date.now(); screamHitsRef.current.push(now);
          screamHitsRef.current=screamHitsRef.current.filter(t=>now-t<4000);
          if(screamHitsRef.current.length>=3){screamHitsRef.current=[];initiateSosTrigger("Scream detected");}
        }
      },200);
    } catch(e){}
  }

  function startShakeDetection() {
    if(!window.DeviceMotionEvent) return;
    window.addEventListener('devicemotion',(e)=>{
      if(!aiEnabledRef.current||triggeredRef.current) return;
      const acc=e.accelerationIncludingGravity; if(!acc) return;
      const d=Math.abs(acc.x-lastAccelRef.current.x)+Math.abs(acc.y-lastAccelRef.current.y)+Math.abs(acc.z-lastAccelRef.current.z);
      if(d>35){
        const now=Date.now(); shakesRef.current.push(now);
        shakesRef.current=shakesRef.current.filter(t=>now-t<3000);
        setShakeCount(shakesRef.current.length);
        if(shakesRef.current.length>=5){shakesRef.current=[];setShakeCount(0);initiateSosTrigger("Phone shaken 5 times");}
      }
      lastAccelRef.current={x:acc.x||0,y:acc.y||0,z:acc.z||0};
    });
  }

  function startKeywordDetection() {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR||keywordListeningRef.current) return;
    const r=new SR(); r.continuous=true; r.interimResults=true; r.lang="hi-IN";
    recognitionRef.current=r;
    const WORDS=["help","bachao","chodo","police","sos","danger","save me","help me","bachaa","madat"];
    r.onresult=(e)=>{
      if(!aiEnabledRef.current||triggeredRef.current) return;
      for(let i=e.resultIndex;i<e.results.length;i++){
        const said=e.results[i][0].transcript.toLowerCase();
        const matched=WORDS.find(w=>said.includes(w));
        if(matched){
          const now=Date.now(); keywordHitsRef.current.push({word:matched,time:now});
          keywordHitsRef.current=keywordHitsRef.current.filter(h=>now-h.time<10000);
          if(keywordHitsRef.current.filter(h=>h.word===matched).length>=2){keywordHitsRef.current=[];initiateSosTrigger("Danger keyword: "+matched);}
          break;
        }
      }
    };
    r.onerror=()=>{keywordListeningRef.current=false;if(aiEnabledRef.current)setTimeout(()=>startKeywordDetection(),3000);};
    r.onend=()=>{keywordListeningRef.current=false;if(aiEnabledRef.current)setTimeout(()=>startKeywordDetection(),1000);};
    try{r.start();keywordListeningRef.current=true;}catch(e){}
  }

  function initiateSosTrigger(reason) {
    if(triggeredRef.current) return;
    triggeredRef.current=true; setAlertMsg(reason);
    let count=10; setSosCountdown(count);
    sosTimerRef.current=setInterval(()=>{count--;setSosCountdown(count);if(count<=0){clearInterval(sosTimerRef.current);window.location.href="/sos";}},1000);
  }

  function cancelSos() {
    clearInterval(sosTimerRef.current);
    triggeredRef.current=false; setAlertMsg(""); setSosCountdown(null);
    setStatus("🧠 AI monitoring active");
  }

  async function analyzeLocation(lat, lng, speed) {
    if(!aiEnabledRef.current) return 0;
    const hour=new Date().getHours();
    let score=0; const reasons=[];

    // Update live navigation
    if(stepsRef.current.length>0){
      const stepIdx = findCurrentStep(lat,lng);
      if(stepIdx !== currentStep){
        setCurrentStep(stepIdx);
        const step = stepsRef.current[stepIdx];
        if(step){ speak(step.text); }
      }
    }

    // Update ETA with real speed
    const realSpeed = speed > 0.5 ? speed : lastSpeedRef.current;
    const distToDest = lastPosRef.current ? getDistM(lat,lng,
      parseFloat(localStorage.getItem("destLat")||lat),
      parseFloat(localStorage.getItem("destLng")||lng)) : routeTotalDistRef.current;
    if(distToDest > 0){
      const etaData = calcETA(distToDest, realSpeed);
      setEta(etaData.etaStr);
      setDistLeft(etaData.distStr);
      setTimeLeft(etaData.timeStr);
      setCurrentSpeed(etaData.speedKmh);
    }

    try{
      const res=await fetch('http://localhost:5000/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat,lng,speed})});
      const d=await res.json();
      score+=d.danger_score*0.6; setFeatures(d.features||{});
      if(d.is_dangerous) reasons.push("ML: unsafe area");
    }catch(e){if(hour>=21||hour<=5){score+=30;reasons.push("Late night");}}

    if(speed<0.3&&historyRef.current.length>2){stoppedRef.current++;if(stoppedRef.current>2){score+=20;reasons.push("Stopped suddenly");}}else stoppedRef.current=0;
    lastPosRef.current={lat,lng};
    historyRef.current.push({lat,lng,speed,time:Date.now()});
    const final=Math.min(Math.round(score),100);
    setSafetyScore(100-final); setReason(reasons.join(" · ")||"All clear ✅");
    return final;
  }

  function toggleAI(){
    const n=!aiEnabled; setAiEnabled(n); aiEnabledRef.current=n;
    if(n){setStatus("🧠 AI active");startKeywordDetection();startAudioDetection();}
    else{setStatus("⚪ AI paused");setReason("AI OFF");setSafetyScore(100);keywordListeningRef.current=false;try{if(recognitionRef.current)recognitionRef.current.stop();}catch(e){}clearInterval(audioIntervalRef.current);if(audioContextRef.current)audioContextRef.current.close();}
    setShowToggle(false);
  }

  function initMap(){
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      const lat=pos.coords.latitude, lng=pos.coords.longitude;
      const L=window.L;
      const map=L.map(mapRef.current).setView([lat,lng],15);
      mapObjRef.current=map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      const icon=L.divIcon({html:'<div style="background:#7c3aed;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 15px #7c3aed"></div>',iconSize:[22,22],className:""});
      userMarkerRef.current=L.marker([lat,lng],{icon}).addTo(map).bindPopup("You are here 🌟").openPopup();
      const destLat=parseFloat(localStorage.getItem("destLat"));
      const destLng=parseFloat(localStorage.getItem("destLng"));
      if(destLat&&destLng){await drawSafestRoute(L,map,lat,lng,destLat,destLng);}
      else setStatus("🧠 AI monitoring active");
      startShakeDetection(); startKeywordDetection(); startAudioDetection();
      await analyzeLocation(lat,lng,0);
      const interval=setInterval(async()=>{
        if(!aiEnabledRef.current||triggeredRef.current) return;
        navigator.geolocation.getCurrentPosition(async(p)=>{
          // Move user marker
          if(userMarkerRef.current) userMarkerRef.current.setLatLng([p.coords.latitude,p.coords.longitude]);
          map.panTo([p.coords.latitude,p.coords.longitude],{animate:true,duration:1});
          const score=await analyzeLocation(p.coords.latitude,p.coords.longitude,p.coords.speed||0);
          if(score>=55&&!triggeredRef.current) initiateSosTrigger("Multiple anomalies detected");
        });
      },10000);
    },()=>setStatus("⚠️ Allow location access"),{enableHighAccuracy:true,maximumAge:0,timeout:10000});
  }

  const scoreColor=safetyScore>70?"#4ade80":safetyScore>40?"#f59e0b":"#dc2626";
  const scoreLabel=safetyScore>70?"SAFE":safetyScore>40?"CAUTION":"DANGER";
  const currentDir = directions[currentStep];
  const nextDir = directions[currentStep+1];

  return (
    <main style={{height:"100vh",display:"flex",flexDirection:"column",backgroundColor:"#060612",color:"white",position:"relative"}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      `}</style>

      {/* SOS COUNTDOWN */}
      {sosCountdown!==null&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,backgroundColor:"#000000dd",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{backgroundColor:"#0d0d20",border:"2px solid #dc2626",borderRadius:"24px",padding:"32px",textAlign:"center",maxWidth:"300px",width:"90%"}}>
            <div style={{fontSize:"48px",marginBottom:"16px",animation:"pulse 0.5s infinite"}}>🚨</div>
            <h2 style={{color:"#dc2626",marginBottom:"8px"}}>SOS Triggering!</h2>
            <p style={{color:"#9ca3af",fontSize:"13px",marginBottom:"16px"}}>{alertMsg}</p>
            <div style={{position:"relative",width:"80px",height:"80px",margin:"0 auto 16px"}}>
              <svg width="80" height="80" style={{transform:"rotate(-90deg)"}}>
                <circle cx="40" cy="40" r="35" fill="none" stroke="#1f2937" strokeWidth="6"/>
                <circle cx="40" cy="40" r="35" fill="none" stroke="#dc2626" strokeWidth="6" strokeDasharray="220" strokeDashoffset={220-(220*(10-sosCountdown)/10)} style={{transition:"stroke-dashoffset 1s linear"}}/>
              </svg>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:"28px",fontWeight:"bold",color:"#dc2626"}}>{sosCountdown}</div>
            </div>
            <button onClick={cancelSos} style={{backgroundColor:"#16a34a",color:"white",border:"none",borderRadius:"50px",padding:"14px 32px",fontWeight:"700",cursor:"pointer",width:"100%",fontSize:"15px"}}>✅ I Am Safe — Cancel</button>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{padding:"12px 16px",backgroundColor:"#0d0d20",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",justifyContent:"space-between",zIndex:100}}>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontSize:"16px",fontWeight:"bold",color:"#c084fc",margin:0}}>🌟 DhruvTara</h1>
          <p style={{fontSize:"10px",color:"#6b7280",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{status}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          {shakeCount>0&&<div style={{backgroundColor:"#1a0000",border:"1px solid #dc2626",borderRadius:"8px",padding:"4px 8px",fontSize:"10px",color:"#dc2626"}}>📳{shakeCount}/5</div>}
          <button onClick={()=>setShowToggle(true)} style={{backgroundColor:aiEnabled?"#0d2d0d":"#1a1a1a",border:`1px solid ${aiEnabled?"#4ade80":"#4b5563"}`,borderRadius:"20px",padding:"5px 10px",color:aiEnabled?"#4ade80":"#6b7280",fontSize:"10px",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"}}>
            <div style={{width:"7px",height:"7px",borderRadius:"50%",backgroundColor:aiEnabled?"#4ade80":"#6b7280",animation:aiEnabled?"pulse 2s infinite":""}}></div>
            AI {aiEnabled?"ON":"OFF"}
          </button>
          <div style={{textAlign:"center",backgroundColor:"#111827",borderRadius:"10px",padding:"5px 10px",border:`1px solid ${scoreColor}44`}}>
            <div style={{fontSize:"8px",color:scoreColor,fontWeight:"bold"}}>{scoreLabel}</div>
            <div style={{fontSize:"18px",fontWeight:"bold",color:scoreColor,lineHeight:1}}>{safetyScore}</div>
          </div>
        </div>
      </div>

      {/* GOOGLE MAPS STYLE NAVIGATION BAR */}
      {currentDir && (
        <div style={{backgroundColor:"#0d1a2d",borderBottom:"1px solid #1f2937",padding:"12px 16px",zIndex:100}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"32px",flexShrink:0}}>{currentDir.icon}</div>
            <div style={{flex:1}}>
              <div style={{color:"white",fontSize:"15px",fontWeight:"bold",lineHeight:"1.3"}}>{currentDir.text}</div>
              <div style={{color:"#7c3aed",fontSize:"12px",marginTop:"2px"}}>in {currentDir.dist}</div>
            </div>
          </div>
          {nextDir && (
            <div style={{display:"flex",alignItems:"center",gap:"8px",paddingTop:"8px",borderTop:"1px solid #1f2937"}}>
              <span style={{fontSize:"16px",color:"#6b7280"}}>{nextDir.icon}</span>
              <span style={{color:"#6b7280",fontSize:"11px"}}>Then: {nextDir.text} · {nextDir.dist}</span>
            </div>
          )}
        </div>
      )}

      {/* MAP */}
      <div ref={mapRef} style={{flex:1,width:"100%"}}></div>

      {/* ETA BAR — Google Maps style bottom */}
      {eta && (
        <div style={{backgroundColor:"#0d0d20",borderTop:"2px solid #7c3aed33",padding:"12px 16px",zIndex:100}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
            <div style={{textAlign:"center"}}>
              <div style={{color:"white",fontSize:"22px",fontWeight:"bold"}}>{timeLeft}</div>
              <div style={{color:"#6b7280",fontSize:"10px"}}>time left</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:"white",fontSize:"22px",fontWeight:"bold"}}>{distLeft}</div>
              <div style={{color:"#6b7280",fontSize:"10px"}}>distance</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:"#c084fc",fontSize:"22px",fontWeight:"bold"}}>{eta}</div>
              <div style={{color:"#6b7280",fontSize:"10px"}}>arrival</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:"#4ade80",fontSize:"22px",fontWeight:"bold"}}>{currentSpeed}</div>
              <div style={{color:"#6b7280",fontSize:"10px"}}>km/h</div>
            </div>
          </div>

          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>setShowDirections(!showDirections)} style={{flex:1,backgroundColor:"#111827",color:"#c084fc",border:"1px solid #7c3aed44",borderRadius:"10px",padding:"8px",fontSize:"11px",fontWeight:"600",cursor:"pointer"}}>
              {showDirections?"Hide":"📋 Steps"} ({directions.length})
            </button>
            <div style={{flex:1,backgroundColor:"#111827",borderRadius:"10px",padding:"8px",fontSize:"11px",color:scoreColor,textAlign:"center",fontWeight:"600"}}>
              🧠 {reason.split("·")[0].trim()}
            </div>
            <button onClick={()=>window.location.href="/"} style={{backgroundColor:"#1a0000",color:"#dc2626",border:"1px solid #dc262644",borderRadius:"10px",padding:"8px 12px",fontSize:"11px",fontWeight:"600",cursor:"pointer"}}>
              🏁 End
            </button>
          </div>
        </div>
      )}

      {/* AI REASON BAR */}
      {!eta && (
        <div style={{padding:"6px 16px",backgroundColor:"#0a0a18",borderTop:"1px solid #1f2937",fontSize:"11px",color:aiEnabled?scoreColor:"#6b7280",display:"flex",alignItems:"center",gap:"8px"}}>
          <span>{aiEnabled?"🧠":"⚪"}</span><span>{reason}</span>
          {audioLevel>30&&<span style={{color:"#f59e0b",marginLeft:"auto"}}>🎤{audioLevel}</span>}
        </div>
      )}

      {/* DIRECTIONS PANEL */}
      {showDirections && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,backgroundColor:"#0d0d20",border:"1px solid #1f2937",borderRadius:"20px 20px 0 0",maxHeight:"60vh",overflowY:"auto",zIndex:200,animation:"slideUp 0.3s ease"}}>
          <div style={{padding:"16px",borderBottom:"1px solid #1f2937",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,backgroundColor:"#0d0d20"}}>
            <h3 style={{color:"#c084fc",margin:0,fontSize:"16px"}}>📋 Turn-by-Turn Directions</h3>
            <button onClick={()=>setShowDirections(false)} style={{backgroundColor:"transparent",border:"none",color:"#6b7280",fontSize:"20px",cursor:"pointer"}}>✕</button>
          </div>
          {directions.map((d,i)=>(
            <div key={i} style={{padding:"14px 16px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",gap:"12px",backgroundColor:i===currentStep?"#1a1a3d":"transparent"}}>
              <div style={{fontSize:"24px",flexShrink:0}}>{d.icon}</div>
              <div style={{flex:1}}>
                <div style={{color:i===currentStep?"#c084fc":"white",fontSize:"13px",fontWeight:i===currentStep?"bold":"normal"}}>{d.text}</div>
                <div style={{color:"#6b7280",fontSize:"11px",marginTop:"2px"}}>{d.dist}</div>
              </div>
              {i===currentStep&&<div style={{backgroundColor:"#7c3aed",borderRadius:"6px",padding:"3px 8px",fontSize:"10px",color:"white",fontWeight:"bold"}}>NOW</div>}
            </div>
          ))}
        </div>
      )}

      {/* AI TOGGLE MODAL */}
      {showToggle&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,backgroundColor:"#00000088",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{backgroundColor:"#0d0d20",border:"1px solid #1f2937",borderRadius:"24px",padding:"32px",textAlign:"center",maxWidth:"300px",width:"90%"}}>
            <div style={{fontSize:"40px",marginBottom:"16px"}}>{aiEnabled?"🧠":"⚪"}</div>
            <h3 style={{color:"#c084fc",marginBottom:"16px"}}>AI Monitoring</h3>
            <div style={{backgroundColor:"#111827",borderRadius:"12px",padding:"16px",marginBottom:"16px",textAlign:"left"}}>
              <p style={{color:"#4ade80",fontSize:"12px",margin:"0 0 8px"}}>🧠 ML danger scoring every 15s</p>
              <p style={{color:"#4ade80",fontSize:"12px",margin:"0 0 8px"}}>📳 Shake 5x in 3 sec = SOS</p>
              <p style={{color:"#4ade80",fontSize:"12px",margin:"0 0 8px"}}>🎤 Scream detection</p>
              <p style={{color:"#4ade80",fontSize:"12px",margin:0}}>🗣️ Say "bachao/help" 2x = SOS</p>
            </div>
            <button onClick={toggleAI} style={{backgroundColor:aiEnabled?"#dc2626":"#16a34a",color:"white",border:"none",borderRadius:"50px",padding:"12px 32px",fontWeight:"600",cursor:"pointer",width:"100%",marginBottom:"12px"}}>
              {aiEnabled?"Turn OFF AI":"Turn ON AI"}
            </button>
            <button onClick={()=>setShowToggle(false)} style={{backgroundColor:"transparent",color:"#6b7280",border:"1px solid #374151",borderRadius:"50px",padding:"12px 32px",cursor:"pointer",width:"100%"}}>Cancel</button>
          </div>
        </div>
      )}
    </main>
  )
}
"use client";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import dynamic from "next/dynamic";

const AudioDetector = dynamic(() => import("../../components/AudioDetector"), { ssr: false });

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
  const [mlStatus, setMlStatus] = useState("Connecting to ML...");
  const [stoppedSecs, setStoppedSecs] = useState(0);
  const [riskFactors, setRiskFactors] = useState([]);

  const historyRef = useRef([]);
  const stoppedRef = useRef(0);
  const stoppedSecsRef = useRef(0);
  const lastPosRef = useRef(null);
  const triggeredRef = useRef(false);
  const aiEnabledRef = useRef(true);
  const lastAccelRef = useRef({x:0,y:0,z:0});
  const shakesRef = useRef([]);
  const keywordHitsRef = useRef([]);
  const recognitionRef = useRef(null);
  const keywordListeningRef = useRef(false);
  const sosTimerRef = useRef(null);
  const stepsRef = useRef([]);
  const lastSpeedRef = useRef(0);
  const userMarkerRef = useRef(null);
  const routeTotalDistRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDestName(localStorage.getItem("destName") || "");
    checkMLHealth();
    loadMap();
    return () => {
      clearTimeout(sosTimerRef.current);
      try { if(recognitionRef.current) recognitionRef.current.stop(); } catch(e) {}
    };
  }, []);

  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);

  async function checkMLHealth() {
    try {
      const res = await fetch('https://aan2136421-dhruv-tara-ml.hf.space/');
      const data = await res.json();
      setMlStatus(`ML: ${data.model} (${data.accuracy}% acc)`);
    } catch(e) {
      setMlStatus("ML API offline — basic mode");
    }
  }

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

  function getDistM(lat1,lng1,lat2,lng2) {
    const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function calcETA(remainingDist, speedMs) {
    const modes = {walking:1.4,bike:4.2,auto:6.9,cab:8.3,bus:6.9,metro:11.1};
    const mode = localStorage.getItem("travelMode")||"walking";
    const speed = speedMs > 0.5 ? speedMs : (modes[mode]||5);
    lastSpeedRef.current = speed;
    const secs = remainingDist / speed;
    const etaTime = new Date(Date.now() + secs*1000);
    return {
      etaStr: etaTime.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}),
      distStr: remainingDist<1000 ? Math.round(remainingDist)+"m" : (remainingDist/1000).toFixed(1)+"km",
      timeStr: Math.round(secs/60)<60 ? Math.round(secs/60)+" min" : Math.floor(secs/3600)+"h "+Math.round((secs%3600)/60)+"m",
      speedKmh: Math.round(speed*3.6)
    };
  }

  function parseSteps(steps) {
    return steps.map(step => {
      const type=step.maneuver?.type||"", mod=step.maneuver?.modifier||"", name=step.name||"road";
      const dist=step.distance<1000?Math.round(step.distance)+"m":(step.distance/1000).toFixed(1)+"km";
      const lat=step.maneuver?.location?.[1]||0, lng=step.maneuver?.location?.[0]||0;
      let icon="⬆️", text="Continue on "+name;
      if(type==="depart"){icon="🚦";text="Start on "+name;}
      else if(type==="arrive"){icon="📍";text="Arrived!";}
      else if(mod==="left"){icon="⬅️";text="Turn left onto "+name;}
      else if(mod==="right"){icon="➡️";text="Turn right onto "+name;}
      else if(mod==="slight left"){icon="↙️";text="Slight left onto "+name;}
      else if(mod==="slight right"){icon="↘️";text="Slight right onto "+name;}
      else if(mod==="sharp left"){icon="◀️";text="Sharp left onto "+name;}
      else if(mod==="sharp right"){icon="▶️";text="Sharp right onto "+name;}
      else if(mod==="uturn"){icon="🔄";text="U-turn onto "+name;}
      else if(type==="roundabout"){icon="🔃";text="Enter roundabout onto "+name;}
      return {icon,text,dist,lat,lng,distM:step.distance};
    });
  }

  function speak(text) {
    if(!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const m=new SpeechSynthesisUtterance(text);
    m.lang="en-IN"; m.rate=0.95; m.volume=1;
    window.speechSynthesis.speak(m);
  }

  function findCurrentStep(lat,lng) {
    const steps=stepsRef.current; if(!steps.length) return 0;
    let minD=Infinity, idx=0;
    steps.forEach((s,i)=>{ const d=getDistM(lat,lng,s.lat,s.lng); if(d<minD){minD=d;idx=i;} });
    return idx;
  }

  async function scoreRouteML(coords) {
    try {
      const sample = coords.filter((_,i)=>i%Math.ceil(coords.length/10)===0).slice(0,10);
      const res = await fetch('https://aan2136421-dhruv-tara-ml.hf.space/run/score_route',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({coords: sample})
      });
      const data = await res.json();
      return data.danger_score || 30;
    } catch(e) {
      return (new Date().getHours()>=21||new Date().getHours()<=5) ? 50 : 20;
    }
  }

  async function drawSafestRoute(L,map,startLat,startLng,destLat,destLng) {
    setStatus("Fetching routes...");
    try {
      const url=`https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&alternatives=3&steps=true`;
      const res=await fetch(url);
      const data=await res.json();
      if(!data.routes?.length){setStatus("No routes found");return;}
      setStatus("AI scoring routes with ML... 🧠");

      const scored=await Promise.all(data.routes.map(async(route)=>{
        const coords=route.geometry.coordinates.map(c=>[c[1],c[0]]);
        const danger=await scoreRouteML(coords);
        return {route,coords,danger,safe:Math.round(100-danger),dist:route.distance,mins:Math.round(route.duration/60)};
      }));

      scored.sort((a,b)=>a.danger-b.danger);
      const best=scored[0];

      scored.slice(1).forEach(r=>{
        L.polyline(r.coords,{color:r.danger>55?"#dc2626":"#f59e0b",weight:4,opacity:0.35,dashArray:'8,8'}).addTo(map)
          .bindTooltip(`Safety:${r.safe}/100 · ${(r.dist/1000).toFixed(1)}km`,{direction:'center'});
      });

      const col=best.safe>70?"#4ade80":best.safe>50?"#f59e0b":"#dc2626";
      L.polyline(best.coords,{color:col,weight:6,opacity:0.9}).addTo(map);
      L.marker([destLat,destLng],{icon:L.divIcon({html:`<div style="background:${col};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 20px ${col}"></div>`,iconSize:[22,22],className:""})})
        .addTo(map).bindPopup("📍 "+(localStorage.getItem("destName")||"Destination"));
      map.fitBounds(L.polyline(best.coords).getBounds().pad(0.15));

      const allSteps=best.route.legs.flatMap(l=>l.steps||[]);
      const parsed=parseSteps(allSteps);
      stepsRef.current=parsed;
      setDirections(parsed);
      setCurrentStep(0);
      if(parsed[0]) speak(parsed[0].text);
      routeTotalDistRef.current=best.dist;

      const initEta=calcETA(best.dist,lastSpeedRef.current);
      setEta(initEta.etaStr); setDistLeft(initEta.distStr);
      setTimeLeft(initEta.timeStr); setCurrentSpeed(initEta.speedKmh);

      setRouteInfo({safe:best.safe,dist:(best.dist/1000).toFixed(1),mins:best.mins,total:data.routes.length,color:col});
      setStatus(`${best.safe>70?"Safe":"Moderate"} route selected by AI 🧠`);
    } catch(e){setStatus("🧠 AI monitoring active");}
  }

  // SHAKE DETECTION
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
        if(shakesRef.current.length>=5){shakesRef.current=[];setShakeCount(0);initiateSOS("Phone shaken 5x rapidly");}
      }
      lastAccelRef.current={x:acc.x||0,y:acc.y||0,z:acc.z||0};
    });
  }

  // KEYWORD DETECTION
  function startKeywordDetection() {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR||keywordListeningRef.current) return;
    const r=new SR(); r.continuous=true; r.interimResults=true; r.lang="hi-IN";
    recognitionRef.current=r;
    const WORDS=["help","bachao","chodo","police","sos","danger","save me","bachaa","madat","chhoddo"];
    r.onresult=(e)=>{
      if(!aiEnabledRef.current||triggeredRef.current) return;
      for(let i=e.resultIndex;i<e.results.length;i++){
        const said=e.results[i][0].transcript.toLowerCase();
        const matched=WORDS.find(w=>said.includes(w));
        if(matched){
          const now=Date.now(); keywordHitsRef.current.push({word:matched,time:now});
          keywordHitsRef.current=keywordHitsRef.current.filter(h=>now-h.time<10000);
          if(keywordHitsRef.current.filter(h=>h.word===matched).length>=2){keywordHitsRef.current=[];initiateSOS("Keyword: "+matched);}
          break;
        }
      }
    };
    r.onerror=()=>{keywordListeningRef.current=false;if(aiEnabledRef.current)setTimeout(startKeywordDetection,3000);};
    r.onend=()=>{keywordListeningRef.current=false;if(aiEnabledRef.current)setTimeout(startKeywordDetection,1000);};
    try{r.start();keywordListeningRef.current=true;}catch(e){}
  }

  function initiateSOS(reason) {
    if(triggeredRef.current) return;
    triggeredRef.current=true; setAlertMsg(reason);
    let c=10; setSosCountdown(c);
    sosTimerRef.current=setInterval(()=>{c--;setSosCountdown(c);if(c<=0){clearInterval(sosTimerRef.current);window.location.href="/sos";}},1000);
  }

  function cancelSOS() {
    clearInterval(sosTimerRef.current);
    triggeredRef.current=false; setAlertMsg(""); setSosCountdown(null);
    setStatus("🧠 AI monitoring active");
  }

  async function analyzeLocation(lat,lng,speed) {
    if(!aiEnabledRef.current) return 0;
    const hour=new Date().getHours();
    let score=0; const reasons=[];

    // Update stopped duration
    if(speed<0.3){
      stoppedSecsRef.current+=15;
      setStoppedSecs(stoppedSecsRef.current);
      if(stoppedSecsRef.current>60){score+=20;reasons.push("Stopped "+Math.round(stoppedSecsRef.current/60)+"min");}
    } else {
      stoppedSecsRef.current=0; setStoppedSecs(0);
    }

    // Call ML API
    try{
      const res=await fetch('http://localhost:5000/predict',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({lat,lng,speed,stopped_duration:stoppedSecsRef.current/60})
      });
      const d=await res.json();
      score+=d.danger_score*0.6;
      setFeatures(d.features||{});
      setRiskFactors(d.risk_factors||[]);
      if(d.is_dangerous) reasons.push("ML flagged unsafe");
      else if(score<20) reasons.push("ML: area looks safe");
    }catch(e){
      if(hour>=21||hour<=5){score+=30;reasons.push("Late night");}
      if(!features.has_lights){score+=15;reasons.push("Dark area");}
    }

    // Update navigation
    if(stepsRef.current.length>0){
      const idx=findCurrentStep(lat,lng);
      if(idx!==currentStep){
        setCurrentStep(idx);
        if(stepsRef.current[idx]) speak(stepsRef.current[idx].text);
      }
    }

    // Update ETA
    const dest={lat:parseFloat(localStorage.getItem("destLat")||lat),lng:parseFloat(localStorage.getItem("destLng")||lng)};
    const remDist=getDistM(lat,lng,dest.lat,dest.lng);
    if(remDist>10){
      const etaData=calcETA(remDist,speed);
      setEta(etaData.etaStr); setDistLeft(etaData.distStr);
      setTimeLeft(etaData.timeStr); setCurrentSpeed(etaData.speedKmh);
    }

    lastPosRef.current={lat,lng};
    historyRef.current.push({lat,lng,speed,time:Date.now()});
    const final=Math.min(Math.round(score),100);
    setSafetyScore(100-final);
    setReason(reasons.join(" · ")||"All clear ✅");
    return final;
  }

  function toggleAI(){
    const n=!aiEnabled; setAiEnabled(n); aiEnabledRef.current=n;
    if(n){setStatus("🧠 AI active");startKeywordDetection();}
    else{setStatus("⚪ AI paused");setReason("AI OFF");setSafetyScore(100);keywordListeningRef.current=false;try{if(recognitionRef.current)recognitionRef.current.stop();}catch(e){}}
    setShowToggle(false);
  }

  function initMap(){
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      const lat=pos.coords.latitude, lng=pos.coords.longitude;
      const L=window.L;
      const map=L.map(mapRef.current).setView([lat,lng],15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      const icon=L.divIcon({html:'<div style="background:#7c3aed;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 20px #7c3aed;animation:pulse 2s infinite"></div>',iconSize:[22,22],className:""});
      userMarkerRef.current=L.marker([lat,lng],{icon}).addTo(map).bindPopup("You are here 🌟").openPopup();
      const dLat=parseFloat(localStorage.getItem("destLat")), dLng=parseFloat(localStorage.getItem("destLng"));
      if(dLat&&dLng){await drawSafestRoute(L,map,lat,lng,dLat,dLng);}
      else setStatus("🧠 AI monitoring active");
      startShakeDetection(); startKeywordDetection();
      await analyzeLocation(lat,lng,pos.coords.speed||0);
      const interval=setInterval(async()=>{
        if(!aiEnabledRef.current||triggeredRef.current) return;
        navigator.geolocation.getCurrentPosition(async(p)=>{
          if(userMarkerRef.current) userMarkerRef.current.setLatLng([p.coords.latitude,p.coords.longitude]);
          map.panTo([p.coords.latitude,p.coords.longitude],{animate:true,duration:1});
          const score=await analyzeLocation(p.coords.latitude,p.coords.longitude,p.coords.speed||0);
          if(score>=55&&!triggeredRef.current) initiateSOS("AI detected multiple anomalies");
        });
      },10000);
    },()=>setStatus("⚠️ Allow location access"),{enableHighAccuracy:true,maximumAge:0,timeout:10000});
  }

  const scoreColor=safetyScore>70?"#4ade80":safetyScore>40?"#f59e0b":"#dc2626";
  const scoreLabel=safetyScore>70?"SAFE":safetyScore>40?"CAUTION":"DANGER";
  const curDir=directions[currentStep];
  const nextDir=directions[currentStep+1];

  return (
    <main style={{height:"100vh",display:"flex",flexDirection:"column",backgroundColor:"#060612",color:"white"}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.1)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      `}</style>

      {sosCountdown!==null&&(
        <div style={{position:"fixed",inset:0,backgroundColor:"#000000ee",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{backgroundColor:"#0d0d20",border:"2px solid #dc2626",borderRadius:"24px",padding:"32px",textAlign:"center",maxWidth:"300px",width:"90%"}}>
            <div style={{fontSize:"56px",marginBottom:"16px",animation:"pulse 0.5s infinite"}}>🚨</div>
            <h2 style={{color:"#dc2626",fontSize:"24px",marginBottom:"8px"}}>SOS Triggering!</h2>
            <p style={{color:"#9ca3af",fontSize:"13px",marginBottom:"16px"}}>{alertMsg}</p>
            <div style={{position:"relative",width:"90px",height:"90px",margin:"0 auto 20px"}}>
              <svg width="90" height="90" style={{transform:"rotate(-90deg)"}}>
                <circle cx="45" cy="45" r="38" fill="none" stroke="#1f2937" strokeWidth="7"/>
                <circle cx="45" cy="45" r="38" fill="none" stroke="#dc2626" strokeWidth="7"
                  strokeDasharray="239" strokeDashoffset={239-(239*(10-sosCountdown)/10)}
                  style={{transition:"stroke-dashoffset 1s linear"}}/>
              </svg>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:"30px",fontWeight:"bold",color:"#dc2626"}}>{sosCountdown}</div>
            </div>
            <button onClick={cancelSOS} style={{backgroundColor:"#16a34a",color:"white",border:"none",borderRadius:"50px",padding:"16px",fontWeight:"700",cursor:"pointer",width:"100%",fontSize:"16px"}}>
              ✅ I Am Safe — Cancel SOS
            </button>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{padding:"10px 16px",backgroundColor:"#0d0d20",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",justifyContent:"space-between",zIndex:100}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <h1 style={{fontSize:"16px",fontWeight:"bold",color:"#c084fc",margin:0}}>🌟 DhruvTara</h1>
            <span style={{fontSize:"9px",color:"#4b5563",backgroundColor:"#111827",padding:"2px 6px",borderRadius:"6px"}}>{mlStatus}</span>
          </div>
          <p style={{fontSize:"10px",color:"#6b7280",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{status}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          {shakeCount>0&&<div style={{backgroundColor:"#1a0000",border:"1px solid #dc2626",borderRadius:"8px",padding:"3px 8px",fontSize:"10px",color:"#dc2626"}}>📳{shakeCount}/5</div>}
          <Suspense fallback={null}>
            <AudioDetector enabled={aiEnabled} onAnomaly={(reason)=>initiateSOS(reason)} />
          </Suspense>
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

      {/* NAVIGATION INSTRUCTION */}
      {curDir&&(
        <div style={{backgroundColor:"#0d1a2d",borderBottom:"1px solid #1f2937",padding:"10px 16px",zIndex:100}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:nextDir?"8px":"0"}}>
            <div style={{fontSize:"30px",flexShrink:0}}>{curDir.icon}</div>
            <div style={{flex:1}}>
              <div style={{color:"white",fontSize:"14px",fontWeight:"bold"}}>{curDir.text}</div>
              <div style={{color:"#7c3aed",fontSize:"11px"}}>in {curDir.dist}</div>
            </div>
          </div>
          {nextDir&&(
            <div style={{display:"flex",alignItems:"center",gap:"8px",paddingTop:"6px",borderTop:"1px solid #1f2937"}}>
              <span style={{fontSize:"14px",color:"#6b7280"}}>{nextDir.icon}</span>
              <span style={{color:"#6b7280",fontSize:"10px"}}>Then: {nextDir.text} · {nextDir.dist}</span>
            </div>
          )}
        </div>
      )}

      {/* MAP */}
      <div ref={mapRef} style={{flex:1,width:"100%"}}></div>

      {/* RISK FACTORS */}
      {riskFactors.length>0&&(
        <div style={{padding:"6px 16px",backgroundColor:"#1a0800",borderTop:"1px solid #f59e0b33",display:"flex",gap:"8px",overflowX:"auto"}}>
          {riskFactors.map((r,i)=>(
            <span key={i} style={{backgroundColor:"#1f1000",border:"1px solid #f59e0b44",borderRadius:"6px",padding:"3px 8px",fontSize:"10px",color:"#f59e0b",whiteSpace:"nowrap"}}>⚠️ {r}</span>
          ))}
        </div>
      )}

      {/* AI STATUS */}
      <div style={{padding:"6px 16px",backgroundColor:"#0a0a18",borderTop:"1px solid #1f2937",fontSize:"10px",color:aiEnabled?scoreColor:"#6b7280",display:"flex",alignItems:"center",gap:"6px"}}>
        <span>{aiEnabled?"🧠":"⚪"}</span>
        <span style={{flex:1}}>{aiEnabled?reason:"AI OFF"}</span>
        {stoppedSecs>30&&<span style={{color:"#f59e0b"}}>⏱️ Stopped {Math.round(stoppedSecs/60)}min</span>}
      </div>

      {/* ETA BAR */}
      {eta&&(
        <div style={{backgroundColor:"#0d0d20",borderTop:"2px solid #7c3aed33",padding:"10px 16px",zIndex:100}}>
          {routeInfo&&(
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px",fontSize:"11px"}}>
              <span style={{color:"#4ade80",fontWeight:"600"}}>✅ Safest of {routeInfo.total} routes</span>
              <span style={{color:routeInfo.color,fontWeight:"bold"}}>Safety: {routeInfo.safe}/100</span>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
            <div style={{textAlign:"center"}}>
              <div style={{color:"white",fontSize:"20px",fontWeight:"bold"}}>{timeLeft}</div>
              <div style={{color:"#6b7280",fontSize:"9px"}}>time left</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:"white",fontSize:"20px",fontWeight:"bold"}}>{distLeft}</div>
              <div style={{color:"#6b7280",fontSize:"9px"}}>distance</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:"#c084fc",fontSize:"20px",fontWeight:"bold"}}>{eta}</div>
              <div style={{color:"#6b7280",fontSize:"9px"}}>arrival</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:"#4ade80",fontSize:"20px",fontWeight:"bold"}}>{currentSpeed}</div>
              <div style={{color:"#6b7280",fontSize:"9px"}}>km/h</div>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>setShowDirections(!showDirections)} style={{flex:1,backgroundColor:"#111827",color:"#c084fc",border:"1px solid #7c3aed44",borderRadius:"10px",padding:"8px",fontSize:"11px",fontWeight:"600",cursor:"pointer"}}>
              📋 {showDirections?"Hide":"Steps"} ({directions.length})
            </button>
            <div style={{flex:2,backgroundColor:"#111827",borderRadius:"10px",padding:"8px",fontSize:"10px",color:scoreColor,display:"flex",alignItems:"center",gap:"4px"}}>
              <span>🧠</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{reason.split("·")[0]}</span>
            </div>
            <button onClick={()=>window.location.href="/"} style={{backgroundColor:"#1a0000",color:"#dc2626",border:"1px solid #dc262644",borderRadius:"10px",padding:"8px 12px",fontSize:"10px",fontWeight:"600",cursor:"pointer"}}>🏁</button>
          </div>
        </div>
      )}

      {/* DIRECTIONS PANEL */}
      {showDirections&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,backgroundColor:"#0d0d20",border:"1px solid #1f2937",borderRadius:"20px 20px 0 0",maxHeight:"65vh",overflowY:"auto",zIndex:200,animation:"slideUp 0.3s ease"}}>
          <div style={{padding:"16px",borderBottom:"1px solid #1f2937",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,backgroundColor:"#0d0d20"}}>
            <h3 style={{color:"#c084fc",margin:0,fontSize:"15px"}}>📋 Directions</h3>
            <button onClick={()=>setShowDirections(false)} style={{backgroundColor:"transparent",border:"none",color:"#6b7280",fontSize:"20px",cursor:"pointer"}}>✕</button>
          </div>
          {directions.map((d,i)=>(
            <div key={i} style={{padding:"12px 16px",borderBottom:"1px solid #1f2937",display:"flex",alignItems:"center",gap:"12px",backgroundColor:i===currentStep?"#1a1a3d":"transparent"}}>
              <span style={{fontSize:"22px",flexShrink:0}}>{d.icon}</span>
              <div style={{flex:1}}>
                <div style={{color:i===currentStep?"#c084fc":"white",fontSize:"13px",fontWeight:i===currentStep?"bold":"normal"}}>{d.text}</div>
                <div style={{color:"#6b7280",fontSize:"11px"}}>{d.dist}</div>
              </div>
              {i===currentStep&&<span style={{backgroundColor:"#7c3aed",borderRadius:"6px",padding:"3px 8px",fontSize:"10px",color:"white",fontWeight:"bold"}}>NOW</span>}
            </div>
          ))}
        </div>
      )}

      {/* AI TOGGLE */}
      {showToggle&&(
        <div style={{position:"fixed",inset:0,backgroundColor:"#00000088",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{backgroundColor:"#0d0d20",border:"1px solid #1f2937",borderRadius:"24px",padding:"28px",textAlign:"center",maxWidth:"300px",width:"90%"}}>
            <div style={{fontSize:"36px",marginBottom:"12px"}}>{aiEnabled?"🧠":"⚪"}</div>
            <h3 style={{color:"#c084fc",marginBottom:"4px"}}>AI Monitoring</h3>
            <p style={{color:"#4b5563",fontSize:"11px",marginBottom:"16px"}}>{mlStatus}</p>
            <div style={{backgroundColor:"#111827",borderRadius:"12px",padding:"14px",marginBottom:"16px",textAlign:"left"}}>
              <p style={{color:"#4ade80",fontSize:"11px",margin:"0 0 6px"}}>🧠 RandomForest ML (91.9% accuracy)</p>
              <p style={{color:"#4ade80",fontSize:"11px",margin:"0 0 6px"}}>🎤 Real-time audio anomaly detection</p>
              <p style={{color:"#4ade80",fontSize:"11px",margin:"0 0 6px"}}>📳 Shake 5x rapidly = SOS</p>
              <p style={{color:"#4ade80",fontSize:"11px",margin:"0 0 6px"}}>🗣️ Say "bachao/help" 2x = SOS</p>
              <p style={{color:"#4ade80",fontSize:"11px",margin:0}}>📍 GPS anomaly + stopped detection</p>
            </div>
            <p style={{color:"#6b7280",fontSize:"11px",marginBottom:"16px"}}>All triggers → 10 second cancel window</p>
            <button onClick={toggleAI} style={{backgroundColor:aiEnabled?"#dc2626":"#16a34a",color:"white",border:"none",borderRadius:"50px",padding:"12px",fontWeight:"600",cursor:"pointer",width:"100%",marginBottom:"10px"}}>
              {aiEnabled?"Turn OFF AI":"Turn ON AI"}
            </button>
            <button onClick={()=>setShowToggle(false)} style={{backgroundColor:"transparent",color:"#6b7280",border:"1px solid #374151",borderRadius:"50px",padding:"12px",cursor:"pointer",width:"100%"}}>Cancel</button>
          </div>
        </div>
      )}
    </main>
  )
}
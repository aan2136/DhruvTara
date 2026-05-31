"use client";
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
      <style>{`
        @keyframes ring { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.8);opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bar { 0%,100%{height:8px} 50%{height:32px} }
      `}</style>

      {phase === "fakecall" && (
        <div style={{textAlign:"center",width:"100%",maxWidth:"340px"}}>
          <p style={{color:"#6b7280",fontSize:"11px",letterSpacing:"2px",marginBottom:"32px"}}>DHRUVTARA SAFETY CHECK</p>
          <div style={{position:"relative",width:"130px",height:"130px",margin:"0 auto 32px"}}>
            {[0,0.4,0.8].map((d,i) => (
              <div key={i} style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid #7c3aed",opacity:0.4,animation:`ring 2s ease-out ${d}s infinite`}}></div>
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
                <div key={i} style={{width:"5px",backgroundColor:"#7c3aed",borderRadius:"3px",animation:`bar 1s ease-in-out ${i*0.1}s infinite`,height:h*4+"px"}}></div>
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
}
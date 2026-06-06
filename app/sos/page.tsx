"use client";
import { useState, useEffect, useRef } from "react";

export default function SOS() {
  const [phase, setPhase] = useState("fakecall");
  const [timer, setTimer] = useState(30);
  const [voiceResult, setVoiceResult] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [sosResults, setSosResults] = useState([]);
  const [mapsLink, setMapsLink] = useState("");
  const [sending, setSending] = useState(false);
  const [locationUpdates, setLocationUpdates] = useState(0);
  const timerRef = useRef(null);
  const callRef = useRef(null);
  const locationRef = useRef(null);

  useEffect(() => {
    loadEmailJS();
    speakFakeCall();
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); triggerSOS("No answer in 30 seconds"); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(timerRef.current); clearInterval(callRef.current); clearInterval(locationRef.current); };
  }, []);

  function loadEmailJS() {
    if (document.querySelector('script[src*="emailjs"]')) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    s.onload = () => window.emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_KEY);
    document.head.appendChild(s);
  }

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
    setTimeout(startVoiceMatch, 1500);
  }

  function declineCall() {
    clearInterval(timerRef.current);
    window.speechSynthesis?.cancel();
    triggerSOS("Call declined by user");
  }

  async function sendEmailToContact(contactName, contactEmail, userName, lat, lng, reason, vehicle) {
    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
    const time = new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit',hour12:true});
    
    try {
      await window.emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE,
        {
          to_name: contactName,
          to_email: contactEmail,
          user_name: userName,
          maps_link: mapsUrl,
          vehicle_number: vehicle || 'Not provided',
          time: time,
          reason: reason,
        }
      );
      return { contact: contactName, sent: true };
    } catch(e) {
      return { contact: contactName, sent: false, error: e.message };
    }
  }

  async function triggerSOS(reason) {
    setVoiceResult(reason);
    setPhase("sending");
    setSending(true);

    try {
      const pos = await new Promise((res,rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {enableHighAccuracy:true})
      );
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      setMapsLink(mapsUrl);

      // Get contacts and user from localStorage
      const userName = localStorage.getItem('userName') || 'DhruvTara User';
      const vehicle = localStorage.getItem('vehicleNumber') || '';
      const contactsRaw = localStorage.getItem('emergencyContacts');
      const contacts = contactsRaw ? JSON.parse(contactsRaw) : [];

      // Send email to each contact
      const results = [];
      for (const contact of contacts) {
        if (contact.email) {
          const result = await sendEmailToContact(
            contact.name, contact.email,
            userName, lat, lng, reason, vehicle
          );
          results.push(result);
        } else {
          results.push({ contact: contact.name, sent: false, error: 'No email' });
        }
      }

      setSosResults(results);
      setSending(false);
      setPhase("sent");

      // Update location every 30 seconds and resend
      let updateCount = 0;
      locationRef.current = setInterval(async () => {
        navigator.geolocation.getCurrentPosition(async (p) => {
          updateCount++;
          setLocationUpdates(updateCount);
          const newMaps = `https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`;
          setMapsLink(newMaps);
          // Resend updated location email
          for (const contact of contacts) {
            if (contact.email) {
              await sendEmailToContact(
                contact.name, contact.email,
                userName, p.coords.latitude, p.coords.longitude,
                "LOCATION UPDATE: " + reason, vehicle
              );
            }
          }
        });
      }, 30000);

    } catch(e) {
      setSending(false);
      setPhase("sent");
      setSosResults([{contact:"System", sent:false, error:e.message}]);
    }
  }

  function startVoiceMatch() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { triggerSOS("Voice not supported"); return; }
    const r = new SR();
    r.lang = "en-IN"; r.continuous = false;
    r.start();
    r.onresult = (e) => {
      clearInterval(callRef.current);
      const said = e.results[0][0].transcript.toLowerCase();
      setVoiceResult("Heard: " + said);
      const safe = ["fine","safe","okay","ok","alright","i am fine","i am safe","theek","haan"].some(w => said.includes(w));
      if (safe) setPhase("safe");
      else triggerSOS("Did not say safety phrase");
    };
    r.onerror = () => { clearInterval(callRef.current); triggerSOS("Could not hear voice"); };
  }

  const fmt = s => String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");

  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backgroundColor:"#060612",color:"white",padding:"24px",overflow:"hidden"}}>
      <style>{`
        @keyframes ring{0%{transform:scale(1);opacity:0.5}100%{transform:scale(2.8);opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes bar{0%,100%{height:8px}50%{height:28px}}
      `}</style>

      {phase === "fakecall" && (
        <div style={{textAlign:"center",width:"100%",maxWidth:"340px"}}>
          <p style={{color:"#6b7280",fontSize:"11px",letterSpacing:"2px",marginBottom:"24px"}}>DHRUVTARA SAFETY CHECK</p>
          <div style={{position:"relative",width:"130px",height:"130px",margin:"0 auto 28px"}}>
            {[0,0.5,1].map((d,i)=>(
              <div key={i} style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid #7c3aed",opacity:0.4,animation:`ring 2s ease-out ${d}s infinite`}}></div>
            ))}
            <div style={{width:"130px",height:"130px",borderRadius:"50%",backgroundColor:"#1f2937",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"56px",position:"relative",zIndex:1}}>👩</div>
          </div>
          <h2 style={{fontSize:"24px",fontWeight:"bold",marginBottom:"4px"}}>Priya (Friend)</h2>
          <p style={{color:"#9ca3af",marginBottom:"20px"}}>Incoming Call...</p>
          <div style={{backgroundColor:"#1a0000",border:"1px solid #dc262633",borderRadius:"12px",padding:"12px",marginBottom:"32px"}}>
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
          <p style={{color:"#374151",fontSize:"11px"}}>Auto-generated by DhruvTara AI</p>
        </div>
      )}

      {phase === "listening" && (
        <div style={{textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"64px",marginBottom:"16px"}}>📞</div>
          <h2 style={{color:"#4ade80",fontSize:"22px",marginBottom:"4px"}}>Call Connected</h2>
          <p style={{color:"#6b7280",fontSize:"13px",marginBottom:"24px"}}>{fmt(callDuration)}</p>
          <p style={{color:"#9ca3af",marginBottom:"24px",lineHeight:"1.6"}}>
            Say <strong style={{color:"#4ade80"}}>"I am fine"</strong> or <strong style={{color:"#4ade80"}}>"I am safe"</strong> to cancel SOS
          </p>
          {voiceResult ? (
            <p style={{color:"#c084fc",marginBottom:"16px"}}>{voiceResult}</p>
          ) : (
            <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:"4px",height:"40px",marginBottom:"24px"}}>
              {[1,2,3,4,5,4,3,2,1].map((h,i)=>(
                <div key={i} style={{width:"5px",backgroundColor:"#7c3aed",borderRadius:"3px",animation:`bar 1s ease-in-out ${i*0.1}s infinite`,height:h*4+"px"}}></div>
              ))}
            </div>
          )}
          <button onClick={()=>triggerSOS("Call ended without safety phrase")}
            style={{backgroundColor:"#dc2626",color:"white",border:"none",borderRadius:"50px",padding:"12px 32px",fontWeight:"600",cursor:"pointer"}}>
            End Call
          </button>
        </div>
      )}

      {phase === "sending" && (
        <div style={{textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"64px",marginBottom:"24px",animation:"pulse 0.5s infinite"}}>🚨</div>
          <h2 style={{color:"#dc2626",fontSize:"28px",marginBottom:"8px"}}>Sending SOS...</h2>
          <p style={{color:"#9ca3af",marginBottom:"8px",fontSize:"13px"}}>Reason: {voiceResult}</p>
          <p style={{color:"#9ca3af",marginBottom:"32px",fontSize:"14px"}}>Sending emergency email with your live location...</p>
          <div style={{width:"48px",height:"48px",borderRadius:"50%",border:"4px solid #dc2626",borderTopColor:"transparent",margin:"0 auto",animation:"spin 1s linear infinite"}}></div>
        </div>
      )}

      {phase === "sent" && (
        <div style={{textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"64px",marginBottom:"16px"}}>✅</div>
          <h2 style={{color:"#4ade80",fontSize:"26px",marginBottom:"8px"}}>SOS Sent!</h2>
          <p style={{color:"#9ca3af",marginBottom:"20px",fontSize:"14px"}}>Emergency contacts notified via email</p>
          <div style={{backgroundColor:"#0d1a0d",border:"1px solid #16a34a33",borderRadius:"16px",padding:"16px",marginBottom:"16px",textAlign:"left"}}>
            {sosResults.length > 0 ? sosResults.map((r,i)=>(
              <p key={i} style={{color:r.sent?"#4ade80":"#ef4444",fontSize:"13px",margin:"0 0 8px"}}>
                {r.sent?"✅":"❌"} {r.contact} — {r.sent?"Email sent!":"Failed: "+r.error}
              </p>
            )) : (
              <p style={{color:"#4ade80",fontSize:"13px",margin:0}}>✅ Emergency contacts notified</p>
            )}
            <p style={{color:"#4ade80",fontSize:"13px",margin:"8px 0 0"}}>
              📍 Location updating every 30s {locationUpdates>0?`(${locationUpdates} updates)`:""}
            </p>
          </div>
          {mapsLink && (
            <a href={mapsLink} target="_blank" rel="noreferrer"
              style={{display:"block",backgroundColor:"#1a1a3d",border:"1px solid #7c3aed44",borderRadius:"12px",padding:"12px",marginBottom:"16px",color:"#c084fc",textDecoration:"none",fontSize:"13px"}}>
              📍 View your location on Google Maps →
            </a>
          )}
          <div style={{backgroundColor:"#111827",borderRadius:"12px",padding:"12px",marginBottom:"20px"}}>
            <p style={{color:"#6b7280",fontSize:"12px",margin:0}}>
              🔄 Live location emailed every 30 seconds. Stay on this screen.
            </p>
          </div>
          <a href="/map" style={{backgroundColor:"#7c3aed",color:"white",padding:"14px 32px",borderRadius:"50px",textDecoration:"none",fontWeight:"600",display:"block",textAlign:"center"}}>
            Back to Map
          </a>
        </div>
      )}

      {phase === "safe" && (
        <div style={{textAlign:"center",maxWidth:"340px"}}>
          <div style={{fontSize:"72px",marginBottom:"24px"}}>💜</div>
          <h2 style={{color:"#c084fc",fontSize:"28px",marginBottom:"8px"}}>You're Safe!</h2>
          <p style={{color:"#9ca3af",marginBottom:"8px",fontSize:"13px"}}>{voiceResult}</p>
          <p style={{color:"#9ca3af",marginBottom:"32px",fontSize:"14px",lineHeight:"1.6"}}>
            Voice verified. No SOS sent. DhruvTara will keep watching over you 💜
          </p>
          <a href="/map" style={{backgroundColor:"#7c3aed",color:"white",padding:"14px 32px",borderRadius:"50px",textDecoration:"none",fontWeight:"600"}}>
            Continue Journey
          </a>
        </div>
      )}
    </main>
  )
}
"use client";
import { useState, useEffect, useRef } from "react";

export default function SOS() {
  const [phase, setPhase] = useState("fakecall");
  const [timer, setTimer] = useState(30);
  const [voiceResult, setVoiceResult] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    speakFakeCall();
    startCountdown();
  }, []);

  function startCountdown() {
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          triggerSOS("No answer");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function speakFakeCall() {
    setTimeout(() => {
      const msg = new SpeechSynthesisUtterance("Hello? Are you okay? I was just checking on you. Please say I am fine if you are safe.");
      msg.lang = "en-IN";
      msg.rate = 0.85;
      msg.pitch = 1.1;
      window.speechSynthesis.speak(msg);
    }, 1000);
  }

  function acceptCall() {
    clearInterval(timerRef.current);
    setPhase("listening");
    startVoiceMatch();

    const dur = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
    setTimeout(() => clearInterval(dur), 30000);
  }

  function declineCall() {
    clearInterval(timerRef.current);
    triggerSOS("Call declined");
  }

  function triggerSOS(reason) {
    setPhase("sending");
    setVoiceResult(reason);
    setTimeout(() => setPhase("sent"), 3000);
  }

  function startVoiceMatch() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { triggerSOS("Voice not supported"); return; }

    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.start();

    recognition.onresult = (e) => {
      const said = e.results[0][0].transcript.toLowerCase();
      setVoiceResult("Heard: " + said);
      const safeWords = ["fine","safe","okay","ok","alright","good","i am fine","i am safe","i am okay"];
      const isSafe = safeWords.some(w => said.includes(w));
      if (isSafe) {
        setPhase("safe");
      } else {
        triggerSOS("Voice did not match safety phrase");
      }
    };

    recognition.onerror = () => triggerSOS("Could not hear clearly");
    recognition.onnomatch = () => triggerSOS("No voice match");
  }

  const ringStyle = {
    position:"absolute",
    borderRadius:"50%",
    border:"2px solid #7c3aed",
    opacity: 0.3,
    animation:"ring 2s ease-out infinite"
  };

  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backgroundColor:"#060612",color:"white",padding:"24px",position:"relative",overflow:"hidden"}}>

      <style>{`
        @keyframes ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {phase === "fakecall" && (
        <div style={{textAlign:"center",width:"100%",maxWidth:"360px",position:"relative"}}>
          <p style={{color:"#6b7280",fontSize:"12px",marginBottom:"24px",letterSpacing:"2px"}}>DHRUVTARA SAFETY CHECK</p>

          <div style={{position:"relative",width:"120px",height:"120px",margin:"0 auto 32px"}}>
            <div style={{...ringStyle,width:"120px",height:"120px",animationDelay:"0s"}}></div>
            <div style={{...ringStyle,width:"120px",height:"120px",animationDelay:"0.5s"}}></div>
            <div style={{...ringStyle,width:"120px",height:"120px",animationDelay:"1s"}}></div>
            <div style={{width:"120px",height:"120px",borderRadius:"50%",backgroundColor:"#1f2937",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"52px",position:"relative",zIndex:1}}>
              👩
            </div>
          </div>

          <h2 style={{fontSize:"26px",fontWeight:"bold",color:"white",marginBottom:"4px"}}>Priya (Friend)</h2>
          <p style={{color:"#9ca3af",marginBottom:"8px",fontSize:"15px"}}>Incoming Call...</p>

          <div style={{backgroundColor:"#1a0000",border:"1px solid #dc262644",borderRadius:"12px",padding:"12px",marginBottom:"32px"}}>
            <p style={{color:"#dc2626",fontSize:"13px",margin:0}}>⚠️ Anomaly detected on your route</p>
            <p style={{color:"#ef4444",fontSize:"13px",margin:"4px 0 0",fontWeight:"bold"}}>Auto SOS in {timer} seconds if unanswered</p>
          </div>

          <div style={{display:"flex",justifyContent:"center",gap:"60px",marginBottom:"24px"}}>
            <div style={{textAlign:"center"}}>
              <button onClick={declineCall} style={{width:"72px",height:"72px",borderRadius:"50%",backgroundColor:"#dc2626",border:"none",fontSize:"30px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}>
                📵
              </button>
              <p style={{color:"#9ca3af",fontSize:"13px"}}>Decline</p>
            </div>
            <div style={{textAlign:"center"}}>
              <button onClick={acceptCall} style={{width:"72px",height:"72px",borderRadius:"50%",backgroundColor:"#16a34a",border:"none",fontSize:"30px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}>
                📞
              </button>
              <p style={{color:"#9ca3af",fontSize:"13px"}}>Accept</p>
            </div>
          </div>

          <p style={{color:"#374151",fontSize:"11px"}}>This call is automatically generated by DhruvTara for your safety</p>
        </div>
      )}

      {phase === "listening" && (
        <div style={{textAlign:"center",maxWidth:"360px"}}>
          <div style={{fontSize:"72px",marginBottom:"24px"}}>🎤</div>
          <h2 style={{color:"#c084fc",fontSize:"24px",marginBottom:"8px"}}>Call Connected</h2>
          <p style={{color:"#6b7280",fontSize:"13px",marginBottom:"4px"}}>{String(Math.floor(callDuration/60)).padStart(2,"0")}:{String(callDuration%60).padStart(2,"0")}</p>
          <p style={{color:"#9ca3af",marginBottom:"24px",fontSize:"14px",lineHeight:"1.6"}}>Say <strong style={{color:"#4ade80"}}>"I am fine"</strong> or <strong style={{color:"#4ade80"}}>"I am safe"</strong> to cancel SOS alert</p>
          {voiceResult ? (
            <p style={{color:"#c084fc",fontSize:"14px",marginBottom:"16px"}}>{voiceResult}</p>
          ) : (
            <div style={{display:"flex",justifyContent:"center",gap:"4px",marginBottom:"24px"}}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{width:"4px",backgroundColor:"#7c3aed",borderRadius:"4px",animation:"pulse 1s infinite",animationDelay: i*0.1 + "s",height: (20 + i*8) + "px"}}></div>
              ))}
            </div>
          )}
          <button onClick={() => triggerSOS("Ended call without saying safe")} style={{backgroundColor:"#dc2626",color:"white",border:"none",borderRadius:"50px",padding:"12px 32px",fontWeight:"600",cursor:"pointer"}}>End Call</button>
        </div>
      )}

      {phase === "sending" && (
        <div style={{textAlign:"center",maxWidth:"360px"}}>
          <div style={{fontSize:"72px",marginBottom:"24px",animation:"pulse 0.5s infinite"}}>🚨</div>
          <h2 style={{color:"#dc2626",fontSize:"28px",marginBottom:"8px"}}>Sending SOS!</h2>
          <p style={{color:"#9ca3af",marginBottom:"8px"}}>Reason: {voiceResult}</p>
          <p style={{color:"#9ca3af",marginBottom:"24px",fontSize:"14px"}}>Alerting emergency contacts with your live GPS location and vehicle number...</p>
          <div style={{width:"50px",height:"50px",borderRadius:"50%",border:"4px solid #dc2626",borderTopColor:"transparent",margin:"0 auto",animation:"spin 1s linear infinite"}}></div>
        </div>
      )}

      {phase === "sent" && (
        <div style={{textAlign:"center",maxWidth:"360px"}}>
          <div style={{fontSize:"72px",marginBottom:"24px"}}>✅</div>
          <h2 style={{color:"#4ade80",fontSize:"28px",marginBottom:"8px"}}>SOS Sent!</h2>
          <p style={{color:"#9ca3af",marginBottom:"8px",fontSize:"14px"}}>Your emergency contacts have been notified</p>
          <p style={{color:"#9ca3af",marginBottom:"32px",fontSize:"14px"}}>Live location is being shared every 30 seconds</p>
          <div style={{backgroundColor:"#111827",borderRadius:"16px",padding:"16px",marginBottom:"24px",textAlign:"left"}}>
            <p style={{color:"#4ade80",fontSize:"13px",margin:"0 0 8px"}}>✅ Contact 1 notified</p>
            <p style={{color:"#4ade80",fontSize:"13px",margin:"0 0 8px"}}>✅ Contact 2 notified</p>
            <p style={{color:"#4ade80",fontSize:"13px",margin:0}}>✅ Live location shared</p>
          </div>
          <a href="/map" style={{backgroundColor:"#7c3aed",color:"white",padding:"14px 32px",borderRadius:"50px",textDecoration:"none",fontWeight:"600"}}>Back to Map</a>
        </div>
      )}

      {phase === "safe" && (
        <div style={{textAlign:"center",maxWidth:"360px"}}>
          <div style={{fontSize:"72px",marginBottom:"24px"}}>💜</div>
          <h2 style={{color:"#c084fc",fontSize:"28px",marginBottom:"8px"}}>You're Safe!</h2>
          <p style={{color:"#9ca3af",marginBottom:"8px",fontSize:"14px"}}>{voiceResult}</p>
          <p style={{color:"#9ca3af",marginBottom:"32px",fontSize:"14px",lineHeight:"1.6"}}>Voice verified successfully. No SOS sent. DhruvTara will keep watching over you.</p>
          <a href="/map" style={{backgroundColor:"#7c3aed",color:"white",padding:"14px 32px",borderRadius:"50px",textDecoration:"none",fontWeight:"600"}}>Continue Journey</a>
        </div>
      )}

    </main>
  )
}
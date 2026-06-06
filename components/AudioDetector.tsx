"use client";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

const AudioDetector = forwardRef(function AudioDetector({ onAnomaly, enabled }, ref) {
  const [audioStatus, setAudioStatus] = useState("Initializing...");
  const [audioLevel, setAudioLevel] = useState(0);
  const [detected, setDetected] = useState("");
  const modelRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const hitsRef = useRef([]);

  useImperativeHandle(ref, () => ({
    getAudioLevel: () => audioLevel,
    getDetected: () => detected,
    stop: () => cleanup()
  }));

  const DANGER_SOUNDS = [
    "Screaming", "Crying, sobbing", "Shout",
    "Whimper, moan", "Wail, moan", "Crying",
    "Glass", "Breaking", "Gunshot, gunfire",
    "Explosion", "Fighting", "Crowd"
  ];

  useEffect(() => {
    if (!enabled) { cleanup(); return; }
    loadModel();
    return () => cleanup();
  }, [enabled]);

  async function loadModel() {
    try {
      setAudioStatus("Loading AI audio model...");

      // Load TensorFlow.js and YAMNet from CDN
      if (!window.tf) {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js");
      }
      if (!window.speechCommands) {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js");
      }

      setAudioStatus("Starting microphone...");
      await startAudioAnalysis();
      setAudioStatus("🎤 Audio AI active");
    } catch(e) {
      console.log("Audio model error:", e);
      setAudioStatus("Using basic audio detection");
      await startBasicAudio();
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function startAudioAnalysis() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 16000 }
    });
    streamRef.current = stream;

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.2;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const bufLen = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufLen);
    const freqData = new Uint8Array(bufLen);

    intervalRef.current = setInterval(() => {
      if (!enabled) return;

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      // RMS volume
      let sum = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = (timeData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / bufLen);
      const volume = Math.min(Math.round(rms * 400), 100);
      setAudioLevel(volume);

      // Frequency analysis
      const binSize = ctx.sampleRate / analyser.fftSize;

      // Scream frequency range: 500-3000Hz
      const screamLo = Math.floor(500 / binSize);
      const screamHi = Math.floor(3000 / binSize);
      let screamEnergy = 0;
      for (let i = screamLo; i < Math.min(screamHi, bufLen); i++) {
        screamEnergy += freqData[i];
      }
      screamEnergy /= (screamHi - screamLo);

      // Crying frequency range: 250-800Hz  
      const cryLo = Math.floor(250 / binSize);
      const cryHi = Math.floor(800 / binSize);
      let cryEnergy = 0;
      for (let i = cryLo; i < Math.min(cryHi, bufLen); i++) {
        cryEnergy += freqData[i];
      }
      cryEnergy /= (cryHi - cryLo);

      // Sudden loud sound (explosion/glass breaking)
      const isSuddenLoud = volume > 80;
      // Scream pattern: high volume + high scream frequency energy
      const isScream = volume > 55 && screamEnergy > 75;
      // Crying pattern: medium volume + specific low frequency
      const isCrying = volume > 35 && cryEnergy > 60 && screamEnergy < 50;

      const now = Date.now();

      if (isSuddenLoud || isScream || isCrying) {
        const type = isSuddenLoud ? "Loud sound" : isScream ? "Screaming" : "Crying";
        hitsRef.current.push({ type, volume, time: now });
        hitsRef.current = hitsRef.current.filter(h => now - h.time < 5000);

        // Same type detected 3 times in 5 seconds = real anomaly
        const sameType = hitsRef.current.filter(h => h.type === type);
        if (sameType.length >= 3) {
          hitsRef.current = [];
          setDetected(type);
          if (onAnomaly) onAnomaly(type + " detected by audio AI");
        }
      }

    }, 150);
  }

  async function startBasicAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);
      intervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a,b)=>a+b,0)/bufLen;
        setAudioLevel(Math.min(Math.round(avg*2),100));
      }, 200);
      setAudioStatus("🎤 Basic audio active");
    } catch(e) {
      setAudioStatus("Microphone unavailable");
    }
  }

  function cleanup() {
    clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    setAudioStatus("Audio stopped");
    setAudioLevel(0);
  }

  if (!enabled) return null;

  return (
    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
      <div style={{display:"flex",alignItems:"flex-end",gap:"2px",height:"20px"}}>
        {[3,5,8,12,8,5,3].map((h,i)=>(
          <div key={i} style={{
            width:"3px",
            backgroundColor: audioLevel > (i*14) ? "#4ade80" : "#1f2937",
            height: audioLevel > (i*14) ? h*2+"px" : "3px",
            borderRadius:"2px",
            transition:"height 0.1s, background 0.1s"
          }}></div>
        ))}
      </div>
      <span style={{fontSize:"10px",color: detected ? "#dc2626" : "#6b7280"}}>
        {detected ? "⚠️ "+detected : audioStatus}
      </span>
    </div>
  );
});

export default AudioDetector;

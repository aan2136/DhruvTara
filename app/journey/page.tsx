"use client";
import { useState } from "react";

export default function Journey() {
  const [selected, setSelected] = useState("");
  const [vehicle, setVehicle] = useState("");

  const modes = [
    {id:"walking", icon:"🚶", label:"Walking"},
    {id:"bus", icon:"🚌", label:"Bus"},
    {id:"auto", icon:"🚖", label:"Auto"},
    {id:"cab", icon:"🚗", label:"Cab"},
    {id:"bike", icon:"🏍️", label:"Bike"},
    {id:"metro", icon:"🚇", label:"Metro"},
  ];

  const inp = {width:"100%",maxWidth:"360px",padding:"14px",marginBottom:"24px",borderRadius:"12px",border:"1px solid #7c3aed",backgroundColor:"#111827",color:"white",fontSize:"16px",outline:"none",boxSizing:"border-box"};
  const btn = {backgroundColor:"#7c3aed",color:"white",padding:"16px 40px",borderRadius:"50px",border:"none",fontWeight:"600",fontSize:"18px",cursor:"pointer",width:"100%",maxWidth:"360px",boxShadow:"0 0 30px #7c3aed55"};

  function startJourney() {
    if (!selected) { alert("Please select a mode of travel"); return; }
    if (selected !== "walking" && !vehicle) { alert("Please enter your vehicle number"); return; }
    localStorage.setItem("travelMode", selected);
    localStorage.setItem("vehicleNumber", vehicle);
    window.location.href = "/map";
  }

  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backgroundColor:"#060612",color:"white",padding:"24px"}}>
      <div style={{position:"absolute",width:"300px",height:"300px",borderRadius:"50%",backgroundColor:"#7c3aed",opacity:"0.06",top:"-50px",left:"-80px",filter:"blur(80px)"}}></div>

      <div style={{fontSize:"40px",marginBottom:"8px"}}>🗺️</div>
      <h1 style={{fontSize:"28px",fontWeight:"bold",color:"#c084fc",marginBottom:"8px"}}>Start Journey</h1>
      <p style={{color:"#6b7280",marginBottom:"32px",fontSize:"14px"}}>How are you travelling today?</p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"32px",width:"100%",maxWidth:"360px"}}>
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            style={{padding:"20px 8px",borderRadius:"16px",border: selected === m.id ? "2px solid #c084fc" : "2px solid #1f2937",backgroundColor: selected === m.id ? "#2d1b69" : "#111827",color:"white",fontSize:"13px",fontWeight:"600",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px",transition:"all 0.2s"}}
          >
            <span style={{fontSize:"28px"}}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {selected && selected !== "walking" && (
        <input
          placeholder="Enter Vehicle Number (e.g. DL 01 AB 1234)"
          value={vehicle}
          onChange={e=>setVehicle(e.target.value)}
          style={inp}
        />
      )}

      {selected === "walking" && (
        <p style={{color:"#4ade80",marginBottom:"24px",fontSize:"14px"}}>✅ No vehicle needed for walking</p>
      )}

      <button onClick={startJourney} style={btn}>Begin Safe Journey 🌟</button>

      <a href="/" style={{marginTop:"24px",color:"#6b7280",fontSize:"13px"}}>Back to Home</a>
    </main>
  )
}
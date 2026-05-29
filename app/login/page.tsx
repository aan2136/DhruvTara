"use client";
import { useState } from "react";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [otp, setOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [step, setStep] = useState(1);

  const inp = {width:"100%",maxWidth:"360px",padding:"14px",marginBottom:"16px",borderRadius:"12px",border:"1px solid #7c3aed",backgroundColor:"#111827",color:"white",fontSize:"16px"};
  const btn = {backgroundColor:"#7c3aed",color:"white",padding:"14px 40px",borderRadius:"50px",border:"none",fontWeight:"600",fontSize:"16px",cursor:"pointer",width:"100%",maxWidth:"360px"};

  function sendOtp() {
    const fake = Math.floor(100000 + Math.random() * 900000).toString();
    setOtp(fake);
    alert("Your OTP is: " + fake + " (in real app this goes to your phone)");
    setStep(2);
  }

  function verifyOtp() {
    if (enteredOtp === otp) { alert("Password reset! Redirecting..."); setMode("login"); setStep(1); }
    else { alert("Wrong OTP!"); }
  }

  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backgroundColor:"#0a0a1a",color:"white",padding:"24px"}}>
      <div style={{fontSize:"40px",marginBottom:"16px"}}>🌟</div>
      <h1 style={{fontSize:"28px",fontWeight:"bold",color:"#c084fc",marginBottom:"8px"}}>
        {mode === "login" ? "Welcome Back" : "Reset Password"}
      </h1>
      <p style={{color:"#9ca3af",marginBottom:"32px",fontSize:"14px"}}>
        {mode === "login" ? "Login to continue your safe journey" : "We will send an OTP to verify"}
      </p>

      {mode === "login" && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
          <input placeholder="Email or Phone Number" style={inp} />
          <input placeholder="Password" type="password" style={{...inp,marginBottom:"8px"}} />
          <button onClick={()=>setMode("forgot")} style={{backgroundColor:"transparent",border:"none",color:"#c084fc",cursor:"pointer",marginBottom:"24px",fontSize:"14px"}}>Forgot Password?</button>
          <a href="/journey" style={{...btn,textDecoration:"none",textAlign:"center"}}>Login</a>
        </div>
      )}

      {mode === "forgot" && step === 1 && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
          <input placeholder="Enter your Phone Number" style={inp} />
          <button onClick={sendOtp} style={btn}>Send OTP</button>
        </div>
      )}

      {mode === "forgot" && step === 2 && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
          <input placeholder="Enter 6-digit OTP" value={enteredOtp} onChange={e=>setEnteredOtp(e.target.value)} style={{...inp,letterSpacing:"8px",textAlign:"center",fontSize:"24px"}} />
          <input placeholder="New Password" type="password" style={{...inp,marginTop:"8px"}} />
          <button onClick={verifyOtp} style={{...btn,marginTop:"8px"}}>Reset Password</button>
        </div>
      )}

      <a href="/signup" style={{marginTop:"24px",color:"#9ca3af",fontSize:"14px"}}>New here? Create Account</a>
      <a href="/" style={{marginTop:"12px",color:"#4b5563",fontSize:"12px"}}>Back to Home</a>
    </main>
  )
}
"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Signup() {
  const [step, setStep] = useState(1);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [c1name, setC1name] = useState("");
  const [c1phone, setC1phone] = useState("");
  const [c1email, setC1email] = useState("");
  const [c2name, setC2name] = useState("");
  const [c2phone, setC2phone] = useState("");
  const [c2email, setC2email] = useState("");
  const [loading, setLoading] = useState(false);

  const FIXED_OTP = "123456";

  const inp = {width:"100%",maxWidth:"360px",padding:"14px",marginBottom:"16px",borderRadius:"12px",border:"1px solid #7c3aed",backgroundColor:"#111827",color:"white",fontSize:"16px",outline:"none",boxSizing:"border-box"};
  const btn = {backgroundColor:"#7c3aed",color:"white",padding:"14px 40px",borderRadius:"50px",border:"none",fontWeight:"600",fontSize:"16px",cursor:"pointer",width:"100%",maxWidth:"360px",marginTop:"8px"};

  function sendOtp() {
    if (!phone || phone.length < 10) { alert("Enter valid phone number"); return; }
    if (!name || !email || !password) { alert("Please fill all fields"); return; }
    alert("Your OTP is: " + FIXED_OTP);
    setStep(2);
  }

  function verifyOtp() {
    if (enteredOtp.trim() === FIXED_OTP) setStep(3);
    else alert("Wrong OTP! Correct OTP is 123456");
  }

  async function completeSignup() {
    if (!c1name || !c1email) { alert("Please add at least one emergency contact with email"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("users")
        .insert([{ name, email, phone, password }]).select();
      if (error) { alert("Error: " + error.message); setLoading(false); return; }

      const userId = data[0].id;
      localStorage.setItem('userId', userId);
      localStorage.setItem('userName', name);

      // Save contacts with email
      const contacts = [];
      if (c1name && c1email) {
        await supabase.from("emergency_contacts").insert([{ user_id: userId, contact_name: c1name, contact_phone: c1phone, contact_email: c1email }]);
        contacts.push({ name: c1name, email: c1email, phone: c1phone });
      }
      if (c2name && c2email) {
        await supabase.from("emergency_contacts").insert([{ user_id: userId, contact_name: c2name, contact_phone: c2phone, contact_email: c2email }]);
        contacts.push({ name: c2name, email: c2email, phone: c2phone });
      }

      // Save contacts to localStorage for SOS
      localStorage.setItem('emergencyContacts', JSON.stringify(contacts));

      alert("Account created! Welcome to DhruvTara 💜");
      window.location.href = "/journey";
    } catch(e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }

  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backgroundColor:"#060612",color:"white",padding:"24px"}}>
      <div style={{fontSize:"32px",marginBottom:"8px"}}>🌟</div>
      <h1 style={{fontSize:"28px",fontWeight:"bold",color:"#c084fc",marginBottom:"4px"}}>Create Account</h1>
      <p style={{color:"#6b7280",marginBottom:"8px",fontSize:"13px"}}>Step {step} of 3</p>
      <div style={{display:"flex",gap:"8px",marginBottom:"32px"}}>
        {[1,2,3].map(s=>(
          <div key={s} style={{width:"60px",height:"4px",borderRadius:"4px",backgroundColor:step>=s?"#7c3aed":"#374151"}}></div>
        ))}
      </div>

      {step === 1 && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
          <input placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)} style={inp}/>
          <input placeholder="Email Address" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
          <input placeholder="Phone Number" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} style={inp}/>
          <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{...inp,marginBottom:"24px"}}/>
          <button onClick={sendOtp} style={btn}>Send OTP to Verify</button>
        </div>
      )}

      {step === 2 && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
          <p style={{color:"#9ca3af",marginBottom:"24px",textAlign:"center",fontSize:"14px"}}>OTP sent to {phone}</p>
          <input placeholder="Enter 6-digit OTP" value={enteredOtp} onChange={e=>setEnteredOtp(e.target.value)} maxLength={6}
            style={{...inp,letterSpacing:"10px",textAlign:"center",fontSize:"24px",fontWeight:"bold"}}/>
          <p style={{color:"#6b7280",fontSize:"12px",marginBottom:"8px"}}>You typed: {enteredOtp}</p>
          <button onClick={verifyOtp} style={btn}>Verify OTP</button>
          <button onClick={()=>setStep(1)} style={{...btn,backgroundColor:"transparent",border:"1px solid #374151",marginTop:"12px",color:"#9ca3af"}}>Go Back</button>
        </div>
      )}

      {step === 3 && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>
          <p style={{color:"#c084fc",marginBottom:"16px",fontWeight:"600",fontSize:"15px"}}>Add Emergency Contacts</p>
          <p style={{color:"#6b7280",fontSize:"12px",marginBottom:"16px",textAlign:"center"}}>Their email is required to receive SOS alerts</p>
          <input placeholder="Contact 1 - Name" value={c1name} onChange={e=>setC1name(e.target.value)} style={inp}/>
          <input placeholder="Contact 1 - Phone" type="tel" value={c1phone} onChange={e=>setC1phone(e.target.value)} style={inp}/>
          <input placeholder="Contact 1 - Email (for SOS alerts)" type="email" value={c1email} onChange={e=>setC1email(e.target.value)} style={inp}/>
          <input placeholder="Contact 2 - Name (optional)" value={c2name} onChange={e=>setC2name(e.target.value)} style={inp}/>
          <input placeholder="Contact 2 - Phone (optional)" type="tel" value={c2phone} onChange={e=>setC2phone(e.target.value)} style={inp}/>
          <input placeholder="Contact 2 - Email (optional)" type="email" value={c2email} onChange={e=>setC2email(e.target.value)} style={{...inp,marginBottom:"24px"}}/>
          <button onClick={completeSignup} disabled={loading} style={btn}>
            {loading ? "Creating Account..." : "Complete Setup 💜"}
          </button>
        </div>
      )}

      <a href="/login" style={{marginTop:"24px",color:"#6b7280",fontSize:"13px"}}>Already have an account? Login</a>
    </main>
  )
}
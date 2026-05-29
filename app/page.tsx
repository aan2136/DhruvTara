export default function Home() {
  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backgroundColor:"#060612",color:"white",padding:"24px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",width:"300px",height:"300px",borderRadius:"50%",backgroundColor:"#7c3aed",opacity:"0.08",top:"-50px",left:"-80px",filter:"blur(80px)"}}></div>
      <div style={{position:"absolute",width:"250px",height:"250px",borderRadius:"50%",backgroundColor:"#c084fc",opacity:"0.06",bottom:"-50px",right:"-60px",filter:"blur(80px)"}}></div>

      <div style={{fontSize:"60px",marginBottom:"16px"}}>🌟</div>
      <h1 style={{fontSize:"42px",fontWeight:"bold",color:"#c084fc",marginBottom:"8px",letterSpacing:"3px"}}>DhruvTara</h1>
      <p style={{color:"#6b7280",textAlign:"center",fontSize:"14px",marginBottom:"12px",maxWidth:"260px",lineHeight:"1.8"}}>Your guiding star.</p>
      <p style={{color:"#9ca3af",textAlign:"center",fontSize:"13px",marginBottom:"48px",maxWidth:"280px",lineHeight:"1.8"}}>Every step. Every journey. Safe.</p>

      <a href="/signup" style={{backgroundColor:"#7c3aed",color:"white",fontWeight:"700",padding:"16px 0",borderRadius:"50px",fontSize:"16px",textDecoration:"none",width:"280px",textAlign:"center",marginBottom:"16px",boxShadow:"0 0 30px #7c3aed55"}}>Create Account</a>

      <a href="/login" style={{backgroundColor:"transparent",color:"#c084fc",fontWeight:"600",padding:"15px 0",borderRadius:"50px",fontSize:"16px",textDecoration:"none",width:"280px",textAlign:"center",border:"2px solid #7c3aed55"}}>Login</a>

      <p style={{marginTop:"48px",fontSize:"11px",color:"#374151",letterSpacing:"1px"}}>MADE FOR WOMEN. BUILT WITH CARE.</p>
    </main>
  )
}
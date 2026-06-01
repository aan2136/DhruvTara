"use client";
import { useState, useRef } from "react";

export default function Journey() {
  const [selected, setSelected] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected_place, setSelectedPlace] = useState(null);
  const timerRef = useRef(null);

  const modes = [
    {id:"walking",icon:"🚶",label:"Walking"},
    {id:"bus",icon:"🚌",label:"Bus"},
    {id:"auto",icon:"🚖",label:"Auto"},
    {id:"cab",icon:"🚗",label:"Cab"},
    {id:"bike",icon:"🏍️",label:"Bike"},
    {id:"metro",icon:"🚇",label:"Metro"},
  ];

  const inp = {width:"100%",maxWidth:"360px",padding:"14px",marginBottom:"16px",borderRadius:"12px",border:"1px solid #7c3aed",backgroundColor:"#111827",color:"white",fontSize:"16px",outline:"none",boxSizing:"border-box"};
  const btn = {backgroundColor:"#7c3aed",color:"white",padding:"16px 40px",borderRadius:"50px",border:"none",fontWeight:"600",fontSize:"18px",cursor:"pointer",width:"100%",maxWidth:"360px",boxShadow:"0 0 30px #7c3aed55"};

  async function searchDestination(query) {
    setDestination(query);
    setSelectedPlace(null);
    setSuggestions([]);
    if (query.length < 2) { setSearching(false); return; }
    clearTimeout(timerRef.current);
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        // Try multiple search strategies for best results
        const searches = await Promise.all([
          // Strategy 1: Direct search in India
          fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in&addressdetails=1&accept-language=en`).then(r=>r.json()),
          // Strategy 2: Add India to query
          fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query+", India")}&format=json&limit=5&countrycodes=in&addressdetails=1&accept-language=en`).then(r=>r.json()),
        ]);

        // Merge and deduplicate results
        const seen = new Set();
        const all = [];
        for (const results of searches) {
          for (const r of results) {
            if (!seen.has(r.place_id)) {
              seen.add(r.place_id);
              all.push(r);
            }
          }
        }

        // Sort by importance
        all.sort((a,b) => (b.importance||0) - (a.importance||0));
        setSuggestions(all.slice(0,8));
      } catch(e) {}
      setSearching(false);
    }, 400);
  }

  function getPlaceName(s) {
    const a = s.address || {};
    // Build name from most specific to least specific
    const name = a.amenity || a.shop || a.office || a.tourism ||
                 a.leisure || a.building || s.namedetails?.name || "";
    const road = a.road || a.pedestrian || a.path || a.footway || "";
    const area = a.suburb || a.neighbourhood || a.quarter || a.village || "";
    const city = a.city || a.town || a.county || a.state_district || "";
    const state = a.state || "";

    const parts = [name, road, area, city, state].filter(Boolean);
    return parts.length > 0 ? parts.slice(0,4).join(", ") : s.display_name.split(",").slice(0,3).join(",").trim();
  }

  function getTypeIcon(s) {
    const a = s.address || {};
    const cls = s.class || "";
    const type = s.type || "";
    if (a.amenity === "hospital" || type === "hospital") return "🏥";
    if (a.amenity === "school" || a.amenity === "college" || a.amenity === "university") return "🏫";
    if (type === "railway_station" || a.railway) return "🚉";
    if (type === "bus_station" || a.amenity === "bus_station") return "🚌";
    if (type === "airport" || a.aeroway) return "✈️";
    if (cls === "leisure" || type === "park") return "🌳";
    if (a.amenity === "restaurant" || a.amenity === "cafe") return "🍽️";
    if (a.shop === "mall" || type === "mall") return "🏬";
    if (cls === "highway" || type === "residential" || type === "secondary") return "🛣️";
    if (type === "administrative" || cls === "boundary") return "🏙️";
    if (a.amenity === "police") return "🚔";
    if (a.amenity === "temple" || a.amenity === "place_of_worship") return "🛕";
    return "📍";
  }

  function selectPlace(s) {
    const name = getPlaceName(s);
    setDestination(name);
    setSelectedPlace(s);
    localStorage.setItem("destLat", s.lat);
    localStorage.setItem("destLng", s.lon);
    localStorage.setItem("destName", name);
    setSuggestions([]);
  }

  function startJourney() {
    if (!selected) { alert("Please select mode of travel"); return; }
    if (!destination || !selected_place) { alert("Please select a destination from the suggestions list"); return; }
    if (selected !== "walking" && !vehicle) { alert("Please enter vehicle number"); return; }
    setLoading(true);
    localStorage.setItem("travelMode", selected);
    localStorage.setItem("vehicleNumber", vehicle);
    window.location.href = "/map";
  }

  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",backgroundColor:"#060612",color:"white",padding:"24px"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .suggestion:hover{background-color:#1f2937 !important}
      `}</style>

      <div style={{fontSize:"40px",marginBottom:"8px"}}>🗺️</div>
      <h1 style={{fontSize:"28px",fontWeight:"bold",color:"#c084fc",marginBottom:"8px"}}>Start Journey</h1>
      <p style={{color:"#6b7280",marginBottom:"32px",fontSize:"14px"}}>Where are you going today?</p>

      <div style={{position:"relative",width:"100%",maxWidth:"360px",marginBottom:"16px"}}>
        <div style={{position:"relative"}}>
          <input
            placeholder="Search hospital, area, street, city..."
            value={destination}
            onChange={e => searchDestination(e.target.value)}
            style={{...inp, marginBottom:0, paddingLeft:"40px", paddingRight:"40px"}}
          />
          <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",fontSize:"18px"}}>
            {selected_place ? "✅" : "🔍"}
          </span>
          {searching && (
            <div style={{position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)",width:"18px",height:"18px",borderRadius:"50%",border:"2px solid #7c3aed",borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}></div>
          )}
        </div>

        {selected_place && (
          <div style={{marginTop:"8px",backgroundColor:"#0d2d0d",border:"1px solid #4ade8044",borderRadius:"10px",padding:"10px 14px",fontSize:"12px",color:"#4ade80"}}>
            ✅ {getPlaceName(selected_place)} · {parseFloat(selected_place.lat).toFixed(4)}, {parseFloat(selected_place.lon).toFixed(4)}
          </div>
        )}

        {suggestions.length > 0 && (
          <div style={{position:"absolute",top:"100%",left:0,right:0,backgroundColor:"#0d0d20",border:"1px solid #7c3aed44",borderRadius:"16px",zIndex:1000,marginTop:"6px",maxHeight:"350px",overflowY:"auto",boxShadow:"0 8px 32px #00000099"}}>
            {suggestions.map((s,i) => (
              <div key={i} className="suggestion" onClick={()=>selectPlace(s)}
                style={{padding:"13px 16px",cursor:"pointer",borderBottom:i<suggestions.length-1?"1px solid #1f2937":"none",display:"flex",alignItems:"flex-start",gap:"12px",backgroundColor:"transparent",transition:"background 0.15s"}}
              >
                <span style={{fontSize:"22px",marginTop:"1px",flexShrink:0}}>{getTypeIcon(s)}</span>
                <div style={{minWidth:0}}>
                  <div style={{color:"white",fontSize:"13px",fontWeight:"500",lineHeight:"1.4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {getPlaceName(s)}
                  </div>
                  <div style={{color:"#6b7280",fontSize:"11px",marginTop:"3px"}}>
                    {(s.address?.state_district||s.address?.county||"")} {s.address?.state||""} · {s.type||s.class}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {destination.length > 2 && !searching && suggestions.length === 0 && !selected_place && (
          <div style={{marginTop:"8px",backgroundColor:"#1a1a0d",border:"1px solid #f59e0b44",borderRadius:"10px",padding:"10px 14px",fontSize:"12px",color:"#f59e0b"}}>
            ⚠️ No results found. Try: "Connaught Place Delhi" or "Juhu Beach Mumbai"
          </div>
        )}
      </div>

      <p style={{color:"#6b7280",marginBottom:"12px",fontSize:"13px",width:"100%",maxWidth:"360px"}}>How are you travelling?</p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"20px",width:"100%",maxWidth:"360px"}}>
        {modes.map(m => (
          <button key={m.id} onClick={()=>setSelected(m.id)}
            style={{padding:"18px 8px",borderRadius:"16px",border:selected===m.id?"2px solid #c084fc":"2px solid #1f2937",backgroundColor:selected===m.id?"#2d1b69":"#111827",color:"white",fontSize:"12px",fontWeight:"600",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",transition:"all 0.2s"}}
          >
            <span style={{fontSize:"26px"}}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {selected && selected !== "walking" && (
        <input placeholder="Vehicle Number (e.g. DL 01 AB 1234)" value={vehicle} onChange={e=>setVehicle(e.target.value)} style={inp} />
      )}
      {selected === "walking" && (
        <p style={{color:"#4ade80",marginBottom:"16px",fontSize:"14px"}}>✅ No vehicle needed</p>
      )}

      <button onClick={startJourney} disabled={loading} style={{...btn,opacity:loading?0.7:1,marginTop:"8px"}}>
        {loading ? "Loading safe route..." : "Begin Safe Journey 🌟"}
      </button>

      <a href="/" style={{marginTop:"24px",color:"#6b7280",fontSize:"13px"}}>Back to Home</a>
    </main>
  )
}
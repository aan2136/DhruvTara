const fs = require('fs');

let map = fs.readFileSync('app/map/page.tsx', 'utf8');

// Fix ML API calls to use Gradio format
map = map.replace(
  `const res=await fetch('http://localhost:5000/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat,lng,speed,stopped_duration:stoppedSecsRef.current/60})});
      const d=await res.json();`,
  `const res=await fetch('https://aan2136421-dhruv-tara-ml.hf.space/run/predict',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({data:[lat,lng,speed,stoppedSecsRef.current/60]})
      });
      const raw=await res.json();
      const d=JSON.parse(raw.data[0]);`
);

map = map.replace(
  `const res = await fetch('http://localhost:5000/score-route',{`,
  `const res = await fetch('https://aan2136421-dhruv-tara-ml.hf.space/run/score_route',{`
);

map = map.replace(
  `const res = await fetch('http://localhost:5000/health');`,
  `const res = await fetch('https://aan2136421-dhruv-tara-ml.hf.space/');`
);

fs.writeFileSync('app/map/page.tsx', map, 'utf8');
console.log('Done! Map now uses deployed ML API!');
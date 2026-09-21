(() => {
  const BASE_MOTORS = window.AK3D_MOTORS || [];
  const DEFAULTS = window.AK3D_DEFAULTS || [];
  const COLORS = ["#44a5ff", "#43d17d", "#ffbd54", "#b986ff", "#ff6670", "#44d6c7", "#d0df61", "#f18ccb"];
  const $ = id => document.getElementById(id);
  const num = id => Number($(id).value);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const fmt = (v,d=1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "–";

  const state = {
    custom: JSON.parse(localStorage.getItem("ak3d-custom-motors") || "[]"),
    motorKeys: JSON.parse(localStorage.getItem("ak3d-motor-slots") || "null") || DEFAULTS.slice(0,5),
    travelProfiles: JSON.parse(localStorage.getItem("ak3d-travel-profiles") || "null") || [
      {name:"800 / 100k", speed:800, accel:100000},
      {name:"1000 / 80k", speed:1000, accel:80000},
      {name:"1100 / 70k", speed:1100, accel:70000},
      {name:"1200 / 65k", speed:1200, accel:65000}
    ]
  };

  function motors(){ return [...BASE_MOTORS, ...state.custom]; }
  function motorMap(){ return new Map(motors().map(m => [m.key,m])); }
  function getSetup(overrides={}){
    return Object.assign({
      voltage:num("voltage"), driveCurrent:num("driveCurrent"), drivePercent:num("drivePercent")/100,
      maxPower:num("maxPower"), pulley:num("pulley"), gear:num("gear"), accel:num("accel"), mass:num("mass"),
      maxSpeed:Math.max(100,num("maxSpeed")), resolution:Math.max(1,num("resolution"))
    }, overrides);
  }

  function torqueRequired(s){
    return s.accel/1000 * s.mass/1000 * (s.pulley*2/s.gear) / (2*Math.PI*10);
  }

  function motorCalc(m,speed,s){
    const R=Number(m.resistance), L=Number(m.inductance), Irat=Number(m.ratedCurrent), hold=Number(m.holdingTorque);
    const step=Number(m.stepAngle || 1.8), inertia=Number(m.rotorInertia || 0);
    if (![R,L,Irat,hold,step].every(Number.isFinite) || R<=0 || Irat<=0 || hold<=0 || step<=0) return null;
    const maxPowerCurrent=Math.sqrt(Math.max(0,s.maxPower)/(2*R));
    const drive=Math.min(s.driveCurrent,s.drivePercent*Irat,Irat,maxPowerCurrent);
    const rps=speed*s.gear/(s.pulley*2);
    const vGen=2*Math.PI*rps*(hold/(100*Math.sqrt(2))/Irat);
    const vAvail=Math.max(s.voltage-vGen,0);
    const coilFreq=rps*(360/step)/4;
    const zCoil=2*Math.PI*coilFreq*L/1000+R;
    const iAvail=zCoil>0?vAvail/zCoil:0;
    const iActual=Math.min(iAvail,drive);
    const rotorTorque=s.accel/(s.pulley*2)*2*Math.PI*(inertia/(1000*100*100))*100;
    const torque=iActual/Irat*hold/Math.sqrt(2)-rotorTorque;
    const power=Math.pow((torque+rotorTorque)*Math.sqrt(2)*Irat/hold,2)*R+((torque+rotorTorque)/100*2*Math.PI*rps);
    return {torque,power,drive,rotorTorque,rps,iActual};
  }

  function selectedMotors(){
    const map=motorMap();
    return state.motorKeys.map(k=>map.get(k)).filter(Boolean).slice(0,8);
  }

  function motorOptions(selected){
    const groups = new Map();
    motors().forEach(m=>{ const g=m.brand || "Other"; if(!groups.has(g))groups.set(g,[]); groups.get(g).push(m); });
    let out='<option value="">— Motor wählen —</option>';
    [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([brand,list])=>{
      out += `<optgroup label="${esc(brand)}">` + list.sort((a,b)=>String(a.model||a.key).localeCompare(String(b.model||b.key))).map(m=>`<option value="${esc(m.key)}" ${m.key===selected?'selected':''}>${esc(m.model||m.key)}</option>`).join('') + '</optgroup>';
    });
    return out;
  }

  function renderMotorSlots(){
    if(!state.motorKeys.length) state.motorKeys.push("");
    $("motorSlots").innerHTML=state.motorKeys.map((key,i)=>`<div class="motor-slot"><span class="motor-color" style="background:${COLORS[i%COLORS.length]}"></span><select data-slot="${i}">${motorOptions(key)}</select><button class="remove-slot" data-remove="${i}" title="Remove slot">×</button></div>`).join('');
    $("motorSlots").querySelectorAll('select').forEach(sel=>sel.addEventListener('change',e=>{
      state.motorKeys[Number(e.target.dataset.slot)] = e.target.value;
      persistMotorSlots(); renderAll(); renderMatrixMotorOptions();
    }));
    $("motorSlots").querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{
      state.motorKeys.splice(Number(btn.dataset.remove),1); persistMotorSlots(); renderMotorSlots(); renderAll(); renderMatrixMotorOptions();
    }));
  }
  function persistMotorSlots(){ localStorage.setItem("ak3d-motor-slots",JSON.stringify(state.motorKeys)); }

  function niceMax(v){ if(v<=10)return 10; const p=Math.pow(10,Math.floor(Math.log10(v))); return Math.ceil(v/p/2)*2*p; }
  function curveData(m,s){ const arr=[]; for(let v=0;v<=s.maxSpeed+1e-9;v+=s.resolution){const c=motorCalc(m,v,s);if(c)arr.push({speed:v,...c});} if(arr.length&&arr.at(-1).speed<s.maxSpeed){const c=motorCalc(m,s.maxSpeed,s);if(c)arr.push({speed:s.maxSpeed,...c});} return arr; }

  function renderMetrics(){
    const s=getSetup(), req=torqueRequired(s);
    $("metricTorque").textContent=req.toFixed(2)+" Ncm";
    $("metricRadius").textContent=(s.pulley*2/(2*Math.PI)).toFixed(2)+" mm";
    $("metricCount").textContent=selectedMotors().length;
    $("metricRange").textContent=`0–${Math.round(s.maxSpeed)} mm/s`;
  }

  function renderTorqueChart(){
    const svg=$("torqueChart"), tt=$("tooltip"), s=getSetup(), ms=selectedMotors(), req=torqueRequired(s);
    const datasets=ms.map((m,i)=>({m,color:COLORS[i%COLORS.length],data:curveData(m,s)}));
    let yMax=Math.max(req,...datasets.flatMap(d=>d.data.map(p=>Math.max(0,p.torque))),10); yMax=niceMax(yMax*1.1);
    const W=1200,H=560,p={l:70,r:25,t:24,b:50},iw=W-p.l-p.r,ih=H-p.t-p.b;
    const sx=x=>p.l+x/s.maxSpeed*iw, sy=y=>p.t+(1-y/yMax)*ih;
    let g='';
    for(let i=0;i<=6;i++){const x=s.maxSpeed*i/6,X=sx(x);g+=`<line class="gridline" x1="${X}" x2="${X}" y1="${p.t}" y2="${H-p.b}"/><text x="${X}" y="${H-19}" text-anchor="middle" font-size="12">${Math.round(x)}</text>`;}
    for(let i=0;i<=6;i++){const y=yMax*i/6,Y=sy(y);g+=`<line class="gridline" x1="${p.l}" x2="${W-p.r}" y1="${Y}" y2="${Y}"/><text x="${p.l-10}" y="${Y+4}" text-anchor="end" font-size="12">${y.toFixed(yMax<=20?1:0)}</text>`;}
    g+=`<line class="axis" x1="${p.l}" x2="${W-p.r}" y1="${H-p.b}" y2="${H-p.b}"/><line class="axis" x1="${p.l}" x2="${p.l}" y1="${p.t}" y2="${H-p.b}"/><text x="${W/2}" y="${H-3}" text-anchor="middle" font-size="12">Speed [mm/s]</text><text x="16" y="${H/2}" transform="rotate(-90 16 ${H/2})" text-anchor="middle" font-size="12">Available torque [Ncm]</text>`;
    const Yr=sy(req);g+=`<line class="req" x1="${p.l}" x2="${W-p.r}" y1="${Yr}" y2="${Yr}"/><text x="${W-p.r-4}" y="${Yr-7}" text-anchor="end" font-size="12" fill="#ff9299">required ${req.toFixed(2)} Ncm</text>`;
    datasets.forEach(d=>{const pts=d.data.map(pt=>`${sx(pt.speed).toFixed(1)},${sy(pt.torque).toFixed(1)}`).join(' ');g+=`<polyline class="curve" stroke="${d.color}" points="${pts}"/>`;});
    g+=`<line id="hoverLine" class="hover-line" x1="0" x2="0" y1="${p.t}" y2="${H-p.b}"/><rect id="chartHit" x="${p.l}" y="${p.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    svg.innerHTML=g;
    const hit=svg.querySelector('#chartHit'), hover=svg.querySelector('#hoverLine');
    hit.addEventListener('mousemove',ev=>{const rect=svg.getBoundingClientRect(),mx=(ev.clientX-rect.left)/rect.width*W,speed=clamp((mx-p.l)/iw*s.maxSpeed,0,s.maxSpeed),X=sx(speed);hover.setAttribute('x1',X);hover.setAttribute('x2',X);hover.style.opacity=1;let rows=[`<b>${speed.toFixed(0)} mm/s</b>`,`Required: ${req.toFixed(2)} Ncm`];datasets.forEach(d=>{const c=motorCalc(d.m,speed,s);if(c)rows.push(`<span style="color:${d.color}">●</span> ${esc(d.m.model||d.m.key)}: <b>${c.torque.toFixed(2)}</b> Ncm`)});tt.innerHTML=rows.join('<br>');tt.style.display='block';tt.style.left=Math.min(ev.offsetX+14,rect.width-245)+'px';tt.style.top=(ev.offsetY+12)+'px';});
    hit.addEventListener('mouseleave',()=>{hover.style.opacity=0;tt.style.display='none';});
    $("legend").innerHTML=datasets.map(d=>`<span class="legend-item"><span class="swatch" style="background:${d.color}"></span>${esc(d.m.model||d.m.key)}</span>`).join('')+`<span class="legend-item"><span class="swatch" style="background:var(--danger)"></span>Torque required</span>`;
  }

  function renderMotorResults(){
    const s=getSetup(),req=torqueRequired(s),ms=selectedMotors();
    $("motorResults").innerHTML=ms.map((m,i)=>{const data=curveData(m,s);let last=null;data.forEach(p=>{if(p.torque>=req)last=p.speed;});const c0=motorCalc(m,0,s);return `<tr><td><span class="badge" style="border-left:4px solid ${COLORS[i%COLORS.length]}">${esc(m.key)}</span></td><td>${fmt(m.ratedCurrent,2)}</td><td>${fmt(m.holdingTorque,1)}</td><td>${fmt(m.inductance,2)}</td><td>${fmt(m.resistance,2)}</td><td>${fmt(m.rotorInertia,1)}</td><td>${c0?c0.drive.toFixed(2):'–'}</td><td>${c0?c0.rotorTorque.toFixed(2):'–'}</td><td><b>${last===null?'0':Math.round(last)} mm/s</b></td></tr>`;}).join('');
  }

  function travelTime(distance,speed,accel){
    distance=Math.max(0,Number(distance));speed=Math.max(0.0001,Number(speed));accel=Math.max(0.0001,Number(accel));
    const dToV=speed*speed/accel;
    if(distance>=dToV){return {time:distance/speed+speed/accel,type:'Trapezoid',peak:speed,dToV};}
    const peak=Math.sqrt(distance*accel);return {time:2*Math.sqrt(distance/accel),type:'Triangle',peak,dToV};
  }

  function renderTravelProfiles(){
    $("travelProfiles").innerHTML=state.travelProfiles.map((p,i)=>`<div class="travel-profile"><span class="motor-color" style="background:${COLORS[i%COLORS.length]}"></span><label class="profile-name"><span>Name</span><input data-tidx="${i}" data-tfield="name" value="${esc(p.name)}"></label><label><span>Speed mm/s</span><input data-tidx="${i}" data-tfield="speed" type="number" step="50" value="${p.speed}"></label><label><span>Accel mm/s²</span><input data-tidx="${i}" data-tfield="accel" type="number" step="5000" value="${p.accel}"></label><button class="remove-slot remove-travel" data-tremove="${i}">×</button></div>`).join('');
    $("travelProfiles").querySelectorAll('[data-tfield]').forEach(inp=>inp.addEventListener('input',e=>{const i=Number(e.target.dataset.tidx),f=e.target.dataset.tfield;state.travelProfiles[i][f]=f==='name'?e.target.value:Number(e.target.value);persistTravel();renderTravelResults();}));
    $("travelProfiles").querySelectorAll('[data-tremove]').forEach(btn=>btn.addEventListener('click',()=>{state.travelProfiles.splice(Number(btn.dataset.tremove),1);persistTravel();renderTravelProfiles();renderTravelResults();}));
  }
  function persistTravel(){localStorage.setItem('ak3d-travel-profiles',JSON.stringify(state.travelProfiles));}
  function renderTravelResults(){
    const d=Math.max(0,num('travelDistance'));
    const rows=state.travelProfiles.map((p,i)=>({p,i,...travelTime(d,p.speed,p.accel)}));
    const fastest=Math.min(...rows.map(r=>r.time));
    $("travelResults").innerHTML=rows.map(r=>`<tr><td><span class="badge" style="border-left:4px solid ${COLORS[r.i%COLORS.length]}">${esc(r.p.name)}</span></td><td><b>${(r.time*1000).toFixed(2)} ms</b></td><td>${r.type}</td><td>${r.peak.toFixed(0)} mm/s</td><td>${r.dToV.toFixed(1)} mm</td><td>${r.time===fastest?'<b>fastest</b>':'+'+((r.time/fastest-1)*100).toFixed(1)+'%'}</td></tr>`).join('');
    const best=rows.sort((a,b)=>a.time-b.time)[0];
    $("travelExplain").innerHTML=best?`At <b>${d.toFixed(0)} mm</b>, <b>${esc(best.p.name)}</b> is fastest at <b>${(best.time*1000).toFixed(2)} ms</b>. ${best.type==='Triangle'?`It never reaches the commanded ${best.p.speed} mm/s; peak is ${best.peak.toFixed(0)} mm/s.`:`It reaches ${best.p.speed} mm/s after ${best.dToV.toFixed(1)} mm total accel+decel distance.`}`:'No profile.';
  }

  function renderMatrixMotorOptions(){
    const old=$("matrixMotor").value;
    const opts=motors().map(m=>`<option value="${esc(m.key)}">${esc((m.brand?m.brand+' · ':'')+(m.model||m.key))}</option>`).join('');
    $("matrixMotor").innerHTML=opts;
    const preferred = old || state.motorKeys.find(Boolean) || DEFAULTS[0] || motors()[0]?.key;
    if(preferred && motors().some(m=>m.key===preferred)) $("matrixMotor").value=preferred;
  }

  function rangeValues(min,max,step,maxCount=30){
    min=Number(min);max=Number(max);step=Math.max(1,Number(step));if(max<min)[min,max]=[max,min];const out=[];for(let v=min;v<=max+1e-9&&out.length<maxCount;v+=step)out.push(v);return out;
  }
  function matrixClass(margin){if(margin<0)return 'cell-fail';if(margin<.2)return 'cell-tight';if(margin<.5)return 'cell-good';return 'cell-strong';}
  function renderMatrix(){
    const map=motorMap(),m=map.get($("matrixMotor").value);if(!m){$("matrixTable").innerHTML='<p class="hint">Select a motor.</p>';return;}
    const speeds=rangeValues(num('matrixSpeedMin'),num('matrixSpeedMax'),num('matrixSpeedStep'),24),accels=rangeValues(num('matrixAccelMin'),num('matrixAccelMax'),num('matrixAccelStep'),30);
    let html='<table class="matrix-table"><thead><tr><th>Accel ↓ / Speed →</th>'+speeds.map(v=>`<th>${Math.round(v)}<small>mm/s</small></th>`).join('')+'</tr></thead><tbody>';
    let pass=0,total=0,bestSpeed=0;
    for(const a of accels){html+=`<tr><td>${Math.round(a/1000)}k<small>mm/s²</small></td>`;for(const v of speeds){const s=getSetup({accel:a}),req=torqueRequired(s),c=motorCalc(m,v,s);let margin=c&&req>0?c.torque/req-1:-Infinity;total++;if(margin>=0){pass++;bestSpeed=Math.max(bestSpeed,v);}const cls=matrixClass(margin);const label=Number.isFinite(margin)?(margin>=0?`+${Math.round(margin*100)}%`:`${Math.round(margin*100)}%`):'–';html+=`<td class="${cls}" title="Avail ${c?c.torque.toFixed(2):'–'} Ncm / Req ${req.toFixed(2)} Ncm"><span class="passmark">${margin>=0?'✓':'×'}</span> ${label}<small>${c?c.torque.toFixed(1):'–'} / ${req.toFixed(1)} Ncm</small></td>`;}html+='</tr>';}
    html+='</tbody></table>';$("matrixTable").innerHTML=html;
    $("matrixSummary").innerHTML=`<span class="summary-chip"><b>${esc(m.model||m.key)}</b></span><span class="summary-chip">Cells passing: <b>${pass}/${total}</b></span><span class="summary-chip">Highest passing speed in grid: <b>${bestSpeed||0} mm/s</b></span><span class="summary-chip">Voltage: <b>${num('voltage')} V</b> · Drive: <b>${num('driveCurrent')} A</b> · Mass: <b>${num('mass')} g</b></span>`;
  }

  function renderAll(){renderMetrics();renderTorqueChart();renderMotorResults();renderMatrix();}

  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$('tab-'+btn.dataset.tab).classList.add('active');if(btn.dataset.tab==='matrix')renderMatrix();if(btn.dataset.tab==='travel')renderTravelResults();}));

  ['voltage','driveCurrent','drivePercent','maxPower','pulley','gear','accel','mass','maxSpeed','resolution'].forEach(id=>$(id).addEventListener('input',renderAll));
  $('resetSetup').addEventListener('click',()=>{const d={voltage:48,driveCurrent:1.8,drivePercent:100,maxPower:50,pulley:20,gear:1,accel:20000,mass:500,maxSpeed:3000,resolution:20};Object.entries(d).forEach(([k,v])=>$(k).value=v);renderAll();});
  $('addMotorSlot').addEventListener('click',()=>{if(state.motorKeys.length>=8)return;state.motorKeys.push('');persistMotorSlots();renderMotorSlots();});
  $('customToggle').addEventListener('click',()=>$('customMotor').classList.toggle('hidden'));
  $('addCustom').addEventListener('click',()=>{const name=$('cName').value.trim();if(!name)return alert('Name fehlt.');const m={key:'CUSTOM-'+name,brand:'Custom',model:name,nema:17,bodyLength:null,stepAngle:num('cStep'),ratedCurrent:num('cCurrent'),holdingTorque:num('cTorque'),inductance:num('cInduct'),resistance:num('cRes'),rotorInertia:num('cInertia')};state.custom.push(m);localStorage.setItem('ak3d-custom-motors',JSON.stringify(state.custom));if(state.motorKeys.length<8)state.motorKeys.push(m.key);else state.motorKeys[state.motorKeys.length-1]=m.key;persistMotorSlots();$('cName').value='';renderMotorSlots();renderMatrixMotorOptions();renderAll();});

  $('travelDistance').addEventListener('input',renderTravelResults);
  document.querySelectorAll('[data-distance]').forEach(b=>b.addEventListener('click',()=>{$('travelDistance').value=b.dataset.distance;document.querySelectorAll('[data-distance]').forEach(x=>x.classList.toggle('active',x===b));renderTravelResults();}));
  $('addTravelProfile').addEventListener('click',()=>{if(state.travelProfiles.length>=8)return;state.travelProfiles.push({name:`Profile ${state.travelProfiles.length+1}`,speed:1000,accel:70000});persistTravel();renderTravelProfiles();renderTravelResults();});

  ['matrixMotor','matrixSpeedMin','matrixSpeedMax','matrixSpeedStep','matrixAccelMin','matrixAccelMax','matrixAccelStep'].forEach(id=>$(id).addEventListener(id==='matrixMotor'?'change':'input',renderMatrix));

  renderMotorSlots();renderTravelProfiles();renderMatrixMotorOptions();renderTravelResults();renderAll();
})();

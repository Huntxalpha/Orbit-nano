
(()=>{
  const C = document.getElementById('game');
  const X = C.getContext('2d');
  const start = document.getElementById('start');
  const over = document.getElementById('gameover');
  const btnPlay = document.getElementById('play');
  const btnRetry = document.getElementById('retry');
  const btnShare = document.getElementById('share');
  const uiScore = document.getElementById('score');
  const uiBest = document.getElementById('best');
  const uiFinal = document.getElementById('finalScore');

  const W = C.width, H = C.height;
  const cx = W/2, cy = H/2;
  let t0=0, dt=0, last=0, running=false;
  let score=0, best=parseInt(localStorage.getItem('orbit_best')||'0');
  uiBest.textContent = best;

  // Game parameters
  const innerR = 90, outerR = 150;
  let targetR = outerR, r = outerR; // current orbit radius
  let a = -Math.PI/2; // angle
  const satSpeed = 1.8; // rad/s
  const interp = 12; // radius lerp speed
  const rings = []; // collectibles
  const meteors = []; // hazards
  let spawnTimer=0, ringTimer=0;

  function reset(){
    score=0; uiScore.textContent='0';
    a = -Math.PI/2; r = outerR; targetR = outerR;
    rings.length = 0; meteors.length=0;
    spawnTimer=0; ringTimer=0; last=performance.now(); t0=0; dt=0;
  }

  function tap(){
    if(!running) return;
    targetR = (targetR===outerR? innerR : outerR);
  }

  // Input
  C.addEventListener('pointerdown', tap);
  window.addEventListener('keydown', e=>{ if(e.code==='Space') tap(); });

  // Spawners
  function spawnMeteor(){
    // Spawn from random angle at far radius and move inward across screen
    const ang = Math.random()*Math.PI*2;
    const speed = 80 + Math.random()*60 + Math.min(120, score*0.2);
    const x = cx + Math.cos(ang)* (Math.max(W,H));
    const y = cy + Math.sin(ang)* (Math.max(W,H));
    const vx = (cx - x); const vy = (cy - y);
    const len = Math.hypot(vx,vy);
    meteors.push({x,y, vx:vx/len*speed, vy:vy/len*speed, rad:8+Math.random()*8, life: 8});
  }

  function spawnRing(){
    // Place ring on opposite orbit of current target to encourage switching
    const ringOrbit = (targetR===outerR? innerR : outerR);
    const ang = Math.random()*Math.PI*2;
    rings.push({ang, R:ringOrbit, got:false, blink:0});
  }

  // Drawing helpers
  function drawSpace(){
    // background stars
    X.clearRect(0,0,W,H);
    // planet
    X.fillStyle = getCSS('--planet'); 
    X.beginPath(); X.arc(cx,cy,60,0,Math.PI*2); X.fill();
    // rings visuals
    X.strokeStyle = getCSS('--ring'); X.lineWidth = 2.5; X.globalAlpha=0.7;
    circle(cx,cy,innerR); circle(cx,cy,outerR);
    X.globalAlpha=1;
  }
  function circle(x,y,R){ X.beginPath(); X.arc(x,y,R,0,Math.PI*2); X.stroke(); }
  function getCSS(name){ return getComputedStyle(document.documentElement).getPropertyValue(name); }

  function update(now){
    dt = (now-last)/1000; if(dt>0.033) dt=0.033; last=now; if(!running) return;
    t0 += dt; score += dt*10; uiScore.textContent = Math.floor(score);

    // Move satellite
    a += satSpeed * dt;
    r += (targetR - r) * Math.min(1, interp*dt);
    const sx = cx + Math.cos(a)*r;
    const sy = cy + Math.sin(a)*r;

    // Spawns
    spawnTimer -= dt; ringTimer -= dt;
    if(spawnTimer<=0){ spawnMeteor(); spawnTimer = 0.6 + Math.max(0.15, 1.1 - score*0.01); }
    if(ringTimer<=0){ spawnRing(); ringTimer = 2.2 + Math.max(0.0, 1.2 - score*0.01); }

    // Move meteors
    for(let i=meteors.length-1;i>=0;i--){
      const m = meteors[i];
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.life -= dt;
      // Collision with satellite
      const d = Math.hypot(m.x - sx, m.y - sy);
      if(d < m.rad + 6){
        gameOver(); return;
      }
      // Despawn
      if(m.life<=0 || m.x<-50 || m.x>W+50 || m.y<-50 || m.y>H+50){
        meteors.splice(i,1);
      }
    }

    // Collect rings
    for(let i=rings.length-1;i>=0;i--){
      const g = rings[i];
      const gx = cx + Math.cos(g.ang)*g.R;
      const gy = cy + Math.sin(g.ang)*g.R;
      g.blink += dt;
      if(Math.hypot(gx-sx, gy-sy) < 12){
        rings.splice(i,1);
        score += 25;
        uiScore.textContent = Math.floor(score);
        // small burst
        for(let k=0;k<3;k++) meteors.push({x:gx,y:gy,vx:(Math.random()*2-1)*40,vy:(Math.random()*2-1)*40,rad:2+Math.random()*3,life:.3});
      }
      // auto fade after some time
      if(g.blink>6) rings.splice(i,1);
    }

    // Render
    drawSpace();

    // Draw rings
    X.save();
    for(const g of rings){
      const alpha = 0.6 + 0.4*Math.sin(g.blink*6);
      X.strokeStyle = getCSS('--ring');
      X.globalAlpha = alpha;
      circle(cx,cy,g.R);
      const gx = cx + Math.cos(g.ang)*g.R;
      const gy = cy + Math.sin(g.ang)*g.R;
      X.globalAlpha = 1;
      X.beginPath(); X.arc(gx,gy,6,0,Math.PI*2);
      X.fillStyle = getCSS('--ring'); X.fill();
    }
    X.restore();

    // Draw meteors
    for(const m of meteors){
      X.fillStyle = getCSS('--meteor');
      X.beginPath(); X.arc(m.x,m.y,m.rad,0,Math.PI*2); X.fill();
    }

    // Satellite
    X.fillStyle = getCSS('--sat');
    X.beginPath(); X.arc(sx,sy,6,0,Math.PI*2); X.fill();
    // trail
    X.globalAlpha=0.25; X.beginPath(); X.arc(cx,cy,r, a-0.8, a); X.strokeStyle=getCSS('--sat'); X.lineWidth=2; X.stroke(); X.globalAlpha=1;

    requestAnimationFrame(update);
  }

  function startGame(){
    reset(); running=true; start.hidden=true; over.hidden=true;
    requestAnimationFrame(ts=>{ last=ts; update(ts); });
  }
  function gameOver(){
    running=false;
    const final = Math.floor(score);
    uiFinal.textContent = final;
    if(final>best){ best=final; localStorage.setItem('orbit_best', String(best)); uiBest.textContent=best; }
    over.hidden=false;
  }

  btnPlay.addEventListener('click', startGame);
  btnRetry.addEventListener('click', startGame);
  btnShare.addEventListener('click', ()=>{
    const s = Math.floor(score);
    const url = location.href;
    const text = `J'ai fait ${s} pts sur ORBIT NANO 🚀 Essayez en 1 clic`;
    const u = new URL('https://twitter.com/intent/tweet');
    u.searchParams.set('text', text);
    u.searchParams.set('url', url);
    window.open(u.toString(), '_blank');
  });

  // Background OG image generation (once) if canvas available
  try{
    const og = document.createElement('canvas'); og.width=1200; og.height=630;
    const g = og.getContext('2d');
    g.fillStyle = '#0b1020'; g.fillRect(0,0,1200,630);
    g.fillStyle = '#203a72'; g.beginPath(); g.arc(600,315,180,0,Math.PI*2); g.fill();
    g.strokeStyle = '#3fd0ff'; g.lineWidth=6; g.globalAlpha=0.7;
    g.beginPath(); g.arc(600,315,140,0,Math.PI*2); g.stroke();
    g.beginPath(); g.arc(600,315,230,0,Math.PI*2); g.stroke();
    g.globalAlpha=1; g.fillStyle='#ffd447'; g.beginPath(); g.arc(600+230*Math.cos(-Math.PI/2),315+230*Math.sin(-Math.PI/2),14,0,Math.PI*2); g.fill();
    g.fillStyle='#fff'; g.font='bold 64px system-ui,Segoe UI,Roboto,Arial'; g.textAlign='center';
    g.fillText('ORBIT NANO', 600, 120);
    // Save to png
    const data = og.toDataURL('image/png');
    fetch(data).then(r=>r.blob()).then(async blob=>{
      // no write to file system in browser env; placeholder
    });
  }catch(e){}

  // Draw static background before start
  drawSpace();
})();

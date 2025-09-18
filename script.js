(() => {
  'use strict';

  // Canvas
  const C = document.getElementById('game');
  const X = C.getContext('2d');
  const W = C.width, H = C.height, cx = W/2, cy = H/2;

  // UI
  const start   = document.getElementById('start');
  const over    = document.getElementById('gameover');
  const btnPlay = document.getElementById('play');
  const btnRetry= document.getElementById('retry');
  const btnShare= document.getElementById('share');
  const uiScore = document.getElementById('score');
  const uiBest  = document.getElementById('best');
  const uiFinal = document.getElementById('finalScore');

  // État
  let running = false, last = 0, dt = 0;
  let score = 0, best = parseInt(localStorage.getItem('orbit_best')||'0'); uiBest.textContent = best;

  // Paramètres orbitaux
  const innerR = 90, outerR = 150;
  let targetR = outerR, r = outerR;
  let a = -Math.PI/2;               // angle du satellite
  const satSpeed = 1.8;             // rad/s
  const interp   = 12;              // vitesse d’interpolation du rayon

  // Entités : anneaux (bonus) et pics (danger)
  const rings = [];                 // {ang, R, blink}
  const spikes = [];                // {R, ang, arc, t, life, phase}
  let ringTimer  = 0;
  let spikeTimer = 0;
  let tutorial = 0;

  // Utils
  function getCSS(name){ return getComputedStyle(document.documentElement).getPropertyValue(name); }
  function circle(x,y,R){ X.beginPath(); X.arc(x,y,R,0,Math.PI*2); X.stroke(); }
  function normAngle(x){ while(x<=-Math.PI) x+=2*Math.PI; while(x>Math.PI) x-=2*Math.PI; return x; }
  function angDist(a1,a2){ return Math.abs(normAngle(a1 - a2)); }

  // Fond
  function drawSpace(){
    X.clearRect(0,0,W,H);
    // planète
    X.fillStyle = getCSS('--planet');
    X.beginPath(); X.arc(cx,cy,60,0,Math.PI*2); X.fill();
    // orbites
    X.strokeStyle = getCSS('--ring'); X.lineWidth = 2.5; X.globalAlpha = 0.7;
    circle(cx,cy,innerR); circle(cx,cy,outerR);
    X.globalAlpha = 1;
  }

  // Spawns
  function spawnRing(){
    const ringOrbit = (targetR===outerR? innerR : outerR);
    const ang = Math.random()*Math.PI*2;
    rings.push({ang, R:ringOrbit, blink:0});
  }

  // Pic = petit arc rouge sur une orbite (inner ou outer)
  function spawnSpike(){
    const R = (Math.random()<0.5? innerR : outerR);
    const arc = (Math.random()*0.35 + 0.20);  // longueur d’arc (rad)
    const ang = Math.random()*Math.PI*2;
    const life = 2.0 + Math.random()*2.0;     // durée de vie
    spikes.push({
      R, ang, arc,
      t: 0, life,
      phase: Math.random()*Math.PI*2        // pour l’effet de pulsation
    });
  }

  // Contrôle
  function tap(){ if (running) targetR = (targetR===outerR? innerR : outerR); }
  C.addEventListener('pointerdown', tap);
  window.addEventListener('keydown', e => { if(e.code==='Space') tap(); });

  // Reset / Start / Over
  function reset(){
    score = 0; uiScore.textContent = '0';
    a = -Math.PI/2; r = outerR; targetR = outerR;
    rings.length = 0; spikes.length = 0;

    // Démarrage clair
    tutorial   = 1.8;   // hint ~2s
    ringTimer  = 0.50;  // 1er anneau rapide
    spikeTimer = 0.35;  // 1er pic rapide

    last = performance.now(); dt = 0;
  }

  function startGame(){
    reset();
    running = true;
    start.hidden = true;
    over.hidden  = true;
    requestAnimationFrame(ts => { last = ts; update(ts); });
  }

  function gameOver(){
    running = false;
    const final = Math.floor(score);
    uiFinal.textContent = final;
    if(final > best){ best = final; localStorage.setItem('orbit_best', String(best)); uiBest.textContent = best; }
    over.hidden = false;
  }

  // Boucle
  function update(now){
    dt = (now-last)/1000; if(dt>0.033) dt=0.033; last=now;
    if(!running) return;

    score += dt*10; uiScore.textContent = Math.floor(score);

    // Déplacement satellite
    a += satSpeed * dt;
    r += (targetR - r) * Math.min(1, interp*dt);
    const sx = cx + Math.cos(a)*r;
    const sy = cy + Math.sin(a)*r;

    // Spawns
    ringTimer  -= dt;
    spikeTimer -= dt;
    if (ringTimer<=0)  { spawnRing();  ringTimer  = 2.0 - Math.min(0.8, score*0.001); }
    if (spikeTimer<=0) { spawnSpike(); spikeTimer = 0.9 - Math.min(0.45, score*0.0015); } // jusqu’à ~0.45s

    // Update spikes (pics)
    for(let i=spikes.length-1;i>=0;i--){
      const s = spikes[i];
      s.t += dt; s.life -= dt; s.phase += dt*6;
      // collision si on est sur la même orbite ET angle dans l’arc
      const sameOrbit = Math.abs(s.R - r) < 10; // marge (le joueur suit l’orbite)
      if (sameOrbit && angDist(a, s.ang) < s.arc/2){
        return gameOver();
      }
      if (s.life<=0) spikes.splice(i,1);
    }

    // Update/collect rings
    for(let i=rings.length-1;i>=0;i--){
      const g = rings[i];
      const gx = cx + Math.cos(g.ang)*g.R;
      const gy = cy + Math.sin(g.ang)*g.R;
      g.blink += dt;
      if (Math.hypot(gx - sx, gy - sy) < 12){
        rings.splice(i,1);
        score += 25; uiScore.textContent = Math.floor(score);
      }
      if (g.blink>6) rings.splice(i,1);
    }

    // Rendu
    drawSpace();

    // Pics (arcs rouges pulsants)
    for(const s of spikes){
      const pulse = 0.6 + 0.4*Math.abs(Math.sin(s.phase));
      X.save();
      X.strokeStyle = getCSS('--meteor'); // rouge
      X.globalAlpha = 0.85;
      X.lineWidth   = 6 * pulse;         // pulsation d’épaisseur
      X.beginPath();
      X.arc(cx, cy, s.R, s.ang - s.arc/2, s.ang + s.arc/2);
      X.stroke();
      X.restore();
    }

    // Anneaux (collectibles)
    X.save();
    for(const g of rings){
      const alpha = 0.6 + 0.4*Math.sin(g.blink*6);
      X.strokeStyle = getCSS('--ring'); X.globalAlpha = alpha; circle(cx,cy,g.R);
      const gx = cx + Math.cos(g.ang)*g.R;
      const gy = cy + Math.sin(g.ang)*g.R;
      X.globalAlpha = 1; X.beginPath(); X.arc(gx,gy,8,0,Math.PI*2); X.fillStyle = getCSS('--ring'); X.fill();
    }
    X.restore();

    // Satellite + traînée
    X.fillStyle = getCSS('--sat'); X.beginPath(); X.arc(sx,sy,6,0,Math.PI*2); X.fill();
    X.globalAlpha=0.25; X.beginPath(); X.arc(cx,cy,r, a-0.8, a); X.strokeStyle=getCSS('--sat'); X.lineWidth=2; X.stroke();
    X.globalAlpha=1;

    // Hint début
    if (tutorial > 0) {
      tutorial -= dt;
      X.save();
      X.globalAlpha = Math.max(0, Math.min(1, tutorial / 2));
      X.fillStyle = '#fff';
      X.font = 'bold 16px system-ui,Segoe UI,Roboto,Arial';
      X.textAlign = 'center';
      X.fillText('Tape pour changer d’orbite (évite les pics rouges)', cx, H - 40);
      X.restore();
    }

    requestAnimationFrame(update);
  }

  // Boutons
  btnPlay.addEventListener('click', startGame);
  btnRetry.addEventListener('click', startGame);
  btnShare.addEventListener('click', () => {
    const s = Math.floor(score);
    const u = new URL('https://twitter.com/intent/tweet');
    u.searchParams.set('text', `J'ai fait ${s} pts sur ORBIT NANO 🚀 Essayez en 1 clic`);
    u.searchParams.set('url', location.href);
    window.open(u.toString(), '_blank');
  });

  // Init visuelle
  window.addEventListener('DOMContentLoaded', () => {
    start.hidden = false;  // écran de départ visible
    over.hidden  = true;   // écran de fin caché
    running = false;
    drawSpace();
  });
})();

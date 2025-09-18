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
  const uiRings = document.getElementById('rings'); // présent si tu as ajouté le compteur

  // État
  let running = false, last = 0, dt = 0;
  let score = 0, ringsCount = 0;
  let best = parseInt(localStorage.getItem('orbit_best')||'0'); uiBest.textContent = best;

  // Paramètres orbitaux
  const innerR = 90, outerR = 150;
  let targetR = outerR, r = outerR;
  let a = -Math.PI/2;
  const satSpeed = 1.8;
  const interp = 12;

  // Entités
  const rings = [];
  const meteors = [];
  let spawnTimer = 0, ringTimer = 0;
  let tutorial = 0; // hint “Tape pour changer d’orbite”

  // Utilitaires dessin
  function getCSS(name){ return getComputedStyle(document.documentElement).getPropertyValue(name); }
  function circle(x,y,R){ X.beginPath(); X.arc(x,y,R,0,Math.PI*2); X.stroke(); }

  // Fond
  function drawSpace(){
    X.clearRect(0,0,W,H);
    X.fillStyle = getCSS('--planet');
    X.beginPath(); X.arc(cx,cy,60,0,Math.PI*2); X.fill();
    X.strokeStyle = getCSS('--ring'); X.lineWidth = 2.5; X.globalAlpha = 0.7;
    circle(cx,cy,innerR); circle(cx,cy,outerR); X.globalAlpha = 1;
  }

  // Spawns déterministes et visibles
  function spawnMeteor(){
    const ang = Math.random()*Math.PI*2;
    const speed = 130 + Math.random()*70 + Math.min(180, score*0.25);
    const x = cx + Math.cos(ang)*Math.max(W,H);
    const y = cy + Math.sin(ang)*Math.max(W,H);
    const vx = cx - x, vy = cy - y;
    const len = Math.hypot(vx,vy);
    meteors.push({
      x, y,
      vx: vx/len*speed,
      vy: vy/len*speed,
      rad: 14 + Math.random()*10,  // bien visible
      life: 8
    });
  }
  function spawnRing(){
    const ringOrbit = (targetR===outerR? innerR : outerR);
    const ang = Math.random()*Math.PI*2;
    rings.push({ang, R:ringOrbit, blink:0});
  }

  // Contrôles
  function tap(){ if (running) targetR = (targetR === outerR ? innerR : outerR); }
  C.addEventListener('pointerdown', tap);
  window.addEventListener('keydown', e => { if (e.code === 'Space') tap(); });

  // Reset / Start / Over
  function reset(){
    score = 0; ringsCount = 0;
    uiScore.textContent = '0';
    if (uiRings) uiRings.textContent = '0';
    a = -Math.PI/2; r = outerR; targetR = outerR;
    rings.length = 0; meteors.length = 0;

    tutorial   = 2.0;   // hint 2 s
    spawnTimer = 0.20;  // 1er météore à 0,2 s
    ringTimer  = 0.50;  // 1er anneau à 0,5 s

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
    if (final > best){ best = final; localStorage.setItem('orbit_best', String(best)); uiBest.textContent = best; }
    over.hidden = false;
  }

  // Boucle
  function update(now){
    dt = (now-last)/1000; if (dt>0.033) dt = 0.033; last = now;
    if (!running) return;

    score += dt*10; uiScore.textContent = Math.floor(score);

    // Position satellite
    a += satSpeed * dt;
    r += (targetR - r) * Math.min(1, interp*dt);
    const sx = cx + Math.cos(a)*r;
    const sy = cy + Math.sin(a)*r;

    // Spawns garantis
    spawnTimer -= dt; ringTimer -= dt;
    if (spawnTimer <= 0){
      spawnMeteor();
      // cadence : 0.8 s, puis accélère jusqu’à 0.35 s min
      const next = 0.8 - Math.min(0.45, score*0.0015);
      spawnTimer = Math.max(0.35, next);
    }
    if (ringTimer <= 0){
      spawnRing();
      ringTimer = 2.0 - Math.min(0.8, score*0.001); // anneaux un peu plus fréquents avec le score
    }

    // Déplacements + collisions
    for (let i=meteors.length-1;i>=0;i--){
      const m = meteors[i];
      m.x += m.vx*dt; m.y += m.vy*dt; m.life -= dt;
      if (Math.hypot(m.x - sx, m.y - sy) < m.rad + 6) return gameOver();
      if (m.life<=0 || m.x<-50 || m.x>W+50 || m.y<-50 || m.y>H+50) meteors.splice(i,1);
    }

    for (let i=rings.length-1;i>=0;i--){
      const g = rings[i];
      const gx = cx + Math.cos(g.ang)*g.R;
      const gy = cy + Math.sin(g.ang)*g.R;
      g.blink += dt;
      if (Math.hypot(gx-sx, gy-sy) < 12){
        rings.splice(i,1);
        ringsCount++; if (uiRings) uiRings.textContent = ringsCount;
        score += 25; uiScore.textContent = Math.floor(score);
      }
      if (g.blink>6) rings.splice(i,1);
    }

    // Rendu
    drawSpace();

    // Anneaux visuels
    X.save();
    for (const g of rings){
      const alpha = 0.6 + 0.4*Math.sin(g.blink*6);
      X.strokeStyle = getCSS('--ring'); X.globalAlpha = alpha; circle(cx,cy,g.R);
      const gx = cx + Math.cos(g.ang)*g.R;
      const gy = cy + Math.sin(g.ang)*g.R;
      X.globalAlpha = 1; X.beginPath(); X.arc(gx,gy,8,0,Math.PI*2); X.fillStyle = getCSS('--ring'); X.fill();
    }
    X.restore();

    // Météores (halo)
    X.save();
    for (const m of meteors){
      X.shadowColor = 'rgba(255,90,90,.8)'; X.shadowBlur = 10;
      X.fillStyle = getCSS('--meteor');
      X.beginPath(); X.arc(m.x,m.y,m.rad,0,Math.PI*2); X.fill();
    }
    X.restore();

    // Satellite + traînée
    X.fillStyle = getCSS('--sat'); X.beginPath(); X.arc(sx,sy,6,0,Math.PI*2); X.fill();
    X.globalAlpha=0.25; X.beginPath(); X.arc(cx,cy,r, a-0.8, a); X.strokeStyle=getCSS('--sat'); X.lineWidth=2; X.stroke(); X.globalAlpha=1;

    // Hint début
    if (tutorial > 0) {
      tutorial -= dt;
      X.save();
      X.globalAlpha = Math.max(0, Math.min(1, tutorial / 2));
      X.fillStyle = '#fff';
      X.font = 'bold 16px system-ui,Segoe UI,Roboto,Arial';
      X.textAlign = 'center';
      X.fillText('Tape pour changer d’orbite', cx, H - 40);
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

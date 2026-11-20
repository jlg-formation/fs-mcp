(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas && canvas.getContext('2d');
  if (!canvas || !ctx) return;

  const W = canvas.width, H = canvas.height;
  const $ = id => document.getElementById(id);
  const overlay = $('overlay');
  const startButton = $('start-button');
  let audio = null;
  let soundEnabled = true;
  let state = 'ready';
  let score = 0;
  let best = Number(localStorage.getItem('neonBreakerBest') || 0);
  let lives = 3;
  let level = 1;
  let elapsed = 0;
  let startedAt = 0;
  let lastFrame = 0;
  let bricks = [];
  let particles = [];
  const keys = new Set();

  const paddle = { w: 112, h: 12, x: W / 2 - 56, y: H - 40, speed: 570 };
  const ball = { x: W / 2, y: H - 61, r: 7, vx: 0, vy: 0, speed: 360, stuck: true };
  const cfg = { cols: 10, rows: 5, w: 68, h: 19, gap: 10, top: 76 };
  const colors = ['#ff477e', '#ff8b4d', '#ffe66d', '#45f5bb', '#48c9ff'];

  function formatScore(n) { return String(n).padStart(6, '0'); }
  function updateHUD() {
    $('score').textContent = formatScore(score);
    $('best-score').textContent = formatScore(best);
    $('level').textContent = String(level).padStart(2, '0');
    $('bricks').textContent = String(bricks.filter(b => b.alive).length).padStart(2, '0');
    $('lives').querySelectorAll('i').forEach((el, i) => el.classList.toggle('lost', i >= lives));
    $('score-progress').style.width = `${Math.min(100, score % 5000 / 50)}%`;
    $('timer').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
  }

  function makeBricks() {
    bricks = [];
    const total = cfg.cols * cfg.w + (cfg.cols - 1) * cfg.gap;
    const left = (W - total) / 2;
    for (let row = 0; row < cfg.rows; row++) {
      for (let col = 0; col < cfg.cols; col++) {
        bricks.push({
          x: left + col * (cfg.w + cfg.gap), y: cfg.top + row * (cfg.h + cfg.gap),
          w: cfg.w, h: cfg.h, color: colors[row], alive: true,
          hp: level > 1 && row < 2 ? 2 : 1
        });
      }
    }
    updateHUD();
  }

  function resetBall() {
    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 1;
  }

  function resetGame() {
    score = 0;
    lives = 3;
    level = 1;
    elapsed = 0;
    startedAt = 0;
    paddle.x = W / 2 - paddle.w / 2;
    particles = [];
    ball.speed = 360;
    makeBricks();
    resetBall();
    updateHUD();
  }

  function tone(freq = 440, duration = .07, type = 'sine', volume = .035) {
    if (!soundEnabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration);
    } catch (_) { /* Le jeu reste jouable si l'audio n'est pas disponible. */ }
  }

  function showOverlay(kind) {
    const copy = {
      ready: ['▶', 'INSERT COIN', 'PRÊT À <span>JOUER ?</span>', 'Détruis les briques. Garde la balle en jeu.<br>Fais exploser le high score.', 'LANCER LA PARTIE'],
      paused: ['Ⅱ', 'PAUSE', 'ON REPREND <span>QUAND TU VEUX</span>', 'La partie est en pause.<br>Ton high score t’attend.', 'REPRENDRE'],
      life: ['↻', 'CONTINUE', 'ENCORE <span>UNE CHANCE</span>', 'La balle est partie…<br>Prêt·e à retenter le coup ?', 'CONTINUER'],
      over: ['×', 'GAME OVER', 'PARTIE <span>TERMINÉE</span>', 'Les briques ont gagné cette fois.<br>La revanche est à un bouton.', 'REJOUER'],
      win: ['✦', 'NIVEAU TERMINÉ', 'PLATEAU <span>NETTOYÉ !</span>', 'Excellent ! Le prochain niveau<br>sera un peu plus corsé.', 'NIVEAU SUIVANT']
    }[kind];
    $('overlay-symbol').textContent = copy[0];
    $('overlay-kicker').textContent = copy[1];
    $('overlay-title').innerHTML = copy[2];
    $('overlay-copy').innerHTML = copy[3];
    startButton.innerHTML = `<span>▶</span> ${copy[4]}`;
    $('overlay-hint').textContent = kind === 'paused' ? 'ESPACE POUR REPRENDRE' : 'ESPACE OU ENTRÉE POUR DÉMARRER';
    overlay.classList.remove('hidden');
  }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function launch() {
    if (state === 'paused') {
      state = 'playing';
      hideOverlay();
      lastFrame = performance.now();
      return;
    }
    if (state !== 'ready' && state !== 'life' && state !== 'win') return;

    // Après une vie perdue ou un nouveau niveau, la balle reste attachée
    // à la raquette jusqu'au lancement explicite.
    state = 'playing';
    ball.stuck = false;
    const direction = Math.random() < .5 ? -1 : 1;
    ball.vx = direction * ball.speed * .42;
    ball.vy = -ball.speed * .91;
    hideOverlay();
    tone(660, .12, 'triangle', .045);
    if (!startedAt) startedAt = performance.now() - elapsed * 1000;
    lastFrame = performance.now();
  }

  function spawnParticles(x, y, color, amount = 8) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2, speed = 45 + Math.random() * 150;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .3 + Math.random() * .42, max: .72, size: 1.5 + Math.random() * 2.3, color });
    }
  }

  function loseLife() {
    lives--;
    updateHUD();
    tone(130, .35, 'sawtooth', .05);
    spawnParticles(ball.x, H - 20, '#ff3eb5', 18);
    if (lives <= 0) {
      state = 'over';
      startedAt = 0;
      showOverlay('over');
    } else {
      state = 'life';
      resetBall();
      showOverlay('life');
    }
  }

  function nextLevel() {
    level++;
    ball.speed = Math.min(520, ball.speed + 35);
    makeBricks();
    resetBall();
    state = 'win';
    showOverlay('win');
  }

  function hitBrick(brick) {
    brick.hp--;
    if (brick.hp > 0) {
      brick.color = '#fff';
      tone(510, .045, 'sine', .025);
      return;
    }
    brick.alive = false;
    score += 100 * level;
    spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 9);
    tone(380 + Math.random() * 240, .08, 'triangle', .035);
    if (score > best) {
      best = score;
      localStorage.setItem('neonBreakerBest', String(best));
    }
    updateHUD();
    if (!bricks.some(b => b.alive)) nextLevel();
  }

  function update(dt) {
    if (state !== 'playing') return;
    elapsed = Math.floor((performance.now() - startedAt) / 1000);
    updateHUD();

    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) paddle.x -= paddle.speed * dt;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) paddle.x += paddle.speed * dt;
    paddle.x = Math.max(14, Math.min(W - paddle.w - 14, paddle.x));

    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 1;
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x - ball.r < 8) { ball.x = 8 + ball.r; ball.vx = Math.abs(ball.vx); tone(260, .03); }
    if (ball.x + ball.r > W - 8) { ball.x = W - 8 - ball.r; ball.vx = -Math.abs(ball.vx); tone(260, .03); }
    if (ball.y - ball.r < 8) { ball.y = 8 + ball.r; ball.vy = Math.abs(ball.vy); tone(260, .03); }

    if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h && ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
      ball.y = paddle.y - ball.r;
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const angle = hit * 1.12;
      ball.vx = ball.speed * Math.sin(angle);
      ball.vy = -Math.abs(ball.speed * Math.cos(angle));
      tone(520, .055, 'triangle');
      spawnParticles(ball.x, paddle.y, '#38f5e5', 4);
    }

    if (ball.y - ball.r > H) { loseLife(); return; }

    for (const b of bricks) {
      if (!b.alive || ball.x + ball.r < b.x || ball.x - ball.r > b.x + b.w || ball.y + ball.r < b.y || ball.y - ball.r > b.y + b.h) continue;
      const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
      const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - b.r));
      if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
      hitBrick(b);
      break;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .98; p.vy *= .98; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#101022'); bg.addColorStop(1, '#090914');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(114,103,165,.075)'; ctx.lineWidth = 1;
    for (let x = 25; x < W; x += 35) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 20; y < H; y += 35) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    ctx.save(); ctx.setLineDash([3, 8]); ctx.strokeStyle = 'rgba(56,245,229,.12)';
    ctx.beginPath(); ctx.moveTo(12, 24); ctx.lineTo(12, H - 20); ctx.lineTo(W - 12, H - 20); ctx.lineTo(W - 12, 24); ctx.stroke(); ctx.restore();

    for (const b of bricks) if (b.alive) {
      ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 9; ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, 2);
      if (b.hp > 1) { ctx.fillStyle = '#fff'; ctx.fillRect(b.x + b.w / 2 - 2, b.y + 8, 4, 4); }
      ctx.restore();
    }

    ctx.save(); ctx.shadowColor = '#38f5e5'; ctx.shadowBlur = 18; ctx.fillStyle = '#38f5e5';
    roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 5); ctx.fill();
    ctx.fillStyle = '#d8fffc'; roundRect(ctx, paddle.x + paddle.w * .28, paddle.y + 2, paddle.w * .44, 2, 1); ctx.fill(); ctx.restore();

    ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 15;
    const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, ball.r);
    grad.addColorStop(0, '#fff'); grad.addColorStop(.45, '#c8fffb'); grad.addColorStop(1, '#38f5e5');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min((now - (lastFrame || now)) / 1000, .032);
    lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function handleAction() {
    if (state === 'over') {
      resetGame();
      state = 'ready';
      showOverlay('ready');
      launch();
    } else {
      launch();
    }
  }

  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if (e.key === ' ' || e.key === 'Enter') {
      if (state === 'playing') { state = 'paused'; showOverlay('paused'); }
      else handleAction();
    }
    if (e.key.toLowerCase() === 'm') {
      soundEnabled = !soundEnabled;
      const label = document.querySelector('.sound-indicator b');
      const bars = document.querySelector('.sound-bars');
      if (label) label.textContent = soundEnabled ? 'ON' : 'OFF';
      if (bars) bars.style.opacity = soundEnabled ? '1' : '.3';
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.key));

  // Le bouton et l'écran entier sont activables : pas besoin de viser un petit bouton.
  startButton.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); handleAction(); });
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.classList.contains('overlay-card')) handleAction();
  });

  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    paddle.x = ((e.clientX - rect.left) / rect.width) * W - paddle.w / 2;
    paddle.x = Math.max(14, Math.min(W - paddle.w - 14, paddle.x));
    if (ball.stuck) ball.x = paddle.x + paddle.w / 2;
  });
  canvas.addEventListener('pointerdown', () => {
    if (state === 'ready' || state === 'life' || state === 'paused' || state === 'win') handleAction();
  });

  $('best-score').textContent = formatScore(best);
  makeBricks();
  showOverlay('ready');
  lastFrame = performance.now();
  requestAnimationFrame(frame);
})();

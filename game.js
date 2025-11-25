const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let width = 0;
let height = 0;
let groundY = 0;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  groundY = Math.floor(height * 0.85);
}
window.addEventListener('resize', resize);
resize();
const gravity = 1800;
const friction = 0.85;
const maxSpeed = 420;
const jumpForce = 780;
let level = 1;
let kills = 0;
let score = 0;
let highScore = Number(localStorage.getItem('forest_highscore') || 0);
let gameOver = false;

const keys = new Set();
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Tab') {
    player.nextRayType();
    return;
  }
  keys.add(e.code);
});
window.addEventListener('keyup', e => {
  keys.delete(e.code);
});
canvas.addEventListener('pointerdown', () => {
  if (gameOver) {
    resetGame();
    return;
  }
  player.jump();
  audio.init();
  audio.startAmbient();
});

class Particle {
  constructor() {
    this.reset(true);
  }
  reset(randomX) {
    this.x = randomX ? Math.random() * width : this.x;
    this.y = Math.random() * height;
    this.r = 1 + Math.random() * 2;
    this.s = 10 + Math.random() * 20;
    this.alpha = 0.35 + Math.random() * 0.4;
    this.wobble = Math.random() * Math.PI * 2;
    this.wSpeed = 0.6 + Math.random() * 0.8;
  }
  update(dt) {
    this.y -= this.s * dt;
    this.wobble += this.wSpeed * dt;
    this.x += Math.sin(this.wobble) * 8 * dt;
    if (this.y < -10) {
      this.y = height + 10;
      this.x = Math.random() * width;
    }
  }
  draw() {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = '#a4f0ff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class Background {
  drawGradient() {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#0a0d1a');
    g.addColorStop(0.5, '#111a2e');
    g.addColorStop(1, '#15243a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  drawHaze() {
    ctx.fillStyle = 'rgba(180,220,255,0.06)';
    ctx.fillRect(0, groundY - 80, width, 200);
  }
  drawHills() {
    ctx.fillStyle = '#0e1729';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= width; x += 40) {
      const y = groundY - 40 - Math.sin(x * 0.01) * 20;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }
  drawTrees() {
    const count = Math.max(12, Math.floor(width / 120));
    for (let i = 0; i < count; i++) {
      const x = (i / count) * width + Math.sin(i * 1.7) * 20;
      const h = 120 + (i % 5) * 30;
      ctx.fillStyle = '#0a1324';
      ctx.fillRect(x, groundY - h, 6, h);
      ctx.fillStyle = '#0d1528';
      ctx.beginPath();
      ctx.moveTo(x - 20, groundY - h + 20);
      ctx.lineTo(x + 3, groundY - h - 20);
      ctx.lineTo(x + 26, groundY - h + 20);
      ctx.closePath();
      ctx.fill();
    }
  }
  draw() {
    this.drawGradient();
    this.drawHills();
    this.drawTrees();
    this.drawHaze();
  }
}

class Player {
  constructor() {
    this.w = 36;
    this.h = 48;
    this.x = width * 0.2;
    this.y = groundY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.canShoot = true;
    this.shootDelay = 200;
    this.onGround = true;
    this.hpMax = 100;
    this.hp = this.hpMax;
    this.iTime = 0;
    this.rayType = 'normal';
  }
  jump() {
    if (this.onGround) {
      this.vy = -jumpForce;
      this.onGround = false;
    }
  }
  nextRayType() {
    const order = ['normal', 'spread', 'heavy'];
    const i = order.indexOf(this.rayType);
    this.rayType = order[(i + 1) % order.length];
  }
  shoot() {
    if (!this.canShoot) return;
    this.canShoot = false;
    const baseX = this.x + this.w / 2;
    const baseY = this.y + this.h * 0.4;
    if (this.rayType === 'normal') {
      rays.push(new Ray(baseX, baseY, this.facing, { w: 30, h: 6, speed: 820, pierce: 0 }));
      audio.shoot('normal');
      this.shootDelay = 200;
    } else if (this.rayType === 'spread') {
      rays.push(new Ray(baseX, baseY - 8, this.facing, { w: 26, h: 5, speed: 820, pierce: 0 }));
      rays.push(new Ray(baseX, baseY, this.facing, { w: 26, h: 5, speed: 820, pierce: 0 }));
      rays.push(new Ray(baseX, baseY + 8, this.facing, { w: 26, h: 5, speed: 820, pierce: 0 }));
      audio.shoot('spread');
      this.shootDelay = 380;
    } else if (this.rayType === 'heavy') {
      rays.push(new Ray(baseX, baseY, this.facing, { w: 42, h: 10, speed: 700, pierce: 2 }));
      audio.shoot('heavy');
      this.shootDelay = 600;
    }
    setTimeout(() => (this.canShoot = true), this.shootDelay);
  }
  update(dt) {
    const left = keys.has('ArrowLeft');
    const right = keys.has('ArrowRight');
    if (left && !right) this.vx = Math.max(this.vx - 2000 * dt, -maxSpeed);
    else if (right && !left) this.vx = Math.min(this.vx + 2000 * dt, maxSpeed);
    else this.vx *= friction;
    if (Math.abs(this.vx) < 6) this.vx = 0;
    if (right) this.facing = 1;
    if (left) this.facing = -1;
    if (keys.has('Space')) this.shoot();
    this.vy += gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y + this.h >= groundY) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.onGround = true;
    }
    if (this.x < 0) this.x = 0;
    if (this.x + this.w > width) this.x = width - this.w;
    if (this.iTime > 0) this.iTime -= dt;
  }
  takeDamage(d) {
    if (this.iTime > 0) return;
    this.hp -= d;
    this.iTime = 0.8;
    if (this.hp <= 0) {
      this.hp = 0;
      gameOver = true;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('forest_highscore', String(highScore));
      }
    }
  }
  draw() {
    const px = Math.floor(this.x);
    const py = Math.floor(this.y);
    ctx.save();
    ctx.translate(px + this.w / 2, py + this.h);
    ctx.scale(this.facing, 1);
    ctx.translate(-this.w / 2, -this.h);
    const robe = ctx.createLinearGradient(0, py, 0, py + this.h);
    robe.addColorStop(0, '#283a5a');
    robe.addColorStop(1, '#1c2942');
    ctx.fillStyle = robe;
    ctx.fillRect(0, 10, this.w, this.h - 10);
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath();
    ctx.arc(this.w / 2, 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2540';
    ctx.beginPath();
    ctx.moveTo(this.w / 2 - 18, 8);
    ctx.lineTo(this.w / 2 + 18, 8);
    ctx.lineTo(this.w / 2, -14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a4b5ff';
    ctx.fillRect(this.w - 6, 16, 4, 20);
    ctx.restore();
  }
}

class Enemy {
  constructor(type) {
    this.type = type;
    this.w = 34;
    this.h = 34;
    this.x = width * (0.5 + Math.random() * 0.45);
    this.y = groundY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
    this.timer = 0;
    this.jumpT = 0;
    if (this.type === 'rock') this.vx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80 + level * 10);
  }
  update(dt) {
    if (this.dead) {
      this.timer += dt;
      return;
    }
    if (this.type === 'rock') {
      this.x += this.vx * dt;
      if (this.x < 0 || this.x + this.w > width) this.vx *= -1;
    } else if (this.type === 'mushroom') {
      this.jumpT += dt;
      if (this.jumpT > 1.2 - Math.min(level * 0.05, 0.8)) {
        this.vy = -520 - level * 20;
        this.jumpT = 0;
      }
      this.vy += gravity * dt;
      this.y += this.vy * dt;
      if (this.y + this.h >= groundY) {
        this.y = groundY - this.h;
        this.vy = 0;
      }
    }
  }
  draw() {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h);
    ctx.translate(-this.w / 2, -this.h);
    if (this.type === 'flower') {
      ctx.fillStyle = '#356d3a';
      ctx.fillRect(this.w / 2 - 3, 12, 6, this.h - 12);
      ctx.fillStyle = '#64b76b';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = this.w / 2 + Math.cos(a) * 10;
        const py = 12 + Math.sin(a) * 10;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#e9ffd6';
      ctx.beginPath();
      ctx.arc(this.w / 2, 12, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'rock') {
      ctx.fillStyle = '#4c4f5e';
      ctx.beginPath();
      ctx.moveTo(4, this.h);
      ctx.lineTo(this.w - 4, this.h);
      ctx.lineTo(this.w - 8, 10);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'mushroom') {
      ctx.fillStyle = '#7a2b2b';
      ctx.beginPath();
      ctx.arc(this.w / 2, 14, 16, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#d9b77b';
      ctx.fillRect(this.w / 2 - 6, 14, 12, this.h - 14);
    }
    ctx.restore();
  }
}

class Ray {
  constructor(x, y, dir, opts) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.w = (opts && opts.w) || 30;
    this.h = (opts && opts.h) || 6;
    this.speed = (opts && opts.speed) || 800;
    this.pierce = (opts && opts.pierce) || 0;
    this.alive = true;
  }
  update(dt) {
    this.x += this.speed * dt * this.dir;
    if (this.x < -100 || this.x > width + 100) this.alive = false;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.dead && this.intersects(e)) {
        if (this.pierce > 0) this.pierce--;
        else this.alive = false;
        e.dead = true;
        e.timer = 0;
        kills++;
        score += getEnemyScore(e.type);
        audio.explosion();
        spawnBurst(e.x + e.w / 2, e.y + e.h / 2);
        if (!this.alive) break;
      }
    }
  }
  draw() {
    const g = ctx.createLinearGradient(this.x, this.y, this.x + this.w * this.dir, this.y);
    g.addColorStop(0, '#7df0ff');
    g.addColorStop(1, '#c0ffea');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(0);
    ctx.fillRect(0, -this.h / 2, this.w, this.h);
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(180,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(this.x + (this.w * this.dir) * 0.5, this.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  intersects(e) {
    const rx = this.x;
    const ry = this.y - this.h / 2;
    const rw = this.w;
    const rh = this.h;
    return rx < e.x + e.w && rx + rw > e.x && ry < e.y + e.h && ry + rh > e.y;
  }
}

function spawnBurst(x, y) {
  for (let i = 0; i < 24; i++) {
    burst.push({
      x,
      y,
      r: 2 + Math.random() * 3,
      a: Math.random() * Math.PI * 2,
      s: 140 + Math.random() * 260,
      life: 0,
      max: 0.6 + Math.random() * 0.4
    });
  }
}

const bg = new Background();
const player = new Player();
const enemies = [];
const particles = Array.from({ length: 140 }, () => new Particle());
const rays = [];
const burst = [];

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt) {
  particles.forEach(p => p.update(dt));
  if (gameOver) return;
  player.update(dt);
  enemies.forEach(e => e.update(dt));
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.dead && intersectsPlayer(e)) {
      player.takeDamage(damageFor(e.type));
    }
  }
  for (let i = rays.length - 1; i >= 0; i--) {
    const r = rays[i];
    r.update(dt);
    if (!r.alive) rays.splice(i, 1);
  }
  for (let i = burst.length - 1; i >= 0; i--) {
    const b = burst[i];
    b.life += dt;
    b.x += Math.cos(b.a) * b.s * dt;
    b.y += Math.sin(b.a) * b.s * dt;
    b.s *= 0.96;
    if (b.life > b.max) burst.splice(i, 1);
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead && e.timer > 1.2) enemies.splice(i, 1);
  }
  manageSpawns();
}

function draw() {
  bg.draw();
  particles.forEach(p => p.draw());
  drawGround();
  enemies.forEach(e => e.draw());
  player.draw();
  rays.forEach(r => r.draw());
  drawBurst();
  drawHud();
  if (gameOver) drawOverlay();
}

function drawGround() {
  ctx.fillStyle = '#1a263f';
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.fillStyle = '#0f1830';
  for (let x = 0; x < width; x += 26) {
    const h = 16 + Math.sin(x * 0.1) * 6;
    ctx.fillRect(x, groundY - h, 20, h);
  }
}

function drawBurst() {
  burst.forEach(b => {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(180,255,220,0.6)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });
}

function drawHud() {
  ctx.fillStyle = '#cfe8ff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Nivel ' + level, 16, 28);
  ctx.fillText('Eliminaciones ' + kills, 16, 48);
  ctx.fillText('Puntos ' + score, 16, 68);
  ctx.fillText('Mejor ' + highScore, 16, 88);
  ctx.fillText('Disparo ' + player.rayType, 16, 108);
  const barW = 180;
  const hpPct = player.hp / player.hpMax;
  ctx.fillStyle = '#15243a';
  ctx.fillRect(width - barW - 20, 20, barW, 12);
  ctx.fillStyle = '#64b76b';
  ctx.fillRect(width - barW - 20, 20, Math.max(0, Math.floor(barW * hpPct)), 12);
}

function manageSpawns() {
  const target = Math.min(1 + level, 6);
  while (enemies.length < target) {
    const r = Math.random();
    let t = 'flower';
    if (level >= 2 && r < 0.5) t = 'rock';
    if (level >= 3 && r < 0.25) t = 'mushroom';
    enemies.push(new Enemy(t));
  }
  if (kills >= level * 5) {
    level++;
  }
}

const audio = {
  ctx: null,
  master: null,
  ambientGain: null,
  ambientNode: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  },
  startAmbient() {
    if (!this.ctx || this.ambientNode) return;
    const len = 2;
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len * sr, sr);
    const data = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < data.length; i++) {
      v += (Math.random() * 2 - 1) * 0.02;
      v *= 0.98;
      data[i] = v;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.value = 0.08;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start();
    this.ambientNode = src;
    this.ambientGain = g;
  },
  shoot(kind) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    if (kind === 'heavy') {
      o.frequency.setValueAtTime(900, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(380, this.ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.0, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.18);
    } else if (kind === 'spread') {
      o.frequency.setValueAtTime(1500, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.07);
      g.gain.setValueAtTime(0.0, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);
    } else {
      o.frequency.setValueAtTime(1400, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.0, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);
    }
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + 0.2);
  },
  explosion() {
    if (!this.ctx) return;
    const len = 0.3;
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(len * sr), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, this.ctx.currentTime);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start();
  }
};
function damageFor(type) {
  if (type === 'rock') return 12;
  if (type === 'mushroom') return 16;
  return 8;
}

function getEnemyScore(type) {
  if (type === 'rock') return 15;
  if (type === 'mushroom') return 20;
  return 10;
}

function intersectsPlayer(e) {
  const px = player.x;
  const py = player.y;
  const pw = player.w;
  const ph = player.h;
  return px < e.x + e.w && px + pw > e.x && py < e.y + e.h && py + ph > e.y;
}

function drawOverlay() {
  ctx.fillStyle = 'rgba(10,15,26,0.6)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#cfe8ff';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', width / 2, height / 2 - 20);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Click para reiniciar', width / 2, height / 2 + 16);
}

function resetGame() {
  gameOver = false;
  level = 1;
  kills = 0;
  score = 0;
  player.hp = player.hpMax;
  player.iTime = 0;
  player.x = width * 0.2;
  player.y = groundY - player.h;
  enemies.length = 0;
  rays.length = 0;
  burst.length = 0;
}
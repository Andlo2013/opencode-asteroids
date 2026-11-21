'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Power-ups ─────────────────────────────────────────────────────────────────
const SPEED_MULT         = 2;     // propulsión al doble
const SPEED_DURATION     = 5;     // segundos de duración
const POWERUP_DROP_CHANCE = 0.2;  // probabilidad al destruir un asteroide
const POWERUP_TTL        = 12;    // segundos que permanece en el campo
const POWERUP_COLOR      = '#ffd23f';

// ── Triple disparo ───────────────────────────────────────────────────────────
const TRIPLE_DURATION = 5;        // segundos de duración
const TRIPLE_SPREAD   = 0.21;     // ±12° para las balas laterales
const TRIPLE_COLOR    = '#ff9f43';

// ── Escudo ────────────────────────────────────────────────────────────────────
const SHIELD_COLOR       = '#4dd2ff';  // cian, distinto del amarillo de velocidad
const SHIELD_RADIUS      = 26;         // radio de la burbuja
const SHIELD_GRACE       = 0.8;        // invencibilidad breve tras absorber el golpe

// ── Estrella fugaz ───────────────────────────────────────────────────────────
const SHOOTING_STAR_CHANCE     = 0.35;  // probabilidad de aparecer por nivel
const SHOOTING_STAR_SPEED_MULT = 2.6;   // multiplica la velocidad base
const SHOOTING_STAR_TTL        = 7;     // segundos de vida
const SHOOTING_STAR_BLINK      = 1.5;   // segundos de parpadeo final
const SHOOTING_STAR_POINTS     = 150;   // puntos al destruirla
const SHOOTING_STAR_COLOR      = '#ffd23f';

// ── Skins ─────────────────────────────────────────────────────────────────────
const SKIN_STORAGE_KEY = 'asteroids.skin';

const SKINS = [
  {
    name: 'CLÁSICA',
    color: '#fff',
    nose: 21,
    flame: { x: -8, spread: 4, color: 'rgba(255, 130, 0, 0.85)' },
    paths: [[
      [ 20,  0],   // nariz
      [-12, -9],   // ala izquierda
      [ -7,  0],   // muesca trasera
      [-12,  9],   // ala derecha
    ]],
  },
  {
    name: 'INTERCEPTOR',
    color: '#7df9ff',
    nose: 24,
    flame: { x: -7, spread: 3, color: 'rgba(95, 216, 255, 0.85)' },
    paths: [[
      [ 23,  0],   // nariz
      [  4, -4],
      [ -2,-12],   // ala izquierda
      [ -8, -6],
      [ -6,  0],   // muesca trasera
      [ -8,  6],
      [ -2, 12],   // ala derecha
      [  4,  4],
    ]],
  },
  {
    name: 'OVNI',
    color: '#9dff8a',
    nose: 17,
    flame: { x: -14, spread: 4, color: 'rgba(120, 255, 150, 0.85)' },
    paths: [
      [              // casco
        [ 16,  0],
        [ 11,  4],
        [  3,  6],
        [ -7,  6],
        [-14,  3],
        [-16,  0],
        [-14, -3],
        [ -7, -6],
        [  3, -6],
        [ 11, -4],
      ],
      [              // cúpula
        [  8,  0],
        [  6, -5],
        [ -1, -7],
        [ -8, -4],
        [ -8,  0],
      ],
    ],
  },
  {
    name: 'ESPECTRO',
    color: '#ff7bf2',
    nose: 22,
    flame: { x: -12, spread: 3, color: 'rgba(255, 90, 220, 0.85)' },
    paths: [[
      [ 21,  0],   // nariz
      [  2, -3],
      [ -4,-11],   // ala izquierda
      [ -9,-10],
      [ -6, -3],
      [-13,  0],   // cola
      [ -6,  3],
      [ -9, 10],   // ala derecha
      [ -4, 11],
      [  2,  3],
    ]],
  },
];

function loadSkin() {
  try {
    const saved = parseInt(localStorage.getItem(SKIN_STORAGE_KEY), 10);
    if (Number.isInteger(saved) && saved >= 0 && saved < SKINS.length) return saved;
  } catch (e) {
    // localStorage no disponible (por ejemplo, en algunos contextos file://)
  }
  return 0;
}

function saveSkin(index) {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, String(index));
  } catch (e) {
    // Sin persistencia: la skin sigue funcionando durante la sesión
  }
}

let skinIndex = loadSkin();

function strokeSkin(skin) {
  for (const pts of skin.paths) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++)
      ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
}

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = SKINS[skinIndex].color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3, shooting = false) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.shooting = shooting;
    this.radius = RADII[size];
    this.dead = false;
    this.ttl = shooting ? SHOOTING_STAR_TTL : Infinity;

    const angle = rand(0, Math.PI * 2);
    const speed = (SPEEDS[size] + rand(-15, 15)) * (shooting ? SHOOTING_STAR_SPEED_MULT : 1);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = shooting ? rand(-0.5, 0.5) : rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Forma: estrella de 5 puntas para la fugaz, polígono irregular para el resto
    if (shooting) {
      const spikes = 5;
      const inner  = 0.45;
      const step   = Math.PI / spikes;
      this.verts = [];
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? this.radius : this.radius * inner;
        const a = -Math.PI / 2 + i * step;
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    } else {
      const n = randInt(8, 13);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;

    if (this.shooting) {
      this.ttl -= dt;
      if (this.ttl <= 0) {
        this.dead = true;
        explode(this.x, this.y, 6);
      }
    }
  }

  split() {
    if (this.shooting || this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    if (this.dead) return;

    // Parpadeo de aviso en los últimos segundos de vida
    if (this.shooting && this.ttl <= SHOOTING_STAR_BLINK &&
        Math.floor(this.ttl * 10) % 2 === 0) return;

    if (this.shooting) this.drawTrail();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = this.shooting ? SHOOTING_STAR_COLOR : '#fff';
    ctx.lineWidth   = this.shooting ? 2 : 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  drawTrail() {
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const ux = this.vx / speed;
    const uy = this.vy / speed;
    const LEN = 46;

    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const from = LEN * (i / 3);
      const to   = LEN * ((i + 1) / 3);
      ctx.strokeStyle = `rgba(255, 210, 63, ${0.5 - i * 0.15})`;
      ctx.lineWidth   = 4 - i;
      ctx.beginPath();
      ctx.moveTo(this.x - ux * from, this.y - uy * from);
      ctx.lineTo(this.x - ux * to,   this.y - uy * to);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() {
    this.type = 'normal';
    this.reset();
  }

  get morada() { return this.type === 'morada'; }
  get scale()  { return this.morada ? 2 : 1; }
  get color()  { return this.morada ? '#a855f7' : '#fff'; }

  alternar() {
    this.type = this.morada ? 'normal' : 'morada';
    this.radius = 12 * this.scale;
  }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12 * this.scale;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.speedTimer    = 0;
    this.tripleTimer   = 0;
    this.shield        = false;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedTimer    > 0) this.speedTimer    -= dt;
    if (this.tripleTimer   > 0) this.tripleTimer   -= dt;

    const ROT    = 3.5;   // rad/s
    const THRUST = 260 * (this.speedTimer > 0 ? SPEED_MULT : 1);  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
<<<<<<< HEAD
    const NOSE = SKINS[skinIndex].nose;
=======
    const NOSE = 21 * this.scale;
>>>>>>> f9db52e75ef5917fe34e15c167b7aa885b5d96c9
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;

    // Triple disparo: una bala central y dos abiertas en abanico
    if (this.tripleTimer > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = SKINS[skinIndex];

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
<<<<<<< HEAD
    ctx.strokeStyle = skin.color;
=======
    ctx.scale(this.scale, this.scale);
    ctx.strokeStyle = this.color;
>>>>>>> f9db52e75ef5917fe34e15c167b7aa885b5d96c9
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Auras de los power-ups activos
    if (this.speedTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.speedTimer * 8) * 0.15;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (this.tripleTimer > 0) {
      ctx.strokeStyle = `rgba(255, 159, 67, ${0.35 + Math.sin(this.tripleTimer * 8) * 0.15})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = skin.color;
    ctx.lineWidth   = 1.5;

    // Silueta de la skin activa
    strokeSkin(skin);

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const flame = this.speedTimer > 0 ? rand(10, 22) : rand(6, 14);
      ctx.beginPath();
      ctx.moveTo(skin.flame.x, -skin.flame.spread);
      ctx.lineTo(skin.flame.x - flame, 0);
      ctx.lineTo(skin.flame.x, skin.flame.spread);
      ctx.strokeStyle = skin.flame.color;
      ctx.stroke();
    }

    // Burbuja del escudo
    if (this.shield) {
      const t = performance.now() * 0.006;
      const r = SHIELD_RADIUS + Math.sin(t) * 1.5;
      ctx.strokeStyle = `rgba(77, 210, 255, ${0.65 + Math.sin(t) * 0.2})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(77, 210, 255, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(77, 210, 255, 0.3)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-up ──────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type = 'speed') {
    this.x      = x;
    this.y      = y;
    this.type   = type;
    this.radius = 11;
    this.ttl    = POWERUP_TTL;
    this.dead   = false;
    this.color  = type === 'triple' ? TRIPLE_COLOR
                : type === 'shield' ? SHIELD_COLOR
                : POWERUP_COLOR;
    this.rgb    = type === 'triple' ? '255, 159, 67'
                : type === 'shield' ? '77, 210, 255'
                : '255, 210, 63';

    const angle = rand(0, Math.PI * 2);
    const speed = rand(18, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.pulse = rand(0, Math.PI * 2);
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.pulse += dt * 4;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const r = this.radius + Math.sin(this.pulse) * 1.5;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Halo
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.9);
    glow.addColorStop(0, `rgba(${this.rgb}, 0.45)`);
    glow.addColorStop(1, `rgba(${this.rgb}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Aro
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    if (this.type === 'triple') {
      // Tres disparos en abanico
      ctx.strokeStyle = this.color;
      for (const a of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 1, Math.sin(a) * 1);
        ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = this.color;
      if (this.type === 'shield') {
        // Escudo
        ctx.beginPath();
        ctx.moveTo( 0, -8);
        ctx.lineTo( 7, -5);
        ctx.lineTo( 7,  1);
        ctx.quadraticCurveTo( 7,  6, 0, 9);
        ctx.quadraticCurveTo(-7,  6, -7, 1);
        ctx.lineTo(-7, -5);
        ctx.closePath();
        ctx.fill();
      } else {
        // Rayo
        ctx.beginPath();
        ctx.moveTo( 2, -7);
        ctx.lineTo(-5,  1);
        ctx.lineTo(-1,  1);
        ctx.lineTo(-2,  7);
        ctx.lineTo( 5, -1);
        ctx.lineTo( 1, -1);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  const randomSpawn = () => {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    return [x, y];
  };

  for (let i = 0; i < count; i++) {
    const [x, y] = randomSpawn();
    asteroids.push(new Asteroid(x, y, 3));
  }

  // Estrella fugaz: bonus opcional que aparece al iniciar el nivel
  if (Math.random() < SHOOTING_STAR_CHANCE) {
    const [x, y] = randomSpawn();
    asteroids.push(new Asteroid(x, y, 2, true));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerups  = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Cambiar skin con S (funciona en cualquier estado)
  if (pressed('KeyS')) {
    skinIndex = (skinIndex + 1) % SKINS.length;
    saveSkin(skinIndex);
  }

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    powerups.forEach(p => p.update(dt));
    powerups = powerups.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    powerups.forEach(p => p.update(dt));
    powerups = powerups.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  if (pressed('KeyM')) ship.alternar();

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerups  = powerups.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
<<<<<<< HEAD
        score += a.shooting ? SHOOTING_STAR_POINTS : POINTS[a.size];
        explode(a.x, a.y, a.shooting ? 14 : a.size * 5);
        if (Math.random() < POWERUP_DROP_CHANCE) {
          const types = ['speed', 'triple', 'shield'];
          powerups.push(new PowerUp(a.x, a.y, types[randInt(0, types.length - 1)]));
        }
=======
        score += POINTS[a.size] * (ship.morada ? 2 : 1);
        explode(a.x, a.y, a.size * 5);
>>>>>>> f9db52e75ef5917fe34e15c167b7aa885b5d96c9
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'triple')      ship.tripleTimer = TRIPLE_DURATION;
      else if (p.type === 'shield') ship.shield = true;
      else                          ship.speedTimer = SPEED_DURATION;
      explode(p.x, p.y, 6);
    }
  }
  powerups = powerups.filter(p => !p.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    const shieldSplits = [];
    const hitRadius = ship.shield ? SHIELD_RADIUS : ship.radius;
    for (const a of asteroids) {
      if (dist(ship, a) < hitRadius + a.radius * 0.82) {
        if (ship.shield) {
          // El escudo absorbe un único impacto y se rompe
          ship.shield     = false;
          ship.invincible = SHIELD_GRACE;
          a.dead = true;
          score += a.shooting ? SHOOTING_STAR_POINTS : POINTS[a.size];
          explode(a.x, a.y, a.shooting ? 14 : a.size * 5);
          shieldSplits.push(...a.split());
        } else {
          killShip();
        }
        break;
      }
    }
    asteroids = asteroids.filter(a => !a.dead).concat(shieldSplits);
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const skin = SKINS[skinIndex];

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
<<<<<<< HEAD
  ctx.scale(0.5, 0.5);
  ctx.strokeStyle = skin.color;
  ctx.lineWidth   = 1.2 / 0.5;
=======
  ctx.strokeStyle = ship.morada ? '#a855f7' : '#fff';
  ctx.lineWidth   = 1.2;
>>>>>>> f9db52e75ef5917fe34e15c167b7aa885b5d96c9
  ctx.lineJoin    = 'round';
  strokeSkin(skin);
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

<<<<<<< HEAD
  ctx.textAlign = 'left';
  let hudY = H - 18;
  if (ship && ship.speedTimer > 0) {
    ctx.fillStyle = POWERUP_COLOR;
    ctx.fillText(`VELOCIDAD ${ship.speedTimer.toFixed(1)}s`, 14, hudY);
    hudY -= 20;
  }
  if (ship && ship.tripleTimer > 0) {
    ctx.fillStyle = TRIPLE_COLOR;
    ctx.fillText(`TRIPLE ${ship.tripleTimer.toFixed(1)}s`, 14, hudY);
    hudY -= 20;
  }
  if (ship && ship.shield) {
    ctx.fillStyle = SHIELD_COLOR;
    ctx.fillText('ESCUDO', 14, hudY);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = SKINS[skinIndex].color;
  ctx.fillText(`SKIN  ${SKINS[skinIndex].name}  [S]`, W - 14, H - 18);
=======
  ctx.font = '12px monospace';
  ctx.fillStyle = ship.morada ? '#c084fc' : 'rgba(255,255,255,0.55)';
  ctx.fillText(ship.morada ? 'NAVE MORADA — PUNTOS x2 (M PARA CAMBIAR)' : 'M: NAVE MORADA — PUNTOS x2', 14, 44);
>>>>>>> f9db52e75ef5917fe34e15c167b7aa885b5d96c9
}

function drawOverlay(title, sub, hint) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
  if (hint) {
    ctx.font      = '16px monospace';
    ctx.fillStyle = SKINS[skinIndex].color;
    ctx.fillText(hint, W / 2, H / 2 + 50);
  }
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  powerups.forEach(p => p.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`, 'S: CAMBIAR SKIN');
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);

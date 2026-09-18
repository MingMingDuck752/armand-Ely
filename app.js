const canvas = document.querySelector('#gameCanvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
const keys = new Set();
const pointer = { x: canvas.width / 2, y: canvas.height / 2 };
const fireTarget = { x: canvas.width / 2, y: canvas.height / 2, active: false };
const missiles = [];
const burstState = { active: false, shotsLeft: 0, timer: 0 };
const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1400;
const STATION_X = 1180;
const STATION_Y = 650;
const stationCollisionRects = [
  { x: -250, y: -120, width: 500, height: 240 },
  { x: -365, y: -125, width: 35, height: 70 },
  { x: -365, y: 55, width: 35, height: 70 },
  { x: 330, y: -125, width: 35, height: 250 },
  { x: -290, y: -30, width: 40, height: 60 },
  { x: 250, y: -30, width: 40, height: 60 },
  { x: -110, y: 200, width: 220, height: 60 },
  { x: -110, y: -260, width: 220, height: 60 },
];
const explosions = [];
const camera = { x: 0, y: 0 };
const headingReadout = document.querySelector('#headingReadout');
const speedReadout = document.querySelector('#speedReadout');
const driftReadout = document.querySelector('#driftReadout');
const lockReadout = document.querySelector('#lockReadout');
const hostileReadout = document.querySelector('#hostileReadout');
const threatReadout = document.querySelector('#threatReadout');
const reactorBar = document.querySelector('#reactorBar');
const reactorValue = document.querySelector('#reactorValue');
const sectorReadout = document.querySelector('#sectorReadout');
const missionSectorReadout = document.querySelector('#missionSectorReadout');
const stars = Array.from({ length: 520 }, (_, index) => ({
  x: (index * 191) % WORLD_WIDTH,
  y: (index * 97) % WORLD_HEIGHT,
  size: index % 17 === 0 ? 2 : index % 4 === 0 ? 1.5 : 1,
  glow: index % 7 === 0,
  layer: index % 3,
}));
const ship = {
  x: STATION_X - 360,
  y: STATION_Y,
  angle: Math.PI,
  speed: 0,
  strafe: 0,
  scale: 0.42,
  hitRadius: 45,
  docked: true,
};
const covenantCruiser = {
  active: false,
  spawned: false,
  x: 1660,
  y: 520,
  angle: Math.PI,
  speed: 42,
  hp: 100,
  maxHp: 100,
  hitRadius: 60,
  missileDamage: 1,
  waypointX: 1660,
  waypointY: 520,
  waypointTimer: 0,
};
let lastFrame = performance.now();
let elapsed = 0;
let fireCooldown = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeAngle = (angle) => (angle + Math.PI * 2) % (Math.PI * 2);
const pressed = (...names) => names.some((name) => keys.has(name));

function collidesWithCairoStation(x, y, radius = ship.hitRadius) {
  const localX = x - STATION_X;
  const localY = y - STATION_Y;

  return stationCollisionRects.some((rect) => {
    const closestX = clamp(localX, rect.x, rect.x + rect.width);
    const closestY = clamp(localY, rect.y, rect.y + rect.height);
    return Math.hypot(localX - closestX, localY - closestY) < radius;
  });
}

function moveShip(nextX, nextY) {
  const canMoveX = !collidesWithCairoStation(nextX, ship.y);
  const canMoveY = !collidesWithCairoStation(ship.x, nextY);

  if (canMoveX) ship.x = nextX;
  if (canMoveY) ship.y = nextY;
  if (!canMoveX || !canMoveY) ship.speed = 0;

  ship.docked = ship.x > STATION_X - 425 && ship.x < STATION_X - 250 && Math.abs(ship.y - STATION_Y) < 48;
}

function getCurrentSector() {
  const stationDistance = Math.hypot(ship.x - STATION_X, ship.y - STATION_Y);
  if (ship.docked || stationDistance < 460) return 'CAIRO STATION';
  if (ship.x < WORLD_WIDTH * 0.36) return 'DEBRIS RING';
  if (ship.x < WORLD_WIDTH * 0.72) return 'ION CHANNEL';
  return 'VOID GATE';
}

function updateCamera() {
  camera.x = clamp(ship.x - canvas.width / 2, 0, WORLD_WIDTH - canvas.width);
  camera.y = clamp(ship.y - canvas.height / 2, 0, WORLD_HEIGHT - canvas.height);
}

function fireMissileAtTarget() {
  fireTarget.x = pointer.x + camera.x;
  fireTarget.y = pointer.y + camera.y;
  fireTarget.active = true;

  const dx = fireTarget.x - ship.x;
  const dy = fireTarget.y - ship.y;
  const angle = Math.atan2(dy, dx);
  const speed = 520;

  missiles.push({
    x: ship.x,
    y: ship.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    damage: 10,
  });
}

function chooseCruiserWaypoint() {
  let waypointX = covenantCruiser.x;
  let waypointY = covenantCruiser.y;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    waypointX = clamp(covenantCruiser.x + (Math.random() - 0.5) * 600, 700, WORLD_WIDTH - 120);
    waypointY = clamp(covenantCruiser.y + (Math.random() - 0.5) * 500, 120, WORLD_HEIGHT - 120);
    if (!collidesWithCairoStation(waypointX, waypointY, covenantCruiser.hitRadius)) break;
  }
  covenantCruiser.waypointX = waypointX;
  covenantCruiser.waypointY = waypointY;
  covenantCruiser.waypointTimer = 3 + Math.random() * 3;
}

function spawnExplosion(x, y) {
  explosions.push({ x, y, age: 0, duration: 1.2 });
}

function updateCovenantCruiser(delta) {
  if (!covenantCruiser.active) {
    if (!covenantCruiser.spawned && elapsed >= 15) {
      covenantCruiser.spawned = true;
      covenantCruiser.active = true;
      chooseCruiserWaypoint();
    }
    return;
  }

  covenantCruiser.waypointTimer -= delta;
  const dx = covenantCruiser.waypointX - covenantCruiser.x;
  const dy = covenantCruiser.waypointY - covenantCruiser.y;
  if (covenantCruiser.waypointTimer <= 0 || Math.hypot(dx, dy) < 50) chooseCruiserWaypoint();

  const targetAngle = Math.atan2(dy, dx);
  let turn = targetAngle - covenantCruiser.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  covenantCruiser.angle += clamp(turn, -1, 1) * delta * 0.8;
  const thrustDirection = Math.abs(turn) <= Math.PI / 2 ? 1 : -1;
  const travelAngle = covenantCruiser.angle + (thrustDirection < 0 ? Math.PI : 0);
  const nextX = clamp(covenantCruiser.x + Math.cos(travelAngle) * covenantCruiser.speed * delta, 120, WORLD_WIDTH - 120);
  const nextY = clamp(covenantCruiser.y + Math.sin(travelAngle) * covenantCruiser.speed * delta, 120, WORLD_HEIGHT - 120);
  const canMoveX = !collidesWithCairoStation(nextX, covenantCruiser.y, covenantCruiser.hitRadius);
  const canMoveY = !collidesWithCairoStation(covenantCruiser.x, nextY, covenantCruiser.hitRadius);
  if (canMoveX) covenantCruiser.x = nextX;
  if (canMoveY) covenantCruiser.y = nextY;
  if (!canMoveX || !canMoveY) chooseCruiserWaypoint();
}

function checkCovenantCruiserHits() {
  if (!covenantCruiser.active) return;

  for (let index = missiles.length - 1; index >= 0; index -= 1) {
    const missile = missiles[index];
    if (Math.hypot(missile.x - covenantCruiser.x, missile.y - covenantCruiser.y) > covenantCruiser.hitRadius + missile.radius) continue;

    covenantCruiser.hp = Math.max(0, covenantCruiser.hp - missile.damage);
    missiles.splice(index, 1);
    if (covenantCruiser.hp === 0) {
      covenantCruiser.active = false;
      spawnExplosion(covenantCruiser.x, covenantCruiser.y);
      break;
    }
  }
}

function updateExplosions(delta) {
  for (let index = explosions.length - 1; index >= 0; index -= 1) {
    explosions[index].age += delta;
    if (explosions[index].age >= explosions[index].duration) explosions.splice(index, 1);
  }
}

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});
canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  if (fireCooldown > 0) return;

  fireCooldown = 3;
  burstState.active = true;
  burstState.shotsLeft = 4;
  burstState.timer = 0;

  fireMissileAtTarget();
  burstState.shotsLeft -= 1;
  burstState.timer = 0.12;

  if (burstState.shotsLeft <= 0) {
    burstState.active = false;
  }
});
window.addEventListener('keydown', (event) => { keys.add(event.key.toLowerCase()); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(event.key.toLowerCase())) event.preventDefault(); });
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

function update(delta) {
  fireCooldown = Math.max(0, fireCooldown - delta);

  if (burstState.active) {
    burstState.timer = Math.max(0, burstState.timer - delta);

    if (burstState.timer === 0 && burstState.shotsLeft > 0) {
      fireMissileAtTarget();
      burstState.shotsLeft -= 1;
      burstState.timer = 0.12;

      if (burstState.shotsLeft <= 0) {
        burstState.active = false;
      }
    }
  }

  const thrust = pressed('w', 'arrowup');
  const reverse = pressed('s', 'arrowdown');
  const turn = (pressed('d', 'arrowright') ? 1 : 0) - (pressed('a', 'arrowleft') ? 1 : 0);
  if (pressed('r')) { ship.speed = 0; ship.strafe = 0; ship.angle = -Math.PI / 2; }
  ship.angle += turn * delta * 2.4;
  ship.speed = thrust ? 150 : reverse ? -38 : 0;
  const nextX = clamp(ship.x + Math.cos(ship.angle) * ship.speed * delta, 40, WORLD_WIDTH - 40);
  const nextY = clamp(ship.y + Math.sin(ship.angle) * ship.speed * delta, 40, WORLD_HEIGHT - 40);
  moveShip(nextX, nextY);
  updateCovenantCruiser(delta);

  for (let index = missiles.length - 1; index >= 0; index -= 1) {
    const missile = missiles[index];
    missile.x += missile.vx * delta;
    missile.y += missile.vy * delta;

    if (missile.x < -30 || missile.x > WORLD_WIDTH + 30 || missile.y < -30 || missile.y > WORLD_HEIGHT + 30) {
      missiles.splice(index, 1);
    }
  }

  checkCovenantCruiserHits();
  updateExplosions(delta);

  updateCamera();
}

function drawBackground() {
  const sector = getCurrentSector();
  const palette = sector === 'CAIRO STATION'
    ? { base: '#071018', glowA: 'rgba(37, 98, 125, .3)', glowB: 'rgba(104, 74, 118, .2)', accent: '180, 224, 229', accentAlt: '222, 190, 125' }
    : sector === 'DEBRIS RING'
    ? { base: '#030a12', glowA: 'rgba(20, 87, 112, .34)', glowB: 'rgba(52, 43, 92, .18)', accent: '184, 220, 235', accentAlt: '218, 227, 201' }
    : sector === 'ION CHANNEL'
      ? { base: '#081319', glowA: 'rgba(31, 103, 147, .32)', glowB: 'rgba(91, 66, 142, .24)', accent: '152, 209, 255', accentAlt: '203, 165, 255' }
      : { base: '#110b12', glowA: 'rgba(142, 78, 124, .26)', glowB: 'rgba(74, 112, 153, .22)', accent: '255, 184, 198', accentAlt: '156, 203, 255' };

  context.fillStyle = palette.base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const blueCloud = context.createRadialGradient(180 - camera.x * 0.08, 410 - camera.y * 0.08, 10, 180 - camera.x * 0.08, 410 - camera.y * 0.08, 390);
  blueCloud.addColorStop(0, palette.glowA);
  blueCloud.addColorStop(1, 'rgba(3, 10, 18, 0)');
  context.fillStyle = blueCloud;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const violetCloud = context.createRadialGradient(850 - camera.x * 0.12, 90 - camera.y * 0.12, 5, 850 - camera.x * 0.12, 90 - camera.y * 0.12, 270);
  violetCloud.addColorStop(0, palette.glowB);
  violetCloud.addColorStop(1, 'rgba(3, 10, 18, 0)');
  context.fillStyle = violetCloud;
  context.fillRect(0, 0, canvas.width, canvas.height);

  stars.forEach((star) => {
    const screenX = star.x - camera.x;
    const screenY = star.y - camera.y;
    if (screenX < -20 || screenX > canvas.width + 20 || screenY < -20 || screenY > canvas.height + 20) return;

    const flicker = star.glow ? 0.48 + Math.sin(elapsed * 2 + star.x) * 0.28 : 0.45 + star.layer * 0.12;
    const tint = star.layer === 0 ? palette.accent : star.layer === 1 ? palette.accentAlt : '160, 199, 215';
    context.fillStyle = `rgba(${tint}, ${flicker})`;
    context.fillRect(Math.floor(screenX), Math.floor(screenY), star.size, star.size);
  });

  context.strokeStyle = 'rgba(127, 200, 190, .18)';
  context.lineWidth = 1;
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  if (Math.abs(ship.speed) > 0) {
    context.strokeStyle = 'rgba(124, 198, 216, .16)';
    context.lineWidth = 1;
    for (let index = 0; index < 12; index += 1) {
      const x = ((index * 89 + elapsed * ship.speed * 0.25) - camera.x) % (canvas.width + 160);
      const y = ((index * 47 + 30) - camera.y) % (canvas.height + 80);
      context.beginPath(); context.moveTo(x, y); context.lineTo(x - ship.speed * 0.08, y); context.stroke();
    }
  }
}
function drawCairoStation() {
  const stationX = STATION_X - camera.x;
  const stationY = STATION_Y - camera.y;

  context.save();
  context.translate(stationX, stationY);

  const drawBlock = (x, y, w, h, color, stroke = '#16272d') => {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.strokeRect(x, y, w, h);
  };

  context.fillStyle = 'rgba(120, 157, 175, 0.12)';
  context.beginPath();
  context.ellipse(0, 0, 370, 170, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#202f38';
  context.fillRect(-250, -120, 500, 240);

  context.fillStyle = '#283d47';
  context.fillRect(-220, -90, 440, 180);

  context.strokeStyle = '#96aeb3';
  context.lineWidth = 2;
  context.strokeRect(-220, -90, 440, 180);

  context.fillStyle = '#101c22';
  context.fillRect(-40, -170, 80, 290);
  context.fillRect(-290, -30, 580, 60);
  context.fillRect(-110, -210, 220, 50);

  context.fillStyle = '#405a62';
  context.fillRect(-185, -55, 370, 110);
  context.fillRect(-140, -145, 280, 40);

  context.fillStyle = '#8ea4a7';
  context.fillRect(-175, -45, 350, 18);
  context.fillRect(-175, 35, 350, 18);

  context.fillStyle = '#d5d7d2';
  context.fillRect(-160, -20, 320, 40);

  for (let index = -3; index <= 3; index += 1) {
    const px = index * 88;
    context.fillStyle = '#a7b6a8';
    context.fillRect(px - 8, -110, 16, 22);
    context.fillRect(px - 8, 88, 16, 22);
    context.fillStyle = '#d7e1d8';
    context.fillRect(px - 2, -104, 4, 10);
    context.fillRect(px - 2, 94, 4, 10);
  }

  drawBlock(-335, -75, 70, 150, '#1a2a32');
  drawBlock(265, -75, 70, 150, '#1a2a32');
  drawBlock(-365, -125, 35, 250, '#2b3f49');
  drawBlock(330, -125, 35, 250, '#2b3f49');

  context.fillStyle = '#0e1a20';
  for (let index = 0; index < 5; index += 1) {
    const x = -170 + index * 85;
    context.fillRect(x, -190, 40, 20);
    context.fillRect(x, 170, 40, 20);
  }

  context.fillStyle = '#d7bf7d';
  context.fillRect(-32, -150, 12, 44);
  context.fillRect(20, -150, 12, 44);
  context.fillRect(-32, 106, 12, 44);
  context.fillRect(20, 106, 12, 44);

  context.fillStyle = '#93c4c8';
  context.fillRect(-275, -5, 26, 10);
  context.fillRect(249, -5, 26, 10);

  context.fillStyle = '#0d161a';
  context.fillRect(-405, -5, 70, 10);
  context.fillRect(335, -5, 70, 10);
  context.fillRect(-8, -260, 16, 120);

  context.strokeStyle = '#758d90';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-325, 0);
  context.lineTo(-420, 0);
  context.moveTo(325, 0);
  context.lineTo(420, 0);
  context.stroke();

  context.fillStyle = '#121d21';
  context.fillRect(-95, -260, 190, 60);
  context.fillRect(-110, 200, 220, 60);

  context.fillStyle = '#2f4348';
  context.fillRect(-75, -245, 150, 28);
  context.fillRect(-75, 217, 150, 28);

  context.restore();
}
function drawAim() {
  const shipScreenX = ship.x - camera.x;
  const shipScreenY = ship.y - camera.y;
  context.save();
  context.strokeStyle = 'rgba(255, 80, 80, 0.96)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(shipScreenX, shipScreenY);
  context.lineTo(pointer.x, pointer.y);
  context.stroke();

  if (fireTarget.active) {
    const targetX = fireTarget.x - camera.x;
    const targetY = fireTarget.y - camera.y;
    context.beginPath();
    context.moveTo(targetX - 7, targetY);
    context.lineTo(targetX + 7, targetY);
    context.moveTo(targetX, targetY - 7);
    context.lineTo(targetX, targetY + 7);
    context.stroke();
  }

  context.beginPath();
  context.moveTo(pointer.x - 8, pointer.y);
  context.lineTo(pointer.x + 8, pointer.y);
  context.moveTo(pointer.x, pointer.y - 8);
  context.lineTo(pointer.x, pointer.y + 8);
  context.stroke();

  context.beginPath();
  context.arc(pointer.x, pointer.y, 4, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}
function drawMissiles() {
  context.save();
  missiles.forEach((missile) => {
    const screenX = missile.x - camera.x;
    const screenY = missile.y - camera.y;
    context.fillStyle = '#ffbb66';
    context.beginPath();
    context.arc(screenX, screenY, missile.radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = 'rgba(255, 170, 70, 0.7)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(screenX, screenY);
    context.lineTo(screenX - missile.vx * 0.03, screenY - missile.vy * 0.03);
    context.stroke();
  });
  context.restore();
}
function drawCovenantCruiser() {
  if (!covenantCruiser.active) return;

  const screenX = covenantCruiser.x - camera.x;
  const screenY = covenantCruiser.y - camera.y;
  context.save();
  context.translate(screenX, screenY);
  context.rotate(covenantCruiser.angle + Math.PI / 2);
  context.scale(0.42, 0.42);
  const pixel = (color, x, y, width, height) => { context.fillStyle = color; context.fillRect(x, y, width, height); };

  context.shadowColor = 'rgba(170, 72, 221, .55)';
  context.shadowBlur = 18;
  context.fillStyle = '#211331';
  context.beginPath();
  context.moveTo(0, -178);
  context.lineTo(22, -148);
  context.lineTo(31, -83);
  context.lineTo(61, -28);
  context.lineTo(54, 30);
  context.lineTo(35, 86);
  context.lineTo(25, 151);
  context.lineTo(0, 176);
  context.lineTo(-25, 151);
  context.lineTo(-35, 86);
  context.lineTo(-54, 30);
  context.lineTo(-61, -28);
  context.lineTo(-31, -83);
  context.lineTo(-22, -148);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;

  pixel('#3d1f54', -18, -155, 36, 70);
  pixel('#57256f', -25, -98, 50, 118);
  pixel('#743480', -31, -24, 62, 90);
  pixel('#9f4eb0', -37, -8, 74, 39);
  pixel('#532560', -25, 36, 50, 66);
  pixel('#2c183e', -21, 92, 42, 72);
  pixel('#4b2060', -14, 130, 28, 39);
  pixel('#a95bc0', -7, -164, 14, 48);
  pixel('#b860c8', -8, -71, 16, 26);
  pixel('#c873d2', -26, -2, 52, 10);
  pixel('#bd6dce', -23, 9, 46, 8);
  pixel('#1a1329', -38, -51, 10, 74);
  pixel('#1a1329', 28, -51, 10, 74);
  pixel('#d394d5', -4, -143, 8, 19);
  pixel('#d394d5', -4, 113, 8, 29);
  pixel('#dfb3d9', -5, -118, 10, 8);
  pixel('#ddafd9', -4, 17, 8, 8);
  pixel('#d59adb', -42, -6, 8, 18);
  pixel('#d59adb', 34, -6, 8, 18);
  pixel('#53d9ea', -4, -151, 8, 7);
  pixel('#53d9ea', -4, -42, 8, 7);
  pixel('#53d9ea', -4, 67, 8, 7);
  context.restore();

  context.fillStyle = 'rgba(10, 12, 20, .85)';
  context.fillRect(screenX - 52, screenY - 55, 104, 6);
  context.fillStyle = '#c56d76';
  context.fillRect(screenX - 51, screenY - 54, 102 * (covenantCruiser.hp / covenantCruiser.maxHp), 4);
  context.fillStyle = '#d8b69a';
  context.font = '10px Share Tech Mono, monospace';
  context.textAlign = 'center';
  context.fillText('CSS COVENANT CRUISER', screenX, screenY - 64);
}
function drawExplosions() {
  explosions.forEach((explosion) => {
    const progress = explosion.age / explosion.duration;
    const radius = 16 + progress * 82;
    const screenX = explosion.x - camera.x;
    const screenY = explosion.y - camera.y;
    context.save();
    context.globalAlpha = 1 - progress;
    context.strokeStyle = '#e8b27f';
    context.lineWidth = 7 - progress * 5;
    context.beginPath();
    context.arc(screenX, screenY, radius, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#f2d09a';
    context.fillRect(screenX - 5, screenY - 5, 10, 10);
    context.restore();
  });
}
function drawShip() {
  const shipScreenX = ship.x - camera.x;
  const shipScreenY = ship.y - camera.y;
  context.save();
  context.translate(shipScreenX, shipScreenY);
  context.rotate(ship.angle);
  context.scale(ship.scale, ship.scale);
  const pixel = (color, x, y, width, height) => { context.fillStyle = color; context.fillRect(x, y, width, height); };

  if (ship.speed > 0) {
    pixel('#6daebe', -123, -55, 48, 6); pixel('#c9f0ee', -110, -47, 32, 3);
    pixel('#6daebe', -123, 49, 48, 6); pixel('#c9f0ee', -110, 44, 32, 3);
  } else if (ship.speed < 0) {
    pixel('#6d9dab', -121, -55, 10, 6); pixel('#6d9dab', -121, 49, 10, 6);
  }

  // The center hull is stepped in block tiers rather than tapered.
  pixel('#0e171c', -123, -24, 268, 48);
  pixel('#0e171c', -96, -31, 200, 62);
  pixel('#0e171c', -62, -38, 104, 76);
  pixel('#243137', -112, -17, 246, 34);
  pixel('#2c393d', -87, -24, 181, 48);
  pixel('#354449', -53, -31, 86, 62);

  // Armored pylons visibly bridge the gap between the hull and engine pods.
  pixel('#0e171c', -76, -49, 18, 27); pixel('#0e171c', -28, -49, 18, 27);
  pixel('#0e171c', -76, 22, 18, 27); pixel('#0e171c', -28, 22, 18, 27);
  pixel('#596761', -71, -47, 9, 25); pixel('#596761', -23, -47, 9, 25);
  pixel('#596761', -71, 22, 9, 25); pixel('#596761', -23, 22, 9, 25);
  pixel('#172328', -62, -43, 37, 7); pixel('#172328', -62, 36, 37, 7);
  // Detached engine pods give the ship the broad lower-left reference silhouette.
  pixel('#111a1f', -88, -69, 72, 23); pixel('#111a1f', -88, 46, 72, 23);
  pixel('#26353a', -80, -64, 76, 14); pixel('#26353a', -80, 50, 76, 14);
  pixel('#53605d', -70, -60, 46, 5); pixel('#53605d', -70, 55, 46, 5);
  pixel('#121c21', -76, -49, 58, 6); pixel('#121c21', -76, 43, 58, 6);
  pixel('#728078', -53, -68, 5, 17); pixel('#728078', -53, 51, 5, 17);
  pixel('#d5ddc6', -80, -62, 4, 4); pixel('#d5ddc6', -69, -62, 4, 4); pixel('#d5ddc6', -80, 58, 4, 4); pixel('#d5ddc6', -69, 58, 4, 4);
  pixel('#79c0ca', -90, -62, 8, 5); pixel('#79c0ca', -90, 57, 8, 5);
  // Long armored centerline with stepped shoulders and no pointed taper.
  pixel('#718079', -98, -10, 218, 20); pixel('#aab5a7', -66, -7, 174, 14); pixel('#d2d6bd', 21, -5, 66, 10);
  pixel('#3c494b', -98, -7, 30, 14); pixel('#1b272c', -77, -4, 56, 8); pixel('#182328', 25, -10, 8, 20);
  pixel('#596761', -59, -17, 6, 34); pixel('#596761', -12, -19, 6, 38); pixel('#596761', 32, -15, 5, 30);
  pixel('#79c0ca', 78, -4, 25, 8); pixel('#d8f2e7', 101, -2, 12, 4);
  // Bridge block, dorsal machinery, and top-down deck lights.
  pixel('#121d22', -21, -28, 42, 56); pixel('#65746d', -14, -23, 28, 46); pixel('#a9b6a5', -6, -31, 17, 9);
  pixel('#26383c', -7, -24, 14, 12); pixel('#18252a', -6, -7, 13, 25); pixel('#c1cbb5', 15, -12, 12, 24);
  pixel('#8fd3c5', -3, -20, 4, 4); pixel('#8fd3c5', 4, -20, 4, 4); pixel('#8fd3c5', -3, 16, 4, 4); pixel('#8fd3c5', 4, 16, 4, 4);
  pixel('#d9e1ca', -42, -13, 4, 4); pixel('#d9e1ca', -42, 9, 4, 4); pixel('#d9e1ca', 45, -11, 4, 4); pixel('#d9e1ca', 45, 7, 4, 4);
  context.restore();
}
function render() {
  drawBackground();
  const sector = getCurrentSector();
  drawCairoStation();
  drawCovenantCruiser();
  drawAim();
  drawMissiles();
  drawExplosions();
  drawShip();

  const heading = Math.round(normalizeAngle(ship.angle) * 180 / Math.PI);
  const speed = Math.round(Math.abs(ship.speed));
  const drift = (Math.abs(ship.speed) / 280 + 0.2).toFixed(1);
  const reactor = Math.round(62 + Math.min(Math.abs(ship.speed) / 4, 30));

  headingReadout.textContent = `${String(heading).padStart(3, '0')}°`;
  speedReadout.textContent = String(speed).padStart(3, '0');
  driftReadout.textContent = drift;
  lockReadout.textContent = ship.docked ? 'DOCKED' : 'CLEAR';
  reactorBar.style.width = `${reactor}%`;
  reactorValue.textContent = reactor;
  sectorReadout.textContent = sector;
  missionSectorReadout.textContent = sector;
  hostileReadout.textContent = covenantCruiser.active
    ? 'CSS CRUISER'
    : covenantCruiser.spawned
      ? 'DESTROYED'
      : `INBOUND ${Math.ceil(Math.max(0, 15 - elapsed))}S`;
  threatReadout.textContent = covenantCruiser.active ? 'MEDIUM' : 'LOW';
}
function frame(now) { const delta = Math.min((now - lastFrame) / 1000, 0.05); lastFrame = now; elapsed += delta; update(delta); render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

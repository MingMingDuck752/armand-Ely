const canvas = document.querySelector('#gameCanvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
const keys = new Set();
const pointer = { x: canvas.width / 2, y: canvas.height / 2 };
const fireTarget = { x: canvas.width / 2, y: canvas.height / 2, active: false };
const missiles = [];
const headingReadout = document.querySelector('#headingReadout');
const speedReadout = document.querySelector('#speedReadout');
const reactorBar = document.querySelector('#reactorBar');
const reactorValue = document.querySelector('#reactorValue');
const stars = Array.from({ length: 320 }, (_, index) => ({
  x: (index * 193) % canvas.width,
  y: (index * 83) % canvas.height,
  size: index % 17 === 0 ? 2 : index % 4 === 0 ? 1.5 : 1,
  glow: index % 7 === 0,
  layer: index % 3,
}));
const ship = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  angle: -Math.PI / 2,
  speed: 0,
  strafe: 0,
  scale: 0.45,
  hitRadius: 63,
};
let lastFrame = performance.now();
let elapsed = 0;
let fireCooldown = 0;

const normalizeAngle = (angle) => (angle + Math.PI * 2) % (Math.PI * 2);
const pressed = (...names) => names.some((name) => keys.has(name));
canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});
canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  if (fireCooldown > 0) return;

  fireTarget.x = pointer.x;
  fireTarget.y = pointer.y;
  fireTarget.active = true;

  const dx = fireTarget.x - ship.x;
  const dy = fireTarget.y - ship.y;
  const distance = Math.hypot(dx, dy) || 1;
  const baseAngle = Math.atan2(dy, dx);

  for (let index = 0; index < 4; index += 1) {
    const spreadOffset = (index - 1.5) * 0.22;
    const angle = baseAngle + spreadOffset;
    const speed = 520;

    missiles.push({
      x: ship.x,
      y: ship.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 4,
    });
  }

  fireCooldown = 3;
});
window.addEventListener('keydown', (event) => { keys.add(event.key.toLowerCase()); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(event.key.toLowerCase())) event.preventDefault(); });
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

function update(delta) {
  fireCooldown = Math.max(0, fireCooldown - delta);

  const thrust = pressed('w', 'arrowup');
  const reverse = pressed('s', 'arrowdown');
  const turn = (pressed('d', 'arrowright') ? 1 : 0) - (pressed('a', 'arrowleft') ? 1 : 0);
  if (pressed('r')) { ship.speed = 0; ship.strafe = 0; ship.angle = -Math.PI / 2; }
  ship.angle += turn * delta * 2.4;
  ship.speed = thrust ? 150 : reverse ? -38 : 0;
  ship.x += Math.cos(ship.angle) * ship.speed * delta;
  ship.y += Math.sin(ship.angle) * ship.speed * delta;
  ship.x = (ship.x + canvas.width) % canvas.width; ship.y = (ship.y + canvas.height) % canvas.height;

  for (let index = missiles.length - 1; index >= 0; index -= 1) {
    const missile = missiles[index];
    missile.x += missile.vx * delta;
    missile.y += missile.vy * delta;

    if (missile.x < -30 || missile.x > canvas.width + 30 || missile.y < -30 || missile.y > canvas.height + 30) {
      missiles.splice(index, 1);
    }
  }
}

function drawBackground() {
  context.fillStyle = '#030a12';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const blueCloud = context.createRadialGradient(180, 410, 10, 180, 410, 390);
  blueCloud.addColorStop(0, 'rgba(20, 87, 112, .34)');
  blueCloud.addColorStop(1, 'rgba(3, 10, 18, 0)');
  context.fillStyle = blueCloud;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const violetCloud = context.createRadialGradient(850, 90, 5, 850, 90, 270);
  violetCloud.addColorStop(0, 'rgba(52, 43, 92, .18)');
  violetCloud.addColorStop(1, 'rgba(3, 10, 18, 0)');
  context.fillStyle = violetCloud;
  context.fillRect(0, 0, canvas.width, canvas.height);
  stars.forEach((star) => {
    const flicker = star.glow ? 0.48 + Math.sin(elapsed * 2 + star.x) * 0.28 : 0.45 + star.layer * 0.12;
    const tint = star.layer === 0 ? '184, 220, 235' : star.layer === 1 ? '218, 227, 201' : '125, 184, 212';
    context.fillStyle = `rgba(${tint}, ${flicker})`;
    context.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
  });
  if (Math.abs(ship.speed) > 0) {
    context.strokeStyle = 'rgba(124, 198, 216, .16)';
    context.lineWidth = 1;
    for (let index = 0; index < 12; index += 1) {
      const x = (index * 89 + elapsed * ship.speed * 0.25) % canvas.width;
      const y = (index * 47 + 30) % canvas.height;
      context.beginPath(); context.moveTo(x, y); context.lineTo(x - ship.speed * 0.08, y); context.stroke();
    }
  }
}
function drawPlanet() { context.save(); context.translate(795, 460); context.fillStyle = 'rgba(11, 42, 55, .65)'; context.beginPath(); context.arc(0, 0, 100, 0, Math.PI * 2); context.fill(); context.strokeStyle = 'rgba(79, 176, 180, .22)'; context.lineWidth = 3; context.beginPath(); context.ellipse(0, 0, 150, 27, -0.18, 0, Math.PI * 2); context.stroke(); context.fillStyle = '#184252'; context.beginPath(); context.arc(-25, -20, 70, 0, Math.PI * 2); context.fill(); context.fillStyle = 'rgba(117, 209, 193, .14)'; context.fillRect(-45, -35, 35, 9); context.fillRect(15, 18, 50, 7); context.restore(); }
function drawAim() {
  context.save();
  context.strokeStyle = 'rgba(255, 80, 80, 0.96)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(ship.x, ship.y);
  context.lineTo(pointer.x, pointer.y);
  context.stroke();

  if (fireTarget.active) {
    context.beginPath();
    context.moveTo(fireTarget.x - 7, fireTarget.y);
    context.lineTo(fireTarget.x + 7, fireTarget.y);
    context.moveTo(fireTarget.x, fireTarget.y - 7);
    context.lineTo(fireTarget.x, fireTarget.y + 7);
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
    context.fillStyle = '#ffbb66';
    context.beginPath();
    context.arc(missile.x, missile.y, missile.radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = 'rgba(255, 170, 70, 0.7)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(missile.x, missile.y);
    context.lineTo(missile.x - missile.vx * 0.03, missile.y - missile.vy * 0.03);
    context.stroke();
  });
  context.restore();
}
function drawShip() {
  context.save();
  context.translate(ship.x, ship.y);
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
function render() { drawBackground(); drawPlanet(); drawAim(); drawMissiles(); drawShip(); headingReadout.textContent = `${String(Math.round(normalizeAngle(ship.angle) * 180 / Math.PI)).padStart(3, '0')}°`; speedReadout.textContent = String(Math.round(Math.abs(ship.speed))).padStart(3, '0'); const reactor = Math.round(62 + Math.min(Math.abs(ship.speed) / 4, 30)); reactorBar.style.width = `${reactor}%`; reactorValue.textContent = reactor; }
function frame(now) { const delta = Math.min((now - lastFrame) / 1000, 0.05); lastFrame = now; elapsed += delta; update(delta); render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

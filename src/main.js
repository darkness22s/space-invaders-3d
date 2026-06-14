import * as THREE from "three";

const canvas = document.querySelector("#game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03040a);
scene.fog = new THREE.FogExp2(0x03040a, 0.008);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2500);
camera.position.set(0, 4.4, 16);

const clock = new THREE.Clock();
const keys = new Set();
const lasers = [];
const invaders = [];
const planets = [];
const stars = [];

const state = {
  hull: 100,
  xp: 0,
  wave: 1,
  solarShield: 100,
  enginePower: 65,
  shipIndex: 0,
  mode: "Patrol",
  landedPlanet: null,
  waveDelay: 0,
  fireCooldown: 0,
  upgradeLevel: 0,
};

const ships = [
  { name: "Vanguard", speed: 26, hull: 100, laser: 1, color: 0x87d8ff },
  { name: "Warden", speed: 20, hull: 150, laser: 1, color: 0xf4c66a },
  { name: "Needle", speed: 34, hull: 82, laser: 1.25, color: 0x9affd1 },
];

const tasks = [
  { title: "Download navigation update", xp: 18, delay: 8 },
  { title: "Balance shield capacitors", xp: 22, delay: 10 },
  { title: "Refill maneuver fuel", xp: 16, delay: 7 },
];

const planetTasks = [
  "Scan magnetic storms",
  "Repair ground relay",
  "Calibrate mineral beacon",
  "Restore orbital weather feed",
];

const ui = {
  hull: document.querySelector("#hull"),
  xp: document.querySelector("#xp"),
  wave: document.querySelector("#wave"),
  engine: document.querySelector("#engine"),
  shipName: document.querySelector("#ship-name"),
  mode: document.querySelector("#mode"),
  shield: document.querySelector("#shield"),
  taskTitle: document.querySelector("#task-title"),
  taskCopy: document.querySelector("#task-copy"),
  taskList: document.querySelector("#task-list"),
  radarBlips: document.querySelector("#radar-blips"),
  enginePower: document.querySelector("#engine-power"),
};

const sunLight = new THREE.PointLight(0xfff2bc, 4.2, 1800, 1.2);
sunLight.castShadow = true;
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x5d7caa, 0.28));

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(10, 48, 48),
  new THREE.MeshBasicMaterial({ color: 0xffd36d })
);
scene.add(sun);

const ship = new THREE.Group();
ship.position.set(42, 3, 14);
scene.add(ship);

const shipHull = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.7, 3.2, 10, 24),
  new THREE.MeshStandardMaterial({
    color: ships[state.shipIndex].color,
    metalness: 0.82,
    roughness: 0.24,
  })
);
shipHull.rotation.z = Math.PI / 2;
shipHull.castShadow = true;
ship.add(shipHull);

const cockpitGlass = new THREE.Mesh(
  new THREE.SphereGeometry(0.78, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshPhysicalMaterial({
    color: 0x9fe8ff,
    transparent: true,
    opacity: 0.38,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.25,
  })
);
cockpitGlass.position.set(0.4, 0.46, 0);
cockpitGlass.scale.set(1.2, 0.7, 0.9);
ship.add(cockpitGlass);

for (const z of [-0.95, 0.95]) {
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.12, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x233142, metalness: 0.7, roughness: 0.3 })
  );
  wing.position.set(-0.55, -0.16, z);
  wing.castShadow = true;
  ship.add(wing);
}

const cockpitFrame = new THREE.Group();
camera.add(cockpitFrame);
scene.add(camera);
createCockpitInterior();

createStarfield();
createPlanets();
spawnWave();
renderTasks();
updateUi();

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") fireLaser();
  if (event.code === "KeyE") landOrTask();
  if (event.code === "KeyQ") cycleShip();
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("resize", resize);
document.querySelector("#fire").addEventListener("click", fireLaser);
document.querySelector("#land").addEventListener("click", landOrTask);
document.querySelector("#cycle-ship").addEventListener("click", cycleShip);
document.querySelector("#upgrade").addEventListener("click", upgradeShip);
ui.enginePower.addEventListener("input", (event) => {
  state.enginePower = Number(event.target.value);
  updateUi();
});

function createStarfield() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 1800; i += 1) {
    const radius = 520 + Math.random() * 1200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xd7ecff, size: 1.4, sizeAttenuation: true })
  );
  scene.add(points);
  stars.push(points);
}

function createPlanets() {
  const data = [
    ["Mercury", 0xb5a895, 22, 1.6, 0.018, "cratered iron ridges"],
    ["Venus", 0xd8b26c, 34, 2.6, 0.012, "acid cloud observatories"],
    ["Earth", 0x3f86d7, 48, 2.8, 0.01, "ocean defense stations"],
    ["Mars", 0xb9553a, 63, 2.1, 0.008, "dust relay towers"],
    ["Jupiter", 0xd6a56b, 86, 5.7, 0.006, "storm platform arrays"],
    ["Saturn", 0xd7c28a, 112, 4.8, 0.0048, "ring mining docks"],
    ["Uranus", 0x87d7d5, 138, 3.9, 0.0038, "ice sensor fields"],
    ["Neptune", 0x315dd1, 162, 3.8, 0.0032, "deep wind anchors"],
  ];

  for (const [name, color, orbit, size, speed, detail] of data) {
    const pivot = new THREE.Group();
    scene.add(pivot);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(size, 48, 32),
      makePlanetMaterial(color)
    );
    planet.position.x = orbit;
    planet.castShadow = true;
    planet.receiveShadow = true;
    planet.userData = { name, detail, orbit, speed, size, pivot };
    pivot.add(planet);

    const orbitLine = new THREE.Mesh(
      new THREE.TorusGeometry(orbit, 0.015, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0x35536b, transparent: true, opacity: 0.34 })
    );
    orbitLine.rotation.x = Math.PI / 2;
    scene.add(orbitLine);

    if (name === "Saturn") {
      const rings = new THREE.Mesh(
        new THREE.TorusGeometry(size * 1.55, 0.08, 10, 96),
        new THREE.MeshBasicMaterial({ color: 0xe8d7aa, transparent: true, opacity: 0.7 })
      );
      rings.rotation.x = Math.PI / 2.35;
      planet.add(rings);
    }

    planets.push(planet);
  }
}

function makePlanetMaterial(baseColor) {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 256;
  canvasTexture.height = 128;
  const ctx = canvasTexture.getContext("2d");
  ctx.fillStyle = `#${baseColor.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);
  for (let i = 0; i < 260; i += 1) {
    const light = 70 + Math.random() * 90;
    ctx.fillStyle = `rgba(${light}, ${light}, ${light}, ${0.04 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 256,
      Math.random() * 128,
      2 + Math.random() * 22,
      1 + Math.random() * 7,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvasTexture);
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.82,
    metalness: 0.02,
  });
}

function createCockpitInterior() {
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x111923, metalness: 0.55, roughness: 0.38 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x51ffd0 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.1, 0.35), panelMat);
  dash.position.set(0, -2.2, -4.1);
  cockpitFrame.add(dash);

  for (let i = 0; i < 9; i += 1) {
    const button = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.04), glowMat);
    button.position.set(-3 + i * 0.75, -1.72 + (i % 2) * 0.18, -3.88);
    cockpitFrame.add(button);
  }

  const throttle = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.2, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xdad7ca, metalness: 0.7, roughness: 0.22 })
  );
  throttle.position.set(-3.55, -1.6, -3.65);
  throttle.rotation.z = -0.42;
  cockpitFrame.add(throttle);
}

function spawnWave() {
  const count = 4 + state.wave * 2;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const distance = 130 + Math.random() * 80;
    const invader = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.15, 1),
      new THREE.MeshStandardMaterial({
        color: 0xff3d66,
        emissive: 0x450717,
        metalness: 0.35,
        roughness: 0.46,
      })
    );
    invader.add(body);
    invader.position.set(Math.cos(angle) * distance, -6 + Math.random() * 16, Math.sin(angle) * distance);
    invader.userData = { hp: 3, speed: 4.2 + state.wave * 0.35, target: planets[i % planets.length] };
    scene.add(invader);
    invaders.push(invader);
  }
}

function fireLaser() {
  if (state.fireCooldown > 0 || state.landedPlanet) return;
  state.fireCooldown = 0.18;
  const laser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4.8, 10),
    new THREE.MeshBasicMaterial({ color: 0x61fff0 })
  );
  laser.rotation.z = Math.PI / 2;
  laser.position.copy(ship.position).add(new THREE.Vector3(2.6, 0, 0).applyQuaternion(ship.quaternion));
  laser.quaternion.copy(ship.quaternion);
  laser.userData = { velocity: new THREE.Vector3(1, 0, 0).applyQuaternion(ship.quaternion).multiplyScalar(130) };
  scene.add(laser);
  lasers.push(laser);
}

function cycleShip() {
  state.shipIndex = (state.shipIndex + 1) % ships.length;
  const selected = ships[state.shipIndex];
  shipHull.material.color.setHex(selected.color);
  state.hull = Math.min(selected.hull + state.upgradeLevel * 15, selected.hull);
  updateUi();
}

function upgradeShip() {
  if (state.xp < 50) return;
  state.xp -= 50;
  state.upgradeLevel += 1;
  state.hull = Math.min(ships[state.shipIndex].hull + state.upgradeLevel * 20, state.hull + 25);
  state.solarShield = Math.min(100, state.solarShield + 10);
  updateUi();
}

function landOrTask() {
  if (state.landedPlanet) {
    completeTask(`Survey ${state.landedPlanet.userData.name} surface`, 28, 14);
    state.landedPlanet = null;
    state.mode = "Patrol";
    renderTasks();
    updateUi();
    return;
  }

  const nearest = planets
    .map((planet) => ({ planet, distance: planet.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position) }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (nearest && nearest.distance < nearest.planet.userData.size + 11) {
    state.landedPlanet = nearest.planet;
    state.mode = `Landed: ${nearest.planet.userData.name}`;
    renderTasks();
    updateUi();
  }
}

function completeTask(title, xp, delay) {
  state.xp += xp;
  state.waveDelay += delay;
  state.solarShield = Math.min(100, state.solarShield + 4);
  state.mode = `${title} complete`;
  updateUi();
}

function renderTasks() {
  ui.taskList.innerHTML = "";
  const availableTasks = state.landedPlanet
    ? planetTasks.map((title, index) => ({
        title,
        xp: 24 + index * 3,
        delay: 10 + index * 2,
      }))
    : tasks;

  ui.taskTitle.textContent = state.landedPlanet
    ? `${state.landedPlanet.userData.name} Surface`
    : "Onboard Tasks";
  ui.taskCopy.textContent = state.landedPlanet
    ? `Work on ${state.landedPlanet.userData.detail}. Completing one task delays invader waves.`
    : "Complete ship tasks to earn XP and delay the next invader wave.";

  for (const task of availableTasks) {
    const row = document.createElement("div");
    row.className = "task";
    const label = document.createElement("span");
    label.textContent = task.title;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `+${task.xp} XP`;
    button.addEventListener("click", () => completeTask(task.title, task.xp, task.delay));
    row.append(label, button);
    ui.taskList.append(row);
  }
}

function updateUi() {
  const selected = ships[state.shipIndex];
  ui.hull.textContent = Math.max(0, Math.round(state.hull));
  ui.xp.textContent = Math.round(state.xp);
  ui.wave.textContent = state.wave;
  ui.engine.textContent = `${state.enginePower}%`;
  ui.shipName.textContent = selected.name;
  ui.mode.textContent = state.mode;
  ui.shield.textContent = `${Math.max(0, Math.round(state.solarShield))}%`;
}

function updateRadar() {
  ui.radarBlips.innerHTML = "";
  for (const invader of invaders.slice(0, 20)) {
    const delta = invader.position.clone().sub(ship.position);
    const scale = 0.34;
    const blip = document.createElement("span");
    blip.className = "blip";
    blip.style.left = `${50 + THREE.MathUtils.clamp(delta.x * scale, -45, 45)}%`;
    blip.style.top = `${50 + THREE.MathUtils.clamp(delta.z * scale, -45, 45)}%`;
    ui.radarBlips.append(blip);
  }
}

function updatePlayer(delta) {
  const selected = ships[state.shipIndex];
  const thrust = selected.speed * (state.enginePower / 100) * delta;
  const direction = new THREE.Vector3();
  if (keys.has("KeyW")) direction.x += 1;
  if (keys.has("KeyS")) direction.x -= 1;
  if (keys.has("KeyA")) direction.z -= 1;
  if (keys.has("KeyD")) direction.z += 1;
  if (keys.has("ShiftLeft")) direction.y += 1;
  if (keys.has("ControlLeft")) direction.y -= 1;
  direction.normalize().multiplyScalar(thrust);
  ship.position.add(direction);

  const lookTarget = ship.position.clone().add(new THREE.Vector3(1, 0, 0));
  if (direction.lengthSq() > 0) lookTarget.copy(ship.position).add(direction.clone().normalize());
  ship.lookAt(lookTarget);
  camera.position.lerp(ship.position.clone().add(new THREE.Vector3(-7, 4.2, 9)), 0.08);
  camera.lookAt(ship.position.clone().add(new THREE.Vector3(8, 0.5, 0)));
}

function updateWorld(delta) {
  sun.rotation.y += delta * 0.06;
  for (const planet of planets) {
    planet.userData.pivot.rotation.y += planet.userData.speed * delta;
    planet.rotation.y += delta * 0.2;
  }

  for (let i = lasers.length - 1; i >= 0; i -= 1) {
    const laser = lasers[i];
    laser.position.addScaledVector(laser.userData.velocity, delta);
    if (laser.position.length() > 700) removeFromArray(lasers, laser);
  }

  for (let i = invaders.length - 1; i >= 0; i -= 1) {
    const invader = invaders[i];
    const targetPosition = invader.userData.target.getWorldPosition(new THREE.Vector3());
    const toTarget = targetPosition.sub(invader.position).normalize();
    invader.position.addScaledVector(toTarget, invader.userData.speed * delta);
    invader.rotation.x += delta * 1.8;
    invader.rotation.y += delta * 1.2;

    if (invader.position.distanceTo(ship.position) < 3.2) {
      state.hull -= 8 * delta;
    }

    if (invader.position.distanceTo(invader.userData.target.getWorldPosition(new THREE.Vector3())) < 4.5) {
      state.solarShield -= 6 * delta;
    }

    for (const laser of lasers) {
      if (laser.position.distanceTo(invader.position) < 2.2) {
        invader.userData.hp -= ships[state.shipIndex].laser;
        scene.remove(laser);
        lasers.splice(lasers.indexOf(laser), 1);
        if (invader.userData.hp <= 0) {
          state.xp += 10;
          scene.remove(invader);
          invaders.splice(i, 1);
        }
        break;
      }
    }
  }

  if (invaders.length === 0) {
    state.waveDelay -= delta;
    if (state.waveDelay <= 0) {
      state.wave += 1;
      state.mode = "Incoming wave";
      spawnWave();
    } else {
      state.mode = "Wave delayed";
    }
  }

  state.fireCooldown = Math.max(0, state.fireCooldown - delta);
  if (state.hull <= 0 || state.solarShield <= 0) {
    state.mode = "Emergency reset";
    state.hull = ships[state.shipIndex].hull;
    state.solarShield = 100;
    state.wave = 1;
    state.xp = Math.max(0, state.xp - 30);
    for (const invader of invaders.splice(0)) scene.remove(invader);
    spawnWave();
  }
}

function removeFromArray(list, object) {
  scene.remove(object);
  const index = list.indexOf(object);
  if (index !== -1) list.splice(index, 1);
}

function resize() {
  const { innerWidth, innerHeight } = window;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  updatePlayer(delta);
  updateWorld(delta);
  updateRadar();
  updateUi();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resize();
animate();

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
const surfaceObjects = [];
const effects = [];
const interiorObjects = [];

const state = {
  hull: 100,
  xp: 0,
  wave: 1,
  solarShield: 100,
  fuel: 78,
  repairsReady: true,
  enginePower: 65,
  shipIndex: 0,
  mode: "Patrol",
  landedPlanet: null,
  defendedPlanets: new Set(),
  surfaceMode: false,
  surfaceSiteIndex: 0,
  oxygen: 100,
  interiorMode: false,
  stationIndex: 0,
  interiorPosition: new THREE.Vector3(0, 0, 0),
  landingSequence: 0,
  waveDelay: 0,
  waveAlertTimer: 3,
  fireCooldown: 0,
  autopilot: false,
  autopilotTarget: null,
  shieldBoostCooldown: 0,
  repairCooldown: 0,
  activeTask: null,
  upgrades: {
    hull: 0,
    laser: 0,
    engine: 0,
    shield: 0,
    fuel: 0,
    scanner: 0,
  },
};

const ships = [
  { name: "Vanguard", speed: 26, hull: 100, laser: 1, color: 0x87d8ff, body: 1, wings: 1 },
  { name: "Warden", speed: 20, hull: 150, laser: 1, color: 0xf4c66a, body: 1.25, wings: 1.25 },
  { name: "Needle", speed: 34, hull: 82, laser: 1.25, color: 0x9affd1, body: 0.78, wings: 0.78 },
];

const upgradeDefs = [
  { key: "hull", name: "Titanium Hull", copy: "+20 max hull and better survival", cost: 35 },
  { key: "laser", name: "Laser Focuser", copy: "More laser damage and faster kills", cost: 45 },
  { key: "engine", name: "Engine Injectors", copy: "Higher ship speed and stronger thrust", cost: 40 },
  { key: "shield", name: "Shield Matrix", copy: "Restores and raises solar shield resilience", cost: 45 },
  { key: "fuel", name: "Fuel Tank", copy: "More fuel and slower fuel drain", cost: 30 },
  { key: "scanner", name: "Deep Scanner", copy: "Longer radar reach and more wave delay from missions", cost: 30 },
];

const tasks = [
  { title: "Download navigation update", xp: 18, delay: 8 },
  { title: "Balance shield capacitors", xp: 22, delay: 10 },
  { title: "Refill maneuver fuel", xp: 16, delay: 7 },
];

const planetTasks = [
  { title: "Scan magnetic storms", xp: 28, delay: 18, signal: "Mapped" },
  { title: "Repair ground relay", xp: 32, delay: 24, signal: "Linked" },
  { title: "Calibrate mineral beacon", xp: 30, delay: 21, signal: "Stable" },
  { title: "Restore orbital weather feed", xp: 34, delay: 26, signal: "Clear" },
];

const stations = [
  {
    name: "Pilot Seat",
    zone: "Forward",
    deck: [7, 0, 0],
    copy: "Tune flight assists, check radar contacts, and prepare the ship for manual landing.",
    task: "Calibrate landing computer",
    xp: 14,
    delay: 5,
    effect: () => {
      state.landingSequence = Math.min(1, state.landingSequence + 0.3);
    },
  },
  {
    name: "Engine Core",
    zone: "Aft",
    deck: [-7, 0, 0],
    copy: "Balance plasma flow and refill maneuver fuel before the next wave closes in.",
    task: "Refill and balance fuel lines",
    xp: 18,
    delay: 7,
    effect: () => {
      state.fuel = Math.min(100, state.fuel + 18);
      state.enginePower = Math.min(100, state.enginePower + 5);
      ui.enginePower.value = state.enginePower;
    },
  },
  {
    name: "Shield Bay",
    zone: "Port",
    deck: [-1.5, 0, -3.2],
    copy: "Patch shield emitters so the solar system can survive longer under attack.",
    task: "Replace shield capacitors",
    xp: 22,
    delay: 9,
    effect: () => {
      state.solarShield = Math.min(100, state.solarShield + 16);
      state.repairsReady = true;
    },
  },
  {
    name: "Navigation",
    zone: "Upper",
    deck: [3.2, 0, -2.9],
    copy: "Download route data and plot quieter patrol lanes around the planets.",
    task: "Download orbital update",
    xp: 20,
    delay: 11,
    effect: () => {
      state.waveDelay += 4;
    },
  },
  {
    name: "Cargo Hold",
    zone: "Lower",
    deck: [-4.2, 0, 3.1],
    copy: "Secure supplies and mission kits for planet-side repairs.",
    task: "Pack surface repair kit",
    xp: 16,
    delay: 6,
    effect: () => {
      state.hull = Math.min(currentStats().hull, state.hull + 10);
    },
  },
  {
    name: "Comms Array",
    zone: "Starboard",
    deck: [2.8, 0, 3.2],
    copy: "Send false telemetry to confuse incoming invader formations.",
    task: "Broadcast decoy signal",
    xp: 24,
    delay: 13,
    effect: () => {
      for (const invader of invaders) invader.userData.speed *= 0.92;
    },
  },
];

const ui = {
  hull: document.querySelector("#hull"),
  xp: document.querySelector("#xp"),
  wave: document.querySelector("#wave"),
  engine: document.querySelector("#engine"),
  shipName: document.querySelector("#ship-name"),
  mode: document.querySelector("#mode"),
  shield: document.querySelector("#shield"),
  threat: document.querySelector("#threat"),
  waveAlert: document.querySelector("#wave-alert"),
  taskTitle: document.querySelector("#task-title"),
  taskCopy: document.querySelector("#task-copy"),
  taskList: document.querySelector("#task-list"),
  taskProgress: document.querySelector("#task-progress"),
  taskProgressLabel: document.querySelector("#task-progress-label"),
  taskProgressBar: document.querySelector("#task-progress-bar"),
  radarBlips: document.querySelector("#radar-blips"),
  enginePower: document.querySelector("#engine-power"),
  interiorPanel: document.querySelector("#interior-panel"),
  stationName: document.querySelector("#station-name"),
  stationCopy: document.querySelector("#station-copy"),
  shipMap: document.querySelector("#ship-map"),
  fuel: document.querySelector("#fuel"),
  repairs: document.querySelector("#repairs"),
  delay: document.querySelector("#delay"),
  surfacePanel: document.querySelector("#surface-panel"),
  surfaceName: document.querySelector("#surface-name"),
  surfaceCopy: document.querySelector("#surface-copy"),
  oxygen: document.querySelector("#oxygen"),
  signal: document.querySelector("#signal"),
  siteDistance: document.querySelector("#site-distance"),
  upgradePanel: document.querySelector("#upgrade-panel"),
  upgradeList: document.querySelector("#upgrade-list"),
  missionTitle: document.querySelector("#mission-title"),
  missionList: document.querySelector("#mission-list"),
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

buildShipModel();

const cockpitFrame = new THREE.Group();
camera.add(cockpitFrame);
scene.add(camera);
createCockpitInterior();

createStarfield();
createPlanets();
spawnWave();
renderShipMap();
renderUpgrades();
renderTasks();
updateUi();

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") fireLaser();
  if (event.code === "KeyE") landOrTask();
  if (event.code === "KeyF") completeSurfaceJob();
  if (event.code === "KeyP") toggleAutopilot();
  if (event.code === "KeyL") engageLandingAssist();
  if (event.code === "KeyQ") cycleShip();
  if (event.code === "KeyR") toggleInterior();
  if (event.code === "KeyU") toggleUpgrades();
  if (event.code === "ArrowLeft") moveStation(-1);
  if (event.code === "ArrowRight") moveStation(1);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("resize", resize);
document.querySelector("#fire").addEventListener("click", fireLaser);
document.querySelector("#land").addEventListener("click", landOrTask);
document.querySelector("#autopilot").addEventListener("click", toggleAutopilot);
document.querySelector("#landing-assist").addEventListener("click", engageLandingAssist);
document.querySelector("#shield-boost").addEventListener("click", boostShield);
document.querySelector("#repair-pulse").addEventListener("click", repairHull);
document.querySelector("#interior-toggle").addEventListener("click", toggleInterior);
document.querySelector("#exit-interior").addEventListener("click", toggleInterior);
document.querySelector("#launch").addEventListener("click", launchFromSurface);
document.querySelector("#cycle-ship").addEventListener("click", cycleShip);
document.querySelector("#upgrade").addEventListener("click", toggleUpgrades);
document.querySelector("#close-upgrades").addEventListener("click", toggleUpgrades);
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
    planet.userData = { name, detail, orbit, speed, size, pivot, color };
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

function createInteriorDeck() {
  clearInteriorDeck();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x16212d, metalness: 0.6, roughness: 0.34 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c141d, metalness: 0.48, roughness: 0.42 });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0x58e3bd });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.18, 8), floorMat);
  floor.position.set(0, -20, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  interiorObjects.push(floor);

  for (const z of [-4.1, 4.1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 3.2, 0.18), wallMat);
    wall.position.set(0, -18.45, z);
    scene.add(wall);
    interiorObjects.push(wall);
  }

  for (const x of [-9.1, 9.1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 8), wallMat);
    wall.position.set(x, -18.45, 0);
    scene.add(wall);
    interiorObjects.push(wall);
  }

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 8), wallMat);
  ceiling.position.set(0, -16.8, 0);
  scene.add(ceiling);
  interiorObjects.push(ceiling);

  stations.forEach((station, index) => {
    const [x, , z] = station.deck;
    const stationGroup = new THREE.Group();
    stationGroup.position.set(x, -19.25, z);
    stationGroup.userData = { stationIndex: index };

    const consoleBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.85, 1.1),
      new THREE.MeshStandardMaterial({
        color: index === state.stationIndex ? 0x245a58 : 0x1a2938,
        metalness: 0.58,
        roughness: 0.28,
      })
    );
    consoleBase.position.y = 0.5;
    stationGroup.add(consoleBase);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 0.05), trimMat);
    screen.position.set(0, 1.08, z < 0 ? 0.57 : -0.57);
    stationGroup.add(screen);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 8),
      new THREE.MeshBasicMaterial({ color: index === state.stationIndex ? 0xffd66d : 0x58e3bd })
    );
    beacon.position.set(0, 1.42, 0);
    stationGroup.add(beacon);

    scene.add(stationGroup);
    interiorObjects.push(stationGroup);
  });

  const playerMarker = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.75, 6, 12),
    new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.72 })
  );
  playerMarker.name = "interior-player";
  playerMarker.position.copy(state.interiorPosition).add(new THREE.Vector3(0, -18.9, 0));
  scene.add(playerMarker);
  interiorObjects.push(playerMarker);
}

function clearInteriorDeck() {
  for (const object of interiorObjects.splice(0)) {
    scene.remove(object);
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
  }
}

function currentStats() {
  const base = ships[state.shipIndex];
  return {
    speed: base.speed + state.upgrades.engine * 4,
    hull: base.hull + state.upgrades.hull * 20,
    laser: base.laser + state.upgrades.laser * 0.45,
    fuelMax: 100 + state.upgrades.fuel * 20,
    fuelDrain: Math.max(0.006, 0.018 - state.upgrades.fuel * 0.002),
    scanner: 1 + state.upgrades.scanner * 0.18,
  };
}

function buildShipModel() {
  while (ship.children.length) {
    const child = ship.children.pop();
    child.traverse?.((part) => {
      part.geometry?.dispose?.();
      part.material?.dispose?.();
    });
  }

  const selected = ships[state.shipIndex];
  const stats = currentStats();
  const hullMat = new THREE.MeshStandardMaterial({
    color: selected.color,
    metalness: 0.86,
    roughness: 0.2,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x182231, metalness: 0.74, roughness: 0.3 });
  const glowMat = new THREE.MeshBasicMaterial({ color: state.upgrades.laser > 0 ? 0x79fff2 : 0x51ffd0 });
  const engineMat = new THREE.MeshBasicMaterial({ color: state.upgrades.engine > 0 ? 0x9affff : 0x58e3bd });

  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.72 * selected.body, 3.5, 12, 28), hullMat);
  hull.rotation.z = Math.PI / 2;
  hull.castShadow = true;
  ship.add(hull);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.72 * selected.body, 1.25, 28), hullMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 2.45;
  nose.castShadow = true;
  ship.add(nose);

  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x9fe8ff,
      transparent: true,
      opacity: 0.38,
      roughness: 0.04,
      metalness: 0.08,
      transmission: 0.28,
    })
  );
  glass.position.set(0.45, 0.46, 0);
  glass.scale.set(1.2 * selected.body, 0.7, 0.9);
  ship.add(glass);

  for (const z of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.35 * selected.wings, 0.13, 2.8 * selected.wings), darkMat);
    wing.position.set(-0.6, -0.16, z * 1.05);
    wing.rotation.x = z * 0.06;
    wing.castShadow = true;
    ship.add(wing);

    const laserPod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1 + state.upgrades.laser * 0.14, 12), glowMat);
    laserPod.rotation.z = Math.PI / 2;
    laserPod.position.set(0.95, -0.02, z * 1.75 * selected.wings);
    ship.add(laserPod);
  }

  for (const z of [-0.42, 0.42]) {
    const engine = new THREE.Mesh(new THREE.ConeGeometry(0.22 + state.upgrades.engine * 0.03, 0.8, 20), engineMat);
    engine.rotation.z = Math.PI / 2;
    engine.position.set(-2.25, -0.02, z);
    ship.add(engine);
  }

  if (state.upgrades.shield > 0) {
    const shieldRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.15 + state.upgrades.shield * 0.12, 0.025, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0x79d7ff, transparent: true, opacity: 0.42 })
    );
    shieldRing.rotation.y = Math.PI / 2;
    ship.add(shieldRing);
  }

  if (state.upgrades.scanner > 0) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), glowMat);
    antenna.position.set(-0.8, 0.92, 0);
    antenna.rotation.z = 0.28;
    ship.add(antenna);
  }

  state.hull = Math.min(stats.hull, state.hull || stats.hull);
  state.fuel = Math.min(stats.fuelMax, state.fuel);
}

function spawnWave() {
  const count = 4 + state.wave * 2;
  const formationRadius = 10 + state.wave * 1.4;
  const attackPlanet = planets[state.wave % planets.length];
  state.waveAlertTimer = 4;
  state.mode = `Wave ${state.wave} targeting ${attackPlanet.userData.name}`;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + state.wave * 0.37;
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
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc1cb })
    );
    eye.position.set(0.75, 0.25, 0);
    invader.add(eye);

    invader.position.set(
      Math.cos(angle) * distance + Math.cos(i) * formationRadius,
      -6 + Math.random() * 16,
      Math.sin(angle) * distance + Math.sin(i) * formationRadius
    );
    invader.userData = {
      hp: 3,
      maxHp: 3,
      speed: 4.2 + state.wave * 0.35,
      target: i % 3 === 0 ? planets[i % planets.length] : attackPlanet,
      formationOffset: new THREE.Vector3(
        Math.cos(i * 2.4) * formationRadius,
        Math.sin(i * 1.7) * 3,
        Math.sin(i * 2.4) * formationRadius
      ),
      hitFlash: 0,
    };
    scene.add(invader);
    invaders.push(invader);
  }
  showWaveAlert(`Wave ${state.wave} inbound: ${attackPlanet.userData.name} under threat`);
}

function fireLaser() {
  if (state.fireCooldown > 0 || state.landedPlanet || state.interiorMode || state.surfaceMode) return;
  state.fireCooldown = 0.18;
  const laser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 + state.upgrades.laser * 0.014, 0.08, 4.8, 10),
    new THREE.MeshBasicMaterial({ color: 0x61fff0 })
  );
  laser.rotation.z = Math.PI / 2;
  laser.position.copy(ship.position).add(new THREE.Vector3(2.6, 0, 0).applyQuaternion(ship.quaternion));
  laser.quaternion.copy(ship.quaternion);
  laser.userData = { velocity: new THREE.Vector3(1, 0, 0).applyQuaternion(ship.quaternion).multiplyScalar(130) };
  scene.add(laser);
  lasers.push(laser);
  createPulse(laser.position, 0x61fff0, 0.22, 0.2);
}

function showWaveAlert(message) {
  ui.waveAlert.textContent = message;
  ui.waveAlert.classList.add("show");
}

function createPulse(position, color, size = 1, life = 0.45) {
  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 })
  );
  pulse.position.copy(position);
  pulse.userData = { life, maxLife: life, grow: 5.5 };
  scene.add(pulse);
  effects.push(pulse);
}

function createExplosion(position, color = 0xff8b3d) {
  for (let i = 0; i < 8; i += 1) {
    const shard = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.24 + Math.random() * 0.32, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    shard.position.copy(position);
    shard.userData = {
      life: 0.7,
      maxLife: 0.7,
      velocity: new THREE.Vector3(
        -1 + Math.random() * 2,
        -1 + Math.random() * 2,
        -1 + Math.random() * 2
      ).normalize().multiplyScalar(9 + Math.random() * 10),
    };
    scene.add(shard);
    effects.push(shard);
  }
  createPulse(position, color, 0.9, 0.35);
}

function cycleShip() {
  if (state.interiorMode || state.surfaceMode) return;
  state.shipIndex = (state.shipIndex + 1) % ships.length;
  const stats = currentStats();
  state.hull = Math.min(stats.hull, state.hull + 12);
  buildShipModel();
  updateUi();
}

function toggleUpgrades() {
  if (state.surfaceMode) return;
  ui.upgradePanel.hidden = !ui.upgradePanel.hidden;
  if (!ui.upgradePanel.hidden) renderUpgrades();
}

function buyUpgrade(key) {
  const upgrade = upgradeDefs.find((item) => item.key === key);
  if (!upgrade) return;
  const level = state.upgrades[key];
  const cost = upgrade.cost + level * 25;
  if (state.xp < cost || level >= 5) return;

  state.xp -= cost;
  state.upgrades[key] += 1;
  const stats = currentStats();
  if (key === "hull") state.hull = Math.min(stats.hull, state.hull + 25);
  if (key === "shield") state.solarShield = Math.min(100 + state.upgrades.shield * 8, state.solarShield + 18);
  if (key === "fuel") state.fuel = Math.min(stats.fuelMax, state.fuel + 25);
  if (key === "engine") state.enginePower = Math.min(100, state.enginePower + 4);
  buildShipModel();
  renderUpgrades();
  updateUi();
}

function nearestPlanetFromShip() {
  return planets
    .map((planet) => ({ planet, distance: planet.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function threatenedPlanet() {
  if (!invaders.length) return nearestPlanetFromShip()?.planet || planets[2];
  const counts = new Map();
  for (const invader of invaders) {
    const name = invader.userData.target.userData.name;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const [name] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return planets.find((planet) => planet.userData.name === name) || planets[2];
}

function toggleAutopilot() {
  if (state.surfaceMode || state.interiorMode) return;
  state.autopilot = !state.autopilot;
  state.autopilotTarget = state.autopilot ? threatenedPlanet() : null;
  state.mode = state.autopilot
    ? `Autopilot to ${state.autopilotTarget.userData.name}`
    : "Manual control";
  showWaveAlert(state.autopilot ? `Autopilot plotting ${state.autopilotTarget.userData.name}` : "Autopilot disengaged");
  state.waveAlertTimer = 2;
  updateUi();
}

function engageLandingAssist() {
  if (state.surfaceMode || state.interiorMode) return;
  const nearest = nearestPlanetFromShip();
  if (!nearest) return;
  state.autopilot = true;
  state.autopilotTarget = nearest.planet;
  state.landingSequence = Math.min(1, state.landingSequence + 0.35);
  state.fuel = Math.max(0, state.fuel - 2);
  state.mode = `Landing assist: ${nearest.planet.userData.name}`;
  showWaveAlert(`Landing computer locked on ${nearest.planet.userData.name}`);
  state.waveAlertTimer = 2;
  updateUi();
}

function boostShield() {
  if (state.shieldBoostCooldown > 0 || state.surfaceMode) return;
  state.solarShield = Math.min(100 + state.upgrades.shield * 8, state.solarShield + 22 + state.upgrades.shield * 4);
  state.fuel = Math.max(0, state.fuel - 8);
  state.shieldBoostCooldown = 18;
  state.mode = "Shield overcharge fired";
  showWaveAlert("Shield matrix overcharged");
  state.waveAlertTimer = 2;
  createPulse(ship.position, 0x79d7ff, 2.1, 0.5);
  updateUi();
}

function repairHull() {
  if (state.repairCooldown > 0 || state.surfaceMode) return;
  const stats = currentStats();
  state.hull = Math.min(stats.hull, state.hull + 18 + state.upgrades.hull * 4);
  state.fuel = Math.max(0, state.fuel - 5);
  state.repairCooldown = 16;
  state.mode = "Repair pulse complete";
  showWaveAlert("Hull repair pulse complete");
  state.waveAlertTimer = 2;
  createPulse(ship.position, 0x58e3bd, 1.4, 0.45);
  updateUi();
}

function landOrTask() {
  if (state.surfaceMode) {
    completeSurfaceJob();
    return;
  }

  if (state.interiorMode) {
    completeStationTask();
    return;
  }

  const nearest = nearestPlanetFromShip();

  if (nearest && nearest.distance < nearest.planet.userData.size + 11) {
    if (state.landingSequence < 1) {
      state.landingSequence += 0.25;
      state.fuel = Math.max(0, state.fuel - 4);
      state.mode = `Landing burn ${(state.landingSequence * 100).toFixed(0)}%`;
      updateUi();
      return;
    }
    enterSurface(nearest.planet);
    state.landingSequence = 0;
  }
}

function enterSurface(planet) {
  state.landedPlanet = planet;
  state.surfaceMode = true;
  state.interiorMode = false;
  state.oxygen = 100;
  state.surfaceSiteIndex = 0;
  state.mode = `Surface: ${planet.userData.name}`;
  ui.interiorPanel.hidden = true;
  ui.surfacePanel.hidden = false;
  clearSurface();
  createSurfaceScene(planet);
  renderTasks();
  updateUi();
}

function launchFromSurface() {
  if (state.activeTask) return;
  if (!state.surfaceMode) return;
  const planetPosition = state.landedPlanet.getWorldPosition(new THREE.Vector3());
  ship.position.copy(planetPosition).add(new THREE.Vector3(0, state.landedPlanet.userData.size + 14, 9));
  state.landedPlanet = null;
  state.surfaceMode = false;
  state.oxygen = 100;
  state.mode = "Launch complete";
  ui.surfacePanel.hidden = true;
  clearSurface();
  renderTasks();
  updateUi();
}

function toggleInterior() {
  if (state.activeTask) return;
  if (state.landedPlanet) return;
  state.interiorMode = !state.interiorMode;
  state.mode = state.interiorMode ? `Inside: ${stations[state.stationIndex].name}` : "Patrol";
  ui.interiorPanel.hidden = !state.interiorMode;
  if (state.interiorMode) {
    state.autopilot = false;
    state.interiorPosition.set(0, 0, 0);
    createInteriorDeck();
  } else {
    clearInteriorDeck();
  }
  renderShipMap();
  renderTasks();
  updateUi();
}

function moveStation(direction) {
  if (!state.interiorMode) return;
  state.stationIndex = (state.stationIndex + direction + stations.length) % stations.length;
  state.interiorPosition.set(...stations[state.stationIndex].deck);
  state.mode = `Inside: ${stations[state.stationIndex].name}`;
  createInteriorDeck();
  renderShipMap();
  renderTasks();
  updateUi();
}

function completeStationTask() {
  if (state.activeTask) return;
  const nearest = nearestInteriorStation();
  if (nearest.distance > 2.4) {
    state.mode = "Move closer to a ship station";
    updateUi();
    return;
  }
  state.stationIndex = nearest.index;
  const station = stations[state.stationIndex];
  startTask({
    title: station.task,
    xp: station.xp,
    delay: station.delay,
    duration: 2.6,
    label: `${station.name}: ${station.task}`,
    onComplete: () => {
      station.effect();
      state.mode = `${station.name} task complete`;
      createInteriorDeck();
      renderShipMap();
    },
  });
}

function nearestInteriorStation() {
  return stations
    .map((station, index) => ({
      station,
      index,
      distance: state.interiorPosition.distanceTo(new THREE.Vector3(...station.deck)),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function createSurfaceScene(planet) {
  const base = planet.userData.color || 0x777777;
  const groundGeometry = new THREE.PlaneGeometry(80, 80, 80, 80);
  const position = groundGeometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const ridge = Math.sin(x * 0.34) * Math.cos(y * 0.28) * 0.75;
    const small = Math.sin((x + y) * 1.4) * 0.12;
    position.setZ(i, ridge + small);
  }
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeometry,
    makeSurfaceMaterial(base)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -14, 0);
  ground.receiveShadow = true;
  ground.userData.surface = true;
  scene.add(ground);
  surfaceObjects.push(ground);

  for (let i = 0; i < 42; i += 1) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.35 + Math.random() * 1.3, 1),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(base).offsetHSL(0, -0.1, -0.18 - Math.random() * 0.14),
        roughness: 0.95,
        metalness: 0.04,
      })
    );
    rock.position.set(-36 + Math.random() * 72, -13.4, -36 + Math.random() * 72);
    rock.scale.y = 0.45 + Math.random() * 1.6;
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.castShadow = true;
    scene.add(rock);
    surfaceObjects.push(rock);
  }

  planetTasks.forEach((task, index) => {
    const angle = (index / planetTasks.length) * Math.PI * 2 + 0.4;
    const site = new THREE.Group();
    site.position.set(Math.cos(angle) * 18, -12.7, Math.sin(angle) * 18);
    site.userData = { task, complete: false };

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.14, 2.7, 12),
      new THREE.MeshStandardMaterial({ color: 0xc6d2dc, metalness: 0.62, roughness: 0.24 })
    );
    mast.position.y = 1.2;
    site.add(mast);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd66d })
    );
    beacon.position.y = 2.75;
    site.add(beacon);

    scene.add(site);
    surfaceObjects.push(site);
  });

  ship.position.set(0, -12.2, 7);
  ship.rotation.set(0, 0, 0);
}

function makeSurfaceMaterial(baseColor) {
  const geometryTexture = document.createElement("canvas");
  geometryTexture.width = 256;
  geometryTexture.height = 256;
  const ctx = geometryTexture.getContext("2d");
  ctx.fillStyle = `#${baseColor.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i += 1) {
    const shade = 80 + Math.random() * 110;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.03 + Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 12, 1 + Math.random() * 12);
  }
  const texture = new THREE.CanvasTexture(geometryTexture);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.96, metalness: 0.02 });
}

function clearSurface() {
  for (const object of surfaceObjects.splice(0)) {
    scene.remove(object);
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
  }
}

function completeSurfaceJob() {
  if (state.activeTask) return;
  if (!state.surfaceMode) return;
  const site = getNearestSurfaceSite();
  if (!site || site.distance > 8) {
    state.mode = "Move closer to a surface site";
    updateUi();
    return;
  }
  const { task } = site.object.userData;
  if (site.object.userData.complete) {
    state.mode = "Surface site already secure";
    updateUi();
    return;
  }

  startTask({
    title: task.title,
    xp: task.xp,
    delay: task.delay,
    duration: 3.2,
    label: `Surface EVA: ${task.title}`,
    onComplete: () => {
      site.object.userData.complete = true;
      const beacon = site.object.children.find((child) => child.material?.color);
      beacon?.material?.color?.setHex?.(0x58e3bd);
      state.defendedPlanets.add(state.landedPlanet.userData.name);
      state.waveDelay += 18;
      state.waveDelay += state.upgrades.scanner * 4;
      state.solarShield = Math.min(100, state.solarShield + 10);
      state.mode = `${task.title} complete`;
      ui.signal.textContent = task.signal;
    },
  });
}

function getNearestSurfaceSite() {
  const sites = surfaceObjects.filter((object) => object.userData?.task);
  if (!sites.length) return null;
  return sites
    .map((object) => ({ object, distance: object.position.distanceTo(ship.position) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function completeTask(title, xp, delay) {
  state.xp += xp;
  state.waveDelay += delay;
  state.solarShield = Math.min(100, state.solarShield + 4);
  state.waveDelay += state.upgrades.scanner * 0.5;
  state.mode = `${title} complete`;
  updateUi();
}

function startTask({ title, xp, delay, duration, label, onComplete }) {
  state.activeTask = {
    title,
    xp,
    delay,
    duration,
    elapsed: 0,
    label,
    onComplete,
  };
  state.mode = label;
  showWaveAlert(`${label} started`);
  state.waveAlertTimer = 1.8;
  renderTasks();
  updateUi();
}

function finishActiveTask() {
  const task = state.activeTask;
  if (!task) return;
  state.activeTask = null;
  task.onComplete?.();
  completeTask(task.title, task.xp, task.delay);
  showWaveAlert(`${task.title} complete: +${task.xp} XP`);
  state.waveAlertTimer = 2.2;
  renderTasks();
}

function renderTasks() {
  ui.taskList.innerHTML = "";
  const availableTasks = state.interiorMode
    ? [stations[state.stationIndex]]
    : state.landedPlanet
    ? planetTasks
    : tasks;

  ui.taskTitle.textContent = state.interiorMode
    ? `${stations[state.stationIndex].name} Task`
    : state.landedPlanet
    ? `${state.landedPlanet.userData.name} Surface`
    : "Onboard Tasks";
  ui.taskCopy.textContent = state.interiorMode
    ? stations[state.stationIndex].copy
    : state.landedPlanet
    ? `Work on ${state.landedPlanet.userData.detail}. Completing one task delays invader waves.`
    : "Complete ship tasks to earn XP and delay the next invader wave.";

  for (const task of availableTasks) {
    const row = document.createElement("div");
    row.className = "task";
    const label = document.createElement("span");
    label.textContent = task.title || task.task;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = state.activeTask ? "Busy" : `Start +${task.xp} XP`;
    button.disabled = Boolean(state.activeTask);
    button.addEventListener("click", () => {
      if (state.interiorMode) completeStationTask();
      else if (state.surfaceMode) completeSurfaceJob();
      else {
        startTask({
          title: task.title,
          xp: task.xp,
          delay: task.delay,
          duration: 2.3,
          label: `Ship task: ${task.title}`,
        });
      }
    });
    row.append(label, button);
    ui.taskList.append(row);
  }
}

function renderShipMap() {
  ui.shipMap.innerHTML = "";
  stations.forEach((station, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `station${index === state.stationIndex ? " active" : ""}`;
    button.innerHTML = `${station.name}<small>${station.zone}</small>`;
    button.addEventListener("click", () => {
      state.stationIndex = index;
      state.interiorPosition.set(...station.deck);
      state.mode = `Inside: ${station.name}`;
      createInteriorDeck();
      renderShipMap();
      renderTasks();
      updateUi();
    });
    ui.shipMap.append(button);
  });

  const station = stations[state.stationIndex];
  ui.stationName.textContent = station.name;
  ui.stationCopy.textContent = station.copy;
}

function renderUpgrades() {
  ui.upgradeList.innerHTML = "";
  for (const upgrade of upgradeDefs) {
    const level = state.upgrades[upgrade.key];
    const cost = upgrade.cost + level * 25;
    const row = document.createElement("div");
    row.className = "upgrade-row";
    const info = document.createElement("div");
    info.innerHTML = `<strong>${upgrade.name} Lv ${level}</strong><p>${upgrade.copy}</p>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = level >= 5 ? "Max" : `${cost} XP`;
    button.disabled = level >= 5 || state.xp < cost;
    button.addEventListener("click", () => buyUpgrade(upgrade.key));
    row.append(info, button);
    ui.upgradeList.append(row);
  }
}

function updateUi() {
  const stats = currentStats();
  ui.hull.textContent = Math.max(0, Math.round(state.hull));
  ui.xp.textContent = Math.round(state.xp);
  ui.wave.textContent = state.wave;
  ui.engine.textContent = `${state.enginePower}%`;
  ui.shipName.textContent = `${ships[state.shipIndex].name} H${Math.round(stats.hull)} F${Math.round(stats.fuelMax)}`;
  ui.mode.textContent = state.mode;
  ui.shield.textContent = `${Math.max(0, Math.round(state.solarShield))}%`;
  ui.threat.textContent = invaders.length ? `${invaders.length} contacts` : state.waveDelay > 0 ? "Delayed" : "Clear";
  ui.fuel.textContent = `${Math.round(state.fuel)}%`;
  ui.repairs.textContent = state.repairsReady ? "Ready" : "Busy";
  ui.delay.textContent = `${Math.max(0, Math.round(state.waveDelay))}s`;
  if (ui.oxygen) ui.oxygen.textContent = `${Math.max(0, Math.round(state.oxygen))}%`;
  if (state.surfaceMode && state.landedPlanet) {
    ui.surfaceName.textContent = `${state.landedPlanet.userData.name} Surface`;
    ui.surfaceCopy.textContent = `Terrain: ${state.landedPlanet.userData.detail}. Reach beacon sites and press F or E to complete field work.`;
    const nearest = getNearestSurfaceSite();
    ui.siteDistance.textContent = nearest ? `${nearest.distance.toFixed(1)}m` : "--";
  }
  if (state.activeTask) {
    const ratio = THREE.MathUtils.clamp(state.activeTask.elapsed / state.activeTask.duration, 0, 1);
    ui.taskProgress.hidden = false;
    ui.taskProgressLabel.textContent = `${state.activeTask.label} ${Math.round(ratio * 100)}%`;
    ui.taskProgressBar.style.width = `${Math.round(ratio * 100)}%`;
  } else {
    ui.taskProgress.hidden = true;
    ui.taskProgressBar.style.width = "0%";
  }
  renderMissions();
  renderUpgrades();
}

function renderMissions() {
  const threat = threatenedPlanet();
  const missions = [
    {
      text: `Defend ${threat?.userData.name || "the solar system"} from active wave contacts`,
      done: invaders.length === 0,
    },
    {
      text: "Complete a ship station task to delay the next wave",
      done: state.waveDelay > 0,
    },
    {
      text: "Land on a planet and finish a surface mission",
      done: state.defendedPlanets.size > 0,
    },
    {
      text: "Earn XP and buy a ship upgrade",
      done: Object.values(state.upgrades).some((level) => level > 0),
    },
  ];
  ui.missionTitle.textContent = invaders.length
    ? `${invaders.length} invaders active`
    : "Regroup before next wave";
  ui.missionList.innerHTML = "";
  for (const mission of missions) {
    const item = document.createElement("li");
    item.className = mission.done ? "done" : "";
    item.textContent = mission.text;
    ui.missionList.append(item);
  }
}

function updateRadar() {
  ui.radarBlips.innerHTML = "";
  const radarScale = 0.34 * currentStats().scanner;
  for (const invader of invaders.slice(0, 20 + state.upgrades.scanner * 4)) {
    const delta = invader.position.clone().sub(ship.position);
    const blip = document.createElement("span");
    blip.className = `blip${invader.userData.hp < invader.userData.maxHp ? " damaged" : ""}`;
    blip.style.left = `${50 + THREE.MathUtils.clamp(delta.x * radarScale, -45, 45)}%`;
    blip.style.top = `${50 + THREE.MathUtils.clamp(delta.z * radarScale, -45, 45)}%`;
    ui.radarBlips.append(blip);
  }
}

function updatePlayer(delta) {
  if (state.surfaceMode) {
    const walk = 9 * delta;
    const direction = new THREE.Vector3();
    if (keys.has("KeyW")) direction.z -= 1;
    if (keys.has("KeyS")) direction.z += 1;
    if (keys.has("KeyA")) direction.x -= 1;
    if (keys.has("KeyD")) direction.x += 1;
    direction.normalize().multiplyScalar(walk);
    ship.position.add(direction);
    ship.position.x = THREE.MathUtils.clamp(ship.position.x, -36, 36);
    ship.position.z = THREE.MathUtils.clamp(ship.position.z, -36, 36);
    ship.position.y = -12.2 + Math.sin(clock.elapsedTime * 7) * (direction.lengthSq() > 0 ? 0.08 : 0.02);
    if (direction.lengthSq() > 0) {
      ship.lookAt(ship.position.clone().add(direction));
      state.oxygen = Math.max(0, state.oxygen - delta * 0.9);
    }
    camera.position.lerp(ship.position.clone().add(new THREE.Vector3(-6, 4.2, 7)), 0.08);
    camera.lookAt(ship.position.clone().add(new THREE.Vector3(0, 1.2, -2)));
    if (state.oxygen <= 0) {
      state.hull = Math.max(1, state.hull - delta * 6);
      state.mode = "Oxygen critical";
    }
    return;
  }

  if (state.interiorMode) {
    const walk = 7 * delta;
    const direction = new THREE.Vector3();
    if (keys.has("KeyW")) direction.x += 1;
    if (keys.has("KeyS")) direction.x -= 1;
    if (keys.has("KeyA")) direction.z -= 1;
    if (keys.has("KeyD")) direction.z += 1;
    direction.normalize().multiplyScalar(walk);
    state.interiorPosition.add(direction);
    state.interiorPosition.x = THREE.MathUtils.clamp(state.interiorPosition.x, -7.8, 7.8);
    state.interiorPosition.z = THREE.MathUtils.clamp(state.interiorPosition.z, -3.15, 3.15);

    const marker = interiorObjects.find((object) => object.name === "interior-player");
    if (marker) {
      marker.position.copy(state.interiorPosition).add(new THREE.Vector3(0, -18.9, 0));
      if (direction.lengthSq() > 0) marker.lookAt(marker.position.clone().add(direction));
    }

    const nearest = nearestInteriorStation();
    state.stationIndex = nearest.index;
    const sway = Math.sin(clock.elapsedTime * 1.4) * 0.035;
    const eye = state.interiorPosition.clone().add(new THREE.Vector3(-2.1, -17.1 + sway, 2.6));
    const lookAt = state.interiorPosition.clone().add(new THREE.Vector3(1.8, -18.55, -0.6));
    camera.position.lerp(eye, 0.12);
    camera.lookAt(lookAt);
    ui.stationName.textContent = nearest.station.name;
    ui.stationCopy.textContent = nearest.station.copy;
    return;
  }

  const stats = currentStats();
  const fuelScale = state.fuel <= 0 ? 0.25 : 1;
  const thrust = stats.speed * (state.enginePower / 100) * fuelScale * delta;
  const direction = new THREE.Vector3();
  if (state.autopilot && state.autopilotTarget) {
    const target = state.autopilotTarget.getWorldPosition(new THREE.Vector3());
    const arrival = state.autopilotTarget.userData.size + 9;
    const toTarget = target.sub(ship.position);
    if (toTarget.length() > arrival) {
      direction.copy(toTarget.normalize());
      state.enginePower = Math.max(state.enginePower, 72);
      ui.enginePower.value = state.enginePower;
    } else {
      state.autopilot = false;
      state.mode = `Orbiting ${state.autopilotTarget.userData.name}`;
      state.autopilotTarget = null;
      showWaveAlert("Autopilot arrived. Use landing assist or Land.");
      state.waveAlertTimer = 2.5;
    }
  } else {
    if (keys.has("KeyW")) direction.x += 1;
    if (keys.has("KeyS")) direction.x -= 1;
    if (keys.has("KeyA")) direction.z -= 1;
    if (keys.has("KeyD")) direction.z += 1;
    if (keys.has("ShiftLeft")) direction.y += 1;
    if (keys.has("ControlLeft")) direction.y -= 1;
  }
  direction.normalize().multiplyScalar(thrust);
  ship.position.add(direction);
  if (direction.lengthSq() > 0) {
    state.fuel = Math.max(0, state.fuel - delta * state.enginePower * stats.fuelDrain);
  }

  const lookTarget = ship.position.clone().add(new THREE.Vector3(1, 0, 0));
  if (direction.lengthSq() > 0) lookTarget.copy(ship.position).add(direction.clone().normalize());
  ship.lookAt(lookTarget);
  camera.position.lerp(ship.position.clone().add(new THREE.Vector3(-7, 4.2, 9)), 0.08);
  camera.lookAt(ship.position.clone().add(new THREE.Vector3(8, 0.5, 0)));
}

function updateWorld(delta) {
  sun.rotation.y += delta * 0.06;
  for (const planet of planets) {
    if (!state.surfaceMode) planet.userData.pivot.rotation.y += planet.userData.speed * delta;
    planet.rotation.y += delta * 0.2;
  }

  for (let i = lasers.length - 1; i >= 0; i -= 1) {
    const laser = lasers[i];
    laser.position.addScaledVector(laser.userData.velocity, delta);
    if (laser.position.length() > 700) removeFromArray(lasers, laser);
  }

  if (state.activeTask) {
    const taskSpeed = state.interiorMode ? 1 : state.surfaceMode ? 0.9 : 1.1;
    state.activeTask.elapsed += delta * taskSpeed;
    if (state.activeTask.elapsed >= state.activeTask.duration) finishActiveTask();
  }

  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    effect.userData.life -= delta;
    if (effect.userData.velocity) effect.position.addScaledVector(effect.userData.velocity, delta);
    if (effect.userData.grow) effect.scale.addScalar(effect.userData.grow * delta);
    const opacity = Math.max(0, effect.userData.life / effect.userData.maxLife);
    if (effect.material) effect.material.opacity = opacity;
    effect.rotation.x += delta * 4;
    effect.rotation.y += delta * 6;
    if (effect.userData.life <= 0) removeFromArray(effects, effect);
  }

  for (let i = invaders.length - 1; i >= 0; i -= 1) {
    const invader = invaders[i];
    const targetDistance = invader.position.distanceTo(invader.userData.target.getWorldPosition(new THREE.Vector3()));
    const targetPosition = invader.userData.target
      .getWorldPosition(new THREE.Vector3())
      .add(invader.userData.formationOffset.clone().multiplyScalar(THREE.MathUtils.clamp(targetDistance / 180, 0, 1)));
    const toTarget = targetPosition.sub(invader.position).normalize();
    invader.position.addScaledVector(toTarget, invader.userData.speed * delta);
    invader.rotation.x += delta * 1.8;
    invader.rotation.y += delta * 1.2;
    invader.userData.hitFlash = Math.max(0, invader.userData.hitFlash - delta);
    const healthRatio = invader.userData.hp / invader.userData.maxHp;
    const body = invader.children[0];
    if (body?.material) {
      body.material.color.setHex(
        invader.userData.hitFlash > 0 ? 0xffffff : healthRatio > 0.66 ? 0xff3d66 : healthRatio > 0.33 ? 0xff8b3d : 0xffd66d
      );
      body.material.emissive?.setHex(healthRatio > 0.33 ? 0x450717 : 0x6b3c00);
    }

    if (!state.surfaceMode && invader.position.distanceTo(ship.position) < 3.2) {
      state.hull -= 8 * delta;
    }

    if (invader.position.distanceTo(invader.userData.target.getWorldPosition(new THREE.Vector3())) < 4.5) {
      state.solarShield -= 6 * delta;
    }

    for (const laser of lasers) {
      if (laser.position.distanceTo(invader.position) < 2.2) {
        invader.userData.hp -= currentStats().laser;
        invader.userData.hitFlash = 0.16;
        createPulse(invader.position, 0xffd66d, 0.55, 0.25);
        scene.remove(laser);
        lasers.splice(lasers.indexOf(laser), 1);
        if (invader.userData.hp <= 0) {
          state.xp += 10;
          createExplosion(invader.position);
          scene.remove(invader);
          invaders.splice(i, 1);
          state.mode = "+10 XP invader destroyed";
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
  state.shieldBoostCooldown = Math.max(0, state.shieldBoostCooldown - delta);
  state.repairCooldown = Math.max(0, state.repairCooldown - delta);
  state.waveAlertTimer = Math.max(0, state.waveAlertTimer - delta);
  if (state.waveAlertTimer <= 0) ui.waveAlert.classList.remove("show");
  if (state.hull <= 0 || state.solarShield <= 0) {
    state.mode = "Emergency reset";
    state.hull = currentStats().hull;
    state.solarShield = 100 + state.upgrades.shield * 8;
    state.wave = 1;
    state.xp = Math.max(0, state.xp - 30);
    for (const invader of invaders.splice(0)) scene.remove(invader);
    showWaveAlert("Emergency reset: solar defense restored");
    state.waveAlertTimer = 3;
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

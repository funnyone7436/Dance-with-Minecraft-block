import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

console.log("🔥 main.js loaded with gesture & walls");

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

// Textures
const loader = new THREE.TextureLoader();
const groundTexture = loader.load('textures/ground.jpg');
groundTexture.wrapS = groundTexture.wrapT = THREE.ClampToEdgeWrapping;
groundTexture.repeat.set(1, 1);

const panoramaTexture = loader.load('textures/minecraft_sky_360.webp');
const blockTextures = {
  grass: loader.load('textures/Grass_Block_29_JE2_BE2.webp'),
  lava1: loader.load('textures/lava1.webp'),
  diamond: loader.load('textures/Diamond_Ore.webp'),
  tnt: loader.load('textures/TNT.webp'),
  lava: loader.load('textures/lava.webp'),
  blue: loader.load('textures/blue.png'),
  dirt: loader.load('textures/dirt.webp'),
  brick: loader.load('textures/brick.jpg'),
  stone: loader.load('textures/stone.png')
};

// Texture settings
const renderer = new THREE.WebGLRenderer();
Object.values(blockTextures).forEach(tex => {
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
});
panoramaTexture.encoding = THREE.sRGBEncoding;
panoramaTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Sky
const skySphere = new THREE.Mesh(
  new THREE.SphereGeometry(500, 60, 40),
  new THREE.MeshBasicMaterial({ map: panoramaTexture, side: THREE.BackSide })
);
scene.add(skySphere);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, 12);
camera.lookAt(0, 2, -5);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Audio Setup
const audioListener = new THREE.AudioListener();
camera.add(audioListener);

const leftLaunchSound = new THREE.Audio(audioListener);
const rightLaunchSound = new THREE.Audio(audioListener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('sounds/left_launch.mp3', buffer => {
  leftLaunchSound.setBuffer(buffer);
  leftLaunchSound.setVolume(0.5);
});
audioLoader.load('sounds/right_launch.mp3', buffer => {
  rightLaunchSound.setBuffer(buffer);
  rightLaunchSound.setVolume(0.5);
});

const hitSounds = [];
for (let i = 1; i <= 2; i++) {
  const sound = new THREE.Audio(audioListener);
  audioLoader.load(`sounds/hit${i}.mp3`, buffer => {
    sound.setBuffer(buffer);
    sound.setVolume(0.5);
  });
  hitSounds.push(sound);
}

const bgMusic = new THREE.Audio(audioListener);
audioLoader.load('sounds/game3.mp3', buffer => {
  bgMusic.setBuffer(buffer);
  bgMusic.setLoop(true);
  bgMusic.setVolume(0.2);
});

// Lighting
scene.add(new THREE.DirectionalLight(0xffffff, 1).position.set(10, 20, 10));
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 50),
  new THREE.MeshStandardMaterial({
    map: groundTexture,
    emissive: 0x222222,
    emissiveIntensity: 0.3
  })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Physics World
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Wall Creation
const wallMeshes = [], wallBodies = [];
function createWall(rows, cols, centerX, zPos) {
  const size = 1, spacing = 0.1;
  const width = cols * (size + spacing) - spacing;
  const textureOrder = ['lava', 'grass', 'lava1', 'diamond', 'tnt', 'dirt', 'blue', 'brick', 'stone'];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = centerX - width / 2 + c * (size + spacing) + size / 2;
      const y = 0.5 + r * (size + spacing);
      const key = textureOrder[r % textureOrder.length];
      const texture = blockTextures[key];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshStandardMaterial({ map: texture })
      );
      mesh.position.set(x, y, zPos);
      scene.add(mesh);
      wallMeshes.push(mesh);

      const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
        position: new CANNON.Vec3(x, y, zPos)
      });
      world.addBody(body);
      wallBodies.push(body);
    }
  }
}

// Wall grid
[-26.4, -19.8, -13.2, -6.6, 0, 6.6, 13.2, 19.8, 26.4].forEach(x => createWall(9, 6, x, -5));

// Ball Shooting
const ballMeshes = [], ballBodies = [];
function shootBall(position, direction, color) {
  const radius = 0.8;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.copy(position);
  scene.add(mesh);
  ballMeshes.push(mesh);

  const body = new CANNON.Body({
    mass: 2,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(position.x, position.y, position.z)
  });
  body.velocity.set(direction.x * 60, direction.y * 60, direction.z * 60);
  body.addEventListener('collide', e => {
    const impactStrength = e.contact.getImpactVelocityAlongNormal();
    if (impactStrength > 2) {
      const sound = hitSounds[Math.floor(Math.random() * hitSounds.length)];
      if (sound.isPlaying) sound.stop();
      sound.play();
    }
  });
  world.addBody(body);
  ballBodies.push(body);
}

// Animate
function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);
  skySphere.position.copy(camera.position);

  wallMeshes.forEach((m, i) => {
    m.position.copy(wallBodies[i].position);
    m.quaternion.copy(wallBodies[i].quaternion);
  });

  for (let i = ballMeshes.length - 1; i >= 0; i--) {
    const mesh = ballMeshes[i];
    const body = ballBodies[i];
    mesh.position.copy(body.position);
    if (body.position.length() > 100) {
      world.removeBody(body);
      scene.remove(mesh);
      ballMeshes.splice(i, 1);
      ballBodies.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

// Shake Effect
function triggerShakeEffect() {
  console.log("🌍 Gentle quake triggered...");
  wallBodies.forEach(body => {
    if (body.mass > 0) {
      const joltX = (Math.random() - 0.5) * 0.8;
      const joltY = Math.random() * 0.6 + 1;
      const joltZ = (Math.random() - 0.5) * 0.8;
      body.applyImpulse(new CANNON.Vec3(joltX, joltY, joltZ));
    }
  });
}

// Game Start
let animationStarted = false;
function startGame() {
  if (!animationStarted) {
    animationStarted = true;
    animate();
    if (!bgMusic.isPlaying) bgMusic.play();

    const cameraUtils = new Camera(videoElement, {
      onFrame: async () => { await pose.send({ image: videoElement }); },
      width: 640, height: 480
    });
    cameraUtils.start().then(() => resizeCanvasToVideo());
  }
}

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('introOverlay').style.display = 'none';
  startGame();
});

// MediaPipe Setup
const videoElement = document.getElementById('video');
let prX, prY, prT, plX, plY, plT;

const pose = new Pose({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4/${f}`
});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});
pose.onResults(onResults);

// Landmark Drawing
function onResults(results) {
  drawPoseLandmarks(results.poseLandmarks);
  if (!results.poseLandmarks) return;

  function checkHand(idx, prevX, prevY, prevT, startX, color, sound) {
    const lm = results.poseLandmarks[idx];
    const x = lm.x, y = lm.y;
    const now = Date.now();
    const minYDelta = 0.2;

    if (prevX != null && prevY != null && prevT != null) {
      const dt = (now - prevT) / 1000;
      const vx = (x - prevX) / dt;
      const vy = (y - prevY) / dt;
      const speed = Math.hypot(vx, vy);
      const yDelta = Math.abs(y - prevY);

      if (speed > 1.8 && yDelta > minYDelta) {
        let dir = (vy < 0)
          ? new THREE.Vector3(vx, 1.5, -1).normalize()
          : new THREE.Vector3(vx, -0.2, -1).normalize();

        if (vy < -2.5 && speed > 2.5) triggerShakeEffect();
        shootBall(new THREE.Vector3(startX, 1, 10), dir, color);
        if (sound.isPlaying) sound.stop();
        sound.play();
      }
    }
    return [x, y, now];
  }

  [prX, prY, prT] = checkHand(16, prX, prY, prT, 1, 0xff3333, rightLaunchSound);
  [plX, plY, plT] = checkHand(15, plX, plY, plT, -1, 0x3399ff, leftLaunchSound);
}

function drawPoseLandmarks(landmarks) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;

  ctx.save();
  ctx.fillStyle = 'lime';
  for (let i = 0; i < landmarks.length; i++) {
    const x = landmarks[i].x * canvas.width;
    const y = landmarks[i].y * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

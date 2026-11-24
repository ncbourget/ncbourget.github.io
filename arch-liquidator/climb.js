import * as THREE from "three";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { clone } from "../three/SkeletonUtils.js";

const ledge = -1.627;
const tall = 2.584;
const idle = 229 / 24;

let renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.domElement.className = "liquidators";
renderer.domElement.dataset.cap = innerWidth < 700 ? 15 : 60;
document.body.appendChild(renderer.domElement);

let scene = new THREE.Scene();
let cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
cam.position.z = 500;

scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a5a, 1.7));
let sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(-2, 3, 4);
scene.add(sun);

function fit() {
  let w = innerWidth, h = innerHeight;
  let ppu = h * 0.97 / tall;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h);
  cam.left = -w / 2 / ppu;
  cam.right = w / 2 / ppu;
  cam.bottom = ledge;
  cam.top = ledge + h / ppu;
  cam.updateProjectionMatrix();
}
fit();
addEventListener("resize", fit);

let model, clip;
let crew = [];
let wait = Infinity;
let n = 0;

new GLTFLoader().load("arch-liquidator/arch-liquidator.glb", function (gl) {
  model = gl.scene;
  clip = gl.animations[0];
  clip.tracks.forEach(function (tr) {
    tr.setInterpolation(THREE.InterpolateDiscrete);
  });
  let skin;
  model.traverse(function (o) {
    if (!o.isMesh) return;
    let map = o.material.map;
    map.minFilter = map.magFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    skin = skin || new THREE.MeshLambertMaterial({ map: map, side: THREE.DoubleSide });
    o.material = skin;
    o.frustumCulled = false;
  });
  wait = 4 + Math.random() * 6;
});

function spawn() {
  let body = clone(model);
  let g = new THREE.Group();
  g.add(body);
  g.scale.x = Math.random() < 0.5 ? -1 : 1;
  g.position.z = n * 3;
  body.traverse(function (o) {
    if (!o.isMesh) return;
    o.renderOrder = n;
    o.onBeforeRender = function (r) { r.clearDepth(); };
  });
  scene.add(g);
  let mx = new THREE.AnimationMixer(body);
  let act = mx.clipAction(clip);
  act.setLoop(THREE.LoopOnce);
  act.clampWhenFinished = true;
  act.play();
  let fx = Math.random();
  if (n == 0) fx = 0.4 + Math.random() * 0.2;
  if (n == 1) {
    let gap = Math.max(0.2, 1.4 / (cam.right - cam.left + 0.36));
    fx = crew[0].fx + (crew[0].fx < 0.5 ? gap : -gap);
  }
  crew.push({ g, mx, t: 0, hold: 0, fx, stops: n == 0 ? [{ t: 91 / 24 + 0.001, d: 20 + Math.random() * 40 }] : n == 1 ? [] : stops(), idling: false, left: 0, speed: 0.85 + Math.random() * 0.3 });
  n++;
}

function stops() {
  if (Math.random() < 0.3) return [];
  let spots = [51, 81, 92, 134, 161];
  let main = spots[Math.floor(Math.random() * 5)];
  let list = [main];
  if (Math.random() < 0.15) {
    let extra = spots.filter(f => f != main);
    list.push(extra[Math.floor(Math.random() * 4)]);
  }
  return list.sort((a, b) => a - b).map(function (f) {
    return { t: (f - 1) / 24 + 0.001, d: f == main ? 20 + Math.random() * 40 : 6 + Math.random() * 14 };
  });
}

function step(c, dt) {
  if (c.hold > 0) {
    c.hold -= dt;
    return;
  }
  c.t += dt * c.speed;
  if (c.stops.length && c.t >= c.stops[0].t) {
    let s = c.stops.shift();
    c.t = s.t;
    c.hold = s.d;
  } else if (!c.idling && c.t >= idle) {
    c.idling = true;
  } else if (c.idling) {
    if (c.t >= clip.duration) c.t = idle + c.t - clip.duration;
    c.left -= dt * c.speed;
    if (c.left <= 0) {
      c.hold = 2 + Math.random() * 8;
      c.left = (3 + Math.floor(Math.random() * 5)) / 24;
    }
  }
}

function run(c, dt) {
  while (dt > 0) {
    let bit = Math.min(dt, 0.1);
    step(c, bit);
    dt -= bit;
  }
}

let last = performance.now();

function tick() {
  requestAnimationFrame(tick);
  let now = performance.now();
  let dt = (now - last) / 1000 * 1.25;
  last = now;

  for (let c of crew) run(c, dt);

  if (model) {
    wait -= dt;
    while (wait <= 0 && crew.length < +renderer.domElement.dataset.cap) {
      spawn();
      run(crew[crew.length - 1], -wait);
      let base = Math.max(1.5, 40 * Math.pow(0.8, n));
      wait += base + Math.random() * base * 0.5;
    }
    if (crew.length >= +renderer.domElement.dataset.cap && wait < 1) wait = 1;
  }

  let span = cam.right - cam.left + 0.36;
  for (let c of crew) {
    c.g.position.x = cam.left - 0.18 + c.fx * span;
    if (c.t != c.shown) {
      c.mx.setTime(c.t);
      c.shown = c.t;
    }
  }

  renderer.render(scene, cam);
}
tick();

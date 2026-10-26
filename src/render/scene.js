import * as THREE from 'three';
import { LAND, BREAKWATERS, DOCKS, ISLANDS, ROUTE } from '../sim/world.js';
import { getWaterHeight } from '../sim/waves.js';

// All meshes here are PLACEHOLDER primitives (see assets/ASSET_REGISTER.csv).
const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function rectMesh(o, height, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2, height, o.hz * 2), mat(color));
  m.position.set(o.cx, height / 2 - 0.3, o.cz);
  return m;
}

export function buildStatic() {
  const g = new THREE.Group();
  for (const o of LAND) g.add(rectMesh(o, 6, 0x6f8a52));
  for (const o of BREAKWATERS) g.add(rectMesh(o, 3, 0x8a8f94));
  for (const o of DOCKS) {
    const pier = rectMesh(o, 1.6, 0x8b6b45);
    pier.position.y = 0.5;
    g.add(pier);
  }
  for (const o of ISLANDS) {
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.82, o.r, 9, 20), mat(0x7b7466));
    rock.position.set(o.cx, 3.5, o.cz);
    g.add(rock);
    const top = new THREE.Mesh(new THREE.ConeGeometry(o.r * 0.6, 14, 14), mat(0x4f7a3a));
    top.position.set(o.cx, 14, o.cz);
    g.add(top);
  }
  // Harbour landmark: a simple lighthouse on the north breakwater.
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 22, 12), mat(0xf2f2f2));
  tower.position.set(-640, 13, -190);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 12), mat(0xc0392b));
  cap.position.set(-640, 25, -190);
  g.add(tower, cap);
  return g;
}

export function buildBoat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 6.5), mat(0xe8eef2));
  hull.position.y = 0.45;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 4), mat(0xe8eef2));
  bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  bow.scale.set(1, 1, 0.38 / 0.5);
  bow.position.set(0, 0.45, -4.3);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.18, 6.55), mat(0xc0392b));
  stripe.position.y = 0.25;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 2.0), mat(0x2d3e50));
  cabin.position.set(0, 1.3, 0.3);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 2.2), mat(0xe8eef2));
  roof.position.set(0, 1.8, 0.3);
  g.add(hull, bow, stripe, cabin, roof);
  const outer = new THREE.Group();
  outer.add(g);
  return outer;
}

export function buildBuoys() {
  const group = new THREE.Group();
  const gates = [];
  ROUTE.forEach((cp, i) => {
    const next = ROUTE[Math.min(i + 1, ROUTE.length - 1)];
    const prev = ROUTE[Math.max(i - 1, 0)];
    // Gate axis perpendicular to the route direction through this checkpoint.
    let dx = next.x - prev.x, dz = next.z - prev.z;
    if (i === 0) { dx = 1; dz = 0; }
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len, pz = dx / len;
    const spread = 18;
    const left = makeBuoy(0xc0392b);
    const right = makeBuoy(0x2e8b57);
    left.position.set(cp.x + px * spread, 0, cp.z + pz * spread);
    right.position.set(cp.x - px * spread, 0, cp.z - pz * spread);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 120, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
    );
    beam.position.set(cp.x, 60, cp.z);
    group.add(left, right, beam);
    gates.push({ left, right, beam, positions: [left.position.clone(), right.position.clone()] });
  });
  return { group, gates };
}

function makeBuoy(color) {
  const b = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.6, 12), mat(color));
  body.position.y = 0.6;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), mat(0x333333));
  mast.position.y = 2.2;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat(color));
  top.position.y = 3.5;
  b.add(body, mast, top);
  return b;
}

export function updateBuoys(buoys, t, activeIndex) {
  buoys.gates.forEach((g, i) => {
    for (const buoy of [g.left, g.right]) {
      buoy.position.y = getWaterHeight(buoy.position.x, buoy.position.z, t) - 0.2;
    }
    g.beam.visible = i === activeIndex;
    g.beam.material.opacity = 0.22 + 0.08 * Math.sin(t * 3);
  });
}

// Place boat on the water: height at centre, pitch/roll from four sample points.
export function poseBoat(boat, s, t) {
  const sin = Math.sin(s.heading), cos = Math.cos(s.heading);
  const fx = sin, fz = -cos, rx = cos, rz = sin;
  const L = 3, W = 1.1;
  const hF = getWaterHeight(s.x + fx * L, s.z + fz * L, t);
  const hB = getWaterHeight(s.x - fx * L, s.z - fz * L, t);
  const hR = getWaterHeight(s.x + rx * W, s.z + rz * W, t);
  const hL = getWaterHeight(s.x - rx * W, s.z - rz * W, t);
  const pitch = Math.atan2(hF - hB, 2 * L);
  const roll = Math.atan2(hR - hL, 2 * W) + s.rudder * s.u * 0.012; // lean into turns
  boat.position.set(s.x, (hF + hB + hR + hL) / 4 - 0.1, s.z);
  boat.rotation.set(0, 0, 0);
  boat.rotation.order = 'YXZ';
  boat.rotation.y = -s.heading;
  boat.rotation.x = pitch;
  boat.rotation.z = -roll;
}

export function addLights(scene, sunDir) {
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x4a5a3a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
  sun.position.copy(sunDir).multiplyScalar(500);
  scene.add(sun);
}

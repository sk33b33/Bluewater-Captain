import * as THREE from 'three';
import { LAND, BREAKWATERS, DOCKS, ISLANDS } from '../sim/world.js';
import { gateBuoys } from '../data/missions.js';
import { PORTS } from '../data/ports.js';
import { getWaterHeight, WAVES } from '../sim/waves.js';

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
  // A coloured beacon on each port's pier so ports can be found from far out.
  for (const p of Object.values(PORTS)) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 18, 8), mat(0xeeeeee));
    mast.position.set(p.beacon.x, 9, p.beacon.z);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.3), mat(p.beacon.color));
    flag.position.set(p.beacon.x + 2.7, 16, p.beacon.z);
    g.add(mast, flag);
  }
  // Harbour landmark: a simple lighthouse on the north breakwater.
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 22, 12), mat(0xf2f2f2));
  tower.position.set(-640, 13, -190);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 12), mat(0xc0392b));
  cap.position.set(-640, 25, -190);
  g.add(tower, cap);
  return g;
}

// Boats are placeholder primitives sized from the vessel's real length and beam. Bow points to -z.
function addBox(g, w, h, l, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat(color));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

function hullWithBow(g, v, hullH) {
  const L = v.length;
  const W = v.beam;
  const bowLen = L * 0.22;
  addBox(g, W, hullH, L - bowLen, v.look.hull, 0, hullH / 2, bowLen / 2);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(W / 2 * 1.41, bowLen, 4), mat(v.look.hull));
  bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  bow.scale.set(1, 1, 0.76);
  bow.position.set(0, hullH / 2, -L / 2 + bowLen / 2 - 0.05);
  g.add(bow);
  addBox(g, W + 0.05, hullH * 0.2, L - bowLen + 0.05, v.look.stripe, 0, hullH * 0.3, bowLen / 2);
}

export function buildBoat(v) {
  const g = new THREE.Group();
  if (v.class === 'workboat') {
    hullWithBow(g, v, 1.5);
    addBox(g, v.beam * 0.62, 2.0, 2.8, v.look.cabin, 0, 2.5, -v.length * 0.12); // wheelhouse forward
    addBox(g, v.beam * 0.7, 0.14, 3.1, v.look.roof, 0, 3.55, -v.length * 0.12);
    addBox(g, v.beam * 0.9, 0.5, v.length * 0.28, 0x555555, 0, 1.75, v.length * 0.3); // work deck gear
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.2, 8), mat(v.look.roof));
    mast.position.set(v.beam * 0.3, 3.6, v.length * 0.2);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 8), mat(v.look.roof));
    boom.rotation.z = Math.PI / 2.8;
    boom.position.set(v.beam * 0.3 + 1.2, 5.3, v.length * 0.2);
    g.add(mast, boom);
  } else if (v.class === 'coastal-passenger') {
    hullWithBow(g, v, 1.3);
    addBox(g, v.beam * 0.86, 1.7, v.length * 0.6, v.look.cabin, 0, 2.15, v.length * 0.05); // long cabin
    addBox(g, v.beam * 0.9, 0.5, v.length * 0.62, 0x274b66, 0, 2.5, v.length * 0.05); // window band
    addBox(g, v.beam * 0.9, 0.14, v.length * 0.64, v.look.roof, 0, 3.1, v.length * 0.05);
    addBox(g, v.beam * 0.5, 1.0, v.length * 0.2, v.look.cabin, 0, 3.7, -v.length * 0.05); // upper wheelhouse
    addBox(g, v.beam * 0.56, 0.12, v.length * 0.22, v.look.roof, 0, 4.25, -v.length * 0.05);
  } else {
    hullWithBow(g, v, 0.9);
    addBox(g, v.beam * 0.7, 0.9, 2.0, v.look.cabin, 0, 1.3, 0.3);
    addBox(g, v.beam * 0.8, 0.12, 2.2, v.look.roof, 0, 1.8, 0.3);
  }
  const outer = new THREE.Group();
  outer.add(g);
  return outer;
}

export function buildBuoys(waypoints, start) {
  const group = new THREE.Group();
  const gates = [];
  waypoints.forEach((_, i) => {
    const [a, b] = gateBuoys(waypoints, i, start);
    const left = makeBuoy(0xc0392b);
    const right = makeBuoy(0x2e8b57);
    left.position.set(a.x, 0, a.z);
    right.position.set(b.x, 0, b.z);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 120, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
    );
    beam.position.set(waypoints[i].x, 60, waypoints[i].z);
    group.add(left, right, beam);
    gates.push({ left, right, beam, positions: [left.position.clone(), right.position.clone()] });
  });
  return { group, gates };
}

// Translucent berth volume with corner posts and a tall beam so the destination is visible from afar.
export function buildBerth(berth) {
  const group = new THREE.Group();
  group.position.set(berth.cx, 0, berth.cz);
  group.rotation.y = -berth.heading;
  const w = berth.halfWidth * 2;
  const l = berth.halfLength * 2;
  const fill = new THREE.MeshBasicMaterial({ color: 0x35d08a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, 3, l), fill);
  box.position.y = 1.5;
  const lineMat = new THREE.LineBasicMaterial({ color: 0x35d08a });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), lineMat);
  edges.position.copy(box.position);
  group.add(box, edges);
  const postMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3.6, 8), postMat);
      post.position.set(sx * berth.halfWidth, 1.6, sz * berth.halfLength);
      group.add(post);
    }
  }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x35d08a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 70, 12, 1, true), beamMat);
  beam.position.y = 35;
  group.add(beam);
  const colors = { idle: 0x35d08a, near: 0xffc247, hold: 0x7dffb5 };
  group.userData.setState = (state) => {
    const c = colors[state] ?? colors.idle;
    fill.color.setHex(c);
    lineMat.color.setHex(c);
    beamMat.color.setHex(c);
    fill.opacity = state === 'hold' ? 0.32 : 0.16;
  };
  return group;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });
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

export function updateBuoys(buoys, t, activeIndex, waves = WAVES) {
  buoys.gates.forEach((g, i) => {
    for (const buoy of [g.left, g.right]) {
      buoy.position.y = getWaterHeight(buoy.position.x, buoy.position.z, t, waves) - 0.2;
    }
    g.beam.visible = i === activeIndex;
    g.beam.material.opacity = 0.22 + 0.08 * Math.sin(t * 3);
  });
}

// Place boat on the water: height at centre, pitch/roll from four sample points sized to the vessel.
export function poseBoat(boat, s, t, v, waves = WAVES) {
  const sin = Math.sin(s.heading), cos = Math.cos(s.heading);
  const fx = sin, fz = -cos, rx = cos, rz = sin;
  const L = v.length * 0.46, W = v.beam * 0.46;
  const hF = getWaterHeight(s.x + fx * L, s.z + fz * L, t, waves);
  const hB = getWaterHeight(s.x - fx * L, s.z - fz * L, t, waves);
  const hR = getWaterHeight(s.x + rx * W, s.z + rz * W, t, waves);
  const hL = getWaterHeight(s.x - rx * W, s.z - rz * W, t, waves);
  const pitch = Math.atan2(hF - hB, 2 * L);
  const roll = Math.atan2(hR - hL, 2 * W) + (s.rudder * s.u * 0.012) / (1 + v.massTonnes * 0.08); // heavier boats lean less
  boat.position.set(s.x, (hF + hB + hR + hL) / 4 - 0.1, s.z);
  boat.rotation.set(0, 0, 0);
  boat.rotation.order = 'YXZ';
  boat.rotation.y = -s.heading;
  boat.rotation.x = pitch;
  boat.rotation.z = -roll;
}

export function addLights(scene, sunDir) {
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a5a3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
  sun.position.copy(sunDir).multiplyScalar(500);
  scene.add(sun);
  return { hemi, sun };
}

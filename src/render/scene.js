import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

// A commercial quay: concrete deck 3 m up, gantry cranes along it (the scale cue: 45 m tall) and container stacks.
function buildQuay(o) {
  const g = new THREE.Group();
  const deck = rectMesh(o, 3.4, 0x8d9296);
  deck.position.y = 1.4;
  g.add(deck);
  const alongX = o.hx >= o.hz; // quay runs east-west, or north-south
  const length = (alongX ? o.hx : o.hz) * 2;
  const dir = alongX ? [1, 0] : [0, 1];
  const side = alongX ? [0, -1] : [-1, 0]; // the water side the ships lie on
  const half = alongX ? o.hz : o.hx;
  // cranes: merged into one mesh so they cost one draw call
  const parts = [];
  const box = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); parts.push(b); };
  const cranes = 3;
  for (let i = 0; i < cranes; i++) {
    const t = (i + 0.5) / cranes - 0.5;
    const cx = o.cx + dir[0] * t * length * 0.75 + side[0] * (half - 2);
    const cz = o.cz + dir[1] * t * length * 0.75 + side[1] * (half - 2);
    // legs, portal beam, boom out over the water, cab
    for (const sx of [-6, 6]) for (const sz of [-4, 4]) box(1.2, 40, 1.2, cx + (alongX ? sx : sz), 21, cz + (alongX ? sz : sx));
    box(alongX ? 15 : 10, 2.5, alongX ? 10 : 15, cx, 41, cz);
    box(alongX ? 3 : 55, 2.5, alongX ? 55 : 3, cx + side[0] * 26, 44, cz + side[1] * 26);
    box(5, 5, 5, cx, 44, cz);
  }
  const craneMesh = new THREE.Mesh(mergeGeometries(parts), mat(0xe2a73a));
  g.add(craneMesh);
  // container stacks on the land side, instanced: one draw call for all of them
  const palette = [0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22, 0x8e44ad, 0xbdc3c7, 0xf1c40f];
  const stacks = [];
  const slots = Math.floor(length / 14);
  for (let i = 0; i < slots; i++) for (let row = 0; row < 2; row++) {
    const t = (i + 0.5) / slots - 0.5;
    const tiers = 1 + ((i * 7 + row * 3) % 3);
    for (let h = 0; h < tiers; h++) {
      stacks.push({
        x: o.cx + dir[0] * t * length * 0.9 - side[0] * (half - 14 - row * 12),
        y: 3.1 + 1.4 + h * 2.7,
        z: o.cz + dir[1] * t * length * 0.9 - side[1] * (half - 14 - row * 12),
        c: palette[(i * 5 + row * 2 + h) % palette.length],
      });
    }
  }
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(alongX ? 12 : 2.6, 2.6, alongX ? 2.6 : 12), mat(0xffffff), stacks.length);
  const m4 = new THREE.Matrix4();
  stacks.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); boxes.setMatrixAt(i, m4); boxes.setColorAt(i, new THREE.Color(p.c)); });
  g.add(boxes);
  return g;
}

export function buildStatic() {
  const g = new THREE.Group();
  for (const o of LAND) g.add(rectMesh(o, 6, 0x6f8a52));
  for (const o of BREAKWATERS) g.add(rectMesh(o, 3, 0x8a8f94));
  for (const o of DOCKS) {
    if (/quay/i.test(o.name)) { g.add(buildQuay(o)); continue; }
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
  } else if (v.class === 'cargo-ship') {
    hullWithBow(g, v, 6);
    const L = v.length, W = v.beam;
    // four hatch covers forward of the bridge, two deck cranes between them
    for (let i = 0; i < 4; i++) addBox(g, W * 0.72, 0.9, L * 0.12, 0x6b7a86, 0, 6.4, -L * 0.3 + i * L * 0.15);
    for (const z of [-L * 0.225, L * 0.075]) {
      addBox(g, 0.9, 11, 0.9, 0xe2a73a, W * 0.3, 11, z);
      addBox(g, 0.7, 0.7, 14, 0xe2a73a, W * 0.3, 16, z - 5);
    }
    // bridge house and funnel aft
    addBox(g, W * 0.8, 9, L * 0.1, v.look.cabin, 0, 10.5, L * 0.36);
    addBox(g, W * 0.86, 0.6, L * 0.115, 0x2c3e50, 0, 15.2, L * 0.36);
    addBox(g, W * 0.4, 6, L * 0.05, 0xb23a2e, 0, 17, L * 0.42);
  } else if (v.class === 'container-carrier') {
    hullWithBow(g, v, 8);
    const L = v.length, W = v.beam;
    // container stacks on deck, instanced (one draw call): bays along the ship, rows across it
    const palette = [0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22, 0x8e44ad, 0xbdc3c7, 0xf1c40f, 0x16a085];
    const bays = Math.floor((L * 0.62) / 6.4);
    const rows = Math.floor((W - 3) / 2.7);
    const cells = [];
    for (let b = 0; b < bays; b++) for (let r = 0; r < rows; r++) {
      const tiers = 3 + ((b * 5 + r * 3) % 3);
      for (let t = 0; t < tiers; t++) cells.push({ x: (r - (rows - 1) / 2) * 2.7, y: 8.4 + t * 2.7, z: -L * 0.46 + b * 6.4 + 3.2, c: palette[(b * 3 + r * 5 + t) % palette.length] });
    }
    const stacks = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 2.6, 6.1), mat(0xffffff), cells.length);
    const m4 = new THREE.Matrix4();
    cells.forEach((c, i) => { m4.makeTranslation(c.x, c.y, c.z); stacks.setMatrixAt(i, m4); stacks.setColorAt(i, new THREE.Color(c.c)); });
    g.add(stacks);
    // bridge house and funnel aft, tall enough to see over the stacks
    addBox(g, W * 0.74, 14, L * 0.07, v.look.cabin, 0, 15, L * 0.4);
    addBox(g, W * 0.8, 0.7, L * 0.08, 0x2c3e50, 0, 22.4, L * 0.4);
    addBox(g, W * 0.3, 7, L * 0.04, 0xc0392b, 0, 25, L * 0.455);
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

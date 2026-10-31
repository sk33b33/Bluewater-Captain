// The chart screen: a 2D map of Bluewater Bay with ports, markers and legs, where the player picks or builds a
// route between two ports. Drawing and picking maths are exported so they can be tested.
import { REGION, staticObstacles } from '../sim/world.js';
import { NODES, EDGES } from '../data/charts.js';
import { PORTS, BERTHS, portView } from '../data/ports.js';
import { SHOALS } from '../sim/world.js';
import { LEGS, legPassable } from '../sim/routes.js';
import { formatTime } from '../sim/route.js';

const MARGIN = 150; // metres of open water drawn around the region
const SPAN = REGION.maxX - REGION.minX + 2 * MARGIN;

export const toPx = (x, size) => ((x - REGION.minX + MARGIN) / SPAN) * size;
export const fromPx = (px, size) => (px / size) * SPAN + REGION.minX - MARGIN;

// Nearest chart marker within `radiusPx` of a canvas point, or null.
export function pickNode(px, py, size, radiusPx = 16) {
  let best = null, bestD = radiusPx;
  for (const n of NODES) {
    const d = Math.hypot(toPx(n.x, size) - px, toPx(n.z, size) - py);
    if (d <= bestD) { best = n; bestD = d; }
  }
  return best;
}

const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// ctx: { path: [ids], routes: [route], selectedIndex, nextIds: [ids], from, to }
export function drawChart(canvas, ctx) {
  const size = canvas.width;
  const g = canvas.getContext('2d');
  const px = (x) => toPx(x, size);
  const pz = (z) => toPx(z, size);
  const k = size / SPAN;
  g.clearRect(0, 0, size, size);
  g.fillStyle = '#17506f';
  g.fillRect(0, 0, size, size);

  // region border and 1 km grid
  g.strokeStyle = 'rgba(255,255,255,.10)';
  g.lineWidth = 1;
  g.setLineDash([]);
  for (let v = REGION.minX; v <= REGION.maxX; v += 1000) {
    g.beginPath(); g.moveTo(px(v), pz(REGION.minZ)); g.lineTo(px(v), pz(REGION.maxZ)); g.stroke();
    g.beginPath(); g.moveTo(px(REGION.minX), pz(v)); g.lineTo(px(REGION.maxX), pz(v)); g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,.45)';
  g.setLineDash([6, 5]);
  g.strokeRect(px(REGION.minX), pz(REGION.minZ), px(REGION.maxX) - px(REGION.minX), pz(REGION.maxZ) - pz(REGION.minZ));
  g.setLineDash([]);

  // shoals: pale shallows (only deep-draft ships are kept out of them)
  g.fillStyle = 'rgba(120,200,185,.45)';
  for (const sh of SHOALS) {
    if (sh.type === 'circle') { g.beginPath(); g.arc(px(sh.cx), pz(sh.cz), sh.r * k, 0, Math.PI * 2); g.fill(); }
    else g.fillRect(px(sh.cx - sh.hx), pz(sh.cz - sh.hz), px(sh.cx + sh.hx) - px(sh.cx - sh.hx), pz(sh.cz + sh.hz) - pz(sh.cz - sh.hz));
  }

  // land, islands, piers and quays
  for (const o of staticObstacles()) {
    const pier = /pier|quay/i.test(o.name), wall = o.name.includes('Breakwater');
    g.fillStyle = pier ? '#9a7a4e' : wall ? '#8a8f94' : '#5f8a4c';
    if (o.type === 'circle') {
      g.beginPath(); g.arc(px(o.cx), pz(o.cz), Math.max(2.5, o.r * k), 0, Math.PI * 2); g.fill();
    } else {
      const x0 = Math.max(0, px(o.cx - o.hx)), z0 = Math.max(0, pz(o.cz - o.hz));
      const x1 = Math.min(size, px(o.cx + o.hx)), z1 = Math.min(size, pz(o.cz + o.hz));
      g.fillRect(x0, z0, Math.max(2, x1 - x0), Math.max(2, z1 - z0));
    }
  }

  // charted legs
  const node = Object.fromEntries(NODES.map((n) => [n.id, n]));
  for (const [a, b] of EDGES) {
    const leg = LEGS.get(`${a}-${b}`);
    g.lineWidth = 1.5;
    const blocked = ctx.vessel && !legPassable(leg, ctx.vessel);
    g.strokeStyle = blocked ? 'rgba(255,110,110,.35)' : leg.narrow ? 'rgba(255,170,90,.8)' : 'rgba(190,225,245,.35)';
    g.setLineDash(blocked ? [2, 5] : leg.narrow ? [5, 4] : []);
    g.beginPath(); g.moveTo(px(node[a].x), pz(node[a].z)); g.lineTo(px(node[b].x), pz(node[b].z)); g.stroke();
  }
  g.setLineDash([]);

  // other suggested routes, faint
  const palette = ['#7fd6ff', '#c79bff', '#8ef0a8'];
  (ctx.routes || []).forEach((r, i) => {
    if (i === ctx.selectedIndex) return;
    g.strokeStyle = palette[i % palette.length];
    g.globalAlpha = 0.55;
    g.lineWidth = 3;
    polyline(g, r.path.map((id) => node[id]), px, pz);
    g.globalAlpha = 1;
  });

  // the chosen route, bold, with a leg out of the berth and into the destination berth
  if (ctx.path && ctx.path.length) {
    const from = portView(ctx.from, ctx.vessel), to = portView(ctx.to, ctx.vessel);
    const pts = [{ x: BERTHS[from.berth].cx, z: BERTHS[from.berth].cz }, ...ctx.path.map((id) => node[id])];
    if (ctx.path[ctx.path.length - 1] === to.fairway) pts.push(...to.inbound, { x: BERTHS[to.berth].cx, z: BERTHS[to.berth].cz });
    g.strokeStyle = '#ffd34d';
    g.lineWidth = 4.5;
    g.lineJoin = 'round';
    polyline(g, pts, px, pz);
  }

  // next-marker highlights
  for (const id of ctx.nextIds || []) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath(); g.arc(px(node[id].x), pz(node[id].z), 11, 0, Math.PI * 2); g.stroke();
  }

  // markers
  g.font = '600 11px system-ui, sans-serif';
  g.textBaseline = 'middle';
  for (const n of NODES) {
    const onPath = ctx.path && ctx.path.includes(n.id);
    g.fillStyle = onPath ? '#ffd34d' : '#e6f3fa';
    g.beginPath(); g.arc(px(n.x), pz(n.z), onPath ? 5 : 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(8,24,38,.85)';
    const w = g.measureText(n.id).width;
    g.fillRect(px(n.x) + 6, pz(n.z) - 7, w + 5, 14);
    g.fillStyle = '#fff';
    g.fillText(n.id, px(n.x) + 8, pz(n.z));
  }

  // ports
  g.font = '700 12px system-ui, sans-serif';
  for (const p of Object.values(PORTS)) {
    if (p.deep) {
      const db = BERTHS[p.deep.berth];
      g.fillStyle = '#' + p.beacon.color.toString(16).padStart(6, '0');
      g.strokeStyle = '#fff'; g.lineWidth = 1;
      g.beginPath(); g.rect(px(db.cx - db.halfLength) , pz(db.cz - 6), px(db.cx + db.halfLength) - px(db.cx - db.halfLength), 12); g.fill(); g.stroke();
    }
    const b = BERTHS[(p.berth)];
    const x = px(b.cx), z = pz(b.cz);
    const color = `#${p.beacon.color.toString(16).padStart(6, '0')}`;
    const isEnd = p.id === ctx.from || p.id === ctx.to;
    g.fillStyle = color;
    g.strokeStyle = '#fff';
    g.lineWidth = isEnd ? 3 : 1.5;
    g.beginPath(); g.arc(x, z, isEnd ? 8 : 6, 0, Math.PI * 2); g.fill(); g.stroke();
    const label = p.id === ctx.from ? `${p.name} (start)` : p.id === ctx.to ? `${p.name} (finish)` : p.name;
    const w = g.measureText(label).width;
    const lx = Math.min(size - w - 6, Math.max(4, x + 12));
    const lz = Math.min(size - 10, Math.max(10, z - 12));
    g.fillStyle = 'rgba(8,24,38,.88)';
    g.fillRect(lx - 3, lz - 8, w + 6, 16);
    g.fillStyle = '#fff';
    g.fillText(label, lx, lz);
  }

  // scale bar: 1 km
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(14, size - 16); g.lineTo(14 + 1000 * k, size - 16); g.stroke();
  g.fillStyle = '#fff';
  g.font = '11px system-ui, sans-serif';
  g.fillText('1 km', 18, size - 26);
}

function polyline(g, pts, px, pz) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(px(p.x), pz(p.z)) : g.moveTo(px(p.x), pz(p.z))));
  g.stroke();
}

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export function createChart(h) {
  const canvas = $('chart-canvas');
  let last = null;

  canvas.addEventListener('click', (e) => {
    if (!last || !last.planning) return;
    const r = canvas.getBoundingClientRect();
    const scale = canvas.width / r.width;
    const n = pickNode((e.clientX - r.left) * scale, (e.clientY - r.top) * scale, canvas.width, 16 * scale);
    if (n) h.onMarker(n.id);
  });
  $('chart-add').addEventListener('click', () => { const v = $('chart-next').value; if (v) h.onMarker(v); });
  $('chart-undo').addEventListener('click', () => h.onUndo());
  $('chart-reset').addEventListener('click', () => h.onReset());
  $('chart-confirm').addEventListener('click', () => h.onConfirm());
  $('chart-cancel').addEventListener('click', () => h.onCancel());

  return {
    // ctx: { planning, mission, vessel, from, to, routes, selectedIndex, path, next: [{id,name,length,narrow}], summary: {...}, message }
    show(ctx) {
      last = ctx;
      $('chart').classList.remove('hidden');
      $('chart').classList.toggle('view-only', !ctx.planning);
      $('chart-title').textContent = ctx.planning ? `Plan route: ${PORTS[ctx.from].name} to ${PORTS[ctx.to].name}` : 'Chart of Bluewater Bay';
      $('chart-sub').textContent = ctx.planning
        ? `${ctx.mission.title}, sailing the ${ctx.vessel.name}. Pick a suggested route or build your own marker by marker. Dashed orange legs are narrow passages.`
        : 'Four ports, charted markers and the legs between them. Open a job and choose "Plan route" to sail one.';

      const routes = $('chart-routes');
      routes.textContent = '';
      (ctx.routes || []).forEach((r, i) => {
        const b = el('button', 'ghost route-btn' + (i === ctx.selectedIndex ? ' on' : ''), `${r.name}: ${km(r.length)}`);
        b.type = 'button';
        b.id = `route-${i}`;
        b.title = r.via || 'The shortest way';
        b.addEventListener('click', () => h.onPickRoute(i));
        routes.appendChild(b);
      });

      const legs = $('chart-legs');
      legs.textContent = '';
      const path = ctx.path || [];
      for (let i = 1; i < path.length; i++) {
        const leg = LEGS.get(`${path[i - 1]}-${path[i]}`);
        const names = NODES.filter((n) => n.id === path[i - 1] || n.id === path[i]);
        const a = names.find((n) => n.id === path[i - 1]), b = names.find((n) => n.id === path[i]);
        legs.appendChild(el('li', leg.narrow ? 'narrow' : '', `${a.name} to ${b.name}: ${km(leg.length)}${leg.narrow ? ' (narrow passage)' : ''}`));
      }
      if (!path.length) legs.appendChild(el('li', '', 'No route yet.'));

      const s = ctx.summary;
      $('chart-summary').textContent = s ? `${km(s.length)} total, about ${formatTime(s.seconds)} at cruise. Deadline ${formatTime(s.deadline)}.` : '';
      $('chart-hazards').textContent = s && s.hazards.length ? s.hazards.join(' ') : '';
      $('chart-msg').textContent = ctx.message || '';

      const next = $('chart-next');
      next.textContent = '';
      for (const n of ctx.next || []) {
        const o = document.createElement('option');
        o.value = n.id;
        o.textContent = `${n.name} (${km(n.length)}${n.narrow ? ', narrow' : ''})`;
        next.appendChild(o);
      }
      next.disabled = !(ctx.next && ctx.next.length);
      $('chart-add').disabled = next.disabled;
      $('chart-undo').disabled = path.length <= 1;
      $('chart-confirm').disabled = !(ctx.complete);

      const ports = $('chart-ports');
      ports.textContent = '';
      for (const p of Object.values(PORTS)) {
        const li = el('li');
        const lim = p.minLength > 0 ? `vessels ${p.minLength} to ${p.maxLength} m` : `vessels up to ${p.maxLength} m`;
        const deep = p.deep ? ` Deep-water terminal: ${p.deep.minLength} to ${p.deep.maxLength} m, slow zone ${p.deep.speedLimit.knots} kn.` : '';
        li.append(el('b', '', p.name), el('span', 'note', `  ${p.blurb} Slow zone ${p.speedLimit.knots} kn, ${lim}.${deep}`));
        ports.appendChild(li);
      }

      const size = Math.min(900, Math.max(360, Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1)) || 600));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
      drawChart(canvas, { path, routes: ctx.routes, selectedIndex: ctx.selectedIndex, nextIds: (ctx.next || []).map((n) => n.id), from: ctx.from, to: ctx.to, vessel: ctx.vessel });
    },
    hide() { $('chart').classList.add('hidden'); },
  };
}

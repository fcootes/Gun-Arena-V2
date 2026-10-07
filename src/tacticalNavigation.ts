import * as THREE from 'three';
import type { WorldCollider } from './types';

export function traversalBlocked(from: THREE.Vector3, to: THREE.Vector3, colliders: readonly WorldCollider[], team?: string): boolean {
  for (const c of colliders) {
    if (c.active === false || (team && c.passThroughTeam === team) || c.isStair || c.isRamp || c.maxY <= Math.min(from.y, to.y) + .6 || c.minY >= Math.max(from.y, to.y) + 1.8) continue;
    let low = 0, high = 1;
    for (const axis of ['x', 'z'] as const) {
      const a = from[axis], d = to[axis] - a;
      const min = (axis === 'x' ? c.minX : c.minZ) - .4, max = (axis === 'x' ? c.maxX : c.maxZ) + .4;
      if (Math.abs(d) < 1e-8) { if (a < min || a > max) { low = 2; break; } }
      else { const p = (min - a) / d, q = (max - a) / d; low = Math.max(low, Math.min(p, q)); high = Math.min(high, Math.max(p, q)); }
    }
    if (low <= high && low <= 1 && high >= 0) return true;
  }
  return false;
}

/** Sampled Training Grounds graph; Area 51 and Pacific Rim own their authored graphs. */
export function createTacticalNavigation(_map: 'training', colliders: WorldCollider[], height: (x: number, z: number, foot: number) => number) {
  const step = 4, points: THREE.Vector3[] = [], cells = new Map<string, number>();
  const minX = -92, maxX = 92, minZ = -92, maxZ = 92;
  for (let x = minX; x <= maxX; x += step) for (let z = minZ; z <= maxZ; z += step) {
    const p = new THREE.Vector3(x, height(x, z, 0), z);
    if (colliders.some(c => !c.isDoor && !c.passThroughTeam && c.active !== false && !c.isRamp && !c.isStair && c.maxY > p.y + .6 && c.minY < p.y + 1.8 && x > c.minX - .4 && x < c.maxX + .4 && z > c.minZ - .4 && z < c.maxZ + .4)) continue;
    cells.set(`${x},${z}`, points.length); points.push(p);
  }
  const links = points.map(p => {
    const result: number[] = [];
    for (const dx of [-step, 0, step]) for (const dz of [-step, 0, step]) {
      if (!dx && !dz) continue;
      const i = cells.get(`${p.x + dx},${p.z + dz}`);
      if (i !== undefined && Math.abs(points[i].y - p.y) < 1) result.push(i);
    }
    return result;
  });
  const scratch = new THREE.Vector3();
  const g = new Float64Array(points.length), previous = new Int32Array(points.length), open = new Set<number>();
  const nearest = (position: THREE.Vector3, team?: string) => {
    let index = -1, distance = Infinity;
    points.forEach((p, i) => { const d = p.distanceToSquared(position); if (d < distance && !traversalBlocked(position, p, colliders, team)) { index = i; distance = d; } });
    return index;
  };
  function target(from: THREE.Vector3, destination: THREE.Vector3, team?: string) {
    if (!traversalBlocked(from, destination, colliders, team) && Math.abs(from.y - destination.y) < 1) return destination;
    const start = nearest(from, team), goal = nearest(destination, team);
    if (start < 0 || goal < 0) return from;
    g.fill(Infinity); previous.fill(-1); open.clear(); open.add(start);
    g[start] = 0;
    while (open.size) {
      let best = -1, score = Infinity;
      for (const i of open) { const s = g[i] + points[i].distanceTo(points[goal]); if (s < score) { best = i; score = s; } }
      if (best === goal) break;
      open.delete(best);
      for (const next of links[best]) {
        if (traversalBlocked(points[best], points[next], colliders, team)) continue;
        const cost = g[best] + points[best].distanceTo(points[next]);
        if (cost < g[next]) { g[next] = cost; previous[next] = best; open.add(next); }
      }
    }
    if (!Number.isFinite(g[goal])) return from;
    let next = goal;
    while (previous[next] !== start && previous[next] >= 0) next = previous[next];
    return scratch.copy(points[next]);
  }
  return { points, target };
}

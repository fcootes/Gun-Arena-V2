import type { WorldCollider } from './types';

/** Conservative X/Z broad phase. Exact tests inspect live Y, active and team flags.
 * Bounds changes require remove/add. Facility doors toggle active without moving bounds.
 */
export class ColliderIndex {
  private cells = new Map<number, Map<number, Set<WorldCollider>>>();
  private membership = new Map<WorldCollider, [number, number][]>();
  private seen = new Map<WorldCollider, number>();
  private queryId = 0;
  private results: WorldCollider[] = [];
  constructor(private cellSize = 8) {}
  add(c: WorldCollider) {
    this.remove(c);
    const keys: [number, number][] = [];
    for (let x = Math.floor(c.minX / this.cellSize); x <= Math.floor(c.maxX / this.cellSize); x++)
      for (let z = Math.floor(c.minZ / this.cellSize); z <= Math.floor(c.maxZ / this.cellSize); z++) {
        let column = this.cells.get(x);
        if (!column) { column = new Map(); this.cells.set(x, column); }
        let bucket = column.get(z);
        if (!bucket) { bucket = new Set(); column.set(z, bucket); }
        bucket.add(c); keys.push([x, z]);
      }
    this.membership.set(c, keys);
  }
  remove(c: WorldCollider) {
    for (const [x, z] of this.membership.get(c) ?? []) {
      const column = this.cells.get(x)!, bucket = column.get(z)!;
      bucket.delete(c); if (!bucket.size) column.delete(z); if (!column.size) this.cells.delete(x);
    }
    this.membership.delete(c); this.seen.delete(c);
  }
  /** Scratch result is valid until the next query; consume synchronously, never retain. */
  query(minX: number, maxX: number, minZ: number, maxZ: number): readonly WorldCollider[] {
    const result = this.results; result.length = 0;
    const id = ++this.queryId;
    for (let x = Math.floor(minX / this.cellSize); x <= Math.floor(maxX / this.cellSize); x++) {
      const column = this.cells.get(x); if (!column) continue;
      for (let z = Math.floor(minZ / this.cellSize); z <= Math.floor(maxZ / this.cellSize); z++) {
        const bucket = column.get(z); if (!bucket) continue;
        for (const c of bucket) {
          if (this.seen.get(c) === id) continue;
          this.seen.set(c, id);
          if (c.maxX >= minX && c.minX <= maxX && c.maxZ >= minZ && c.minZ <= maxZ) result.push(c);
        }
      }
    }
    return result;
  }
  clear() { this.cells.clear(); this.membership.clear(); this.seen.clear(); this.results.length = 0; }
}

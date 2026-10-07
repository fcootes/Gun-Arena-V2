import type { GameMode, WorldMapId } from './types';

export const DEFAULT_OPERATIONAL_MAP: WorldMapId = 'area51';
export const OPERATIONAL_MAPS = [
  { id: 'shattered_wall', label: 'SHATTERED WALL' },
  { id: 'area51', label: 'AREA 51 SUBTERRANEAN FACILITY' },
  { id: 'training', label: 'TRAINING FIELD' },
] as const;

/** Unknown/retired registrations cannot select a legacy geometry builder. */
export function resolveMapId(value: unknown): WorldMapId {
  return OPERATIONAL_MAPS.some(map => map.id === value) ? value as WorldMapId : DEFAULT_OPERATIONAL_MAP;
}
export function mapForMode(value: unknown, mode: GameMode): WorldMapId {
  const map = resolveMapId(value);
  return map === 'training' && (mode === 'zombie' || mode === 'extraction') ? DEFAULT_OPERATIONAL_MAP : map;
}

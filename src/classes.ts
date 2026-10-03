import type { ClassId, ClassConfig } from './types';

export const CLASSES: Record<ClassId, ClassConfig> = {
  assault: {
    id: 'assault',
    icon: 'delta',
    name: 'ASSAULT',
    tagline: 'FRONTLINE RIFLE SPECIALIST',
    perkName: 'TACTICAL SLEIGHT OF HAND',
    perkDesc: '+25% Faster Weapon Reload Animation Speed across all guns',
    color: '#57d1c9',
    defaultPrimary: 'ar',
    defaultSecondary: 'pistol',
    reloadMultiplier: 0.75, // 25% faster reload duration
    speedMultiplier: 1.0,
    maxHealth: 100,
    initialHealth: 100,
    maxShield: 100,
    initialShield: 100
  },
  engineer: {
    id: 'engineer',
    icon: 'gear',
    name: 'ENGINEER',
    tagline: 'FORTIFIED DEMOLITIONS & DEFENSE',
    perkName: 'OVERCHARGED ENERGY GRID',
    perkDesc: '150 Overcharged Blue Shield points and reinforced blast protection',
    color: '#3f8fe0',
    defaultPrimary: 'shotgun',
    defaultSecondary: 'railgun',
    reloadMultiplier: 1.0,
    speedMultiplier: 1.0,
    maxHealth: 100,
    initialHealth: 100,
    maxShield: 150,
    initialShield: 150
  },
  medic: {
    id: 'medic',
    icon: 'cross',
    name: 'MEDIC',
    tagline: 'COMBAT TRIAGE & SHIELD BIO-GEN',
    perkName: 'FIELD TRIAGE NANITES',
    perkDesc: 'Reinforced 125 HP & 125 Shield with rapid biological regeneration',
    color: '#22c55e',
    defaultPrimary: 'br',
    defaultSecondary: 'pistol',
    reloadMultiplier: 0.9,
    speedMultiplier: 1.05,
    maxHealth: 125,
    initialHealth: 125,
    maxShield: 125,
    initialShield: 125
  },
  support: {
    id: 'support',
    icon: 'ammo',
    name: 'SUPPORT',
    tagline: 'HEAVY SUPPRESSION TANK',
    perkName: 'TITAN ARMORED PLATING',
    perkDesc: 'Boosts max White Health pool to 200 points (-15% Movement Velocity penalty)',
    color: '#e0473f',
    defaultPrimary: 'minigun',
    defaultSecondary: 'lmg',
    reloadMultiplier: 1.0,
    speedMultiplier: 0.85, // -15% movement velocity
    maxHealth: 200,
    initialHealth: 200,
    maxShield: 100,
    initialShield: 100
  },
  recon: {
    id: 'recon',
    icon: 'crosshair',
    name: 'RECON',
    tagline: 'HIGH-VELOCITY SCOUT & MARKSMAN',
    perkName: 'LIGHTWEIGHT AGILITY',
    perkDesc: '+20% Base Walking & Sprinting Velocity',
    color: '#00e5ff',
    defaultPrimary: 'sniper',
    defaultSecondary: 'smg',
    reloadMultiplier: 1.0,
    speedMultiplier: 1.20, // +20% movement velocity
    maxHealth: 100,
    initialHealth: 100,
    maxShield: 100,
    initialShield: 100
  },
};

// Progression Ledger System: XP, Combat Funds, Rank Tiers (1 to 50), and Unlocks
// Persisted seamlessly in browser localStorage

export interface MatchRewardBreakdown {
  kills: number;
  killXp: number;
  killFunds: number;
  wavesCleared: number;
  waveXp: number;
  waveFunds: number;
  victory: boolean;
  victoryXp: number;
  victoryFunds: number;
  totalXpEarned: number;
  totalFundsEarned: number;
  prevXp: number;
  prevFunds: number;
  newXp: number;
  newFunds: number;
  prevRank: number;
  newRank: number;
  leveledUp: boolean;
}

export interface FactionCareerLedger {
  totalXp: number;
  combatFunds: number;
  rank: number;
  totalKills: number;
  totalHeadshots: number;
  totalShots: number;
  totalHits: number;
  highestWave: number;
  matchesPlayed: number;
  matchesWon: number;
  unlockedItems: string[]; // List of unlocked item IDs (e.g., 'fast_helmet', 'railgun', etc.)
  lastMatchBreakdown?: MatchRewardBreakdown;
}

// 50 Rank Tiers configuration
export interface RankTierInfo {
  rank: number;
  title: string;
  badge: string;
  minXp: number;
  nextXp: number;
  unlockReward?: {
    id: string;
    type: 'gear' | 'weapon' | 'cosmetic';
    name: string;
    desc: string;
  };
}

// Formula: XP requirement increases progressively
// Rank 1: 0 XP
// Rank 2: 500 XP
// Rank 3: 1200 XP
// ... up to Rank 50
export const getXpForRank = (rank: number): number => {
  if (rank <= 1) return 0;
  // Quadratic XP progression curve
  return Math.floor(250 * Math.pow(rank - 1, 1.45) + (rank - 1) * 200);
};

export const getRankFromXp = (xp: number): number => {
  let rank = 1;
  while (rank < 50 && xp >= getXpForRank(rank + 1)) {
    rank++;
  }
  return rank;
};

// Rank Titles & Milestone Unlocks
export const RANK_TITLES: Record<number, { title: string; badge: string }> = {
  1: { title: 'RECRUIT INITIATE', badge: 'RCT-I' },
  2: { title: 'OPERATOR CADET', badge: 'OPR-II' },
  3: { title: 'FORWARD RECON', badge: 'RCN-III' },
  4: { title: 'COMBAT SPECIALIST', badge: 'SPC-IV' },
  5: { title: 'CORPORAL CORPSMAN', badge: 'CPL-V' },
  6: { title: 'TACTICAL LANCE CPL', badge: 'LCPL-VI' },
  7: { title: 'SERGEANT INFILTRATOR', badge: 'SGT-VII' },
  8: { title: 'STAFF SERGEANT', badge: 'SSG-VIII' },
  9: { title: 'GUNNERY SERGEANT', badge: 'GYS-IX' },
  10: { title: 'MASTER SERGEANT', badge: 'MSG-X' },
  15: { title: 'CHIEF OPERATIVE', badge: 'CHF-XV' },
  20: { title: 'LIEUTENANT COMMANDER', badge: 'LT-XX' },
  25: { title: 'TACTICAL CAPTAIN', badge: 'CPT-XXV' },
  30: { title: 'MAJOR BREACHER', badge: 'MAJ-XXX' },
  35: { title: 'COLONEL SPEC-OPS', badge: 'COL-XXXV' },
  40: { title: 'BRIGADIER WARLORD', badge: 'BGD-XL' },
  45: { title: 'SHADOW ARCHITECT', badge: 'ARC-XLV' },
  50: { title: 'APEX SUPREME COMMANDER', badge: 'APX-L' }
};

export const getRankTitle = (rank: number): { title: string; badge: string } => {
  if (RANK_TITLES[rank]) return RANK_TITLES[rank];
  const keys = Object.keys(RANK_TITLES).map(Number).sort((a, b) => b - a);
  for (const k of keys) {
    if (rank >= k) {
      return {
        title: `${RANK_TITLES[k].title} (TIER ${rank})`,
        badge: `R-${rank}`
      };
    }
  }
  return { title: `TIER ${rank} OPERATOR`, badge: `R-${rank}` };
};

// Unlock Requirements specification
export interface UnlockRequirement {
  id: string;
  name: string;
  category: 'headgear' | 'torso' | 'lower' | 'weapon' | 'visor';
  reqType: 'rank' | 'funds' | 'both';
  minRank?: number;
  fundsPrice?: number;
  description: string;
}

export const UNLOCK_CATALOG: Record<string, UnlockRequirement> = {
  // Headgear
  base_headgear: {
    id: 'base',
    name: 'BARE HEAD',
    category: 'headgear',
    reqType: 'rank',
    minRank: 1,
    description: 'Standard issue unarmored operator head.'
  },
  boonie_headgear: {
    id: 'boonie',
    name: 'BOONIE HAT',
    category: 'headgear',
    reqType: 'rank',
    minRank: 2,
    fundsPrice: 500,
    description: 'Canvas field camo hat with foliage loops.'
  },
  fast_helmet: {
    id: 'fast',
    name: 'FAST BALLISTIC HELMET',
    category: 'headgear',
    reqType: 'rank',
    minRank: 5,
    description: 'High-cut ballistic Kevlar helmet with NVG shroud and ARC rails.'
  },
  skull_mask: {
    id: 'skull',
    name: 'BALLISTIC SKULL MASK',
    category: 'headgear',
    reqType: 'rank',
    minRank: 10,
    fundsPrice: 2500,
    description: 'Reinforced ceramic facial shield with terrifying intimidation visor.'
  },

  // Torso
  chest_rig: {
    id: 'chest_rig',
    name: 'LOW-PROFILE RIG',
    category: 'torso',
    reqType: 'rank',
    minRank: 1,
    description: 'Canvas micro-chest tactical harness.'
  },
  molle_vest: {
    id: 'molle_vest',
    name: 'HEAVY MOLLE VEST',
    category: 'torso',
    reqType: 'rank',
    minRank: 4,
    fundsPrice: 1500,
    description: 'Heavy plate carrier with modular MOLLE webbing and ceramic inserts.'
  },

  // Lower
  pouches_lower: {
    id: 'pouches',
    name: 'UTILITY POUCHES',
    category: 'lower',
    reqType: 'rank',
    minRank: 1,
    description: 'Standard dual tactical ammo pouches.'
  },
  holster_lower: {
    id: 'holster',
    name: 'THIGH HOLSTER',
    category: 'lower',
    reqType: 'rank',
    minRank: 3,
    fundsPrice: 800,
    description: 'Kydex quick-draw drop leg sidearm holster.'
  },

  // Weapons
  ar: {
    id: 'ar',
    name: 'M4A1 TACTICAL',
    category: 'weapon',
    reqType: 'rank',
    minRank: 1,
    description: 'Standard issue full-auto assault rifle.'
  },
  pistol: {
    id: 'pistol',
    name: 'P890 COMBAT SIDEARM',
    category: 'weapon',
    reqType: 'rank',
    minRank: 1,
    description: 'Standard service semi-auto sidearm.'
  },
  shotgun: {
    id: 'shotgun',
    name: 'EXPEDITE 12',
    category: 'weapon',
    reqType: 'rank',
    minRank: 2,
    fundsPrice: 600,
    description: 'High-impact 12-gauge tactical pump shotgun.'
  },
  smg: {
    id: 'smg',
    name: 'VEL-46 SUBMACHINE',
    category: 'weapon',
    reqType: 'rank',
    minRank: 3,
    fundsPrice: 900,
    description: 'High rate-of-fire compact CQB weapon.'
  },
  sniper: {
    id: 'sniper',
    name: 'VICTUS XMR SNIPER',
    category: 'weapon',
    reqType: 'rank',
    minRank: 4,
    fundsPrice: 1400,
    description: 'Heavy long-range precision bolt-action rifle.'
  },
  lmg: {
    id: 'lmg',
    name: 'SAKIN HEAVY LMG',
    category: 'weapon',
    reqType: 'rank',
    minRank: 6,
    fundsPrice: 1800,
    description: '100-round continuous suppression drum machine gun.'
  },
  br: {
    id: 'br',
    name: 'F2000 BATTLE RIFLE',
    category: 'weapon',
    reqType: 'rank',
    minRank: 7,
    fundsPrice: 2200,
    description: 'Bullpup 3-round burst precision battle rifle.'
  },
  laser: {
    id: 'laser',
    name: 'PLASMA BEAM RIFLE',
    category: 'weapon',
    reqType: 'rank',
    minRank: 9,
    fundsPrice: 3000,
    description: 'Continuous energy ion emitter weapon.'
  },
  minigun: {
    id: 'minigun',
    name: 'VULCAN ROTARY CANNON',
    category: 'weapon',
    reqType: 'rank',
    minRank: 12,
    fundsPrice: 4000,
    description: 'Motorized heavy suppression rotary cannon.'
  },
  railgun: {
    id: 'railgun',
    name: 'TACTICAL AP RAILGUN',
    category: 'weapon',
    reqType: 'both',
    minRank: 8,
    fundsPrice: 2000,
    description: 'Hyper-velocity electromagnetic kinetic accelerator launching tungsten slugs.'
  }
};

const STORAGE_KEY = 'gun_arena_persistent_career_ledger';
const OLD_STORAGE_KEY = 'gun_arena_persistent_intel';

export const getCareerLedger = (): FactionCareerLedger => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.totalXp === 'number') {
        return parsed;
      }
    }

    // Migrate from older intel key if available
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    let initialFunds = 2500;
    let initialKills = 24;
    let initialMatches = 5;
    let initialWon = 3;
    let initialWave = 5;
    let initialHeadshots = 8;
    let initialShots = 320;
    let initialHits = 180;

    if (oldRaw) {
      try {
        const oldData = JSON.parse(oldRaw);
        if (oldData.totalFunds) initialFunds = oldData.totalFunds;
        if (oldData.totalKills) initialKills = oldData.totalKills;
        if (oldData.matchesPlayed) initialMatches = oldData.matchesPlayed;
        if (oldData.matchesWon) initialWon = oldData.matchesWon;
        if (oldData.highestWave) initialWave = oldData.highestWave;
        if (oldData.totalHeadshots) initialHeadshots = oldData.totalHeadshots;
        if (oldData.totalShots) initialShots = oldData.totalShots;
        if (oldData.totalHits) initialHits = oldData.totalHits;
      } catch (e) {}
    }

    // Initial starting XP based on initial kills & wins
    const initialXp = Math.max(1250, initialKills * 100 + initialWon * 500);
    const initialRank = getRankFromXp(initialXp);

    const defaultLedger: FactionCareerLedger = {
      totalXp: initialXp,
      combatFunds: initialFunds,
      rank: initialRank,
      totalKills: initialKills,
      totalHeadshots: initialHeadshots,
      totalShots: initialShots,
      totalHits: initialHits,
      highestWave: initialWave,
      matchesPlayed: initialMatches,
      matchesWon: initialWon,
      unlockedItems: ['base', 'chest_rig', 'pouches', 'ar', 'pistol', 'shotgun']
    };

    saveCareerLedger(defaultLedger);
    return defaultLedger;
  } catch (e) {
    return {
      totalXp: 1250,
      combatFunds: 2500,
      rank: 2,
      totalKills: 12,
      totalHeadshots: 4,
      totalShots: 200,
      totalHits: 110,
      highestWave: 4,
      matchesPlayed: 4,
      matchesWon: 2,
      unlockedItems: ['base', 'chest_rig', 'pouches', 'ar', 'pistol', 'shotgun']
    };
  }
};

export const saveCareerLedger = (ledger: FactionCareerLedger): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
    // Keep older key synchronized for backward compatibility
    localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify({
      totalKills: ledger.totalKills,
      totalHeadshots: ledger.totalHeadshots,
      totalShots: ledger.totalShots,
      totalHits: ledger.totalHits,
      totalFunds: ledger.combatFunds,
      highestWave: ledger.highestWave,
      matchesPlayed: ledger.matchesPlayed,
      matchesWon: ledger.matchesWon,
      totalXp: ledger.totalXp,
      rank: ledger.rank
    }));
  } catch (e) {
    console.error('Failed to save career ledger to localStorage', e);
  }
};

// Check if an item is unlocked for the player
export const isItemUnlocked = (itemId: string, ledger: FactionCareerLedger): boolean => {
  if ((window as any).IS_DEV_MODE) return true;

  // Base items are always unlocked
  if (['base', 'chest_rig', 'pouches', 'ar', 'pistol'].includes(itemId)) {
    return true;
  }
  if (ledger.unlockedItems.includes(itemId)) {
    return true;
  }

  // Find requirements
  const req = Object.values(UNLOCK_CATALOG).find(r => r.id === itemId);
  if (!req) return true; // Default to true if not catalogued

  // Check rank automatic unlock (items that only require rank and no purchase)
  if (req.reqType === 'rank' && (!req.fundsPrice || req.fundsPrice === 0)) {
    return ledger.rank >= (req.minRank || 1);
  }

  return false;
};

// Attempt to purchase / unlock an item using Combat Funds & Rank requirement
export const purchaseItemUnlock = (
  itemId: string,
  ledger: FactionCareerLedger
): { success: boolean; error?: string; updatedLedger: FactionCareerLedger } => {
  const req = Object.values(UNLOCK_CATALOG).find(r => r.id === itemId);
  if (!req) {
    return { success: false, error: 'Item not found in catalog', updatedLedger: ledger };
  }

  if (isItemUnlocked(itemId, ledger)) {
    return { success: true, updatedLedger: ledger };
  }

  // Check Rank requirement
  if (req.minRank && ledger.rank < req.minRank) {
    return {
      success: false,
      error: `Requires Rank ${req.minRank} (Current: Rank ${ledger.rank})`,
      updatedLedger: ledger
    };
  }

  // Check Funds requirement
  const cost = req.fundsPrice || 0;
  if (ledger.combatFunds < cost) {
    return {
      success: false,
      error: `Insufficient Combat Funds ($${ledger.combatFunds} / $${cost} required)`,
      updatedLedger: ledger
    };
  }

  // Deduct funds and add to unlockedItems
  const updatedLedger: FactionCareerLedger = {
    ...ledger,
    combatFunds: ledger.combatFunds - cost,
    unlockedItems: Array.from(new Set([...ledger.unlockedItems, itemId]))
  };

  saveCareerLedger(updatedLedger);
  return { success: true, updatedLedger };
};

// Calculate match rewards: 
// 100 XP & $50 per regular bot elimination
// 250 XP & $150 per completed Zombie wave milestone
// 500 XP flat bonus for victory
export const calculateMatchRewards = (params: {
  kills: number;
  wavesCleared: number;
  victory: boolean;
  currentLedger: FactionCareerLedger;
}): { breakdown: MatchRewardBreakdown; updatedLedger: FactionCareerLedger } => {
  const { kills, wavesCleared, victory, currentLedger } = params;

  const killXp = Math.max(0, kills) * 100;
  const killFunds = Math.max(0, kills) * 50;

  const waveXp = Math.max(0, wavesCleared) * 250;
  const waveFunds = Math.max(0, wavesCleared) * 150;

  const victoryXp = victory ? 500 : 0;
  const victoryFunds = victory ? 250 : 0; // Bonus cash for victory

  const totalXpEarned = killXp + waveXp + victoryXp;
  const totalFundsEarned = killFunds + waveFunds + victoryFunds;

  const prevXp = currentLedger.totalXp;
  const prevFunds = currentLedger.combatFunds;
  const prevRank = currentLedger.rank || getRankFromXp(prevXp);

  const newXp = prevXp + totalXpEarned;
  const newFunds = prevFunds + totalFundsEarned;
  const newRank = getRankFromXp(newXp);
  const leveledUp = newRank > prevRank;

  // Auto-unlock items that are strictly rank-based and free
  const newlyUnlocked: string[] = [...currentLedger.unlockedItems];
  Object.values(UNLOCK_CATALOG).forEach(req => {
    if (req.reqType === 'rank' && (!req.fundsPrice || req.fundsPrice === 0)) {
      if (newRank >= (req.minRank || 1) && !newlyUnlocked.includes(req.id)) {
        newlyUnlocked.push(req.id);
      }
    }
  });

  const breakdown: MatchRewardBreakdown = {
    kills,
    killXp,
    killFunds,
    wavesCleared,
    waveXp,
    waveFunds,
    victory,
    victoryXp,
    victoryFunds,
    totalXpEarned,
    totalFundsEarned,
    prevXp,
    prevFunds,
    newXp,
    newFunds,
    prevRank,
    newRank,
    leveledUp
  };

  const updatedLedger: FactionCareerLedger = {
    ...currentLedger,
    totalXp: newXp,
    combatFunds: newFunds,
    rank: newRank,
    totalKills: currentLedger.totalKills + kills,
    highestWave: Math.max(currentLedger.highestWave, wavesCleared + 1),
    matchesPlayed: currentLedger.matchesPlayed + 1,
    matchesWon: currentLedger.matchesWon + (victory ? 1 : 0),
    unlockedItems: newlyUnlocked,
    lastMatchBreakdown: breakdown
  };

  saveCareerLedger(updatedLedger);

  return { breakdown, updatedLedger };
};

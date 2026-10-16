import type { WeaponModelId } from './weaponModels';

type Triple = readonly [number, number, number];
export interface HandAttachment {
  /** Weapon-local metres: +Y up, muzzle along -Z. Palm local +Y follows fingers. */
  position: Triple;
  rotation: Triple;
  curl: number;
  triggerFinger?: boolean;
  followPart?: string;
  partOffset?: Triple;
  fingerAngles?: Triple;
  thumbAngles?: Triple;
}
export interface ViewmodelGrip {
  right: HandAttachment;
  left: HandAttachment;
  /** Camera-local torso bend targets; sleeve length remains independently bounded. */
  elbows: { right: Triple; left: Triple };
  /** Maximum anatomical cuff-to-elbow length, independent of weapon reach. */
  sleeveLength: number;
  hip: Triple;
  aim: Triple;
  aimRotation: Triple;
  sprint: Triple;
  sprintRotation: Triple;
  reloadReach: Triple;
  chamber?: HandAttachment;
}

const rightRotation: Triple = [-Math.PI / 2, Math.PI / 2, 0];
const leftRotation: Triple = [-Math.PI / 2, -Math.PI / 2, 0];
// Basis: palm normal (0,.95,.312), fingers (.600,.250,-.760).
// The wrist approaches forward/up from the near-left, instead of crossing the barrel.
const underRotation: Triple = [1.8883567560864183, 0, -2.498129027911074];
const crossbarRotation: Triple = [Math.PI / 2, 0, -Math.PI / 2];
const primary = (z = .145, x = .038, y = -.10): HandAttachment => ({ position: [x, y, z], rotation: rightRotation, curl: 1 });
const under = (z: number, y = -.0605, x = -.036): HandAttachment => ({
  position: [x, y, z], rotation: underRotation, curl: 1,
  fingerAngles: [.85, 1.05, .60], thumbAngles: [.35, .60, .35],
});
const vertical = (z: number, x = -.038, y = -.10): HandAttachment => ({ position: [x, y, z], rotation: leftRotation, curl: .95 });
function grip(right: HandAttachment, left: HandAttachment, options: Partial<ViewmodelGrip> = {}): ViewmodelGrip {
  return {
    right, left,
    elbows: { right: [.36, -.56, -.24], left: [-.10, -.53, -.23] },
    sleeveLength: .30, aimRotation: [0, 0, 0],
    hip: [.15, -.215, -.36], aim: [0, -.105, -.36],
    // +X is screen-right. Carry the breech left as well as yawing the muzzle left.
    sprint: [-.05, -.285, -.45], sprintRotation: [-.18, .72, -.14],
    reloadReach: [-.04, -.045, .065], ...options,
  };
}

/** Absolute attachments, never incremental holding rotations. Inspection and
 * third-person assemblies deliberately do not contain this first-person rig. */
export const VIEWMODEL_GRIPS: Readonly<Record<WeaponModelId, ViewmodelGrip>> = {
  ar: grip(primary(), under(-.24), {
    hip: [.15, -.225, -.35], aim: [0, -.145, -.36], sleeveLength: .235,
    chamber: { ...vertical(.103, -.083, .028), followPart: 'bolt', partOffset: [-.038, -.020, .078], curl: .8 },
  }),
  pistol: grip(primary(.105), vertical(.088, -.039, -.108), {
    hip: [.13, -.125, -.39], aim: [0, -.0725, -.39],
    sprint: [-.07, -.23, -.40], sprintRotation: [-.14, .38, -.14],
  }),
  shotgun: grip(primary(), { ...under(-.225, -.090), followPart: 'pump', partOffset: [-.036, -.065, .055] }, { hip: [.15, -.225, -.36], sleeveLength: .25, aim: [0, -.08375, -.36], aimRotation: [.0306, 0, 0] }),
  sniper: grip(primary(), under(-.28), { hip: [.155, -.22, -.39], sleeveLength: .25, aim: [0, -.105, -.39] }),
  smg: grip(primary(), vertical(-.18, -.039, -.10), { hip: [.135, -.205, -.34], aim: [0, -.145, -.34] }),
  lmg: grip(primary(), under(-.27), { hip: [.17, -.245, -.40], aim: [0, -.105, -.40], sprint: [-.035, -.30, -.48], sprintRotation: [-.12, .52, -.12] }),
  br: grip(primary(), under(-.27), { hip: [.145, -.215, -.38], sleeveLength: .25, aim: [0, -.105, -.38] }),
  laser: grip(primary(.165), under(-.27), { hip: [.16, -.22, -.38], aim: [0, -.095, -.38] }),
  railgun: grip(primary(), under(-.24), { hip: [.17, -.235, -.44], aim: [0, -.145, -.44], sprint: [-.045, -.285, -.49], sprintRotation: [-.12, .56, -.12] }),
  rocket: grip(primary(.155), vertical(-.165, -.038, -.105), { hip: [.18, -.235, -.43], aim: [0, -.145, -.43], sprint: [-.025, -.29, -.49], sprintRotation: [-.08, .34, -.10], reloadReach: [-.04, -.045, .40], elbows: { right: [.36, -.56, -.24], left: [.02, -.60, -.22] } }),
  grenade_launcher: grip(primary(.175), vertical(-.165, -.039, -.10), { hip: [.16, -.225, -.39], aim: [0, -.105, -.39], sprint: [-.04, -.285, -.46], sprintRotation: [-.10, .40, -.10] }),
  minigun: grip(primary(.095), { position: [-.15, -.12, -.14], rotation: crossbarRotation, curl: 1 }, {
    hip: [.16, -.20, -.48], aim: [.06, -.15, -.48], sprint: [-.025, -.30, -.54], sprintRotation: [-.08, .30, -.10],
    elbows: { right: [.40, -.58, -.27], left: [-.08, -.55, -.32] },
    reloadReach: [-.12, -.01, .20],
  }),
};

function easeRange(value: number, lo: number, hi: number) {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}
/** AR empty-reload presentation only: reach, pull, return, release within the
 * existing chamber phase. Both the hand and physical control share this clock. */
export function arChargingStroke(progress: number) {
  return .045 * easeRange(progress, .22, .48) * (1 - easeRange(progress, .60, .82));
}
export function arChamberReach(progress: number) { return easeRange(progress, 0, .22); }
export function arChamberRelease(progress: number) { return easeRange(progress, .82, 1); }

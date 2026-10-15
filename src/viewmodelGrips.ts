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
}

const rightRotation: Triple = [-Math.PI / 2, Math.PI / 2, 0];
const leftRotation: Triple = [-Math.PI / 2, -Math.PI / 2, 0];
const underRotation: Triple = [Math.PI / 2, 0, -Math.PI / 2];
const primary = (z = .145, x = .038, y = -.10): HandAttachment => ({ position: [x, y, z], rotation: rightRotation, curl: 1 });
const under = (z: number, y = -.055, x = -.068): HandAttachment => ({ position: [x, y, z], rotation: underRotation, curl: 1 });
const vertical = (z: number, x = -.038, y = -.10): HandAttachment => ({ position: [x, y, z], rotation: leftRotation, curl: .95 });
function grip(right: HandAttachment, left: HandAttachment, options: Partial<ViewmodelGrip> = {}): ViewmodelGrip {
  return {
    right, left,
    elbows: { right: [.36, -.56, -.24], left: [-.10, -.53, -.32] },
    sleeveLength: .30, aimRotation: [0, 0, 0],
    hip: [.15, -.215, -.36], aim: [0, -.105, -.36],
    sprint: [.19, -.27, -.39], sprintRotation: [.22, -.16, -.28],
    reloadReach: [-.04, -.045, .065], ...options,
  };
}

/** Absolute attachments, never incremental holding rotations. Inspection and
 * third-person assemblies deliberately do not contain this first-person rig. */
export const VIEWMODEL_GRIPS: Readonly<Record<WeaponModelId, ViewmodelGrip>> = {
  ar: grip(primary(), under(-.28), { hip: [.145, -.205, -.36], aim: [0, -.145, -.36] }),
  pistol: grip(primary(.105), vertical(.088, -.039, -.108), {
    hip: [.13, -.125, -.39], aim: [0, -.0725, -.39],
    sprintRotation: [.35, -.16, -.23],
  }),
  shotgun: grip(primary(), { ...under(-.23, -.067), followPart: 'pump', partOffset: [-.055, -.035, .025] }, { hip: [.15, -.225, -.36], aim: [0, -.08375, -.36], aimRotation: [.0306, 0, 0] }),
  sniper: grip(primary(), under(-.28), { hip: [.155, -.22, -.39], aim: [0, -.105, -.39] }),
  smg: grip(primary(), vertical(-.18, -.039, -.10), { hip: [.135, -.205, -.34], aim: [0, -.145, -.34] }),
  lmg: grip(primary(), under(-.27, -.067), { hip: [.17, -.245, -.40], aim: [0, -.105, -.40] }),
  br: grip(primary(), under(-.27), { hip: [.145, -.215, -.38], aim: [0, -.105, -.38] }),
  laser: grip(primary(.165), under(-.27, -.065), { hip: [.16, -.22, -.38], aim: [0, -.095, -.38] }),
  railgun: grip(primary(), under(-.24, -.065), { hip: [.17, -.235, -.44], aim: [0, -.145, -.44], sprint: [.19, -.27, -.44] }),
  rocket: grip(primary(.155), vertical(-.165, -.038, -.105), { hip: [.18, -.235, -.43], aim: [0, -.145, -.43], reloadReach: [-.04, -.045, .40], elbows: { right: [.36, -.56, -.24], left: [.02, -.60, -.22] } }),
  grenade_launcher: grip(primary(.175), vertical(-.165, -.039, -.10), { hip: [.16, -.225, -.39], aim: [0, -.105, -.39] }),
  minigun: grip(primary(.095), under(-.14, -.12, -.15), {
    hip: [.16, -.20, -.48], aim: [.06, -.15, -.48], sprint: [.20, -.30, -.49],
    elbows: { right: [.40, -.58, -.27], left: [-.08, -.55, -.32] },
    reloadReach: [-.12, -.01, .20],
  }),
};

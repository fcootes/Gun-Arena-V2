import type { WeaponModelId } from './weaponModels';

type Triple = readonly [number, number, number];
export interface HandAttachment {
  /** Weapon-local metres: +Y up, muzzle along -Z. Palm local +Y follows fingers. */
  position: Triple;
  rotation: Triple;
  curl: number;
  triggerFinger?: boolean;
}
export interface ViewmodelGrip {
  right: HandAttachment;
  left: HandAttachment;
  elbows: { right: Triple; left: Triple };
  hip: Triple;
  aim: Triple;
  sprint: Triple;
  sprintRotation: Triple;
  reloadReach: Triple;
}

const rightRotation: Triple = [-Math.PI / 2, Math.PI / 2, 0];
const leftRotation: Triple = [-Math.PI / 2, -Math.PI / 2, 0];
const underRotation: Triple = [Math.PI / 2, 0, -Math.PI / 2];
const primary = (z = .145, x = .038, y = -.10): HandAttachment => ({ position: [x, y, z], rotation: rightRotation, curl: 1 });
const under = (z: number, y = -.055): HandAttachment => ({ position: [-.068, y, z], rotation: underRotation, curl: 1 });
const vertical = (z: number, x = -.038, y = -.10): HandAttachment => ({ position: [x, y, z], rotation: leftRotation, curl: .95 });
function grip(right: HandAttachment, left: HandAttachment, options: Partial<ViewmodelGrip> = {}): ViewmodelGrip {
  return {
    right, left,
    elbows: { right: [.19, -.26, .08], left: [-.23, -.24, .04] },
    hip: [.16, -.135, -.47], aim: [0, -.105, -.45],
    sprint: [.19, -.20, -.48], sprintRotation: [.22, -.16, -.28],
    reloadReach: [-.04, -.045, .065], ...options,
  };
}

/** Absolute attachments, never incremental holding rotations. Inspection and
 * third-person assemblies deliberately do not contain this first-person rig. */
export const VIEWMODEL_GRIPS: Readonly<Record<WeaponModelId, ViewmodelGrip>> = {
  ar: grip(primary(), under(-.28)),
  pistol: grip(primary(.105), vertical(.088, -.039, -.108), {
    hip: [.13, -.10, -.42], aim: [0, -.045, -.42],
    sprintRotation: [.35, -.16, -.23],
  }),
  shotgun: grip(primary(), under(-.23, -.067)),
  sniper: grip(primary(), under(-.34), { hip: [.15, -.14, -.50] }),
  smg: grip(primary(), vertical(-.18, -.039, -.10)),
  lmg: grip(primary(), under(-.29, -.067), { hip: [.15, -.14, -.51] }),
  br: grip(primary(), under(-.30)),
  laser: grip(primary(.165), under(-.27, -.065), { aim: [0, -.095, -.47] }),
  railgun: grip(primary(), under(-.26, -.065), { hip: [.15, -.14, -.52] }),
  rocket: grip(primary(.155), vertical(-.165, -.038, -.105), { hip: [.18, -.14, -.54], aim: [0, -.10, -.52] }),
  grenade_launcher: grip(primary(.175), vertical(-.165, -.039, -.10), { hip: [.16, -.135, -.49] }),
  minigun: grip({ ...primary(.292, .13, -.034), triggerFinger: false }, vertical(.292, -.13, -.034), {
    hip: [.12, -.18, -.61], aim: [0, -.16, -.61], sprint: [.16, -.24, -.63],
    elbows: { right: [.24, -.27, .37], left: [-.24, -.27, .37] },
    reloadReach: [-.12, -.01, .20],
  }),
};

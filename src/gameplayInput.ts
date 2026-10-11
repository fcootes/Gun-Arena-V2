/** Physical bindings shared by gameplay and the controls guide. */
export const KEY_ACTIONS = {
  KeyW: 'forward', KeyA: 'left', KeyS: 'backward', KeyD: 'right',
  ShiftLeft: 'sprint', ControlLeft: 'crouch', Space: 'jump',
  KeyF: 'melee', KeyE: 'interact', KeyR: 'reload', KeyG: 'grenade',
  KeyZ: 'squadFollowHold', KeyC: 'squadPush', KeyX: 'squadFocus',
  KeyV: 'perspective', Digit1: 'slot1', Digit2: 'slot2',
  Digit3: 'slot3', Digit4: 'slot4', Escape: 'pause', KeyP: 'pause',
} as const;
export const MOUSE_BUTTONS = { fire: 0, aim: 2 } as const;
export const CONTROLS_GUIDE = [
  ['W / A / S / D', 'Move'], ['LEFT MOUSE', 'Fire / use selected item'],
  ['HOLD RIGHT MOUSE', 'Aim down sights'], ['HOLD LEFT SHIFT', 'Sprint'],
  ['HOLD LEFT CTRL', 'Crouch'], ['SPACE', 'Jump'], ['F', 'Knife melee'],
  ['E', 'Interact'], ['R', 'Reload'], ['G', 'Grenade'],
  ['Z', 'Squad follow / hold'], ['C', 'Squad push objective'],
  ['X + LEFT MOUSE', 'Select squad focus target'], ['V', 'First / third person'],
  ['1–4 / MOUSE WHEEL', 'Select / cycle loadout slots'], ['ESC / P', 'Pause / resume'],
] as const;

interface HeldPlayer {
  alive: boolean;
  onGround: boolean;
  vel: { y: number };
  crouching: boolean;
  sprinting: boolean;
  aiming: boolean;
  fireHeld: boolean;
  isMeleeing: boolean;
  isDrinking: boolean;
}

/** Keeps physical presses separate from the campaign's consumable E latch. */
export class GameplayInput {
  readonly keys: Record<string, boolean> = {};
  private readonly pressed = new Set<string>();
  private buttons = 0;

  keyDown(code: string, repeat = false): boolean {
    if (repeat || this.pressed.has(code)) return false;
    this.pressed.add(code);
    this.keys[code] = true;
    return true;
  }

  keyUp(code: string): void {
    this.pressed.delete(code);
    this.keys[code] = false;
  }

  mouseDown(button: number): boolean {
    const mask = 1 << button;
    if (this.buttons & mask) return false;
    this.buttons |= mask;
    return true;
  }

  mouseUp(button: number): void { this.buttons &= ~(1 << button); }
  get dragging(): boolean { return this.buttons !== 0; }
  get aimHeld(): boolean { return !!(this.buttons & (1 << MOUSE_BUTTONS.aim)); }

  /** Mutates the existing player; no frame allocations or React state updates. */
  applyHeld(player: HeldPlayer, active: boolean, weapon: boolean, reloading: boolean): void {
    const eligible = active && player.alive;
    player.crouching = eligible && !!this.keys.ControlLeft;
    const combatReady = eligible && !player.isMeleeing && !player.isDrinking && !reloading;
    player.aiming = combatReady && weapon && this.aimHeld;
    const moving = (!!this.keys.KeyW !== !!this.keys.KeyS) || (!!this.keys.KeyA !== !!this.keys.KeyD);
    // ADS takes priority even when temporarily unavailable during a reload.
    player.sprinting = combatReady && moving && player.onGround && player.vel.y <= 0
      && !!this.keys.ShiftLeft && !player.crouching && !this.aimHeld;
  }

  clear(player: HeldPlayer): void {
    this.pressed.clear();
    for (const code in this.keys) this.keys[code] = false;
    this.buttons = 0;
    player.fireHeld = player.aiming = player.sprinting = player.crouching = false;
  }
}

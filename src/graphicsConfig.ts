/** Existing full-fidelity defaults; no inferred hardware presets or quality cuts. */
export const GRAPHICS = Object.freeze({
  maxPixelRatio: 2,
  composerPixelRatio: 1.5,
  antialias: true,
  bloomStrength: { training: .22, area51: .35, shattered_wall: .4 },
});

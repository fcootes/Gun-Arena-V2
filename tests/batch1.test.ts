import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WEAPONS } from '../src/weapons';
import * as THREE from 'three';
import { buildRegenFieldMesh, buildTelemetryMarker, buildTripodMachineGun, disposeBotVisuals, disposeBotTextureCache } from '../src/botBuilder';
import { initWorld } from '../src/world';
// Canvas painting is irrelevant to resource and atmosphere checks; keep the
// test portable without a browser or an additional native canvas dependency.
const context = new Proxy({}, { get: (_target, key) => key === 'createRadialGradient'
  ? () => ({ addColorStop() {} }) : () => {} });
(globalThis as any).document = { createElement: (tag: string) => {
  assert.equal(tag, 'canvas');
  return { width: 256, height: 256, getContext: () => context };
} };
const field = buildRegenFieldMesh(8);
assert.ok(field instanceof THREE.Mesh);
assert.throws(() => buildRegenFieldMesh(NaN), RangeError);
const marker = buildTelemetryMarker();
const tracked = new Set<THREE.Material | THREE.BufferGeometry>();
let disposals = 0;
marker.traverse((o: any) => { if(o.geometry) tracked.add(o.geometry); if(o.material) tracked.add(o.material); });
tracked.forEach(o => o.addEventListener('dispose', () => disposals++));
disposeBotVisuals(marker);
assert.equal(disposals, tracked.size, 'Shared marker materials disposed once');
disposeBotVisuals(marker);
assert.equal(disposals, tracked.size, 'Second teardown is harmless');
const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
let spriteGeometryDisposals = 0;
sprite.geometry.addEventListener('dispose', () => spriteGeometryDisposals++);
disposeBotVisuals(sprite);
assert.equal(spriteGeometryDisposals, 0, 'Global sprite geometry stays alive');
const tripod1 = buildTripodMachineGun();
const tripod2 = buildTripodMachineGun();
let sharedTexture: THREE.Texture | undefined;
tripod1.group.traverse((o: any) => { if(o.material?.bumpMap) sharedTexture = o.material.bumpMap; });
assert.ok(sharedTexture);
let textureDisposals = 0;
sharedTexture.addEventListener('dispose', () => textureDisposals++);
disposeBotVisuals(tripod1.group);
assert.equal(textureDisposals, 0, 'Session textures survive bot teardown');
disposeBotVisuals(tripod2.group);
disposeBotTextureCache();
disposeBotTextureCache();
assert.equal(textureDisposals, 1, 'Cache disposed once at session teardown');
disposeBotVisuals(field);
const scene = new THREE.Scene();
const initialFog = new THREE.Fog(0, 10, 32);
scene.fog = initialFog;
const world = initWorld(scene, new THREE.PerspectiveCamera());
const fog = scene.fog;
assert.ok(fog instanceof THREE.FogExp2);
const background = scene.background;
for(let i=0;i<3;i++) {
 scene.fog = new THREE.Fog(0, 10, 32);
 scene.background = new THREE.Color(0);
 world.updateWorld(0.016, i, 'extraction');
 assert.equal(scene.fog, fog, 'Gameplay restores same exponential fog');
 assert.equal(scene.background, background);
}
world.dispose();
assert.equal(scene.fog, initialFog, 'World disposal restores previous atmosphere');
world.dispose();
console.log('PASS: resource ownership, cache lifetime, helper signatures and repeated offshore atmosphere transitions');

(globalThis as any).Audio = class { addEventListener() {} removeEventListener() {} load() {} };
const { HelmetHUD } = await import('../src/HelmetHUD');
const loadout = ['ar', 'pistol', 'grenade', 'medkit'].map(id => WEAPONS.find(w => w.id === id)!);
const hud = renderToStaticMarkup(React.createElement(HelmetHUD, {
 health: 70, maxHealth: 100, shield: 50, maxShield: 100,
 currentWeapon: loadout[3], weaponSlotState: { count: 2 }, slotIndex: 3,
 playerLoadout: loadout, playerLoadoutStates: [{ ammo: 30, reserve: 90 }, { ammo: 12, reserve: 24 }, { count: 3 }, { count: 2 }],
 matchMode: 'extraction', factionAlignment: 'usmc', blueScore: 0, redScore: 0,
 targetScore: 20, currentWave: 1, zombiesRemaining: 0, kills: 0, timeStr: '00:00',
 zoneStatus: '', playerPos: { x: 0, z: 0 }, playerYaw: 0, radarPingsRef: { current: [] }
}));
assert.equal((hud.match(/aria-label="Slot /g) ?? []).length, 4);
assert.match(hud, /aria-label="Slot 4: Field Kit/);
assert.match(hud, /aria-pressed="true"/);
assert.match(hud, /x2 KITS/);
assert.match(hud, /data-testid="ammo-status" class="absolute bottom-6 right-/);
assert.match(hud, /backdrop-blur-sm/);
console.log('PASS: four-slot HUD, field kit counts, ammo placement and visor styling');

// Execute the committed input handlers with a minimal game context, avoiding
// a WebGL renderer while exercising the actual keyboard and wheel code.
const appText = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const appAst = ts.createSourceFile('App.tsx', appText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = new Map<string, string>();
function visit(node: ts.Node): void {
 if (ts.isFunctionDeclaration(node) && node.name?.text === 'fireWeapon') {
   handlers.set('fireWeapon', node.getText(appAst));
 }
 if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
     && ['onKeyDown', 'onWheel'].includes(node.name.text) && node.initializer) {
   handlers.set(node.name.text, node.initializer.getText(appAst));
 }
 ts.forEachChild(node, visit);
}
visit(appAst);
assert.equal(handlers.size, 3);
const inputPlayer = { slotIndex: 0 };
const gameStateRef = { current: 'playing' };
const keyHandler = vm.runInNewContext(ts.transpile(`(${handlers.get('onKeyDown')})`), {
 keys: {}, gameStateRef, player: inputPlayer, switchSlot: (index: number) => { inputPlayer.slotIndex = index; }
});
const wheelHandler = vm.runInNewContext(ts.transpile(`(${handlers.get('onWheel')})`), {
 gameStateRef, player: inputPlayer, playerLoadout: loadout, switchSlot: (index: number) => { inputPlayer.slotIndex = index; }
});
for(let i=0;i<4;i++) { keyHandler({ code: `Digit${i+1}` }); assert.equal(inputPlayer.slotIndex, i); }
wheelHandler({ deltaY: 1 }); assert.equal(inputPlayer.slotIndex, 0);
wheelHandler({ deltaY: -1 }); assert.equal(inputPlayer.slotIndex, 3);
wheelHandler({ deltaY: -1 }); assert.equal(inputPlayer.slotIndex, 2);
gameStateRef.current = 'paused';
keyHandler({ code: 'Digit1' }); wheelHandler({ deltaY: 1 }); assert.equal(inputPlayer.slotIndex, 2);
console.log('PASS: keyboard slots 1–4, wheel wrap in both directions and paused input guard');

const kitPlayer = { health: 100, maxHealth: 100, shield: 100, maxShield: 100, isDrinking: false, drinkTimer: 0 };
const kitState = { count: 0 };
const useKit = vm.runInNewContext(ts.transpile(`(${handlers.get('fireWeapon')})`), {
 player: kitPlayer, currentSlot: () => loadout[3], currentSlotState: () => kitState,
 AUDIO: { miniDrink: { play() {} } }, pushKillFeed() {}
});
useKit(); assert.equal(kitPlayer.isDrinking, false, 'Empty kit cannot be used');
kitState.count = 2; useKit(); assert.equal(kitPlayer.isDrinking, false, 'Full health and shield conserve kit');
kitPlayer.health = 50; useKit(); assert.equal(kitPlayer.isDrinking, true);
assert.equal(kitPlayer.drinkTimer, 3, 'Field kit preserves timed application');
kitPlayer.drinkTimer = 1; useKit(); assert.equal(kitPlayer.drinkTimer, 1, 'Held input cannot restart healing');
console.log('PASS: depleted/full-health kit guards and uninterrupted finite-kit application');

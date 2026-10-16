import { resolve } from 'node:path';

/** Deterministic presentation samples in the same WebGL fixture as the normal
 * gallery. Reload state advances through the real state machine at 60 Hz. */
export async function captureAcceptanceSequence(page, output) {
  const samples = [];
  async function capture(name, seconds = 0, options = {}) {
    const sample = await page.evaluate(({ seconds, options }) => {
      const f = window.fixture;
      Object.assign(f.state, options);
      for (let remaining = seconds; remaining > 1e-8;) {
        const dt = Math.min(1 / 60, remaining); remaining -= dt;
        if (f.state.ws.reloading) f.advanceWeaponReload(f.WEAPONS.find(w => w.id === f.state.id), f.state.ws, dt);
        f.frame(dt, false);
      }
      f.renderer.render(f.scene, f.camera);
      f.validateHands();
      const model = f.manager.root.getObjectByName(`Weapon_${f.state.id}`);
      const hand = f.manager.root.getObjectByName('leftHand'), sleeve = f.manager.root.getObjectByName('leftForearm');
      const bolt = model.getObjectByName('bolt'), stage = f.state.ws.reloadSequence?.phases[f.state.ws.reloadSequence.index];
      const forward = new f.THREE.Vector3(0, 0, -1).applyQuaternion(model.quaternion);
      return { id: f.state.id, position:model.position.toArray(), rotation:model.rotation.toArray().slice(0,3), barrel:forward.toArray(),
        hand:hand.position.toArray(), sleeveLength:sleeve.scale.y, bolt:bolt?.position.toArray(), phase:stage?.phase??'ready',
        phaseElapsed:f.state.ws.reloadSequence?.elapsed, ammo:f.state.ws.ammo, ...f.snapshot() };
    }, { seconds, options });
    await page.screenshot({ path: resolve(output, `${name}.png`) });
    samples.push({ name, ...sample });
  }
  await page.evaluate(() => { const f=window.fixture;f.state.id='ar';f.state.ws={ammo:20,reserve:100}; f.state.moving=f.state.sprinting=f.state.aiming=false; f.manager.resetEffects();f.frame(0,false); });
  await capture('accept-ar-idle');
  for(const [name,dt] of [['enter-10',.10],['enter-25',.15],['carry',.75]]) await capture(`accept-sprint-${name}`,dt,{sprinting:true,moving:true});
  for(const [name,dt] of [['stop-10',.10],['stop-25',.15],['ready',.75]]) await capture(`accept-sprint-${name}`,dt,{sprinting:false,moving:false});
  await capture('accept-stop-ads',.6,{aiming:true});
  await page.evaluate(() => {const f=window.fixture;f.state.aiming=false;f.manager.resetEffects();f.frame(0,false);});
  for(const empty of [false,true]) {
    await page.evaluate(empty=>{const f=window.fixture;f.state.ws={ammo:empty?0:20,reserve:100};f.manager.resetEffects();f.frame(0,false);f.beginWeaponReload(f.WEAPONS.find(w=>w.id==='ar'),f.state.ws);},empty);
    let elapsed=0;
    const times=empty?[.25,.65,1.2,1.9,2.24,2.37,2.55,2.72,2.85,3.0,3.42]:[.2,.5,.9,1.3,1.7,1.94];
    for(const time of times){await capture(`accept-${empty?'empty':'tactical'}-${Math.round(time*100)}`,time-elapsed);elapsed=time;}
  }
  // Inspect actual contact from below and the player-near side, not just one hip silhouette.
  for(const [name,position,target] of [
    ['support-detail',[-.36,-.48,-.64],[.08,-.28,-.57]],
    ['support-side',[.5,-.28,-.75],[.15,-.27,-.54]],
  ]) {
    await page.evaluate(({position,target})=>{const f=window.fixture;f.manager.resetEffects();f.state.ws={};f.frame(0,false);f.scene.attach(f.manager.root);f.camera.position.fromArray(position);f.camera.lookAt(...target);f.camera.fov=48;f.camera.updateProjectionMatrix();f.renderer.render(f.scene,f.camera);},{position,target});
    await page.screenshot({path:resolve(output,`accept-${name}.png`)});
    await page.evaluate(()=>{const f=window.fixture;f.camera.position.set(0,0,0);f.camera.quaternion.identity();f.camera.add(f.manager.root);f.frame(0,false);});
  }
  // The supplied screenshots are approximately 2:1. Retain their wide framing
  // alongside the 16:9 performance/comparison fixture.
  await page.setViewportSize({width:1920,height:960});
  await page.evaluate(()=>{const f=window.fixture;f.renderer.setSize(1920,960);f.camera.aspect=2;f.manager.resetEffects();f.frame(0,false);});
  await capture('accept-wide-idle');
  await capture('accept-wide-sprint',1,{sprinting:true,moving:true});
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{const f=window.fixture;f.renderer.setSize(1280,720);f.camera.aspect=1280/720;f.state.sprinting=f.state.moving=false;f.manager.resetEffects();f.frame(0,false);});
  return samples;
}

/** Live App recording interval: fire the last round and reload without pausing,
 * forcing a pose or advancing gameplay from the fixture. Intermediate samples
 * are taken against the actual phase clock, not wall-clock guesses. */
export async function captureLiveArCycle(page, output, faction, originMs) {
  await page.evaluate(()=>{const g=window.__handsGame;g.equip('ar');g.weaponState.ammo=1;g.settlePose();});
  const startSeconds=(Date.now()-originMs)/1000;
  await page.mouse.click(600,340);
  await page.waitForFunction(()=>window.__handsGame.weaponState.ammo===0);
  await page.screenshot({path:resolve(output,`live-${faction}-last-shot.png`)});
  await page.keyboard.press('r');
  const phases=[];
  for(const [phase,fraction] of [['eject',.3],['insert',.45],['chamber',.35],['chamber',.62],['close',.35]]) {
    await page.waitForFunction(({phase,fraction})=>{const s=window.__handsGame.weaponState,q=s.reloadSequence,p=q?.phases[q.index];return p?.phase===phase && q.elapsed/p.duration>=fraction;},{phase,fraction},{timeout:60000});
    phases.push(await page.evaluate(()=>{const g=window.__handsGame,q=g.weaponState.reloadSequence;return {phase:q.phases[q.index].phase,elapsed:q.elapsed,ammo:g.weaponState.ammo,hand:g.manager.root.getObjectByName('leftHand').position.toArray()};}));
    await page.screenshot({path:resolve(output,`live-${faction}-${phase}-${fraction}.png`)});
  }
  await page.waitForFunction(()=>!window.__handsGame.weaponState.reloading,null,{timeout:60000});
  await page.screenshot({path:resolve(output,`live-${faction}-ready.png`)});
  const state=await page.evaluate(()=>({ammo:window.__handsGame.weaponState.ammo,reserve:window.__handsGame.weaponState.reserve}));
  if(state.ammo!==30 || state.reserve!==120)throw new Error('Live AR empty-reload ammo conservation failed: '+JSON.stringify(state));
  return {startSeconds,endSeconds:(Date.now()-originMs)/1000,phases,state};
}

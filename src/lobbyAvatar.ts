import * as THREE from 'three';
import { GearTier } from './FactionContext';

export type VisorType = 'standard' | 'recon' | 'apex';
export type FactionType = 'usmc' | 'apex';

export interface LobbyAvatarController {
  group: THREE.Group;
  update: (timeSec: number) => void;
  setFaction: (faction: FactionType) => void;
  setGearTier: (tier: GearTier) => void;
  setVisor: (visor: VisorType) => void;
  setHeadgear: (headgear: import('./FactionContext').HeadgearOption) => void;
  setTorsoConfig: (torso: import('./FactionContext').TorsoOption) => void;
  setLowerConfig: (lower: import('./FactionContext').LowerOption) => void;
  setWeapon: (weaponId: string) => void;
  destroy: () => void;
}

export function createLobbyAvatar(scene: THREE.Scene, basePos: THREE.Vector3): LobbyAvatarController {
  const root = new THREE.Group();
  root.position.copy(basePos);
  scene.add(root);

  let currentFaction: FactionType = 'usmc';
  let currentGearTier: GearTier = 'standard';
  let currentVisor: VisorType = 'standard';
  let currentWeapon: string = 'ar';
  
  let currentHeadgear: import('./FactionContext').HeadgearOption = 'fast';
  let currentTorsoConfig: import('./FactionContext').TorsoOption = 'chest_rig';
  let currentLowerConfig: import('./FactionContext').LowerOption = 'pouches';

  // High-contrast clean black/white skull graphic texture for Ballistic Skull Mask
  function createSkullTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Matte tactical black background base
    ctx.fillStyle = '#0e1116';
    ctx.fillRect(0, 0, size, size);

    // High-contrast clean white skull graphic
    ctx.fillStyle = '#f0f3f6';

    // Cranium dome & temples
    ctx.beginPath();
    ctx.ellipse(256, 180, 165, 115, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cheekbones & maxilla
    ctx.beginPath();
    ctx.moveTo(125, 230);
    ctx.lineTo(195, 305);
    ctx.lineTo(256, 290);
    ctx.lineTo(317, 305);
    ctx.lineTo(387, 230);
    ctx.lineTo(355, 185);
    ctx.lineTo(157, 185);
    ctx.closePath();
    ctx.fill();

    // Deep eye socket hollows
    ctx.fillStyle = '#0e1116';
    ctx.beginPath();
    ctx.ellipse(195, 205, 42, 34, -0.15, 0, Math.PI * 2);
    ctx.ellipse(317, 205, 42, 34, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Piriform nasal aperture
    ctx.beginPath();
    ctx.moveTo(256, 232);
    ctx.lineTo(238, 276);
    ctx.lineTo(256, 268);
    ctx.lineTo(274, 276);
    ctx.closePath();
    ctx.fill();

    // Ballistic mandible plate with teeth row
    ctx.fillStyle = '#f0f3f6';
    ctx.beginPath();
    ctx.roundRect(172, 316, 168, 76, 8);
    ctx.fill();

    // Black tooth separation channels
    ctx.fillStyle = '#0e1116';
    for (let x = 192; x <= 320; x += 18) {
      ctx.fillRect(x, 318, 4, 72);
    }
    ctx.fillRect(172, 352, 168, 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  const skullTexture = createSkullTexture();

  // Staging Tactical Pedestal (Rugged Matte Military Deck)
  const pedestalGroup = new THREE.Group();
  root.add(pedestalGroup);

  const basePlateMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d22,
    roughness: 0.65,
    metalness: 0.5
  });
  const edgeTrimMat = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    roughness: 0.5,
    metalness: 0.7
  });

  // Pedestal: Subtle flush tactical staging disc with soft dark rim
  const pedestalBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.25, 0.02, 32),
    basePlateMat
  );
  pedestalBase.position.y = 0.01;
  pedestalBase.receiveShadow = true;
  pedestalGroup.add(pedestalBase);

  const pedestalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.22, 0.015, 12, 48),
    edgeTrimMat
  );
  pedestalRing.rotation.x = Math.PI / 2;
  pedestalRing.position.y = 0.02;
  pedestalGroup.add(pedestalRing);

  // Soft contact ambient occlusion shadow on the floor
  const contactCanvas = document.createElement('canvas');
  contactCanvas.width = 128;
  contactCanvas.height = 128;
  const ctx = contactCanvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const contactTex = new THREE.CanvasTexture(contactCanvas);
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.8),
    new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.9, depthWrite: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.005;
  pedestalGroup.add(contactShadow);

  // =========================================================================
  // CINEMATIC DOWNWARD SPOTLIGHTS & DRAMATIC LIGHTING
  // =========================================================================
  // 1. Primary Overhead Key Spotlight: casts downward from above-front creating deep tactical shadows
  const spotLight = new THREE.SpotLight(0xe8f4ff, 7.5, 18, Math.PI / 5, 0.45, 1.2);
  spotLight.position.set(0, 5.2, 1.4);
  spotLight.target = root;
  spotLight.castShadow = true;
  spotLight.shadow.bias = -0.0005;
  spotLight.shadow.mapSize.set(2048, 2048);
  root.add(spotLight);

  // 2. Direct Top Spot: tight beam straight down onto helmet crown and NVG quad-tubes
  const topSpot = new THREE.SpotLight(0xffffff, 4.5, 12, Math.PI / 6, 0.5, 1.2);
  topSpot.position.set(0, 5.6, -0.1);
  topSpot.target = root;
  root.add(topSpot);

  // 3. Crisp Rear Rim Lights: cool steel-blue edge highlights on shoulders and arms
  const rimLightL = new THREE.DirectionalLight(0x688ba6, 2.2);
  rimLightL.position.set(-2.8, 3.6, -3.8);
  root.add(rimLightL);

  const rimLightR = new THREE.DirectionalLight(0x688ba6, 2.2);
  rimLightR.position.set(2.8, 3.6, -3.8);
  root.add(rimLightR);

  // 4. Low tactical fill to prevent pitch black while maintaining deep moody contrast
  const tacticalFill = new THREE.AmbientLight(0x101620, 0.4);
  root.add(tacticalFill);

  // Character hierarchy
  const characterGroup = new THREE.Group();
  characterGroup.position.y = 0.02;
  root.add(characterGroup);

  // Dynamic mesh references
  let torsoGroup: THREE.Group | null = null;
  let chestMesh: THREE.Mesh | null = null;
  let headGroup: THREE.Group | null = null;
  let armL: THREE.Group | null = null;
  let armR: THREE.Group | null = null;
  let weaponGroup: THREE.Group | null = null;

  function buildCharacter() {
    // Clear old character children
    while (characterGroup.children.length > 0) {
      characterGroup.remove(characterGroup.children[0]);
    }

    const isUSMC = currentFaction === 'usmc';
    const isSpecialized = currentGearTier === 'specialized';

    // Gritty, realistic modern military palettes
    // USMC: Olive drab fatigues, woodland accents, coyote tan webbing
    // Apex: Matte charcoal / black carbon weave, dark tactical slate
    const shirtColor = isUSMC ? 0x3e4a2d : 0x181a1e;
    const pantsColor = isUSMC ? 0x28331f : 0x121316;
    const vestColor = isUSMC 
      ? (isSpecialized ? 0x3b4629 : 0x485834) // Battle-worn heavy olive drab for breacher
      : (isSpecialized ? 0x1c1f26 : 0x191c21); // Multicam-black for recon rig
    const helmetColor = isUSMC ? 0x343e26 : 0x131518;
    const skinColor = isUSMC ? 0xd2a482 : 0xcab5a2;
    const pouchesColor = isUSMC ? 0x6e6149 : 0x242830; // Coyote tan for USMC, charcoal for Apex
    const plateArmorColor = isUSMC ? 0x303a22 : 0x16181c;

    // Materials
    const matShirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.82 });
    const matPants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
    const matVest = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.72 });
    const matPlateArmor = new THREE.MeshStandardMaterial({ color: plateArmorColor, roughness: 0.65, metalness: 0.25 });
    const matHelmet = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.65, metalness: 0.15 });
    const matSkin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.72 });
    const matBoots = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.9 });
    const matPouches = new THREE.MeshStandardMaterial({ color: pouchesColor, roughness: 0.85 });
    const matGloves = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.85 });
    const matHeadset = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.6, metalness: 0.3 });
    const matVisorSmoked = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.2, metalness: 0.85 });
    const matBeard = new THREE.MeshStandardMaterial({ color: 0x261e18, roughness: 0.95 });

    // Dynamic pedestal tint
    if (isUSMC) {
      edgeTrimMat.color.setHex(0x6e6149); // Coyote tan trim
    } else {
      edgeTrimMat.color.setHex(0x4a5568); // Matte gunmetal trim
    }

    // 1. LEGS (Standard Combat Fatigues with Kneepads)
    // Left Leg
    const legLGroup = new THREE.Group();
    legLGroup.position.set(-0.16, 0.92, 0);
    const thighL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.17), matPants);
    thighL.position.y = -0.22;
    thighL.castShadow = true;
    const shinL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.16), matPants);
    shinL.position.y = -0.62;
    shinL.castShadow = true;
    // Ballistic Kneepad
    const kneeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.05), matPlateArmor);
    kneeL.position.set(0, -0.42, 0.09);
    kneeL.castShadow = true;
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), matBoots);
    bootL.position.set(0, -0.86, 0.04);
    bootL.castShadow = true;
    legLGroup.add(thighL, shinL, kneeL, bootL);

    // Right Leg
    const legRGroup = new THREE.Group();
    legRGroup.position.set(0.16, 0.92, 0);
    const thighR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.17), matPants);
    thighR.position.y = -0.22;
    thighR.castShadow = true;
    const shinR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.16), matPants);
    shinR.position.y = -0.62;
    shinR.castShadow = true;
    const kneeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.05), matPlateArmor);
    kneeR.position.set(0, -0.42, 0.09);
    kneeR.castShadow = true;
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), matBoots);
    bootR.position.set(0, -0.86, 0.04);
    bootR.castShadow = true;
    legRGroup.add(thighR, shinR, kneeR, bootR);

    characterGroup.add(legLGroup, legRGroup);

    // 2. TORSO HIERARCHY
    torsoGroup = new THREE.Group();
    characterGroup.add(torsoGroup);

    // Lower abdomen / waist (proportioned to prevent texture bleeding)
    const lowerTorso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.24), matPants);
    lowerTorso.position.y = 0.98;
    lowerTorso.castShadow = true;
    torsoGroup.add(lowerTorso);

    // Tactical Webbing Duty Belt (clean boundary, zero z-fighting)
    const dutyBelt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.26), matPouches);
    dutyBelt.position.y = 0.94;
    torsoGroup.add(dutyBelt);

    // Chest / Upper Torso: Broader masculine soldier frame (widened by 20%)
    chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 0.28), matShirt);
    chestMesh.position.y = 1.28;
    chestMesh.castShadow = true;
    torsoGroup.add(chestMesh);

    // Widened shoulder-girdle mesh blocks (+20% broader shoulder span)
    const shoulderGirdleL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.25), matShirt);
    shoulderGirdleL.position.set(-0.31, 1.40, 0);
    shoulderGirdleL.castShadow = true;
    const shoulderGirdleR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.25), matShirt);
    shoulderGirdleR.position.set(0.31, 1.40, 0);
    shoulderGirdleR.castShadow = true;
    torsoGroup.add(shoulderGirdleL, shoulderGirdleR);

    if (currentTorsoConfig === 'molle_vest') {
      // Heavy battle-worn modular plate carrier (IOTV style - expanded thickness bounding cube)
      const iotvCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.38), matVest);
      iotvCarrier.position.set(0, 1.29, 0.02);
      iotvCarrier.castShadow = true;
      torsoGroup.add(iotvCarrier);

      // Attached Neck Ballistic Guard Collar (sits tightly against collar)
      const neckGuard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.10, 0.32), matPlateArmor);
      neckGuard.position.set(0, 1.45, 0.01);
      neckGuard.castShadow = true;
      torsoGroup.add(neckGuard);

      // Heavy Quad Ammo Pouches + Side Ballistic Plates
      [-0.15, -0.05, 0.05, 0.15].forEach((px) => {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.08), matPouches);
        pouch.position.set(px, 1.20, 0.22);
        pouch.castShadow = true;
        torsoGroup.add(pouch);
      });
    } else {
      // Low-profile modular chest rig / plate carrier (expanded thickness bounding cube)
      const standardPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.34), matVest);
      standardPlate.position.set(0, 1.28, 0.02);
      standardPlate.castShadow = true;
      torsoGroup.add(standardPlate);

      // Modular cross-harness straps
      const harnessL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.32), matPouches);
      harnessL.position.set(-0.19, 1.28, 0.01);
      const harnessR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.32), matPouches);
      harnessR.position.set(0.19, 1.28, 0.01);
      torsoGroup.add(harnessL, harnessR);

      // Triple Mag Pouch on front
      [-0.13, 0, 0.13].forEach((px) => {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.06), matPouches);
        pouch.position.set(px, 1.18, 0.20);
        pouch.castShadow = true;
        torsoGroup.add(pouch);
      });
    }

    // Tactical IR American Flag Patch on Chest Rig (visible in reference image)
    const matFlagPatch = new THREE.MeshStandardMaterial({
      color: 0x1a1d22,
      roughness: 0.6,
      metalness: 0.2
    });
    const flagPatchBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.015), matFlagPatch);
    flagPatchBase.position.set(0, 1.35, 0.195);
    torsoGroup.add(flagPatchBase);
    
    // Tactical subdued IR Flag Details
    const flagStripes = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.06, 0.016),
      new THREE.MeshStandardMaterial({ color: isUSMC ? 0x968065 : 0x4a5568, roughness: 0.8 })
    );
    flagStripes.position.set(0, 1.35, 0.196);
    torsoGroup.add(flagStripes);

    // Front Dangler Admin Fanny Pack (below vest at waist level)
    const dangler = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.08), matPouches);
    dangler.position.set(0, 0.95, 0.18);
    dangler.castShadow = true;
    const danglerPatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.01),
      new THREE.MeshStandardMaterial({ color: isUSMC ? 0xb58e72 : 0x5a6a80, roughness: 0.7 })
    );
    danglerPatch.position.set(0, 0.95, 0.225);
    torsoGroup.add(dangler, danglerPatch);

    if (currentLowerConfig === 'pouches') {
      // Groin Ballistic Protector Flap
      const groinFlap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.06), matPlateArmor);
      groinFlap.position.set(0, 0.84, 0.14);
      groinFlap.castShadow = true;
      torsoGroup.add(groinFlap);
      
      const sidePouchL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.12), matPouches);
      sidePouchL.position.set(-0.22, 0.94, 0);
      const sidePouchR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.12), matPouches);
      sidePouchR.position.set(0.22, 0.94, 0);
      torsoGroup.add(sidePouchL, sidePouchR);
    } else {
      // Thigh Holster on Right Leg
      const holsterDrop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.14), matPlateArmor);
      holsterDrop.position.set(0.12, -0.05, 0);
      holsterDrop.castShadow = true;
      legRGroup.add(holsterDrop); // Attach to legRGroup!
      
      const sidearm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.10), new THREE.MeshStandardMaterial({color: 0x111111}));
      sidearm.position.set(0.15, -0.05, 0.02);
      legRGroup.add(sidearm);
    }

    // Neck: Compressed length by 30% (0.126 vs 0.18) so it sits tightly against the collar
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.126, 12), matSkin);
    neck.position.set(0, 1.43, 0);
    neck.castShadow = true;
    torsoGroup.add(neck);

    // 3. HEAD & HELMET / HEADSET ASSEMBLY (seated low and tightly against collar)
    headGroup = new THREE.Group();
    headGroup.position.set(0, 1.53, 0);
    torsoGroup.add(headGroup);

    const headBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), matSkin);
    headBase.position.y = 0.08;
    headBase.castShadow = true;
    headGroup.add(headBase);

    // Tactical Communications Headset & Ear Cups (common to most configs)
    const commL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), matHeadset);
    commL.position.set(-0.145, 0.09, 0);
    const commR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.08), matHeadset);
    commR.position.set(0.145, 0.09, 0);
    headGroup.add(commL, commR);

    // Tactical Throat Mic / Boom Mic
    const boomMic = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.14), matHeadset);
    boomMic.position.set(-0.10, 0.03, 0.10);
    boomMic.rotation.y = 0.45;
    headGroup.add(boomMic);

    if (currentHeadgear === 'fast') {
      // Ballistic FAST Helmet (high-cut tactical helmet with NVG quad-tubes removed)
      const helmetMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.29, 0.19, 0.30), 
        matHelmet
      );
      helmetMesh.position.set(0, 0.17, -0.01);
      helmetMesh.castShadow = true;
      headGroup.add(helmetMesh);

      // Clean Wilcox G24 NVG Mounting Shroud on front
      const nvgBracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), matPlateArmor);
      nvgBracket.position.set(0, 0.17, 0.15);
      headGroup.add(nvgBracket);

      // Tactical ARC accessory rails along helmet sides
      const arcRailL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.18), matPlateArmor);
      arcRailL.position.set(-0.15, 0.16, 0);
      const arcRailR = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.18), matPlateArmor);
      arcRailR.position.set(0.15, 0.16, 0);
      headGroup.add(arcRailL, arcRailR);

      // Velcro Loop Morale Patches on top
      const velcroTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.14), matPouches);
      velcroTop.position.set(0, 0.27, 0);
      headGroup.add(velcroTop);
    } else if (currentHeadgear === 'boonie') {
      // Boonie Hat (Soft fabric rim)
      const hatBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.26), matVest);
      hatBase.position.set(0, 0.18, 0);
      const hatRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16), matVest);
      hatRim.position.set(0, 0.14, 0);
      headGroup.add(hatBase, hatRim);
    } else if (currentHeadgear === 'skull') {
      // Ballistic Skull Mask with clean high-contrast black/white skull graphic texture
      const matSkullMask = new THREE.MeshStandardMaterial({
        map: skullTexture,
        roughness: 0.45,
        metalness: 0.15
      });
      const skullMask = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.16), matSkullMask);
      skullMask.position.set(0, 0.06, 0.09);
      skullMask.castShadow = true;
      headGroup.add(skullMask);
      
      // Tactical Balaclava Cap
      const balaclavaCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.14, 0.25), 
        new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.85 })
      );
      balaclavaCap.position.set(0, 0.20, 0);
      headGroup.add(balaclavaCap);
    } else {
      // Base config (no headgear), just add a headband for the headset
      const headband = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.03, 0.06), matHeadset);
      headband.position.set(0, 0.21, 0);
      headGroup.add(headband);
    }

    if (currentVisor === 'recon') {
      // Dark ballistic visor shield plate
      const visorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.09, 0.05), matVisorSmoked);
      visorPlate.position.set(0, 0.11, 0.14);
      headGroup.add(visorPlate);
    } else if (currentVisor === 'apex') {
      const visorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.06), new THREE.MeshStandardMaterial({color: 0xff4400, emissive: 0x551100}));
      visorPlate.position.set(0, 0.11, 0.14);
      headGroup.add(visorPlate);
    }

    // 4. ARMS & DYNAMIC WEAPON MOUNTING STANCE (Tactical Low-Ready Operator Grip)
    const isRolledSleeves = !isUSMC && isSpecialized;
    const lowerArmMat = isRolledSleeves ? matSkin : matShirt;

    // Left Arm (Support Hand reaching across to cradle forend/handguard)
    armL = new THREE.Group();
    armL.position.set(-0.32, 1.40, 0);
    torsoGroup.add(armL);

    const upperArmL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.15), matShirt);
    upperArmL.position.set(0.04, -0.12, 0.06);
    upperArmL.rotation.set(-0.68, 0.38, -0.15);
    upperArmL.castShadow = true;
    armL.add(upperArmL);

    if (isRolledSleeves) {
      const cuffL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.16), matShirt);
      cuffL.position.set(0.06, -0.25, 0.14);
      cuffL.rotation.set(-0.68, 0.38, -0.15);
      armL.add(cuffL);
    }

    const lowerArmL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.12), lowerArmMat);
    lowerArmL.position.set(0.16, -0.28, 0.26);
    lowerArmL.rotation.set(-0.82, 0.55, 0.25);
    lowerArmL.castShadow = true;

    // Tactical wrist watch on left arm
    const watch = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.04, 0.035), 
      new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.3, metalness: 0.8 })
    );
    watch.position.set(0.02, 0.04, 0.05);
    lowerArmL.add(watch);

    // Left Glove (cradles the forward handguard / pump)
    const gloveL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.10, 0.12), matGloves);
    gloveL.position.set(0, -0.15, 0.02);
    gloveL.castShadow = true;
    lowerArmL.add(gloveL);
    armL.add(lowerArmL);

    // Right Arm (Trigger Hand grasping the pistol grip)
    armR = new THREE.Group();
    armR.position.set(0.32, 1.40, 0);
    torsoGroup.add(armR);

    const upperArmR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.15), matShirt);
    upperArmR.position.set(-0.04, -0.12, 0.04);
    upperArmR.rotation.set(-0.58, -0.25, 0.12);
    upperArmR.castShadow = true;
    armR.add(upperArmR);

    if (isRolledSleeves) {
      const cuffR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.16), matShirt);
      cuffR.position.set(-0.06, -0.25, 0.12);
      cuffR.rotation.set(-0.58, -0.25, 0.12);
      armR.add(cuffR);
    }

    const lowerArmR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.12), lowerArmMat);
    lowerArmR.position.set(-0.12, -0.28, 0.22);
    lowerArmR.rotation.set(-0.72, -0.22, -0.18);
    lowerArmR.castShadow = true;

    // Right Glove (wraps tightly around the pistol grip)
    const gloveR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.10, 0.12), matGloves);
    gloveR.position.set(0, -0.15, 0.02);
    gloveR.castShadow = true;
    lowerArmR.add(gloveR);
    armR.add(lowerArmR);

    // 5. WEAPON: Anchored dynamically into operator hand coordinates
    // Socket sits directly at the right hand trigger point, with barrel pointing forward across chest in low-ready
    weaponGroup = new THREE.Group();
    weaponGroup.position.set(0.14, 1.05, 0.26);
    weaponGroup.rotation.set(0.24, -0.22, -0.28);
    torsoGroup.add(weaponGroup);

    buildWeaponMesh(weaponGroup, currentWeapon);
  }

  function buildWeaponMesh(targetGroup: THREE.Group, weaponId: string) {
    while (targetGroup.children.length > 0) {
      targetGroup.remove(targetGroup.children[0]);
    }

    const matGunMetal = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.42, metalness: 0.82 });
    const matGunDark = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.68, metalness: 0.4 });
    const matGunGrey = new THREE.MeshStandardMaterial({ color: 0x3e434a, roughness: 0.45, metalness: 0.65 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0x5a6270, roughness: 0.35, metalness: 0.6 });
    const matLaserGlow = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00bcd4, emissiveIntensity: 2.0 });
    const matOpticCyan = new THREE.MeshStandardMaterial({ color: 0x2de2e6, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x00838f, emissiveIntensity: 0.9 });

    if (weaponId === 'shotgun') {
      // Expedite 12 Tactical Shotgun
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.10, 0.42), matGunDark);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 10), matGunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03, 0.24);
      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 10), matGunDark);
      magTube.rotation.x = Math.PI / 2;
      magTube.position.set(0, -0.01, 0.22);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.16), matGunMetal);
      pump.position.set(0, -0.01, 0.18);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.12, 0.07), matGunDark);
      grip.position.set(0, -0.08, -0.06);
      grip.rotation.x = 0.25;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.22), matGunDark);
      stock.position.set(0, -0.01, -0.20);
      targetGroup.add(body, barrel, magTube, pump, grip, stock);

    } else if (weaponId === 'sniper') {
      // Signal 50 Heavy Anti-Materiel Sniper Rifle
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.55), matGunDark);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.78, 10), matGunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03, 0.38);
      const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.09), matGunMetal);
      muzzleBrake.position.set(0, 0.03, 0.78);
      const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 10), matGunDark);
      scopeTube.rotation.x = Math.PI / 2;
      scopeTube.position.set(0, 0.11, 0.05);
      const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.020, 12), matOpticCyan);
      scopeLens.position.set(0, 0.11, -0.11);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 0.07), matGunDark);
      grip.position.set(0, -0.09, -0.05);
      grip.rotation.x = 0.25;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.26), matGunDark);
      stock.position.set(0, -0.01, -0.22);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.10), matGunMetal);
      mag.position.set(0, -0.10, 0.08);
      mag.rotation.x = 0.2;
      targetGroup.add(body, barrel, muzzleBrake, scopeTube, scopeLens, grip, stock, mag);

    } else if (weaponId === 'pistol') {
      // Combat 9mm Tactical Sidearm
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.22), matGunMetal);
      slide.position.set(0, 0.04, 0.04);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.05, 0.20), matGunDark);
      frame.position.set(0, 0.0, 0.04);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.075), matGunDark);
      grip.position.set(0, -0.08, -0.04);
      grip.rotation.x = 0.24;
      const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.06), matGunMetal);
      triggerGuard.position.set(0, -0.04, 0.02);
      targetGroup.add(slide, frame, grip, triggerGuard);

    } else if (weaponId === 'smg') {
      // VEL-46 Submachine Gun
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.32), matGunDark);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 10), matGunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, 0.20);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.22, 0.05), matGunMetal);
      mag.position.set(0, -0.12, 0.06);
      mag.rotation.x = 0.18;
      const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.10, 0.04), matGunDark);
      foregrip.position.set(0, -0.08, 0.18);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.12, 0.065), matGunDark);
      grip.position.set(0, -0.08, -0.04);
      grip.rotation.x = 0.25;
      const optic = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.08), matAccent);
      optic.position.set(0, 0.07, 0.02);
      targetGroup.add(receiver, barrel, mag, foregrip, grip, optic);

    } else if (weaponId === 'lmg') {
      // Sakin Heavy LMG with underslung drum
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.13, 0.48), matGunDark);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 10), matGunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, 0.28);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.13, 16), matGunMetal);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(0, -0.12, 0.06);
      const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.16), matAccent);
      carryHandle.position.set(0, 0.10, 0.12);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.12, 0.07), matGunDark);
      grip.position.set(0, -0.09, -0.08);
      grip.rotation.x = 0.24;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.22), matGunDark);
      stock.position.set(0, -0.01, -0.24);
      targetGroup.add(receiver, barrel, drum, carryHandle, grip, stock);

    } else if (weaponId === 'br') {
      // F2000 Bullpup Battle Rifle (Monolithic chassis, integrated optic, bullpup rear magazine)
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 0.44), matGunDark);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.35, 10), matGunMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, 0.26);
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.06), matGunMetal);
      muzzle.position.set(0, 0.02, 0.42);
      // Integrated carry handle & optic box
      const opticShroud = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.065, 0.24), matGunGrey);
      opticShroud.position.set(0, 0.09, 0.02);
      const opticLens = new THREE.Mesh(new THREE.CircleGeometry(0.016, 12), matOpticCyan);
      opticLens.position.set(0, 0.09, -0.10);
      // Ergonomic front handguard
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.18), matGunMetal);
      handguard.position.set(0, -0.03, 0.16);
      // Pistol Grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.12, 0.065), matGunDark);
      grip.position.set(0, -0.09, 0.02);
      grip.rotation.x = 0.24;
      // Rear bullpup magazine (strictly situated BEHIND pistol grip in stock)
      const bullpupMag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.15, 0.075), matGunMetal);
      bullpupMag.position.set(0, -0.08, -0.14);
      bullpupMag.rotation.x = -0.15;
      // Thumbhole rear stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.12, 0.22), matGunDark);
      stock.position.set(0, -0.01, -0.22);
      targetGroup.add(chassis, barrel, muzzle, opticShroud, opticLens, handguard, grip, bullpupMag, stock);

    } else if (weaponId === 'laser') {
      // Covenant Plasma Beam Rifle (Curved chassis, heat louvers, glowing power core)
      const matAlienChassis = new THREE.MeshStandardMaterial({ color: 0x3d205c, roughness: 0.35, metalness: 0.85 });
      const mainFrame = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.11, 0.45), matAlienChassis);
      const emitterSnout = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.15, 12), matGunMetal);
      emitterSnout.rotation.x = -Math.PI / 2;
      emitterSnout.position.set(0, 0.01, 0.28);
      const glowingCore = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), matLaserGlow);
      glowingCore.position.set(0, 0.04, 0.02);
      const heatFins = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.14), matAlienChassis);
      heatFins.position.set(0, 0.02, -0.10);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.065), matGunDark);
      grip.position.set(0, -0.08, 0.0);
      grip.rotation.x = 0.25;
      targetGroup.add(mainFrame, emitterSnout, glowingCore, heatFins, grip);

    } else if (weaponId === 'minigun') {
      // Vulcan Rotary Cannon (Rotating 6-barrel cluster, motor housing, chainsaw carry handle)
      const motorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.32), matGunDark);
      const barrelCluster = new THREE.Group();
      barrelCluster.position.set(0, 0, 0.28);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.44, 8), matGunMetal);
        b.rotation.x = Math.PI / 2;
        b.position.set(Math.cos(angle) * 0.038, Math.sin(angle) * 0.038, 0);
        barrelCluster.add(b);
      }
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 8, 16), matGunMetal);
      ring1.position.z = 0.12;
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 8, 16), matGunMetal);
      ring2.position.z = -0.12;
      barrelCluster.add(ring1, ring2);

      const topHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.22), matAccent);
      topHandle.position.set(0, 0.11, 0.04);
      const rearGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), matGunDark);
      rearGrip.position.set(0, -0.06, -0.14);
      targetGroup.add(motorHousing, barrelCluster, topHandle, rearGrip);

    } else if (weaponId === 'railgun') {
      // Kinetic AP Railgun (Dual parallel electromagnetic accelerator rails)
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.48), matGunDark);
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.58), matGunMetal);
      topRail.position.set(0, 0.045, 0.26);
      const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.58), matGunMetal);
      bottomRail.position.set(0, -0.015, 0.26);
      const acceleratorGlow = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.50), matLaserGlow);
      acceleratorGlow.position.set(0, 0.015, 0.24);
      const capacitorStock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.24), matGunDark);
      capacitorStock.position.set(0, 0, -0.22);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.12, 0.065), matGunDark);
      grip.position.set(0, -0.08, -0.04);
      grip.rotation.x = 0.25;
      targetGroup.add(chassis, topRail, bottomRail, acceleratorGlow, capacitorStock, grip);

    } else {
      // Default M4A1 Tactical Assault Rifle (quad-rail, STANAG mag, holographic optic)
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.10, 0.38), matGunMetal);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 10), matGunDark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.025, 0.26);
      const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8), matGunMetal);
      flashHider.rotation.x = Math.PI / 2;
      flashHider.position.set(0, 0.025, 0.48);
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.22), matGunDark);
      handguard.position.set(0, 0.025, 0.18);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.16, 0.08), matGunDark);
      mag.position.set(0, -0.10, 0.05);
      mag.rotation.x = 0.22;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.12, 0.065), matGunDark);
      grip.position.set(0, -0.08, -0.06);
      grip.rotation.x = 0.26;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.20), matGunDark);
      stock.position.set(0, -0.01, -0.22);
      const optic = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.045, 0.11), matAccent);
      optic.position.set(0, 0.075, 0.0);
      const opticReticle = new THREE.Mesh(new THREE.CircleGeometry(0.014, 10), matOpticCyan);
      opticReticle.position.set(0, 0.075, -0.056);
      targetGroup.add(receiver, barrel, flashHider, handguard, mag, grip, stock, optic, opticReticle);
    }
  }

  buildCharacter();

  return {
    group: root,
    update: (timeSec: number) => {
      // Organic breathing simulation
      const breathPhase = timeSec * 2.0;
      const breathScale = 1.0 + Math.sin(breathPhase) * 0.022;
      if (chestMesh) {
        chestMesh.scale.set(breathScale, breathScale, breathScale);
      }
      if (headGroup) {
        headGroup.position.y = 1.53 + Math.sin(breathPhase) * 0.007;
        headGroup.rotation.y = Math.sin(timeSec * 0.4) * 0.06;
      }
      if (torsoGroup) {
        torsoGroup.position.y = Math.sin(breathPhase) * 0.004;
      }
      if (weaponGroup) {
        weaponGroup.position.y = 1.05 + Math.sin(breathPhase) * 0.003;
      }

      // Smooth turntable base rotation
      pedestalRing.rotation.z = timeSec * 0.15;
    },
    setFaction: (faction: FactionType) => {
      if (currentFaction !== faction) {
        currentFaction = faction;
        buildCharacter();
      }
    },
    setGearTier: (tier: GearTier) => {
      if (currentGearTier !== tier) {
        currentGearTier = tier;
        buildCharacter();
      }
    },
    setVisor: (visor: VisorType) => {
      if (currentVisor !== visor) {
        currentVisor = visor;
        buildCharacter();
      }
    },
    setHeadgear: (h) => {
      if (currentHeadgear !== h) {
        currentHeadgear = h;
        buildCharacter();
      }
    },
    setTorsoConfig: (t) => {
      if (currentTorsoConfig !== t) {
        currentTorsoConfig = t;
        buildCharacter();
      }
    },
    setLowerConfig: (l) => {
      if (currentLowerConfig !== l) {
        currentLowerConfig = l;
        buildCharacter();
      }
    },
    setWeapon: (weaponId: string) => {
      if (currentWeapon !== weaponId) {
        currentWeapon = weaponId;
        if (weaponGroup) buildWeaponMesh(weaponGroup, weaponId);
      }
    },
    destroy: () => {
      scene.remove(root);
    }
  };
}

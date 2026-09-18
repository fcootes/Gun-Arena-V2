const fs = require('fs');
let code = fs.readFileSync('src/botBuilder.ts', 'utf-8');

code = code.replace(/zType: 'walker' \| 'runner' \| 'tank';/g, "zType: 'walker' | 'runner' | 'tank' | 'brute' | 'banshee' | 'bloater' | 'megaboss';");

code = code.replace(/\} else if \(zType === 'tank'\) \{/g, `} else if (zType === 'tank') {
      headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.5);
      armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
      legGeo = new THREE.BoxGeometry(0.28, 0.9, 0.28);
      baseColor = 0x243322;
      eyeColor = 0x88ff00;
    } else if (zType === 'brute') {
      headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      torsoGeo = new THREE.BoxGeometry(0.8, 1.1, 0.6);
      armGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);
      legGeo = new THREE.BoxGeometry(0.3, 1.0, 0.3);
      baseColor = 0x4a3a3a;
      eyeColor = 0xff3300;
    } else if (zType === 'banshee') {
      headGeo = new THREE.BoxGeometry(0.2, 0.35, 0.2);
      torsoGeo = new THREE.BoxGeometry(0.3, 0.8, 0.2);
      armGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);
      legGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
      baseColor = 0x88aacc;
      eyeColor = 0xffffff;
    } else if (zType === 'bloater') {
      headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      torsoGeo = new THREE.BoxGeometry(1.0, 0.9, 1.0);
      armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
      legGeo = new THREE.BoxGeometry(0.3, 0.7, 0.3);
      baseColor = 0x3a4a2a;
      eyeColor = 0xddff22;
    } else if (zType === 'megaboss') {
      headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
      torsoGeo = new THREE.BoxGeometry(1.2, 1.4, 0.8);
      armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
      legGeo = new THREE.BoxGeometry(0.4, 1.4, 0.4);
      baseColor = 0x111111;
      eyeColor = 0xff0000;
    `);

// Wait, the original code had:
//    } else if (zType === 'tank') {
//      headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
//      torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.5);
//      armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
//      legGeo = new THREE.BoxGeometry(0.28, 0.9, 0.28);
//      baseColor = 0x243322; // Sickly dark green
//      eyeColor = 0x88ff00; // Glowing green eyes

fs.writeFileSync('src/botBuilder.ts', code);

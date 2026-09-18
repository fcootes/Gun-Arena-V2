import React from 'react';

// Hyper-detailed, ultra-thin realistic military vector stroke weapon silhouettes
// Matching the Modern Warfare armory concept reference image with uniform stroke weight and precision geometry
export const WeaponSilhouette: React.FC<{ id: string; className?: string }> = ({ id, className = 'w-full h-full' }) => {
  const stroke = '#FFFFFF';
  const strokeWidth = 1.25;

  switch (id) {
    case 'ar':
      // 1. M4A1 TACTICAL (ASSAULT RIFLE)
      // Classic carbine with A2 front sight post, quad-rail handguard with ribbing, carrying handle / rear sight,
      // curved STANAG magazine, textured pistol grip, 6-position adjustable Crane stock with buffer tube.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Buffer tube & Crane collapsible stock */}
          <path d="M 22 24 L 26 24 L 26 46 L 22 46 Z" />
          <line x1="26" y1="28" x2="68" y2="28" />
          <line x1="26" y1="34" x2="68" y2="34" />
          <path d="M 26 25 L 50 25 L 56 34 L 50 41 L 36 41 L 26 45" />
          <line x1="38" y1="36" x2="46" y2="36" />
          <rect x="29" y="32" width="6" height="3" rx="0.5" />

          {/* Receiver & Carrying Handle / Optics */}
          <line x1="68" y1="26" x2="118" y2="26" />
          <path d="M 72 26 L 76 18 L 86 18 L 90 26" />
          <circle cx="81" cy="21" r="1.5" />
          <line x1="74" y1="24" x2="74" y2="26" />
          <line x1="84" y1="24" x2="84" y2="26" />
          <line x1="94" y1="24" x2="94" y2="26" />
          <line x1="104" y1="24" x2="104" y2="26" />
          <line x1="114" y1="24" x2="114" y2="26" />
          <path d="M 88 28 L 93 30 L 88 32 Z" />
          <rect x="94" y="28" width="12" height="4" />

          {/* Lower Receiver, Trigger & Ergonomic Grip */}
          <path d="M 82 38 L 72 56 L 82 58 L 88 41" />
          <line x1="75" y1="46" x2="81" y2="48" />
          <line x1="74" y1="50" x2="80" y2="52" />
          <path d="M 84 38 L 84 44 L 98 44" />
          <path d="M 89 39 Q 92 42 89 43" />

          {/* Magazine Well & Curved 30R STANAG Magazine */}
          <path d="M 100 34 L 100 44 L 116 44 L 116 34" />
          <path d="M 102 44 L 100 58 Q 104 62 112 60 L 115 44" />
          <line x1="103" y1="50" x2="113" y2="48" />
          <line x1="102" y1="54" x2="111" y2="52" />

          {/* Delta Ring & Quad-Rail Handguard */}
          <rect x="118" y="25" width="4" height="10" />
          <line x1="122" y1="26" x2="164" y2="26" />
          <line x1="122" y1="35" x2="164" y2="35" />
          <line x1="128" y1="27" x2="128" y2="34" />
          <line x1="134" y1="27" x2="134" y2="34" />
          <line x1="140" y1="27" x2="140" y2="34" />
          <line x1="146" y1="27" x2="146" y2="34" />
          <line x1="152" y1="27" x2="152" y2="34" />
          <line x1="158" y1="27" x2="158" y2="34" />

          {/* A2 Triangular Front Sight Post & Bayonet Lug */}
          <rect x="164" y="27" width="8" height="8" />
          <path d="M 166 27 L 170 16 L 174 27" />
          <line x1="170" y1="18" x2="170" y2="23" />
          <rect x="168" y="35" width="4" height="3" />

          {/* Barrel & Birdcage Flash Hider */}
          <line x1="174" y1="30.5" x2="190" y2="30.5" />
          <line x1="174" y1="31.5" x2="190" y2="31.5" />
          <rect x="190" y="29" width="8" height="4" rx="0.5" />
          <line x1="193" y1="29" x2="193" y2="33" />
        </svg>
      );

    case 'shotgun':
      // 2. EXPEDITE 12 (TACTICAL SHOTGUN)
      // Modern semi-auto / pump tactical shotgun: contoured stock with cheek rest,
      // long tubular magazine under barrel, ribbed forend, top rib, front blade sight.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Tactical Buttstock with Comb & Cheek Rest */}
          <path d="M 22 27 L 26 27 L 26 47 L 22 47 Z" />
          <path d="M 26 28 L 46 28 L 58 34 L 70 34" />
          <path d="M 34 25 L 48 25 L 50 28 L 34 28 Z" />
          <path d="M 26 46 L 40 46 L 54 40" />

          {/* Ergonomic Pistol Grip & Trigger */}
          <path d="M 54 40 L 58 56 L 68 56 L 70 41" />
          <path d="M 70 39 L 70 45 L 82 45 L 82 39" />
          <path d="M 75 40 Q 78 43 76 44" />

          {/* Receiver with Top Rail & Ejection Port */}
          <path d="M 70 30 L 108 30 L 108 40 L 70 40 Z" />
          <line x1="72" y1="28" x2="106" y2="28" />
          <rect x="84" y="32" width="16" height="5" />

          {/* Full-length Tubular Magazine & Barrel */}
          <line x1="108" y1="31" x2="196" y2="31" />
          <line x1="108" y1="34" x2="196" y2="34" />
          <line x1="108" y1="36" x2="180" y2="36" />
          <line x1="108" y1="39" x2="180" y2="39" />
          <rect x="180" y="35.5" width="4" height="4" />
          <rect x="172" y="30" width="4" height="10" />

          {/* Ribbed Pump Handguard */}
          <rect x="112" y="35" width="38" height="9" rx="1.5" />
          <line x1="116" y1="35" x2="116" y2="44" />
          <line x1="120" y1="35" x2="120" y2="44" />
          <line x1="124" y1="35" x2="124" y2="44" />
          <line x1="128" y1="35" x2="128" y2="44" />
          <line x1="132" y1="35" x2="132" y2="44" />
          <line x1="136" y1="35" x2="136" y2="44" />
          <line x1="140" y1="35" x2="140" y2="44" />
          <line x1="144" y1="35" x2="144" y2="44" />

          {/* Top Ventilated Barrel Rib & Front Sight */}
          <line x1="108" y1="29" x2="192" y2="29" />
          <line x1="128" y1="29" x2="128" y2="31" />
          <line x1="148" y1="29" x2="148" y2="31" />
          <line x1="168" y1="29" x2="168" y2="31" />
          <path d="M 192 28 L 194 31" />
        </svg>
      );

    case 'sniper':
      // 3. HEAVY AP SNIPER (PRECISION RIFLE)
      // Large slotted muzzle brake, fluted barrel, M-LOK handguard, high-power telescopic
      // dual-ring optic scope, bolt handle, box magazine, adjustable sniper stock.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Precision Sniper Stock with Adjustable Pad & Cheek Riser */}
          <path d="M 20 25 L 24 25 L 24 49 L 20 49 Z" />
          <rect x="28" y="20" width="22" height="5" rx="0.5" />
          <rect x="37" y="25" width="4" height="3" />
          <path d="M 24 27 L 60 27 L 60 37 L 48 37 L 42 41 L 34 46 L 24 46" />
          <rect x="26" y="46" width="6" height="4" />

          {/* Receiver, Bolt Handle & Box Magazine */}
          <path d="M 60 27 L 106 27 L 106 37 L 60 37 Z" />
          <line x1="66" y1="29" x2="63" y2="36" />
          <circle cx="62" cy="37" r="2" />
          <path d="M 60 37 L 56 54 L 66 55 L 70 38" />
          <path d="M 70 38 L 70 44 L 80 44 L 80 38" />
          <path d="M 82 37 L 80 50 L 92 49 L 94 37 Z" />
          <line x1="84" y1="41" x2="90" y2="41" />
          <line x1="83" y1="45" x2="89" y2="45" />

          {/* High-Power Telescopic Optic Scope */}
          <rect x="74" y="23" width="5" height="4" />
          <rect x="102" y="23" width="5" height="4" />
          <path d="M 64 17 L 74 19 L 108 19 L 118 15 L 126 15 L 126 25 L 118 25 L 108 21 L 74 21 L 64 23 Z" />
          <rect x="88" y="13" width="8" height="5" rx="0.5" />
          <line x1="92" y1="13" x2="92" y2="18" />

          {/* Handguard, Folded Bipod & Fluted Free-Floating Barrel */}
          <path d="M 106 28 L 150 28 L 150 36 L 106 36 Z" />
          <rect x="112" y="30.5" width="10" height="3" />
          <rect x="128" y="30.5" width="10" height="3" />
          <line x1="144" y1="37" x2="120" y2="42" />
          <line x1="120" y1="42" x2="114" y2="42" />
          <line x1="150" y1="30.5" x2="188" y2="30.5" />
          <line x1="150" y1="33.5" x2="188" y2="33.5" />
          <line x1="154" y1="32" x2="184" y2="32" strokeDasharray="5,3" />

          {/* Massive Dual-Baffled Muzzle Brake */}
          <rect x="188" y="28" width="14" height="8" rx="0.5" />
          <rect x="191" y="29.5" width="3" height="5" />
          <rect x="196" y="29.5" width="3" height="5" />
        </svg>
      );

    case 'pistol':
      // 4. COMBAT 9MM (SIDEARM)
      // Seamlessly attached lower grip and upper slide assembly, rear & front slide serrations,
      // undercut trigger guard, combat sights, flush magazine baseplate.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Upper Slide & Combat Sights */}
          <path d="M 76 20 L 144 20 Q 146 20 146 22 L 146 31 L 76 31 Z" />
          <rect x="78" y="17" width="4" height="3" />
          <rect x="140" y="17" width="3" height="3" />
          <rect x="98" y="20" width="16" height="5" />

          {/* Rear Cocking Serrations */}
          <line x1="82" y1="21" x2="82" y2="30" />
          <line x1="85" y1="21" x2="85" y2="30" />
          <line x1="88" y1="21" x2="88" y2="30" />
          <line x1="91" y1="21" x2="91" y2="30" />

          {/* Front Cocking Serrations */}
          <line x1="128" y1="21" x2="128" y2="30" />
          <line x1="131" y1="21" x2="131" y2="30" />
          <line x1="134" y1="21" x2="134" y2="30" />
          <line x1="137" y1="21" x2="137" y2="30" />

          {/* Lower Dust Cover & Accessory Rail */}
          <path d="M 116 31 L 146 31 L 146 35 L 116 35" />
          <line x1="122" y1="35" x2="142" y2="35" />
          <line x1="126" y1="33" x2="126" y2="35" />
          <line x1="132" y1="33" x2="132" y2="35" />
          <line x1="138" y1="33" x2="138" y2="35" />

          {/* Undercut Trigger Guard & Trigger Shoe */}
          <path d="M 116 35 L 116 42 Q 116 44 113 44 L 100 44 L 100 35" />
          <path d="M 106 35 Q 110 39 108 42" />

          {/* Seamless Beavertail & Ergonomic Grip Handle */}
          <path d="M 76 31 L 68 34 Q 66 37 72 40" />
          <path d="M 72 40 L 80 58 L 98 58 L 100 44" />
          <rect x="78" y="42" width="16" height="12" rx="1" />
          <rect x="78" y="58" width="22" height="3" rx="0.5" />
        </svg>
      );

    case 'smg':
      // 5. VEL-46 SUBMACHINE (SUBMACHINE GUN)
      // MP7 style: retractable dual-rod wire stock, full-length top Picatinny rail,
      // center-balance pistol grip with extended stick magazine, folding vertical foregrip, flash hider.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Dual-Rod Retractable Wire Stock */}
          <line x1="32" y1="26" x2="78" y2="26" />
          <line x1="32" y1="34" x2="78" y2="34" />
          <path d="M 30 22 L 34 22 L 34 40 L 30 40 Z" />

          {/* Receiver & Full Top Picatinny Rail */}
          <line x1="80" y1="20" x2="162" y2="20" />
          <line x1="86" y1="18" x2="86" y2="20" />
          <line x1="156" y1="18" x2="156" y2="20" />
          <path d="M 78 22 L 164 22 L 164 34 L 138 34 L 138 38 L 126 38 L 126 34 L 106 34 L 102 44 L 88 44 L 84 34 L 78 34 Z" />
          <rect x="108" y="24" width="16" height="5" />
          <circle cx="94" cy="30" r="1.5" />

          {/* Pistol Grip & Extended Stick Magazine */}
          <path d="M 84 34 L 88 48 L 98 48 L 100 34" />
          <path d="M 90 48 L 92 60 L 98 60 L 96 48" />
          <rect x="91" y="59" width="8" height="2" />
          <path d="M 100 35 L 100 42 L 110 42 L 110 35" />
          <path d="M 104 36 Q 106 39 105 41" />

          {/* Deployed Folding Front Vertical Grip */}
          <path d="M 130 35 L 130 49 L 136 49 L 136 35" />

          {/* Barrel & Flash Hider */}
          <line x1="164" y1="27" x2="176" y2="27" />
          <line x1="164" y1="29" x2="176" y2="29" />
          <rect x="176" y="25" width="8" height="6" rx="0.5" />
          <line x1="179" y1="25" x2="179" y2="31" />
        </svg>
      );

    case 'lmg':
      // 6. SAKIN HEAVY LMG (LIGHT MACHINE GUN)
      // Fixed clubfoot stock, receiver with feed tray, top carry handle,
      // large continuous 100R box magazine, perforated barrel heat shield, deployed bipod legs.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Heavy Fixed Clubfoot Buttstock */}
          <path d="M 22 26 L 26 26 L 26 44 L 22 44 Z" />
          <path d="M 26 27 L 46 27 L 54 33 L 64 33 L 64 38 L 48 38 L 40 44 L 26 44" />

          {/* Receiver, Top Feed Tray & Forward Carry Handle */}
          <path d="M 64 26 L 122 26 L 122 34 L 64 34 Z" />
          <path d="M 86 26 L 90 14 L 108 14 L 112 26" />
          <rect x="92" y="12" width="14" height="4" rx="1" />
          <path d="M 66 38 L 62 52 L 72 53 L 76 38" />
          <path d="M 76 38 L 76 44 L 84 44 L 84 38" />

          {/* 100-Round Ammunition Box Magazine with Vertical Ribs */}
          <rect x="84" y="38" width="28" height="19" rx="1.5" />
          <line x1="90" y1="38" x2="90" y2="57" />
          <line x1="98" y1="38" x2="98" y2="57" />
          <line x1="106" y1="38" x2="106" y2="57" />

          {/* Perforated Barrel Handguard & Heavy Barrel */}
          <path d="M 122 28 L 164 28 L 164 35 L 122 35 Z" />
          <line x1="126" y1="30" x2="126" y2="33" />
          <line x1="134" y1="30" x2="134" y2="33" />
          <line x1="142" y1="30" x2="142" y2="33" />
          <line x1="150" y1="30" x2="150" y2="33" />
          <line x1="158" y1="30" x2="158" y2="33" />
          <line x1="164" y1="30" x2="192" y2="30" />
          <line x1="164" y1="33" x2="192" y2="33" />
          <path d="M 184 30 L 187 22 L 190 30" />
          <rect x="192" y="29" width="6" height="5" />

          {/* Deployed Bipod Legs & Cross-Brace */}
          <path d="M 172 35 L 168 58 L 163 58" />
          <path d="M 174 35 L 178 58 L 183 58" />
          <line x1="169" y1="48" x2="177" y2="48" />
        </svg>
      );

    case 'br':
      // 7. F2000 BATTLE RIFLE (HALO BATTLE RIFLE SPEC)
      // Exactly matches the Halo Battle Rifle silhouette: integrated top optical carrying-handle scope,
      // sweeping thumbhole backstock, bullpup magazine seated behind the pistol grip, and signature chevron flank lines.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Integrated Top Optical Carrying-Handle Bridge & Scope */}
          <path d="M 66 25 L 74 16 L 126 16 L 136 25" />
          <rect x="78" y="11" width="48" height="6" rx="1" />
          <path d="M 74 11 L 78 12 L 78 16 L 74 17 Z" />
          <path d="M 126 12 L 132 10 L 132 18 L 126 16 Z" />
          <rect x="98" y="8" width="8" height="3" rx="0.5" />

          {/* Bullpup Backstock & Sweeping Thumbhole Cutout */}
          <path d="M 26 25 L 30 25 L 30 47 L 26 47 Z" />
          <line x1="30" y1="25" x2="66" y2="25" />
          <path d="M 42 28 Q 60 28 60 35 Q 60 42 42 42 Q 36 35 42 28 Z" />

          {/* Bullpup Magazine seated BEHIND the pistol grip */}
          <path d="M 46 42 L 44 56 Q 50 58 56 56 L 58 42" />
          <line x1="45" y1="47" x2="57" y2="47" />
          <line x1="45" y1="51" x2="56" y2="51" />

          {/* Futuristic Aerodynamic Chassis & Flank Chevron Panel Lines */}
          <path d="M 66 25 L 146 25 L 146 37 L 122 37 L 106 37 L 96 37 L 96 44 L 86 44 L 86 54 L 76 54 L 66 42 Z" />
          <path d="M 72 32 L 82 34 L 92 32 L 102 34 L 112 32 L 122 34 L 132 32" />

          {/* Ergonomic Pistol Grip & Trigger */}
          <path d="M 74 37 L 76 54 L 86 54 L 86 37" />
          <path d="M 86 37 L 86 44 L 96 44 L 96 37" />
          <path d="M 90 38 Q 93 41 91 42" />
          <line x1="96" y1="37" x2="146" y2="37" />

          {/* Barrel & Muzzle Compensator */}
          <line x1="146" y1="30.5" x2="188" y2="30.5" />
          <line x1="146" y1="32.5" x2="188" y2="32.5" />
          <rect x="188" y="29" width="10" height="5" rx="0.5" />
          <line x1="191" y1="29" x2="191" y2="34" />
          <line x1="195" y1="29" x2="195" y2="34" />
        </svg>
      );

    case 'laser':
      // 8. PLASMA BEAM RIFLE (DIRECTED ENERGY)
      // Condensed, organic curved alien plasma framework (Halo Reach / Covenant focus rifle style),
      // sweeping top dorsal cowling, cooling louvers, lower structural loop, alien optics dome.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Dorsal Curving Alien Cowling & Sight Dome */}
          <path d="M 42 28 C 56 18, 92 16, 126 20 L 146 25 L 176 28" />
          <path d="M 94 20 Q 108 14 122 20 Z" />
          <circle cx="108" cy="18" r="1.5" />

          {/* Organic Cooling Louvers / Vents */}
          <line x1="94" y1="24" x2="132" y2="24" />
          <line x1="96" y1="27" x2="130" y2="27" />
          <line x1="98" y1="30" x2="128" y2="30" />

          {/* Aerodynamic Snout & Needle Focus Emitter */}
          <path d="M 146 25 L 176 28 L 186 31 L 176 34 L 146 37" />
          <line x1="186" y1="30.5" x2="198" y2="31" />
          <line x1="186" y1="31.5" x2="198" y2="31" />

          {/* Rear Cowled Stock & Lower Structural Loop */}
          <path d="M 42 28 C 34 34, 34 44, 42 48 L 66 48" />
          <path d="M 50 46 L 80 46 L 92 36" />
          <path d="M 54 42 L 76 42 L 84 36 Z" />

          {/* Integrated Alien Grip & Energy Core */}
          <path d="M 92 36 L 88 52 L 98 52 L 102 36" />
          <ellipse cx="96" cy="34" rx="4" ry="4" />
        </svg>
      );

    case 'minigun':
      // 9. VULCAN ROTARY CANNON (SPECIAL HEAVY)
      // Top chainsaw carry handle, rear spade grip, drive motor housing,
      // 6 rotating parallel barrels with circular clamping spacer collars.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Rear Butterfly Spade Grip */}
          <line x1="32" y1="20" x2="32" y2="46" />
          <line x1="32" y1="23" x2="42" y2="28" />
          <line x1="32" y1="43" x2="42" y2="38" />

          {/* Top Chainsaw Handle */}
          <path d="M 54 26 L 54 16 L 88 16 L 92 26" />
          <rect x="58" y="14" width="26" height="4" rx="1" />

          {/* Drive Motor Cylinder & Delinker Feed Chute */}
          <rect x="44" y="26" width="46" height="18" rx="2" />
          <ellipse cx="64" cy="35" rx="7" ry="5" />
          <rect x="74" y="38" width="14" height="9" rx="1" />

          {/* 6-Barrel Cluster Array */}
          <line x1="90" y1="28" x2="188" y2="28" />
          <line x1="90" y1="31" x2="188" y2="31" />
          <line x1="90" y1="34" x2="188" y2="34" />
          <line x1="90" y1="37" x2="188" y2="37" />
          <line x1="90" y1="40" x2="188" y2="40" />
          <line x1="90" y1="43" x2="188" y2="43" />

          {/* Barrel Clamping Collars */}
          <rect x="90" y="26" width="6" height="19" rx="0.5" />
          <rect x="136" y="26" width="6" height="19" rx="0.5" />
          <rect x="182" y="26" width="6" height="19" rx="0.5" />
        </svg>
      );

    case 'railgun':
      // 10. KINETIC AP RAILGUN (ELECTROMAGNETIC)
      // Stock with 3 distinct capacitor bank cells [000], heavy pistol grip,
      // top & bottom parallel accelerator rails, segmented induction coil stator ladder.
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* Heavy Capacitor Stock with 3 Distinct Cells [000] */}
          <path d="M 28 24 L 78 24 L 78 38 L 68 46 L 56 46 L 60 38 L 28 38 Z" />
          <rect x="34" y="27" width="8" height="8" rx="1" />
          <rect x="46" y="27" width="8" height="8" rx="1" />
          <rect x="58" y="27" width="8" height="8" rx="1" />

          {/* Grip & Trigger Assembly */}
          <path d="M 60 38 L 56 52 L 66 53 L 70 38" />

          {/* Top Optics Rail with Teeth */}
          <line x1="82" y1="20" x2="190" y2="20" />
          <line x1="90" y1="18" x2="90" y2="20" />
          <line x1="110" y1="18" x2="110" y2="20" />
          <line x1="130" y1="18" x2="130" y2="20" />
          <line x1="150" y1="18" x2="150" y2="20" />
          <line x1="170" y1="18" x2="170" y2="20" />

          {/* Top & Bottom Heavy Structural Rails */}
          <rect x="78" y="22" width="114" height="4" />
          <rect x="78" y="36" width="114" height="4" />

          {/* Segmented Induction Accelerator Coils (Ladder Array) */}
          <rect x="84" y="26" width="6" height="10" />
          <rect x="94" y="26" width="6" height="10" />
          <rect x="104" y="26" width="6" height="10" />
          <rect x="114" y="26" width="6" height="10" />
          <rect x="124" y="26" width="6" height="10" />
          <rect x="134" y="26" width="6" height="10" />
          <rect x="144" y="26" width="6" height="10" />
          <rect x="154" y="26" width="6" height="10" />
          <rect x="164" y="26" width="6" height="10" />
          <rect x="174" y="26" width="6" height="10" />

          {/* Heavy Muzzle Crown Stabilizer Bracket */}
          <path d="M 188 20 L 196 23 L 196 39 L 188 42 Z" />
        </svg>
      );

    case 'grenade':
    default:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {/* M67 Fragmentation Grenade */}
          <circle cx="110" cy="38" r="14" />
          <line x1="96" y1="38" x2="124" y2="38" strokeWidth={1} />
          <line x1="110" y1="24" x2="110" y2="52" strokeWidth={1} />
          <rect x="105" y="19" width="10" height="6" />
          <path d="M 115 21 C 124 21, 126 30, 125 40" strokeWidth={1.5} />
          <circle cx="101" cy="21" r="3.5" />
        </svg>
      );
  }
};

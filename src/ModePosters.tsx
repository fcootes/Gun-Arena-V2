import React, { memo, useId } from "react";
import { GameMode, WorldMapId } from "./types";
import type { FactionType } from "./lobbyAvatar";

const MODES = [
  {
    id: "zombie",
    title: "HORDE SURVIVAL",
    tag: "ENDLESS / CONTAINMENT",
    color: "#e87554",
    badge: "M8 6h16l5 9-6 8v7H9v-7l-6-8 5-9Zm2 7v5h5v-5h-5Zm9 0v5h5v-5h-5Z",
  },
  {
    id: "ffa",
    title: "FREE FOR ALL",
    tag: "SOLO / NO ALLIES",
    color: "#efc56b",
    badge: "M16 2 30 28H2L16 2Zm0 8-8 14h16l-8-14Z",
  },
  {
    id: "extraction",
    title: "EXTRACTION",
    tag: "OBJECTIVE / EXFIL",
    color: "#7be7ee",
    badge: "M2 13h28v6H2v-6Zm11-11h6v28h-6V2ZM6 25l10 7 10-7",
  },
  {
    id: "team",
    title: "TEAM DEATHMATCH",
    tag: "FIRETEAM / COALITION",
    color: "#a5c6b1",
    badge: "M2 8 10 2l6 6 6-6 8 6v14l-14 10L2 22V8Zm6 4v8l8 6 8-6v-8l-8 6-8-6Z",
  },
] as const;

export function modeSceneDescription(
  mode: GameMode,
  map: WorldMapId,
  faction: FactionType,
) {
  const apex = faction === "apex",
    storm = map === "shattered_wall";
  if (mode === "team")
    return `${apex ? "APEX spearhead" : "USMC fireteam"}: desert-camo marines clash with red-and-grey mercenaries across ${storm ? "a storm-lashed offshore deck" : map === "hangar" ? "the Area 51 staging bay" : "an urban training arena"}.`;
  if (mode === "ffa")
    return `${apex ? "APEX" : "USMC"} solo operatives caught in a 360-degree urban crossfire. ${storm ? "Rain sweeps the coastal industrial blocks." : map === "hangar" ? "Alarm lights wash the underground combat district." : "Dust and ricochets fill the streets."}`;
  if (mode === "zombie")
    return apex
      ? `APEX energy gunners and plasma shields hold back the infected ${storm ? "on a rain-soaked helipad" : "inside the containment facility"}.`
      : `USMC marines make a desperate last stand against a dark infected swarm ${storm ? "on the stormy offshore deck" : "at the bunker barricade"}.`;
  if (storm)
    return apex
      ? "APEX mercenaries execute a tactical helicopter extraction, firing heavy energy weapons from the side door into the storm."
      : "USMC marines board the extraction helicopter while firing back at pursuing infected in the Pacific storm.";
  return apex
    ? "APEX operatives hack and destroy the central data mainframe amid sparks and subterranean alarm lights."
    : "USMC squad secures the glowing blue antidote vial for extraction under intense facility alarm lights.";
}

/** Profile silhouettes use real equipment layers rather than generic stick figures. */
function Operative({
  x,
  y,
  scale = 1,
  faction,
  facing = 1,
  firing = false,
  heavy = false,
  kneeling = false,
  glow,
}: {
  x: number;
  y: number;
  scale?: number;
  faction: FactionType;
  facing?: 1 | -1;
  firing?: boolean;
  heavy?: boolean;
  kneeling?: boolean;
  glow: string;
}) {
  const apex = faction === "apex",
    armor = apex ? "#525763" : "#b8a582",
    trim = apex ? "#db4b53" : "#635e49";
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale * facing} ${scale})`}
      data-operative={faction}
    >
      <path
        d={
          kneeling
            ? "M-8 76-27 117 5 122 11 109-15 106 13 80M14 76 43 101 40 124 56 127 60 98 31 71"
            : "M-13 73-18 132-25 147H-2L7 88 20 128 21 146h24l-9-17-9-58"
        }
        fill={armor}
        stroke="#111a22"
        strokeWidth="5"
      />
      <path d="m-12 99 13 2m22 10 15-2" stroke={trim} strokeWidth="12" />
      <path
        d="M-26 14-20 4 8 3l16 18-1 48-11 16-34-8-10-28Z"
        fill={armor}
        stroke="#162028"
        strokeWidth="4"
      />
      <path
        d="m-23 24 28-6 15 11-4 32-36 6Z"
        fill={trim}
        stroke="#d4d8d7"
        strokeOpacity=".35"
        strokeWidth="2"
      />
      {apex ? (
        <>
          <path d="m-17 30 17-4 14 6-3 17-25 4Z" fill="#932f42" />
          <path d="M-13 35 7 32m-18 10 16-3" stroke="#ff7e80" strokeWidth="2" />
          <path
            d="m-29 14-13 10 13 21 10-9M15 15l21 9-4 18-16-6"
            fill="#702e3d"
            stroke="#f47b80"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path
            d="m-24 18 9 6-2 10 12 4-3 11-18 1m30-29 9 9-8 9 8 12-5 6"
            fill="#504f3d"
          />
          <path
            d="M-15 52h9v15h-9Zm12-2h9v15h-9Zm12-2h9v15H9Z"
            fill="#ab9977"
            stroke="#463f32"
          />
          <path d="M-25 9 12 66" stroke="#696c54" strokeWidth="5" />
        </>
      )}
      <path
        d="M-13 4-11-17 12-19l10 13-8 14Z"
        fill={apex ? "#303a44" : "#9d8062"}
        stroke="#131a21"
        strokeWidth="3"
      />
      <path
        d="M-19-15-15-32 6-38l20 12 2 16-17 5-21-1Z"
        fill={armor}
        stroke="#15222b"
        strokeWidth="4"
      />
      <path
        d="m-12-29 8 4 2-9 10 5 9 1"
        fill="none"
        stroke={trim}
        strokeWidth="6"
      />
      <path
        d="M8-22 29-19 26-12 9-11Z"
        fill={apex ? "#fb686e" : "#172b36"}
        stroke={apex ? "#ffbfc4" : "#99c6cc"}
        strokeWidth="1.5"
      />
      <path d="M-20-21h8v15h-8Z" fill="#29333b" />
      <path d="m-14-8 29 7 6-3" stroke="#172029" fill="none" strokeWidth="3" />
      <path
        d="m-22 21-11 22 36 16 13-12-26-12 6-8M17 22l15 22 31 1 1 11-38 4-21-24"
        fill="none"
        stroke={armor}
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <path d="m-3 52 16-6m45 3 9 2" stroke="#283039" strokeWidth="13" />
      <g transform="translate(12 43) rotate(-7)">
        <path
          d={
            heavy
              ? "M-23-5-9-13 42-13 52-6 92-6v13H47L36 15-9 8-23 2Z"
              : "M-24-5-4-11 31-10 42-5 86-5v9H35l-4 6-22-1-15-5-18 4Z"
          }
          fill="#17232e"
          stroke="#8e9b9e"
          strokeWidth="2"
        />
        <path
          d="m14 7 12 3-7 26-13-4Z"
          fill={heavy ? "#313e4e" : "#222e37"}
          stroke="#9caaad"
        />
        <path d="M0-14h39m-33-5h12v5H6Z" stroke="#b3bfc0" strokeWidth="2" />
        <path
          d="M45-7v13m9-13v13m9-13v13m9-13v13"
          stroke={apex && heavy ? "#83f7ff" : "#65757d"}
          strokeWidth="2"
        />
        {heavy && apex && (
          <path
            d="M6-8h30v6H6Zm38-1h39v4H44Z"
            fill="#83f7ff"
            filter={`url(#${glow})`}
          />
        )}
        {firing && (
          <g data-effect={heavy && apex ? "plasma-burst" : "muzzle-flash"}>
            <path
              d="m89 0 13-6 7-13 6 14 26 5-27 5-9 15-4-15Z"
              fill={heavy && apex ? "#7befff" : "#ffdba3"}
              filter={`url(#${glow})`}
            />
            <path
              d="m95 0 65-7m-57 12 51 6"
              stroke={heavy && apex ? "#7befff" : "#f4bd73"}
              strokeWidth="2"
              opacity=".8"
            />
          </g>
        )}
      </g>
    </g>
  );
}

function Infected({
  x,
  y,
  scale = 1,
  facing = 1,
}: {
  x: number;
  y: number;
  scale?: number;
  facing?: 1 | -1;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale * facing} ${scale})`}
      data-infected="true"
      stroke="#122019"
      strokeWidth="3"
    >
      <path
        d="M-13 45-29 100h14L2 63l14 26 19 14 5-10L24 75 15 40Z"
        fill="#253c36"
      />
      <path d="m-15 3 29 2 11 36-15 12-28-6-8-25Z" fill="#364239" />
      <path
        d="m-16 9-24 20 18 7 39-15m-8-7 18 5 32-3"
        fill="none"
        stroke="#5b6853"
        strokeWidth="9"
      />
      <path d="m-8-2-5-19 11-11 13 8 3 22-9 8Z" fill="#6a7160" />
      <path d="M-5-17h5m4 1h5" stroke="#fb6260" strokeWidth="3" />
      <path d="m-1-6 9 2" stroke="#131917" strokeWidth="4" />
    </g>
  );
}

function Helicopter({ glow, apex }: { glow: string; apex: boolean }) {
  return (
    <g
      transform="translate(28 194) rotate(-7)"
      data-scene-object="extraction-helicopter"
    >
      <path
        d="m53 53 61-34 110 3 53 25-6 55-55 20-117-15-60-24Z"
        fill="#293943"
        stroke="#80949d"
        strokeWidth="3"
      />
      <path
        d="m206 32 45 14 9 25-52-4Z"
        fill="#477781"
        stroke="#a4cbd2"
        strokeWidth="2"
      />
      <path
        d="m56 53-29-34-23 4 14 52 40 3m-38-36 30 6"
        fill="#263740"
        stroke="#89999e"
        strokeWidth="2"
      />
      <path
        d="M104 40h94v65h-94Z"
        fill="#06141c"
        stroke="#9aa9ae"
        strokeWidth="3"
      />
      <path d="M108 44h20v57h-20Z" fill="#35464e" />
      <path d="M162 17V0M24 0h307M130-7h64" stroke="#8c9ea5" strokeWidth="5" />
      <ellipse cx="177" cy="0" rx="159" ry="7" fill="#a4c0c9" opacity=".16" />
      <path
        d="m87 105-7 19m132-16 4 16M54 125h195"
        stroke="#a6b2b5"
        strokeWidth="4"
      />
      <path
        d="M184 112 183 172"
        stroke="#a8b8b9"
        strokeWidth="3"
        strokeDasharray="5 3"
      />
      <circle
        cx="92"
        cy="84"
        r="3"
        fill={apex ? "#ff737b" : "#7edfff"}
        filter={`url(#${glow})`}
      />
      <path d="m247 103 46 122-131-5 47-114" fill="#a4e4e9" opacity=".07" />
    </g>
  );
}

function Theater({
  map,
  urban,
  id,
}: {
  map: WorldMapId;
  urban: boolean;
  id: string;
}) {
  const storm = map === "shattered_wall";
  return (
    <g data-theater={map}>
      <rect width="400" height="600" fill={`url(#${id}-sky)`} />
      {storm ? (
        <>
          <path
            d="M0 109q61-69 152-22 62-52 151-11 62-29 97-4v76H0Z"
            fill="#243948"
            opacity=".65"
          />
          <path
            d="m273 18-37 57 24-5-28 58"
            fill="none"
            stroke="#b4e5f1"
            strokeWidth="3"
            opacity=".6"
          />
          <path d="M0 328q50-28 94-2t106-4 112 5 88-4v95H0Z" fill="#122a38" />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M-20 ${344 + i * 17}q70-25 130 0t140 0 160 0`}
              stroke="#729aa5"
              strokeOpacity=".25"
              fill="none"
            />
          ))}
          <path
            d="M-40 430 135 323h191l114 127v150H0Z"
            fill="#1b2b34"
            stroke="#647c85"
            strokeWidth="2"
          />
          <path
            d="M11 380h388M72 327v90m276-92v100"
            stroke="#66797b"
            strokeWidth="5"
          />
          <path
            d="M66 155v199m0-199 138 48m-138 11 90 16M204 203v115"
            stroke="#283d48"
            strokeWidth="9"
          />
          <path
            d="M-10 483 400 409M0 532 400 450"
            stroke="#c7ad68"
            strokeWidth="3"
            opacity=".5"
          />
        </>
      ) : map === "hangar" ? (
        <>
          <path
            d="M0 60 95 151h210l95-91v369H0Z"
            fill="#15222c"
            stroke="#46575d"
            strokeWidth="3"
          />
          <path
            d="M0 60 96 151v186L0 455m400-395-96 91v186l96 118M96 151v186h208V151"
            fill="none"
            stroke="#66777c"
            strokeWidth="7"
          />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} opacity={0.9 - i * 0.15}>
              <path
                d={`M${i * 23} ${90 + i * 24}h${400 - i * 46}`}
                stroke="#35464e"
                strokeWidth="10"
              />
              <path
                d={`M${i * 23 + 8} ${97 + i * 24}h${90 - i * 12}`}
                stroke="#db594c"
                strokeWidth="3"
              />
            </g>
          ))}
          <path
            d="M115 178h172v151H115Z"
            fill="#08141d"
            stroke="#4d6672"
            strokeWidth="3"
          />
          <path d="M122 180v135m157-135v135" stroke="#67a5b3" strokeWidth="2" />
          <path d="M0 421 98 337h205l97 84v179H0Z" fill="#1a2830" />
          <path
            d="M0 469 131 337m269 132L269 337M0 512h400"
            stroke="#627373"
            strokeOpacity=".35"
            strokeWidth="3"
          />
          <path d="M12 180v93m377-93v93" stroke="#e75955" strokeWidth="7" />
        </>
      ) : (
        <>
          <circle cx="282" cy="102" r="77" fill="#d3af6a" opacity=".13" />
          <path
            d="M0 318 43 278l57 31 100-52 87 62 68-39 45 25v151H0Z"
            fill="#243c3e"
          />
          <path d="M0 441 82 362h251l67 82v156H0Z" fill="#2d3532" />
          <path
            d="M0 400h400m-320-67v111m246-111v111"
            stroke="#5e6b60"
            strokeWidth="4"
          />
        </>
      )}
      {urban && (
        <g data-scene-object="urban-cover">
          {[
            { x: -15, h: 213 },
            { x: 58, h: 153 },
            { x: 286, h: 201 },
            { x: 353, h: 257 },
          ].map((b, i) => (
            <g key={b.x}>
              <path
                d={`M${b.x} 358v-${b.h}h61v${b.h}Z`}
                fill={i % 2 ? "#35434a" : "#202f39"}
                stroke="#5b6e73"
                strokeWidth="2"
              />
              {Array.from({ length: 4 }, (_, row) => (
                <path
                  key={row}
                  d={`M${b.x + 12} ${370 - b.h + row * 28}h12m8 0h12`}
                  stroke={map === "hangar" ? "#e88a73" : "#99afb0"}
                  strokeWidth="8"
                  opacity=".4"
                />
              ))}
            </g>
          ))}
          <path
            d="M10 397 32 363h93l21 34-8 24H3Z"
            fill="#3c4b50"
            stroke="#a0a29a"
            strokeWidth="2"
          />
          <path d="m36 368-12 24h86l-9-24Z" fill="#12232c" />
          <path
            d="M286 407v-68h101v68"
            fill="#39454a"
            stroke="#78837e"
            strokeWidth="2"
          />
        </g>
      )}
    </g>
  );
}

const SceneArtwork = memo(function SceneArtwork({
  mode,
  map,
  faction,
}: {
  mode: GameMode;
  map: WorldMapId;
  faction: FactionType;
}) {
  const id = `scene-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`,
    glow = `${id}-glow`;
  const apex = faction === "apex",
    storm = map === "shattered_wall",
    color = apex ? "#ee6e7a" : "#98dae2";
  const unit = (
    x: number,
    y: number,
    scale: number,
    facing: 1 | -1 = 1,
    firing = true,
    heavy = apex,
    kneeling = false,
  ) => (
    <Operative
      x={x}
      y={y}
      scale={scale}
      faction={faction}
      facing={facing}
      firing={firing}
      heavy={heavy}
      kneeling={kneeling}
      glow={glow}
    />
  );
  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={modeSceneDescription(mode, map, faction)}
      className="mode-scene-art absolute inset-0 w-full h-full"
      data-scene={`${mode}-${map}-${faction}`}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1">
          <stop
            stopColor={
              storm ? "#12273e" : map === "hangar" ? "#321f2d" : "#4d5042"
            }
          />
          <stop offset=".55" stopColor="#1b303d" />
          <stop offset="1" stopColor="#050c13" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x2="0" y2="1">
          <stop stopColor="#020811" stopOpacity=".35" />
          <stop offset=".22" stopColor="#020811" stopOpacity="0" />
          <stop offset=".65" stopColor="#020811" stopOpacity=".1" />
          <stop offset=".82" stopColor="#020811" stopOpacity=".92" />
          <stop offset="1" stopColor="#020811" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor={color} stopOpacity=".36" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <filter
          id={glow}
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="3" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Theater map={map} urban={mode === "ffa"} id={id} />
      <ellipse cx="205" cy="293" rx="206" ry="155" fill={`url(#${id}-halo)`} />
      {mode === "team" ? (
        <g data-scene-object="faction-confrontation">
          <path
            d="M200 93 177 228l33 64-25 129"
            stroke="#e9e9c8"
            strokeOpacity=".2"
            strokeWidth="3"
            fill="none"
          />
          <Operative
            x={65}
            y={233}
            scale={1.1}
            faction="usmc"
            firing
            glow={glow}
          />
          <Operative
            x={337}
            y={226}
            scale={1.1}
            faction="apex"
            facing={-1}
            firing
            heavy
            glow={glow}
          />
          <Operative
            x={29}
            y={331}
            scale={1.18}
            faction="usmc"
            firing
            kneeling
            glow={glow}
          />
          <Operative
            x={371}
            y={335}
            scale={1.18}
            faction="apex"
            facing={-1}
            firing
            heavy
            kneeling
            glow={glow}
          />
          <path
            d="m94 296 183-16M300 302 89 319m37 15 153 11"
            stroke="#f9d796"
            strokeWidth="2"
            opacity=".8"
          />
          <path
            d="M10 418v-21l73-13 26 33m291 1v-28l-64-9-31 31"
            fill="#24363c"
            stroke="#586d74"
            strokeWidth="3"
          />
          <path
            d={apex ? "M228 173h125" : "M44 173h127"}
            stroke={color}
            strokeWidth="4"
          />
          <text x="42" y="165" fill="#c5b58e" fontSize="13" letterSpacing="3">
            USMC
          </text>
          <text x="284" y="165" fill="#f2868d" fontSize="13" letterSpacing="3">
            APEX
          </text>
        </g>
      ) : mode === "ffa" ? (
        <g data-scene-object="360-crossfire">
          {unit(88, 229, 0.78, 1)}
          {unit(331, 258, 0.88, -1)}
          {unit(81, 359, 1.13, 1, true, apex, true)}
          {unit(284, 370, 1.02, -1, true, apex, true)}
          <path
            d="M-12 211 400 373M8 390 388 272M48 318 278 243M313 166 110 432"
            stroke="#edc882"
            strokeWidth="2"
            strokeDasharray="75 14 12 42"
            opacity=".9"
          />
          <g stroke="#ffdea0" strokeWidth="2" filter={`url(#${glow})`}>
            <path d="m129 342-15-13m15 13 4-26m-4 26 26 6M289 267l16-13m-16 13 24 4" />
          </g>
          <path
            d="M0 442v-40l72-8 38 28 29-9 13 29m248-1v-49l-66-10-48 59"
            fill="#263840"
            stroke="#9d9c84"
            strokeWidth="3"
          />
          <ellipse
            cx="204"
            cy="382"
            rx="58"
            ry="24"
            fill="none"
            stroke="#afc4c0"
            strokeOpacity=".22"
            strokeWidth="2"
            strokeDasharray="6 8"
          />
        </g>
      ) : mode === "zombie" ? (
        <g data-scene-object={apex ? "plasma-last-stand" : "marine-last-stand"}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <g key={i}>
              <Infected
                x={206 + (i % 4) * 53}
                y={230 + Math.floor(i / 4) * 77}
                scale={0.66 + (i % 3) * 0.13}
                facing={-1}
              />
            </g>
          ))}
          {unit(32, 248, 1.07)}
          {unit(101, 365, 1.18, 1, true, apex, true)}
          <path
            d="M0 405h55l10 13h39l14-14h46v54H0Z"
            fill="#314047"
            stroke="#778589"
            strokeWidth="3"
          />
          {apex && (
            <g
              data-scene-object="plasma-shield"
              fill="#6fe7ff"
              fillOpacity=".1"
              stroke="#88edff"
              strokeWidth="2"
            >
              <path d="M176 236q64 41 50 144l-30 27-41-26q31-72 21-145Z" />
              <path
                d="m189 270 15 9 2 18-15 9-16-9v-17Zm4 39 16 10v18l-16 9-15-9v-18Zm1 38 16 9v18l-17 10-15-10v-18Z"
                strokeOpacity=".45"
              />
            </g>
          )}
          <path
            d="M92 315 361 270M181 394l147-19"
            stroke={apex ? "#73edff" : "#f5c683"}
            strokeWidth="2"
          />
        </g>
      ) : storm ? (
        <g data-scene-object={apex ? "apex-storm-exfil" : "usmc-storm-exfil"}>
          <Helicopter glow={glow} apex={apex} />
          {unit(170, 259, 0.48, 1, true, true)}
          {unit(140, 377, 0.98, -1, true, apex, true)}
          {unit(217, 366, 0.72, 1, false)}
          <Infected x={43} y={339} scale={0.95} />
          <Infected x={346} y={374} scale={1.12} facing={-1} />
          <Infected x={390} y={320} scale={0.74} facing={-1} />
          <path
            d="M192 285 395 246m-264 174-128-7"
            stroke={apex ? "#7cecff" : "#ffd88d"}
            strokeWidth="2"
          />
          <ellipse
            cx="200"
            cy="447"
            rx="127"
            ry="29"
            stroke="#e3c888"
            strokeWidth="3"
            strokeDasharray="31 15"
            fill="none"
            opacity=".55"
          />
        </g>
      ) : apex ? (
        <g data-scene-object="mainframe-sabotage">
          <path
            d="M213 196h115l22 188H207Z"
            fill="#273945"
            stroke="#8fadb6"
            strokeWidth="3"
          />
          <path
            d="M228 207h86v63h-86Z"
            fill="#091a24"
            stroke="#f08383"
            strokeWidth="3"
          />
          <path
            d="M237 223h43m-43 10h66m-66 10h24m9 0h20m-53 12h60"
            stroke="#8ddbe3"
            strokeWidth="3"
          />
          <path d="M219 284h109l-6 21H216Z" fill="#5f6a70" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <path
                d={`M226 ${317 + i * 15}h91`}
                stroke="#81939a"
                strokeWidth="5"
              />
              <circle cx="306" cy={317 + i * 15} r="2" fill="#f37473" />
            </g>
          ))}
          {unit(130, 321, 0.95, 1, false)}
          {unit(30, 257, 0.81, -1, true)}
          <path
            d="M183 361 226 291"
            stroke="#82e7ed"
            strokeWidth="3"
            fill="none"
          />
          <circle
            cx="226"
            cy="291"
            r="6"
            fill="#92f5ff"
            filter={`url(#${glow})`}
          />
          <g
            data-scene-object="hacking-tablet"
            transform="translate(160 357) rotate(-12)"
          >
            <path
              d="M0 0h39v24H0Z"
              fill="#14232d"
              stroke="#95b8c0"
              strokeWidth="2"
            />
            <path d="M5 5h29v14H5Z" fill="#194755" />
            <path
              d="M8 8h14m-14 4h23m-23 4h9"
              stroke="#9deaf0"
              strokeWidth="1.5"
            />
          </g>
          <g stroke="#ffdc9a" strokeWidth="2" filter={`url(#${glow})`}>
            <path d="m294 266 17-38m-17 38 49-8m-49 8 33 27m-33-27-26-31M303 350l42 6m-42-6 9 33" />
          </g>
          <text x="239" y="258" fill="#ff747d" fontSize="8">
            PURGE // 98%
          </text>
        </g>
      ) : (
        <g data-scene-object="antidote-recovery">
          <path
            d="M161 368h113l23 34H143Z"
            fill="#334750"
            stroke="#80a9af"
            strokeWidth="3"
          />
          <ellipse
            cx="213"
            cy="315"
            rx="86"
            ry="99"
            fill={`url(#${id}-halo)`}
          />
          <g data-scene-object="blue-antidote" filter={`url(#${glow})`}>
            <path
              d="M200 268h26v15l8 8v57l-6 10h-31l-7-10v-57l10-8Z"
              fill="#7fe6fa"
              fillOpacity=".14"
              stroke="#a1effb"
              strokeWidth="3"
            />
            <path d="M194 317h36v27l-5 9h-26l-5-9Z" fill="#54c8f8" />
            <path d="M199 269h28v13h-28Z" fill="#c8d9db" />
            <path d="M202 295v18m0 21v8" stroke="#defbff" strokeWidth="3" />
          </g>
          {unit(71, 271, 1.03, -1)}
          {unit(323, 280, 0.98, 1)}
          {unit(173, 209, 0.67, 1, false)}
          <path
            d="M159 401h127m-101 7h55"
            stroke="#72d9f0"
            strokeWidth="2"
            opacity=".5"
          />
        </g>
      )}
      <g className="mode-atmosphere" pointerEvents="none">
        {storm
          ? Array.from({ length: 32 }, (_, i) => (
              <path
                key={i}
                d={`m${((i * 73) % 421) - 10} ${(i * 67) % 458} -12 31`}
                stroke="#b3e5eb"
                strokeWidth="1"
                opacity={0.12 + (i % 4) * 0.06}
              />
            ))
          : Array.from({ length: 18 }, (_, i) => (
              <circle
                key={i}
                cx={(i * 71) % 400}
                cy={175 + ((i * 37) % 250)}
                r={i % 3 === 0 ? 2 : 1}
                fill="#ffd3a6"
                opacity=".4"
              />
            ))}
        <path
          d="M-30 383q122-68 253 5t201-4"
          fill="none"
          stroke="#88a5ac"
          strokeWidth="22"
          strokeOpacity=".07"
        />
      </g>
      <rect width="400" height="600" fill={`url(#${id}-shade)`} />
    </svg>
  );
});

export function ModePosters({
  mode,
  map,
  faction = "usmc",
  onSelect,
}: {
  mode: GameMode;
  map: WorldMapId;
  faction?: FactionType;
  onSelect: (mode: GameMode) => void;
}) {
  const theater =
    map === "shattered_wall"
      ? "SHATTERED WALL"
      : map === "hangar"
        ? "AREA 51 FACILITY"
        : "TRAINING FIELD";
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      aria-label="Game mode poster deck"
    >
      {MODES.map((item, index) => (
        <button
          type="button"
          key={item.id}
          onClick={() => onSelect(item.id)}
          aria-pressed={mode === item.id}
          aria-label={`Select ${item.title}`}
          data-mode-card={item.id}
          className="mode-poster group relative text-left overflow-hidden min-h-[420px] border bg-[#071019] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{
            borderColor: mode === item.id ? item.color : "#ffffff30",
            boxShadow:
              mode === item.id ? `0 0 24px ${item.color}20` : undefined,
          }}
        >
          <SceneArtwork mode={item.id} map={map} faction={faction} />
          <div className="relative z-10 flex flex-col min-h-[420px] justify-between p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[8px] tracking-[.2em] text-white/70">
                  OPERATION / 0{index + 1}
                </div>
                <h3 className="text-xl leading-none mt-2 font-black tracking-tight text-white">
                  {item.title}
                </h3>
                <p
                  className="text-[8px] tracking-widest mt-2"
                  style={{ color: item.color }}
                >
                  {item.tag}
                </p>
              </div>
              <svg
                viewBox="0 0 34 36"
                className="w-9 h-10 shrink-0 text-white drop-shadow-lg"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d={item.badge} fillRule="evenodd" />
              </svg>
            </div>
            <div className="pt-4">
              <div className="flex flex-wrap gap-1 mb-2 text-[7px] tracking-wider">
                <span className="border border-white/25 bg-black/40 px-1.5 py-1 text-white">
                  {faction === "apex" ? "APEX MERCENARIES" : "USMC"}
                </span>
                <span className="border border-white/15 bg-black/40 px-1.5 py-1 text-slate-300">
                  {theater}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                {modeSceneDescription(item.id, map, faction)}
              </p>
              <div
                className="text-[8px] mt-3 tracking-widest font-bold"
                style={{ color: item.color }}
              >
                {mode === item.id
                  ? "SELECTED / READY TO DEPLOY"
                  : "SELECT OPERATION →"}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

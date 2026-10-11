import type * as THREE from 'three';

export interface InitializationStage { name: string; milliseconds: number; }
export const initialization = {
  active: false,
  map: '',
  started: 0,
  stages: [] as InitializationStage[],
  begin(map: string) { this.active = true; this.map = map; this.started = performance.now(); this.stages = []; },
  record(name: string, milliseconds: number) {
    if (!this.active) return;
    const existing = this.stages.find(stage => stage.name === name);
    if (existing) existing.milliseconds += milliseconds;
    else this.stages.push({ name, milliseconds });
  },
  finish() {
    if (!this.active) return;
    this.record('Deployment to first visible frame (inclusive)', performance.now() - this.started);
    this.active = false;
  },
};
/** Nested construction timings are inclusive; never sum them into deployment time. */
export function measureInitialization<T>(name: string, action: () => T): T {
  if (!initialization.active) return action();
  const start = performance.now();
  try { return action(); }
  finally { initialization.record(name, performance.now() - start); }
}

export interface FrameSummary {
  fps: number; averageFps: number; lowFps: number; worstMs: number;
  simulationMs: number; submissionMs: number; aiMs: number; frameTimes: number[];
}
/** Fixed ring; percentile work happens only when the visible overlay refreshes. */
export class FrameSamples {
  private frames: Float64Array;
  private simulations: Float64Array;
  private submissions: Float64Array;
  private ais: Float64Array;
  private count = 0;
  private cursor = 0;
  constructor(size = 600) {
    this.frames = new Float64Array(size); this.simulations = new Float64Array(size);
    this.submissions = new Float64Array(size); this.ais = new Float64Array(size);
  }
  add(frame: number, simulation: number, submission: number, ai: number) {
    if (!Number.isFinite(frame) || frame <= 0) return;
    const i = this.cursor;
    this.frames[i] = frame; this.simulations[i] = simulation;
    this.submissions[i] = submission; this.ais[i] = ai;
    this.cursor = (i + 1) % this.frames.length; this.count = Math.min(this.count + 1, this.frames.length);
  }
  summary(): FrameSummary {
    const values: number[] = [];
    let sum = 0, simulation = 0, submission = 0, ai = 0;
    for (let n = 0; n < this.count; n++) {
      const i = (this.cursor - this.count + n + this.frames.length) % this.frames.length;
      values.push(this.frames[i]); sum += this.frames[i]; simulation += this.simulations[i];
      submission += this.submissions[i]; ai += this.ais[i];
    }
    const sorted = [...values].sort((a, b) => b - a);
    const lowCount = Math.max(1, Math.ceil(this.count * .01));
    const slowMean = sorted.slice(0, lowCount).reduce((a, b) => a + b, 0) / lowCount;
    return { fps: values.length ? 1000 / values[values.length - 1] : 0,
      averageFps: sum ? this.count * 1000 / sum : 0, lowFps: slowMean ? 1000 / slowMean : 0,
      worstMs: sorted[0] ?? 0, simulationMs: simulation / (this.count || 1),
      submissionMs: submission / (this.count || 1), aiMs: ai / (this.count || 1), frameTimes: values };
  }
}

/** Dev-only, imperative overlay: no React state or sampling while hidden. */
export function createPerformanceOverlay(host: HTMLElement, renderer: THREE.WebGLRenderer, available: boolean) {
  let enabled = false, previous = 0, refreshed = 0;
  let samples = new FrameSamples();
  let panel: HTMLDivElement | null = null, text: HTMLPreElement | null = null, canvas: HTMLCanvasElement | null = null;
  const getSummary = () => samples.summary();
  const toggle = (event: KeyboardEvent) => {
    if (event.code !== 'F3' || event.repeat) return;
    event.preventDefault(); enabled = !enabled; previous = refreshed = 0; samples = new FrameSamples();
    if (!panel) {
      panel = document.createElement('div'); panel.dataset.engineProfiler = 'true';
      panel.style.cssText = 'position:absolute;right:12px;top:12px;z-index:200;pointer-events:none;background:#000d;color:#bcefff;padding:12px;max-height:90%;overflow:hidden;font:11px monospace;border:1px solid #5ac8db;';
      text = document.createElement('pre'); text.style.margin = '0'; panel.appendChild(text);
      canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 56; panel.appendChild(canvas);
      host.appendChild(panel);
    }
    panel.hidden = !enabled;
  };
  if (available) window.addEventListener('keydown', toggle);
  const api = {
    get enabled() { return enabled; },
    summary: getSummary,
    reset() { samples = new FrameSamples(); previous = refreshed = 0; },
    frame(start: number, simulation: number, submission: number, ai: number, bots: number) {
      if (!enabled) return;
      if (previous) samples.add(start - previous, simulation, submission, ai);
      previous = start;
      if (start - refreshed < 250 || !text || !canvas) return;
      refreshed = start;
      const s = samples.summary(), info = renderer.info;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      text.textContent = `F3 / ENGINE DIAGNOSTICS\nFPS ${s.fps.toFixed(1)} · avg ${s.averageFps.toFixed(1)} · ~1% low ${s.lowFps.toFixed(1)}\nWorst ${s.worstMs.toFixed(1)} ms · samples ${s.frameTimes.length}/600\nJS simulation ${s.simulationMs.toFixed(2)} ms · AI subset ${s.aiMs.toFixed(2)} ms\nCPU render submission ${s.submissionMs.toFixed(2)} ms\nGPU time: not sampled (CPU time is NOT GPU time)\nDraw calls ${info.render.calls} · triangles ${info.render.triangles}\nGeometries ${info.memory.geometries} · textures ${info.memory.textures} · programs ${info.programs?.length ?? 0} · bots ${bots}\nJS heap ${memory ? (memory.usedJSHeapSize / 1048576).toFixed(1) + ' MiB' : 'unavailable'}\nWebGL memory: counts only, bytes unavailable\nDEPLOY ${initialization.map} (nested timings inclusive)\n${initialization.stages.map(row => `${row.name}: ${row.milliseconds.toFixed(1)} ms`).join('\n')}`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 300, 56); ctx.strokeStyle = '#5ac8db'; ctx.beginPath();
        const frames = s.frameTimes.slice(-150);
        frames.forEach((ms, i) => { const x = i * 2, y = 55 - Math.min(55, ms); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
      }
    },
    dispose() { if (available) window.removeEventListener('keydown', toggle); panel?.remove(); enabled = false; },
  };
  return api;
}

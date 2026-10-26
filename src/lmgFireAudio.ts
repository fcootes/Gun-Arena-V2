/** LMG-only recorded report player. One source per real shot, never a clocked
 * future attack. A later shot replaces the previous tail with a 12 ms fade;
 * releasing the trigger does nothing, so the last report decays naturally.
 * All report buffers are decoded/sliced once during loadout preparation. */
export class LmgFireAudio {
  private context: AudioContext | null = null;
  private loading: Promise<void> | null = null;
  private lead: AudioBuffer | null = null;
  private reports: AudioBuffer[] = [];
  private active: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private retiring: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private generation = 0;
  private pending: { shot: number; volume: number; at: number; generation: number } | null = null;
  private paused = false;

  constructor(private leadUrl: string, private bankUrl: string,
    private makeContext: (() => AudioContext) | undefined = undefined,
    private request: typeof fetch = (input, init) => fetch(input, init)) {}

  prepare(): Promise<void> {
    if (this.loading) return this.loading;
    if (!this.makeContext && typeof AudioContext === 'undefined' && !this.context) return Promise.resolve();
    const context = this.context ??= (this.makeContext ? this.makeContext() : new AudioContext({ sampleRate: 48000 }));
    this.loading = Promise.all([this.leadUrl, this.bankUrl].map(async url => {
      const response = await this.request(url);
      if (!response.ok) throw new Error(`LMG audio: ${response.status}`);
      return context.decodeAudioData(await response.arrayBuffer());
    })).then(([lead, bank]) => {
      if (this.context !== context) return;
      const count = 8, frames = bank.length / count;
      if (!Number.isInteger(frames) || bank.sampleRate !== lead.sampleRate || bank.numberOfChannels !== lead.numberOfChannels)
        throw new Error('Invalid LMG report bank');
      const blend = Math.round(.012 * bank.sampleRate), join = frames - blend;
      this.reports = Array.from({ length: count }, (_, index) => {
        const buffer = context.createBuffer(lead.numberOfChannels, lead.length, lead.sampleRate);
        for (let channel = 0; channel < lead.numberOfChannels; channel++) {
          const data = buffer.getChannelData(channel), tail = lead.getChannelData(channel);
          const report = bank.getChannelData(channel).subarray(index * frames, (index + 1) * frames);
          data.set(tail); data.set(report.subarray(0, join));
          for (let frame = join; frame < frames; frame++) {
            const mix = (frame - join) / (blend - 1);
            data[frame] = report[frame] * (1 - mix) + tail[frame] * mix;
          }
        }
        return buffer;
      });
      this.lead = lead;
      const pending = this.pending; this.pending = null;
      // A late download must not replay a stale shot after pause/switch/death.
      if (pending && pending.generation === this.generation && performance.now() - pending.at < 80)
        this.play(pending.shot, pending.volume);
    }).catch(error => {
      if (this.context === context) { this.loading = null; this.pending = null; }
      console.warn('LMG recordings could not be prepared', error);
    });
    return this.loading;
  }

  play(shot: number, volume = 1): void {
    if (this.paused || volume <= .005) return;
    void this.prepare();
    const context = this.context;
    if (!context) return;
    if (!this.lead) {
      this.pending = { shot, volume, at: performance.now(), generation: this.generation };
      if (context.state === 'suspended') void context.resume().catch(() => {});
      return;
    }
    const now = context.currentTime;
    // At most two voices, even under duplicate/rapid caller events.
    if (this.retiring) {
      this.retiring.source.onended = null; this.retiring.source.stop();
      this.retiring.source.disconnect(); this.retiring.gain.disconnect(); this.retiring = null;
    }
    if (this.active) {
      const previous = this.active;
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
      previous.gain.gain.linearRampToValueAtTime(0, now + .012);
      previous.source.stop(now + .012); this.retiring = previous;
    }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = shot <= 1 ? this.lead : this.reports[(shot - 2) % this.reports.length];
    source.loop = false; source.playbackRate.value = 1;
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
    source.connect(gain); gain.connect(context.destination);
    const voice = { source, gain }; this.active = voice;
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (this.active === voice) this.active = null;
      if (this.retiring === voice) this.retiring = null;
    };
    source.start(now);
    // Queue the complete voice before restarting a suspended audio clock.
    // Running contexts need no asynchronous state command on each round.
    if (context.state === 'suspended') void context.resume().catch(() => {});
  }

  pause(): void {
    this.paused = true; this.pending = null; this.generation++;
    void this.context?.suspend().catch(() => {});
  }
  resume(): void { this.paused = false; void this.context?.resume().catch(() => {}); }
  stop(): void {
    this.pending = null; this.generation++;
    for (const voice of [this.active, this.retiring]) {
      if (!voice) continue;
      voice.source.onended = null; voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect();
    }
    this.active = this.retiring = null;
  }
  release(): void {
    this.stop(); const context = this.context; this.context = null;
    this.loading = null; this.lead = null; this.reports = []; this.paused = false;
    void context?.close().catch(() => {});
  }
}

/** Self-contained mission cues. Existing weapon audio remains in audio.ts. */
export type CampaignCue =
  "evac_inbound" | "spartan_radio" | "rotor" | "blast_doors" | "elevator_hum" | "bulkhead_unseal" | "abomination_impact" | "abomination_roar";
class CampaignAudioManager {
  private context: AudioContext | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  private buffers = new Map<CampaignCue, AudioBuffer>();
  private rotor: { source: AudioBufferSourceNode; gain: GainNode } | null =
    null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private volume = 0.65;
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.rotor && this.context)
      this.rotor.gain.gain.setTargetAtTime(
        this.volume * 0.28,
        this.context.currentTime,
        0.2,
      );
  }
  private getContext(): AudioContext | null {
    if (typeof window === "undefined" || !window.AudioContext) return null;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended")
      void this.context.resume().catch(() => {});
    return this.context;
  }
  prepare(cue: CampaignCue): void {
    if (cue === 'evac_inbound') return;
    const ctx = this.getContext();
    if (ctx) this.getBuffer(ctx, cue);
  }
  private getBuffer(ctx: AudioContext, cue: CampaignCue): AudioBuffer {
    const cached = this.buffers.get(cue);
    if (cached) return cached;
    const duration = cue === "elevator_hum" ? 4.2 : cue === "rotor" ? 2 : cue === "spartan_radio" ? 1.5 : 1.3;
    const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate,
        noise = Math.random() * 2 - 1;
      if (cue === "rotor") {
        const beat = Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 17), 4);
        data[i] =
          (noise * 0.36 + Math.sin(t * Math.PI * 2 * 54) * 0.32) *
          (0.12 + beat * 0.88);
      } else if (cue === "spartan_radio") {
        // Voiced harmonics, irregular syllabic gates, bit-crushing and narrow radio filtering.
        const gate = Math.sin(t * 31) > -0.2 ? 0.5 + 0.5 * Math.sin(t * 11) : 0;
        const voice =
          Math.sin(t * 2 * Math.PI * (97 + 7 * Math.sin(t * 13))) +
          0.4 * Math.sin(t * 2 * Math.PI * 610) +
          0.22 * Math.sin(t * 2 * Math.PI * 1230);
        data[i] = Math.round((voice * 0.3 + noise * 0.12) * gate * 12) / 12;
      } else if (cue === "abomination_roar") {
        const envelope = Math.sin(Math.PI * t / duration);
        data[i] = envelope * (noise * 0.3 + Math.sin(t * 2 * Math.PI * (48 + 15 * t)) * 0.5);
      } else if (cue === "elevator_hum") {
        const envelope = Math.min(1, t / 0.3, (duration - t) / 0.4);
        data[i] = envelope * (Math.sin(t * 2 * Math.PI * 63) * 0.25 + noise * 0.14);
      } else
        data[i] =
          noise * (1 - t / duration) * 0.45 +
          Math.sin(t * 2 * Math.PI * 63) * 0.22;
    }
    this.buffers.set(cue, buffer);
    return buffer;
  }
  play(cue: CampaignCue): void {
    if (cue === "evac_inbound") {
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        this.volume > 0
      ) {
        const speech = new SpeechSynthesisUtterance(
          "Pickup has arrived, let's get the hell out of here!",
        );
        speech.rate = 1.08;
        speech.pitch = 0.78;
        speech.volume = this.volume;
        this.utterance = speech;
        window.speechSynthesis.speak(speech);
      }
      return;
    }
    const ctx = this.getContext();
    if (!ctx || this.volume === 0) return;
    if (cue === "rotor" && this.rotor) return;
    const buffer = this.getBuffer(ctx, cue);
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    source.buffer = buffer;
    filter.type = cue === "spartan_radio" ? "bandpass" : "lowpass";
    filter.frequency.value =
      cue === "spartan_radio" ? 1100 : cue === "rotor" ? 550 : 280;
    filter.Q.value = cue === "spartan_radio" ? 1.2 : 0.7;
    gain.gain.value = this.volume * (cue === "rotor" ? 0.28 : 0.3);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    if (cue === "rotor") {
      source.loop = true;
      this.rotor = { source, gain };
    }
    source.start();
  }
  stop(): void {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {}
    }
    this.active.clear();
    this.rotor = null;
    if (this.utterance && typeof window !== "undefined") {
      window.speechSynthesis.cancel();
      this.utterance = null;
    }
  }
  dispose(): void {
    this.stop();
    if (this.context) void this.context.close();
    this.context = null;
    this.buffers.clear();
  }
}
export const audioManager = new CampaignAudioManager();

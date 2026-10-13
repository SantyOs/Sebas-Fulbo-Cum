import type { BirthdayProfile, PlayerCustomization } from "./profile";
/** Presentation-only audio, unlocked by a user gesture and stopped on pause/exit. */
export class BirthdayAudio {
  private context?: AudioContext;
  private nodes = new Set<AudioScheduledSourceNode>();
  private generation = 0;
  async unlock() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
  }
  stop() {
    this.callUntil = 0;
    this.generation++;
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        /* Already finished. */
      }
      node.disconnect();
    }
    this.nodes.clear();
  }
  async play(sound: string, volume: number, profile: BirthdayProfile) {
    this.stop();
    if (sound === "none" || volume <= 0 || profile.volume <= 0) return;
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return;
    const token = this.generation,
      level = Math.min(1, volume * profile.volume) * 0.28;
    const schedule = (
      source: AudioScheduledSourceNode,
      gain: GainNode,
      start: number,
      end: number,
    ) => {
      source.connect(gain);
      gain.connect(ctx.destination);
      this.nodes.add(source);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.nodes.delete(source);
      };
      source.start(start);
      source.stop(end);
    };
    if (profile.sounds[sound]) {
      try {
        const data = profile.sounds[sound].data.split(",")[1],
          bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const decoded = await ctx.decodeAudioData(bytes.buffer);
        if (token !== this.generation) return;
        const source = ctx.createBufferSource(),
          gain = ctx.createGain();
        source.buffer = decoded;
        gain.gain.value = level;
        schedule(
          source,
          gain,
          ctx.currentTime,
          ctx.currentTime + Math.min(8, decoded.duration),
        );
      } catch {
        /* A bad custom clip never interrupts a match. */
      }
      return;
    }
    const start = ctx.currentTime;
    if (sound !== "stadium") {
      // Original short fanfares; no external recordings or paid assets.
      const notes =
        sound === "party"
          ? [60, 64, 67, 72, 67, 72, 76, 79]
          : [60, 67, 72, 76, 72];
      notes.forEach((note, i) => {
        const source = ctx.createOscillator(),
          gain = ctx.createGain(),
          time = start + i * 0.18;
        source.type = "triangle";
        source.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(level, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        schedule(source, gain, time, time + 0.42);
      });
    }
    // A filtered noise swell suggests the stands cheering without audio downloads.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 1300;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(level * 0.65, start + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 2);
    this.nodes.add(noise);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.nodes.delete(noise);
    };
    noise.start();
    noise.stop(start + 2);
  }
  private call?: Promise<AudioBuffer>;
  private callUntil = 0;
  /** Bundled phone ring: a short ring on receiving, a long loud one on a goal. */
  async playCall(goal: boolean, profile: BirthdayProfile) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || profile.volume <= 0) return;
    if (!goal && ctx.currentTime < this.callUntil) return;
    const token = this.generation;
    this.call ??= fetch(`${import.meta.env.BASE_URL}assets/audio/llamada.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b));
    let buffer: AudioBuffer;
    try {
      buffer = await this.call;
    } catch {
      this.call = undefined;
      return;
    }
    if (token !== this.generation) return;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      start = ctx.currentTime,
      length = goal ? 12 : Math.min(buffer.duration, 3);
    source.buffer = buffer;
    source.loop = goal;
    gain.gain.setValueAtTime(profile.volume * (goal ? 2.4 : 0.6), start);
    gain.gain.setValueAtTime(profile.volume * (goal ? 2.4 : 0.6), start + length - 0.25);
    gain.gain.linearRampToValueAtTime(0, start + length);
    source.connect(gain);
    gain.connect(ctx.destination);
    this.nodes.add(source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.nodes.delete(source);
    };
    this.callUntil = start + length;
    source.start(start);
    source.stop(start + length);
  }
  async preview(custom: PlayerCustomization, profile: BirthdayProfile) {
    await this.unlock();
    await this.play(
      custom.celebration.sound,
      custom.celebration.volume,
      profile,
    );
  }
}
export const birthdayAudio = new BirthdayAudio();

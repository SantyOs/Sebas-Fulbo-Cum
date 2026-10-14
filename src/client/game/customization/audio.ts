import type { BirthdayProfile, PlayerCustomization } from "./profile";
/** Bundled clips in public/assets/audio (see its README for sources). */
export const GOAL_CLIPS = [
  "goal-victory",
  "goal-happy-wheels",
  "goal-fortnite",
  "goal-pvz",
  "goal-jojo",
  "goal-victory-wav",
] as const;
/** Reserved for the gamepad free goal and its backflip. */
export const FREE_GOAL_CLIP = "goal-kirby";
export const WIN_CLIPS = ["win-perfect-victory", "win-grefg"] as const;
/** Soft clipping curve; `drive` 1 is near-linear, higher crushes the peaks. */
export function saturationCurve(drive: number, size = 1024) {
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}
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
  /** Cheesy square-wave ad jingle; stop() cuts it like any other clip. */
  adJingle(profile: BirthdayProfile, seconds = 7) {
    this.stop();
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || profile.volume <= 0) return;
    const notes = [72, 76, 79, 84, 79, 76, 72, 67],
      start = ctx.currentTime;
    for (let i = 0; i * 0.2 < seconds; i++) {
      const source = ctx.createOscillator(),
        gain = ctx.createGain(),
        time = start + i * 0.2;
      source.type = "square";
      source.frequency.value = 440 * Math.pow(2, (notes[i % 8] - 69) / 12);
      gain.gain.setValueAtTime(profile.volume * 0.07, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
      source.connect(gain);
      gain.connect(ctx.destination);
      this.nodes.add(source);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.nodes.delete(source);
      };
      source.start(time);
      source.stop(time + 0.19);
    }
  }
  private clips = new Map<string, Promise<AudioBuffer>>();
  private clip(ctx: AudioContext, name: string) {
    let clip = this.clips.get(name);
    if (!clip) {
      clip = fetch(`${import.meta.env.BASE_URL}assets/audio/${name}.mp3`)
        .then((r) => {
          if (!r.ok) throw new Error(`Audio ${name}: ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => ctx.decodeAudioData(b));
      this.clips.set(name, clip);
      clip.catch(() => this.clips.delete(name));
    }
    return clip;
  }
  /** Bundled clips back to back. `drive` saturates them; `loop` repeats the
   *  last one until stop(). A missing clip never interrupts the game. */
  async playClips(
    names: readonly string[],
    profile: BirthdayProfile,
    { level = 0.8, seconds = Infinity, drive = 0, loop = false } = {},
  ) {
    this.stop();
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || profile.volume <= 0) return;
    const token = this.generation;
    let buffers: AudioBuffer[];
    try {
      buffers = await Promise.all(names.map((n) => this.clip(ctx, n)));
    } catch {
      return;
    }
    if (token !== this.generation) return;
    let start = ctx.currentTime;
    const end = start + seconds;
    buffers.forEach((buffer, i) => {
      if (start >= end) return;
      const source = ctx.createBufferSource(),
        gain = ctx.createGain(),
        repeat = loop && i === buffers.length - 1,
        until = Math.min(end, repeat ? Infinity : start + buffer.duration);
      source.buffer = buffer;
      source.loop = repeat;
      const value = level * profile.volume;
      gain.gain.setValueAtTime(value, start);
      if (Number.isFinite(until) && until < start + buffer.duration) {
        gain.gain.setValueAtTime(value, Math.max(start, until - 0.4));
        gain.gain.linearRampToValueAtTime(0, until);
      }
      let input: AudioNode = gain;
      const shaper = drive > 0 ? ctx.createWaveShaper() : null;
      if (shaper) {
        // Overdrive before the shaper, then rely on the output clipping too.
        const pre = ctx.createGain();
        pre.gain.value = drive;
        shaper.curve = saturationCurve(drive);
        shaper.oversample = "none";
        source.connect(pre);
        pre.connect(shaper);
        shaper.connect(gain);
        input = pre;
      } else source.connect(gain);
      gain.connect(ctx.destination);
      this.nodes.add(source);
      source.onended = () => {
        source.disconnect();
        input.disconnect();
        shaper?.disconnect();
        gain.disconnect();
        this.nodes.delete(source);
      };
      source.start(start);
      if (Number.isFinite(until)) source.stop(until);
      start += buffer.duration;
    });
  }
  /** Random victory jingle for a home goal; Kirby only for the free goal. */
  goal(freeGoal: boolean, profile: BirthdayProfile) {
    const name = freeGoal
      ? FREE_GOAL_CLIP
      : GOAL_CLIPS[Math.floor(Math.random() * GOAL_CLIPS.length)];
    return this.playClips([name], profile, { seconds: 8 });
  }
  win(profile: BirthdayProfile) {
    return this.playClips(WIN_CLIPS, profile, { level: 1 });
  }
  /** Intro third video: the Clash Royale clip, overdriven, on a loop. */
  saturated(profile: BirthdayProfile) {
    return this.playClips(["clash-saturado"], profile, {
      level: 3,
      drive: 12,
      loop: true,
    });
  }
  get running() {
    return this.context?.state === "running";
  }
  /** One synthesized note or noise burst, tracked so stop() cuts it. */
  private note(
    ctx: AudioContext,
    time: number,
    length: number,
    level: number,
    wave: OscillatorType | "noise",
    from = 0,
    to = from,
  ) {
    let source: AudioScheduledSourceNode;
    if (wave === "noise") {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * length, ctx.sampleRate),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      source = Object.assign(ctx.createBufferSource(), { buffer });
    } else {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(from, time);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, time + length);
      source = osc;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + length);
    source.connect(gain);
    gain.connect(ctx.destination);
    this.nodes.add(source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.nodes.delete(source);
    };
    source.start(time);
    source.stop(time + length);
  }
  /** Short menu blip: a move tick or a confirm chirp. */
  blip(profile: BirthdayProfile, confirm = false) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || profile.volume <= 0) return;
    const t = ctx.currentTime;
    this.note(ctx, t, 0.06, 0.06 * profile.volume, "square", confirm ? 660 : 880);
    if (confirm) this.note(ctx, t + 0.07, 0.12, 0.06 * profile.volume, "square", 1320);
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

import * as THREE from "three";
import type { HudState } from "../types";

export const isDefeat = (hud: Pick<HudState, "finished" | "homeScore" | "awayScore">) =>
  hud.finished && hud.homeScore < hud.awayScore;

/** One shared video texture for all players; the second clip overlays the field. */
export class DefeatPresentation {
  private clash = document.createElement("video");
  private mario = document.createElement("video");
  private retry = document.createElement("button");
  private texture: THREE.VideoTexture;
  private material: THREE.SpriteMaterial;
  private sprites = new Map<string, THREE.Sprite>();
  private active: HTMLVideoElement;
  private paused = false;
  private disposed = false;
  private second = false;

  constructor(private scene: THREE.Scene, host: HTMLElement, volume: number) {
    for (const [video, name] of [[this.clash, "jijijija"], [this.mario, "mario"]] as const) {
      video.src = `${import.meta.env.BASE_URL}assets/video/defeat-${name}.webm`;
      video.playsInline = true;
      video.preload = "auto";
      video.volume = volume;
    }
    this.active = this.clash;
    this.mario.className = "defeat-mario";
    this.mario.hidden = true;
    this.mario.setAttribute("aria-label", "Game Over");
    this.retry.className = "defeat-retry";
    this.retry.textContent = "Reproducir celebración de derrota";
    this.retry.hidden = true;
    this.retry.onclick = () => this.play();
    host.append(this.mario, this.retry);
    this.texture = new THREE.VideoTexture(this.clash);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({
      map: this.texture, transparent: true, depthTest: false,
      depthWrite: false, sizeAttenuation: false,
    });
    this.clash.onended = () => this.next();
    this.clash.onerror = () => this.next();
    this.mario.onerror = () => {
      this.retry.hidden = false;
      this.retry.textContent = "Reintentar vídeo Game Over";
    };
    this.play();
  }
  private next() {
    if (this.disposed || this.second) return;
    this.second = true;
    this.clash.pause();
    for (const sprite of this.sprites.values()) sprite.visible = false;
    this.active = this.mario;
    this.mario.hidden = false;
    if (!this.paused) this.play();
  }
  private play() {
    if (this.paused || this.disposed || this.active.ended) return;
    if (this.active.error) this.active.load();
    this.retry.hidden = true;
    void this.active.play().catch(() => {
      if (!this.disposed && !this.paused) this.retry.hidden = false;
    });
  }
  setVolume(volume: number) {
    this.clash.volume = this.mario.volume = volume;
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.active.pause();
    else this.play();
  }
  update(players: ReadonlyMap<string, { root: THREE.Object3D }>) {
    if (this.second) return;
    for (const [id, player] of players) {
      let sprite = this.sprites.get(id);
      if (!sprite) {
        sprite = new THREE.Sprite(this.material);
        sprite.scale.set(0.22, 0.124, 1);
        sprite.center.set(0.5, 0);
        sprite.renderOrder = 12;
        this.sprites.set(id, sprite);
        this.scene.add(sprite);
      }
      sprite.position.copy(player.root.position).add(new THREE.Vector3(0, 2.9, 0));
    }
  }
  dispose() {
    this.disposed = true;
    for (const video of [this.clash, this.mario]) {
      video.onended = video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
    }
    this.retry.remove();
    for (const sprite of this.sprites.values()) this.scene.remove(sprite);
    this.sprites.clear();
    this.texture.dispose();
    this.material.dispose();
  }
}

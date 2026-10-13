import * as THREE from "three";
import type {
  GameRenderer,
  GraphicsQuality,
  MatchSnapshot,
} from "../contracts";
import { FIELD_H, FIELD_W, PX_PER_M } from "../constants";
import type { TeamData } from "../teams/types";
import { Footballer, loadPlayerAssets, type PlayerAssets } from "./footballer";
import { buildStadium, type Stadium } from "./stadium";

export class ThreeRenderer implements GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(43, 16 / 9, 0.1, 280);
  private stadium: Stadium;
  private assets?: PlayerAssets;
  private players = new Map<string, Footballer>();
  private observer: ResizeObserver;
  private disposed = false;
  private anchor = new THREE.Vector3();
  private cameraReady = false;
  private zoom = 1.18;
  setCameraZoom(zoom: number) {
    this.zoom = THREE.MathUtils.clamp(zoom, 1, 1.4);
  }
  private marker: THREE.Mesh;
  private ring: THREE.Mesh;
  private switchMarker: THREE.Mesh;
  private gpu: string;
  private bubbles = new Map<string, { sprite: THREE.Sprite; life: number }>();
  /** Screen-sized speech bubble over a player; replaces his previous one. */
  say(playerId: string, text: string) {
    if (this.disposed) return;
    this.dropBubble(playerId);
    const lines: string[] = [];
    for (const word of text.split(" ")) {
      const last = lines.length - 1;
      if (last >= 0 && (lines[last] + " " + word).length <= 22)
        lines[last] += " " + word;
      else lines.push(word);
    }
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d");
    if (!ctx) return;
    const font = "bold 46px system-ui, sans-serif",
      lineH = 56,
      pad = 26,
      tail = 26;
    ctx.font = font;
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    canvas.width = Math.ceil(textW + pad * 2);
    canvas.height = lines.length * lineH + pad * 2 + tail;
    const w = canvas.width,
      h = canvas.height - tail;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#11161f";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 6, 24);
    ctx.moveTo(w / 2 - 18, h - 4);
    ctx.lineTo(w / 2, h + tail - 4);
    ctx.lineTo(w / 2 + 18, h - 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(w / 2 - 15, h - 9, 30, 8);
    ctx.font = font;
    ctx.fillStyle = "#11161f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((l, i) => ctx.fillText(l, w / 2, pad + lineH * (i + 0.5)));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        sizeAttenuation: false,
      }),
    );
    const height = 0.04 * (canvas.height / 64);
    sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
    sprite.center.set(0.5, 0);
    sprite.renderOrder = 10;
    this.scene.add(sprite);
    this.bubbles.set(playerId, { sprite, life: 2.8 });
  }
  private dropBubble(playerId: string) {
    const bubble = this.bubbles.get(playerId);
    if (!bubble) return;
    this.scene.remove(bubble.sprite);
    bubble.sprite.material.map?.dispose();
    bubble.sprite.material.dispose();
    this.bubbles.delete(playerId);
  }
  constructor(
    private canvas: HTMLCanvasElement,
    private home: TeamData,
    private away: TeamData,
    private quality: GraphicsQuality,
    private onError: (message: string) => void,
  ) {
    const context = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!context)
      throw new Error(
        "Este navegador no dispone de WebGL 2. Activa la aceleración gráfica y vuelve a intentar.",
      );
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    this.gpu = String(
      context.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER),
    );
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.background = new THREE.Color("#a6c9dd");
    this.scene.fog = new THREE.Fog("#a6c9dd", 100, 230);
    this.scene.add(new THREE.HemisphereLight("#d4e9ff", "#455431", 2.1));
    const sun = new THREE.DirectionalLight("#fff3d5", 2.6);
    sun.position.set(-35, 65, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(quality === "high" ? 2048 : 1024);
    Object.assign(sun.shadow.camera, {
      left: -76,
      right: 76,
      top: 66,
      bottom: -66,
      near: 1,
      far: 160,
    });
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.stadium = buildStadium();
    this.scene.add(this.stadium.root);
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.21, 0.33, 3),
      new THREE.MeshBasicMaterial({ color: "#c6ff2e" }),
    );
    this.marker.rotation.z = Math.PI;
    this.scene.add(this.marker);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.55, 24),
      new THREE.MeshBasicMaterial({
        color: "#c6ff2e",
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);
    this.switchMarker = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.3, 3),
      new THREE.MeshBasicMaterial({ color: "#e5ffd4", wireframe: true }),
    );
    this.switchMarker.rotation.z = Math.PI;
    this.scene.add(this.switchMarker);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    canvas.addEventListener("webglcontextlost", this.contextLost);
  }
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.onError(
      "Se perdió el contexto gráfico. Pulsa Reintentar para reconstruir el partido.",
    );
  };
  async initialize() {
    const assets = await loadPlayerAssets();
    if (this.disposed) {
      assets.dispose();
      return;
    }
    this.assets = assets;
  }
  async warmup(snapshot: MatchSnapshot) {
    if (this.disposed) return;
    this.render(snapshot, snapshot, 1, 0);
    await this.renderer.compileAsync(this.scene, this.camera);
  }
  resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width),
      height = Math.max(1, rect.height);
    const renderWidth = this.quality === "high" ? 1920 : 1280;
    this.renderer.setSize(
      renderWidth,
      Math.round((renderWidth * height) / width),
      false,
    );
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    this.scene.traverse((o) => {
      if (o instanceof THREE.DirectionalLight) {
        o.shadow.map?.dispose();
        o.shadow.map = null;
        o.shadow.mapSize.setScalar(quality === "high" ? 2048 : 1024);
        o.shadow.needsUpdate = true;
      }
    });
    this.resize();
  }
  render(
    previous: MatchSnapshot,
    current: MatchSnapshot,
    alpha: number,
    dt: number,
  ) {
    if (this.disposed || !this.assets) return;
    for (const player of current.players) {
      let avatar = this.players.get(player.id);
      if (!avatar) {
        avatar = new Footballer(
          this.assets,
          player,
          player.team === "home" ? this.home : this.away,
        );
        this.players.set(player.id, avatar);
        this.scene.add(avatar.root);
      }
      avatar.update(
        player,
        previous.players.find((p) => p.id === player.id),
        alpha,
        dt,
        current.events,
        current.ownerId === player.id && current.handling,
      );
    }
    const b = current.ball,
      old = previous.ball;
    this.stadium.ball.position.set(
      (THREE.MathUtils.lerp(old.x, b.x, alpha) - FIELD_W / 2) / PX_PER_M,
      Math.max(
        0.155,
        THREE.MathUtils.lerp(old.z, b.z, alpha) / PX_PER_M + 0.155,
      ),
      (THREE.MathUtils.lerp(old.y, b.y, alpha) - FIELD_H / 2) / PX_PER_M,
    );
    this.stadium.ball.rotation.z -= (b.vx / PX_PER_M) * dt * 3;
    this.stadium.ball.rotation.x += (b.vy / PX_PER_M) * dt * 3;
    const desired = new THREE.Vector3(
      THREE.MathUtils.clamp(
        (b.x - FIELD_W / 2 + b.vx * 0.22) / PX_PER_M,
        -32,
        32,
      ),
      0,
      THREE.MathUtils.clamp(
        (b.y - FIELD_H / 2 + b.vy * 0.16) / PX_PER_M,
        -15 - (this.zoom - 1) * 12,
        15 + (this.zoom - 1) * 12,
      ),
    );
    if (!this.cameraReady) {
      this.anchor.copy(desired);
      this.cameraReady = true;
    } else this.anchor.lerp(desired, 1 - Math.exp(-3.5 * dt));
    this.camera.position.set(
      this.anchor.x - 4,
      32 / this.zoom,
      this.anchor.z + 48 / this.zoom,
    );
    this.camera.lookAt(this.anchor.x + 3, 0, this.anchor.z);
    const controlled = this.players.get(current.controlledId);
    if (controlled) {
      this.marker.position
        .copy(controlled.root.position)
        .add(new THREE.Vector3(0, 2.45, 0));
      this.ring.position.copy(controlled.root.position);
      this.ring.position.y = 0.035;
    }
    const hint = current.switchHintId
      ? this.players.get(current.switchHintId)
      : undefined;
    this.switchMarker.visible = !!hint;
    if (hint)
      this.switchMarker.position
        .copy(hint.root.position)
        .add(new THREE.Vector3(0, 2.45, 0));
    for (const [id, bubble] of this.bubbles) {
      const avatar = this.players.get(id);
      bubble.life -= dt;
      if (!avatar || bubble.life <= 0) this.dropBubble(id);
      else
        bubble.sprite.position
          .copy(avatar.root.position)
          .add(new THREE.Vector3(0, 2.9, 0));
    }
    const ripple = [current.netRipple.left, current.netRipple.right];
    this.stadium.nets.forEach((net, i) => {
      net.scale.x = 1 + Math.sin(current.tick * 0.7) * ripple[i] * 0.1;
    });
    this.renderer.render(this.scene, this.camera);
  }
  get statistics() {
    return {
      cameraZoom: this.zoom,
      gpu: this.gpu,
      width: this.canvas.width,
      height: this.canvas.height,
      quality: this.quality,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.players.forEach((p) => p.dispose());
    for (const id of [...this.bubbles.keys()]) this.dropBubble(id);
    this.players.clear();
    this.assets?.dispose();
    this.stadium.dispose();
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.DirectionalLight) o.shadow.dispose();
    });
    this.switchMarker.geometry.dispose();
    (this.switchMarker.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

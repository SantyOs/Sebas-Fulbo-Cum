import { effectivePhoto, photoUrl } from "../customization/photo";
import { applyFacePhoto } from "./face-photo";
import { CELEBRATIONS } from "../customization/profile";
import { sculptFace } from "../customization/face";
import { FREE_GOAL_BONUS, PX_PER_M } from "../constants";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { MatchEvent, MatchSnapshot } from "../contracts";
import type { TeamData } from "../teams/types";
import { hairGeometry } from "./hair";
import { sportClips } from "./sport-clips";

type PlayerView = MatchSnapshot["players"][number];
export interface PlayerAssets {
  model: GLTF;
  locomotion: GLTF;
  dispose(): void;
}
export async function loadPlayerAssets(): Promise<PlayerAssets> {
  const loader = new GLTFLoader();
  const base = `${import.meta.env.BASE_URL}assets/players/`;
  const loaded = await Promise.allSettled([
    loader.loadAsync(base + "footballer.glb"),
    loader.loadAsync(base + "locomotion.glb"),
  ]);
  const disposeGLTF = (g: GLTF) =>
    g.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
  if (loaded.some((r) => r.status === "rejected")) {
    for (const r of loaded) if (r.status === "fulfilled") disposeGLTF(r.value);
    throw new Error(
      "No se pudieron cargar los jugadores. Revisa la conexión y vuelve a intentar.",
    );
  }
  const [model, locomotion] = loaded.map(
    (r) => (r as PromiseFulfilledResult<GLTF>).value,
  );
  return {
    model,
    locomotion,
    dispose() {
      disposeGLTF(model);
      disposeGLTF(locomotion);
    },
  };
}

function kitMaterial(p: PlayerView, team: TeamData) {
  const material = new THREE.MeshStandardMaterial({
    color: p.skin,
    roughness: 0.9,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.boots = {
      value: new THREE.Color(p.custom?.boots ?? "#101418"),
    };
    shader.uniforms.shirt = { value: new THREE.Color(p.kit.shirt) };
    shader.uniforms.sleeve = { value: new THREE.Color(p.kit.sleeve) };
    shader.uniforms.shorts = {
      value: new THREE.Color(p.kit.shorts ?? p.kit.sleeve),
    };
    shader.uniforms.stripes = {
      value:
        team.abbr === "ARG" && !p.isGK && p.kit.shirt === team.kit.shirt
          ? 1
          : 0,
    };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vKitPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvKitPosition = position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vKitPosition;\nuniform vec3 boots; uniform vec3 shirt; uniform vec3 sleeve; uniform vec3 shorts; uniform float stripes;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float y = vKitPosition.y;
      float x = abs(vKitPosition.x);
      if (y > 1.00 && y < 1.53 && x < 0.54) {
        diffuseColor.rgb = x > 0.32 ? sleeve : shirt;
        if(stripes > 0.5 && x < 0.32 && mod(floor((vKitPosition.x+0.3)/0.075),2.0)<1.0) diffuseColor.rgb=vec3(0.92);
        if(y > 1.49 && x < 0.08) diffuseColor.rgb = shorts;
      } else if(y > 0.64 && y <= 1.00 && x < 0.33) diffuseColor.rgb=shorts;
      else if(y > 0.11 && y < 0.44) diffuseColor.rgb=shirt;
      else if(y <= 0.11) diffuseColor.rgb=boots;
    `,
      );
  };
  material.customProgramCacheKey = () => "football-kit-v1";
  return material;
}

function eyeMaterial(p: PlayerView) {
  const material = new THREE.MeshStandardMaterial({
    color: "#ede8df",
    roughness: 0.45,
  });
  const center = p.custom
    ? sculptFace(0.033, 1.698, 0.08, p.custom.face)
    : [0.033, 1.698, 0.08];
  material.onBeforeCompile = (shader) => {
    shader.uniforms.irisColor = {
      value: new THREE.Color(p.custom?.eyeColor ?? "#504c38"),
    };
    shader.uniforms.irisCenter = {
      value: new THREE.Vector2(center[0], center[1]),
    };
    shader.uniforms.irisScale = { value: p.custom?.face.eyeSize ?? 1 };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 eyePosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\neyePosition=position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 eyePosition; uniform vec3 irisColor; uniform vec2 irisCenter; uniform float irisScale;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float irisDistance=length(vec2(abs(eyePosition.x)-irisCenter.x,(eyePosition.y-irisCenter.y)/irisScale));
      if(eyePosition.z>.065){
        diffuseColor.rgb=mix(diffuseColor.rgb,irisColor,1.0-smoothstep(.008,.010,irisDistance));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.012),1.0-smoothstep(.003,.0045,irisDistance));
      }
    `,
      );
  };
  material.customProgramCacheKey = () => "football-eyes-v1";
  return material;
}

export class Footballer {
  readonly root = new THREE.Group();
  readonly ready: Promise<void>;
  private disposed = false;
  private body: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private baseActions: Record<string, THREE.AnimationAction> = {};
  private sports: Record<string, THREE.AnimationAction> = {};
  private current = "";
  private lastEvent = 0;
  private sliding = false;
  private diving = false;
  private kicking = false;
  private throwing = false;
  private castSlot = 0;
  private celebrating = false;
  private celebrationTime = 0;
  private freeGoal = false;
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private textures: THREE.Texture[] = [];
  private orientation = 0;
  /** Skinned body, for presentation-only poses such as the finale. */
  get rig() {
    return this.body;
  }
  constructor(assets: PlayerAssets, p: PlayerView, team: TeamData) {
    const photo = effectivePhoto(p);
    let photoTexture: THREE.Texture | undefined;
    this.ready = photo
      ? new Promise<void>((resolve, reject) => {
          photoTexture = new THREE.TextureLoader().load(
            photoUrl(photo.source),
            (texture: THREE.Texture) => {
              if (this.disposed) {
                texture.dispose();
                resolve();
                return;
              }
              const image = texture.image as HTMLImageElement;
              if (Math.max(image.width, image.height) > 512) {
                const canvas = document.createElement("canvas");
                const scale = 512 / Math.max(image.width, image.height);
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                const context = canvas.getContext("2d");
                if (context) {
                  context.drawImage(image, 0, 0, canvas.width, canvas.height);
                  texture.image = canvas;
                  texture.needsUpdate = true;
                }
              }
              resolve();
            },
            undefined,
            () =>
              reject(
                new Error(
                  "No se pudo cargar una foto de rostro. Revisa la imagen y vuelve a intentar.",
                ),
              ),
          );
          photoTexture.colorSpace = THREE.SRGBColorSpace;
          this.textures.push(photoTexture);
        })
      : Promise.resolve();
    // Preview may disappear before its pending image loads. Warmup still awaits errors.
    void this.ready.catch(() => {});
    this.body = clone(assets.model.scene);
    this.root.add(this.body);
    // The free pack's athletic body is narrowed to football proportions.
    const variation = ((p.num % 5) - 2) * 0.012;
    this.body.scale.set(
      (0.82 + variation) * (p.custom?.build ?? 1),
      ((1.02 + variation) * (p.custom?.height ?? 1.8)) / 1.8,
      0.92 * (p.custom?.build ?? 1),
    );
    this.body.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (p.custom) {
        o.geometry = o.geometry.clone();
        this.geometries.push(o.geometry);
        const positions = o.geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++)
          positions.setXYZ(
            i,
            ...sculptFace(
              positions.getX(i),
              positions.getY(i),
              positions.getZ(i),
              p.custom.face,
            ),
          );
        positions.needsUpdate = true;
        o.geometry.computeVertexNormals();
        o.geometry.computeBoundingSphere();
      }
      const name = o.name.toLowerCase();
      const material = name.includes("eyebrow")
        ? new THREE.MeshStandardMaterial({ color: p.hair })
        : name.includes("eyes")
          ? eyeMaterial(p)
          : kitMaterial(p, team);
      if (photo && photoTexture) applyFacePhoto(material, photoTexture, photo);
      o.material = material;
      this.materials.push(material);
      o.castShadow = true;
      o.receiveShadow = true;
      // Animated bounds otherwise use only the original T-pose.
      o.frustumCulled = false;
    });
    this.body.updateMatrixWorld(true);
    const attach = (
      boneName: string,
      object: THREE.Object3D,
      world: THREE.Vector3,
    ) => {
      const bone = this.body.getObjectByName(boneName);
      if (!bone) return;
      const position = this.body.localToWorld(world.clone());
      object.position.copy(bone.worldToLocal(position));
      const rotation = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
      object.quaternion.premultiply(rotation);
      bone.add(object);
    };
    const style = p.custom?.hairStyle ?? "short";
    const hairGeo = hairGeometry(style);
    this.geometries.push(hairGeo);
    const hairMat = new THREE.MeshStandardMaterial({
      color: p.hair,
      roughness: 1,
    });
    this.materials.push(hairMat);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.name = "PlayerHair";
    hair.visible = style !== "bald";
    hair.castShadow = true;
    attach("Head", hair, new THREE.Vector3(0, 1.69, -0.01));
    if (p.custom?.beard) {
      const geo = new THREE.SphereGeometry(0.065, 10, 6);
      this.geometries.push(geo);
      const beard = new THREE.Mesh(geo, hairMat);
      beard.scale.set(1, 0.55, 0.6);
      attach("Head", beard, new THREE.Vector3(0, 1.581, 0.045));
    }
    if (p.custom) {
      for (const hand of ["hand_l", "hand_r"]) {
        const geo = new THREE.TorusGeometry(0.04, 0.012, 5, 12);
        this.geometries.push(geo);
        const material = new THREE.MeshStandardMaterial({
          color: p.custom.wristband,
        });
        this.materials.push(material);
        const band = new THREE.Mesh(geo, material);
        band.rotation.x = Math.PI / 2;
        this.body.getObjectByName(hand)?.add(band);
      }
    }
    const label = document.createElement("canvas");
    label.width = 256;
    label.height = 256;
    const ctx = label.getContext("2d")!;
    const light =
      new THREE.Color(p.kit.shirt).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55;
    ctx.fillStyle = light ? "#13263b" : "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(p.name.slice(0, 15), 128, 45);
    ctx.font = "bold 150px sans-serif";
    ctx.fillText(String(p.num), 128, 194);
    const tex = new THREE.CanvasTexture(label);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.materials.push(labelMaterial);
    const labelGeo = new THREE.PlaneGeometry(0.29, 0.32);
    this.geometries.push(labelGeo);
    const labelMesh = new THREE.Mesh(labelGeo, labelMaterial);
    labelMesh.rotation.y = Math.PI;
    attach("spine_03", labelMesh, new THREE.Vector3(0, 1.3, -0.163));
    if (p.isGK) {
      for (const hand of ["hand_l", "hand_r"]) {
        const geo = new THREE.SphereGeometry(0.058, 8, 6);
        this.geometries.push(geo);
        const material = new THREE.MeshStandardMaterial({ color: "#e8ecdc" });
        this.materials.push(material);
        const glove = new THREE.Mesh(geo, material);
        glove.scale.set(0.75, 1.3, 1);
        this.body.getObjectByName(hand)?.add(glove);
      }
    }
    this.mixer = new THREE.AnimationMixer(this.body);
    for (const clip of assets.locomotion.animations) {
      const action = this.mixer.clipAction(clip);
      this.baseActions[clip.name] = action;
    }
    for (const clip of sportClips(
      assets.model.scene,
      assets.locomotion.animations.find((c) => c.name === "Idle_Loop")!,
    )) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      this.sports[clip.name] = action;
    }
    this.castSlot = Math.max(
      0,
      team.players.findIndex(
        (q) => `${p.team}-${q.sourceId ?? q.num}` === p.id,
      ),
    );
    this.setBase("Idle_Loop");
  }
  private celebrationLength(p: PlayerView) {
    return (
      3.6 + (p.cast?.celebrationBonus ?? 0) + (this.freeGoal ? FREE_GOAL_BONUS : 0)
    );
  }
  private celebrationName(p: PlayerView) {
    const style =
      p.custom?.celebration.style ??
      p.cast?.celebrationStyle ??
      CELEBRATIONS[this.castSlot % CELEBRATIONS.length];
    return style === "classic" ? "celebrate" : `celebrate_${style}`;
  }
  private setBase(name: string) {
    if (this.current === name) return;
    this.baseActions[this.current]?.fadeOut(0.16);
    this.baseActions[name]?.reset().setEffectiveWeight(1).fadeIn(0.16).play();
    this.current = name;
  }
  private play(name: string) {
    const action = this.sports[name];
    if (!action) return;
    for (const other of Object.values(this.sports))
      if (other !== action) other.fadeOut(0.07);
    action.reset().setEffectiveWeight(1).play();
  }
  update(
    p: PlayerView,
    previous: PlayerView | undefined,
    alpha: number,
    dt: number,
    events: readonly MatchEvent[],
    handling: boolean,
  ) {
    const prev = previous ?? p;
    this.root.position.set(
      THREE.MathUtils.lerp(prev.x, p.x, alpha) / PX_PER_M - 52.5,
      0,
      THREE.MathUtils.lerp(prev.y, p.y, alpha) / PX_PER_M - 34,
    );
    const yaw = Math.atan2(p.facing.x, p.facing.y);
    let diff =
      THREE.MathUtils.euclideanModulo(
        yaw - this.orientation + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    this.orientation += diff * (1 - Math.exp(-18 * dt));
    this.root.rotation.y = this.orientation;
    const speed = Math.hypot(p.vx, p.vy) / PX_PER_M;
    const backward = p.vx * p.facing.x + p.vy * p.facing.y < -10;
    this.setBase(
      this.celebrationTime > 0 || speed < 0.25
        ? "Idle_Loop"
        : backward
          ? "Crouch_Fwd_Loop"
          : speed > 7.3
            ? "Sprint_Loop"
            : speed > 2
              ? "Jog_Fwd_Loop"
              : "Walk_Loop",
    );
    const locomotion = this.baseActions[this.current];
    if (locomotion && speed > 0.25)
      locomotion.timeScale = THREE.MathUtils.clamp(
        speed /
          (this.current === "Sprint_Loop"
            ? 8
            : this.current === "Walk_Loop"
              ? 1.8
              : 4.5),
        0.65,
        1.7,
      );
    let kickEvent = false;
    for (const e of events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (e.playerId === p.id && e.kind !== "restart" && e.kind !== "refusal") {
        if (e.kind === "goal" && e.team && e.team !== p.team) continue;
        if (e.kind === "goal") {
          this.freeGoal = !!e.freeGoal;
          this.celebrationTime = this.celebrationLength(p);
        }
        kickEvent ||= e.kind === "pass" || e.kind === "shot";
        this.play(
          e.kind === "contact"
            ? "receive"
            : e.kind === "save"
              ? "save"
              : e.kind === "shot"
                ? "shot"
                : e.kind === "pass"
                  ? "pass"
                  : this.celebrationName(p),
        );
      }
    }
    const slide = (p.slideTimer ?? 0) > 0,
      dive = (p.diveTimer ?? 0) > 0,
      kick = p.kickTimer > 0;
    if (slide && !this.sliding) this.play("slide");
    if (!slide && this.sliding) this.play("recover");
    if (dive && !this.diving) this.play("dive");
    if (kick && !this.kicking && !kickEvent) this.play("tackle");
    if (p.throwing && !this.throwing) this.play("throw");
    if (p.celebrating && !this.celebrating) {
      this.play(this.celebrationName(p));
      this.celebrationTime = this.celebrationLength(p);
    }
    if (handling) {
      const action = this.sports.save;
      if (action && !action.isRunning()) {
        action.reset().play();
        action.time = action.getClip().duration * 0.45;
        action.paused = true;
      }
    } else if (this.sports.save?.paused) {
      this.sports.save.paused = false;
      this.sports.save.fadeOut(0.12);
    }
    this.sliding = slide;
    this.diving = dive;
    this.kicking = kick;
    this.throwing = !!p.throwing;
    this.celebrating = !!p.celebrating;
    const celebration = p.custom?.celebration;
    const active = this.sports[this.celebrationName(p)];
    if (active) active.timeScale = celebration?.speed ?? 1;
    if (this.celebrationTime > 0) {
      this.celebrationTime = Math.max(0, this.celebrationTime - dt);
      if (this.celebrationTime === 0) {
        active?.fadeOut(0.15);
        this.freeGoal = false;
      }
      else if (active && !active.isRunning())
        this.play(this.celebrationName(p));
    }
    this.mixer.update(dt);
    if (p.custom)
      this.body.getObjectByName("Head")?.scale.setScalar(p.custom.headSize);
    // Whole-body dive follows the goalmouth, independent of which way he faces.
    const diveProgress = dive
      ? Math.sin(
          Math.PI *
            THREE.MathUtils.clamp((0.6 - (p.diveTimer ?? 0)) / 0.6, 0, 1),
        )
      : 0;
    this.body.rotation.z = 0;
    this.body.rotation.x = slide ? -0.8 : diveProgress * (p.diveDir ?? 1) * 1.3;
    this.body.position.z = 0;
    this.body.position.y = slide ? -0.32 : diveProgress * 0.42;
    if (this.celebrationTime > 0) {
      const t =
          (this.celebrationLength(p) - this.celebrationTime) *
          (celebration?.speed ?? 1),
        fade = Math.min(1, this.celebrationTime * 3, t * 4);
      this.body.position.y +=
        Math.abs(Math.sin(t * 7)) * (celebration?.jump ?? 0.15) * fade;
      this.root.rotation.y += t * Math.PI * 2 * (celebration?.spin ?? 0) * fade;
      const style = this.celebrationName(p);
      if (style === "celebrate_slide") {
        this.body.position.y = -0.48 * fade;
        this.body.position.z = Math.min(t, 1) * 0.8 * fade;
      } else this.body.position.z = 0;
      if (style === "celebrate_siu") {
        const leap = Math.sin(Math.min(1, t / 1.2) * Math.PI);
        this.body.position.y += leap * 0.6 * fade;
        this.root.rotation.y += Math.min(1, t / 1.2) * Math.PI * 2;
      }
      if (style === "celebrate_airplane")
        this.body.rotation.z = Math.sin(t * 4) * 0.2 * fade;
      if (style === "celebrate_dance")
        this.body.rotation.z = Math.sin(t * 10) * 0.18 * fade;

    }
    if (dive) this.root.rotation.y = 0;
    if (slide && p.slideDir)
      this.root.rotation.y = Math.atan2(p.slideDir.x, p.slideDir.y);
  }
  dispose() {
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.body);
    this.materials.forEach((m) => m.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.textures.forEach((t) => t.dispose());
    this.body.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
    });
  }
}

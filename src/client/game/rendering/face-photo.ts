import * as THREE from "three";
import type { FacePhoto } from "../customization/photo";

/** Project the photo in bind space so it follows the skinned head and its sculpt. */
export function applyFacePhoto(
  material: THREE.MeshStandardMaterial,
  texture: THREE.Texture,
  photo: FacePhoto,
) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.facePhoto = { value: texture };
    shader.uniforms.facePlacement = {
      value: new THREE.Vector4(
        photo.offsetX,
        1 - photo.offsetY,
        photo.scale,
        photo.opacity,
      ),
    };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vPhotoPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPhotoPosition = position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vPhotoPosition; uniform sampler2D facePhoto; uniform vec4 facePlacement;",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `
        vec2 faceUV = vec2(vPhotoPosition.x / 0.18 + 0.5, (vPhotoPosition.y - 1.565) / 0.215);
        vec2 photoUV = (faceUV - 0.5) * vec2(0.18 / 0.215, 1.0) / facePlacement.z + facePlacement.xy;
        float edge = 1.0 - smoothstep(0.78, 1.0, length((faceUV - 0.5) * 2.0));
        float front = smoothstep(0.025, 0.065, vPhotoPosition.z);
        float inside = step(0.0, photoUV.x) * step(photoUV.x, 1.0) * step(0.0, photoUV.y) * step(photoUV.y, 1.0);
        vec4 faceTexel = texture2D(facePhoto, clamp(photoUV, 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, faceTexel.rgb, edge * front * inside * facePlacement.w * faceTexel.a);
        #include <roughnessmap_fragment>
      `,
      );
  };
  material.customProgramCacheKey = () => `face-photo-${previous.toString()}`;
}

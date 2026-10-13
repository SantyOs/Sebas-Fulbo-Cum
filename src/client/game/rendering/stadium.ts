import * as THREE from "three";

export interface Stadium {
  root: THREE.Group;
  ball: THREE.Mesh;
  nets: THREE.Group[];
  dispose(): void;
}
export function buildStadium(): Stadium {
  const root = new THREE.Group();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const geometryCache = new Map<string, THREE.BoxGeometry>();
  const mat = (color: THREE.ColorRepresentation, roughness = 0.9) => {
    const key = `${color}:${roughness}`;
    let m = materialCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness });
      materialCache.set(key, m);
      materials.add(m);
    }
    return m;
  };
  const grass = mat("#377844"),
    stripe = mat("#40874b"),
    concrete = mat("#777e86"),
    white = mat("#f4f0dd"),
    dark = mat("#1b3042");
  function mesh(
    g: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Object3D = root,
  ) {
    geometries.add(g);
    const m = new THREE.Mesh(g, material);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent = root,
  ) => {
    const key = `${w}:${h}:${d}`;
    let geometry = geometryCache.get(key);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(w, h, d);
      geometryCache.set(key, geometry);
    }
    return mesh(geometry, material, x, y, z, parent);
  };
  box(150, 0.5, 112, grass, 0, -0.3, 0);
  for (let i = 0; i < 20; i++)
    box(
      5.25,
      0.012,
      68,
      i % 2 ? grass : stripe,
      -52.5 + 2.625 + i * 5.25,
      -0.02,
      0,
    );
  const lineMaterial = new THREE.LineBasicMaterial({ color: "#f0f0d9" });
  materials.add(lineMaterial);
  const line = (points: THREE.Vector3[], parent = root) => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    geometries.add(g);
    const l = new THREE.Line(g, lineMaterial);
    parent.add(l);
    return l;
  };
  const rectangle = (x1: number, z1: number, x2: number, z2: number) =>
    line(
      [
        [x1, z1],
        [x2, z1],
        [x2, z2],
        [x1, z2],
        [x1, z1],
      ].map(([x, z]) => new THREE.Vector3(x, 0.018, z)),
    );
  rectangle(-52.5, -34, 52.5, 34);
  line([new THREE.Vector3(0, 0.02, -34), new THREE.Vector3(0, 0.02, 34)]);
  function arc(x: number, z: number, r: number, start = 0, end = Math.PI * 2) {
    line(
      Array.from(
        { length: 65 },
        (_, i) =>
          new THREE.Vector3(
            x + Math.cos(start + ((end - start) * i) / 64) * r,
            0.022,
            z + Math.sin(start + ((end - start) * i) / 64) * r,
          ),
      ),
    );
  }
  arc(0, 0, 9.15);
  const spot = (x: number, z: number) => {
    const m = mesh(new THREE.CircleGeometry(0.14, 12), white, x, 0.025, z);
    m.rotation.x = -Math.PI / 2;
  };
  spot(0, 0);
  const nets: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const gx = side * 52.5;
    rectangle(gx, -20.16, gx - side * 16.5, 20.16);
    rectangle(gx, -9.16, gx - side * 5.5, 9.16);
    spot(gx - side * 11, 0);
    arc(
      gx - side * 11,
      0,
      9.15,
      side === 1 ? Math.PI - 0.925 : -0.925,
      side === 1 ? Math.PI + 0.925 : 0.925,
    );
    for (const z of [-34, 34]) {
      const pole = mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6),
        white,
        gx,
        0.75,
        z,
      );
      pole.castShadow = true;
      box(0.4, 0.28, 0.02, mat("#e5ba3a"), gx + 0.18, 1.3, z);
    }
    for (const z of [-3.66, 3.66]) {
      const post = mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.44, 10),
        white,
        gx,
        1.22,
        z,
      );
      post.castShadow = true;
    }
    const bar = mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 7.32, 10),
      white,
      gx,
      2.44,
      0,
    );
    bar.rotation.x = Math.PI / 2;
    bar.castShadow = true;
    const net = new THREE.Group();
    net.position.x = gx;
    root.add(net);
    nets.push(net);
    const netMaterial = new THREE.LineBasicMaterial({
      color: "#d5dfd5",
      transparent: true,
      opacity: 0.53,
    });
    materials.add(netMaterial);
    const points: number[] = [];
    const segment = (a: number[], b: number[]) => points.push(...a, ...b);
    for (let z = -3.66; z <= 3.67; z += 0.24) {
      segment([side * 2, 0, z], [side * 2, 2.15, z]);
      segment([0, 2.44, z], [side * 2, 2.15, z]);
    }
    for (let y = 0; y <= 2.16; y += 0.24)
      segment([side * 2, y, -3.66], [side * 2, y, 3.66]);
    for (const z of [-3.66, 3.66]) {
      for (let y = 0; y <= 2.44; y += 0.24)
        segment([0, y, z], [side * 2, y * 0.88, z]);
      for (let x = 0; x <= 2; x += 0.25)
        segment([side * x, 0, z], [side * x, 2.44 - x * 0.145, z]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geometries.add(geo);
    net.add(new THREE.LineSegments(geo, netMaterial));
    box(0.1, 2.15, 0.1, dark, gx + side * 2, 1.075, -3.66);
    box(0.1, 2.15, 0.1, dark, gx + side * 2, 1.075, 3.66);
  }
  // Layered stands remain geometrically simple; spectators are one instanced draw.
  for (let tier = 0; tier < 9; tier++) {
    for (const z of [-1, 1])
      box(132, 0.75, 2.4, concrete, 0, tier * 0.72, z * (42 + tier * 2));
    for (const x of [-1, 1])
      box(2.4, 0.75, 82, concrete, x * (61 + tier * 2), tier * 0.72, 0);
  }
  box(135, 0.35, 13, dark, 0, 11, -53);
  box(135, 0.35, 13, dark, 0, 11, 53);
  const crowdGeometry = new THREE.BoxGeometry(0.38, 0.7, 0.3);
  geometries.add(crowdGeometry);
  const crowdMaterial = mat("#fff");
  const crowd = new THREE.InstancedMesh(crowdGeometry, crowdMaterial, 3200);
  root.add(crowd);
  const transform = new THREE.Object3D();
  const colors = ["#d4d8cb", "#17334f", "#b7a880", "#bb4939", "#709597"];
  for (let i = 0; i < 3200; i++) {
    const row = Math.floor(i / 200) % 8,
      seat = i % 200,
      side = i < 1600 ? -1 : 1;
    transform.position.set(
      -62 + seat * 0.625,
      row * 0.72 + 0.8,
      side * (42 + row * 2),
    );
    transform.rotation.y = (i * 1.73) % 6.28;
    transform.updateMatrix();
    crowd.setMatrixAt(i, transform.matrix);
    crowd.setColorAt(i, new THREE.Color(colors[i % colors.length]));
  }
  crowd.instanceMatrix.needsUpdate = true;
  const adCanvas = document.createElement("canvas");
  adCanvas.width = 1024;
  adCanvas.height = 128;
  const c = adCanvas.getContext("2d")!;
  c.fillStyle = "#0e2031";
  c.fillRect(0, 0, 1024, 128);
  c.fillStyle = "#c6ff2e";
  c.font = "bold 64px sans-serif";
  c.textAlign = "center";
  c.fillText("WORLD CUP 2026", 512, 87);
  const adTexture = new THREE.CanvasTexture(adCanvas);
  adTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(adTexture);
  const adMat = new THREE.MeshBasicMaterial({ map: adTexture });
  materials.add(adMat);
  for (let i = 0; i < 10; i++)
    for (const side of [-1, 1]) {
      const ad = mesh(
        new THREE.PlaneGeometry(11, 1.3),
        adMat,
        -50 + i * 11,
        0.7,
        side * 38.5,
      );
      ad.rotation.y = side === 1 ? Math.PI : 0;
    }
  for (const x of [-17, 17]) {
    box(9, 0.5, 2, mat("#25364d"), x, 0.25, -37);
    box(9, 0.12, 2.5, mat("#607d92"), x, 2.1, -37);
    for (let i = 0; i < 8; i++)
      box(0.55, 0.7, 0.55, mat("#3978a5"), x - 3.2 + i * 0.9, 0.8, -37);
  }
  const ball = mesh(new THREE.IcosahedronGeometry(0.155, 2), white);
  const position = ball.geometry.getAttribute("position");
  const colorArray = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const darkPanel =
      Math.sin(position.getX(i) * 52) +
        Math.cos(position.getY(i) * 46) +
        Math.sin(position.getZ(i) * 41) >
      1;
    const color = new THREE.Color(darkPanel ? "#202934" : "#ffffff");
    color.toArray(colorArray, i * 3);
  }
  ball.geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
  const ballMat = mat("#ffffff");
  ballMat.vertexColors = true;
  ball.material = ballMat;
  ball.castShadow = true;
  return {
    root,
    ball,
    nets,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

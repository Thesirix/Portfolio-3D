// Cœur de la scène 3D du Hero : l'astronaute, son rocher et le feu de camp.
// Ne touche jamais au DOM : il tourne dans un Web Worker (OffscreenCanvas, la
// page n'est jamais bloquée) ou, à défaut, dans la page. Voir spaceman.js.
// Le modèle vient de blender/spaceman.py (voir README).
//
// Ce qui garde la scène légère :
// - 3 meshes sans texture (couleurs par sommet), compression meshopt ;
// - un seul matériau toon partagé, flamme animée dans le shader ;
// - rendu en pause quand le Hero n'est plus visible ou que l'onglet est caché ;
// - résolution qui baisse toute seule si l'appareil peine ;
// - « réduire les animations » du système respecté (image fixe).

import {
  AdditiveBlending,
  AnimationMixer,
  Box3,
  CanvasTexture,
  DataTexture,
  Group,
  HemisphereLight,
  DirectionalLight,
  LoopOnce,
  MathUtils,
  MeshToonMaterial,
  NearestFilter,
  PerspectiveCamera,
  PointLight,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  Quaternion,
  Raycaster,
  RedFormat,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

// Où tombe le sol (y = 0) dans le canvas, en partant du haut (0 à 1).
// Doit rester égal à --sm-ground dans index.css.
export const GROUND_FRACTION = 0.76;

// Rotation de la scène : 0 = l'astronaute est de face et regarde le visiteur
const YAW = 0;
const FIRE = new Vector3(-0.53, 0, 0.5); // position du feu dans le modèle (avant rotation)

// ── Matériau toon ──────────────────────────────────────────────────────────
// 3 paliers d'ombre, comme un dessin à aplats.
function toonRamp() {
  const t = new DataTexture(new Uint8Array([70, 150, 215, 255]), 4, 1, RedFormat);
  t.minFilter = t.magFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

// UV du modèle = données : u = lumière propre (yeux, braises...), v = vitre.
function makeToonMaterial(ramp) {
  const m = new MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vData;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvData = uv;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vData;")
      .replace(
        "#include <opaque_fragment>",
        `
        vec3 viewDir = normalize(vViewPosition);
        float facing = max(dot(normal, viewDir), 0.0);
        // liseré bleuté sur les bords : détache le perso du fond sombre
        outgoingLight += smoothstep(0.62, 0.82, 1.0 - facing) * vec3(0.10, 0.13, 0.32) * (1.0 - vData.x);
        // vitre : reflet net + bord clair
        vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
        float spec = pow(max(dot(reflect(-viewDir, normal), L), 0.0), 24.0);
        outgoingLight += vData.y * (step(0.55, spec) * vec3(0.75, 0.82, 1.0)
                                  + smoothstep(0.5, 0.8, 1.0 - facing) * vec3(0.18, 0.24, 0.6));
        // parties lumineuses : leur couleur, sans ombre
        outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.15, vData.x);
        #include <opaque_fragment>`
      );
  };
  return m;
}

// ── Flamme ─────────────────────────────────────────────────────────────────
// 3 couches (uv.x = couche, uv.y = hauteur), déformées en vagues dans le shader.
function makeFlameMaterial(axis) {
  return new ShaderMaterial({
    vertexColors: true,
    uniforms: { uTime: { value: 0 }, uAxis: { value: new Vector2(axis.x, axis.z) } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uAxis;
      varying vec3 vCol;
      varying float vH;
      void main() {
        vec3 p = position;
        float h = uv.y;
        float layer = uv.x;
        vec2 d = p.xz - uAxis;
        float ang = atan(d.y, d.x);
        float wob = 1.0 + 0.24 * h * sin(ang * 3.0 + uTime * 7.0 + h * 5.0 + layer * 2.0)
                        + 0.10 * sin(uTime * 11.0 + h * 8.0 + layer);
        float sway = h * h * (0.04 * sin(uTime * 2.3) + 0.02 * sin(uTime * 5.1 + 1.0));
        p.xz = uAxis + d * wob + vec2(sway, sway * 0.5);
        p.y *= 1.0 + 0.1 * sin(uTime * 6.0 + layer * 1.7) * h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        // les couches intérieures passent devant l'extérieure
        gl_Position.z -= layer * 0.004 * gl_Position.w;
        vCol = color.rgb;
        vH = h;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;
      varying float vH;
      void main() {
        gl_FragColor = vec4(vCol * (1.05 + 0.35 * vH), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// Halo du feu : sprite avec un dégradé rond, en mode additif.
function makeGlow() {
  // OffscreenCanvas : marche aussi dans le worker (pas de document)
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(64, 64) : document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,170,90,0.9)");
  grd.addColorStop(0.35, "rgba(255,110,40,0.35)");
  grd.addColorStop(1, "rgba(255,80,20,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const s = new Sprite(
    new SpriteMaterial({ map: tex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })
  );
  s.scale.setScalar(0.85);
  return s;
}

// Braises qui montent du feu (calculées entièrement dans le shader).
function makeEmbers(axis, count = 14) {
  const geo = new BufferGeometry();
  const seeds = new Float32Array(count);
  // valeurs fixes (pas de hasard) : la première image est toujours la même
  for (let i = 0; i < count; i++) seeds[i] = (Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1 + (Math.sin(i * 12.9898 + 4.1) < 0 ? 1 : 0);
  geo.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("seed", new Float32BufferAttribute(seeds, 1));
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAxis: { value: axis.clone() }, uScale: { value: 300 } },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      uniform vec3 uAxis;
      uniform float uScale;
      varying float vLife;
      void main() {
        float t = fract(uTime * (0.25 + 0.2 * seed) + seed * 7.0);
        vec3 p = uAxis + vec3(
          sin(seed * 40.0 + t * 6.0) * 0.09 * t + (seed - 0.5) * 0.08,
          0.12 + t * 0.75,
          cos(seed * 23.0 + t * 5.0) * 0.07 * t);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (0.012 + 0.01 * seed) * (1.0 - t) / -mv.z;
        vLife = t;
      }`,
    fragmentShader: /* glsl */ `
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        vec3 c = mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 0.3, 0.1), vLife);
        gl_FragColor = vec4(c, (1.0 - vLife) * smoothstep(0.5, 0.2, d));
        #include <colorspace_fragment>
      }`,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ── Cadrage ────────────────────────────────────────────────────────────────
// Caméra calée pour que tout le modèle tienne dans le canvas, avec le sol à
// GROUND_FRACTION de la hauteur : le CSS peut alors poser le canvas pile sur
// la ligne du cratère dessiné, quelle que soit la taille de l'écran.
function frameCamera(camera, box) {
  const dir = new Vector3(0, 0.2, 1).normalize(); // vue légèrement plongeante
  const center = box.getCenter(new Vector3());
  const corners = [];
  for (let i = 0; i < 8; i++) {
    corners.push(new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  }
  const groundPoint = new Vector3(center.x, 0, center.z);
  const targetNdc = 1 - 2 * GROUND_FRACTION;
  const v = new Vector3();
  let dist = 2;
  for (let iter = 0; iter < 60; iter++) {
    // hauteur visée pour que le sol tombe au bon endroit
    let lo = -2, hi = 3, ty = 0;
    for (let k = 0; k < 30; k++) {
      ty = (lo + hi) / 2;
      const target = new Vector3(center.x, ty, center.z);
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      v.copy(groundPoint).project(camera);
      if (v.y > targetNdc) lo = ty; else hi = ty;
    }
    const fits = corners.every((c) => {
      v.copy(c).project(camera);
      return Math.abs(v.x) < 0.94 && v.y < 0.94 && v.y > -0.99;
    });
    if (fits) break;
    dist *= 1.04;
  }
}

// ── Création ───────────────────────────────────────────────────────────────
// canvas : HTMLCanvasElement (page) ou OffscreenCanvas (worker).
// model : contenu de spaceman.glb (ArrayBuffer), téléchargé par la page.
// Renvoie les commandes que la page envoie (taille, visibilité, souris, clic).
export async function createScene({ canvas, model, width, height, dpr: dprMax, reduceMotion, onCursor }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "default" });
  renderer.outputColorSpace = SRGBColorSpace;
  let dpr = Math.min(dprMax || 1, 2);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 0.1, 30);

  // Lumières : ciel violet, lune en haut à droite, feu orange
  scene.add(new HemisphereLight(0xa9b8ff, 0x3a2475, 1.6));
  const moon = new DirectionalLight(0xffffff, 1.6);
  moon.position.set(2, 3, 2);
  scene.add(moon);
  const fireLight = new PointLight(0xff8a3d, 2.2, 3.5, 1.6);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(model, "");

  const root = new Group();
  root.rotation.y = YAW;
  root.add(gltf.scene);
  scene.add(root);

  const ramp = toonRamp();
  const toon = makeToonMaterial(ramp);
  const fireAxis = FIRE.clone();
  const flameMat = makeFlameMaterial(fireAxis);
  let character = null;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === "Flame") {
      o.material = flameMat;
    } else {
      o.material = toon;
      if (o.isSkinnedMesh) character = o;
    }
    o.frustumCulled = false; // un seul petit objet toujours visible : inutile de tester
  });

  // Feu : halo, braises et lumière au-dessus des flammes
  const glow = makeGlow();
  glow.position.copy(fireAxis).setY(0.24);
  const embers = makeEmbers(fireAxis);
  root.add(glow, embers);
  fireLight.position.copy(fireAxis).setY(0.35);
  root.add(fireLight);

  // Animations
  const mixer = new AnimationMixer(gltf.scene);
  const clip = (n) => gltf.animations.find((a) => a.name === n);
  const idle = mixer.clipAction(clip("idle"));
  const wave = clip("wave") ? mixer.clipAction(clip("wave")) : null;
  idle.play();
  if (wave) {
    wave.setLoop(LoopOnce, 1);
    mixer.addEventListener("finished", (e) => {
      if (e.action === wave) wave.crossFadeTo(idle.reset().play(), 0.35, false);
    });
  }

  // Os de la tête : suit le pointeur
  let head = null, spine = null;
  gltf.scene.traverse((o) => {
    if (o.isBone && o.name === "head") head = o;
    if (o.isBone && o.name === "spine") spine = o;
  });

  // Boîte de cadrage (pose de repos + marge pour le coucou et l'antenne)
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(gltf.scene, true).expandByScalar(0.05);
  box.min.y = -0.02; // rien n'est sous le sol (la boîte du mesh à squelette déborde)
  // le halo du feu doit tenir entièrement dans le canvas, sinon il est coupé net
  const glowPos = glow.getWorldPosition(new Vector3());
  const r = glow.scale.x * 0.5;
  box.expandByPoint(glowPos.clone().addScalar(r)).expandByPoint(glowPos.clone().addScalar(-r));
  // zone cliquable : le perso seul (le feu est à gauche)
  const hitBox = new Box3().setFromObject(character ?? root, true);

  // ── Boucle ─────────────────────────────────────────────────────────────
  const size = new Vector2();
  const pointer = new Vector2(0, 0); // -1..1 par rapport au perso
  const look = new Vector2(0, 0);
  const qYaw = new Quaternion(), qPitch = new Quaternion();
  const AX_X = new Vector3(1, 0, 0), AX_Y = new Vector3(0, 1, 0);
  let lastTime = 0;
  let time = 0;
  let running = false;
  let frames = 0, frameTime = 0, adaptChecks = 0;

  function applySize(w, h) {
    size.set(w, h);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameCamera(camera, box);
    embers.material.uniforms.uScale.value = (h * dpr) / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
  }

  function render(dt) {
    time += dt;
    mixer.update(dt);
    if (head && spine) {
      look.lerp(pointer, 1 - Math.exp(-dt * 4));
      // suivi léger : il reste de face, la tête accompagne juste un peu la souris
      qYaw.setFromAxisAngle(AX_Y, look.x * 0.22);
      qPitch.setFromAxisAngle(AX_X, look.y * 0.12);
      head.quaternion.multiply(qYaw).multiply(qPitch);
      qYaw.setFromAxisAngle(AX_Y, look.x * 0.05);
      spine.quaternion.multiply(qYaw);
    }
    flameMat.uniforms.uTime.value = time;
    embers.material.uniforms.uTime.value = time;
    const flicker = 0.85 + 0.1 * Math.sin(time * 13.0) + 0.08 * Math.sin(time * 7.3 + 1.0);
    fireLight.intensity = 2.2 * flicker;
    glow.material.opacity = 0.5 * flicker;
    renderer.render(scene, camera);
  }

  const waving = () => wave && wave.isRunning();

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    render(reduceMotion && !waving() ? 0 : dt);
    if (reduceMotion && !waving()) stopLoop();
    // Résolution adaptative : si l'image prend plus de 22 ms, on baisse
    frames++;
    frameTime += dt;
    if (frameTime > 2 && adaptChecks < 4) {
      adaptChecks++;
      if (frameTime / frames > 0.022 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.5);
        renderer.setPixelRatio(dpr);
        applySize(size.x, size.y);
      }
      frames = 0;
      frameTime = 0;
    }
  }

  function startLoop() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    renderer.setAnimationLoop(tick); // requestAnimationFrame, aussi dans un worker
  }
  function stopLoop() {
    running = false;
    renderer.setAnimationLoop(null);
  }

  const ray = new Raycaster();
  const ndc = new Vector2();
  function hit(x, y) {
    ndc.set(x, y);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectsBox(hitBox);
  }

  // Première image de l'animation : c'est aussi l'image fixe affichée avant la 3D
  // (public/spaceman-poster-*.webp, refaite par `npm run model:poster`), pour que
  // le passage de l'image à la 3D se fasse sans aucun saut.
  function firstFrame() {
    stopLoop();
    wave?.stop();
    idle.reset().play();
    mixer.setTime(0);
    pointer.set(0, 0);
    look.set(0, 0);
    time = 0;
    render(0);
  }

  applySize(Math.max(1, width), Math.max(1, height));
  render(0); // le premier rendu prépare aussi les shaders

  return {
    resize(w, h) {
      if (w === size.x && h === size.y) return;
      applySize(Math.max(1, w), Math.max(1, h));
      if (!running) render(0);
    },
    // à l'écran et onglet affiché : l'animation tourne, sinon pause
    setActive(on) {
      if (on && !reduceMotion) startLoop();
      else stopLoop();
    },
    setPointer(x, y) {
      pointer.set(x, y);
    },
    hover(x, y) {
      onCursor?.(hit(x, y));
    },
    click(x, y) {
      if (!wave || waving() || !hit(x, y)) return;
      idle.crossFadeTo(wave.reset().play(), 0.25, false);
      startLoop(); // le coucou se joue même si l'animation était en pause
    },
    firstFrame,
    debug: { scene, camera, renderer, box, hitBox },
    dispose() {
      stopLoop();
      mixer.stopAllAction();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
      ramp.dispose();
      renderer.dispose();
    },
  };
}


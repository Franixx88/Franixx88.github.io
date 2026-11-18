import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createKing } from "./king.js";

const ICE = new THREE.Color("#8af5ff");
const VIOLET = new THREE.Color("#b18cff");
const EMBER = new THREE.Color("#ff7ad9");
const VOID = new THREE.Color("#02030a");

const CHAIN_TOP = 14;
const CHAIN_END = -56;
const PITCH = 1.02;

// A chain link: a stadium (two half circles joined by straight lines).
class LinkCurve extends THREE.Curve {
  constructor(r = 0.38, half = 0.25) { super(); this.r = r; this.half = half; }
  getPoint(t, out = new THREE.Vector3()) {
    const { r, half } = this, straight = 2 * half, arc = Math.PI * r;
    const total = 2 * straight + 2 * arc;
    let d = t * total;
    if (d < straight) return out.set(r, -half + d, 0);
    d -= straight;
    if (d < arc) { const a = d / r; return out.set(r * Math.cos(a), half + r * Math.sin(a), 0); }
    d -= arc;
    if (d < straight) return out.set(-r, half - d, 0);
    d -= straight;
    const a = Math.PI + d / r;
    return out.set(r * Math.cos(a), -half + r * Math.sin(a), 0);
  }
}

function glowTexture(inner = "rgba(255,255,255,1)", mid = "rgba(138,245,255,.35)") {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner); grd.addColorStop(0.18, mid); grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Chain material: dark metal with energy pulses running down the links.
function chainMaterial(envMap, count, strength = 1) {
  const m = new THREE.MeshStandardMaterial({ color: 0x2b3358, metalness: 0.92, roughness: 0.3, envMap, envMapIntensity: 0.38 });
  m.userData.uniforms = { uTime: { value: 0 }, uFocus: { value: 0 }, uCount: { value: count }, uStrength: { value: strength }, uFocusAmt: { value: 1 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aIdx;\nvarying float vIdx;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvIdx = aIdx;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime, uFocus, uCount, uStrength, uFocusAmt;\nvarying float vIdx;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float ph = fract(vIdx / 22.0 - uTime * 0.16);
        float pulse = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.3, ph));
        float focus = exp(-pow((vIdx - uFocus) / 4.0, 2.0)) * uFocusAmt;
        vec3 glow = mix(vec3(0.54, 0.96, 1.0), vec3(0.69, 0.55, 1.0), clamp(vIdx / uCount, 0.0, 1.0));
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
        totalEmissiveRadiance += glow * uStrength * (rim * (0.3 + focus * 0.9 + pulse * 2.2) + pulse * 0.2 + focus * 0.03);`);
  };
  return m;
}

function buildChain(curve, geo, mat, twist = 0.03) {
  const len = curve.getLength();
  const count = Math.floor(len / PITCH);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const idx = new Float32Array(count);
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), qs = new THREE.Quaternion(), m = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const u = (i * PITCH) / len;
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    q.setFromUnitVectors(up, tan);
    qs.setFromAxisAngle(up, (i % 2) * Math.PI / 2 + i * twist);
    q.multiply(qs);
    m.compose(p, q, one);
    mesh.setMatrixAt(i, m);
    idx[i] = i;
  }
  geo = mesh.geometry;
  mesh.geometry = geo.clone();
  mesh.geometry.setAttribute("aIdx", new THREE.InstancedBufferAttribute(idx, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, count, len };
}

function buildParticles(n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n), col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = 2 + Math.pow(Math.random(), 0.7) * 34, a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, -80 + Math.random() * 100, Math.sin(a) * r], i * 3);
    size[i] = 0.4 + Math.pow(Math.random(), 3) * 2.6;
    seed[i] = Math.random();
    const k = Math.random();
    c.copy(k < 0.55 ? ICE : k < 0.93 ? VIOLET : EMBER);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize, aSeed; attribute vec3 aColor;
      uniform float uTime, uPR; varying vec3 vColor; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + 80.0 + uTime * (0.15 + aSeed * 0.45), 100.0) - 80.0;
        p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.7;
        p.z += cos(uTime * 0.23 + aSeed * 17.0) * 0.7;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPR * (70.0 / -mv.z);
        float fade = clamp(1.0 - (-mv.z) / 55.0, 0.0, 1.0) * smoothstep(0.5, 3.0, -mv.z);
        vA = (0.5 + 0.5 * sin(uTime * 1.7 + aSeed * 50.0)) * fade;
        vColor = aColor;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d); a *= a;
        gl_FragColor = vec4(vColor, a * vA);
      }`,
  });
  return new THREE.Points(geo, mat);
}

// Giant segmented rings the chain passes through — gates you descend past.
function buildGate(radius, y, color, segs = 3) {
  const g = new THREE.Group();
  g.position.y = y;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const faint = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
  const arc = (Math.PI * 2) / segs * 0.62;
  for (let i = 0; i < segs; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 6, 120, arc), mat);
    m.rotation.z = (i / segs) * Math.PI * 2;
    g.add(m);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.04, 0.025, 4, 200), faint);
  g.add(ring);
  // tick marks
  const ticks = new THREE.Group();
  const tickGeo = new THREE.BoxGeometry(0.05, 0.9, 0.05);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, t = new THREE.Mesh(tickGeo, faint);
    t.position.set(Math.cos(a) * radius * 0.96, Math.sin(a) * radius * 0.96, 0);
    t.rotation.z = a + Math.PI / 2;
    if (i % 4 === 0) t.scale.y = 2.2;
    ticks.add(t);
  }
  g.add(ticks);
  g.rotation.x = Math.PI / 2;
  g.userData = { ticks };
  return g;
}

function buildMonoliths(n, envMap) {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(box);
  const mat = new THREE.MeshStandardMaterial({ color: 0x07091a, metalness: 0.7, roughness: 0.35, envMap, envMapIntensity: 0.4 });
  const line = new THREE.LineBasicMaterial({ color: ICE, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, r = 19 + Math.random() * 16;
    const h = 7 + Math.random() * 16, w = 0.8 + Math.random() * 1.6;
    const m = new THREE.Group();
    const body = new THREE.Mesh(box, mat); body.scale.set(w, h, w * 0.6);
    const e = new THREE.LineSegments(edges, line); e.scale.copy(body.scale);
    m.add(body, e);
    m.position.set(Math.cos(a) * r, -70 + Math.random() * 80, Math.sin(a) * r);
    m.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
    m.userData = { y: m.position.y, s: Math.random() * 10 };
    group.add(m);
  }
  return group;
}

export function createScene(canvas, { lite = false, reduced = false, snap = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: "high-performance", alpha: false });
  const pr = Math.min(devicePixelRatio || 1, lite ? 1.3 : 1.8);
  renderer.setPixelRatio(pr);
  renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(VOID);

  const scene = new THREE.Scene();
  scene.background = VOID;
  scene.fog = new THREE.FogExp2(VOID, lite ? 0.03 : 0.027);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);

  // lights
  scene.add(new THREE.AmbientLight(0x3a4690, 0.5));
  const key = new THREE.DirectionalLight(0xbfe9ff, 1.4); key.position.set(-8, 20, 10); scene.add(key);
  const camLight = new THREE.PointLight(VIOLET, 40, 22, 1.6); scene.add(camLight);
  const coreLight = new THREE.PointLight(ICE, 14, 18, 1.6); coreLight.position.set(2, CHAIN_END - 1, 4); scene.add(coreLight);

  // the hanging rig (main chain + king) sways around its top anchor
  const rig = new THREE.Group();
  rig.position.y = CHAIN_TOP; scene.add(rig);
  const local = (y) => y - CHAIN_TOP;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, local(CHAIN_TOP + 6), 0),
    new THREE.Vector3(0.5, local(-2), -0.4),
    new THREE.Vector3(-0.7, local(-18), 0.5),
    new THREE.Vector3(0.6, local(-34), -0.3),
    new THREE.Vector3(-0.2, local(-48), 0.2),
    new THREE.Vector3(0, local(CHAIN_END), 0),
  ], false, "centripetal");
  const linkGeo = new THREE.TubeGeometry(new LinkCurve(), lite ? 40 : 72, 0.11, lite ? 8 : 12, true);
  const chainMat = chainMaterial(envMap, 1);
  const main = buildChain(curve, linkGeo, chainMat);
  chainMat.userData.uniforms.uCount.value = main.count;
  rig.add(main.mesh);
  const chainEndLocal = curve.getPointAt(Math.min(1, ((main.count - 1) * PITCH + 0.5) / main.len));

  const king = createKing({ lite, envMap });
  king.group.position.copy(chainEndLocal).add(new THREE.Vector3(0, -king.height - 0.05, 0));
  rig.add(king.group);

  // distant chains hanging in the void
  const farMat = chainMaterial(envMap, 120, 0.55);
  const farChains = [];
  const farSpots = [[-22, -30], [26, -24], [-34, 8], [18, 30], [36, -2], [-12, 34]];
  for (const [x, z] of farSpots) {
    const top = 40, bottom = -100 + Math.random() * 30;
    const c = new THREE.LineCurve3(new THREE.Vector3(x, top, z), new THREE.Vector3(x + (Math.random() - .5) * 3, bottom, z));
    const fc = buildChain(c, linkGeo, farMat, 0.0);
    fc.mesh.scale.setScalar(1.6 + Math.random());
    fc.mesh.position.set(x * -(fc.mesh.scale.x - 1), 0, z * -(fc.mesh.scale.x - 1));
    scene.add(fc.mesh); farChains.push(fc.mesh);
  }

  // gates
  const gates = [buildGate(13, -6, ICE, 3), buildGate(17, -26, VIOLET, 4), buildGate(15, -44, ICE, 5)];
  gates.forEach((g, i) => { g.rotation.y = i * 0.3; g.rotation.x = Math.PI / 2 + (i - 1) * 0.12; scene.add(g); });

  const monoliths = buildMonoliths(lite ? 7 : 12, envMap);
  scene.add(monoliths);

  const particles = buildParticles(lite ? 900 : 3200);
  particles.material.uniforms.uPR.value = pr;
  scene.add(particles);

  // light far below and the glow above the anchor
  const abyssGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(220,200,255,.9)", "rgba(177,140,255,.25)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  abyssGlow.position.set(0, -120, 0); abyssGlow.scale.setScalar(140); scene.add(abyssGlow);
  const topGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(230,255,255,.8)", "rgba(138,245,255,.2)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.6 }));
  topGlow.position.set(0, 60, 0); topGlow.scale.setScalar(90); scene.add(topGlow);
  const kingHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(200,250,255,.55)", "rgba(138,245,255,.12)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  kingHalo.scale.setScalar(9); kingHalo.material.opacity = 0.22; kingHalo.position.copy(king.group.position).add(new THREE.Vector3(0, king.height * 0.5, 0));
  rig.add(kingHalo);

  // post
  let composer = null, bloom = null;
  if (!lite) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.28);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 62 : 48;
    camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
  }
  resize();

  // camera state
  const pointer = new THREE.Vector2(), pSmooth = new THREE.Vector2();
  let p = 0, side = 0, kingSpin = 0, kingVel = 0, firstFrame = true;
  const tmp = new THREE.Vector3(), target = new THREE.Vector3(), camPos = new THREE.Vector3();
  const kingCenter = new THREE.Vector3(), right = new THREE.Vector3();
  const smoothTarget = new THREE.Vector3(), smoothPos = new THREE.Vector3();

  function chainWorld(u, out) { return rig.localToWorld(out.copy(curve.getPointAt(THREE.MathUtils.clamp(u, 0, 1)))); }

  function update(progress, t, dt, sideTarget = 0) {
    const instant = reduced || snap || firstFrame;
    const k = instant ? 1 : 1 - Math.exp(-dt * 2.6);
    p += (progress - p) * k;
    side += (sideTarget - side) * (instant ? 1 : 1 - Math.exp(-dt * 2));
    pSmooth.lerp(pointer, reduced ? 1 : 1 - Math.exp(-dt * 3));

    // sway
    rig.rotation.z = Math.sin(t * 0.35) * 0.012;
    rig.rotation.x = Math.cos(t * 0.27) * 0.008;
    rig.updateMatrixWorld();

    // where along the chain we are looking
    const ease = THREE.MathUtils.smoothstep(p, 0.82, 1.0);
    const u = THREE.MathUtils.lerp(0.13, 0.99, Math.min(1, p / 0.92));
    chainWorld(u, target);
    king.group.getWorldPosition(kingCenter); kingCenter.y += king.height * 0.52;
    target.lerp(kingCenter, ease);
    target.y -= ease * (camera.aspect > 1 ? 2.0 : 3.8);

    const intro = 1 - THREE.MathUtils.smoothstep(p, 0.0, 0.16);
    const radius = THREE.MathUtils.lerp(9.5, camera.aspect > 1 ? 10 : 12, ease) + intro * 5;
    const angle = -0.5 + p * 2.6 + pSmooth.x * 0.18;
    const height = THREE.MathUtils.lerp(3.2, 0.8, ease) + intro * 3.5 - pSmooth.y * 0.6;
    camPos.set(target.x + Math.sin(angle) * radius, target.y + height, target.z + Math.cos(angle) * radius);
    if (instant) { smoothPos.copy(camPos); smoothTarget.copy(target); }
    smoothPos.lerp(camPos, reduced ? 1 : 1 - Math.exp(-dt * 4));
    smoothTarget.lerp(target, reduced ? 1 : 1 - Math.exp(-dt * 4));
    camera.position.copy(smoothPos);
    // shift the chain to the side opposite the text panel
    right.subVectors(smoothTarget, smoothPos).cross(camera.up).normalize();
    const shift = side * radius * 0.32 * (camera.aspect > 1 ? 1 : 0);
    tmp.copy(smoothTarget).addScaledVector(right, -shift);
    camera.lookAt(tmp);
    camLight.position.copy(camera.position).add(tmp.set(0, 2, 0));

    // chain glow focus
    const U = chainMat.userData.uniforms;
    U.uTime.value = t; U.uFocus.value = u * main.count; U.uFocusAmt.value = 1 - intro * 0.85;
    farMat.userData.uniforms.uTime.value = t * 0.7;

    // king
    kingVel += kingSpin; kingSpin = 0;
    kingVel *= Math.pow(0.04, dt);
    king.update(t, dt, kingVel + (reduced ? 0 : 0.25) * dt, pSmooth);

    gates.forEach((g, i) => { g.rotation.z = t * (0.03 + i * 0.015) * (i % 2 ? -1 : 1); g.userData.ticks.rotation.z = -t * 0.05; });
    monoliths.children.forEach((m) => { m.position.y = m.userData.y + Math.sin(t * 0.2 + m.userData.s) * 0.8; m.rotation.y += dt * 0.02; });
    particles.material.uniforms.uTime.value = t;
    coreLight.intensity = 14 + Math.sin(t * 2) * 4;

    if (composer) composer.render(); else renderer.render(scene, camera);
    firstFrame = false;
  }

  return {
    ok: true, lite, reduced,
    update, resize,
    setPointer(x, y) { pointer.set(x, y); },
    spinKing(d) { kingSpin += d; },
  };
}

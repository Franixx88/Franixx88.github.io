import * as THREE from "three";

// A crystal chess king hanging from the end of the chain.
// Returns { group, height, update(t, dt, spin, pointer) }.
export function createKing({ lite = false, envMap = null } = {}) {
  const group = new THREE.Group();   // hangs, sways with the rig
  const body = new THREE.Group();    // spins
  group.add(body);

  const profile = [
    [0.0, 0.0], [1.25, 0.0], [1.32, 0.1], [1.22, 0.22], [1.26, 0.34], [1.02, 0.46],
    [0.78, 0.58], [0.6, 0.78], [0.5, 1.2], [0.44, 1.7], [0.42, 2.0], [0.64, 2.08],
    [0.7, 2.18], [0.5, 2.27], [0.54, 2.42], [0.78, 2.86], [0.84, 3.0], [0.7, 3.08], [0.0, 3.12],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const lathe = new THREE.LatheGeometry(profile, lite ? 32 : 64);
  lathe.computeVertexNormals();

  const crystal = lite
    ? new THREE.MeshStandardMaterial({ color: 0x3fa9ff, emissive: 0x4a2fc0, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.05,
        transparent: true, opacity: 0.55, envMap, envMapIntensity: 1.1, side: THREE.DoubleSide, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: 0xd6fbff, metalness: 0, roughness: 0.06, transmission: 1, thickness: 1.6, ior: 1.75,
        iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [200, 900], clearcoat: 1, clearcoatRoughness: 0.05,
        attenuationColor: new THREE.Color("#9a7cff"), attenuationDistance: 1.3, envMap, envMapIntensity: 0.75,
        emissive: new THREE.Color("#0c1636"), emissiveIntensity: 0.25 });

  const shell = new THREE.Mesh(lathe, crystal);
  body.add(shell);

  // cross on top
  const crossMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.8, 2.0) });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.74, 0.2), crossMat); v.position.y = 3.45;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.2), crossMat); h.position.y = 3.52;
  body.add(v, h);

  // glowing wireframe rings
  const lineMat = new THREE.LineBasicMaterial({ color: "#8af5ff", transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(lathe, 18), lineMat));

  // the heart inside
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.9, 2.4) });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), coreMat);
  core.position.y = 1.55; body.add(core);
  const core2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: "#b18cff", wireframe: true, transparent: true, opacity: 0.7 }));
  core2.position.copy(core.position); body.add(core2);

  // orbiting shards
  const shards = new THREE.Group();
  const shardGeo = new THREE.OctahedronGeometry(1, 0);
  const sMatA = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.5, 1.7) });
  const sMatB = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.7, 1.9) });
  const N = lite ? 10 : 18;
  for (let i = 0; i < N; i++) {
    const s = new THREE.Mesh(shardGeo, i % 2 ? sMatA : sMatB);
    const ring = i % 3;
    s.userData = { a: (i / N) * Math.PI * 2, r: 1.9 + ring * 0.45, y: 0.6 + ring * 1.0, sp: 0.35 + ring * 0.15, tilt: (ring - 1) * 0.35 };
    s.scale.set(0.035, 0.09, 0.035).multiplyScalar(1 + Math.random() * 0.8);
    shards.add(s);
  }
  group.add(shards);

  // levitation ring below
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.4, 1.6), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.025, 6, 120), ringMat);
  baseRing.rotation.x = Math.PI / 2; baseRing.position.y = -0.25; group.add(baseRing);
  const baseRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.015, 6, 120, Math.PI * 1.3), ringMat);
  baseRing2.rotation.x = Math.PI / 2; baseRing2.position.y = -0.45; group.add(baseRing2);

  const height = 3.82;

  function update(t, dt, spin, pointer) {
    body.rotation.y += spin;
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, pointer.y * 0.12, 0.05);
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -pointer.x * 0.08, 0.05);
    const beat = 1 + Math.pow(Math.max(0, Math.sin(t * 2.4)), 8) * 0.35;
    core.scale.setScalar(beat);
    core.rotation.y = t * 0.8; core2.rotation.y = -t * 0.5; core2.rotation.x = t * 0.3;
    for (const s of shards.children) {
      const d = s.userData, a = d.a + t * d.sp;
      s.position.set(Math.cos(a) * d.r, d.y + Math.sin(a * 2 + d.tilt * 5) * 0.25 + Math.sin(a) * d.tilt * 1.5, Math.sin(a) * d.r);
      s.rotation.set(t + d.a, t * 0.7, 0);
    }
    baseRing.rotation.z = t * 0.4; baseRing2.rotation.z = -t * 0.25;
  }

  return { group, height, update };
}

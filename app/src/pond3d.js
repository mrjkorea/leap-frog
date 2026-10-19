// Leap Frog 3D pond (three.js). Same scene idea as the original: camera behind the frog's home pad,
// three answer pads ahead (left / centre / right), sunset sky, reeds, piranhas, shore when land is near.
// Kenney Nature Kit models (CC0) for banks, plants, trees, rocks, deco lilies. Frog + pads are procedural.
import { THREE, createStage3D, loadModel, fit, shadowAll, glowTexture, createParticles3D, createTweens } from "./kit/three-stage.js";

const M = (n) => `./models/${n}.glb`;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });

// ---- water shader: layered sine normals, sun glint, ripple rings (8 slots), manual fog ----
const WATER_V = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_F = `
uniform float uT; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun; uniform vec3 uSunCol;
uniform vec4 uRip[8]; uniform vec3 uFog; uniform float uFogN; uniform float uFogF; uniform vec3 uCam; uniform float uHi;
varying vec3 vW;
float h(vec2 p){ return sin(p.x*1.3+uT*1.1)*.5 + sin(p.y*1.7-uT*1.3)*.5 + sin((p.x+p.y)*2.9+uT*1.9)*.25 + sin((p.x-p.y)*4.7-uT*2.3)*.12; }
void main(){
  vec2 p = vW.xz; float e = .05;
  float dx = h(p+vec2(e,0.))-h(p-vec2(e,0.)), dz = h(p+vec2(0.,e))-h(p-vec2(0.,e));
  vec3 n = normalize(vec3(-dx*.55, 1., -dz*.55));
  float ring = 0.;
  for(int i=0;i<8;i++){ vec4 r = uRip[i]; if(r.w<=0.) continue; float age = uT - r.z; if(age<0. || age>2.2) continue;
    float d = length(p - r.xy), R = age*1.9, k = exp(-pow((d-R)*3.2,2.)) * (1.-age/2.2) * r.w;
    vec2 dir = normalize(p - r.xy + 1e-4); n = normalize(n + vec3(dir.x,0.,dir.y)*k*1.6); ring += k; }
  vec3 V = normalize(uCam - vW);
  float fres = pow(1. - max(dot(n,V),0.), 3.);
  vec3 col = mix(uDeep, uShallow, .35 + .25*sin(p.x*.21)*sin(p.y*.17));
  col = mix(col, uSky, fres*.38);
  vec3 Hh = normalize(normalize(uSun) + V); float sp = pow(max(dot(n,Hh),0.), 180.) * 0.7 * uHi + pow(max(dot(n,Hh),0.), 40.)*.02;
  col += uSunCol * sp + vec3(.9,.97,1.)*ring*.22;
  float f = smoothstep(uFogN, uFogF, length(uCam - vW));
  gl_FragColor = vec4(mix(col, uFog, f), 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function padGeometry() { // original's notched lily shape, gently cupped
  const s = new THREE.Shape(), N = 48;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2, o = 1.08 - Math.exp(-Math.pow((a - 0.18) / 0.22, 2)) * 0.42, c = 1 + Math.sin(a * 7) * 0.022; const x = Math.cos(a) * o * c, y = Math.sin(a) * o * c; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.028, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.center();
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); p.setY(i, p.getY(i) + r * r * 0.05); }
  g.computeVertexNormals(); return g;
}
const PAD_G = padGeometry();
const PAD_TOP = std(0x46c85a, { roughness: 0.38 }), PAD_IN = std(0x1f7a32, { roughness: 0.62 }), VEIN = std(0x175f28, { roughness: 0.5 });
function makePad({ flower = false, glow = null } = {}) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(PAD_G, PAD_TOP.clone()); top.castShadow = true; top.receiveShadow = true;
  const inner = new THREE.Mesh(PAD_G, PAD_IN); inner.scale.set(0.62, 1, 0.55); inner.position.y = 0.014; inner.receiveShadow = true;
  g.add(top, inner);
  const v0 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.016, 0.82), VEIN); v0.position.set(0.08, 0.048, 0.02); g.add(v0);
  for (let d = 0; d < 5; d++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.42 + (d % 2) * 0.12), VEIN), x = -0.7 + d * 0.32; m.position.set(Math.sin(x) * 0.22, 0.046, Math.cos(x) * 0.12); m.rotation.y = x * 0.9; g.add(m); }
  const dew = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xc8fff8, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.8 })); dew.position.set(0.22, 0.07, -0.18); g.add(dew);
  if (flower) {
    const f = new THREE.Group();
    for (let d = 0; d < 8; d++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), std(d % 2 ? 0xff9cd4 : 0xff7fb0, { roughness: 0.32, emissive: 0x551133, emissiveIntensity: 0.16 })); m.scale.set(1.25, 0.32, 0.72); const a = (d / 8) * Math.PI * 2; m.position.set(Math.cos(a) * 0.09, 0.09, Math.sin(a) * 0.09); m.rotation.y = a; m.rotation.z = 0.18; f.add(m); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), std(0xfff0a8, { emissive: 0xaa7700, emissiveIntensity: 0.28 })); c.position.y = 0.11; f.add(c);
    f.position.set(-0.46, 0.02, 0.32); g.add(f); g.userData.flower = f;
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.12, 28), new THREE.MeshBasicMaterial({ color: 0x06363a, transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.03; g.add(shadow);
  if (glow) { const r = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.32, 48), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.06; g.add(r); g.userData.ring = r; }
  g.userData.top = top;
  return g;
}

// ---- procedural frog: glossy body, belly, big eyes w/ lids, cheeks, smile, legs that fold & extend ----
function makeFrog() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = new THREE.MeshPhysicalMaterial({ color: 0x5fd34a, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x3a9a34, roughness: 0.4, clearcoat: 0.4 });
  const belly = std(0xf3f7c8, { roughness: 0.55 });
  const trunk = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 20), skin); trunk.scale.set(1.05, 0.78, 1.12); trunk.position.y = 0.42; body.add(trunk);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), belly); bel.scale.set(0.9, 0.62, 0.9); bel.position.set(0, 0.34, 0.14); body.add(bel);
  for (const [x, z, r] of [[-0.24, -0.2, 0.07], [0.26, -0.1, 0.055], [0.05, -0.32, 0.05], [-0.1, 0.05, 0.045]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), dark); s.scale.y = 0.4; s.position.set(x, 0.79, z); body.add(s); }
  const head = new THREE.Group(); head.position.set(0, 0.62, 0.22); body.add(head);
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), belly); throat.scale.set(1.2, 0.6, 0.9); throat.position.set(0, -0.12, 0.26); head.add(throat); g.userData.throat = throat;
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * 0.25, 0.2, 0.12); head.add(e);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), skin); e.add(ball);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14), std(0xffffff, { roughness: 0.15 })); white.position.set(0, 0.03, 0.07); e.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), std(0x111111, { roughness: 0.1 })); pupil.position.set(0, 0.04, 0.17); e.add(pupil);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(0.03, 0.08, 0.23); e.add(hl);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin); lid.position.y = 0.02; lid.scale.y = 0.05; lid.rotation.x = 0.35; e.add(lid);
    eyes.push({ e, lid, pupil });
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), std(0xff8fa0, { roughness: 0.8 })); cheek.scale.set(1, 0.6, 0.4); cheek.position.set(sx * 0.33, -0.04, 0.36); head.add(cheek);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 24, Math.PI * 0.8), std(0x1d4a1a)); smile.rotation.set(0, 0, Math.PI + Math.PI * 0.1); smile.position.set(0, 0.0, 0.43); head.add(smile);
  const tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1, 10), std(0xff6f86, { roughness: 0.3, emissive: 0x88222a, emissiveIntensity: 0.3 })); tongue.geometry.translate(0, 0.5, 0); tongue.rotation.x = Math.PI / 2; tongue.position.set(0, -0.02, 0.4); tongue.scale.set(1, 0.001, 1); head.add(tongue);
  const legs = [];
  for (const sx of [-1, 1]) { // back legs: thigh + shin + webbed foot
    const hip = new THREE.Group(); hip.position.set(sx * 0.4, 0.28, -0.2); body.add(hip);
    const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin); thigh.scale.set(0.8, 0.7, 1.5); thigh.position.set(sx * 0.05, 0, 0.05); hip.add(thigh);
    const knee = new THREE.Group(); knee.position.set(sx * 0.08, -0.12, 0.3); hip.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), dark); shin.rotation.x = Math.PI / 2; shin.position.z = -0.2; knee.add(shin);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), dark); foot.scale.set(1, 0.25, 1.4); foot.position.set(sx * 0.03, -0.1, 0.02); knee.add(foot);
    legs.push({ hip, knee, sx });
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), skin); arm.position.set(sx * 0.3, 0.16, 0.42); arm.rotation.z = sx * 0.3; body.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), dark); hand.scale.set(1.2, 0.3, 1.2); hand.position.set(sx * 0.34, 0.02, 0.48); body.add(hand);
  }
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01;
  shadowAll(body, true, false);
  Object.assign(g.userData, { body, head, eyes, tongue, legs, blob, skin });
  return g;
}

export async function createPond3D(host, { quality } = {}) {
  const S3 = createStage3D(host, { quality, shadows: true, fov: 46, clear: 0x8fc7d8, bloom: { strength: 0.42, radius: 0.5, threshold: 0.86 } });
  const { scene, camera, renderer } = S3;
  const tw = createTweens(), glow = glowTexture();
  const FOG = new THREE.Color(0xa9d4d6);
  scene.fog = new THREE.Fog(FOG, 26, 62);

  // sky dome (sunset gradient like the original) + sun + soft clouds
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x3a7fc0) }, uMid: { value: new THREE.Color(0xf6c58a) }, uBot: { value: new THREE.Color(0xa9d4d6) } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: "varying vec3 vP; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; void main(){ float h = normalize(vP).y; vec3 c = h>0.06 ? mix(uMid,uTop,smoothstep(.06,.55,h)) : mix(uBot,uMid,smoothstep(-.1,.06,h)); gl_FragColor = vec4(c,1.); }" }));
  scene.add(sky);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe2a0, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); sun.scale.setScalar(26); scene.add(sun);
  const clouds = [];
  for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random(), 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff1de, roughness: 1, transparent: true, opacity: 0.55, fog: false })); c.scale.set(3.2, 0.55, 1.4); c.position.set((i - 3) * 11, 14 + (i % 2) * 2, -60 - (i % 3) * 6); scene.add(c); clouds.push(c); }

  // lights
  const hemi = new THREE.HemisphereLight(0xfff0d8, 0x2a6a58, 1.15); scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xffe6c0, 2.4); sunL.castShadow = true; sunL.shadow.mapSize.set(1024, 1024);
  Object.assign(sunL.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sunL.shadow.bias = -0.0008; sunL.shadow.normalBias = 0.02;
  scene.add(sunL, sunL.target);
  const fill = new THREE.DirectionalLight(0x9fd8ff, 0.5); fill.position.set(5, 3, 6); scene.add(fill);

  // water
  const rip = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)); let ripI = 0;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 160, 1, 1), new THREE.ShaderMaterial({ vertexShader: WATER_V, fragmentShader: WATER_F, fog: false,
    uniforms: { uT: { value: 0 }, uDeep: { value: new THREE.Color(0x0a4a66) }, uShallow: { value: new THREE.Color(0x1f8290) }, uSky: { value: new THREE.Color(0xbfe6f0) }, uSun: { value: new THREE.Vector3(-6, 10, -14) }, uSunCol: { value: new THREE.Color(0xfff0c8) }, uRip: { value: rip }, uFog: { value: FOG }, uFogN: { value: 26 }, uFogF: { value: 62 }, uCam: { value: new THREE.Vector3() }, uHi: { value: 1 } } }));
  water.rotation.x = -Math.PI / 2; scene.add(water);
  function ripple(x, z, s = 1) { const r = rip[ripI++ % 8]; r.set(x, z, water.material.uniforms.uT.value, s); ringMesh(x, z, s); }
  const rings = [];
  function ringMesh(x, z, s) { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.4, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); scene.add(m); tw.add(1.3, (k) => { m.scale.setScalar(0.3 + k * 2.2 * s); m.material.opacity = 0.4 * (1 - k); }, { done: () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }); }

  // models
  const names = ["lily_large", "lily_small", "grass_leafsLarge", "grass_large", "plant_flatTall", "plant_bush", "plant_bushLarge", "rock_largeA", "rock_smallC", "stone_tallB", "log", "tree_oak", "tree_default", "tree_fat", "flower_redA", "flower_yellowA", "flower_purpleA", "mushroom_redGroup", "stump_round"];
  const MD = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await loadModel(M(n))])));
  const clone = (n, size) => { const m = MD[n]; return m ? shadowAll(fit(m.clone(true), size), true, true) : new THREE.Group(); };

  // banks: reeds, cattails, rocks, logs along both sides; recycled as the frog moves forward
  const bank = [];
  function cattail() { const g = new THREE.Group(), r = 1.5 + Math.random() * 1.8; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.038, r, 6), std(0x1d5a2a)); st.position.y = r / 2; const hd = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 8), std(0x6b3a18, { roughness: 0.9 })); hd.position.y = r; g.add(st, hd); g.rotation.z = (Math.random() - 0.5) * 0.22; return shadowAll(g); }
  const bankKinds = [["grass_leafsLarge", 1.8], ["plant_flatTall", 2.2], ["grass_large", 1.4], ["rock_largeA", 1.6], ["plant_bush", 1.3], ["log", 2.4], ["stone_tallB", 1.8], ["rock_smallC", 0.8]];
  for (let i = 0; i < 44; i++) {
    const side = i % 2 ? 1 : -1, [n, sz] = bankKinds[(i * 7 + (i >> 1)) % bankKinds.length];
    const o = i % 3 === 0 ? cattail() : clone(n, sz * (0.8 + Math.random() * 0.4));
    o.position.set(side * (6.4 + Math.random() * 2.2), n === "log" ? -0.15 : -0.05, -i * 1.25 + 8); o.rotation.y = Math.random() * 6;
    o.userData.span = 44 * 1.25; scene.add(o); bank.push(o);
  }
  // deco lily pads + flowers floating between lanes
  const deco = [];
  for (let i = 0; i < 18; i++) { const big = i % 3 !== 0, o = clone(big ? "lily_large" : "lily_small", big ? 1.1 : 0.7); o.position.set((Math.random() < 0.5 ? -1 : 1) * (3.4 + Math.random() * 2.4), 0.01, 8 - i * 3.1); o.rotation.y = Math.random() * 6; o.userData.phase = Math.random() * 6; o.userData.span = 18 * 3.1; scene.add(o); deco.push(o);
    if (i % 4 === 0) { const f = clone(["flower_redA", "flower_yellowA", "flower_purpleA"][i % 3], 0.45); f.position.set(0, 0.05, 0); o.add(f); } }

  // shore (appears when land is near): sand + grass berm, trees, bushes, flowers, mushrooms
  const shore = new THREE.Group(); shore.visible = false; scene.add(shore);
  { const cyl = new THREE.CylinderGeometry(1, 1, 0.5, 64);
    const sand = new THREE.Mesh(cyl, std(0xe6cf94, { roughness: 0.95 })); sand.scale.set(13, 1, 2.6); sand.position.set(0, 0.0, -1.7); sand.receiveShadow = true;
    const grass = new THREE.Mesh(cyl, std(0x5cb84a, { roughness: 0.9 })); grass.scale.set(14, 1.2, 4.2); grass.position.set(0, 0.22, -4.6); grass.receiveShadow = true; shore.add(sand, grass);
    [["tree_oak", 3.6, -3.2, -5], ["tree_default", 3.2, 3.6, -5.6], ["tree_fat", 2.8, -6.4, -4.2], ["tree_oak", 3.4, 6.8, -4.6], ["plant_bushLarge", 1.4, -1.8, -2.2], ["plant_bush", 1.1, 2.2, -2.0], ["mushroom_redGroup", 0.7, 1.1, -1.4], ["stump_round", 0.8, -4.2, -1.6], ["flower_redA", 0.5, -0.7, -1.2], ["flower_yellowA", 0.5, 0.6, -1.0], ["flower_purpleA", 0.5, -1.2, -0.9], ["rock_smallC", 0.7, 4.4, 0.4], ["rock_largeA", 1.2, -5.6, 0.6]]
      .forEach(([n, s, x, z]) => { const o = clone(n, s); o.position.set(x, 0.25 + (z < -1.8 ? 0.27 : 0), z - 1.2); o.rotation.y = Math.random() * 6; shore.add(o); }); }

  // fireflies + dragonfly
  const flies = []; for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff2a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.22); s.userData = { ph: Math.random() * 6, r: 2 + Math.random() * 5, h: 0.6 + Math.random() * 1.6 }; scene.add(s); flies.push(s); }
  const dragon = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.34, 4, 6), std(0x3ad0e0, { metalness: 0.4, roughness: 0.3, emissive: 0x115566, emissiveIntensity: 0.3 })); b.rotation.z = Math.PI / 2; dragon.add(b); const wm = new THREE.MeshStandardMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 0.1 }); dragon.userData.w = []; for (let k = 0; k < 4; k++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.08), wm); w.position.set(k % 2 ? -0.04 : 0.05, 0.02, (k < 2 ? 1 : -1) * 0.13); w.rotation.x = -Math.PI / 2; dragon.add(w); dragon.userData.w.push(w); } dragon.scale.setScalar(1.6); scene.add(dragon); }

  // piranha: textured card (original art), split jaw, leaps out of the water to chomp
  const pTex = await new Promise((r) => new THREE.TextureLoader().load("./textures/piranha.png", (t) => { t.colorSpace = THREE.SRGBColorSpace; r(t); }, undefined, () => r(null)));
  function card(u0, u1, v0, v1, w, h) { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: pTex, transparent: true, alphaTest: 0.12, side: THREE.DoubleSide, depthWrite: false })); }
  const fish = new THREE.Group(); { const W = 1.78, H = 1.42, cut = 0.46, top = card(0, 1, cut, 1, W, H * (1 - cut)); top.position.y = -H / 2 + cut * H + (H * (1 - cut)) / 2; const jaw = new THREE.Group(); jaw.position.y = -H / 2 + cut * H; const bot = card(0, 1, 0, cut, W, H * cut); bot.position.y = (-H * cut) / 2; jaw.add(bot); fish.add(top, jaw); fish.userData.jaw = jaw; fish.visible = false; fish.scale.setScalar(1.3); scene.add(fish); }
  // lurking fish shadows under the water (they get bolder when land is near, like the original's circling piranhas)
  const lurk = [0, 1, 2].map((i) => { const m = card(0, 1, 0, 1, 1.78, 1.42); m.material = m.material.clone(); m.material.opacity = 0.0; m.material.color.set(0x0a3036); m.rotation.x = -Math.PI / 2; m.position.y = -0.05; m.userData = { a: (i / 3) * Math.PI * 2, sp: 0.3 + Math.random() * 0.2 }; m.scale.setScalar(0.5); scene.add(m); return m; });

  const parts = createParticles3D(scene, { max: 900, texture: glow });
  const frog = makeFrog(); scene.add(frog, frog.userData.blob);

  const pads = [0, 1, 2].map(() => { const p = makePad({ glow: 0xfff59e }); scene.add(p); return p; });
  const home = makePad({ flower: true }); scene.add(home);
  const oldPads = [];

  // ---- layout / camera ----
  const V = { lane: 2.6, padScale: 1, gap: 3.6, homeZ: 0, camZ: 0, portrait: false, shake: 0, followX: 0 };
  function layout() {
    V.portrait = S3.w / S3.h < 0.82; V.lane = V.portrait ? 1.62 : 2.6; V.padScale = V.portrait ? 0.7 : 1; camera.fov = V.portrait ? 66 : S3.w / S3.h < 1.15 ? 52 : 44; camera.updateProjectionMatrix();
    parts.setScale(S3.h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
  }
  layout(); S3.onResize = () => { layout(); api.onResize && api.onResize(); };
  const lanes = () => [-V.lane, 0, V.lane];
  const v3 = new THREE.Vector3();
  function project(x, y, z) { v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * S3.w, y: (-v3.y * 0.5 + 0.5) * S3.h, behind: v3.z > 1 }; }
  let blinkT = 2, blink = 0;
  function draw(dt, st) {
    const t = S3.t; tw.update(dt);
    water.material.uniforms.uT.value = t; water.material.uniforms.uHi.value = S3.low ? 0.4 : 1;
    // camera eases after the home pad (smooth dolly forward + slight sway), shake on splashes/chomps
    V.camZ += (V.homeZ - V.camZ) * (1 - Math.exp(-3.2 * dt));
    const cz = V.camZ, P = V.portrait;
    camera.position.set(Math.sin(t * 0.35) * 0.18 + (Math.random() - 0.5) * V.shake, (P ? 7.6 : 4.9) + Math.sin(t * 0.5) * 0.06 + (Math.random() - 0.5) * V.shake, cz + (P ? 3.6 : 4.7));
    camera.lookAt(0, 0, cz - (P ? 2.4 : 2.1));
    V.shake *= Math.pow(0.004, dt); if (V.shake < 0.003) V.shake = 0;
    water.position.z = cz - 30; water.material.uniforms.uCam.value.copy(camera.position);
    sky.position.set(0, 0, cz); sun.position.set(-26, 22, cz - 70); water.material.uniforms.uSun.value.set(-0.35, 0.45, -1);
    sunL.position.set(-6, 12, cz + 3); sunL.target.position.set(0, 0, cz - 2);
    for (const c of clouds) { c.position.z = cz - 60 - (clouds.indexOf(c) % 3) * 6; c.position.x += dt * 0.25; if (c.position.x > 40) c.position.x = -40; }
    for (const o of bank) { if (o.position.z > cz + 9) o.position.z -= o.userData.span; }
    for (const o of deco) { if (o.position.z > cz + 9) o.position.z -= o.userData.span; o.position.y = 0.01 + Math.sin(t * 1.4 + o.userData.phase) * 0.015; o.rotation.y += dt * 0.03; }
    flies.forEach((s, i) => { const u = s.userData; s.position.set(Math.cos(t * 0.4 + u.ph) * u.r, u.h + Math.sin(t * 1.7 + u.ph) * 0.3, cz - 3 + Math.sin(t * 0.33 + u.ph * 2) * 4); s.material.opacity = 0.5 + 0.5 * Math.sin(t * 5 + i); });
    dragon.position.set(Math.sin(t * 0.37) * 4.5, 1.6 + Math.sin(t * 1.3) * 0.4, cz - 4 + Math.cos(t * 0.29) * 3); dragon.rotation.y = Math.atan2(Math.cos(t * 0.37), -Math.sin(t * 0.29)) ; dragon.userData.w.forEach((w, k) => (w.rotation.y = Math.sin(t * 60 + k) * 0.5));
    lurk.forEach((m) => { const u = m.userData; u.a += dt * u.sp; m.position.set(Math.cos(u.a) * 3.4, -0.08, cz - 3 + Math.sin(u.a) * 2.2); m.rotation.z = -u.a + Math.PI / 2; m.material.opacity += ((api.danger ? 0.28 : 0.1) - m.material.opacity) * dt * 2; });
    // frog idle: breathing throat, blinking, eyes follow the camera a little
    const F = frog.userData; F.throat.scale.set(1.2, 0.6 + Math.max(0, Math.sin(t * 2.6)) * 0.12, 0.9 + Math.max(0, Math.sin(t * 2.6)) * 0.12);
    blinkT -= dt; if (blinkT < 0) { blink = Math.min(1, blink + dt * 14); if (blink >= 1) blinkT = 2 + Math.random() * 3; } else blink = Math.max(0, blink - dt * 10);
    F.eyes.forEach((E) => { E.lid.scale.y = 0.05 + blink * 0.95; });
    F.blob.position.set(frog.position.x, 0.08 + Math.max(0, api.frogBase || 0), frog.position.z); const hgt = Math.max(0, frog.position.y - (api.frogBase || 0)); F.blob.scale.setScalar(Math.max(0.3, 1 - hgt * 0.25)); F.blob.material.opacity = frog.visible ? 0.28 * Math.max(0.2, 1 - hgt * 0.3) : 0; F.blob.visible = frog.visible && hgt > 0.05;
    pads.forEach((p, i) => { p.rotation.y = Math.sin(t * 0.6 + i) * 0.06; if (p.userData.ring) p.userData.ring.material.opacity = (p.userData.glowAmt || 0) * (0.6 + 0.4 * Math.sin(t * 8)); });
    if (home.userData.flower) home.userData.flower.rotation.y += dt * 0.3;
    parts.update(dt);
    api.onFrame && api.onFrame(dt, st);
  }

  // ---- effects ----
  const C = (h) => new THREE.Color(h);
  function splash(x, z, big = true) {
    parts.burst({ x, y: 0.15, z }, { n: big ? 70 : 30, colors: [C(0xe8fbff), C(0xbfefff), C(0xffffff)], speed: big ? 4.2 : 2.6, size: big ? 0.22 : 0.16, life: 1.0, grav: -11, up: big ? 4 : 2.4, spread: 0.6, drag: 0.985, low: S3.low });
    ripple(x, z, 1.3); setTimeout(() => ripple(x, z, 0.9), 220); V.shake = Math.max(V.shake, big ? 0.14 : 0.06);
  }
  function sparkle(x, y, z) { parts.burst({ x, y, z }, { n: 40, colors: [C(0xfff59e), C(0xffd23f), C(0x9effa0), C(0xffffff)], speed: 3.4, size: 0.2, life: 0.9, grav: -2.5, up: 2.5, low: S3.low }); }
  function confetti(x, y, z, n = 90) { parts.burst({ x, y, z }, { n, colors: [C(0xff5e7e), C(0xffd23f), C(0x3ec7ff), C(0x7cff6b), C(0xc58bff)], speed: 6, size: 0.24, life: 2, grav: -5, up: 5, drag: 0.97, low: S3.low }); }
  function trail(x, y, z) { if (!S3.low) parts.burst({ x, y, z }, { n: 1, color: 0xd8fff0, speed: 0.3, size: 0.14, life: 0.45, grav: 0 }); }

  const api = { stage: S3, scene, camera, frog, pads, home, oldPads, lanes, V, project, layout, ripple, splash, sparkle, confetti, trail, tw, fish, shore, makePad, danger: false, frogBase: 0,
    shake: (a) => (V.shake = Math.max(V.shake, a)), get low() { return S3.low; }, onFrame: null, onResize: null,
    run() { let last = performance.now(); const loop = (now) => { const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; S3.step(dt, draw); requestAnimationFrame(loop); }; requestAnimationFrame(loop); } };
  return api;
}

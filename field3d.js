// The home page's field in real 3D (Three.js): grass, or winter snow, with the cards standing in it.
// index.html mounts it in the field box (see _mount3d); the 2D canvas field stays as the fallback when WebGL isn't there.
// Season colours, the sky and the cards all come from index.html, so both versions always match.
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const hsl = (h, s, l) => new THREE.Color().setHSL((((h % 360) + 360) % 360) / 360, Math.min(1, Math.max(0, s / 100)), Math.min(1, Math.max(0, l / 100)));
const cover = (x, img, X, Y, W, H) => { const k = Math.max(W / img.width, H / img.height), w = img.width * k, h = img.height * k; x.drawImage(img, X + (W - w) / 2, Y + (H - h) / 2, w, h); };
const urlOf = (bg) => { const m = /url\(['"]?([^'")]+)/.exec(bg || ''); return m ? m[1] : null; };
const seeded = (seed) => { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// o: { cards: [{ bg, wide, ratio, text, sub, label }], sp: the season's _seasonParams, rm: reduced motion, seed,
//      getT(): the field box's offset below the top of the page sky, onOpen(i), onReady() }
export function createField(host, o) {
  const CARDS = o.cards, RM = !!o.rm, rand = seeded(o.seed || 20251108);
  let sp = o.sp, dead = false, raf = 0;
  THREE.ColorManagement.enabled = false; // plain sRGB everywhere, like the 2D canvases
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); // throws without WebGL: the caller falls back to 2D
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  let W = host.clientWidth || 1, H = host.clientHeight || 1;
  const SMALL = W < 720;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, SMALL ? 1.5 : 1.75)); renderer.setSize(W, H, false);
  const cv = renderer.domElement; cv.setAttribute('aria-hidden', 'true'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;z-index:0';
  const ui = document.createElement('div'); ui.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3';
  // the hovered card's label, styled like the 2D card caption
  const cap = document.createElement('span'); cap.setAttribute('aria-hidden', 'true');
  cap.style.cssText = "position:absolute;left:0;top:0;max-width:min(210px,70vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box;padding:7px 14px;border-radius:999px;background:rgba(22,21,15,0.92);box-shadow:0 0 0 1px rgba(242,239,228,0.14),0 10px 24px -10px rgba(0,0,0,0.7);font-family:'Newsreader',Georgia,serif;font-style:italic;font-size:clamp(14px,3.8vw,17px);color:#F2EFE4;opacity:0;transition:opacity 0.3s ease;will-change:transform;pointer-events:none";
  ui.appendChild(cap); host.appendChild(cv); host.appendChild(ui);

  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 900), CAM = new THREE.Vector3(0, 2, 8);
  // the horizon sits 20% down the box, where the 2D field puts it, so the page's sky meets the field on the same line
  camera.position.copy(CAM); camera.rotation.x = -Math.atan(0.6 * Math.tan(THREE.MathUtils.degToRad(19)));
  const fog = new THREE.FogExp2('#000', 0.022); scene.fog = fog;

  // ── sky: the page's own sky (the same gradient and sun glow as index.html's skyRef fit), painted for this box into a texture.
  // It isn't drawn (the page sky shows through above the horizon); it's the fog colour, so far-off grass melts into the exact sky behind it.
  const sunDir = new THREE.Vector3(), skyCv = document.createElement('canvas'), skyTex = new THREE.CanvasTexture(skyCv);
  const SKY = { value: skyTex }, RES = { value: new THREE.Vector2() }, PX = { value: renderer.getPixelRatio() }; renderer.getDrawingBufferSize(RES.value);
  const skyFog = (m) => { m.onBeforeCompile = (sh) => { sh.uniforms.uSky = SKY; sh.uniforms.uRes = RES;
    sh.fragmentShader = `uniform sampler2D uSky; uniform vec2 uRes;
` + sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth); gl_FragColor.rgb = mix(gl_FragColor.rgb, texture2D(uSky, gl_FragCoord.xy / uRes).rgb, fogF);
#endif`); }; return m; };
  const paintSky = () => {
    const K = sp.skyAll; if (!K || dead) return;
    const T = o.getT ? o.getT() : 0, yh = T + K.stops[0][0] * H;
    const line = [[0, K.zen[0]], [yh * 0.55, K.zen[1]], [yh, K.zen[2]], ...K.stops.slice(1).map(([p, c]) => [T + p * H, c])].concat(K.ground ? [[T + 0.45 * H, K.ground]] : []).map(([y, c]) => [y - T, c]);
    const k = 512 / W, ch = Math.max(2, Math.round(H * k));
    if (skyCv.width !== 512 || skyCv.height !== ch) { skyCv.width = 512; skyCv.height = ch; skyTex.dispose(); } // three.js can't resize a texture in place
    const x = skyCv.getContext('2d'), y0 = line[0][0], y1 = Math.max(H, line[line.length - 1][0]);
    const lg = x.createLinearGradient(0, y0 * k, 0, y1 * k); line.forEach(([y, c]) => lg.addColorStop(Math.max(0, Math.min(1, (y - y0) / (y1 - y0))), c)); x.fillStyle = lg; x.fillRect(0, 0, 512, ch);
    const sx = K.sun.x * W, sy = K.sun.y * H, rg = x.createRadialGradient(sx * k, sy * k, 0, sx * k, sy * k, K.sun.R * H * k);
    K.sun.stops.forEach(([f, c]) => rg.addColorStop(f, c)); x.fillStyle = rg; x.fillRect(0, 0, 512, ch); skyTex.needsUpdate = true;
    // the light comes from where the sun or moon is drawn; keep a little elevation so the field still reads lit at sunset
    camera.updateMatrixWorld(); sunDir.set(sx / W * 2 - 1, 1 - sy / H * 2, 0.5).unproject(camera).sub(camera.position).normalize();
    if (sunDir.y < 0.12) { sunDir.y = 0.12; sunDir.normalize(); }
  };

  // ── ground under the grass
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), skyFog(new THREE.MeshBasicMaterial({ color: '#000' })));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  // ── grass: one tapered, curved blade instanced tens of thousands of times. Wind, the parting around a lifting card,
  // root-to-tip shading, lusher/drier patches and the sun's rim light all happen in the shader.
  const SEG = 4, bp = [], bi = [];
  for (let i = 0; i < SEG; i++) { const y = i / SEG; bp.push(-0.5, y, 0, 0.5, y, 0); }
  bp.push(0, 1, 0);
  for (let i = 0; i < SEG - 1; i++) { const a = i * 2; bi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  bi.push((SEG - 1) * 2, (SEG - 1) * 2 + 1, SEG * 2);
  const N = SMALL ? 38000 : 95000, gg = new THREE.InstancedBufferGeometry();
  gg.setIndex(bi); gg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); gg.instanceCount = N;
  const aOff = new Float32Array(N * 3), aShape = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    // denser near the camera; the strip widens with distance to fill the view
    const z = 7.5 - 52 * Math.pow(rand(), 1.45), d = CAM.z - z + 1, x = (rand() - 0.5) * (4 + d * 1.45) * Math.max(1, (W / Math.max(1, H)) / 1.9);
    aOff.set([x, z, rand()], i * 3);
    aShape.set([0.45 + rand() * 0.55, 0.035 + rand() * 0.035, rand() * Math.PI * 2, (rand() - 0.3) * 0.35], i * 4);
  }
  gg.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 3)); gg.setAttribute('aShape', new THREE.InstancedBufferAttribute(aShape, 4));
  // where the cards stand (x, z, width, w: 0 = no card, else 1 + how far it's lifted), shared by the grass and the snow so both react to them
  const CARDU = { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) }; // w starts 0 (Vector4's default w is 1)
  const PARTS = 4;
  // how cards affect whatever stands on the ground around them (grass, flowers, the bare ground): one source, so they can't drift apart.
  // Needs uniforms uPart[PARTS] (lifting cards), uSh[16] (where cards stand) and uSun declared before it.
  const CARD_GLSL = `
    // things bend away from a lifting card (uPart: x, z, reach, strength). They swing about their root (a = height above it)
    // instead of sliding sideways, so blades keep their length rather than stretching.
    vec3 bendAway(vec3 w, float a, vec2 dir, float f){ float th = f * 1.15; w.xz += dir * a * sin(th); w.y -= a * (1.0 - cos(th)); return w; }
    vec3 cardPart(vec3 w, float a){
      for (int i = 0; i < ${PARTS}; i++) { vec4 P = uPart[i]; if (P.w < 0.001) continue; vec2 d = w.xz - P.xy;
        w = bendAway(w, a, normalize(vec2(d.x, d.y * 0.35) + vec2(0.0001)), P.w * (1.0 - smoothstep(0.5, 1.4, length(d / vec2(P.z, P.z * 0.5))))); }
      return w; }
    // each card darkens what's right at its foot and throws a soft shadow away from the sun; both fade while it's lifted out
    float cardShade(vec2 xz){ vec2 sd = -normalize(uSun.xz); float s = 1.0;
      for (int i = 0; i < 16; i++) { vec4 S = uSh[i]; if (S.w < 0.5) continue; vec2 r = xz - S.xy; if (abs(r.y) > 1.6) continue;
        float dx = max(abs(r.x) - S.z * 0.5, 0.0), ao = exp(-(dx * dx + r.y * r.y) / 0.07); vec2 q = (xz - (S.xy + sd * 0.65)) / vec2(S.z * 0.7, 0.75);
        s *= 1.0 - (0.38 * ao + 0.28 * (1.0 - smoothstep(0.15, 1.05, length(q)))) * (1.0 - clamp(S.w - 1.0, 0.0, 1.0)); }
      return s; }
  `;
  const grassU = {
    uTime: { value: 0 }, uHm: { value: 1 }, uRoot: { value: new THREE.Color() }, uTip: { value: new THREE.Color() }, uDry: { value: new THREE.Color() }, uRim: { value: new THREE.Color() },
    uSun: { value: sunDir }, uCam: { value: camera.position }, uSky: SKY, uRes: RES, uFogD: { value: fog.density },
    uPart: { value: Array.from({ length: PARTS }, () => new THREE.Vector4(0, 0, 1, 0)) }, uSh: CARDU,
  };
  const grass = new THREE.Mesh(gg, new THREE.ShaderMaterial({
    uniforms: grassU, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aOff; attribute vec4 aShape; uniform float uTime, uHm; uniform vec3 uSun, uCam; uniform vec4 uPart[${PARTS}];
      uniform vec4 uSh[16]; varying float vH, vPatch, vRim, vDepth, vRnd, vShade, vSun, vSky;
      ${CARD_GLSL}
      void main(){
        float h = position.y, H = aShape.x * uHm * 0.44;
        vec3 p = vec3(position.x * aShape.y * (1.0 - h * 0.8), h * H, aShape.w * h * h * H);
        float c = cos(aShape.z), s = sin(aShape.z); p.xz = mat2(c, -s, s, c) * p.xz;
        vec3 w = vec3(aOff.x, 0.0, aOff.y) + p;
        // wind: a slow swell, a quicker flutter, and gusts that roll across the field
        vec2 q = aOff.xy; float t = uTime;
        float wind = 0.55 * sin(t * 1.1 + q.x * 0.22 + q.y * 0.17) + 0.25 * sin(t * 2.3 + q.x * 0.8 - q.y * 0.5 + aOff.z * 6.0) + 0.7 * pow(max(0.0, sin(t * 0.45 - q.x * 0.09 + q.y * 0.05)), 4.0);
        w.x += wind * 0.16 * h * h * H; w.z -= wind * 0.05 * h * h * H; w.y -= abs(wind) * 0.03 * h * h * H;
        w = cardPart(w, h * H); vShade = cardShade(w.xz);
        vH = h; vRnd = aOff.z;
        vPatch = 0.5 + 0.3 * sin(q.x * 0.21 + 1.3) * sin(q.y * 0.17 + 0.4) + 0.2 * sin(q.x * 0.57 - q.y * 0.43);
        // blade faces the sun with wrap lighting; tips catch a bright rim when backlit
        vec3 n = normalize(vec3(s, 0.45 + 0.2 * h, c));
        vec3 L = normalize(uSun), V = normalize(w - uCam);
        float wrap = dot(n, L) * 0.5 + 0.5;
        vSun = 0.35 + 0.65 * wrap * wrap;
        vSky = 0.55 + 0.45 * n.y;
        float back = pow(max(dot(V, L), 0.0), 6.0), face = abs(dot(vec2(s, c), normalize(L.xz + vec2(0.0001))));
        vRim = h * h * (0.85 * back + 0.3 * face);
        vec4 mv = modelViewMatrix * vec4(w, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uRoot, uTip, uDry, uRim; uniform float uFogD; uniform sampler2D uSky; uniform vec2 uRes;
      varying float vH, vPatch, vRim, vDepth, vRnd, vShade, vSun, vSky;
      void main(){
        vec3 tip = mix(uTip, uDry, smoothstep(0.35, 0.95, vPatch + (vRnd - 0.5) * 0.3));
        vec3 albedo = mix(uRoot, tip, smoothstep(0.05, 0.95, vH)) * (0.9 + 0.2 * vRnd);
        // sky fill + sun wrap + backlit rim; roots sit in soft AO
        vec3 c = albedo * (0.32 + 0.28 * vSky + 0.5 * vSun) + uRim * vRim * 0.55;
        c *= mix(0.7, 1.0, smoothstep(0.0, 0.38, vH));
        c *= vShade;
        float f = 1.0 - exp(-uFogD * uFogD * vDepth * vDepth); gl_FragColor = vec4(mix(c, texture2D(uSky, gl_FragCoord.xy / uRes).rgb, f), 1.0); }`,
  }));
  grass.frustumCulled = false; scene.add(grass);

  // ── flowers at the blade tips in the season's colours (the 2D field's sp.fl, as many as its sp.fd says); they sway with the grass. None in winter.
  const FN = SMALL ? 1600 : 4000, fG = new THREE.BufferGeometry(), fP = new Float32Array(FN * 3), fC = new Float32Array(FN * 3), fS = new Float32Array(FN);
  for (let i = 0; i < FN; i++) { const z = 7 - 40 * Math.pow(rand(), 1.3), d = CAM.z - z + 1; fP.set([(rand() - 0.5) * (4 + d * 1.45), 0.22 + rand() * 0.26, z], i * 3); fS[i] = 0.7 + rand() * 0.6; }
  fG.setAttribute('position', new THREE.BufferAttribute(fP, 3)); fG.setAttribute('aC', new THREE.BufferAttribute(fC, 3)); fG.setAttribute('aS', new THREE.BufferAttribute(fS, 1));
  const flowerU = { uTime: grassU.uTime, uHm: grassU.uHm, uPx: PX, uSky: SKY, uRes: RES, uFogD: grassU.uFogD, uPart: grassU.uPart, uSh: CARDU, uSun: grassU.uSun, uCam: grassU.uCam, uRoot: grassU.uRoot, uTip: grassU.uTip };
  // shared bend: tip gets full wind + card parting; used by the bloom and the stem so they stay attached
  const FLOWER_BEND = `vec3 bloomTip(vec3 raw){ float H = raw.y * uHm; vec3 p = vec3(raw.x, H, raw.z); vec2 q = p.xz; float t = uTime;
    float wind = 0.55 * sin(t * 1.1 + q.x * 0.22 + q.y * 0.17) + 0.7 * pow(max(0.0, sin(t * 0.45 - q.x * 0.09 + q.y * 0.05)), 4.0);
    p.x += wind * 0.05 * H; return cardPart(p, H); }`;
  const flowers = new THREE.Points(fG, new THREE.ShaderMaterial({ uniforms: flowerU,
    vertexShader: `attribute vec3 aC; attribute float aS; uniform float uTime, uHm, uPx; uniform vec4 uPart[${PARTS}]; uniform vec4 uSh[16]; uniform vec3 uSun, uCam; varying vec3 vC; varying float vDepth, vShade, vLit;
      ${CARD_GLSL}${FLOWER_BEND}
      void main(){ vec3 p = bloomTip(position); vShade = cardShade(p.xz);
        vec3 L = normalize(uSun), V = normalize(uCam - p);
        vLit = 0.55 + 0.45 * (dot(vec3(0.0, 1.0, 0.0), L) * 0.5 + 0.5) + 0.25 * pow(max(dot(V, L), 0.0), 4.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z; vC = aC; gl_PointSize = uPx * aS * 68.0 / vDepth; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uSky; uniform vec2 uRes; uniform float uFogD; varying vec3 vC; varying float vDepth, vShade, vLit;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0, a = atan(d.y, d.x);
        if (r > 0.62 + 0.38 * cos(5.0 * a)) discard; // five round petals
        vec3 c = (r < 0.26 ? vec3(0.95, 0.78, 0.32) : vC * (0.8 + 0.35 * (1.0 - r))) * vLit * vShade;
        float f = 1.0 - exp(-uFogD * uFogD * vDepth * vDepth); gl_FragColor = vec4(mix(c, texture2D(uSky, gl_FragCoord.xy / uRes).rgb, f), 1.0); }`,
  }));
  flowers.frustumCulled = false; scene.add(flowers);
  // camera-facing tapered quads bent with the bloom. Own copy of offsets — sharing fP with the Points attr broke instancing (divisor fight).
  const stemBase = new THREE.PlaneGeometry(1, 1, 2, 6);
  { const pos = stemBase.attributes.position; for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i), pos.getY(i) + 0.5, 0); }
  const stemOff = new Float32Array(fP); // clone so WebGL can bind this as instance divisor 1
  const stemGeo = new THREE.InstancedBufferGeometry();
  stemGeo.index = stemBase.index;
  stemGeo.setAttribute('position', stemBase.attributes.position);
  stemGeo.setAttribute('aUv', stemBase.attributes.uv);
  stemGeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(stemOff, 3));
  stemGeo.instanceCount = FN;
  const stems = new THREE.Mesh(stemGeo, new THREE.ShaderMaterial({
    uniforms: flowerU, side: THREE.DoubleSide, depthWrite: false, depthTest: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `attribute vec3 aOff; attribute vec2 aUv; uniform float uTime, uHm; uniform vec4 uPart[${PARTS}]; uniform vec4 uSh[16]; uniform vec3 uSun, uCam; varying float vDepth, vShade, vH, vAcross;
      ${CARD_GLSL}${FLOWER_BEND}
      void main(){
        float h = clamp(position.y, 0.0, 1.0);
        vec3 tip = bloomTip(aOff);
        vec3 root = vec3(aOff.x, 0.01, aOff.z);
        vec3 camXZ = vec3(uCam.x - tip.x, 0.0, uCam.z - tip.z);
        float cLen = length(camXZ); camXZ = cLen > 1e-4 ? camXZ / cLen : vec3(0.0, 0.0, 1.0);
        vec3 mid = mix(root, tip, 0.52) + camXZ * 0.028;
        mid.x += (tip.x - root.x) * 0.18; mid.z += (tip.z - root.z) * 0.18;
        float ih = 1.0 - h;
        vec3 p = ih * ih * root + 2.0 * ih * h * mid + h * h * tip;
        vec3 along = tip - root; float al = length(along);
        along = al > 1e-4 ? along / al : vec3(0.0, 1.0, 0.0);
        vec3 toCam = uCam - p; float tLen = length(toCam); toCam = tLen > 1e-4 ? toCam / tLen : vec3(0.0, 0.0, 1.0);
        vec3 side = cross(along, toCam); float sl = length(side);
        side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
        // readable near camera; tapers into the bloom
        float halfW = mix(0.016, 0.007, pow(h, 1.35));
        p += side * position.x * halfW * 2.0;
        p += toCam * 0.01;
        vH = h; vAcross = abs(aUv.x - 0.5) * 2.0; vShade = cardShade(p.xz);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uSky; uniform vec2 uRes; uniform float uFogD; uniform vec3 uSun, uRoot, uTip; varying float vDepth, vShade, vH, vAcross;
      void main(){
        float edge = smoothstep(1.0, 0.48, vAcross);
        if (edge < 0.05) discard;
        float lit = 0.88 + 0.32 * (normalize(uSun).y * 0.5 + 0.5);
        vec3 c = mix(uRoot, uTip, vH * 0.8) * lit * mix(0.9, 1.0, vShade) * (0.8 + 0.2 * edge);
        float f = 1.0 - exp(-uFogD * uFogD * vDepth * vDepth);
        gl_FragColor = vec4(mix(c, texture2D(uSky, gl_FragCoord.xy / uRes).rgb, f), 1.0); }`,
  }));
  stems.frustumCulled = false; stems.renderOrder = 1; scene.add(stems);
  // the bare ground between the blades darkens at a card's foot and in its shadow too, like the grass on it
  { const m = ground.material, prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev(sh, r); sh.uniforms.uSh = CARDU; sh.uniforms.uSun = { value: sunDir }; sh.uniforms.uPart = grassU.uPart;
    sh.vertexShader = 'varying vec2 vXZ;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = `uniform vec4 uPart[${PARTS}]; uniform vec4 uSh[16]; uniform vec3 uSun; varying vec2 vXZ;\n${CARD_GLSL}\n` + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= cardShade(vXZ);'); }; }

  // ── winter: hybrid — smooth shaded snow mesh (continuous surface) + soft powder Points that settle / part on hover
  const duneH = (x, z) => 0.5 * Math.sin(x * 0.11 + z * 0.09 + 0.7) + 0.32 * Math.sin(x * 0.19 - z * 0.13 + 2.0) + 0.24 * Math.sin(x * 0.31 + z * 0.17) + 0.13 * Math.sin(x * 0.47 - z * 0.31 + 1.2) + 0.07 * Math.sin(x * 0.93 + z * 0.71 + 2.1);
  // continuous pack: same dunes as duneH, card banks, soft uPart clear — denser mesh near cards/camera via the warped grid
  const snowGeo = new THREE.PlaneGeometry(1, 1, SMALL ? 150 : 260, SMALL ? 200 : 320); snowGeo.rotateX(-Math.PI / 2);
  { const P = snowGeo.attributes.position; for (let i = 0; i < P.count; i++) { const u = P.getX(i) * 2; P.setXYZ(i, u * 12 + u * u * u * 140, 0, 10 - 130 * Math.pow(0.5 - P.getZ(i), 1.7)); } snowGeo.computeBoundingSphere(); }
  const snowU = { uSun: { value: sunDir }, uCam: { value: camera.position }, uSky: SKY, uRes: RES, uFogD: grassU.uFogD, uTime: grassU.uTime, uSh: CARDU, uPart: grassU.uPart };
  const snow = new THREE.Mesh(snowGeo, new THREE.ShaderMaterial({ uniforms: snowU,
    vertexShader: `uniform vec4 uSh[16]; uniform vec4 uPart[${PARTS}]; varying vec3 vW, vN; varying float vDepth;
      float dune(vec2 p){ return 0.5 * sin(p.x * 0.11 + p.y * 0.09 + 0.7) + 0.32 * sin(p.x * 0.19 - p.y * 0.13 + 2.0) + 0.24 * sin(p.x * 0.31 + p.y * 0.17) + 0.13 * sin(p.x * 0.47 - p.y * 0.31 + 1.2) + 0.07 * sin(p.x * 0.93 + p.y * 0.71 + 2.1); }
      float h(vec2 p){ float y = dune(p);
        for (int i = 0; i < 16; i++) { vec4 S = uSh[i]; if (S.w < 0.5) continue; float dz = p.y - S.y; if (abs(dz) > 1.6) continue;
          float dx = max(abs(p.x - S.x) - S.z * 0.5, 0.0), d2 = dx * dx + dz * dz, lift = clamp(S.w - 1.0, 0.0, 1.0);
          y = mix(y, dune(S.xy), exp(-(dx * dx + dz * dz * 0.3) / 0.2));
          y += mix(0.055 * exp(-d2 / 0.035), -0.12 * exp(-d2 / 0.12), lift); }
        // soft clear — shallow bowl, wide falloff (no crater rim)
        for (int i = 0; i < ${PARTS}; i++) { vec4 P = uPart[i]; if (P.w < 0.001) continue; vec2 d = p - P.xy;
          float r = length(d / vec2(max(P.z, 0.15) * 1.25, max(P.z, 0.15) * 1.55));
          y -= P.w * 0.28 * pow(1.0 - smoothstep(0.0, 1.15, r), 1.6); }
        return y; }
      void main(){ vec2 p = position.xz; float e = 0.03; vec3 w = vec3(p.x, h(p), p.y);
        vN = normalize(vec3(h(p - vec2(e, 0.0)) - h(p + vec2(e, 0.0)), 2.0 * e, h(p - vec2(0.0, e)) - h(p + vec2(0.0, e))));
        vW = w; vec4 mv = modelViewMatrix * vec4(w, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uSun, uCam; uniform sampler2D uSky; uniform vec2 uRes; uniform float uFogD, uTime; uniform vec4 uSh[16]; varying vec3 vW, vN; varying float vDepth;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float near = smoothstep(9.0, 3.0, vDepth);
        float ph = vW.z * 12.0 + sin(vW.x * 1.7 + vW.z * 0.6) * 1.6, patchy = max(0.0, sin(vW.x * 0.55 + vW.z * 0.4) * 0.5 + 0.25);
        vec3 n = normalize(normalize(vN) + vec3(sin(vW.x * 6.0 + vW.z * 2.0) * 0.012, 0.0, cos(ph) * 0.035 * patchy) * near);
        vec3 L = normalize(uSun), V = normalize(uCam - vW);
        float wrap = dot(n, L) * 0.5 + 0.5, hemi = 0.56 + 0.44 * n.y;
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        // cooler hollows, warmer moonlit crests
        vec3 c = mix(vec3(0.72, 0.78, 0.90), vec3(0.92, 0.94, 0.99), hemi) * (0.42 + 0.58 * wrap);
        c += vec3(0.96, 0.97, 1.0) * wrap * wrap * 0.2;
        c += vec3(0.78, 0.84, 0.95) * fres * 0.12;
        c = mix(c * vec3(0.84, 0.88, 0.98), c, smoothstep(0.1, 0.7, wrap));
        vec2 sd = -normalize(L.xz + vec2(0.0001));
        for (int i = 0; i < 16; i++) { vec4 S = uSh[i]; if (S.w < 0.5) continue; float down = 1.0 - clamp(S.w - 1.0, 0.0, 1.0);
          vec2 r = vW.xz - S.xy; float dx = max(abs(r.x) - S.z * 0.5, 0.0); vec2 d = (vW.xz - (S.xy + sd * 0.6)) / vec2(S.z * 0.65, 0.9);
          // soft contact shadow — avoid black pits at the foot
          c *= 1.0 - (0.12 * exp(-(dx * dx + r.y * r.y) / 0.045) + 0.16 * (1.0 - smoothstep(0.15, 1.05, length(d)))) * down; }
        float g = hash(floor(vW.xz * 24.0));
        c += step(0.9988, g) * near * (0.3 + 0.35 * sin(uTime * 2.0 + g * 400.0)) * 0.4;
        float f = 1.0 - exp(-uFogD * uFogD * vDepth * vDepth); gl_FragColor = vec4(mix(c, texture2D(uSky, gl_FragCoord.xy / uRes).rgb, f), 1.0); }`,
  })); scene.add(snow);
  // powder layer on the pack: soft overlapping sprites; physics parts them on hover (mesh already digs a soft hollow)
  const snowRestY = (x, z) => {
    let y = duneH(x, z);
    for (let i = 0; i < 16; i++) {
      const S = CARDU.value[i]; if (S.w < 0.5) continue;
      const dz = z - S.y; if (Math.abs(dz) > 1.6) continue;
      const dx = Math.max(Math.abs(x - S.x) - S.z * 0.5, 0), d2 = dx * dx + dz * dz, lift = Math.max(0, Math.min(1, S.w - 1));
      y = y + (duneH(S.x, S.y) - y) * Math.exp(-(dx * dx + dz * dz * 0.3) / 0.2);
      y += (0.055 * Math.exp(-d2 / 0.035)) * (1 - lift) + (-0.12 * Math.exp(-d2 / 0.12)) * lift;
    }
    return y;
  };
  // powder lives in the snow mesh's local space (inherits snow.scale.x) so parting lines up with the pack
  const GN = SMALL ? 4500 : 9000, gP = new Float32Array(GN * 3), gV = new Float32Array(GN * 3), gHome = new Float32Array(GN * 2), gR = new Float32Array(GN * 2);
  for (let i = 0; i < GN; i++) {
    // blue-noise-ish: reject samples that land too close to a previous one in the near band
    let x, z, ok = false;
    for (let t = 0; t < 8 && !ok; t++) {
      z = 7.2 - 42 * Math.pow(rand(), 1.05); const d = CAM.z - z + 1;
      x = (rand() - 0.5) * (4.5 + d * 1.5);
      ok = true;
      if (z > 2) { for (let j = Math.max(0, i - 40); j < i; j++) { const dx = x - gHome[j * 2], dz = z - gHome[j * 2 + 1]; if (dx * dx + dz * dz < 0.012) { ok = false; break; } } }
    }
    const stack = 0.012 + rand() * 0.04; gHome.set([x, z], i * 2); gR.set([0.4 + rand() * 0.7, rand()], i * 2);
    gP.set([x, snowRestY(x, z) + stack, z], i * 3); gV.set([0, 0, 0], i * 3);
  }
  const snG = new THREE.BufferGeometry(); snG.setAttribute('position', new THREE.BufferAttribute(gP, 3)); snG.setAttribute('aR', new THREE.BufferAttribute(gR, 2));
  const powderU = { uSun: { value: sunDir }, uSky: SKY, uRes: RES, uFogD: grassU.uFogD, uPx: PX, uH: { value: H }, uSx: { value: 1 }, uSh: CARDU, uPart: grassU.uPart };
  const powder = new THREE.Points(snG, new THREE.ShaderMaterial({
    uniforms: powderU, transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending,
    vertexShader: `attribute vec2 aR; uniform float uPx, uH, uSx; uniform vec3 uSun; uniform vec4 uSh[16]; uniform vec4 uPart[${PARTS}]; varying float vA, vDepth; varying vec3 vC;
      void main(){ vec3 w = position; float clear = 1.0, sx = max(uSx, 0.001);
        for (int i = 0; i < ${PARTS}; i++) { vec4 P = uPart[i]; if (P.w < 0.001) continue; vec2 d = w.xz - vec2(P.x / sx, P.y);
          float r = length(d / vec2(max(P.z, 0.2) * 1.1 / sx, max(P.z, 0.2) * 1.4));
          clear *= 1.0 - P.w * 0.85 * (1.0 - smoothstep(0.2, 1.15, r)); }
        vec4 mv = modelViewMatrix * vec4(w, 1.0); float d = max(0.7, -mv.z); vDepth = d;
        float wrap = clamp(uSun.y * 0.5 + 0.58, 0.4, 1.0), shade = 1.0;
        vec2 sd = -normalize(uSun.xz + vec2(0.0001));
        for (int i = 0; i < 16; i++) { vec4 S = uSh[i]; if (S.w < 0.5) continue; float down = 1.0 - clamp(S.w - 1.0, 0.0, 1.0);
          vec2 r = w.xz - S.xy; float dx = max(abs(r.x) - S.z * 0.5, 0.0);
          shade *= 1.0 - 0.16 * exp(-(dx * dx + r.y * r.y) / 0.05) * down; }
        vC = mix(vec3(0.82, 0.87, 0.96), vec3(0.97, 0.98, 1.0), 0.35 + 0.65 * aR.y) * (wrap * shade);
        // small soft flakes near camera; denser screen coverage farther (reads as haze, not dots)
        float px = (0.018 + aR.x * 0.022) * uH / (0.689 * d) * mix(1.0, 1.55, smoothstep(6.0, 22.0, d));
        gl_PointSize = uPx * max(1.2, px);
        // mostly invisible at rest — reads during parting; mesh carries the surface
        vA = clear * smoothstep(40.0, 10.0, d) * (0.18 + 0.22 * aR.y) * mix(0.4, 0.85, smoothstep(5.0, 18.0, d));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA, vDepth; varying vec3 vC; uniform sampler2D uSky; uniform vec2 uRes; uniform float uFogD;
      void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
        float a = vA * (1.0 - smoothstep(0.15, 1.0, r)); a *= a; // softer falloff so edges don't speck
        if (a < 0.015) discard;
        float f = 1.0 - exp(-uFogD * uFogD * vDepth * vDepth);
        gl_FragColor = vec4(mix(vC, texture2D(uSky, gl_FragCoord.xy / uRes).rgb, f), a); }`,
  }));
  powder.frustumCulled = false; snow.add(powder); // same aspect stretch as the pack
  let snowCool = 0;
  const stepSnow = (dt) => {
    if (RM) {
      for (let i = 0; i < GN; i++) { const hx = gHome[i * 2], hz = gHome[i * 2 + 1], stack = 0.012 + gR[i * 2 + 1] * 0.04;
        gP[i * 3] = hx; gP[i * 3 + 1] = snowRestY(hx, hz) + stack; gP[i * 3 + 2] = hz; gV[i * 3] = gV[i * 3 + 1] = gV[i * 3 + 2] = 0; }
      snG.attributes.position.needsUpdate = true; return;
    }
    const parts = grassU.uPart.value, sx = Math.max(0.001, snow.scale.x);
    let parting = false; for (let p = 0; p < PARTS; p++) if (parts[p].w > 0.001) { parting = true; break; }
    if (parting) snowCool = 0.85; else snowCool = Math.max(0, snowCool - dt);
    if (!parting && snowCool <= 0) return;
    for (let i = 0; i < GN; i++) {
      const hx = gHome[i * 2], hz = gHome[i * 2 + 1], stack = 0.012 + gR[i * 2 + 1] * 0.04;
      let x = gP[i * 3], y = gP[i * 3 + 1], z = gP[i * 3 + 2];
      let vx = gV[i * 3], vy = gV[i * 3 + 1], vz = gV[i * 3 + 2];
      let ry = snowRestY(hx, hz) + stack, hold = 1;
      for (let p = 0; p < PARTS; p++) {
        const P = parts[p]; if (P.w < 0.001) continue;
        // uPart is world xz; powder is local under snow.scale.x
        const dx = x - P.x / sx, dz = z - P.y, rx = Math.max(P.z, 0.15) * 1.15 / sx, rz = Math.max(P.z, 0.15) * 1.45;
        const r = Math.hypot(dx / rx, dz / rz); if (r > 1.25) continue;
        const f = P.w * (1 - Math.min(1, r));
        const side = Math.abs(dx) > 1e-4 ? Math.sign(dx) : ((i & 1) ? 1 : -1);
        vx += side * f * 9 * dt; vz += (dz >= 0 ? 0.6 : -0.2) * f * 5 * dt; vy += f * 2.2 * dt;
        hold *= 1 - f * 0.75;
      }
      vx += (hx - x) * 4.5 * hold * dt; vz += (hz - z) * 4.5 * hold * dt; vy -= 8 * dt;
      vx *= Math.exp(-3.6 * dt); vy *= Math.exp(-2.4 * dt); vz *= Math.exp(-3.6 * dt);
      x += vx * dt; y += vy * dt; z += vz * dt;
      if (y < ry) { y = ry; vy = 0; }
      gP[i * 3] = x; gP[i * 3 + 1] = y; gP[i * 3 + 2] = z; gV[i * 3] = vx; gV[i * 3 + 1] = vy; gV[i * 3 + 2] = vz;
    }
    snG.attributes.position.needsUpdate = true;
  };
  // powder kicked up when a card rises out of the snow (always updated, so a puff can't freeze when the season changes)
  const PF = 400, pfG = new THREE.BufferGeometry(), pfP = new Float32Array(PF * 3), pfA = new Float32Array(PF), pfV = new Float32Array(PF * 3), pfT = new Float32Array(PF).fill(9), pfL = new Float32Array(PF).fill(1);
  pfG.setAttribute('position', new THREE.BufferAttribute(pfP, 3)); pfG.setAttribute('aA', new THREE.BufferAttribute(pfA, 1));
  const puffs = new THREE.Points(pfG, new THREE.ShaderMaterial({ uniforms: { uPx: PX }, transparent: true, depthWrite: false,
    vertexShader: 'attribute float aA; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx * 34.0 / -mv.z; vA = aA; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.96, 0.97, 1.0, vA * smoothstep(0.5, 0.1, d)); }' }));
  puffs.frustumCulled = false; scene.add(puffs);
  let pfNext = 0;
  // real 3D snowfall: every flake falls at its own speed, sways, and drifts downwind; near flakes are big, soft and faint (out of focus),
  // far ones small and sharp; cards hide the flakes behind them. Each flake wraps around within the slice of field the camera sees at its depth.
  const SN = SMALL ? 2500 : 6000, sfG = new THREE.BufferGeometry(), sfP = new Float32Array(SN * 3), sfR = new Float32Array(SN * 2);
  for (let i = 0; i < SN; i++) { const z = 7.2 - 36 * Math.pow(rand(), 1.15), hw = 1.5 + (CAM.z - z) * 0.75; sfP.set([(rand() * 2 - 1) * hw, rand() * 9, z], i * 3); sfR.set([rand(), rand()], i * 2); }
  sfG.setAttribute('position', new THREE.BufferAttribute(sfP, 3)); sfG.setAttribute('aR', new THREE.BufferAttribute(sfR, 2));
  const SFH = { value: H }, SFAsp = { value: Math.max(1, W / Math.max(1, H)) };
  const snowfall = new THREE.Points(sfG, new THREE.ShaderMaterial({ uniforms: { uTime: grassU.uTime, uPx: PX, uH: SFH, uAsp: SFAsp, uPart: grassU.uPart }, transparent: true, depthWrite: false, depthTest: true,
    vertexShader: `attribute vec2 aR; uniform float uTime, uPx, uH, uAsp; uniform vec4 uPart[${PARTS}]; varying float vA, vSoft;
      void main(){ vec3 p = position; float t = uTime, hw = (1.5 + (8.0 - position.z) * 0.75) * max(1.0, uAsp / 1.9);
        p.y = mod(p.y - t * (0.2 + aR.x * 0.22), 9.0) - 0.2;
        p.x += t * 0.14 + 0.45 * sin(t * 0.28 + p.z * 0.05) + 0.18 * sin(t * (0.35 + aR.y * 0.5) + aR.x * 30.0);
        p.x = mod(p.x + hw, 2.0 * hw) - hw;
        p.z += 0.1 * cos(t * (0.28 + aR.x * 0.4) + aR.y * 20.0);
        // clear flakes in a column around a lifting card — same parting look as the grass gap
        float clear = 1.0;
        for (int i = 0; i < ${PARTS}; i++) { vec4 P = uPart[i]; if (P.w < 0.001) continue; vec2 d = p.xz - P.xy;
          float r = length(d / vec2(max(P.z, 0.2) * 1.15, max(P.z, 0.2) * 1.5));
          clear *= 1.0 - P.w * (1.0 - smoothstep(0.25, 1.2, r)); }
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
        vSoft = clamp((3.5 - d) / 2.5, 0.0, 1.0);
        float px = (0.025 + aR.y * 0.03) * uH / (0.689 * d); // flake size in css px (0.689 = 2 tan 19deg)
        gl_PointSize = uPx * max(1.5, px * (1.0 + vSoft * 1.4));
        vA = (0.55 + 0.45 * aR.x) * (1.0 - vSoft * 0.75) * smoothstep(40.0, 18.0, d) * clear;
        gl_Position = projectionMatrix * mv;
        vA *= 1.0 - smoothstep(0.45, 0.95, gl_Position.y / gl_Position.w); // fade out toward the top of the field box, so the snowfall has no hard upper edge
      }`,
    fragmentShader: `varying float vA, vSoft;
      void main(){ float r = length(gl_PointCoord - 0.5) * 2.0, a = vA * (1.0 - smoothstep(mix(0.45, 0.0, vSoft), 1.0, r)); if (a < 0.01) discard; gl_FragColor = vec4(0.95, 0.97, 1.0, a); }` }));
  snowfall.frustumCulled = false; scene.add(snowfall); // before cards so opaque faces win depth; uPart clears flakes in front of a lift
  const puff = (x, y, z, w, k) => { for (let i = 0; i < 90 * k; i++) { const j = pfNext++ % PF, u = rand() * 2 - 1; pfP.set([x + u * w * 0.5, y, z + (rand() - 0.3) * 0.3], j * 3); pfV.set([u * (0.4 + rand() * 0.9), (0.9 + rand() * 2.2) * k, 0.3 + rand() * 0.6], j * 3); pfT[j] = 0; pfL[j] = 0.8 + rand() * 0.9; } };

  // ── cards: drawn like the 2D field's 260×340 panel, as a photo filling the card or a sheet-music title
  const ASPECT = 260 / 340, aniso = renderer.capabilities.getMaxAnisotropy();
  const cardTex = (d) => {
    const c = document.createElement('canvas'); c.width = 390; c.height = 510; const x = c.getContext('2d'), t = new THREE.CanvasTexture(c); t.anisotropy = aniso;
    const paint = (img) => {
      x.clearRect(0, 0, 390, 510); x.save(); x.beginPath(); x.roundRect(0, 0, 390, 510, 18); x.clip(); x.fillStyle = '#2A211A'; x.fillRect(0, 0, 390, 510);
      if (d.text) {
        x.strokeStyle = '#3A2E25'; x.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const y = 34 + i * 12; x.beginPath(); x.moveTo(30, y); x.lineTo(360, y); x.stroke(); }
        x.font = "51px 'Gambarino', Georgia, serif"; x.fillStyle = '#F2E7D7'; let line = '', y = 150; const words = String(d.text).split(' ');
        words.forEach((wd, i) => { const tryL = line ? line + ' ' + wd : wd; if (x.measureText(tryL).width > 330 && line) { x.fillText(line, 30, y); y += 49; line = wd; } else line = tryL; if (i === words.length - 1) { x.fillText(line, 30, y); x.fillStyle = '#9BB27A'; x.fillText('.', 30 + x.measureText(line).width, y); } });
        x.font = "italic 21px 'Newsreader', Georgia, serif"; x.fillStyle = '#A8957F'; x.fillText(d.sub || '', 30, 478);
      } else if (img) {
        cover(x, img, 0, 0, 390, 510); // in 3D the photo fills its card, wide ones too (no letterbox band)
      }
      x.restore(); t.needsUpdate = true;
    };
    paint(null);
    const u = urlOf(d.bg); if (u) { const img = new Image(); img.onload = () => !dead && paint(img); img.src = u; } // a photo that won't load stays a plain panel, like the 2D card
    else if (d.text && document.fonts) document.fonts.ready.then(() => !dead && paint(null));
    return t;
  };
  const cards = [], plane = new THREE.PlaneGeometry(1, 1);
  // each card is a flat rounded rectangle (ASPECT × 1 in card units, scaled by the card's height) with the photo on it
  const slab = (() => { const r = 0.045, w = ASPECT / 2, h = 0.5, sh = new THREE.Shape();
    sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r); sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h); sh.lineTo(-w + r, h); sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
    const g = new THREE.ShapeGeometry(sh, 6); g.addGroup(0, g.index.count, 0); // flat, like the 2D field's cards; one material group (a lone shape gets none, and the mesh would draw nothing)
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w) / ASPECT, uv.getY(i) + h); // the face's uv: 0..1 across the card
    return g; })();
  const TINT = { value: new THREE.Color(1, 1, 1) };
  const litFace = (m, c) => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev(sh, r); sh.uniforms.uTint = TINT; sh.uniforms.uBase = c.uBase; sh.uniforms.uLit = c.uLit;
    sh.vertexShader = 'varying float vWy; varying vec2 vUvF;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvUvF = uv;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWy = (modelMatrix * vec4(transformed, 1.0)).y;');
    // soft sky tint, brighter toward the top edge, a little warmer key — foot stays in gentle shade until lifted
    sh.fragmentShader = 'uniform vec3 uTint; uniform float uBase, uLit; varying float vWy; varying vec2 vUvF;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
float up = smoothstep(uBase, uBase + 0.9, vWy);
float key = 0.88 + 0.14 * vUvF.y;
vec3 shaded = diffuseColor.rgb * uTint * mix(0.62, 1.0, up) * key;
diffuseColor.rgb = mix(shaded, diffuseColor.rgb, uLit);`); }; return m; };
  // winter, as in the 2D field: a cap of snow along each card's top edge (it rides with the card). The dunes themselves bury each card's foot.
  const WHITE = new THREE.Color(1, 1, 1), capTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'), pts = [];
    for (let i = 0; i <= 12; i++) pts.push([i / 12 * 256, i === 0 || i === 12 ? 32 : 6 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 12]);
    x.beginPath(); x.moveTo(0, 38); x.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) x.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    x.lineTo(256, 32); x.lineTo(256, 38); x.quadraticCurveTo(128, 47, 0, 38); x.closePath();
    const g = x.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, '#FBFCFF'); g.addColorStop(0.7, '#E3E8F2'); g.addColorStop(1, '#BFC7D8'); x.fillStyle = g; x.fill();
    return new THREE.CanvasTexture(c); })();
  const capGeo = new THREE.PlaneGeometry(1.04 * ASPECT, 0.045); // a thin line of snow, not a thick slab
  // snow height at the card's foot — planted in the dune, not floating above a flattened pad
  const cardBase = (c) => { if (!sp.snow) return 0; return duneH(c.home.x, c.home.z); };
  // face the camera so edges stay square on screen (no perspective lean)
  const faceCam = (ob) => { ob.quaternion.copy(camera.quaternion); };
  // foot in the ground; grass shortens around the card so the photo stays readable
  const restY = (c) => cardBase(c) + c.H / 2 - c.sink - (sp.snow ? 0.03 : 0);
  const step = () => (sp.snow ? 0 : 0.4); // in snow a card stays on the level patch at its foot
  const seat = (c) => { c.m.scale.setScalar(c.H); c.proxy.scale.set(c.H * ASPECT, c.H, 1); c.proxy.position.set(c.home.x, restY(c), c.home.z); faceCam(c.proxy); faceCam(c.m);
    c.cap.visible = !!sp.snow; c.uBase.value = cardBase(c) - (sp.snow ? 0.05 : 0);
    { camera.updateMatrixWorld();
      // room to rise; top stays under the name after a short step toward the camera on the ground
      // winter grows from the foot (see frame), so the hovered top is a little higher than the grass center-scale case
      const top = (L) => { tgt.set(camera.position.x - c.home.x, 0, camera.position.z - c.home.z); if (tgt.lengthSq() > 1e-6) tgt.normalize();
        // full hover scale + winter snow cap; tighter on phones so the name doesn't cover a grown card
        corner.set(c.home.x + tgt.x * step(), restY(c) + L + c.H * (sp.snow ? 0.7 : 0.58), c.home.z + tgt.z * step()).project(camera); return corner.y; };
      const lim = W < 720 ? 0.58 : 0.72;
      let lo = 0, hi = c.sink + (sp.snow ? 0.28 : 0.5); if (top(hi) > lim) { for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (top(mid) > lim) hi = mid; else lo = mid; } hi = lo; } c.maxLift = hi; }
    if (c.i < 16) CARDU.value[c.i].set(c.home.x, c.home.z, c.H * ASPECT, c.on ? 1 : 0); };
  const makeCard = (i) => {
    const d = CARDS[i], face = skyFog(new THREE.MeshBasicMaterial({ map: cardTex(d) })), m = new THREE.Mesh(slab, [face]);
    m.renderOrder = 3; // draw after snowfall so the photo isn't painted under flakes
    // the invisible proxy stays at the card's home spot and keeps the hover while the card itself rises
    const proxy = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ visible: false }));
    // a real link for keyboard and screen-reader users; it follows the card, so focusing it lifts the card and shows the focus ring around it
    const a = document.createElement('a'); a.href = '#'; a.setAttribute('aria-label', d.label); a.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;border-radius:12px;pointer-events:none';
    const c = { i, m, face, proxy, a, uBase: { value: 0 }, uLit: { value: 0 }, H: 1.6, home: new THREE.Vector3(), sink: 0.1 + rand() * 0.1, lift: 0, liftV: 0, fwd: 0, fwdV: 0, up: 0, on: 0 };
    a.addEventListener('focus', () => { kbd = c; }); a.addEventListener('blur', () => { if (kbd === c) kbd = null; });
    a.addEventListener('click', (e) => { e.preventDefault(); o.onOpen && o.onOpen(i); });
    litFace(face, c);
    c.capM = skyFog(new THREE.MeshBasicMaterial({ alphaTest: 0.5, map: capTex })); c.cap = new THREE.Mesh(capGeo, c.capM); // each card's own, so it brightens with the card
    c.cap.position.set(0, 0.512, 0.003); m.add(c.cap);
    scene.add(m, proxy); ui.appendChild(a);
    return c;
  };
  // like the 2D layout: cards at several depths, never overlapping on screen (each spot is tried a few times, skipped if nothing fits).
  // Redone when the box changes shape, so cards never end up off-screen or on top of each other.
  const layout = () => {
    // [depth z, how many]: camera at z = 8. Near band is a touch farther back so panoramic (≈3:1) boxes don't stick cards into the sky.
    const BANDS = W < 720 ? [[3.8, 1], [2.3, 2], [0.9, 2], [-0.3, 3]] : [[3.7, 2], [2.3, 3], [0.9, 3], [-0.3, 4]];
    camera.updateMatrixWorld(); const taken = [], scr = (x, y, z) => new THREE.Vector3(x, y, z).project(camera);
    // cap aspect so a wide short field doesn't grow cards until far slots can't fit
    const sz = Math.min(1, 0.5 + Math.min(camera.aspect, 2.2) * 0.38);
    // horizon is ~NDC 0.6; keep resting tops under it on panoramic boxes
    const topLim = W < 720 ? 0.55 : (camera.aspect > 2.4 ? 0.52 : 0.72), duneLim = topLim + 0.04;
    let i = 0; const rand = seeded((o.seed || 20251108) + 1); /* its own stream: re-fitting doesn't deal the cards differently each time */
    for (const [z0, n] of BANDS) {
      const d = CAM.z - z0, half = d * Math.tan(THREE.MathUtils.degToRad(19)) * camera.aspect * 0.85;
      const far = z0 < 1.5, deep = z0 < 0.5;
      for (let k = 0; k < n && i < CARDS.length; k++) {
        let x, z, h, ok = false;
        for (let t = 0; t < (far ? 240 : 160) && !ok; t++) {
          z = z0 + (rand() - 0.5) * 0.7; x = (rand() * 2 - 1) * half;
          h = (1.15 + rand() * 0.22) * sz * (deep ? 0.78 : far ? 0.88 : 1);
          const dy = duneH(x, z);
          // near cards on the tallest dunes still climb into the sky at 3:1
          if (z0 > 3 && dy > 0.85) continue;
          // top ≈ seated top (H − sink); old h*0.8 under-checked and let winter cards poke above the horizon
          const topY = (y) => y + h - 0.14, pad = far ? 0.025 : 0.04;
          const rects = [0, dy].map((y) => { const a = scr(x - h * 0.42, topY(y), z), b = scr(x + h * 0.42, y + 0.2, z); return [a.x, a.y, b.x, b.y]; }), r = rects[0];
          const free = (r, q) => r[2] + pad < q[0] || r[0] - pad > q[2] || r[1] + pad < q[3] || r[3] - pad > q[1];
          // and no winter ridge between it and the camera may hide its lower half (shorter look-ahead far out)
          const look = deep ? [0.5, 1, 1.5, 2] : [0.5, 1, 1.5, 2, 2.5, 3];
          const clear = look.every((t) => duneH(x, z + t) - dy < 0.2 + t * (CAM.y - dy) / (CAM.z - z));
          const edge = deep ? 0.97 : 0.94;
          ok = clear && r[0] > -edge && r[2] < edge && r[1] < topLim && rects[1][1] < duneLim && taken.every((q) => free(rects[0], q[0]) && free(rects[1], q[1]));
          if (ok) taken.push(rects);
        }
        if (!ok) continue;
        const c = cards[i] || (cards[i] = makeCard(i)); i++;
        c.H = h; c.home.set(x, 0, z); c.on = 1; c.lift = c.fwd = c.liftV = c.fwdV = 0; c.up = 0; seat(c);
      }
    }
    cards.forEach((c, j) => { if (j >= i) c.on = 0; c.m.visible = !!c.on; c.a.hidden = !c.on; if (j < 16 && !c.on) CARDU.value[j].w = 0; });
    hov = null; if (sp.snow) snowCool = 0.8;
  };

  // ── season: retint the grass, swap grass for snow, repaint the sky
  const setSeason = (next) => {
    sp = next; paintSky();
    pfT.fill(9); pfA.fill(0); pfG.attributes.aA.needsUpdate = true; // a new season starts with no powder in the air
    const snowy = !!sp.snow; grass.visible = ground.visible = !snowy; snow.visible = powder.visible = snowfall.visible = snowy;
    if (snowy) snowCool = 0.8; // re-settle powder onto new card banks
    if (snowy) fog.density = 0.02;
    else {
      fog.density = 0.022;
      grassU.uRoot.value.copy(hsl(sp.h, sp.s * 0.9, sp.l + 4)); grassU.uTip.value.copy(hsl(sp.h + sp.hv * 0.4, sp.s + 4, sp.l + 27)); grassU.uDry.value.copy(hsl(sp.h - 10, sp.s - 6, sp.l + 34));
      ground.material.color.copy(grassU.uRoot.value).lerp(grassU.uTip.value, 0.45); // far off, the ground reads as the field's average colour, so there's no seam where the blades end
      grassU.uRim.value.set(String(sp.skyAll.sun.stops[2][1]).replace(/rgba\((\d+),(\d+),(\d+).*/, 'rgb($1,$2,$3)')); grassU.uHm.value = sp.hm || 1.3;
    }
    grassU.uFogD.value = fog.density;
    { const K = sp.skyAll, z2 = new THREE.Color(K.zen[2]), lum = 0.2126 * z2.r + 0.7152 * z2.g + 0.0722 * z2.b;
      TINT.value.setRGB(1, 1, 1).lerp(new THREE.Color(K.stops[Math.min(3, K.stops.length - 1)][1]), 0.22).multiplyScalar(Math.min(1, 0.74 + lum * 0.7)); }
    const fl = sp.fl || [], nf = sp.snow || !fl.length ? 0 : Math.round(FN * Math.min(1, (sp.fd || 0) / 1.7));
    for (let i = 0; i < nf; i++) { const f = fl[i % fl.length], c = hsl(f[0], f[1], f[2]); fC.set([c.r, c.g, c.b], i * 3); }
    fG.setDrawRange(0, nf); fG.attributes.aC.needsUpdate = true; flowers.visible = nf > 0;
    stemGeo.instanceCount = nf; stems.visible = nf > 0;
    for (const c of cards) { seat(c); c.lift = c.fwd = c.liftV = c.fwdV = 0; c.up = 0; }
  };

  // ── pointer, tap and keyboard: the card under the pointer (or the focused link) rises, the grass bends away from its foot, then it comes forward.
  // Click opens it; on a phone the first tap brings it forward and a second tap opens it.
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(9, 9);
  let hov = null, kbd = null, tapSel = null, ptype = 'mouse';
  // pointer type comes from pointer events only (Safari's click is a plain MouseEvent, which would make a tap look like a mouse click)
  const point = (e) => { const r = cv.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); if (e.pointerType) ptype = e.pointerType; };
  const away = () => ptr.set(9, 9);
  const pick = () => { ray.setFromCamera(ptr, camera); const hits = ray.intersectObjects(cards.filter((c) => c.on).flatMap((c) => [c.m, c.proxy]), false);
    if (hov && hits.some((h) => h.object === hov.m || h.object === hov.proxy)) return hov; // the hovered one stays while the pointer is on it or on its home spot
    return hits.length ? cards.find((c) => c.m === hits[0].object || c.proxy === hits[0].object) : null; };
  const onLeave = () => { if (ptype !== 'touch') away(); };
  const onClick = (e) => { point(e); const c = pick(); if (!c) { tapSel = null; return; }
    // phones: first tap brings the card forward (and keeps it), second tap opens
    if (ptype === 'touch' && tapSel !== c) { tapSel = c; hov = c; e.preventDefault(); return; }
    tapSel = null; o.onOpen && o.onOpen(c.i); };
  cv.addEventListener('pointermove', point); cv.addEventListener('pointerdown', point); cv.addEventListener('pointerleave', onLeave); cv.addEventListener('pointercancel', away); cv.addEventListener('click', onClick);

  const spring = (c, k, kv, tgt, w, dt) => { if (RM) { c[k] = tgt; c[kv] = 0; return; } const a = w * w * (tgt - c[k]) - 2 * w * c[kv]; c[kv] += a * dt; c[k] += c[kv] * dt; };
  const tgt = new THREE.Vector3(), corner = new THREE.Vector3();
  const rectOf = (m) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [u, v] of [[-ASPECT / 2, -0.5], [ASPECT / 2, -0.5], [-ASPECT / 2, 0.5], [ASPECT / 2, 0.5]]) { corner.set(u, v, 0).applyMatrix4(m.matrixWorld).project(camera); const px = (corner.x + 1) / 2 * W, py = (1 - corner.y) / 2 * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); } return [x0, y0, x1, y1]; };

  // ── resize and visibility: re-fit when the box changes; don't draw while the field is scrolled out of view
  let vis = true, rsT = 0;
  const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; }); io.observe(host);
  const fitSnow = () => { const asp = W / Math.max(1, H); SFAsp.value = asp; snow.scale.x = powderU.uSx.value = Math.max(1, asp / 1.9); powderU.uH.value = H; };
  fitSnow();
  const ro = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h || (w === W && h === H)) return; W = w; H = h; SFH.value = H;
    camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H, false); renderer.getDrawingBufferSize(RES.value); PX.value = renderer.getPixelRatio(); fitSnow(); paintSky(); clearTimeout(rsT); rsT = setTimeout(layout, 200); });
  ro.observe(host);

  let last = performance.now(), T = 0, ready = false, capW = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!vis || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; T += RM ? 0 : dt;
    hov = pick();
    // on a phone the tapped card stays forward until you tap another (or empty); don't drop it just because the ray missed for a frame
    if (ptype === 'touch' && tapSel && hov && hov !== tapSel) tapSel = null;
    const act = kbd || hov || (ptype === 'touch' ? tapSel : null), snowy = !!sp.snow, narrow = W < 720;
    cv.style.cursor = hov ? 'pointer' : '';
    const active = []; let capC = null;
    for (const c of cards) {
      if (!c.on) continue;
      const want = c === act ? 1 : 0;
      spring(c, 'lift', 'liftV', want || c.fwd > 0.3 ? 1 : 0, 9, dt);
      spring(c, 'fwd', 'fwdV', want && c.lift > 0.65 ? 1 : 0, 6.5, dt);
      const lifted = restY(c) + c.maxLift * c.lift, e = Math.max(0, Math.min(1, c.fwd * c.fwd * (3 - 2 * c.fwd)));
      let sc = 1 + (narrow ? 0.11 : 0.16) * e;
      // rise straight up, then step toward you on the ground — never fly up into the title along the camera ray
      // winter: grow from the foot so the 16% scale can't shove the bottom back into the snow
      c.m.position.set(c.home.x, lifted + (snowy ? c.H * 0.5 * (sc - 1) : 0), c.home.z);
      tgt.set(camera.position.x - c.home.x, 0, camera.position.z - c.home.z);
      if (tgt.lengthSq() > 1e-6) tgt.normalize();
      c.m.position.addScaledVector(tgt, step() * e);
      c.m.scale.setScalar(c.H * sc);
      faceCam(c.m); faceCam(c.proxy);
      // keep the grown card inside the field box — phones: clear of the name above and the season pill below
      if (e > 0.02) {
        c.m.updateMatrixWorld(true);
        let [x0, y0, x1, y1] = rectOf(c.m);
        const topLim = Math.round(H * (narrow ? 0.24 : 0.09)) + (snowy ? 18 : 0), botLim = H - (narrow ? 64 : 28), side = narrow ? 18 : 10;
        const wppAt = () => { const d = Math.max(0.8, camera.position.distanceTo(c.m.position)); return [(2 * d * Math.tan(THREE.MathUtils.degToRad(19))) / H, (2 * d * Math.tan(THREE.MathUtils.degToRad(19)) * camera.aspect) / W]; };
        if (y0 < topLim) { const [wpp] = wppAt(); c.m.position.y -= (topLim - y0) * wpp; c.m.updateMatrixWorld(true); [x0, y0, x1, y1] = rectOf(c.m); }
        const need = (y1 - y0) - (botLim - Math.max(y0, topLim));
        if (need > 2 && sc > 1) {
          sc = Math.max(1, sc * (1 - need / Math.max(1, y1 - y0)));
          c.m.scale.setScalar(c.H * sc);
          if (snowy) c.m.position.y = lifted + c.H * 0.5 * (sc - 1);
          c.m.updateMatrixWorld(true); [x0, y0, x1, y1] = rectOf(c.m);
          if (y0 < topLim) { const [wpp] = wppAt(); c.m.position.y -= (topLim - y0) * wpp; c.m.updateMatrixWorld(true); [x0, y0, x1, y1] = rectOf(c.m); }
        }
        if (narrow && e > 0.4) { // ease the selected card toward center so it isn't clipped on a side
          const [, wppX] = wppAt(), cx = (x0 + x1) / 2; c.m.position.x += (W / 2 - cx) * wppX * 0.45 * e; c.m.updateMatrixWorld(true); [x0, y0, x1, y1] = rectOf(c.m);
        }
        if (x0 < side || x1 > W - side) {
          const [, wppX] = wppAt();
          if (x0 < side) c.m.position.x += (side - x0) * wppX;
          if (x1 > W - side) c.m.position.x -= (x1 - (W - side)) * wppX;
        }
        faceCam(c.m);
      }
      if (snowy && !RM) { if (want && !c.up) { c.up = 1; puff(c.home.x, cardBase(c) + 0.05, c.home.z + 0.15, c.H * ASPECT, 1); } else if (!want && c.up && c.lift < 0.15) { c.up = 0; puff(c.home.x, cardBase(c) + 0.05, c.home.z + 0.15, c.H * ASPECT, 0.45); } }
      if (c.i < 16) CARDU.value[c.i].set(c.home.x, c.home.z, c.H * ASPECT, 1 + Math.max(0, Math.min(1, c.lift)));
      c.uLit.value = Math.max(e, Math.min(1, c.lift) * 0.85); c.capM.color.copy(TINT.value).lerp(WHITE, 0.5 + 0.5 * e);
      const a = Math.max(0, Math.min(1, c.lift)) * (1 - 0.85 * Math.max(0, Math.min(1, c.fwd)));
      if (a > 0.01) active.push([a, c]);
      if (want && c.fwd > 0.55) capC = c;
    }
    // grass / snow part around the most-lifted cards (ground flakes + falling flakes both read uPart)
    active.sort((p, q) => q[0] - p[0]);
    for (let i = 0; i < PARTS; i++) {
      const v = grassU.uPart.value[i];
      if (active[i]) {
        const [a, c] = active[i];
        // winter: slightly wider clear so flakes and banks leave the photo open like parted grass
        const reach = c.H * ASPECT * (snowy ? 1.05 : 0.75);
        v.set(c.m.position.x, c.home.z + 0.1, reach, a);
      } else v.set(0, 0, 1, 0);
    }
    if (snowy) stepSnow(dt);
    // powder
    for (let j = 0; j < PF; j++) { if (pfT[j] >= pfL[j]) { pfA[j] = 0; continue; } pfT[j] += dt; const u = pfT[j] / pfL[j]; pfV[j * 3] *= Math.exp(-1.6 * dt); pfV[j * 3 + 1] -= 4.2 * dt; pfV[j * 3 + 2] *= Math.exp(-1.6 * dt);
      pfP[j * 3] += pfV[j * 3] * dt; pfP[j * 3 + 1] += pfV[j * 3 + 1] * dt; pfP[j * 3 + 2] += pfV[j * 3 + 2] * dt; pfA[j] = Math.min(1, pfT[j] / 0.06) * (1 - u) * (1 - u) * 0.9; }
    pfG.attributes.position.needsUpdate = true; pfG.attributes.aA.needsUpdate = true;
    grassU.uTime.value = T;
    renderer.render(scene, camera);
    // keyboard links follow their cards; the caption sits on the top edge of the card that's come forward
    for (const c of cards) { if (!c.on) continue; const [x0, y0, x1, y1] = rectOf(c.m), tf = 'translate(' + x0.toFixed(1) + 'px,' + y0.toFixed(1) + 'px)';
      if (c.a._tf !== tf) { c.a._tf = tf; c.a.style.transform = tf; c.a.style.width = (x1 - x0).toFixed(1) + 'px'; c.a.style.height = (y1 - y0).toFixed(1) + 'px'; } }
    if (capC) { const [x0, y0, x1] = rectOf(capC.m); if (cap.textContent !== CARDS[capC.i].label) cap.textContent = CARDS[capC.i].label; capW = cap.offsetWidth / 2 + 8; cap.style.transform = 'translate(' + Math.max(capW, Math.min(W - capW, (x0 + x1) / 2)).toFixed(1) + 'px,' + (y0 + 12).toFixed(1) + 'px) translateX(-50%)'; cap.style.opacity = '1'; }
    else cap.style.opacity = '0';
    if (!ready) { ready = true; o.onReady && o.onReady(); }
  };

  layout(); setSeason(sp);
  // don't leave the host at opacity 0 if the first frames throw — still signal ready so the page can fade in
  try { o.onReady && o.onReady(); ready = true; } catch (_) {}
  raf = requestAnimationFrame((t) => { last = t; frame(t); });

  const destroy = () => {
    if (dead) return; dead = true; cancelAnimationFrame(raf); clearTimeout(rsT); io.disconnect(); ro.disconnect();
    scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); [].concat(ob.material || []).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
    skyTex.dispose(); renderer.dispose(); renderer.forceContextLoss(); cv.remove(); ui.remove();
  };
  return { setSeason, refreshSky: paintSky, destroy };
}

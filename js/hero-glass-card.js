/* ===================================================
   TK WEBTALENT – 3D-GLASKARTE IM HERO
   Schwebende, abgerundete Glaskarte mit einer Vorschau
   der Website-UI dahinter. Dreht sich beim Scrollen von
   seitlich (weggedreht) zu frontal (zugewandt).
   =================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('heroGlassCard');

/* Öffentliche API – main.js ruft setProgress(0..1) beim Scrollen auf.
   Existiert immer, auch bevor/falls die Szene (noch) nicht bereit ist,
   damit main.js nie gegen ein undefined anlaufen kann. */
let progress = 1;
let applyFn = null;
window.heroGlassCard = {
  setProgress(p) {
    progress = p;
    if (applyFn) applyFn(p);
  }
};

if (canvas && window.WebGLRenderingContext) {
  init();
}

function init() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.15, 6.2);
  camera.lookAt(0, 0, 0);

  /* Umgebungslicht für realistische Glas-Reflexionen (PBR braucht eine
     Umgebung, sonst wirkt transmission-Material grau/flach) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 4, 5);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  /* ── Gruppe: rotiert & schwebt als Ganzes ── */
  const group = new THREE.Group();
  scene.add(group);

  /* Weicher Kontaktschatten am Boden */
  group.add(makeContactShadow());

  /* UI-Vorschau (Canvas-Textur) knapp hinter der Vorderseite der Glaskarte */
  const uiTexture = makeUiTexture();
  const uiPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.92, 1.82),
    new THREE.MeshBasicMaterial({ map: uiTexture, transparent: true, toneMapped: false })
  );
  uiPlane.position.z = 0.075;
  group.add(uiPlane);

  /* Glaskarte selbst: abgerundeter, dünner Slab mit Transmission-Material */
  const glassGeo = new RoundedBoxGeometry(3.2, 2, 0.14, 6, 0.16);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf6ff,
    metalness: 0,
    roughness: 0.06,
    transmission: 1,
    thickness: 0.6,
    ior: 1.45,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.2,
    attenuationColor: 0xbfe4ff,
    attenuationDistance: 1.2,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  group.add(glass);

  /* Feiner leuchtender Rand, damit die Kante "smart" statt kantig wirkt */
  const rim = new THREE.Mesh(
    new RoundedBoxGeometry(3.22, 2.02, 0.1, 6, 0.17),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
  );
  group.add(rim);

  fitRenderer();
  const ro = new ResizeObserver(fitRenderer);
  ro.observe(canvas.parentElement);

  const ORBIT_START = -1.5;  // weggedreht (Kante zugewandt)
  const ORBIT_END    = -0.16; // zugewandt, leichte 3/4-Perspektive
  const lerp = (a, b, t) => a + (b - a) * t;

  applyFn = (p) => {
    group.rotation.y = lerp(ORBIT_START, ORBIT_END, p);
    if (reduceMotion) renderer.render(scene, camera);
  };
  applyFn(progress);

  /* Idle-Schweben, solange Reduced-Motion nicht gewünscht ist */
  const clock = new THREE.Clock();
  let visible = true;
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 });
  io.observe(canvas);

  if (!reduceMotion) {
    renderer.setAnimationLoop(() => {
      if (!visible) return;
      const t = clock.getElapsedTime();
      group.position.y = Math.sin(t * 0.6) * 0.06;
      group.rotation.z = Math.sin(t * 0.4) * 0.015;
      group.rotation.x = Math.sin(t * 0.5) * 0.01;
      renderer.render(scene, camera);
    });
  }

  function fitRenderer() {
    const el = canvas.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduceMotion) renderer.render(scene, camera);
  }
}

/* Weicher, verwaschener Schatten unter der Karte */
function makeContactShadow() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(15,23,42,0.11)');
  grad.addColorStop(0.6, 'rgba(15,23,42,0.05)');
  grad.addColorStop(1, 'rgba(15,23,42,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.8),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.position.set(0, -1.3, -0.3);
  mesh.rotation.x = -Math.PI / 2.6;
  return mesh;
}

/* Zeichnet eine Mini-Vorschau der Website als Textur (Browserleiste +
   vereinfachter Hero) – crisp bei jeder Auflösung, kein Foto nötig. */
function makeUiTexture() {
  const w = 1024, h = 640;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  function rr(x, y, ww, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, r);
    ctx.arcTo(x + ww, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + ww, y, r);
    ctx.closePath();
  }

  // Alles Folgende auf abgerundetes Rechteck clippen (Transparenz an den
  // Ecken statt Rundung über die Geometrie – robuster bei UV-Mapping)
  rr(0, 0, w, h, 28);
  ctx.clip();

  // Hintergrund
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(1, '#F0F9FF');
  ctx.fillStyle = bg;
  rr(0, 0, w, h, 28);
  ctx.fill();

  // Browser-Leiste
  ctx.fillStyle = '#F1F5F9';
  rr(0, 0, w, 56, 28);
  ctx.fill();
  ctx.fillRect(0, 28, w, 28);
  const dots = ['#FF5F57', '#FFBD2E', '#28C840'];
  dots.forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(34 + i * 26, 28, 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.fillStyle = '#fff';
  rr(w / 2 - 140, 14, 280, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 15px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('tk-webtalent.de', w / 2, 33);

  // Logo + Nav
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 24px Inter, system-ui, sans-serif';
  ctx.fillText('TK', 48, 106);
  ctx.fillStyle = '#0EA5E9';
  ctx.fillText('Webtalent', 84, 106);
  ctx.fillStyle = '#CBD5E1';
  [560, 660, 760].forEach(x => { ctx.fillRect(x, 94, 70, 8); });

  // Headline
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 46px Inter, system-ui, sans-serif';
  ctx.fillText('Moderne Webseiten,', 48, 200);
  ctx.fillStyle = '#0EA5E9';
  ctx.fillText('die Kunden überzeugen.', 48, 254);

  ctx.fillStyle = '#64748B';
  ctx.font = '400 20px Inter, system-ui, sans-serif';
  ctx.fillText('Schnell, klar, mobiloptimiert – für Handwerker', 48, 296);
  ctx.fillText('und Selbstständige.', 48, 322);

  // CTA-Button
  ctx.fillStyle = '#0F172A';
  rr(48, 356, 220, 56, 14);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Kostenlos anfragen', 48 + 110, 356 + 34);

  // Feature-Karten
  const cards = [
    { icon: '📱', title: 'Mobiloptimiert' },
    { icon: '⚡', title: 'Blitzschnell' },
    { icon: '🎯', title: 'Klar strukturiert' },
  ];
  const cardW = 280, cardGap = 24, startX = 48, cardY = 452, cardH = 120;
  cards.forEach((card, i) => {
    const x = startX + i * (cardW + cardGap);
    ctx.fillStyle = '#ffffff';
    rr(x, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    rr(x, cardY, cardW, cardH, 16);
    ctx.stroke();
    ctx.font = '32px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(card.icon, x + 20, cardY + 48);
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 18px Inter, system-ui, sans-serif';
    ctx.fillText(card.title, x + 20, cardY + 84);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

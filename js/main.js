import { renderContent, countUp } from "./render-content.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);
const lite = params.has("lite") ? true : params.has("full") ? false :
  (matchMedia("(pointer: coarse)").matches || innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 2);

renderContent();

// ---- ready / loader ----
let readyDone = false;
function ready() {
  if (readyDone) return;
  readyDone = true;
  document.body.classList.add("ready");
  // intro reveals start once the curtain lifts
  document.querySelectorAll("#intro .reveal").forEach((el) => el.classList.add("in"));
}
setTimeout(ready, 5000); // never hide the text forever

// ---- reveal on scroll ----
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target;
    if (el.closest("#intro") && !readyDone) continue;
    el.classList.add("in");
    el.querySelectorAll(".value[data-target]").forEach((v) => { if (!v.dataset.done) { v.dataset.done = 1; countUp(v, reduced); } });
    io.unobserve(el);
  }
}, { threshold: 0.18 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// ---- scroll progress, HUD ----
const depthEl = document.getElementById("hud-depth");
const sectorEl = document.getElementById("hud-sector");
const railEl = document.getElementById("rail-fill");
const sections = [...document.querySelectorAll("[data-sector]")];
let progress = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  depthEl.textContent = String(Math.round(progress * 4096)).padStart(4, "0");
  railEl.style.transform = `scaleY(${progress})`;
  const mid = innerHeight * 0.5;
  for (const s of sections) {
    const r = s.getBoundingClientRect();
    if (r.top <= mid && r.bottom > mid) {
      sectorEl.textContent = s.dataset.sector;
      // text on the left -> chain drifts right, and the other way round
      side = s.classList.contains("left") ? 1 : s.classList.contains("right") ? -1 : 0;
      break;
    }
  }
}
let side = 0;
addEventListener("scroll", readScroll, { passive: true });
addEventListener("resize", readScroll);
readScroll();

// ---- pointer: parallax + dragging the king ----
const pointer = { x: 0, y: 0, dragging: false, lastX: 0, spin: 0 };
addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
  if (pointer.dragging) { pointer.spin += (e.clientX - pointer.lastX) * 0.012; pointer.lastX = e.clientX; }
});
addEventListener("pointerdown", (e) => {
  if (e.target.closest("a")) return;
  pointer.dragging = true; pointer.lastX = e.clientX;
});
addEventListener("pointerup", () => (pointer.dragging = false));
addEventListener("pointercancel", () => (pointer.dragging = false));

// ---- the 3D abyss ----
function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch { return false; }
}

async function start() {
  if (!hasWebGL()) { document.body.classList.add("no-webgl"); ready(); return; }
  try {
    const { createScene } = await import("./scene.js");
    const canvas = document.getElementById("abyss");
    const scene = createScene(canvas, { lite, reduced, snap: params.has("snap") });
    window.__scene = scene;
    addEventListener("resize", () => scene.resize());
    let last = performance.now(), first = true, t = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!reduced) t += dt;
      scene.setPointer(pointer.x, pointer.y);
      scene.spinKing(pointer.spin); pointer.spin = 0;
      scene.update(progress, t, dt, side);
      if (first) { first = false; requestAnimationFrame(() => ready()); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } catch (err) {
    console.warn("3D scene failed, showing text only:", err);
    document.body.classList.add("no-webgl");
    ready();
  }
}
start();

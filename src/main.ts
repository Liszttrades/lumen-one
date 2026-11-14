import "./style.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => window.matchMedia("(max-width: 640px)").matches;

/* ---------------- Smooth scroll ---------------- */
let lenis: Lenis | null = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  if (import.meta.env.DEV) (window as unknown as { __lenis: Lenis }).__lenis = lenis;
}
function scrollToTarget(target: string | number) {
  if (lenis) lenis.scrollTo(target as never, { duration: 1.4 });
  else if (typeof target === "number") window.scrollTo({ top: target });
  else document.querySelector(target)?.scrollIntoView();
}
$$<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href")!;
    if (id.length < 2 || a.dataset.buy) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(id);
  });
});

/* ---------------- Hero film: scroll-scrubbed frames ---------------- */
const FRAME_COUNT = 145;
const SRC_W = 1280;
const SRC_H = 720;
const STAGE_FILL = "#d7d7d7";

const hero = $("[data-hero]")!;
const canvas = $<HTMLCanvasElement>("[data-hero-canvas]")!;
const ctx = canvas.getContext("2d", { alpha: false })!;
const word = $("[data-hero-word]")!;
const copy = $("[data-hero-copy]")!;
const hint = $("[data-scroll-hint]");
const callouts = $$<HTMLLIElement>("[data-callouts] .callout");

// hd: 2560 px Real-ESRGAN (x4plus) AI-upscaled frames; mobile: the same frames at 1280 px
const folder = isMobile() ? "mobile" : "hd";
const frames: (HTMLImageElement | null)[] = new Array(FRAME_COUNT).fill(null);
let current = 0;
let drawn = -1;

// object-fit math shared by the canvas and the callouts
let fit = { x: 0, y: 0, w: 0, h: 0, scale: 1 };
let filmT = 0; // 0 at the assembled frame, 1 at the exploded view
function layout() {
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const cover = cw / ch >= (SRC_W / SRC_H) * 0.85; // cover on landscape, contain on squarer and tall screens
  // landscape: start smaller and higher so the headline sits on the floor, ease out so the exploded view fills the width
  // squarer/tall: start 1.25x larger, ease to 1x so the whole exploded view fits
  const zoom = cover ? 0.72 + (0.9 - 0.72) * filmT : 1.25 - 0.25 * filmT;
  const base = cover ? Math.max(cw / SRC_W, ch / SRC_H) : Math.min(cw / SRC_W, ch / SRC_H);
  const scale = base * zoom;
  const w = SRC_W * scale;
  const h = SRC_H * scale;
  const lift = (cover ? 0.12 : 0.06) * ch * (1 - filmT);
  fit = { x: (cw - w) / 2, y: (ch - h) / 2 - lift, w, h, scale };
}
function computeFit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout();
  drawn = -1;
  draw(current);
  placeCallouts();
}

function nearestLoaded(i: number) {
  for (let d = 0; d < FRAME_COUNT; d++) {
    if (frames[i - d]?.complete) return frames[i - d];
    if (frames[i + d]?.complete) return frames[i + d];
  }
  return null;
}

function drawLayer(img: HTMLImageElement, cw: number, ch: number) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  // letterboxed: stretch the image's own edge rows/columns outward so the studio continues seamlessly
  if (fit.x > 0) {
    ctx.drawImage(img, 0, 0, 2, ih, 0, fit.y, fit.x + 1, fit.h);
    ctx.drawImage(img, iw - 2, 0, 2, ih, fit.x + fit.w - 1, fit.y, cw - fit.x - fit.w + 1, fit.h);
  }
  if (fit.y > 0) {
    // full width, so the corners beside a narrower frame are filled too
    ctx.drawImage(img, 0, 0, iw, 2, Math.min(0, fit.x), 0, Math.max(cw, fit.w), fit.y + 1);
  }
  if (fit.y + fit.h < ch) {
    ctx.drawImage(img, 0, ih - 2, iw, 2, Math.min(0, fit.x), fit.y + fit.h - 1, Math.max(cw, fit.w), ch - fit.y - fit.h + 1);
  }
  ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
}

function draw(i: number) {
  const img = frames[i]?.complete ? frames[i] : nearestLoaded(i);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  ctx.fillStyle = STAGE_FILL;
  ctx.fillRect(0, 0, cw, ch);
  if (img && img.naturalWidth) drawLayer(img, cw, ch);
  if (img === frames[i]) drawn = i;
}

function loadFrame(i: number) {
  if (frames[i]) return frames[i]!;
  const img = new Image();
  img.decoding = "async";
  img.src = `${import.meta.env.BASE_URL}frames/${folder}/f_${String(i).padStart(3, "0")}.webp`;
  img.onload = () => { if (i === current || drawn !== current) draw(current); };
  frames[i] = img;
  return img;
}

// first frame now, the rest progressively after first paint (every 4th first, then fill in)
loadFrame(0);
window.addEventListener("load", () => {
  const order: number[] = [];
  for (let i = 0; i < FRAME_COUNT; i += 4) order.push(i);
  for (let i = 0; i < FRAME_COUNT; i++) if (i % 4) order.push(i);
  let k = 0;
  const step = () => {
    for (let n = 0; n < 6 && k < order.length; n++, k++) loadFrame(order[k]);
    if (k < order.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

// one leader line + dot per callout, kept in an SVG over the canvas
const SVGNS = "http://www.w3.org/2000/svg";
const lineSvg = $<SVGSVGElement>("[data-callout-lines]")!;
const leaders = callouts.map(() => {
  const g = document.createElementNS(SVGNS, "g");
  const line = document.createElementNS(SVGNS, "line");
  const halo = document.createElementNS(SVGNS, "circle");
  const dot = document.createElementNS(SVGNS, "circle");
  const num = document.createElementNS(SVGNS, "text");
  halo.setAttribute("class", "halo");
  halo.setAttribute("r", "8");
  dot.setAttribute("r", "4");
  num.setAttribute("class", "num");
  num.textContent = String(callouts.length ? lineSvg.childElementCount + 1 : 1);
  g.append(line, halo, dot, num);
  g.style.opacity = "0";
  lineSvg.append(g);
  return { g, line, halo, dot, num };
});

function placeCallouts() {
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const edge = 16;
  const compact = isMobile(); // phones: numbered dots on the parts + a numbered list above, no leader lines
  hero.classList.toggle("callouts-compact", compact);
  callouts.forEach((c, i) => {
    // dot on the part
    const ax = fit.x + Number(c.dataset.x) * fit.scale;
    const ay = fit.y + Number(c.dataset.y) * fit.scale;
    const { line, halo, dot, num } = leaders[i];
    for (const el of [halo, dot]) { el.setAttribute("cx", String(ax)); el.setAttribute("cy", String(ay)); }
    num.setAttribute("x", String(ax));
    num.setAttribute("y", String(ay));
    if (compact) {
      c.style.left = c.style.top = c.style.transform = c.style.marginLeft = "";
      return;
    }
    // label sits in clear space; "right" = the box grows to the right of its attach point
    const right = c.dataset.side === "right";
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    let lx = fit.x + Number(c.dataset.lx) * fit.scale;
    const ly = Math.min(ch - h / 2 - edge, Math.max(h / 2 + edge + 64, fit.y + Number(c.dataset.ly) * fit.scale));
    // keep the whole box on screen
    if (right) lx = Math.min(Math.max(lx, edge), cw - w - edge);
    else lx = Math.max(Math.min(lx, cw - edge), w + edge);
    c.style.left = `${lx}px`;
    c.style.top = `${ly}px`;
    c.style.marginLeft = "0";
    c.style.transform = right ? "translate(0, -50%)" : "translate(-100%, -50%)";
    line.setAttribute("x1", String(ax));
    line.setAttribute("y1", String(ay));
    line.setAttribute("x2", String(lx));
    line.setAttribute("y2", String(ly));
  });
}

computeFit();
window.addEventListener("resize", () => { computeFit(); ScrollTrigger.refresh(); });

const FILM_END = 0.82; // portion of the pinned scroll that plays the film; the rest holds the exploded view

if (reduceMotion) {
  // rest on the exploded view with every callout visible
  current = FRAME_COUNT - 1;
  filmT = 1;
  hero.style.setProperty("--floor-fade", "0");
  layout();
  placeCallouts();
  leaders.forEach((l) => (l.g.style.opacity = "1"));
  loadFrame(current);
  word.style.opacity = "0";
  if (hint) hint.style.display = "none";
} else {
  ScrollTrigger.create({
    trigger: hero,
    start: "top top",
    end: "bottom bottom",
    scrub: 0.5,
    onUpdate: (self) => {
      const p = self.progress;
      const t = Math.min(1, p / FILM_END);
      const f = Math.round(t * (FRAME_COUNT - 1));
      const zoomChanged = Math.abs(t - filmT) > 0.0005;
      filmT = t;
      if (zoomChanged) { layout(); placeCallouts(); }
      if (f !== current || zoomChanged) {
        current = f;
        loadFrame(f);
        draw(f);
      }
      // word and copy leave during the first part of the film
      const out = gsap.utils.clamp(0, 1, p / 0.14);
      word.style.opacity = String(1 - out);
      word.style.transform = `scale(${1 + out * 0.08})`;
      copy.style.opacity = String(1 - gsap.utils.clamp(0, 1, p / 0.08));
      copy.style.transform = `translateY(${out * -24}px)`;
      copy.style.pointerEvents = p > 0.06 ? "none" : "auto";
      // floor gradient only supports the headline; gone before the parts spread into the lower left
      hero.style.setProperty("--floor-fade", String(1 - gsap.utils.clamp(0, 1, p / 0.12)));
      if (hint) hint.style.opacity = String(1 - gsap.utils.clamp(0, 1, p / 0.04));
      // callouts appear one by one once the parts have settled
      callouts.forEach((c, i) => {
        const start = FILM_END - 0.02 + i * 0.022;
        const v = gsap.utils.clamp(0, 1, (p - start) / 0.04);
        c.style.opacity = String(v);
        c.style.filter = `blur(${(1 - v) * 6}px)`;
        leaders[i].g.style.opacity = String(v);
      });
    },
  });
}

// "See inside" plays the film for visitors who do not scroll
$("[data-explode]")?.addEventListener("click", () => {
  const top = hero.offsetTop + hero.offsetHeight - window.innerHeight;
  if (lenis) lenis.scrollTo(top, { duration: 3.2, easing: (t: number) => 1 - Math.pow(1 - t, 3) });
  else window.scrollTo({ top, behavior: "smooth" });
});

// idle float at the top of the page (stops as soon as the film starts)
if (!reduceMotion) {
  gsap.to(canvas, { y: -4, duration: 2.5, ease: "sine.inOut", yoyo: true, repeat: -1 });
}

/* ---------------- Nav: hide on scroll down, show on scroll up ---------------- */
const nav = $("[data-nav]")!;
let lastY = window.scrollY;
const onScroll = () => {
  const y = window.scrollY;
  const menuOpen = $("[data-menu]")?.hidden === false;
  if (!menuOpen) nav.classList.toggle("is-hidden", y > lastY && y > 160);
  lastY = y;
};
window.addEventListener("scroll", onScroll, { passive: true });

/* ---------------- Mobile menu ---------------- */
const toggle = $<HTMLButtonElement>("[data-menu-toggle]")!;
const menu = $("[data-menu]")!;
function closeMenu() {
  menu.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
  lenis?.start();
}
toggle.addEventListener("click", () => {
  const open = menu.hidden;
  menu.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  document.body.style.overflow = open ? "hidden" : "";
  if (open) lenis?.stop(); else lenis?.start();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) closeMenu(); });

/* ---------------- Buy bar: after the hero, hidden over Compare ---------------- */
const buybar = $("[data-buybar]")!;
const compare = $("#compare")!;
let pastHero = false;
let overCompare = false;
const updateBar = () => buybar.classList.toggle("is-visible", pastHero && !overCompare);
ScrollTrigger.create({ trigger: hero, start: "bottom 80%", onEnter: () => { pastHero = true; updateBar(); }, onLeaveBack: () => { pastHero = false; updateBar(); } });
ScrollTrigger.create({ trigger: compare, start: "top 85%", end: "bottom 15%", onToggle: (s) => { overCompare = s.isActive; updateBar(); } });

/* ---------------- Spec tabs (sliding thumb, arrow keys) ---------------- */
const tablist = $("[data-tabs]")!;
const tabs = $$<HTMLButtonElement>('[role="tab"]', tablist);
const thumb = $("[data-tab-thumb]", tablist)!;
function moveThumb(btn: HTMLButtonElement) {
  thumb.style.width = `${btn.offsetWidth}px`;
  thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
}
function selectTab(btn: HTMLButtonElement) {
  tabs.forEach((t) => {
    const on = t === btn;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(t.getAttribute("aria-controls")!)!;
    panel.hidden = !on;
  });
  moveThumb(btn);
  const panel = document.getElementById(btn.getAttribute("aria-controls")!)!;
  if (!reduceMotion) gsap.fromTo(panel.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: "power2.out" });
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => selectTab(t));
  t.addEventListener("keydown", (e) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    next.focus();
    selectTab(next);
  });
});
requestAnimationFrame(() => moveThumb(tabs[0]));
window.addEventListener("resize", () => moveThumb(tabs.find((t) => t.getAttribute("aria-selected") === "true")!));
document.fonts?.ready.then(() => moveThumb(tabs.find((t) => t.getAttribute("aria-selected") === "true")!));

/* ---------------- Storage toggle with rolling price ---------------- */
const storage = $("[data-storage]")!;
const priceOut = $("[data-price-out]")!;
const monthlyOut = $("[data-monthly-out]")!;
const priceState = { v: 999 };
$$<HTMLButtonElement>('[role="radio"]', storage).forEach((b, i, all) => {
  const pick = () => {
    all.forEach((o) => { o.setAttribute("aria-checked", String(o === b)); o.tabIndex = o === b ? 0 : -1; });
    const target = Number(b.dataset.price);
    gsap.to(priceState, {
      v: target,
      duration: reduceMotion ? 0 : 0.6,
      ease: "power3.out",
      onUpdate: () => {
        priceOut.textContent = Math.round(priceState.v).toLocaleString("en-US");
        monthlyOut.textContent = (priceState.v / 24).toFixed(2);
      },
    });
  };
  b.addEventListener("click", pick);
  b.addEventListener("keydown", (e) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    const next = all[(i + dir + all.length) % all.length];
    next.focus();
    next.click();
  });
});

/* ---------------- Buy buttons: bag toast ---------------- */
const toast = $("[data-toast]")!;
let toastTimer = 0;
$$<HTMLAnchorElement>("[data-buy]").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    toast.textContent = `${a.dataset.buy} added to your bag`;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-on"), 2600);
  });
});

/* ---------------- One FAQ open at a time ---------------- */
const faqs = $$<HTMLDetailsElement>(".faq details");
faqs.forEach((d) => d.addEventListener("toggle", () => { if (d.open) faqs.forEach((o) => { if (o !== d) o.open = false; }); }));

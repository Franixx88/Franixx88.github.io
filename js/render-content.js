import { CONTENT as C } from "./content.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Split text into spans so letters can rise in one by one.
const letters = (s) => [...s].map((ch, i) =>
  ch === " " ? '<span class="sp"> </span>' : `<span class="ch" style="--i:${i}">${esc(ch)}</span>`).join("");

export function renderContent(root = document) {
  root.querySelector("#intro").innerHTML = `
    <div class="intro">
      <p class="kicker mono reveal">signal received · <span class="accent">${esc(C.nick)}</span></p>
      <h1 class="title" aria-label="${esc(C.name)}">
        ${C.name.split(" ").map((w) => `<span class="word">${letters(w)}</span>`).join(" ")}
      </h1>
      <p class="meta mono reveal">
        <span><b>${C.age}</b> years</span><i></i>
        <span>born in <b>${esc(C.born)}</b></span><i></i>
        <span>lives in <b>${esc(C.lives)}</b></span>
      </p>
      <p class="tagline reveal">${esc(C.tagline)}</p>
      <div class="scroll-cue mono reveal"><span>follow the chain</span><div class="cue-line"></div></div>
    </div>`;

  root.querySelector("#code").innerHTML = `
    <article class="panel reveal">
      <p class="label mono"><span class="num">01</span> the machine</p>
      <h2 class="big">${esc(C.code.main)}</h2>
      <p class="badge mono"><span class="pulse"></span>level · <b>${esc(C.code.level)}</b></p>
      <p class="body">${esc(C.code.blurb)}</p>
      <ul class="runes">
        ${C.code.others.map((o, i) => `
          <li class="rune" style="--i:${i}">
            <span class="glyph mono">${String(i + 1).padStart(2, "0")}</span>
            <span class="rune-name">${esc(o.name)}</span>
            ${o.note ? `<span class="note mono">${esc(o.note)}</span>` : ""}
          </li>`).join("")}
      </ul>
    </article>`;

  root.querySelector("#chess").innerHTML = `
    <article class="panel reveal">
      <p class="label mono"><span class="num">02</span> the board</p>
      <div class="title-row">
        <div class="nm" aria-hidden="true">${esc(C.chess.title)}</div>
        <div>
          <h2 class="mid">${esc(C.chess.titleFull)}</h2>
          <p class="body small">${esc(C.chess.blurb)}</p>
        </div>
      </div>
      <div class="ratings">
        ${C.chess.ratings.map((r, i) => `
          <div class="rating" data-rating="${esc(r.label)}" style="--i:${i}">
            <span class="r-label mono">${esc(r.label)}</span>
            <span class="value" data-target="${r.value}">${r.value}</span>
            <span class="r-bar"><span style="--w:${Math.min(1, (r.value - 1800) / 1000)}"></span></span>
          </div>`).join("")}
      </div>
      <p class="fide mono">FIDE ratings</p>
    </article>`;

  root.querySelector("#contact").innerHTML = `
    <div class="contact reveal">
      <p class="label mono"><span class="num">03</span> the core</p>
      <h2 class="mid">You reached the bottom.</h2>
      <p class="body">The king is yours to turn — drag it. Then send a signal.</p>
      <div class="links">
        ${C.links.map((l) => `
          <a class="link" href="${esc(l.url)}" target="_blank" rel="noopener">
            <span class="l-label mono">${esc(l.label)}</span>
            <span class="l-handle">${esc(l.handle)}</span>
            <span class="l-arrow" aria-hidden="true">↗</span>
          </a>`).join("")}
      </div>
      <p class="sig mono">© ${new Date().getFullYear()} ${esc(C.name)} · Dnipro, Ukraine</p>
    </div>`;
}

// Count numbers up from a low value when they come into view.
export function countUp(el, reduced) {
  const target = +el.dataset.target;
  if (reduced) { el.textContent = target; return; }
  const from = Math.round(target * 0.55), dur = 1600, t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 4);
    el.textContent = Math.round(from + (target - from) * e);
    if (k < 1) requestAnimationFrame(step); else el.textContent = target;
  };
  requestAnimationFrame(step);
}

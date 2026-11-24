// =================================================================
// Harmony Clinical Center · Agenda — aplicação
// =================================================================
import { createStore } from "./store.js";
import { readSpreadsheet, exportSpreadsheet, parseMoney, parseTime } from "./excel.js";
import {
  LOGIN_DOMAIN, SETOR_PADRAO, SETORES_POR_USUARIO, PROCEDIMENTOS_PADRAO,
  HORA_INICIO, HORA_FIM, INTERVALO_MIN,
} from "./firebase-config.js";

const VERSION = "3.0.0";

// ================================================================ utils
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoOf(new Date());
const dateOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const addMonths = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const brDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const brShort = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "");
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const money = (v) => BRL.format(Number(v) || 0);
const money0 = (v) => BRL0.format(Math.round(Number(v) || 0));
const int = (v) => String(Math.round(v));
const moneyInput = (v) => (Number(v) ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const fmtLong = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const fmtWeekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const fmtMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const weekdayName = (d) => cap(fmtWeekday.format(d).replace("-feira", ""));
const normName = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const initials = (n) => String(n || "?").trim().split(/\s+/).filter((p) => /\p{L}/u.test(p)).slice(0, 2).map((p) => p.match(/\p{L}/u)[0]).join("").toUpperCase() || "?";
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const SMALL = new Set(["de", "da", "do", "dos", "das", "e", "d"]);
const titleCase = (s) => String(s || "").trim().replace(/\s+/g, " ").split(" ").map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
const firstUpper = (s) => { const t = String(s || "").trim().replace(/\s+/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
const toMin = (hhmm) => { const [h, m] = (hhmm || "0:0").split(":").map(Number); return h * 60 + m; };
const slotOf = (hhmm) => { const m = Math.floor(toMin(hhmm) / INTERVALO_MIN) * INTERVALO_MIN; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const hueClass = (name) => { let h = 0; for (const c of normName(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `avatar--h${1 + (h % 6)}`; };
const plural = (n, s, p = s + "s") => `${n} ${n === 1 ? s : p}`;
const isDesktop = () => window.innerWidth >= 1024;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const STATUS = { pendente: "Pendente", concluido: "Concluído", cancelado: "Cancelado" };

const ICON = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  ban: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.2-1.8-1-1 .7a4 4 0 0 1-2.4-2.4l.7-1-1-1.8Z"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1.2-3.6 3.7-5.5 6.5-5.5s5.3 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.4.9 2.4 2.6 3 5.2"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 8v5M12 16.5h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.4-1-1.5-1.7-2.8-1.7-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.5 5.8 4.6 0 1.2-1.3 2.3-3 2.3-1.4 0-2.6-.7-3-1.8M12 6v1.5M12 16.5V18"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  sunset: '<svg viewBox="0 0 24 24"><path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

const SLOTS = (() => { const out = []; for (let m = HORA_INICIO * 60; m <= HORA_FIM * 60; m += INTERVALO_MIN) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`); return out; })();

// ================================================================ estado
const S = {
  store: null, user: null, setor: SETOR_PADRAO,
  items: [], byId: new Map(), loaded: false, rev: 0,
  sel: today(), calMonth: today().slice(0, 7), finMonth: today().slice(0, 7),
  weekStart: null, showFree: localStorage.getItem("hcc-show-free") !== "0",
  view: "agenda", sort: "recentes", procs: [], unsub: [],
  counters: {}, cache: {}, flashId: null, firstPaint: true,
};
const memo = (key, fn) => { const c = S.cache[key]; if (c && c.rev === S.rev) return c.v; const v = fn(); S.cache[key] = { rev: S.rev, v }; return v; };

// ================================================================ movimento
const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
function restartAnim(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function countUp(el, value, fmt, key) {
  if (!el) return;
  const from = S.counters[key] ?? 0;
  S.counters[key] = value;
  if (REDUCED || from === value) { el.textContent = fmt(value); return; }
  const t0 = performance.now(), dur = 560;
  el.textContent = fmt(from);
  const step = (t) => {
    if (!el.isConnected) return;
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (value - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ripple em tudo que é tocável
const RIPPLE = ".btn, .icon-btn, .chip, .bottomnav__item, .bottomnav__fab, .sidenav__item, .free, .appt__main, .client, .history li, .slotpick button, .daybar__date, .wday";
document.addEventListener("pointerdown", (e) => {
  if (REDUCED || e.button > 0) return;
  const el = e.target.closest(RIPPLE);
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement("span");
  s.className = "ripple";
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  el.appendChild(s);
  s.addEventListener("animationend", () => s.remove(), { once: true });
}, { passive: true });

// ================================================================ toast
function toast(msg, { type = "ok", action, onAction, ms } = {}) {
  ms ??= action ? 5500 : 3000;
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.setAttribute("role", "status");
  el.innerHTML = `<span class="toast__icon">${type === "error" ? ICON.alert : ICON.check}</span><span class="toast__msg">${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button><i class="toast__bar" style="animation-duration:${ms}ms"></i>` : ""}`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  let gone = false;
  const kill = () => {
    if (gone) return; gone = true;
    el.classList.add("is-out");
    el.addEventListener("animationend", (ev) => { if (ev.target === el) el.remove(); });
    setTimeout(() => el.remove(), 500);
  };
  if (action) el.querySelector("button").addEventListener("click", () => { onAction?.(); haptic(); kill(); });
  el.addEventListener("click", (ev) => { if (!ev.target.closest("button")) kill(); });
  setTimeout(kill, ms);
}
function fail(e) {
  console.error(e);
  const denied = e?.code === "PERMISSION_DENIED" || /permission/i.test(e?.message || "");
  toast(denied ? "Sem permissão no banco de dados. Confira as regras do Firebase." : "Não foi possível salvar. Verifique a internet.", { type: "error", ms: 6000 });
}
const fire = (p) => Promise.resolve(p).catch(fail);

// ================================================================ painel (sheet)
const sheet = { open: false, onClose: null, ignorePop: false, t: 0 };
const sheetEl = $("#sheet"), sheetPanel = $(".sheet__panel"), sheetBody = $("#sheet-body"), sheetBackdrop = $(".sheet__backdrop");

function openSheet(title, html, { onClose } = {}) {
  $("#sheet-title").textContent = title;
  sheetBody.innerHTML = html;
  sheetBody.scrollTop = 0;
  sheet.onClose = onClose || null;
  if (sheet.open) { restartAnim(sheetBody, "is-swap"); return sheetBody; }
  sheet.open = true;
  clearTimeout(sheet.t);
  sheetEl.hidden = false;
  sheetEl.classList.remove("is-closing");
  void sheetPanel.offsetHeight;
  sheetEl.classList.add("is-open");
  document.documentElement.classList.add("is-locked");
  if (!sheet.ignorePop) history.pushState({ sheet: true }, "");
  return sheetBody;
}
function closeSheet(fromPop = false) {
  if (!sheet.open) return;
  sheet.open = false;
  sheetEl.classList.remove("is-open");
  sheetEl.classList.add("is-closing");
  document.documentElement.classList.remove("is-locked");
  const cb = sheet.onClose; sheet.onClose = null; cb?.();
  clearTimeout(sheet.t);
  sheet.t = setTimeout(() => { if (!sheet.open) { sheetEl.hidden = true; sheetEl.classList.remove("is-closing"); sheetBody.innerHTML = ""; } }, 320);
  if (!fromPop && history.state?.sheet) { sheet.ignorePop = true; history.back(); }
}
window.addEventListener("popstate", () => {
  if (sheet.ignorePop) {
    sheet.ignorePop = false;
    if (sheet.open) history.pushState({ sheet: true }, "");
    return;
  }
  closeSheet(true);
});
sheetEl.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });

// arrastar para fechar (celular)
(() => {
  let d = null;
  sheetPanel.addEventListener("pointerdown", (e) => {
    if (window.innerWidth >= 720 || !e.target.closest(".sheet__grab") || e.target.closest("button")) return;
    d = { y0: e.clientY, t0: performance.now(), dy: 0, id: e.pointerId, h: sheetPanel.offsetHeight };
    sheetPanel.setPointerCapture(e.pointerId);
    sheetPanel.style.transition = "none";
    sheetBackdrop.style.transition = "none";
  });
  sheetPanel.addEventListener("pointermove", (e) => {
    if (!d || e.pointerId !== d.id) return;
    let dy = e.clientY - d.y0;
    dy = dy < 0 ? dy * 0.2 : dy;
    d.dy = dy;
    sheetPanel.style.transform = `translate3d(0,${dy}px,0)`;
    sheetBackdrop.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / d.h));
  });
  const end = (e) => {
    if (!d || (e.pointerId !== undefined && e.pointerId !== d.id)) return;
    const { dy, t0 } = d; d = null;
    const v = dy / Math.max(1, performance.now() - t0);
    sheetPanel.style.transition = ""; sheetBackdrop.style.transition = "";
    sheetPanel.style.transform = ""; sheetBackdrop.style.opacity = "";
    if (dy > 120 || (v > 0.6 && dy > 30)) { haptic(6); closeSheet(); }
  };
  sheetPanel.addEventListener("pointerup", end);
  sheetPanel.addEventListener("pointercancel", end);
})();

// Resolve true (confirmou), false (voltar) ou null (fechou o painel).
// keepOpen: não fecha ao responder — quem chamou troca o conteúdo.
function confirmDialog({ title, text, ok = "Confirmar", danger = false, typeToConfirm, keepOpen = false, icon }) {
  return new Promise((resolve) => {
    let done = false;
    const body = openSheet(title, `
      <div class="confirm">
        <div class="confirm__icon ${danger ? "confirm__icon--danger" : ""}">${icon || (danger ? ICON.trash : ICON.alert)}</div>
        <p>${text}</p>
        ${typeToConfirm ? `<label class="field"><span class="field__label">Digite <b>${esc(typeToConfirm)}</b> para confirmar</span><input class="input" id="confirm-type" autocomplete="off" autocapitalize="characters" /></label>` : ""}
        <div class="row-2">
          <button class="btn btn--outline" data-r="0">Voltar</button>
          <button class="btn ${danger ? "btn--danger" : "btn--dark"}" data-r="1" ${typeToConfirm ? "disabled" : ""}>${esc(ok)}</button>
        </div>
      </div>`, { onClose: () => { if (!done) { done = true; resolve(null); } } });
    if (typeToConfirm) {
      const inp = $("#confirm-type", body), b = $('[data-r="1"]', body);
      inp.addEventListener("input", () => (b.disabled = inp.value.trim().toUpperCase() !== typeToConfirm));
      if (isDesktop()) setTimeout(() => inp.focus(), 200);
    }
    $$("[data-r]", body).forEach((b) => b.addEventListener("click", () => {
      done = true;
      const r = b.dataset.r === "1";
      if (!keepOpen) { sheet.onClose = null; closeSheet(); }
      resolve(r);
    }));
  });
}

// ================================================================ dados
const active = (i) => i.status !== "cancelado";
const dayItems = (iso) => S.items.filter((i) => i.data === iso).sort((a, b) => (a.horario || "").localeCompare(b.horario || "") || a.cliente.localeCompare(b.cliente));
const busyMap = (iso, ignoreId) => { const m = new Map(); S.items.forEach((i) => { if (i.data === iso && active(i) && i.id !== ignoreId && i.horario) m.set(i.horario, i.cliente); }); return m; };
const daysWithItems = () => memo("days", () => { const s = new Set(); S.items.forEach((i) => active(i) && s.add(i.data)); return s; });

function knownClients() {
  return memo("clients", () => {
    const t = today(); const map = new Map();
    for (const i of S.items) {
      const k = normName(i.cliente); if (!k) continue;
      let c = map.get(k);
      if (!c) { c = { key: k, nome: i.cliente, telefone: "", telData: "", visitas: 0, gasto: 0, ultima: "", proxima: "", itens: [] }; map.set(k, c); }
      c.itens.push(i);
      if (active(i)) c.visitas++;
      if (i.status === "concluido") c.gasto += i.valor;
      if (i.telefone && i.data >= c.telData) { c.telefone = i.telefone; c.telData = i.data; }
      if (active(i) && i.data <= t && i.data > c.ultima) { c.ultima = i.data; c.nome = i.cliente; }
      if (active(i) && i.data > t && (!c.proxima || i.data < c.proxima)) c.proxima = i.data;
    }
    return [...map.values()];
  });
}

function procStats() {
  return memo("procs", () => {
    const m = new Map();
    for (const i of S.items) {
      const k = normName(i.procedimento); if (!k) continue;
      let s = m.get(k);
      if (!s) { s = { key: k, n: 0, names: new Map(), lastValor: 0, lastData: "" }; m.set(k, s); }
      s.n++;
      s.names.set(i.procedimento, (s.names.get(i.procedimento) || 0) + 1);
      if (i.valor > 0 && (i.data || "") >= s.lastData) { s.lastValor = i.valor; s.lastData = i.data || ""; }
    }
    m.forEach((s) => { s.nome = [...s.names.entries()].sort((a, b) => b[1] - a[1])[0][0]; });
    return m;
  });
}
function suggestedValue(proc) {
  const conf = S.procs.find((p) => normName(p.nome) === normName(proc));
  if (conf?.valor) return conf.valor;
  return procStats().get(normName(proc))?.lastValor || 0;
}
function procOptions() {
  const out = new Map();
  S.procs.forEach((p) => out.set(normName(p.nome), p.nome));
  [...procStats().values()].sort((a, b) => b.n - a.n).forEach((s) => { if (!out.has(s.key)) out.set(s.key, s.nome); });
  return [...out.values()];
}

// ================================================================ inicialização / login
async function boot() {
  try {
    S.store = await createStore();
  } catch (e) {
    console.error(e);
    $("#splash").innerHTML = `<div class="empty"><div class="empty__art">${ICON.alert}</div><h4>Sem conexão</h4><p>Não foi possível carregar o sistema. Verifique a internet e recarregue.</p><button class="btn btn--dark" onclick="location.reload()">Tentar de novo</button></div>`;
    return;
  }
  $("#app-version").textContent = `Versão ${VERSION} · ${S.store.mode === "demo" ? "modo demonstração (dados fictícios neste aparelho)" : "Firebase em tempo real"}`;
  S.store.onAuth((u) => (u ? enter(u) : showLogin()));
}
function hideSplash() { const s = $("#splash"); if (!s) return; s.classList.add("is-out"); setTimeout(() => s.remove(), 500); }

const userInput = $("#login-usuario"), passInput = $("#login-senha");
function syncGhost() {
  $("#ghost-typed").textContent = userInput.value;
  $(".ghost").classList.toggle("is-on", !!userInput.value);
}
userInput.addEventListener("input", () => {
  const v = userInput.value, clean = v.toLowerCase().replace(/\s+/g, "").split("@")[0];
  if (clean !== v) userInput.value = clean;
  userInput.classList.remove("is-invalid");
  syncGhost();
});
userInput.addEventListener("keydown", (e) => { if (e.key === "@") { e.preventDefault(); passInput.focus(); } });
passInput.addEventListener("input", () => passInput.classList.remove("is-invalid"));
["keydown", "keyup"].forEach((ev) => passInput.addEventListener(ev, (e) => { if (e.getModifierState) $("#caps-warn").hidden = !e.getModifierState("CapsLock"); }));
passInput.addEventListener("blur", () => ($("#caps-warn").hidden = true));
$("#toggle-senha").addEventListener("click", (e) => {
  const on = passInput.type === "password";
  passInput.type = on ? "text" : "password";
  e.currentTarget.setAttribute("aria-pressed", String(on));
  passInput.focus({ preventScroll: true });
});

function showLogin() {
  S.unsub.forEach((f) => { try { f?.(); } catch {} }); S.unsub = [];
  S.items = []; S.loaded = false; S.user = null; S.counters = {}; S.rev++;
  closeSheet();
  $("#app").hidden = true;
  const login = $("#login");
  login.hidden = false;
  restartAnim($(".login__card"), "is-in");
  const last = localStorage.getItem("hcc-last-user") || "";
  if (last && !userInput.value) userInput.value = last;
  syncGhost();
  hideSplash();
  if (isDesktop()) setTimeout(() => (userInput.value ? passInput : userInput).focus(), 300);
}

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const card = $(".login__card"), err = $("#login-erro"), btn = $("#btn-login");
  const user = userInput.value.trim(), pass = passInput.value;
  err.textContent = "";
  const bad = (msg, input) => { err.textContent = msg; input?.classList.add("is-invalid"); input?.focus(); restartAnim(card, "is-shake"); haptic([10, 40, 10]); };
  if (!user) return bad("Digite seu usuário.", userInput);
  if (!pass) return bad("Digite sua senha.", passInput);
  btn.classList.add("is-loading"); btn.disabled = true;
  try {
    await S.store.login(user, pass);
    localStorage.setItem("hcc-last-user", user);
    passInput.value = "";
  } catch (ex) {
    console.warn(ex);
    const code = ex?.code || "";
    bad(/network/.test(code) ? "Sem internet. Verifique a conexão e tente de novo."
      : /too-many/.test(code) ? "Muitas tentativas. Aguarde alguns minutos."
      : /user-disabled/.test(code) ? "Este usuário está desativado."
      : `Usuário ou senha incorretos (${user}${LOGIN_DOMAIN}).`, passInput);
  } finally { btn.classList.remove("is-loading"); btn.disabled = false; }
});

async function enter(u) {
  if (S.user && S.user.email === u.email) return;
  S.user = u; S.loadError = null;
  S.setor = SETORES_POR_USUARIO[u.username.toLowerCase()] || SETOR_PADRAO;
  const nome = cap(u.username);
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#setor-label").textContent = S.setor.label;
  $("#me-name").textContent = nome;
  $("#me-setor").textContent = `Setor ${S.setor.label}`;
  const av = $("#me-avatar"); av.textContent = initials(nome); av.className = `avatar avatar--sm ${hueClass(nome)}`;
  document.title = `HCC · ${S.setor.label}`;
  S.firstPaint = true;
  go(S.view, { silent: true });
  hideSplash();
  await loadProcs();
  S.unsub.push(S.store.watch(S.setor.key, (list) => {
    S.items = list.map((i) => ({ ...i, cliente: String(i.cliente || "Sem nome"), procedimento: String(i.procedimento || "Não informado"), valor: Number(i.valor) || 0, horario: i.horario || "", status: STATUS[i.status] ? i.status : "pendente" }));
    S.byId = new Map(S.items.map((i) => [i.id, i]));
    S.rev++;
    const first = !S.loaded;
    S.loaded = true;
    renderView({ animate: first });
  }, (e) => {
    console.error(e);
    S.loadError = /permission/i.test(e?.message || e?.code || "") ? "Sem permissão para ler a agenda. Confira as regras do Realtime Database no Firebase." : "Não foi possível carregar a agenda. Verifique a internet e recarregue.";
    S.loaded = true; S.items = []; S.byId = new Map(); S.rev++;
    renderView();
  }));
  S.unsub.push(S.store.watchConnection((on) => {
    $$("#status-dot, #status-dot-m").forEach((d) => d.classList.toggle("is-on", on));
    $("#status-text").textContent = on ? "Online · tempo real" : "Sem conexão — salva ao reconectar";
    $("#conn-pill").title = on ? "Online" : "Sem conexão";
  }));
}

$$('[data-action="sair"]').forEach((b) => b.addEventListener("click", async () => {
  const ok = await confirmDialog({ title: "Sair", text: "Deseja sair da conta neste aparelho?", ok: "Sair", icon: '<svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/></svg>' });
  if (ok) S.store.logout();
}));

// ================================================================ procedimentos (config)
async function loadProcs() {
  const key = `procedimentos_${S.setor.key}`;
  let list = await S.store.getConfig(key);
  if (!Array.isArray(list)) { try { list = JSON.parse(localStorage.getItem("hcc-" + key)); } catch { list = null; } }
  if (!Array.isArray(list)) list = (PROCEDIMENTOS_PADRAO[S.setor.key] || []).map((nome) => ({ nome, valor: 0 }));
  S.procs = list.filter((p) => p && p.nome);
}
async function saveProcs() {
  const key = `procedimentos_${S.setor.key}`;
  localStorage.setItem("hcc-" + key, JSON.stringify(S.procs));
  await S.store.setConfig(key, S.procs);
}

// ================================================================ navegação
const NAV_INDEX = { agenda: 0, clientes: 1, financeiro: 3, ajustes: 4 };
function go(view, { silent = false } = {}) {
  const changed = view !== S.view;
  S.view = view;
  $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === `view-${view}`));
  $$("[data-view]").forEach((b) => b.classList.toggle("is-active", b.dataset.view === view));
  $(".bottomnav").style.setProperty("--i", NAV_INDEX[view]);
  moveSideIndicator();
  const t = $("#view-title");
  t.textContent = $(`#view-${view}`).dataset.title;
  if (changed) restartAnim(t, "is-swap");
  if (!silent) { window.scrollTo({ top: 0 }); haptic(5); }
  renderView({ animate: changed });
}
function moveSideIndicator() {
  const item = $(`.sidenav__item[data-view="${S.view}"]`), ind = $(".sidenav__ind");
  if (item && ind) ind.style.transform = `translateY(${item.offsetTop}px)`;
}
$$("[data-view]").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
let scrolled = false;
window.addEventListener("scroll", () => { const s = window.scrollY > 6; if (s !== scrolled) { scrolled = s; $(".topbar").classList.toggle("is-scrolled", s); } }, { passive: true });
let rzT;
window.addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { moveSideIndicator(); moveSegInd(); if (S.user && S.view === "agenda") { renderCalendar(); renderSummary(); } placeNowLine(); }, 120); });

function renderView(opts = {}) {
  if (!S.user) return;
  if (S.view === "agenda") renderAgenda(opts);
  else if (S.view === "clientes") renderClientes(opts);
  else if (S.view === "financeiro") renderFinanceiro(opts);
  else if (S.view === "ajustes") renderAjustes();
}

// ================================================================ AGENDA
function setDay(iso) {
  if (iso === S.sel) return;
  const dir = iso > S.sel ? 1 : -1;
  S.sel = iso; S.calMonth = iso.slice(0, 7);
  haptic(4);
  renderAgenda({ dir });
}
$$("[data-day]").forEach((b) => b.addEventListener("click", () => setDay(addDays(S.sel, Number(b.dataset.day)))));
$("#btn-hoje").addEventListener("click", () => setDay(today()));
$("#daybar-date").addEventListener("click", () => { const p = $("#daybar-picker"); p.value = S.sel; try { p.showPicker(); } catch { p.click(); } });
$("#daybar-picker").addEventListener("change", (e) => e.target.value && setDay(e.target.value));
$("#toggle-livres").checked = S.showFree;
$("#toggle-livres").addEventListener("change", (e) => { S.showFree = e.target.checked; localStorage.setItem("hcc-show-free", S.showFree ? "1" : "0"); haptic(4); renderTimeline({ animate: true }); });

// deslizar para trocar de dia (celular)
(() => {
  let x0 = null, y0 = 0, t0 = 0;
  const el = $("#timeline-wrap");
  el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.7 && Date.now() - t0 < 600) setDay(addDays(S.sel, dx < 0 ? 1 : -1));
  }, { passive: true });
})();

function renderAgenda({ animate = false, dir = 0 } = {}) {
  const d = dateOf(S.sel), t = today();
  const rel = S.sel === t ? "Hoje" : S.sel === addDays(t, 1) ? "Amanhã" : S.sel === addDays(t, -1) ? "Ontem" : weekdayName(d);
  const longTxt = d.getFullYear() === new Date().getFullYear() ? fmtLong.format(d).replace(/ de \d{4}$/, "") : fmtLong.format(d);
  const wk = weekdayName(d);
  const full = $("#daybar-full");
  if (isDesktop()) { $("#daybar-rel").textContent = rel; full.textContent = (rel !== wk ? wk + ", " : "") + longTxt; }
  else { $("#daybar-rel").textContent = rel !== wk ? `${rel} · ${wk}` : wk; full.textContent = longTxt; }
  if (dir) restartAnim(full, "is-swap");
  $("#btn-hoje").hidden = S.sel === t;
  renderBanner();
  renderWeekstrip(dir);
  renderCalendar();
  renderSummary();
  renderTimeline({ animate: animate || S.firstPaint, dir });
}

function renderBanner() {
  const box = $("#agenda-banner");
  let html = "";
  if (S.loadError) {
    html = `<div class="banner"><span class="banner__icon">${ICON.alert}</span><div class="banner__body"><strong>Algo impediu a leitura dos dados</strong>${esc(S.loadError)}</div></div>`;
  } else if (S.loaded && S.items.length === 0) {
    html = `<div class="banner"><span class="banner__icon">${ICON.upload}</span><div class="banner__body"><strong>Sua agenda ainda está vazia</strong>Traga os atendimentos do sistema antigo importando o relatório em Excel.<br><button class="btn btn--gold btn--sm" data-goto="ajustes">Importar planilha</button></div></div>`;
  } else if (S.loaded && !localStorage.getItem("hcc-tip-v3")) {
    html = isDesktop()
      ? `<div class="banner" data-tip><span class="banner__icon">${ICON.sparkle}</span><div class="banner__body"><strong>Atalhos do teclado</strong><kbd>←</kbd> <kbd>→</kbd> trocam o dia · <kbd>T</kbd> volta para hoje · <kbd>N</kbd> novo agendamento · clique num horário livre para agendar ali.</div><button class="banner__close" data-tip-close aria-label="Fechar dica">${ICON.x}</button></div>`
      : `<div class="banner" data-tip><span class="banner__icon">${ICON.hand}</span><div class="banner__body"><strong>Dica rápida</strong>Toque num horário livre para agendar · deslize para os lados para trocar de dia · toque no ✓ para concluir.</div><button class="banner__close" data-tip-close aria-label="Fechar dica">${ICON.x}</button></div>`;
  }
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
$("#agenda-banner").addEventListener("click", (e) => {
  if (e.target.closest("[data-goto]")) go(e.target.closest("[data-goto]").dataset.goto);
  if (e.target.closest("[data-tip-close]")) {
    localStorage.setItem("hcc-tip-v3", "1");
    const b = $("#agenda-banner .banner");
    b.classList.add("is-out");
    b.addEventListener("animationend", () => { $("#agenda-banner").innerHTML = ""; $("#agenda-banner").dataset.html = ""; }, { once: true });
  }
});

function renderWeekstrip(dir) {
  const strip = $("#weekstrip");
  const d = dateOf(S.sel);
  const start = addDays(S.sel, -d.getDay());
  const has = daysWithItems();
  const wd = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  let ind = $(".weekstrip__ind", strip);
  if (!ind) { ind = document.createElement("span"); ind.className = "weekstrip__ind"; strip.prepend(ind); }
  $$(".wday", strip).forEach((b) => b.remove());
  strip.insertAdjacentHTML("beforeend", Array.from({ length: 7 }, (_, k) => {
    const iso = addDays(start, k);
    return `<button class="wday ${iso === S.sel ? "is-sel" : ""} ${iso === today() ? "is-today" : ""} ${has.has(iso) ? "has" : ""}" data-iso="${iso}" aria-label="${weekdayName(dateOf(iso))}, ${brDate(iso)}"><small>${wd[k]}</small><b>${Number(iso.slice(8))}</b><i></i></button>`;
  }).join(""));
  const weekChanged = S.weekStart && S.weekStart !== start;
  if (weekChanged) {
    ind.style.transition = "none";
    ind.style.setProperty("--i", d.getDay());
    void ind.offsetWidth; ind.style.transition = "";
    restartAnim(strip, dir >= 0 ? "is-slide-l" : "is-slide-r");
  } else ind.style.setProperty("--i", d.getDay());
  S.weekStart = start;
}
$("#weekstrip").addEventListener("click", (e) => { const b = e.target.closest(".wday"); if (b) setDay(b.dataset.iso); });

function renderCalendar() {
  const box = $("#calendar");
  if (!isDesktop() && !box.innerHTML) return; // só é visível no computador
  const [y, m] = S.calMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1, 12);
  const start = addDays(isoOf(first), -first.getDay());
  const has = daysWithItems();
  let cells = "";
  for (let k = 0; k < 42; k++) {
    const iso = addDays(start, k);
    const out = iso.slice(0, 7) !== S.calMonth;
    if (k === 35 && out) break;
    cells += `<button class="cal__day ${out ? "is-out" : ""} ${iso === today() ? "is-today" : ""} ${iso === S.sel ? "is-sel" : ""} ${has.has(iso) ? "has" : ""}" data-iso="${iso}">${Number(iso.slice(8))}</button>`;
  }
  const prevMonth = box.dataset.month;
  box.innerHTML = `
    <div class="cal__head">
      <span class="cal__title">${cap(fmtMonth.format(first))}</span>
      <div class="cal__nav">
        <button class="icon-btn" data-cal="-1" aria-label="Mês anterior"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
        <button class="icon-btn" data-cal="1" aria-label="Próximo mês"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
      </div>
    </div>
    <div class="cal__grid ${prevMonth && prevMonth !== S.calMonth ? "is-swap" : ""}">${["D", "S", "T", "Q", "Q", "S", "S"].map((w) => `<span class="cal__wd">${w}</span>`).join("")}${cells}</div>`;
  box.dataset.month = S.calMonth;
}
$("#calendar").addEventListener("click", (e) => {
  const nav = e.target.closest("[data-cal]");
  if (nav) { S.calMonth = addMonths(S.calMonth, Number(nav.dataset.cal)); renderCalendar(); return; }
  const day = e.target.closest(".cal__day");
  if (day) setDay(day.dataset.iso);
});

function daySums(iso) {
  const s = { n: 0, rec: 0, prev: 0, canc: 0 };
  S.items.forEach((i) => {
    if (i.data !== iso) return;
    if (i.status === "cancelado") s.canc++;
    else { s.n++; if (i.status === "concluido") s.rec += i.valor; else s.prev += i.valor; }
  });
  return s;
}

function renderSummary() {
  const s = daySums(S.sel);
  const chips = $("#summary-chips");
  if (!chips.firstElementChild) chips.innerHTML = `
    <div class="stat"><span>${ICON.users}Atendimentos</span><strong id="st-n">0</strong></div>
    <div class="stat stat--gold"><span>${ICON.check}Recebido</span><strong id="st-rec">R$ 0</strong></div>
    <div class="stat"><span>${ICON.clock}A receber</span><strong id="st-prev">R$ 0</strong></div>`;
  countUp($("#st-n"), s.n, int, "st-n");
  countUp($("#st-rec"), s.rec, money0, "st-rec");
  countUp($("#st-prev"), s.prev, money0, "st-prev");
  if (!isDesktop()) return;
  const box = $("#day-summary");
  if (!box.firstElementChild) box.innerHTML = `
    <h3 class="card__title">Resumo do dia</h3>
    <div class="sum-hero"><span>Recebido</span><strong id="sum-rec">R$ 0,00</strong></div>
    <div class="sum-row"><span>A receber</span><strong id="sum-prev">R$ 0,00</strong></div>
    <div class="sum-row"><span>Previsto no dia</span><strong id="sum-tot">R$ 0,00</strong></div>
    <div class="sum-row"><span>Atendimentos</span><strong id="sum-n">0</strong></div>
    <div class="sum-row"><span>Cancelados</span><strong id="sum-c">0</strong></div>`;
  countUp($("#sum-rec"), s.rec, money, "sum-rec");
  countUp($("#sum-prev"), s.prev, money, "sum-prev");
  countUp($("#sum-tot"), s.rec + s.prev, money, "sum-tot");
  countUp($("#sum-n"), s.n, int, "sum-n");
  countUp($("#sum-c"), s.canc, int, "sum-c");
}

function apptCard(i) {
  const st = i.status;
  const offSlot = i.horario && slotOf(i.horario) !== i.horario;
  return `<article class="appt appt--${st}${i.id === S.flashId ? " is-flash" : ""}" data-id="${esc(i.id)}">
    <button class="appt__main" data-open="${esc(i.id)}" aria-label="${esc(i.cliente)}, ${esc(i.procedimento)}, ${esc(i.horario)}">
      <span class="appt__accent"></span>
      <span class="avatar ${hueClass(i.cliente)}">${esc(initials(i.cliente))}</span>
      <span class="appt__body">
        <span class="appt__name">${esc(i.cliente)}</span>
        <span class="appt__meta"><span>${esc(i.procedimento)}</span>${offSlot ? `<i class="dot-sep"></i><span>${esc(i.horario)}</span>` : ""}<i class="dot-sep appt__value--m"></i><span class="appt__value appt__value--m">${money0(i.valor)}</span>${st === "cancelado" ? '<span class="pill pill--cancelado">Cancelado</span>' : ""}</span>
      </span>
      <span class="appt__value appt__value--d">${money(i.valor)}</span>
    </button>
    ${st === "cancelado" ? "" : `<button class="appt__check" data-check="${esc(i.id)}" aria-label="${st === "concluido" ? "Concluído" : "Marcar como concluído"}" title="${st === "concluido" ? "Concluído" : "Concluir"}"><span>${ICON.check}</span></button>`}
  </article>`;
}

function renderTimeline({ animate = false, dir = 0 } = {}) {
  const el = $("#timeline"), wrap = $("#timeline-wrap");
  if (!S.loaded) {
    el.innerHTML = `<li class="skel"></li><li class="skel" style="opacity:.7"></li><li class="skel" style="opacity:.45"></li>`;
    $("#timeline-count").textContent = "Carregando agenda…";
    $("#nowline").hidden = true;
    return;
  }
  S.firstPaint = false;
  const list = dayItems(S.sel);
  const nAct = list.filter(active).length, nCanc = list.length - nAct;
  $("#timeline-count").innerHTML = list.length ? `${plural(nAct, "atendimento")}${nCanc ? ` <span>· ${plural(nCanc, "cancelado")}</span>` : ""}` : `<span>Nenhum atendimento</span>`;
  const groups = new Map();
  list.forEach((i) => { const k = i.horario ? slotOf(i.horario) : "--:--"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  const keys = S.showFree ? [...new Set([...SLOTS, ...groups.keys()])].sort() : [...groups.keys()].sort();
  if (!keys.length) {
    el.innerHTML = `<li class="empty"><div class="empty__art">${ICON.cal}</div><h4>Dia livre</h4><p>Nenhum agendamento em ${brDate(S.sel)}.</p><button class="btn btn--gold" data-new="">${ICON.plus}Agendar neste dia</button></li>`;
  } else {
    el.innerHTML = keys.map((k, idx) => {
      const items = groups.get(k);
      const label = k === "--:--" ? "s/ hora" : k;
      if (!items) return `<li class="slot slot--free" data-slot="${k}" style="--d:${Math.min(idx, 22)}"><span class="slot__time">${label}</span><div class="slot__items"><button class="free" data-new="${k}" aria-label="Agendar às ${k}"><span class="free__plus">${ICON.plus}</span><span class="free__txt">Livre</span><span class="free__hint">Agendar às ${k}</span></button></div></li>`;
      return `<li class="slot" data-slot="${k}" style="--d:${Math.min(idx, 22)}"><span class="slot__time">${label}</span><div class="slot__items">${items.map(apptCard).join("")}</div></li>`;
    }).join("");
  }
  if (animate && !REDUCED) restartAnim(el, "is-entering"); else el.classList.remove("is-entering");
  if (dir && !REDUCED) restartAnim(wrap, dir > 0 ? "is-slide-l" : "is-slide-r");
  placeNowLine();
  if (S.flashId) {
    const card = el.querySelector(".appt.is-flash");
    if (card) setTimeout(() => card.scrollIntoView({ block: "center", behavior: REDUCED ? "auto" : "smooth" }), 120);
    S.flashId = null;
  } else if (animate && S.sel === today() && !isDesktop() && window.scrollY < 50 && new Date().getHours() >= HORA_INICIO && new Date().getHours() < HORA_FIM) {
    const now = $("#nowline");
    if (!now.hidden) setTimeout(() => window.scrollTo({ top: Math.max(0, now.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.38), behavior: "smooth" }), 450);
  }
}

function placeNowLine() {
  const line = $("#nowline");
  if (!line || S.view !== "agenda" || S.sel !== today() || !S.loaded) { if (line) line.hidden = true; return; }
  const rows = $$("#timeline > li[data-slot]").filter((r) => r.dataset.slot !== "--:--");
  if (!rows.length) { line.hidden = true; return; }
  const n = new Date(), mins = n.getHours() * 60 + n.getMinutes();
  let top = null;
  for (const r of rows) {
    const m = toMin(r.dataset.slot);
    if (mins >= m && mins < m + INTERVALO_MIN) { top = r.offsetTop + ((mins - m) / INTERVALO_MIN) * r.offsetHeight; break; }
    if (m > mins) { top = r.offsetTop; break; }
  }
  if (top === null) { const last = rows[rows.length - 1]; top = last.offsetTop + last.offsetHeight; }
  $("#nowline-tag").textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  line.hidden = false;
  line.style.transform = `translate3d(0,${Math.round(top)}px,0)`;
}

$("#timeline").addEventListener("click", (e) => {
  const nw = e.target.closest("[data-new]");
  if (nw) { openForm({ data: S.sel, horario: nw.dataset.new }); return; }
  const ck = e.target.closest("[data-check]");
  if (ck) { quickConclude(ck.dataset.check, ck); return; }
  const op = e.target.closest("[data-open]");
  if (op) openDetail(op.dataset.open);
});

function quickConclude(id, btn) {
  const i = S.byId.get(id);
  if (!i) return;
  if (i.status === "concluido") { openDetail(id); return; }
  btn.classList.add("is-done");
  haptic(14);
  setTimeout(() => {
    fire(S.store.update(S.setor.key, id, { status: "concluido" }));
    toast(`${firstName(i.cliente)} · concluído`, { action: "Desfazer", onAction: () => fire(S.store.update(S.setor.key, id, { status: i.status })) });
  }, 300);
}

// ================================================================ FORMULÁRIO
$$('[data-action="novo"]').forEach((b) => b.addEventListener("click", () => openForm({ data: S.view === "agenda" ? S.sel : today() })));

function slotPickerHTML(busy, cur) {
  const groups = [["Manhã", ICON.sun, (m) => m < 720], ["Tarde", ICON.sunset, (m) => m >= 720 && m < 1080], ["Noite", ICON.moon, (m) => m >= 1080]];
  return groups.map(([label, icon, fn]) => {
    const slots = SLOTS.filter((s) => fn(toMin(s)));
    if (!slots.length) return "";
    return `<div class="slotpick__group"><p class="slotpick__label">${icon}${label}</p><div class="slotpick">${slots.map((s) => `<button type="button" class="${busy.has(s) ? "is-busy" : ""} ${s === cur ? "is-on" : ""}" data-s="${s}" ${busy.has(s) ? `title="Ocupado: ${esc(busy.get(s))}"` : ""}>${s}</button>`).join("")}</div></div>`;
  }).join("");
}

function openForm(prefill = {}, editId = null) {
  const edit = editId ? S.byId.get(editId) : null;
  const v = { cliente: "", telefone: "", procedimento: "", data: today(), horario: "", valor: "", obs: "", ...prefill, ...(edit || {}) };
  const clients = knownClients();
  const procs = procOptions();
  const top = procs.slice(0, 10);
  const body = openSheet(edit ? "Editar agendamento" : "Novo agendamento", `
    <form id="form-ag" novalidate autocomplete="off">
      <label class="field">
        <span class="field__label">Cliente</span>
        <input class="input" name="cliente" list="dl-clientes" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Nome da cliente" value="${esc(v.cliente)}" required />
        <datalist id="dl-clientes">${clients.slice(0, 600).map((c) => `<option value="${esc(c.nome)}">`).join("")}</datalist>
        <span class="field__hint" id="cliente-hint"></span>
      </label>
      <label class="field">
        <span class="field__label">WhatsApp <span class="muted">· opcional</span></span>
        <input class="input" name="telefone" type="tel" inputmode="tel" autocomplete="off" placeholder="(84) 9 9999-9999" value="${esc(v.telefone || "")}" />
      </label>
      <div class="field">
        <span class="field__label">Procedimento</span>
        <div class="chips" id="proc-chips">${top.map((p) => `<button type="button" class="chip ${normName(p) === normName(v.procedimento) ? "is-on" : ""}" data-proc="${esc(p)}">${esc(p)}</button>`).join("")}</div>
        <input class="input" name="procedimento" list="dl-procs" autocomplete="off" placeholder="Ou digite outro procedimento" value="${esc(v.procedimento)}" required />
        <datalist id="dl-procs">${procs.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>
      </div>
      <div class="row-2">
        <label class="field">
          <span class="field__label">Data</span>
          <input class="input" name="data" type="date" value="${esc(v.data)}" required />
        </label>
        <label class="field">
          <span class="field__label">Valor</span>
          <span class="input-prefix"><span>R$</span><input class="input" name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(moneyInput(v.valor))}" /></span>
        </label>
      </div>
      <div class="field">
        <span class="field__label">Horário <span class="muted" id="hora-sel">${v.horario ? "· " + esc(v.horario) : ""}</span></span>
        <div id="slotpick"></div>
        <div class="slotpick-foot"><span><i></i>ocupado — dá para encaixar</span><button type="button" class="btn btn--ghost btn--sm" id="hora-outra">Outro horário</button></div>
        <input class="input" name="horario" type="time" step="300" value="${esc(v.horario)}" ${SLOTS.includes(v.horario) || !v.horario ? "hidden" : ""} style="margin-top:8px" />
      </div>
      <label class="field">
        <span class="field__label">Observação <span class="muted">· opcional</span></span>
        <textarea class="input textarea" name="obs" rows="2" placeholder="Ex.: retorno, região, produto…">${esc(v.obs || "")}</textarea>
      </label>
      <p class="form-error" id="form-erro"></p>
      <div class="sheet-actions">
        <button class="btn btn--gold btn--lg btn--block" type="submit">${edit ? `${ICON.check}Salvar alterações` : `${ICON.plus}Agendar`}</button>
      </div>
    </form>`);

  const f = $("#form-ag", body);
  const el = (n) => f.elements[n];
  let valorAuto = !edit && !v.valor;

  const paintSlots = () => {
    const busy = busyMap(el("data").value, editId);
    const cur = el("horario").value;
    $("#slotpick", body).innerHTML = slotPickerHTML(busy, cur);
    $("#hora-sel", body).textContent = cur ? "· " + cur : "";
  };
  $("#slotpick", body).addEventListener("click", (e) => {
    const b = e.target.closest("[data-s]"); if (!b) return;
    el("horario").value = b.dataset.s; el("horario").hidden = true;
    $$("#slotpick .is-on", body).forEach((x) => x.classList.remove("is-on"));
    b.classList.add("is-on");
    $("#hora-sel", body).textContent = "· " + b.dataset.s;
    haptic(5);
  });
  $("#hora-outra", body).addEventListener("click", () => { el("horario").hidden = false; el("horario").focus(); });
  el("horario").addEventListener("input", paintSlots);
  el("data").addEventListener("change", paintSlots);
  paintSlots();
  if (v.horario) setTimeout(() => $("#slotpick .is-on", body)?.scrollIntoView({ block: "nearest" }), 60);

  const setProc = (p, fromChip) => {
    if (fromChip) el("procedimento").value = p;
    $$("#proc-chips .chip", body).forEach((c) => c.classList.toggle("is-on", normName(c.dataset.proc) === normName(p)));
    if (valorAuto || !el("valor").value) {
      const sv = suggestedValue(p);
      el("valor").value = sv ? moneyInput(sv) : "";
      valorAuto = true;
    }
  };
  $("#proc-chips", body).addEventListener("click", (e) => { const c = e.target.closest("[data-proc]"); if (c) { setProc(c.dataset.proc, true); haptic(5); } });
  el("procedimento").addEventListener("change", () => setProc(el("procedimento").value));
  el("valor").addEventListener("input", () => (valorAuto = false));
  el("valor").addEventListener("blur", () => { const n = parseMoney(el("valor").value); if (!isNaN(n) && el("valor").value) el("valor").value = moneyInput(n) || "0,00"; });

  const clientHint = () => {
    const c = clients.find((x) => x.key === normName(el("cliente").value));
    const hint = $("#cliente-hint", body);
    hint.textContent = c ? `Cliente da casa · ${plural(c.visitas, "atendimento")}${c.ultima ? " · última visita " + brDate(c.ultima) : ""}` : "";
    hint.classList.toggle("is-on", !!c);
    if (c && c.telefone && !el("telefone").value) el("telefone").value = c.telefone;
  };
  el("cliente").addEventListener("change", clientHint);
  el("cliente").addEventListener("blur", clientHint);
  clientHint();

  el("telefone").addEventListener("input", (e) => {
    const d = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (d.length < 3) return;
    e.target.value = d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}${d.length > 6 ? "-" + d.slice(6) : ""}` : `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  });
  $$(".input", f).forEach((i) => i.addEventListener("input", () => i.classList.remove("is-invalid")));
  if (!edit && !v.cliente && isDesktop()) setTimeout(() => el("cliente").focus(), 260);

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#form-erro", body);
    const rec = {
      cliente: titleCase(el("cliente").value),
      procedimento: firstUpper(el("procedimento").value),
      data: el("data").value,
      horario: parseTime(el("horario").value),
      valor: parseMoney(el("valor").value || "0"),
    };
    const tel = el("telefone").value.trim(), obs = el("obs").value.trim();
    const problem = !rec.cliente ? ["cliente", "Informe o nome da cliente."] : !rec.procedimento ? ["procedimento", "Escolha ou digite o procedimento."] : !rec.data ? ["data", "Escolha a data."] : !rec.horario ? ["horario", "Escolha um horário."] : isNaN(rec.valor) ? ["valor", "Valor inválido."] : null;
    if (problem) {
      err.textContent = problem[1];
      const inp = el(problem[0]);
      if (inp && !inp.hidden) inp.classList.add("is-invalid");
      (problem[0] === "horario" ? $("#slotpick", body) : inp)?.scrollIntoView({ block: "center", behavior: "smooth" });
      haptic([10, 40, 10]);
      return;
    }
    const busy = busyMap(rec.data, editId);
    if (busy.has(rec.horario)) {
      const ok = await confirmDialog({ title: "Horário ocupado", text: `Às <b>${rec.horario}</b> de ${brDate(rec.data)} já está marcada <b>${esc(busy.get(rec.horario))}</b>. Deseja encaixar mesmo assim?`, ok: "Encaixar", keepOpen: true, icon: ICON.clock });
      if (ok === null) return;
      if (!ok) { openForm({ ...rec, telefone: tel, obs }, editId); return; }
    }
    if (edit) {
      fire(S.store.update(S.setor.key, editId, { ...rec, telefone: tel || null, obs: obs || null, atualizadoEm: Date.now() }));
      S.flashId = editId;
      toast("Agendamento atualizado");
    } else {
      const res = S.store.add(S.setor.key, { ...rec, status: "pendente", ...(tel && { telefone: tel }), ...(obs && { obs }), criadoEm: Date.now(), criadoPor: S.user?.username || "" });
      fire(res.done);
      S.flashId = res.key;
      toast(`${firstName(rec.cliente)} agendada · ${brDate(rec.data)} às ${rec.horario}`);
    }
    haptic(12);
    closeSheet();
    if (S.view !== "agenda") go("agenda");
    if (rec.data !== S.sel) setDay(rec.data); else renderAgenda();
  });
}

// ================================================================ DETALHE
function waLink(i, kind = "confirmar") {
  let d = String(i.telefone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11) d = "55" + d;
  const txt = kind === "confirmar"
    ? `Olá, ${firstName(i.cliente)}! Aqui é da Harmony Clinical Center 🤍 Passando para confirmar seu horário de ${i.procedimento} no dia ${brDate(i.data)} às ${i.horario}. Podemos confirmar?`
    : `Olá, ${firstName(i.cliente)}! Aqui é da Harmony Clinical Center 🤍`;
  return `https://wa.me/${d}?text=${encodeURIComponent(txt)}`;
}

function openDetail(id) {
  const i = S.byId.get(id); if (!i) return;
  const body = openSheet("Agendamento", `
    <div class="detail-head">
      <div class="avatar ${hueClass(i.cliente)}">${esc(initials(i.cliente))}</div>
      <div><h3>${esc(i.cliente)}</h3><span class="muted">${esc(i.procedimento)}</span></div>
    </div>
    <div class="detail-grid">
      <div class="detail-box"><span>Data</span><strong>${brDate(i.data)}</strong></div>
      <div class="detail-box"><span>Horário</span><strong>${esc(i.horario || "—")}</strong></div>
      <div class="detail-box"><span>Valor</span><strong>${money(i.valor)}</strong></div>
      <div class="detail-box"><span>Status</span><strong><span class="pill pill--${i.status}">${STATUS[i.status]}</span></strong></div>
    </div>
    ${i.obs ? `<div class="detail-note">${esc(i.obs)}</div>` : ""}
    <div class="action-grid">
      ${i.status !== "concluido" ? `<button class="btn btn--gold btn--wide" data-a="concluir">${ICON.check}Marcar como concluído</button>` : `<button class="btn btn--outline btn--wide" data-a="pendente">${ICON.undo}Voltar para pendente</button>`}
      ${i.telefone ? `<a class="btn btn--wa btn--wide" href="${waLink(i)}" target="_blank" rel="noopener">${ICON.wa}Confirmar pelo WhatsApp</a>` : ""}
      <button class="btn btn--outline" data-a="remarcar">${ICON.cal}Remarcar</button>
      <button class="btn btn--outline" data-a="editar">${ICON.edit}Editar</button>
      <button class="btn btn--outline" data-a="historico">${ICON.user}Histórico</button>
      ${i.status !== "cancelado" ? `<button class="btn btn--outline" data-a="cancelar">${ICON.ban}Cancelar</button>` : `<button class="btn btn--outline" data-a="pendente">${ICON.undo}Reativar</button>`}
      <span class="action-sep"></span>
      <button class="btn btn--danger btn--wide" data-a="excluir">${ICON.trash}Excluir definitivamente</button>
    </div>`);
  body.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    const path = S.setor.key;
    if (a === "concluir") { fire(S.store.update(path, id, { status: "concluido" })); haptic(14); closeSheet(); toast(`${firstName(i.cliente)} · concluído`, { action: "Desfazer", onAction: () => fire(S.store.update(path, id, { status: i.status })) }); }
    if (a === "pendente") { fire(S.store.update(path, id, { status: "pendente" })); closeSheet(); toast("Marcado como pendente"); }
    if (a === "cancelar") { fire(S.store.update(path, id, { status: "cancelado" })); haptic(10); closeSheet(); toast("Agendamento cancelado", { action: "Desfazer", onAction: () => fire(S.store.update(path, id, { status: i.status })) }); }
    if (a === "editar") openForm({}, id);
    if (a === "remarcar") openReschedule(id);
    if (a === "historico") openClient(normName(i.cliente));
    if (a === "excluir") {
      const ok = await confirmDialog({ title: "Excluir agendamento", text: `Excluir <b>${esc(i.cliente)}</b> (${brDate(i.data)} às ${esc(i.horario)}) para sempre? Se for só desmarcar, use <b>Cancelar</b>.`, ok: "Excluir", danger: true });
      if (ok) {
        const { id: _x, ...copy } = i;
        fire(S.store.remove(path, id));
        haptic(16);
        toast("Agendamento excluído", { action: "Desfazer", onAction: () => fire(S.store.add(path, copy).done), ms: 7000 });
      }
    }
  });
}

function openReschedule(id) {
  const i = S.byId.get(id); if (!i) return;
  let data = i.data, hora = i.horario;
  const body = openSheet("Remarcar", `
    <div class="detail-head"><div class="avatar ${hueClass(i.cliente)}">${esc(initials(i.cliente))}</div><div><h3>${esc(i.cliente)}</h3><span class="muted">${esc(i.procedimento)} · hoje marcado ${brDate(i.data)} às ${esc(i.horario)}</span></div></div>
    <label class="field"><span class="field__label">Nova data</span><input class="input" type="date" id="rm-data" value="${data}" /></label>
    <div class="field"><span class="field__label">Novo horário</span><div id="rm-slots"></div></div>
    <div class="sheet-actions"><button class="btn btn--gold btn--lg btn--block" id="rm-ok">${ICON.cal}Salvar remarcação</button></div>`);
  const paint = () => { $("#rm-slots", body).innerHTML = slotPickerHTML(busyMap(data, id), hora); };
  paint();
  setTimeout(() => $("#rm-slots .is-on", body)?.scrollIntoView({ block: "nearest" }), 60);
  $("#rm-data", body).addEventListener("change", (e) => { data = e.target.value; paint(); });
  $("#rm-slots", body).addEventListener("click", (e) => {
    const b = e.target.closest("[data-s]"); if (!b) return;
    hora = b.dataset.s;
    $$("#rm-slots .is-on", body).forEach((x) => x.classList.remove("is-on"));
    b.classList.add("is-on"); haptic(5);
  });
  $("#rm-ok", body).addEventListener("click", async () => {
    if (!data || !hora) return;
    const busy = busyMap(data, id);
    if (busy.has(hora)) {
      const ok = await confirmDialog({ title: "Horário ocupado", text: `Às <b>${hora}</b> de ${brDate(data)} já está marcada <b>${esc(busy.get(hora))}</b>. Manter mesmo assim?`, ok: "Manter", keepOpen: true, icon: ICON.clock });
      if (ok === null) return;
      if (!ok) { openReschedule(id); return; }
    }
    fire(S.store.update(S.setor.key, id, { data, horario: hora, status: "pendente", atualizadoEm: Date.now() }));
    S.flashId = id;
    haptic(12);
    closeSheet();
    toast(`Remarcado para ${brDate(data)} às ${hora}`);
    if (S.view !== "agenda") go("agenda");
    if (data !== S.sel) setDay(data); else renderAgenda();
  });
}

// ================================================================ CLIENTES
let buscaT;
$("#busca").addEventListener("input", () => {
  $("#busca-clear").hidden = !$("#busca").value;
  clearTimeout(buscaT); buscaT = setTimeout(() => renderClientes(), 90);
});
$("#busca-clear").addEventListener("click", () => { $("#busca").value = ""; $("#busca-clear").hidden = true; renderClientes({ animate: true }); $("#busca").focus(); });
$("#sort-seg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sort]"); if (!b || b.dataset.sort === S.sort) return;
  S.sort = b.dataset.sort;
  $$("#sort-seg button").forEach((x) => x.classList.toggle("is-on", x === b));
  moveSegInd(); haptic(4);
  renderClientes({ animate: true });
});
function moveSegInd() {
  const on = $("#sort-seg .is-on"), ind = $("#sort-seg .segmented__ind");
  if (!on || !ind || !on.offsetWidth) return;
  ind.style.width = `${on.offsetWidth}px`;
  ind.style.transform = `translateX(${on.offsetLeft - 4}px)`;
}

function renderClientes({ animate = false } = {}) {
  requestAnimationFrame(moveSegInd);
  const q = normName($("#busca").value), qd = q.replace(/\D/g, "");
  let list = knownClients();
  if (q) list = list.filter((c) => c.key.includes(q) || (qd.length >= 3 && String(c.telefone).replace(/\D/g, "").includes(qd)) || c.itens.some((i) => normName(i.procedimento).includes(q)));
  const by = {
    recentes: (a, b) => (b.proxima || b.ultima || "").localeCompare(a.proxima || a.ultima || ""),
    visitas: (a, b) => b.visitas - a.visitas,
    gasto: (a, b) => b.gasto - a.gasto,
    az: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
  };
  list = [...list].sort(by[S.sort]);
  $("#clientes-count").textContent = S.loaded ? `${plural(list.length, "cliente")}${q ? (list.length === 1 ? " encontrada" : " encontradas") : ""}` : "Carregando…";
  const shown = list.slice(0, 120);
  const box = $("#client-list");
  box.innerHTML = shown.length ? shown.map((c, k) => `
    <button class="client" data-key="${esc(c.key)}" style="--d:${Math.min(k, 16)}">
      <div class="avatar ${hueClass(c.nome)}">${esc(initials(c.nome))}</div>
      <div class="client__info"><strong>${esc(c.nome)}</strong><span>${plural(c.visitas, "atend.", "atend.")} · ${c.proxima ? "próximo " + brShort(c.proxima) : c.ultima ? "última " + brShort(c.ultima) : "sem visitas"}</span></div>
      <div class="client__total">${money0(c.gasto)}<small>gasto total</small></div>
    </button>`).join("") + (list.length > shown.length ? `<p class="muted small center" style="grid-column:1/-1">Mostrando 120 de ${list.length}. Use a busca para encontrar outras.</p>` : "")
    : `<div class="empty" style="grid-column:1/-1"><div class="empty__art">${ICON.users}</div><h4>${q ? "Nada encontrado" : "Nenhuma cliente"}</h4><p>${q ? "Tente outro nome, telefone ou procedimento." : "As clientes aparecem aqui conforme você agenda."}</p></div>`;
  if (animate && !REDUCED) restartAnim(box, "is-entering"); else box.classList.remove("is-entering");
}
$("#client-list").addEventListener("click", (e) => { const b = e.target.closest(".client"); if (b) openClient(b.dataset.key); });

function openClient(key) {
  const c = knownClients().find((x) => x.key === key); if (!c) return;
  const hist = [...c.itens].sort((a, b) => (b.data + b.horario).localeCompare(a.data + a.horario));
  const body = openSheet("Cliente", `
    <div class="detail-head"><div class="avatar ${hueClass(c.nome)}">${esc(initials(c.nome))}</div><div><h3>${esc(c.nome)}</h3><span class="muted">${esc(c.telefone || "Sem telefone cadastrado")}</span></div></div>
    <div class="detail-grid">
      <div class="detail-box"><span>Atendimentos</span><strong>${c.visitas}</strong></div>
      <div class="detail-box"><span>Gasto total</span><strong>${money(c.gasto)}</strong></div>
      <div class="detail-box"><span>Última visita</span><strong>${c.ultima ? brDate(c.ultima) : "—"}</strong></div>
      <div class="detail-box"><span>Próximo</span><strong>${c.proxima ? brDate(c.proxima) : "—"}</strong></div>
    </div>
    <div class="action-grid" style="margin-bottom:20px">
      <button class="btn btn--gold ${c.telefone ? "" : "btn--wide"}" id="cl-novo">${ICON.plus}Agendar</button>
      ${c.telefone ? `<a class="btn btn--wa" target="_blank" rel="noopener" href="${waLink({ cliente: c.nome, telefone: c.telefone }, "oi")}">${ICON.wa}WhatsApp</a>` : ""}
    </div>
    <h3 class="section-title">Histórico <span class="muted small">· ${plural(hist.length, "registro")}</span></h3>
    <ul class="history">${hist.slice(0, 200).map((i) => `<li data-id="${esc(i.id)}"><div><strong>${esc(i.procedimento)}</strong><span>${brDate(i.data)} às ${esc(i.horario || "—")}</span></div><div class="history__right"><strong>${money(i.valor)}</strong><span class="pill pill--${i.status}">${STATUS[i.status]}</span></div></li>`).join("")}</ul>`);
  $("#cl-novo", body).addEventListener("click", () => openForm({ cliente: c.nome, telefone: c.telefone, data: S.sel >= today() ? S.sel : today() }));
  $(".history", body).addEventListener("click", (e) => { const li = e.target.closest("li[data-id]"); if (li) openDetail(li.dataset.id); });
}

// ================================================================ FINANCEIRO
$$("[data-month]").forEach((b) => b.addEventListener("click", () => { S.finMonth = addMonths(S.finMonth, Number(b.dataset.month)); haptic(4); renderFinanceiro({ animate: true, swap: true }); }));

function renderFinanceiro({ animate = false, swap = false } = {}) {
  const ym = S.finMonth;
  const [y, m] = ym.split("-").map(Number);
  const title = $("#month-title");
  title.textContent = cap(fmtMonth.format(new Date(y, m - 1, 1)));
  if (swap) restartAnim(title, "is-swap");
  const items = S.items.filter((i) => (i.data || "").startsWith(ym));
  let rec = 0, prev = 0, nConc = 0, nPend = 0, nCanc = 0;
  const clientes = new Set();
  items.forEach((i) => {
    if (i.status === "concluido") { rec += i.valor; nConc++; clientes.add(normName(i.cliente)); }
    else if (i.status === "pendente") { prev += i.valor; nPend++; clientes.add(normName(i.cliente)); }
    else nCanc++;
  });
  const prevYm = addMonths(ym, -1);
  const recAnt = S.items.reduce((s, i) => s + ((i.data || "").startsWith(prevYm) && i.status === "concluido" ? i.valor : 0), 0);
  const delta = recAnt ? Math.round(((rec - recAnt) / recAnt) * 100) : null;
  const kpis = $("#kpis");
  if (animate || !kpis.firstElementChild) kpis.innerHTML = `
    <div class="kpi kpi--hero"><span>Recebido no mês</span><strong id="k-rec">R$ 0,00</strong><small id="k-rec-sub"></small></div>
    <div class="kpi"><span>A receber</span><strong id="k-prev">R$ 0</strong><small id="k-prev-sub"></small></div>
    <div class="kpi"><span>Expectativa total</span><strong id="k-tot">R$ 0</strong><small>recebido + a receber</small></div>
    <div class="kpi"><span>Ticket médio</span><strong id="k-tic">R$ 0</strong><small>por atendimento concluído</small></div>
    <div class="kpi"><span>Clientes atendidas</span><strong id="k-cli">0</strong><small id="k-cli-sub"></small></div>`;
  countUp($("#k-rec"), rec, money, "k-rec");
  countUp($("#k-prev"), prev, money0, "k-prev");
  countUp($("#k-tot"), rec + prev, money0, "k-tot");
  countUp($("#k-tic"), nConc ? rec / nConc : 0, money0, "k-tic");
  countUp($("#k-cli"), clientes.size, int, "k-cli");
  $("#k-rec-sub").innerHTML = `${delta === null ? "" : `<span class="delta ${delta >= 0 ? "delta--up" : "delta--down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}%</span>`}${plural(nConc, "atendimento concluído", "atendimentos concluídos")}${delta === null ? "" : " · vs. mês anterior"}`;
  $("#k-prev-sub").textContent = plural(nPend, "pendente");
  $("#k-cli-sub").textContent = plural(nCanc, "cancelamento");

  // por dia
  const days = new Date(y, m, 0).getDate();
  const perDay = Array.from({ length: days }, () => ({ rec: 0, prev: 0, n: 0 }));
  items.forEach((i) => { const d = perDay[Number(i.data.slice(8)) - 1]; if (!d || i.status === "cancelado") return; d.n++; if (i.status === "concluido") d.rec += i.valor; else d.prev += i.valor; });
  const max = Math.max(1, ...perDay.map((d) => d.rec + d.prev));
  const t = today();
  const chart = $("#daychart");
  chart.innerHTML = perDay.map((d, k) => {
    const iso = `${ym}-${pad(k + 1)}`;
    const label = (k + 1) % 5 === 0 || k === 0 ? `<b>${k + 1}</b>` : "";
    return `<div class="daychart__col ${iso === t ? "is-today" : ""}" data-k="${k}" style="--d:${k}"><div class="daychart__stack">${d.prev ? `<i class="prev" style="height:${(d.prev / max) * 100}%"></i>` : ""}${d.rec ? `<i class="rec" style="height:${(d.rec / max) * 100}%"></i>` : ""}</div>${label}</div>`;
  }).join("");
  chart._data = { perDay, ym };
  $("#chart-tip").hidden = true;
  if ((animate || swap) && !REDUCED) restartAnim(chart, "is-grow");

  // por procedimento (agrupa grafias parecidas: "Retorno" e "retorno ")
  const pm = new Map();
  items.filter(active).forEach((i) => {
    const k = normName(i.procedimento);
    const p = pm.get(k) || { v: 0, n: 0, names: new Map() };
    p.v += i.valor; p.n++; p.names.set(i.procedimento, (p.names.get(i.procedimento) || 0) + 1);
    pm.set(k, p);
  });
  const arr = [...pm.values()].map((p) => ({ ...p, nome: [...p.names.entries()].sort((a, b) => b[1] - a[1])[0][0] })).sort((a, b) => b.v - a.v || b.n - a.n).slice(0, 8);
  const pmax = Math.max(1, ...arr.map((p) => p.v));
  const bars = $("#proc-bars");
  bars.innerHTML = arr.length ? arr.map((p) => `
    <div class="bar"><div class="bar__top"><span>${esc(p.nome)}</span><strong>${money0(p.v)}</strong></div>
    <div class="bar__track"><div class="bar__fill" data-w="${(p.v / pmax).toFixed(4)}"></div></div>
    <small>${plural(p.n, "atendimento")}</small></div>`).join("")
    : `<div class="empty"><div class="empty__art">${ICON.coin}</div><h4>Sem movimento</h4><p>Nenhum atendimento neste mês.</p></div>`;
  const setW = () => $$(".bar__fill", bars).forEach((b) => b.style.setProperty("--w", b.dataset.w));
  if ((animate || swap) && !REDUCED) requestAnimationFrame(() => requestAnimationFrame(setW)); else { $$(".bar__fill", bars).forEach((b) => (b.style.transition = "none")); setW(); }
}

(() => {
  const chart = $("#daychart"), tip = $("#chart-tip"), card = $(".chart-card");
  let on = null;
  const show = (col) => {
    if (!col || !chart._data) return;
    const k = Number(col.dataset.k), d = chart._data.perDay[k];
    if (on) on.classList.remove("is-on");
    on = col; col.classList.add("is-on");
    tip.innerHTML = `<strong>${brDate(`${chart._data.ym}-${pad(k + 1)}`)}</strong><div><span>Recebido</span>${money(d.rec)}</div><div><span>A receber</span>${money(d.prev)}</div><div><span>Atendimentos</span>${d.n}</div>`;
    tip.hidden = false;
    const cr = card.getBoundingClientRect(), r = col.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left - cr.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(cr.width - tw - 8, x));
    const stack = col.querySelector(".daychart__stack");
    const top = (stack.lastElementChild || stack).getBoundingClientRect().top;
    const yv = Math.max(8, Math.min(top, r.bottom - 30) - cr.top - th - 10);
    tip.style.transform = `translate3d(${Math.round(x)}px,${Math.round(yv)}px,0)`;
  };
  chart.addEventListener("pointerover", (e) => { if (e.pointerType === "mouse") show(e.target.closest(".daychart__col")); });
  chart.addEventListener("pointerdown", (e) => show(e.target.closest(".daychart__col")));
  chart.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { tip.hidden = true; on?.classList.remove("is-on"); on = null; } });
})();

// ================================================================ AJUSTES
function renderAjustes() { renderProcEditor(); }

function renderProcEditor() {
  $("#proc-editor").innerHTML = S.procs.map((p, k) => `
    <div class="proc-row" data-k="${k}" style="animation-delay:${Math.min(k, 12) * 20}ms">
      <input class="input" data-f="nome" value="${esc(p.nome)}" placeholder="Procedimento" aria-label="Nome do procedimento" />
      <span class="input-prefix"><span>R$</span><input class="input" data-f="valor" inputmode="decimal" value="${esc(moneyInput(p.valor))}" placeholder="—" aria-label="Valor padrão" /></span>
      <button class="icon-btn" data-del="${k}" aria-label="Remover ${esc(p.nome)}">${ICON.trash}</button>
    </div>`).join("") || `<p class="muted small">Nenhum procedimento cadastrado.</p>`;
}
let procSaveT;
$("#proc-editor").addEventListener("input", (e) => {
  const row = e.target.closest(".proc-row"); if (!row) return;
  const p = S.procs[Number(row.dataset.k)];
  if (e.target.dataset.f === "nome") p.nome = e.target.value.trim();
  else p.valor = parseMoney(e.target.value) || 0;
  clearTimeout(procSaveT);
  procSaveT = setTimeout(async () => { S.procs = S.procs.filter((x) => x.nome); await saveProcs(); toast("Procedimentos salvos"); }, 900);
});
$("#proc-editor").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del]"); if (!b) return;
  const row = b.closest(".proc-row");
  row.style.transition = "opacity .2s, transform .2s"; row.style.opacity = "0"; row.style.transform = "translateX(12px)";
  await sleep(200);
  S.procs.splice(Number(b.dataset.del), 1); await saveProcs(); renderProcEditor();
});
$('[data-action="add-proc"]').addEventListener("click", () => {
  S.procs.push({ nome: "", valor: 0 }); renderProcEditor();
  const rows = $$("#proc-editor .proc-row"); rows[rows.length - 1]?.querySelector("input").focus();
});

$('[data-action="exportar-tudo"]').addEventListener("click", async (e) => {
  if (!S.items.length) return toast("Nada para exportar ainda.", { type: "error" });
  const b = e.currentTarget; b.disabled = true;
  try { await exportSpreadsheet(S.items, `HCC_${S.setor.label}_completo_${today()}.xlsx`); toast("Planilha baixada"); }
  catch (ex) { toast(ex.message, { type: "error" }); }
  finally { b.disabled = false; }
});
$('[data-action="exportar-mes"]').addEventListener("click", async (e) => {
  const items = S.items.filter((i) => (i.data || "").startsWith(S.finMonth));
  if (!items.length) return toast("Nenhum agendamento neste mês.", { type: "error" });
  const b = e.currentTarget; b.disabled = true;
  try { await exportSpreadsheet(items, `HCC_${S.setor.label}_${S.finMonth}.xlsx`); toast("Planilha do mês baixada"); }
  catch (ex) { toast(ex.message, { type: "error" }); }
  finally { b.disabled = false; }
});

$('[data-action="limpar"]').addEventListener("click", async () => {
  const ok = await confirmDialog({ title: "Limpar banco de dados", text: `Isso apaga <b>todos os ${S.items.length} agendamentos</b> do setor ${esc(S.setor.label)}. Não dá para desfazer.`, ok: "Apagar tudo", danger: true, typeToConfirm: "APAGAR" });
  if (!ok) return;
  try { await S.store.clear(S.setor.key); toast("Banco de dados limpo"); } catch (ex) { fail(ex); }
});

$('[data-action="importar-texto"]').addEventListener("click", async () => {
  const txt = $("#campo-importar").value.trim();
  if (!txt) return toast("Cole o texto primeiro.", { type: "error" });
  const year = new Date().getFullYear(), mon = pad(new Date().getMonth() + 1);
  const recs = [], bad = [];
  txt.split("\n").forEach((line, n) => {
    if (!line.trim()) return;
    const p = line.split(/[,;\t]/).map((x) => x.trim());
    if (p.length < 5) { bad.push(n + 1); return; }
    const [nome, proc, dRaw, hRaw, ...vRest] = p;
    let data = "";
    if (/^\d{1,2}$/.test(dRaw)) data = `${year}-${mon}-${pad(dRaw)}`;
    else { const mm = dRaw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/); if (mm) data = `${mm[3] ? (mm[3].length === 2 ? "20" + mm[3] : mm[3]) : year}-${pad(mm[2])}-${pad(mm[1])}`; }
    const horario = parseTime(hRaw), valor = parseMoney(vRest.join(","));
    if (!nome || !data || !horario || isNaN(valor)) { bad.push(n + 1); return; }
    recs.push({ cliente: titleCase(nome), procedimento: firstUpper(proc) || "Não informado", data, horario, valor, status: "pendente", criadoEm: Date.now(), criadoPor: S.user?.username || "" });
  });
  if (!recs.length) return toast("Formato não reconhecido. Use: Nome, Procedimento, Data, Hora, Valor", { type: "error", ms: 5000 });
  try {
    await S.store.bulkAdd(S.setor.key, recs);
    $("#campo-importar").value = "";
    toast(`${plural(recs.length, "agendamento importado", "agendamentos importados")}${bad.length ? ` · linhas ignoradas: ${bad.join(", ")}` : ""}`, { ms: 5000 });
  } catch (ex) { fail(ex); }
});

// ---------- importação de planilha
const dz = $("#dropzone");
["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("is-over"); }));
["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("is-over"); }));
dz.addEventListener("drop", (e) => { const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); });
$("#file-excel").addEventListener("change", (e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; });

let imp = null;
const recKey = (r) => `${normName(r.cliente)}|${r.data}|${r.horario}|${normName(r.procedimento)}`;
async function handleFile(file) {
  const box = $("#import-preview");
  box.innerHTML = `<div class="progress"><i style="--p:.15"></i></div><p class="muted small">Lendo “${esc(file.name)}”…</p>`;
  try {
    const { rows, meta } = await readSpreadsheet(file);
    if (!rows.length) { box.innerHTML = `<p class="form-error">Não encontrei os dados. A planilha precisa de um cabeçalho com pelo menos “Cliente” e “Data”.</p>`; return; }
    rows.forEach((r) => { r.cliente = titleCase(r.cliente); r.procedimento = firstUpper(r.procedimento) || "Não informado"; });
    // compara com o que já existe, respeitando repetições legítimas
    const exist = new Map();
    S.items.forEach((i) => { const k = recKey(i); exist.set(k, (exist.get(k) || 0) + 1); });
    rows.forEach((r) => {
      if (r._erro) return;
      const k = recKey(r), n = exist.get(k) || 0;
      r._dup = n > 0;
      if (n > 0) exist.set(k, n - 1);
    });
    imp = { rows, meta, nome: file.name, mode: "auto" };
    renderImport();
  } catch (ex) {
    console.error(ex);
    box.innerHTML = `<p class="form-error">${esc(ex.message || "Não foi possível ler o arquivo.")}</p>`;
  }
}

function renderImport() {
  const box = $("#import-preview");
  const { rows, meta, mode } = imp;
  const t = today();
  rows.forEach((r) => { r.status = r._st || (mode === "auto" ? (r.data && r.data < t ? "concluido" : "pendente") : mode); });
  const semStatus = rows.some((r) => !r._st);
  const ok = rows.filter((r) => !r._erro && !r._dup);
  const dup = rows.filter((r) => r._dup).length, bad = rows.filter((r) => r._erro).length;
  const datas = ok.map((r) => r.data).sort();
  const total = ok.filter((r) => r.status === "concluido").reduce((s, r) => s + r.valor, 0);
  const cnt = { concluido: 0, pendente: 0, cancelado: 0 }; ok.forEach((r) => cnt[r.status]++);
  box.innerHTML = `
    <div class="import-sum">
      <span class="pill pill--concluido">${ok.length} para importar</span>
      ${dup ? `<span class="pill pill--cancelado">${dup} já existe${dup > 1 ? "m" : ""}</span>` : ""}
      ${bad ? `<span class="pill pill--erro">${bad} com erro</span>` : ""}
    </div>
    ${ok.length ? `<p class="small muted">${esc(imp.nome)} · ${brDate(datas[0])} a ${brDate(datas[datas.length - 1])}<br>${cnt.concluido} concluídos (${money(total)}) · ${cnt.pendente} pendentes · ${cnt.cancelado} cancelados</p>` : ""}
    ${semStatus ? `<label class="field"><span class="field__label">A planilha não informa o status. Como marcar?</span>
      <select class="input" id="imp-mode">
        <option value="auto" ${mode === "auto" ? "selected" : ""}>Datas passadas = concluído · futuras = pendente</option>
        <option value="pendente" ${mode === "pendente" ? "selected" : ""}>Tudo como pendente</option>
        <option value="concluido" ${mode === "concluido" ? "selected" : ""}>Tudo como concluído</option>
      </select></label>` : ""}
    ${!meta.hasHorario ? `<p class="small muted">Sem coluna de horário: esses atendimentos aparecem como “s/ hora” no dia.</p>` : ""}
    <div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Hora</th><th>Cliente</th><th>Procedimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>
      ${rows.slice(0, 200).map((r) => `<tr class="${r._erro ? "is-bad" : r._dup ? "is-dup" : ""}"><td>${r._erro ? "⚠ linha " + r._linha + ": " + esc(r._erro) : brDate(r.data)}</td><td>${esc(r.horario || "—")}</td><td>${esc(r.cliente)}</td><td>${esc(r.procedimento)}</td><td>${isNaN(r.valor) ? "—" : money(r.valor)}</td><td>${r._dup ? "já existe" : STATUS[r.status]}</td></tr>`).join("")}
    </tbody></table></div>
    ${rows.length > 200 ? `<p class="small muted">Prévia das primeiras 200 linhas de ${rows.length}.</p>` : ""}
    <div class="row-2"><button class="btn btn--outline" id="imp-cancel">Cancelar</button><button class="btn btn--gold" id="imp-go" ${ok.length ? "" : "disabled"}>Importar ${ok.length}</button></div>`;
  $("#imp-mode")?.addEventListener("change", (e) => { imp.mode = e.target.value; renderImport(); });
  $("#imp-cancel").onclick = () => { imp = null; box.innerHTML = ""; };
  $("#imp-go").onclick = async () => {
    const recs = ok.map(({ _linha, _aba, _erro, _dup, _st, ...r }) => ({ ...r, origem: "planilha", importadoEm: Date.now() }));
    box.innerHTML = `<p class="small" style="font-weight:700">Importando ${recs.length} agendamentos…</p><div class="progress"><i id="imp-bar"></i></div><p class="muted small" id="imp-txt">0 de ${recs.length}</p>`;
    try {
      await S.store.bulkAdd(S.setor.key, recs, (n, tot) => { $("#imp-bar")?.style.setProperty("--p", (n / tot).toFixed(3)); const tx = $("#imp-txt"); if (tx) tx.textContent = `${n} de ${tot}`; });
      box.innerHTML = `<div class="success"><span class="success__check">${ICON.check}</span><span>${recs.length} agendamentos importados para ${esc(S.setor.label)}.</span></div>`;
      haptic([10, 30, 10]);
      toast(`${recs.length} agendamentos importados`);
      imp = null;
    } catch (ex) { fail(ex); renderImport(); }
  };
}

// ================================================================ teclado (computador)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sheet.open) { closeSheet(); return; }
  if (!S.user || sheet.open || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = document.activeElement?.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
  const k = e.key.toLowerCase();
  if (S.view === "agenda" && e.key === "ArrowLeft") { setDay(addDays(S.sel, -1)); e.preventDefault(); }
  else if (S.view === "agenda" && e.key === "ArrowRight") { setDay(addDays(S.sel, 1)); e.preventDefault(); }
  else if (S.view === "financeiro" && e.key === "ArrowLeft") $('[data-month="-1"]').click();
  else if (S.view === "financeiro" && e.key === "ArrowRight") $('[data-month="1"]').click();
  else if (k === "t") { if (S.view !== "agenda") go("agenda"); setDay(today()); }
  else if (k === "n") { e.preventDefault(); openForm({ data: S.view === "agenda" ? S.sel : today() }); }
  else if (k === "a") go("agenda");
  else if (k === "c") go("clientes");
  else if (k === "f") go("financeiro");
  else if (e.key === "/") { e.preventDefault(); go("clientes"); setTimeout(() => $("#busca").focus(), 50); }
});

// ================================================================ manutenção
let lastToday = today();
setInterval(() => {
  if (today() !== lastToday) { if (S.sel === lastToday) S.sel = today(); lastToday = today(); if (S.view === "agenda") renderAgenda(); }
  placeNowLine();
}, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) placeNowLine(); });

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

boot();

// =================================================================
// Camada de dados: Firebase Realtime Database (produção)
// ou localStorage (modo demonstração: adicione ?demo à URL).
// Formato de cada agendamento (igual ao sistema antigo):
// { cliente, procedimento, data:"AAAA-MM-DD", horario:"HH:MM",
//   valor:Number, status:"pendente"|"concluido"|"cancelado",
//   telefone?, obs?, criadoEm?, criadoPor?, importadoEm?, origem? }
//
// Gravações são "otimistas": a tela atualiza na hora (o Firebase
// avisa os ouvintes localmente) e a confirmação do servidor chega
// depois. Por isso add() devolve { key, done } e a interface não
// precisa esperar a internet para seguir.
// =================================================================
import { firebaseConfig, LOGIN_DOMAIN } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

export async function createStore() {
  const demo = new URLSearchParams(location.search).has("demo") || !firebaseConfig?.apiKey;
  return demo ? demoStore() : firebaseStore();
}

export const toEmail = (username) => {
  const u = String(username || "").trim().toLowerCase().replace(/\s+/g, "");
  return u.includes("@") ? u : `${u}${LOGIN_DOMAIN}`;
};

const toList = (obj) => (obj ? Object.entries(obj).map(([id, v]) => ({ id, ...v })) : []);

// ---------------------------------------------------------------- Firebase
async function firebaseStore() {
  const [{ initializeApp }, rtdb, authMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-database.js`),
    import(`${SDK}/firebase-auth.js`),
  ]);
  const { getDatabase, ref, push, onValue, remove, update, set, get, child } = rtdb;
  const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } = authMod;

  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence).catch(() => {});

  return {
    mode: "firebase",
    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? { username: u.email.split("@")[0], email: u.email } : null));
    },
    login: (username, senha) => signInWithEmailAndPassword(auth, toEmail(username), senha),
    logout: () => signOut(auth),
    watch(path, cb, onError) {
      return onValue(ref(db, path), (snap) => cb(toList(snap.val())), onError);
    },
    watchConnection(cb) {
      return onValue(ref(db, ".info/connected"), (snap) => cb(snap.val() === true));
    },
    add(path, rec) {
      const r = push(ref(db, path), rec);
      return { key: r.key, done: Promise.resolve(r) };
    },
    update: (path, id, patch) => update(ref(db, `${path}/${id}`), patch),
    remove: (path, id) => remove(ref(db, `${path}/${id}`)),
    async bulkAdd(path, recs, onProgress) {
      const CHUNK = 250;
      for (let i = 0; i < recs.length; i += CHUNK) {
        const updates = {};
        recs.slice(i, i + CHUNK).forEach((r) => { updates[push(ref(db, path)).key] = r; });
        await update(ref(db, path), updates);
        onProgress?.(Math.min(i + CHUNK, recs.length), recs.length);
      }
    },
    clear: (path) => remove(ref(db, path)),
    async getConfig(key) {
      try { const s = await get(child(ref(db), `configuracoes/${key}`)); return s.exists() ? s.val() : null; }
      catch { return null; }
    },
    async setConfig(key, value) {
      try { await set(ref(db, `configuracoes/${key}`), value); return true; } catch { return false; }
    },
  };
}

// ---------------------------------------------------------------- Demo
function demoStore() {
  const KEY = "hcc-demo-db-v2";
  const listeners = new Map();
  let authCb = null;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
  let data = load() || seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };
  const emit = (path) => (listeners.get(path) || []).forEach((cb) => cb(toList(data[path])));
  const uid = () => "-demo" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  save();

  return {
    mode: "demo",
    onAuth(cb) {
      authCb = cb;
      const u = sessionStorage.getItem("hcc-demo-user");
      setTimeout(() => cb(u ? { username: u, email: toEmail(u) } : null), 250);
      return () => {};
    },
    async login(username) {
      await new Promise((r) => setTimeout(r, 450));
      const u = toEmail(username).split("@")[0];
      sessionStorage.setItem("hcc-demo-user", u);
      authCb?.({ username: u, email: toEmail(u) });
    },
    async logout() { sessionStorage.removeItem("hcc-demo-user"); authCb?.(null); },
    watch(path, cb) {
      if (!listeners.has(path)) listeners.set(path, []);
      listeners.get(path).push(cb);
      setTimeout(() => cb(toList(data[path])), 380);
      return () => listeners.set(path, listeners.get(path).filter((f) => f !== cb));
    },
    watchConnection(cb) { setTimeout(() => cb(true), 400); return () => {}; },
    add(path, rec) { const key = uid(); (data[path] ||= {})[key] = rec; save(); emit(path); return { key, done: Promise.resolve() }; },
    update(path, id, patch) { if (data[path]?.[id]) { Object.entries(patch).forEach(([k, v]) => (v === null ? delete data[path][id][k] : (data[path][id][k] = v))); save(); emit(path); } return Promise.resolve(); },
    remove(path, id) { delete data[path]?.[id]; save(); emit(path); return Promise.resolve(); },
    async bulkAdd(path, recs, onProgress) {
      for (let i = 0; i < recs.length; i += 250) {
        recs.slice(i, i + 250).forEach((r) => ((data[path] ||= {})[uid()] = r));
        onProgress?.(Math.min(i + 250, recs.length), recs.length);
        await new Promise((r) => setTimeout(r, 60));
      }
      save(); emit(path);
    },
    clear(path) { data[path] = {}; save(); emit(path); return Promise.resolve(); },
    async getConfig(key) { return data.configuracoes?.[key] ?? null; },
    async setConfig(key, value) { (data.configuracoes ||= {})[key] = value; save(); return true; },
  };
}

function seed() {
  const nomes = ["Ana Beatriz Lima", "Carla Menezes", "Juliana Rocha", "Patrícia Alves", "Fernanda Costa", "Luana Medeiros", "Renata Dantas", "Bianca Freitas", "Camila Nóbrega", "Débora Silveira", "Larissa Fernandes", "Mariana Queiroz", "Tatiane Bezerra", "Vanessa Holanda", "Jeferson Melo", "Priscila Araújo"];
  const procs = [["Depilação a Laser", 210], ["Preenchimento", 1500], ["Botox", 1200], ["Retorno", 0], ["Sobrancelha", 80], ["Limpeza de Pele", 180], ["Bioestimulador", 2200], ["Drenagem", 120], ["Skin Booster", 900], ["Avaliação", 0]];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ag = {}; let n = 0;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  for (let off = -45; off <= 16; off++) {
    const d = new Date(today); d.setDate(d.getDate() + off);
    if (d.getDay() === 0) continue;
    const qtd = 3 + (((off * 7 + 11) % 6) + 6) % 6;
    const usados = new Set();
    for (let k = 0; k < qtd; k++) {
      const h = 8 + (((off * 3 + k * 5) % 11) + 11) % 11; const m = (k + off) % 2 ? "30" : "00";
      const horario = `${String(h).padStart(2, "0")}:${m}`;
      if (usados.has(horario)) continue; usados.add(horario);
      const [procedimento, valor] = procs[(((n * 7 + off) % procs.length) + procs.length) % procs.length];
      const status = off < 0 ? (n % 8 === 0 ? "cancelado" : "concluido") : (off === 0 && k < 2 ? "concluido" : "pendente");
      const rec = { cliente: nomes[(((n * 5 + off) % nomes.length) + nomes.length) % nomes.length], procedimento, data: iso(d), horario, valor, status };
      if (n % 3) rec.telefone = `(84) 9${String(8100 + ((n * 37) % 1800)).slice(0, 4)}-${String(1000 + ((n * 53) % 9000)).slice(-4)}`;
      ag[`-seed${String(n).padStart(4, "0")}`] = rec;
      n++;
    }
  }
  return { agendamentos: ag, pilates: {} };
}

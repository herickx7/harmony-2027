// =================================================================
// Importação e exportação de planilhas (SheetJS, carregado sob demanda)
// =================================================================
const XLSX_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
let xlsxPromise = null;

export function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = XLSX_URL;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => { xlsxPromise = null; reject(new Error("Não foi possível carregar o leitor de planilhas. Verifique a internet.")); };
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADERS = {
  data: ["data", "dia", "date", "dataatendimento", "datadoatendimento"],
  horario: ["horario", "hora", "horas", "time"],
  cliente: ["cliente", "nome", "paciente", "nomedacliente", "nomedocliente", "clientes"],
  procedimento: ["procedimento", "procedimentos", "servico", "servicos", "tratamento"],
  valor: ["valor", "valorrs", "preco", "total", "valortotal", "rs"],
  status: ["status", "situacao", "estado"],
  telefone: ["telefone", "celular", "whatsapp", "fone", "contato", "tel"],
  obs: ["obs", "observacao", "observacoes", "anotacao", "notas"],
};

function mapHeader(row) {
  const map = {};
  row.forEach((cell, i) => {
    const n = norm(String(cell ?? "").replace(/\(.*?\)/g, "")); // "Valor (R$)" → "valor"
    for (const [key, alts] of Object.entries(HEADERS)) {
      if (map[key] === undefined && alts.includes(n)) map[key] = i;
    }
  });
  return map;
}

const pad = (n) => String(n).padStart(2, "0");

export function parseDate(v, XLSX) {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === "number" && XLSX) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d && d.y > 1990) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    return "";
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/);
  if (m) {
    let y = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (y < 100) y += 2000;
    const d = Number(m[1]), mo = Number(m[2]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return "";
}

export function parseTime(v) {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date && !isNaN(v)) return `${pad(v.getHours())}:${pad(v.getMinutes())}`;
  if (typeof v === "number") {
    const frac = ((v % 1) + 1) % 1; // aceita datas-hora e valores negativos (fuso antigo)
    const mins = Math.round(frac * 24 * 60) % 1440;
    return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  }
  const m = String(v).trim().match(/(\d{1,2})\s*(?:[:hH.]\s*(\d{2})?)?/);
  if (!m) return "";
  const h = Number(m[1]), mi = Number(m[2] || 0);
  if (h > 23 || mi > 59) return "";
  return `${pad(h)}:${pad(mi)}`;
}

export function parseMoney(v) {
  if (typeof v === "number") return Math.round(v * 100) / 100;
  let s = String(v ?? "").replace(/[R$\s]/g, "").trim();
  if (!/\d/.test(s)) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : Math.round(n * 100) / 100;
}

export function parseStatus(v, fallback = "pendente") {
  const n = norm(v);
  if (!n) return fallback;
  if (/(conclu|pago|realiz|feito|ok|compareceu|atendid)/.test(n)) return "concluido";
  if (/(cancel|desmarc|faltou|naocompareceu)/.test(n)) return "cancelado";
  return "pendente";
}

/** Lê o arquivo e devolve { rows: [{...registro, _linha, _erro}] } */
export async function readSpreadsheet(file, { statusPadrao = "pendente" } = {}) {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  // raw:true impede que datas em texto (25/11/2026) sejam lidas no formato americano
  const wb = XLSX.read(buf, { type: "array", raw: true, cellDates: false });
  const rows = [];
  const meta = { hasStatus: false, hasHorario: false, abas: [] };
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false });
    let hIdx = -1, map = {};
    for (let i = 0; i < Math.min(grid.length, 15); i++) {
      const m = mapHeader(grid[i]);
      if (m.cliente !== undefined && (m.data !== undefined || m.horario !== undefined)) { hIdx = i; map = m; break; }
    }
    if (hIdx < 0) continue;
    meta.abas.push(name);
    if (map.status !== undefined) meta.hasStatus = true;
    if (map.horario !== undefined) meta.hasHorario = true;
    for (let i = hIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      const get = (k) => (map[k] === undefined ? "" : r[map[k]]);
      const cliente = String(get("cliente") ?? "").trim().replace(/\s+/g, " ");
      if (!cliente || /^total/i.test(cliente)) continue;
      const rec = {
        cliente,
        procedimento: String(get("procedimento") ?? "").trim() || "Não informado",
        data: parseDate(get("data"), XLSX),
        horario: map.horario === undefined ? "" : parseTime(get("horario")),
        valor: parseMoney(get("valor")),
        status: null,
      };
      // _st = status lido da planilha (null quando a planilha não tem a coluna)
      const st = map.status === undefined ? null : parseStatus(get("status"), statusPadrao);
      const tel = String(get("telefone") ?? "").trim(); if (tel) rec.telefone = tel;
      const obs = String(get("obs") ?? "").trim(); if (obs) rec.obs = obs;
      let erro = "";
      if (!rec.data) erro = "data inválida";
      else if (!rec.horario && map.horario !== undefined) erro = "horário inválido";
      else if (isNaN(rec.valor)) erro = "valor inválido";
      rows.push({ ...rec, _st: st, _linha: i + 1, _aba: name, _erro: erro });
    }
  }
  return { rows, meta };
}

const STATUS_TXT = { pendente: "Pendente", concluido: "Concluído", cancelado: "Cancelado" };

export async function exportSpreadsheet(items, filename) {
  const XLSX = await loadXLSX();
  const sorted = [...items].sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
  const data = sorted.map((i) => ({
    Data: i.data ? i.data.split("-").reverse().join("/") : "",
    "Horário": i.horario || "",
    Cliente: i.cliente || "",
    Telefone: i.telefone || "",
    Procedimento: i.procedimento || "",
    Valor: Number(i.valor) || 0,
    Status: STATUS_TXT[i.status] || "Pendente",
    "Observação": i.obs || "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = 1; r <= range.e.r; r++) { const c = ws[XLSX.utils.encode_cell({ r, c: 5 })]; if (c) c.z = '"R$" #,##0.00'; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Agendamentos");
  XLSX.writeFile(wb, filename);
}

/**
 * Super Lahap - Backend Google Apps Script
 *
 * CARA PAKAI:
 * 1. Buka Google Sheets > Extensions (Ekstensi) > Apps Script.
 * 2. Hapus isi default, tempel seluruh kode ini, lalu Save.
 * 3. Pilih fungsi "setup" di dropdown > Run. Izinkan akses saat diminta.
 *    (Ini membuat sheet "Menu" dan "Pesanan" beserta contoh data.)
 * 4. Deploy > New deployment > jenis "Web app".
 *    Execute as: Me | Who has access: Anyone > Deploy.
 * 5. Salin URL Web App (berakhiran /exec) ke SCRIPT_URL di app.js.
 *
 * Setiap kali kode ini diubah, buat deployment baru (Manage deployments > Edit > New version).
 */

const SHEET_MENU = "Menu";
const SHEET_ORDER = "Pesanan";
const MENU_HEAD = ["ID", "Nama", "Harga", "Emoji/URL Gambar", "Kategori", "Stok", "Deskripsi"];
const ORDER_HEAD = ["Waktu", "ID Pesanan", "Nama", "Meja", "Pesanan", "Jumlah Item", "Total", "Status", "Detail"];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let m = ss.getSheetByName(SHEET_MENU) || ss.insertSheet(SHEET_MENU);
  if (m.getLastRow() < 1) {
    const rows = [
      ["M01", "Burger Sapi", 28000, "🍔", "Makanan", 20, "Patty juicy, keju leleh, sayur segar."],
      ["M02", "Pizza Pepperoni", 45000, "🍕", "Makanan", 12, "Adonan tipis, pepperoni pedas gurih."],
      ["M03", "Ayam Goreng", 24000, "🍗", "Makanan", 25, "Renyah di luar, lembut di dalam."],
      ["M04", "Mie Pedas", 20000, "🍜", "Makanan", 18, "Kuah merah menggoda, level bisa diatur."],
      ["M05", "Kentang Goreng", 15000, "🍟", "Camilan", 30, "Garing, asin pas, cocok dicocol saus."],
      ["M06", "Donat Cokelat", 12000, "🍩", "Camilan", 24, "Lembut dengan lapisan cokelat tebal."],
      ["M07", "Es Teh Manis", 8000, "🥤", "Minuman", 40, "Segar, manisnya pas."],
      ["M08", "Es Krim Vanila", 14000, "🍦", "Minuman", 15, "Dingin, creamy, penutup yang manis."]
    ];
    m.getRange(1, 1, 1, MENU_HEAD.length).setValues([MENU_HEAD]);
    m.getRange(2, 1, rows.length, MENU_HEAD.length).setValues(rows);
    m.getRange(2, 3, 200, 1).setNumberFormat("#,##0");
  }
  styleHead_(m, MENU_HEAD.length);

  let o = ss.getSheetByName(SHEET_ORDER) || ss.insertSheet(SHEET_ORDER);
  if (o.getLastRow() < 1) {
    o.getRange(1, 1, 1, ORDER_HEAD.length).setValues([ORDER_HEAD]);
    o.getRange(2, 1, 1000, 1).setNumberFormat("dd/MM/yyyy HH:mm");
    o.getRange(2, 7, 1000, 1).setNumberFormat("#,##0");
  }
  styleHead_(o, ORDER_HEAD.length);

  const first = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1") || ss.getSheetByName("Lembar1");
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(first);
}

function styleHead_(sh, cols) {
  sh.getRange(1, 1, 1, cols).setFontWeight("bold").setBackground("#E8412C").setFontColor("#ffffff");
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, cols);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readMenu_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MENU);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues()
    .filter(function (r) { return r[0] !== "" && r[1] !== ""; })
    .map(function (r) {
      const stok = Number(r[5]);
      return {
        id: String(r[0]), nama: String(r[1]), harga: Number(r[2]) || 0,
        emoji: String(r[3] || "🍽️"), kategori: String(r[4] || "Lainnya"),
        stok: isNaN(stok) || r[5] === "" ? 999 : stok, deskripsi: String(r[6] || "")
      };
    });
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "menu";
    if (action === "menu") return json_({ ok: true, data: readMenu_() });
    if (action === "stats") return json_({ ok: true, data: stats_() });
    return json_({ ok: false, error: "Aksi tidak dikenal" });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function stats_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_ORDER);
  const tz = ss.getSpreadsheetTimeZone();
  const out = { orders: 0, revenue: 0, top: "-", recent: [] };
  if (!sh || sh.getLastRow() < 2) return out;

  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, ORDER_HEAD.length).getValues().filter(function (r) { return r[1] !== ""; });
  const count = {};
  rows.forEach(function (r) {
    out.orders++;
    out.revenue += Number(r[6]) || 0;
    try {
      JSON.parse(r[8]).forEach(function (d) { count[d[0]] = (count[d[0]] || 0) + d[1]; });
    } catch (x) { /* abaikan baris tanpa detail */ }
  });
  const names = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; });
  if (names.length) out.top = names[0];

  out.recent = rows.slice(-8).reverse().map(function (r) {
    const t = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, "dd/MM HH:mm") : String(r[0]);
    return { waktu: t, nama: String(r[2]), item: String(r[4]), total: Number(r[6]) || 0 };
  });
  return out;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = JSON.parse(e.postData.contents);
    const nama = String(body.nama || "").trim().substring(0, 40);
    const meja = String(body.meja || "").trim().substring(0, 6);
    const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
    if (!nama) return json_({ ok: false, error: "Nama pemesan wajib diisi" });
    if (!items.length) return json_({ ok: false, error: "Keranjang kosong" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ms = ss.getSheetByName(SHEET_MENU);
    const os = ss.getSheetByName(SHEET_ORDER);
    if (!ms || !os) return json_({ ok: false, error: "Jalankan fungsi setup terlebih dahulu" });

    const data = ms.getRange(2, 1, Math.max(ms.getLastRow() - 1, 1), 7).getValues();
    let total = 0, count = 0;
    const lines = [], detail = [], stokUpdate = [];

    for (let i = 0; i < items.length; i++) {
      const qty = Math.floor(Number(items[i].qty));
      if (!(qty >= 1 && qty <= 99)) return json_({ ok: false, error: "Jumlah pesanan tidak valid" });
      let idx = -1;
      for (let j = 0; j < data.length; j++) { if (String(data[j][0]) === String(items[i].id)) { idx = j; break; } }
      if (idx < 0) return json_({ ok: false, error: "Menu tidak ditemukan" });

      const nm = String(data[idx][1]), price = Number(data[idx][2]) || 0;
      const stok = data[idx][5] === "" ? null : Number(data[idx][5]);
      if (stok !== null && stok < qty) return json_({ ok: false, error: "Stok " + nm + " tidak cukup (sisa " + stok + ")" });

      total += price * qty; count += qty;
      lines.push(qty + "x " + nm);
      detail.push([nm, qty]);
      if (stok !== null) stokUpdate.push([idx + 2, stok - qty]);
    }

    const id = "ORD-" + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "ddHHmmss") + Math.floor(Math.random() * 90 + 10);
    os.appendRow([new Date(), id, nama, meja, lines.join(", "), count, total, "Diterima", JSON.stringify(detail)]);
    stokUpdate.forEach(function (u) { ms.getRange(u[0], 6).setValue(u[1]); });
    SpreadsheetApp.flush();

    return json_({ ok: true, data: { id: id, total: total } });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* lock tidak terpakai */ }
  }
}

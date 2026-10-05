/* =====================================================
   ISI DI SINI: tempel URL Web App dari Apps Script
   Contoh: "https://script.google.com/macros/s/AKfycb.../exec"
   Kosongkan untuk memakai mode demo (data tidak tersimpan).
   ===================================================== */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwEIjs5M4zeuyBmLKsNe498Q4HqYjuDM-2yDlrIihHGKtpP-o-wrHv0-atawXwkvvJr-Q/exec";
/* ===================================================== */

const DEMO_MENU = [
  { id: "M01", nama: "Burger Sapi", harga: 28000, emoji: "🍔", kategori: "Makanan", stok: 20, deskripsi: "Patty juicy, keju leleh, sayur segar." },
  { id: "M02", nama: "Pizza Pepperoni", harga: 45000, emoji: "🍕", kategori: "Makanan", stok: 12, deskripsi: "Adonan tipis, pepperoni pedas gurih." },
  { id: "M03", nama: "Ayam Goreng", harga: 24000, emoji: "🍗", kategori: "Makanan", stok: 25, deskripsi: "Renyah di luar, lembut di dalam." },
  { id: "M04", nama: "Mie Pedas", harga: 20000, emoji: "🍜", kategori: "Makanan", stok: 18, deskripsi: "Kuah merah menggoda, level bisa diatur." },
  { id: "M05", nama: "Kentang Goreng", harga: 15000, emoji: "🍟", kategori: "Camilan", stok: 30, deskripsi: "Garing, asin pas, cocok dicocol saus." },
  { id: "M06", nama: "Donat Cokelat", harga: 12000, emoji: "🍩", kategori: "Camilan", stok: 24, deskripsi: "Lembut dengan lapisan cokelat tebal." },
  { id: "M07", nama: "Es Teh Manis", harga: 8000, emoji: "🥤", kategori: "Minuman", stok: 40, deskripsi: "Segar, manisnya pas." },
  { id: "M08", nama: "Es Krim Vanila", harga: 14000, emoji: "🍦", kategori: "Minuman", stok: 15, deskripsi: "Dingin, creamy, penutup yang manis." }
];

const $ = (s) => document.querySelector(s);
const rp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const live = () => !!SCRIPT_URL.trim();

let menu = [], cart = {}, cat = "Semua", demoOrders = [], busy = false;

/* ---------- API ---------- */
async function apiGet(action) {
  const r = await fetch(SCRIPT_URL + "?action=" + action + "&t=" + Date.now());
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Permintaan gagal");
  return j.data;
}
async function apiPost(payload) {
  // text/plain menghindari preflight CORS pada Apps Script
  const r = await fetch(SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Pesanan gagal");
  return j.data;
}

/* ---------- UI helpers ---------- */
let tT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(tT); tT = setTimeout(() => t.classList.remove("on"), 3800);
}
function setStatus(ok) {
  const s = $("#status");
  s.className = "status rv in " + (ok ? "ok" : "demo");
  s.textContent = ok ? "Terhubung ke spreadsheet" : "Mode demo: belum terhubung ke spreadsheet";
}
function countUp(el, to, fmt) {
  const from = Number(el.dataset.v || 0), t0 = performance.now();
  el.dataset.v = to;
  (function step(t) {
    const p = Math.min((t - t0) / 900, 1), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

/* ---------- Menu ---------- */
async function loadMenu() {
  $("#grid").innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div>';
  try {
    if (live()) { menu = await apiGet("menu"); setStatus(true); }
    else { if (!menu.length) menu = JSON.parse(JSON.stringify(DEMO_MENU)); setStatus(false); }
  } catch (err) {
    menu = JSON.parse(JSON.stringify(DEMO_MENU));
    setStatus(false);
    toast("Gagal memuat spreadsheet. Memakai menu demo. (" + err.message + ")");
  }
  renderChips(); renderMenu();
}
function renderChips() {
  const cats = ["Semua"].concat([...new Set(menu.map((m) => m.kategori).filter(Boolean))]);
  if (!cats.includes(cat)) cat = "Semua";
  $("#chips").innerHTML = cats.map((c) => '<button class="chip' + (c === cat ? " on" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>").join("");
}
function renderMenu() {
  const list = menu.filter((m) => cat === "Semua" || m.kategori === cat);
  if (!list.length) { $("#grid").innerHTML = '<p class="sub" style="grid-column:1/-1;text-align:center">Belum ada menu. Isi sheet "Menu" di spreadsheet.</p>'; return; }
  $("#grid").innerHTML = list.map((m, i) => {
    const q = cart[m.id] || 0, out = m.stok <= 0;
    const pic = /^https?:\/\//.test(m.emoji) ? '<img src="' + esc(m.emoji) + '" alt="' + esc(m.nama) + '" loading="lazy">' : esc(m.emoji || "🍽️");
    return '<article class="item rv" style="--dl:' + Math.min(i % 4, 3) * 0.08 + 's" data-id="' + esc(m.id) + '">' +
      '<div class="pic">' + pic + "<em>" + (out ? "Habis" : "Stok " + m.stok) + "</em></div>" +
      "<h3>" + esc(m.nama) + "</h3><p>" + esc(m.deskripsi) + "</p>" +
      '<div class="row"><span class="price">' + rp(m.harga) + "</span>" +
      '<div class="qty"><button data-act="sub" aria-label="Kurangi" ' + (q ? "" : "disabled") + ">−</button><span>" + q + "</span>" +
      '<button data-act="add" aria-label="Tambah" ' + (q >= m.stok ? "disabled" : "") + ">+</button></div></div></article>";
  }).join("");
  observeReveal();
}

/* ---------- Keranjang ---------- */
function cartTotals() {
  let n = 0, total = 0;
  menu.forEach((m) => { const q = cart[m.id] || 0; n += q; total += q * m.harga; });
  return { n, total };
}
function renderCart() {
  const { n, total } = cartTotals();
  $("#cartCount").textContent = n;
  $("#cTotal").textContent = rp(total);
  $("#send").disabled = !n || busy;
  const rows = menu.filter((m) => cart[m.id]);
  $("#lines").innerHTML = rows.length ? rows.map((m) =>
    '<div class="line" data-id="' + esc(m.id) + '"><span class="e">' + (/^https?:/.test(m.emoji) ? "🍽️" : esc(m.emoji)) + "</span>" +
    "<div><b>" + esc(m.nama) + "</b>" + rp(m.harga) + " × " + cart[m.id] + "</div>" +
    '<div class="qty"><button data-act="sub" aria-label="Kurangi">−</button><span>' + cart[m.id] + '</span><button data-act="add" aria-label="Tambah" ' + (cart[m.id] >= m.stok ? "disabled" : "") + ">+</button></div></div>"
  ).join("") : '<p class="empty">Keranjang masih kosong.<br>Pilih menu dulu, ya.</p>';
}
function change(id, d) {
  const m = menu.find((x) => x.id === id);
  if (!m) return;
  const q = Math.max(0, Math.min(m.stok, (cart[id] || 0) + d));
  if (q) cart[id] = q; else delete cart[id];
  if (d > 0) { const b = $("#openCart"); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
  renderCart();
  const card = document.querySelector('.item[data-id="' + id + '"]');
  if (card) {
    card.querySelector(".qty span").textContent = q;
    card.querySelector('[data-act="sub"]').disabled = !q;
    card.querySelector('[data-act="add"]').disabled = q >= m.stok;
  }
}
function toggleCart(open) {
  $("#drawer").classList.toggle("on", open);
  $("#ov").classList.toggle("on", open);
}

/* ---------- Kirim pesanan ---------- */
async function sendOrder() {
  const nama = $("#fName").value.trim(), meja = $("#fTable").value.trim();
  if (!nama) { toast("Isi nama pemesan dulu."); $("#fName").focus(); return; }
  const items = Object.keys(cart).map((id) => ({ id, qty: cart[id] }));
  if (!items.length) return;
  busy = true; $("#send").disabled = true; $("#send").textContent = "Mengirim…";
  try {
    let res;
    if (live()) res = await apiPost({ nama, meja, items });
    else res = demoOrder(nama, meja, items);
    cart = {}; $("#fName").value = ""; $("#fTable").value = "";
    toggleCart(false);
    $("#mText").textContent = "Nomor pesanan " + res.id + " • Total " + rp(res.total);
    $("#modal").classList.add("on");
    await loadMenu(); loadStats();
  } catch (err) {
    toast(err.message);
  } finally {
    busy = false; $("#send").textContent = "Kirim pesanan"; renderCart();
  }
}
function demoOrder(nama, meja, items) {
  return new Promise((ok) => setTimeout(() => {
    let total = 0; const parts = [];
    items.forEach((it) => {
      const m = menu.find((x) => x.id === it.id);
      m.stok -= it.qty; total += m.harga * it.qty; parts.push(it.qty + "x " + m.nama);
    });
    const id = "DEMO-" + (demoOrders.length + 1);
    demoOrders.unshift({ waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), nama, item: parts.join(", "), total, top: items });
    ok({ id, total });
  }, 700));
}

/* ---------- Dashboard ---------- */
async function loadStats() {
  let s;
  try {
    if (live()) s = await apiGet("stats");
    else {
      const c = {};
      demoOrders.forEach((o) => o.top.forEach((i) => { const m = DEMO_MENU.find((x) => x.id === i.id); c[m.nama] = (c[m.nama] || 0) + i.qty; }));
      const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "-";
      s = { orders: demoOrders.length, revenue: demoOrders.reduce((a, o) => a + o.total, 0), top, recent: demoOrders.slice(0, 8) };
    }
  } catch (err) { toast("Dashboard gagal dimuat: " + err.message); return; }
  countUp($("#sOrders"), s.orders, (v) => v);
  countUp($("#sRev"), s.revenue, rp);
  $("#sTop").textContent = s.top || "-";
  $("#recent").innerHTML = s.recent && s.recent.length
    ? s.recent.map((o) => "<tr><td>" + esc(o.waktu) + "</td><td>" + esc(o.nama) + "</td><td>" + esc(o.item) + '</td><td class="r">' + rp(o.total) + "</td></tr>").join("")
    : '<tr><td colspan="4" class="empty">Belum ada pesanan.</td></tr>';
}

/* ---------- Event ---------- */
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) { cat = chip.dataset.cat; renderChips(); renderMenu(); return; }
  const btn = e.target.closest("[data-act]");
  if (btn) { const host = btn.closest("[data-id]"); if (host) change(host.dataset.id, btn.dataset.act === "add" ? 1 : -1); }
});
$("#openCart").addEventListener("click", () => toggleCart(true));
$("#closeCart").addEventListener("click", () => toggleCart(false));
$("#ov").addEventListener("click", () => toggleCart(false));
$("#send").addEventListener("click", sendOrder);
$("#mClose").addEventListener("click", () => { $("#modal").classList.remove("on"); document.getElementById("menu").scrollIntoView(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { toggleCart(false); $("#modal").classList.remove("on"); } });

renderCart();
loadMenu();
loadStats();
if (live()) setInterval(loadStats, 30000);

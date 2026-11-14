// ご予約ページのモックの動き。予約のデータは assets/mock-db.js（予約管理と同じもの）に入れる。どこにも送らない。
const S = window.SUI;
const $ = (id) => document.getElementById(id);
const { esc, yen, jd, span, toMin, toTime, PRICE } = S;
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

// ---- 月のカレンダー ------------------------------------------------------
// opt: { min, max, start, sel, info(off) → { cls, mark, label, disabled }, onPick(off) }
function Month(root, opt) {
  const wrap = document.createElement("div");
  root.replaceChildren(wrap);
  const at = S.dayOf(opt.start ?? opt.min);
  let y = at.getFullYear(), m = at.getMonth();
  const lo = S.dayOf(opt.min), hi = S.dayOf(opt.max);
  const minYM = lo.getFullYear() * 12 + lo.getMonth(), maxYM = hi.getFullYear() * 12 + hi.getMonth();
  function draw() {
    const lead = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    let cells = "";
    for (let i = 0; i < lead; i++) cells += '<span class="d blank" aria-hidden="true"></span>';
    for (let dd = 1; dd <= count; dd++) {
      const off = S.offOf(y, m, dd);
      const inf = off >= opt.min && off <= opt.max ? opt.info(off) || { disabled: true } : { disabled: true };
      const cls = `d ${inf.cls || ""}${opt.sel === off ? " sel" : ""}`;
      cells += inf.disabled
        ? `<button type="button" class="${cls}" disabled><span class="n">${dd}</span><span class="m">${inf.mark || ""}</span></button>`
        : `<button type="button" class="${cls}" data-off="${off}" aria-label="${jd(off)} ${esc(inf.label || inf.mark || "")}" aria-pressed="${opt.sel === off}"><span class="n">${dd}</span><span class="m">${inf.mark || ""}</span></button>`;
    }
    const ym = y * 12 + m;
    wrap.innerHTML = `<div class="mcal"><div class="mcal-head"><button type="button" class="btn sm" data-mv="-1" ${ym <= minYM ? "disabled" : ""}>前の月</button><b>${y}年${m + 1}月</b><button type="button" class="btn sm" data-mv="1" ${ym >= maxYM ? "disabled" : ""}>次の月</button></div>
      <div class="mcal-grid">${S.WD.map((w) => `<span class="wd">${w}</span>`).join("")}${cells}</div></div>`;
  }
  wrap.addEventListener("click", (e) => {
    const mv = e.target.closest("[data-mv]");
    if (mv) { const t = y * 12 + m + Number(mv.dataset.mv); y = Math.floor(t / 12); m = t % 12; return draw(); }
    const b = e.target.closest("[data-off]");
    if (b) { opt.sel = Number(b.dataset.off); draw(); if (opt.onPick) opt.onPick(opt.sel); }
  });
  draw();
  return { draw, select(off) { opt.sel = off; const d = S.dayOf(off); y = d.getFullYear(); m = d.getMonth(); draw(); } };
}

// ---- レンタル：空き状況 ---------------------------------------------------
const dayBusy = (off, exceptNo) => S.busy(exceptNo).filter((b) => b.day === off);
function freeRuns(off, exceptNo) {
  const bs = dayBusy(off, exceptNo).map((b) => [Math.max(b.s, S.OPEN), Math.min(b.e, S.CLOSE)]).filter(([a, b]) => a < b).sort((a, b) => a[0] - b[0]);
  const runs = []; let cur = S.OPEN;
  bs.forEach(([a, b]) => { if (a > cur) runs.push([cur, a]); cur = Math.max(cur, b); });
  if (cur < S.CLOSE) runs.push([cur, S.CLOSE]);
  return runs;
}
function rentalInfo(off, exceptNo) {
  if (off < S.RENTAL_FROM) return { disabled: true, mark: off >= 0 ? "締切" : "" };
  if (S.db.closed.some((c) => c.day === off)) return { cls: "off", mark: "休", disabled: true };
  const runs = freeRuns(off, exceptNo);
  const longest = Math.max(0, ...runs.map(([a, b]) => b - a));
  if (longest < 120) return { cls: "full", mark: "×", label: "空きがありません", disabled: true };
  const total = runs.reduce((n, [a, b]) => n + b - a, 0);
  return total === S.CLOSE - S.OPEN ? { cls: "free", mark: "○", label: "終日空いています" } : { cls: "few", mark: "△", label: "一部空いています" };
}

// 日にち → 開始の時刻 → ご利用時間 の順に選んで、希望を max 個まで集める
function RentalPicker(root, { max = 3, exceptNo, initial = [], onChange }) {
  const wrap = document.createElement("div");
  root.replaceChildren(wrap);
  wrap.innerHTML = `<div class="pick2"><div><div class="rp-cal"></div><p class="legend"><span>○ 終日空き</span><span>△ 一部空き</span><span>× 空きなし</span><span>斜線 お休み</span></p></div><div class="dayp rp-day"></div></div><div class="rp-list"></div>`;
  let choices = initial.map((c) => ({ ...c }));
  let day = null, start = null, hours = null;
  const cal = Month(wrap.querySelector(".rp-cal"), { min: 0, max: S.RENTAL_TO, start: S.RENTAL_FROM, info: (off) => rentalInfo(off, exceptNo), onPick: (off) => { day = off; start = null; hours = null; drawDay(); } });
  const total = S.CLOSE - S.OPEN;
  const pos = (a, b) => `left:${((a - S.OPEN) / total) * 100}%;width:${((b - a) / total) * 100}%`;
  function drawDay() {
    const el = wrap.querySelector(".rp-day");
    if (day == null) { el.innerHTML = `<h4>日にちを選んでください</h4><p class="note" style="margin:0">カレンダーで日にちを押すと、その日の空いている時間がここに出ます。</p>`; return; }
    const segs = dayBusy(day, exceptNo).map((b) => { const a = Math.max(b.s, S.OPEN), e = Math.min(b.e, S.CLOSE); return a < e ? `<span class="seg" style="${pos(a, e)}" title="${b.pub}">${b.pub}</span>` : ""; }).join("");
    const sel = start != null && hours ? `<span class="seg sel" style="${pos(start, start + hours * 60)}">選んでいる時間</span>` : "";
    const ticks = [9, 12, 15, 18, 21].map((h) => `<span style="left:${((h * 60 - S.OPEN) / total) * 100}%">${h}:00</span>`).join("");
    let starts = "";
    for (let t = S.OPEN; t <= S.CLOSE - 120; t += 30) {
      const ok = !S.conflict(day, toTime(t), 120, exceptNo);
      starts += `<button type="button" class="tchip${start === t ? " on" : ""}" data-start="${t}" ${ok ? "" : "disabled"} aria-pressed="${start === t}">${toTime(t)}</button>`;
    }
    let hrs = "";
    if (start != null) {
      Object.keys(PRICE).map(Number).forEach((h) => {
        const ok = start + h * 60 <= S.CLOSE && !S.conflict(day, toTime(start), h * 60, exceptNo);
        hrs += `<button type="button" class="tchip${hours === h ? " on" : ""}" data-hours="${h}" ${ok ? "" : "disabled"} aria-pressed="${hours === h}">${h}時間<small>${yen(PRICE[h])}</small></button>`;
      });
    }
    const full = choices.length >= max;
    const dup = start != null && hours && choices.some((c) => c.day === day && c.start === toTime(start) && c.h === hours);
    el.innerHTML = `<h4>${jd(day)} の空き</h4>
      <div class="tl"><div class="bar">${segs}${sel}</div><div class="ticks">${ticks}</div></div>
      <p class="note" style="margin:var(--s-2) 0 0">斜線のところは、ほかのご予約やレッスンが入っています。準備と片付けの時間も含めて選んでください。</p>
      <p class="lbl">開始の時刻</p><div class="tchips">${starts}</div>
      ${start != null ? `<p class="lbl">ご利用時間（総額・税込）</p><div class="tchips">${hrs}</div>` : ""}
      ${start != null && hours ? `<div class="pick-sum"><span>${span(toTime(start), hours * 60)}（${hours}時間）<b>${yen(PRICE[hours])}</b></span>
        <button type="button" class="btn primary" data-addchoice ${full || dup ? "disabled" : ""}>${max > 1 ? `第${choices.length + 1}希望に入れる` : "この日時にする"}</button></div>
        ${full ? `<p class="note">希望は${max}つまでです。入れ替えるときは、下の一覧から外してください。</p>` : ""}${dup ? '<p class="note">同じ日時がもう入っています。</p>' : ""}` : ""}`;
  }
  function drawList() {
    const el = wrap.querySelector(".rp-list");
    el.innerHTML = choices.length
      ? `<ol class="choices">${choices.map((c, i) => `<li><span class="ttl">${max > 1 ? `第${i + 1}希望` : "変更後"}</span><span>${S.whenText(c)}</span><b>${yen(PRICE[c.h])}</b><button type="button" class="btn sm" data-rm="${i}">外す</button></li>`).join("")}</ol>`
      : `<p class="note" style="margin-top:var(--s-3)">まだ日時が入っていません。${max > 1 ? `希望は${max}つまで入れられます。第1希望から順にお返事します。` : ""}</p>`;
    if (onChange) onChange(choices);
  }
  wrap.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const d = t.dataset;
    if (d.start) { start = Number(d.start); hours = null; return drawDay(); }
    if (d.hours) { hours = Number(d.hours); return drawDay(); }
    if ("addchoice" in d) { choices.push({ day, start: toTime(start), h: hours }); start = null; hours = null; drawDay(); return drawList(); }
    if (d.rm) { choices.splice(Number(d.rm), 1); drawDay(); return drawList(); }
  });
  drawDay(); drawList();
  return {
    get choices() { return choices; },
    clear() { choices = []; day = null; start = null; hours = null; cal.draw(); drawDay(); drawList(); },
    refresh() { cal.draw(); drawDay(); },
  };
}

// ---- ピラティス：時間割 ----------------------------------------------------
const lessonSlots = (exceptSlot) => S.db.slots.filter((s) => s.kind === "lesson" && s.id !== exceptSlot && s.day >= 0 && s.day <= S.LESSON_TO);
function slotState(s) {
  const left = s.cap - S.booked(s.id);
  if (s.day === 0 && toMin(s.start) - nowMin() < 180) return { left, ok: false, text: "締め切りました" };
  return { left, ok: left > 0, text: left > 0 ? `あと${left}名` : "満席" };
}
function lessonInfo(off, exceptSlot) {
  const list = lessonSlots(exceptSlot).filter((s) => s.day === off);
  if (!list.length) return { disabled: true };
  const open = list.filter((s) => slotState(s).ok).length;
  return open ? { cls: "free", mark: `${open}回`, label: `予約できる回が${open}つあります` } : { cls: "full", mark: "満席", label: "満席です" };
}
function LessonPicker(root, { exceptSlot, onPick, btn = "選ぶ" }) {
  const wrap = document.createElement("div");
  root.replaceChildren(wrap);
  wrap.innerHTML = `<div class="pick2"><div class="lp-cal"></div><div class="dayp lp-day"></div></div>`;
  const firstOpen = lessonSlots(exceptSlot).find((s) => slotState(s).ok);
  let day = firstOpen ? firstOpen.day : null;
  const cal = Month(wrap.querySelector(".lp-cal"), { min: 0, max: S.LESSON_TO, start: day ?? 0, sel: day, info: (off) => lessonInfo(off, exceptSlot), onPick: (off) => { day = off; drawDay(); } });
  function drawDay() {
    const el = wrap.querySelector(".lp-day");
    if (day == null) { el.innerHTML = `<h4>日にちを選んでください</h4><p class="note" style="margin:0">いま予約できる回がありません。</p>`; return; }
    const list = lessonSlots(exceptSlot).filter((s) => s.day === day).sort((a, b) => toMin(a.start) - toMin(b.start));
    el.innerHTML = `<h4>${jd(day)} のレッスン</h4><ul class="slots">${list.map((s) => {
      const st = slotState(s);
      const p = S.LESSON_PRICE[s.name];
      return `<li><div><span class="chip lesson">${s.name}</span> <span class="when">${span(s.start, s.min)}</span><br><span class="note">${p ? `${yen(p[0])}（初回体験 ${yen(p[1])}）` : ""}${s.name === "パーソナル" ? ' <span class="todo">※3,500円か3,000円か確認中</span>' : ""}</span></div>
        <span class="left">${st.text}</span><button class="btn" type="button" data-slot="${s.id}" ${st.ok ? "" : "disabled"}>${st.ok ? btn : st.text}</button></li>`;
    }).join("")}</ul>`;
  }
  wrap.addEventListener("click", (e) => { const b = e.target.closest("[data-slot]"); if (b) onPick(S.slot(b.dataset.slot)); });
  drawDay();
  return { refresh() { cal.draw(); drawDay(); } };
}

// ---- 共通の表示 ------------------------------------------------------------
const mailHtml = (m, open = true) => m ? `<details class="mailbox"${open ? " open" : ""}><summary>お送りしたメール（見本）：${esc(m.subject)}</summary><pre>${esc(m.body)}</pre></details>` : "";
function addCalHtml(title, day, s, e, uid) {
  return `<a href="${S.gcal(title, day, s, e)}" target="_blank" rel="noopener">Googleカレンダーに入れる</a><button type="button" class="demo-reset" data-ics="${esc(JSON.stringify({ title, day, s, e, uid }))}">iPhone・Outlook のカレンダーに入れる（.ics）</button>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ics]");
  if (!b) return;
  const ev = JSON.parse(b.dataset.ics);
  S.download("musubiya-sui.ics", S.ics([{ ...ev, desc: "結び家SUI（モック）" }]));
});

// ---- レンタルの申込み -------------------------------------------------------
function setStep(n) { [...$("r-steps").children].forEach((li, k) => li.classList.toggle("on", k < n)); }
const rPicker = RentalPicker($("r-picker"), { max: 3, onChange: (c) => setStep(c.length ? 2 : 1) });
const rFields = () => ({ name: $("r-name").value.trim(), kana: $("r-kana").value.trim(), tel: $("r-tel").value.trim(), mail: $("r-mail").value.trim(), purpose: $("r-purpose").value, people: Number($("r-people").value) || 1 });

$("r-confirm").addEventListener("click", () => {
  const f = rFields();
  const msgs = [];
  if (!rPicker.choices.length) msgs.push("カレンダーで日時を1つ以上選んでください。");
  const taken = rPicker.choices.filter((c) => S.conflict(c.day, c.start, c.h * 60));
  if (taken.length) msgs.push(`${taken.map((c) => S.whenText(c)).join("、")} は、ほかのご予約が入ってしまいました。選び直してください。`);
  const missing = [["お名前", f.name], ["ふりがな", f.kana], ["電話番号", f.tel], ["メールアドレス", f.mail], ["ご利用の目的", f.purpose]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) msgs.push(`${missing.join("、")}を入れてください。`);
  if (!$("r-agree").checked) msgs.push("利用規約への同意が必要です。");
  $("r-err").textContent = msgs.join(" ");
  $("r-err").classList.toggle("hidden", !msgs.length);
  if (msgs.length) return;
  const rows = rPicker.choices.map((c, k) => `<tr><th scope="row">第${k + 1}希望</th><td>${S.whenText(c)}</td><td class="num">${yen(PRICE[c.h])}</td></tr>`).join("");
  $("r-summary").innerHTML = `<table class="t"><tbody>${rows}
    <tr><th scope="row">お名前</th><td colspan="2">${esc(f.name)}（${esc(f.kana)}）</td></tr>
    <tr><th scope="row">ご連絡先</th><td colspan="2">${esc(f.tel)}／${esc(f.mail)}</td></tr>
    <tr><th scope="row">目的と人数</th><td colspan="2">${esc(f.purpose)}、${f.people}名</td></tr></tbody></table>
    <p class="note" style="margin-top:12px">承認した希望の料金をお支払いいただきます。ご利用日の7日前からのキャンセルは、料金の全額をいただきます。</p>`;
  $("r-form").classList.add("hidden");
  $("r-check").classList.remove("hidden");
  setStep(3);
  $("rental").scrollIntoView();
});
$("r-back").addEventListener("click", () => { $("r-check").classList.add("hidden"); $("r-form").classList.remove("hidden"); setStep(2); });
let lastRental = null;
$("r-submit").addEventListener("click", () => {
  const f = rFields();
  const r = { no: S.code(), recv: Date.now(), status: "pending", ...f, note: $("r-desc").value.trim(), flags: [...document.querySelectorAll("#r-flags input:checked")].map((x) => x.value), found: $("r-know").value || "（未回答）", line: $("r-line").checked, choices: rPicker.choices.map((c) => ({ ...c })) };
  S.db.req.push(r);
  const m = S.mail("rental_received", r, [r]);
  S.owner("new_rental", [r]);
  S.save();
  S.addMine("rental", r.no);
  lastRental = r;
  $("r-no").textContent = r.no;
  $("r-mail-box").innerHTML = mailHtml(m, false);
  $("r-check").classList.add("hidden");
  $("r-done").classList.remove("hidden");
  setStep(4);
  renderMine();
  $("rental").scrollIntoView();
});
$("r-open").addEventListener("click", () => openRecord("rental", lastRental));
$("r-again").addEventListener("click", () => {
  rPicker.clear();
  $("r-done").classList.add("hidden");
  $("r-form").classList.remove("hidden");
  setStep(1);
});

// ---- ピラティスの予約 --------------------------------------------------------
let chosen = null;
const lPicker = LessonPicker($("l-picker"), {
  onPick: (s) => {
    chosen = s;
    $("l-ttl").textContent = `${s.name}　${jd(s.day)} ${span(s.start, s.min)}`;
    const p = S.LESSON_PRICE[s.name];
    $("l-price").textContent = p ? `${yen(p[0])}（初回体験 ${yen(p[1])}）` : "○円";
    $("l-form").classList.remove("hidden");
    $("l-done").classList.add("hidden");
    $("l-err").classList.add("hidden");
    $("l-form").scrollIntoView({ block: "center" });
  },
});
$("l-back").addEventListener("click", () => { $("l-form").classList.add("hidden"); $("l-picker").scrollIntoView({ block: "center" }); });
let lastLesson = null;
$("l-submit").addEventListener("click", () => {
  const v = (id) => $(id).value.trim();
  const msgs = [];
  if (!["l-name", "l-kana", "l-tel", "l-mail"].every((id) => v(id))) msgs.push("お名前、ふりがな、電話番号、メールアドレスを入れてください。");
  if (!$("l-agree").checked) msgs.push("お支払いとキャンセルのきまりへの同意が必要です。");
  if (chosen && !slotState(chosen).ok) msgs.push("この回は、いま満席になりました。ほかの回を選んでください。");
  $("l-err").textContent = msgs.join(" ");
  $("l-err").classList.toggle("hidden", !msgs.length);
  if (msgs.length) return;
  const b = { no: S.code(), slot: chosen.id, name: v("l-name"), kana: v("l-kana"), tel: v("l-tel"), mail: v("l-mail"), trial: $("l-first").checked, note: v("l-body"), status: "confirmed", recv: Date.now() };
  S.db.book.push(b);
  const m = S.mail("lesson_confirmed", b, [b, chosen]);
  S.owner("new_lesson", [b, chosen]);
  S.save();
  S.addMine("lesson", b.no);
  lastLesson = b;
  $("l-no").textContent = b.no;
  $("l-done-txt").textContent = `${chosen.name}　${jd(chosen.day)} ${span(chosen.start, chosen.min)}　${S.lessonPriceText(chosen, b.trial)}`;
  $("l-addcal").innerHTML = addCalHtml(`結び家SUI ${chosen.name}`, chosen.day, toMin(chosen.start), toMin(chosen.start) + chosen.min, b.no);
  $("l-mail-box").innerHTML = mailHtml(m, false);
  $("l-form").classList.add("hidden");
  $("l-done").classList.remove("hidden");
  lPicker.refresh();
  renderMine();
});
$("l-open").addEventListener("click", () => openRecord("lesson", lastLesson));
$("l-again").addEventListener("click", () => { $("l-done").classList.add("hidden"); $("l-picker").scrollIntoView({ block: "center" }); });
document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === b));
  $("tab-pilates").classList.toggle("hidden", b.dataset.tab !== "pilates");
  $("tab-yoga").classList.toggle("hidden", b.dataset.tab !== "yoga");
  $("l-form").classList.add("hidden");
}));

// イベント（今回は表示例のまま）
document.querySelectorAll("[data-event]").forEach((b) => b.addEventListener("click", () => $("e-done").classList.remove("hidden")));

// ---- ご予約の確認・変更・キャンセル --------------------------------------------
// 1件の予約がカレンダーのどの日に当たるか
function recordDays(type, rec) {
  if (type === "lesson") { const s = S.slot(rec.slot); return s ? [{ day: s.day, mark: "ご予約", held: rec.status === "confirmed" }] : []; }
  if (S.isHeld(rec)) {
    const list = [{ day: rec.choices[rec.pick].day, mark: "ご予約", held: true }];
    if (rec.change) rec.change.choices.forEach((c) => list.push({ day: c.day, mark: "変更希望", held: false }));
    return list;
  }
  if (rec.status === "pending") return rec.choices.map((c, i) => ({ day: c.day, mark: `第${i + 1}希望`, held: false }));
  return [];
}
function recCalendar(el, items, onPick) {
  const first = items.length ? Math.min(...items.map((x) => x.day)) : 0;
  return Month(el, {
    min: 0, max: S.RENTAL_TO, start: Math.max(first, 0),
    info: (off) => { const hit = items.filter((x) => x.day === off); if (!hit.length) return { disabled: true }; return { cls: hit.some((x) => x.held) ? "mine" : "mine-p", mark: hit[0].mark, label: hit.map((x) => x.mark).join("・") }; },
    onPick: onPick || (() => {}),
  });
}

// この端末で申し込んだご予約
function resolveMine() {
  return S.mine().map((x) => ({ ...x, rec: x.type === "rental" ? S.req(x.no) : S.bookOf(x.no) })).filter((x) => x.rec);
}
function mineLine(x) {
  if (x.type === "lesson") {
    const s = S.slot(x.rec.slot);
    return `<span class="chip lesson">ピラティス</span><span class="when">${s ? `${jd(s.day)} ${span(s.start, s.min)}` : ""}</span><span class="chip ${x.rec.status === "confirmed" ? "paid" : "cancelled"}">${x.rec.status === "confirmed" ? "確定" : "キャンセル"}</span>`;
  }
  const r = x.rec;
  const when = S.isHeld(r) || r.status === "cancelled" && r.pick != null ? S.whenText(r.choices[r.pick ?? 0]) : `第1希望 ${S.whenText(r.choices[0])}`;
  return `<span class="chip rental">レンタル</span><span class="when">${when}</span><span class="chip ${r.status}">${S.STATUS[r.status]}</span>${r.change ? '<span class="chip pending">変更の確認中</span>' : ""}`;
}
function renderMine() {
  const list = resolveMine();
  const el = $("mine");
  if (!list.length) { el.innerHTML = `<p class="note" style="margin:0">この端末で申し込んだご予約は、まだありません。申し込むと、ここにカレンダーと一覧で出ます。</p>`; return; }
  el.innerHTML = `<div class="rec2"><div class="mine-cal"></div><div><p class="note" style="margin:0">塗りつぶしは確定したご予約、点線は確認中の希望です。日にちか一覧を押すと、詳しい内容が開きます。</p><ul class="mine-list">${list.map((x, i) => `<li>${mineLine(x)}<button type="button" class="btn sm" data-mine="${i}">開く</button></li>`).join("")}</ul></div></div>`;
  const items = [];
  list.forEach((x, i) => recordDays(x.type, x.rec).forEach((d) => items.push({ ...d, i })));
  recCalendar(el.querySelector(".mine-cal"), items, (off) => { const hit = items.find((x) => x.day === off); if (hit) openRecord(list[hit.i].type, list[hit.i].rec); });
  el.querySelectorAll("[data-mine]").forEach((b) => b.addEventListener("click", () => { const x = list[Number(b.dataset.mine)]; openRecord(x.type, x.rec); }));
}

// 番号で探す
function findRecord(no, tel) {
  const key = no.trim().toUpperCase();
  const r = S.req(key);
  if (r && S.digits(r.tel) === S.digits(tel)) return ["rental", r];
  const b = S.bookOf(key);
  if (b && S.digits(b.tel) === S.digits(tel)) return ["lesson", b];
  return null;
}
$("s-go").addEventListener("click", () => {
  const hit = findRecord($("s-no").value, $("s-tel").value);
  $("s-err").classList.toggle("hidden", !!hit);
  if (hit) openRecord(hit[0], hit[1]);
  else $("s-result").innerHTML = "";
});
document.querySelectorAll("[data-try]").forEach((b) => b.addEventListener("click", () => {
  const [no, tel] = b.dataset.try.split(",");
  $("s-no").value = no; $("s-tel").value = tel;
  $("s-go").click();
}));

// 1件の詳しい内容と、変更・キャンセル
let cur = null; // { type, no, mode, mail, msg }
function openRecord(type, rec) {
  if (!rec) return;
  cur = { type, no: rec.no, mode: null, mail: null, msg: "" };
  renderResult();
  $("s-result").scrollIntoView({ block: "start" });
}
function renderResult() {
  const el = $("s-result");
  if (!cur) { el.innerHTML = ""; return; }
  const rec = cur.type === "rental" ? S.req(cur.no) : S.bookOf(cur.no);
  if (!rec) { el.innerHTML = ""; return; }
  el.innerHTML = cur.type === "rental" ? rentalResult(rec) : lessonResult(rec);
  recCalendar(el.querySelector(".rec-cal"), recordDays(cur.type, rec));
  if (cur.mode === "rechoose" || cur.mode === "change") {
    cur.picker = RentalPicker(el.querySelector(".rec-picker"), { max: cur.mode === "change" ? 3 : 3, exceptNo: rec.no, initial: cur.mode === "rechoose" ? rec.choices : [] });
  }
  if (cur.mode === "move") {
    LessonPicker(el.querySelector(".rec-picker"), { exceptSlot: rec.slot, btn: "この回に変える", onPick: (s) => moveLesson(rec, s) });
  }
}
const resultShell = (head, title, body, calNote, actions) => `<div class="panel">
  <div class="rec-head">${head}</div>
  <p class="rec-ttl">${title}</p>
  <div class="rec2"><div>${body}</div><div><div class="rec-cal"></div><p class="note" style="margin-top:var(--s-2)">${calNote}</p></div></div>
  ${cur.msg ? `<p style="margin-top:var(--s-4);font-weight:500">${cur.msg}</p>` : ""}
  ${actions}
  ${mailHtml(cur.mail)}
</div>`;

function rentalResult(r) {
  const held = S.isHeld(r);
  const c = held || (r.status === "cancelled" && r.pick != null) ? r.choices[r.pick] : null;
  const head = `<span class="chip rental">レンタル</span><span class="chip ${r.status}">${S.STATUS[r.status]}</span>${r.change ? '<span class="chip pending">変更の確認中</span>' : ""}<span class="note">受付番号 ${r.no}</span>`;
  const title = c ? S.whenText(c) : "ご希望の日時を確認しています";
  let body = `<table class="t"><tbody>`;
  if (c) body += `<tr><th scope="row">日時</th><td>${S.whenText(c)}</td></tr><tr><th scope="row">料金</th><td>${yen(PRICE[c.h])}（税込）${r.status === "paid" ? "　お振込み済み" : r.status === "confirmed" ? "　お振込みをお待ちしています" : ""}</td></tr>`;
  else body += r.choices.map((x, i) => `<tr><th scope="row">第${i + 1}希望</th><td>${S.whenText(x)}　${yen(PRICE[x.h])}</td></tr>`).join("");
  if (r.change) body += r.change.choices.map((x, i) => `<tr><th scope="row">変更の希望${r.change.choices.length > 1 ? i + 1 : ""}</th><td>${S.whenText(x)}　${yen(PRICE[x.h])}</td></tr>`).join("");
  body += `<tr><th scope="row">目的・人数</th><td>${esc(r.purpose)}・${r.people}名</td></tr>`;
  if (r.status === "declined") body += `<tr><th scope="row">お断りの理由</th><td>${esc(r.reason || "")}</td></tr>`;
  body += `</tbody></table>`;
  if (held) body += `<div class="addcal">${addCalHtml("結び家SUI レンタル", c.day, toMin(c.start), toMin(c.start) + c.h * 60, r.no)}</div>`;
  const calNote = held ? "塗りつぶしがご予約の日、点線は変更のご希望です。" : r.status === "pending" ? "点線の日がご希望の日です。確定すると塗りつぶしに変わります。" : "";

  let actions = "";
  const fee = c && held ? (c.day <= 7 ? PRICE[c.h] : 0) : 0;
  if (cur.mode === "rechoose" || cur.mode === "change") {
    actions = `<h3 class="sm">${cur.mode === "change" ? "変更したい日時を選ぶ（3つまで）" : "希望の日時を選び直す"}</h3>
      ${cur.mode === "change" ? '<p class="note">変更の希望を送っても、確定するまでは、いまのご予約がそのまま残ります。</p>' : ""}
      <div class="rec-picker"></div>
      <p class="err hidden" id="x-err"></p>
      <div class="actions"><button class="btn" type="button" data-act="back">やめる</button><button class="btn primary" type="button" data-act="${cur.mode}-send">${cur.mode === "change" ? "変更を申し込む" : "この希望で送り直す"}</button></div>`;
  } else if (cur.mode === "cancel") {
    actions = `<div class="panel" style="margin-top:var(--s-4);background:var(--c-bg)"><p style="margin:0 0 var(--s-2)">${held ? (fee ? `ご利用日の7日前を過ぎているので、キャンセル料は料金の全額（${yen(fee)}）です。` : "いまならキャンセル料はかかりません。") : "まだ確定していないお申込みなので、キャンセル料はかかりません。"}</p>
      <div class="actions" style="margin-top:0"><button class="btn" type="button" data-act="back">やめる</button><button class="btn primary" type="button" data-act="cancel-send">${held ? "キャンセルする" : "お申込みを取り消す"}</button></div></div>`;
  } else if (r.status === "pending") {
    actions = `<div class="actions"><button class="btn" type="button" data-act="rechoose">希望の日時を変える</button><button class="btn" type="button" data-act="cancel">お申込みを取り消す</button></div>`;
  } else if (held) {
    actions = `<div class="actions">${r.change ? '<button class="btn" type="button" data-act="withdraw">変更の希望を取り下げる</button>' : '<button class="btn" type="button" data-act="change">日時の変更を申し込む</button>'}<button class="btn" type="button" data-act="cancel">キャンセルする</button></div>`;
  }
  return resultShell(head, title, body, calNote, actions);
}

function lessonResult(b) {
  const s = S.slot(b.slot);
  const ok = b.status === "confirmed";
  const head = `<span class="chip lesson">ピラティス</span><span class="chip ${ok ? "paid" : "cancelled"}">${ok ? "確定" : "キャンセル"}</span><span class="note">予約番号 ${b.no}</span>`;
  const title = s ? `${s.name}　${jd(s.day)} ${span(s.start, s.min)}` : "";
  let body = `<table class="t"><tbody><tr><th scope="row">レッスン</th><td>${s ? s.name : ""}</td></tr><tr><th scope="row">日時</th><td>${s ? `${jd(s.day)} ${span(s.start, s.min)}` : ""}</td></tr><tr><th scope="row">料金</th><td>${s ? S.lessonPriceText(s, b.trial) : ""}</td></tr></tbody></table>`;
  if (ok && s) body += `<div class="addcal">${addCalHtml(`結び家SUI ${s.name}`, s.day, toMin(s.start), toMin(s.start) + s.min, b.no)}</div>`;
  let actions = "";
  if (cur.mode === "move") {
    actions = `<h3 class="sm">変更したい回を選ぶ</h3><p class="note">空きのある回なら、その場で変更が確定します。</p><div class="rec-picker"></div><div class="actions"><button class="btn" type="button" data-act="back">やめる</button></div>`;
  } else if (cur.mode === "cancel") {
    actions = `<div class="panel" style="margin-top:var(--s-4);background:var(--c-bg)"><p style="margin:0 0 var(--s-2)">キャンセル料のきまり：○時間前までは無料 <span class="todo">※要確認</span></p>
      <div class="actions" style="margin-top:0"><button class="btn" type="button" data-act="back">やめる</button><button class="btn primary" type="button" data-act="lcancel-send">キャンセルする</button></div></div>`;
  } else if (ok) {
    actions = `<div class="actions"><button class="btn" type="button" data-act="move">別の回に変える</button><button class="btn" type="button" data-act="cancel">キャンセルする</button></div>`;
  }
  return resultShell(head, title, body, "塗りつぶしがご予約の日です。", actions);
}

function moveLesson(b, s) {
  if (!slotState(s).ok) return;
  const before = { ...S.slot(b.slot) };
  b.slot = s.id;
  cur.mail = S.mail("lesson_changed", b, [b, s, before]);
  S.save();
  cur.mode = null;
  cur.msg = `${s.name}　${jd(s.day)} ${span(s.start, s.min)} に変更しました。`;
  renderResult(); renderMine(); lPicker.refresh();
}

$("s-result").addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t || !cur) return;
  const act = t.dataset.act;
  const rec = cur.type === "rental" ? S.req(cur.no) : S.bookOf(cur.no);
  if (["rechoose", "change", "cancel", "move"].includes(act)) { cur.mode = act; cur.msg = ""; cur.mail = null; return renderResult(); }
  if (act === "back") { cur.mode = null; return renderResult(); }
  if (act === "rechoose-send" || act === "change-send") {
    const list = cur.picker.choices;
    const err = $("x-err");
    if (!list.length) { err.textContent = "カレンダーで日時を1つ以上選んでください。"; return err.classList.remove("hidden"); }
    if (act === "rechoose-send") {
      rec.choices = list.map((c) => ({ ...c }));
      cur.mail = S.mail("rental_rechoose", rec, [rec]);
      cur.msg = "ご希望の日時を変えました。確定したらご連絡します。";
    } else {
      rec.change = { recv: Date.now(), choices: list.map((c) => ({ ...c })) };
      cur.mail = S.mail("rental_change_received", rec, [rec]);
      cur.msg = "日時の変更のご希望を送りました。変更できるかを確かめて、ご連絡します。";
    }
    S.owner("change_rental", [rec]);
    S.save(); cur.mode = null;
    renderResult(); renderMine(); rPicker.refresh();
    return;
  }
  if (act === "withdraw") { rec.change = null; S.save(); cur.msg = "変更のご希望を取り下げました。いまのご予約のままです。"; cur.mail = null; renderResult(); renderMine(); return; }
  if (act === "cancel-send") {
    const held = S.isHeld(rec);
    const c = held ? rec.choices[rec.pick] : null;
    const fee = c && c.day <= 7 ? PRICE[c.h] : 0;
    rec.status = "cancelled"; rec.change = null;
    cur.mail = S.mail("rental_cancelled", rec, [rec, fee]);
    S.owner("cancel_rental", [rec]);
    S.save(); cur.mode = null;
    cur.msg = held ? "キャンセルしました。" : "お申込みを取り消しました。";
    renderResult(); renderMine(); rPicker.refresh();
    return;
  }
  if (act === "lcancel-send") {
    const s = S.slot(rec.slot);
    rec.status = "cancelled";
    cur.mail = S.mail("lesson_cancelled", rec, [rec, s]);
    S.owner("cancel_lesson", [rec, s]);
    S.save(); cur.mode = null;
    cur.msg = "キャンセルしました。";
    renderResult(); renderMine(); lPicker.refresh();
  }
});

// ---- ほかのタブ（管理画面など）でデータが変わったら描き直す ------------------------
window.addEventListener("storage", (e) => {
  if (e.key && !e.key.startsWith("sui-mock")) return;
  S.reload();
  rPicker.refresh(); lPicker.refresh(); renderMine();
  if (cur && !cur.mode) renderResult();
});
$("demo-reset").addEventListener("click", () => { S.reset(); location.reload(); });

renderMine();

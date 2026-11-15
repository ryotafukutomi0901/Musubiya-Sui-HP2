// ご予約の3ページ（レンタル・ピラティス・確認）で使う部品。予約のデータは assets/mock-db.js（予約管理と同じもの）。
// どこにも送らない。モックなので、メールも送らず、送る文面を画面に出す。
(function () {
  const S = window.SUI;
  const $ = (id) => document.getElementById(id);
  const { esc, yen, jd, span, toMin, toTime, PRICE } = S;
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const params = new URLSearchParams(location.search);

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
        const cls = `d ${inf.cls || ""}${opt.sel === off ? " sel" : ""}${off === 0 ? " today" : ""}`;
        cells += inf.disabled
          ? `<button type="button" class="${cls}" disabled><span class="n">${dd}</span><span class="m">${inf.mark || ""}</span></button>`
          : `<button type="button" class="${cls}" data-off="${off}" aria-label="${jd(off)} ${esc(inf.label || inf.mark || "")}" aria-pressed="${opt.sel === off}"><span class="n">${dd}</span><span class="m">${inf.mark || ""}</span></button>`;
      }
      const ym = y * 12 + m;
      wrap.innerHTML = `<div class="mcal"><div class="mcal-head"><button type="button" class="btn" data-mv="-1" ${ym <= minYM ? "disabled" : ""}>前の月</button><b>${y}年${m + 1}月</b><button type="button" class="btn" data-mv="1" ${ym >= maxYM ? "disabled" : ""}>次の月</button></div>
        <div class="mcal-grid">${S.WD.map((w) => `<span class="wd">${w}</span>`).join("")}${cells}</div></div>`;
    }
    wrap.addEventListener("click", (e) => {
      const mv = e.target.closest("[data-mv]");
      if (mv) { const t = y * 12 + m + Number(mv.dataset.mv); y = Math.floor(t / 12); m = t % 12; return draw(); }
      const b = e.target.closest("[data-off]");
      if (b) { opt.sel = Number(b.dataset.off); draw(); if (opt.onPick) opt.onPick(opt.sel); }
    });
    draw();
    return { draw, select(off) { opt.sel = off; if (off == null) return draw(); const d = S.dayOf(off); y = d.getFullYear(); m = d.getMonth(); draw(); } };
  }

  // 小さい画面では、日にちを押したら下の時間の欄まで送る
  const followOnPhone = (el) => { if (window.innerWidth < 900 && el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };

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
    wrap.innerHTML = `<div class="pick2"><div><div class="rp-cal"></div><p class="legend"><span>○ 終日空き</span><span>△ 一部空き</span><span>× 空きなし</span><span>斜線 お休み</span><span>締切 3日前を過ぎた日</span></p></div><div class="dayp rp-day" tabindex="-1"></div></div><div class="rp-list"></div>`;
    let choices = initial.map((c) => ({ ...c }));
    let day = null, start = null, hours = null;
    const dayEl = wrap.querySelector(".rp-day");
    const cal = Month(wrap.querySelector(".rp-cal"), { min: 0, max: S.RENTAL_TO, start: S.RENTAL_FROM, info: (off) => rentalInfo(off, exceptNo), onPick: (off) => { day = off; start = null; hours = null; drawDay(); followOnPhone(dayEl); } });
    const total = S.CLOSE - S.OPEN;
    const pos = (a, b) => `left:${((a - S.OPEN) / total) * 100}%;width:${((b - a) / total) * 100}%`;
    function drawDay() {
      if (day == null) { dayEl.innerHTML = `<h4>日にちを選んでください</h4><p class="note" style="margin:0">カレンダーで日にちを押すと、その日の空いている時間がここに出ます。○ と △ の日が選べます。</p>`; return; }
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
      dayEl.innerHTML = `<h4>${jd(day)} の空き</h4>
        <div class="tl"><div class="bar">${segs}${sel}</div><div class="ticks">${ticks}</div></div>
        <p class="note" style="margin:var(--s-2) 0 0">斜線のところは、ほかのご予約やレッスンが入っています。準備と片付けの時間も含めて選んでください。</p>
        <p class="lbl">1. 開始の時刻</p><div class="tchips">${starts}</div>
        ${start != null ? `<p class="lbl">2. ご利用時間（総額・税込）</p><div class="tchips">${hrs}</div>` : ""}
        ${start != null && hours ? `<div class="pick-sum"><span>${span(toTime(start), hours * 60)}（${hours}時間）<b>${yen(PRICE[hours])}</b></span>
          <button type="button" class="btn accent" data-addchoice ${full || dup ? "disabled" : ""}>${max > 1 ? `第${choices.length + 1}希望に入れる` : "この日時にする"}</button></div>
          ${full ? `<p class="note">希望は${max}つまでです。入れ替えるときは、下の一覧から外してください。</p>` : ""}${dup ? '<p class="note">同じ日時がもう入っています。</p>' : ""}` : ""}`;
    }
    function drawList() {
      const el = wrap.querySelector(".rp-list");
      el.innerHTML = choices.length
        ? `<ol class="choices" aria-label="選んだ日時">${choices.map((c, i) => `<li><span class="ttl">${max > 1 ? `第${i + 1}希望` : "変更後"}</span><span>${S.whenText(c)}</span><b>${yen(PRICE[c.h])}</b><button type="button" class="btn sm" data-rm="${i}">外す</button></li>`).join("")}</ol>
           ${max > 1 && choices.length < max ? `<p class="note">ほかの日でもよければ、あと${max - choices.length}つまで希望を足せます。第1希望から順に確かめてお返事します。</p>` : ""}`
        : `<p class="empty">まだ日時が入っていません。${max > 1 ? `希望は${max}つまで入れられます。` : ""}</p>`;
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
      clear() { choices = []; day = null; start = null; hours = null; cal.select(null); drawDay(); drawList(); },
      refresh() { cal.draw(); drawDay(); },
    };
  }

  // ---- ピラティス：時間割 ----------------------------------------------------
  const lessonSlots = (exceptSlot, filter) => S.db.slots.filter((s) => s.kind === "lesson" && s.id !== exceptSlot && s.day >= 0 && s.day <= S.LESSON_TO && (!filter || filter(s)));
  function slotState(s) {
    const left = s.cap - S.booked(s.id);
    if (s.day === 0 && toMin(s.start) - nowMin() < 180) return { left, ok: false, text: "締め切りました" };
    return { left, ok: left > 0, text: left > 0 ? `あと${left}名` : "満席" };
  }
  function lessonInfo(off, exceptSlot, filter) {
    const list = lessonSlots(exceptSlot, filter).filter((s) => s.day === off);
    if (!list.length) return { disabled: true };
    const open = list.filter((s) => slotState(s).ok).length;
    return open ? { cls: "free", mark: `${open}回`, label: `予約できる回が${open}つあります` } : { cls: "full", mark: "満席", label: "満席です" };
  }
  const lessonPrice = (s, trial) => { const p = S.LESSON_PRICE[s.name]; if (!p) return "○円"; return trial ? `${yen(p[1])}（初回体験）` : yen(p[0]); };
  function LessonPicker(root, { exceptSlot, onPick, btn = "この回にする", filter, trial }) {
    const wrap = document.createElement("div");
    root.replaceChildren(wrap);
    wrap.innerHTML = `<div class="pick2"><div><div class="lp-cal"></div><p class="legend"><span>数字 その日に予約できる回の数</span><span>満席 その日の回はすべて埋まっています</span></p></div><div class="dayp lp-day" tabindex="-1"></div></div>`;
    // filter は「いまの絞り込み（回を受け取って true/false を返す関数）か null」を返す関数
    const getFilter = () => (typeof filter === "function" ? filter() : null);
    const firstOpenDay = () => { const s = lessonSlots(exceptSlot, getFilter()).find((x) => slotState(x).ok); return s ? s.day : null; };
    let day = firstOpenDay();
    const dayEl = wrap.querySelector(".lp-day");
    const cal = Month(wrap.querySelector(".lp-cal"), { min: 0, max: S.LESSON_TO, start: day ?? 0, sel: day, info: (off) => lessonInfo(off, exceptSlot, getFilter()), onPick: (off) => { day = off; drawDay(); followOnPhone(dayEl); } });
    function drawDay() {
      if (day == null) { dayEl.innerHTML = `<h4>いま予約できる回がありません</h4><p class="note" style="margin:0">条件を変えるか、公式LINEでお問い合わせください。</p>`; return; }
      const list = lessonSlots(exceptSlot, getFilter()).filter((s) => s.day === day).sort((a, b) => toMin(a.start) - toMin(b.start));
      if (!list.length) { dayEl.innerHTML = `<h4>${jd(day)}</h4><p class="note" style="margin:0">この条件の回はありません。カレンダーで数字のある日を選んでください。</p>`; return; }
      const t = typeof trial === "function" ? trial() : !!trial;
      dayEl.innerHTML = `<h4>${jd(day)} のレッスン</h4><ul class="slots">${list.map((s) => {
        const st = slotState(s);
        return `<li><div><span class="chip lesson">${s.name}</span> <span class="when">${span(s.start, s.min)}</span><br><span class="note">${lessonPrice(s, t)}${s.name === "パーソナル" ? ' <span class="todo">※3,500円か3,000円か確認中</span>' : ""}</span></div>
          <span class="left${st.ok && st.left <= 2 ? " few" : ""}">${st.text}</span><button class="btn sm${st.ok ? " primary" : ""}" type="button" data-slot="${s.id}" ${st.ok ? "" : "disabled"}>${st.ok ? btn : st.text}</button></li>`;
      }).join("")}</ul>`;
    }
    wrap.addEventListener("click", (e) => { const b = e.target.closest("[data-slot]"); if (b) onPick(S.slot(b.dataset.slot)); });
    drawDay();
    return {
      refresh() { cal.draw(); drawDay(); },
      // 絞り込みを変えたとき：その日に回がなければ、条件に合う最初の日へ移る
      reset() { if (day == null || !lessonSlots(exceptSlot, getFilter()).some((s) => s.day === day)) { day = firstOpenDay(); cal.select(day); } else cal.draw(); drawDay(); },
    };
  }

  // ---- 共通の表示 ------------------------------------------------------------
  const mailHtml = (m, open = false) => m ? `<details class="mailbox"${open ? " open" : ""}><summary>お送りしたメール（見本）：${esc(m.subject)}</summary><pre>${esc(m.body)}</pre></details>` : "";
  function addCalHtml(title, day, s, e, uid) {
    return `<a href="${S.gcal(title, day, s, e)}" target="_blank" rel="noopener">Googleカレンダーに入れる</a><button type="button" class="linkbtn" data-ics="${esc(JSON.stringify({ title, day, s, e, uid }))}">iPhone・Outlook のカレンダーに入れる（.ics）</button>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ics]");
    if (!b) return;
    const ev = JSON.parse(b.dataset.ics);
    S.download("musubiya-sui.ics", S.ics([{ ...ev, desc: "結び家SUI（モック）" }]));
  });

  // 手順の帯
  function setWizard(el, n) { [...el.children].forEach((li, k) => { li.classList.toggle("on", k === n - 1); li.classList.toggle("done", k < n - 1); li.setAttribute("aria-current", k === n - 1 ? "step" : "false"); }); }
  // 入力欄の確かめ（空なら aria-invalid を付けて、最初の欄へ）
  function requireFields(list) {
    const missing = [];
    list.forEach(([id, label]) => { const el = $(id); const bad = !String(el.value || "").trim(); el.setAttribute("aria-invalid", bad); if (bad) missing.push([el, label]); });
    if (missing.length) missing[0][0].focus();
    return missing.map((x) => x[1]);
  }

  window.BK = { S, $, esc, yen, jd, span, toMin, toTime, PRICE, params, Month, RentalPicker, LessonPicker, rentalInfo, slotState, lessonPrice, mailHtml, addCalHtml, setWizard, requireFields };
})();

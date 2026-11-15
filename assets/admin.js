// 予約管理画面（/admin）のモック（2案目）。レンタルスペースとピラティスで、画面とカレンダーを分ける。
// 予約のデータは assets/mock-db.js（お客様の画面と同じもの）を読み書きする。どこにも送らない。
// 本番では、ログイン（2段階認証）、保存、お客様への連絡、二重予約の確認をサーバー側で行う。

const S = window.SUI;
const { PRICE, md, jd, toMin, toTime, span, yen, esc, STATUS } = S;
const $ = (id) => document.getElementById(id);
const fmtAt = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
const hoursAgo = (r) => Math.max(0, Math.floor((Date.now() - r.recv) / 3600e3));
const D = () => S.db;
const todo = (s) => `<span style="color:var(--c-danger)">${s}</span>`;
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

// サイトの「お知らせ」と Instagram は予約と関係ないので、この画面の中だけの表示例
let NEWS = [
  { id: 1, date: "11/10", title: "12月の営業日のお知らせ", status: "公開" },
  { id: 2, date: "11/02", title: "季節の手しごとワークショップの参加者を募集します", status: "公開" },
  { id: 3, date: "—", title: "年末年始のお休みについて", status: "下書き" },
];
const IG = [
  { id: "ig1", cap: "朝の縁側。今日は午前のピラティスから", show: true },
  { id: "ig2", cap: "障子を張り替えました", show: true },
  { id: "ig3", cap: "書道教室のみなさん（ご利用の様子）", show: true },
  { id: "ig4", cap: "ワークショップの準備中", show: true },
  { id: "ig5", cap: "冬の空き状況のお知らせ", show: true },
  { id: "ig6", cap: "庭の紅葉", show: true },
];

// ---- 共通 ----------------------------------------------------------------
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add("hidden"), 3600);
}
const chip = (status) => `<span class="chip ${status}">${STATUS[status]}</span>`;
const changeChip = (r) => (r.change ? '<span class="chip pending">変更の希望</span>' : "");
function waitNote(r) {
  if (r.status !== "pending") return "";
  const h = hoursAgo(r);
  if (h >= 24) return `<span class="chip declined">24時間を過ぎています</span>`;
  if (h >= 18) return `<span class="chip pending">あと${24 - h}時間で24時間</span>`;
  return `<span class="note">${h}時間前</span>`;
}
const choiceText = (c) => `${md(c.day)} ${span(c.start, c.h * 60)}（${c.h}時間）`;
const rentalTodo = () => D().req.filter((r) => r.status === "pending" || r.change).length;
const lessonSlots = () => D().slots.filter((s) => s.kind === "lesson" || s.kind === "event");
const todaysLessons = () => lessonSlots().filter((s) => s.day === 0).sort((a, b) => toMin(a.start) - toMin(b.start));
function updateBadges() {
  $("nav-rental").textContent = rentalTodo() || "";
  const n = todaysLessons().length;
  $("nav-pilates").textContent = n ? `今日${n}` : "";
}
const who = (s) => D().book.filter((b) => b.slot === s.id && b.status === "confirmed");
const kindName = { lesson: "レッスン", event: "イベント", rental: "レンタル" };

// ---- カレンダー（月と週）。レンタルとピラティスで、出すものを変えて使う --------------------
// items: { day, s, e, kind, label, no?, id?, pending?, muted?, full? }
// 月の表はその月の1日から、週の表は日曜から始める（今日から始めない）。mon は今月から何か月ずらしたか
const sundayOf = (off) => off - S.dayOf(off).getDay();
const cal = { rental: { mode: "month", week: sundayOf(0), mon: 0, sel: 0 }, pilates: { mode: "month", week: sundayOf(0), mon: 0, sel: 0 } };
const monthOf = (st) => { const t = S.dayOf(0); const f = new Date(t.getFullYear(), t.getMonth() + st.mon, 1); return { y: f.getFullYear(), m: f.getMonth() }; };
function rentalItems() {
  const items = [];
  S.busy().forEach((b) => {
    if (b.kind === "rental") items.push({ ...b, label: b.label.replace(/^レンタル /, "") });
    else if (b.kind !== "closed") items.push({ ...b, kind: "blocked", muted: true, label: b.kind === "lesson" ? "レッスン（貸せない時間）" : "イベント（貸せない時間）" });
  });
  D().req.filter((r) => r.status === "pending").forEach((r) => r.choices.forEach((c, i) => items.push({ day: c.day, s: toMin(c.start), e: toMin(c.start) + c.h * 60, kind: "rental", pending: true, label: `第${i + 1}希望 ${r.name} 様`, no: r.no })));
  D().req.filter((r) => r.change).forEach((r) => r.change.choices.forEach((c) => items.push({ day: c.day, s: toMin(c.start), e: toMin(c.start) + c.h * 60, kind: "rental", pending: true, label: `変更の希望 ${r.name} 様`, no: r.no })));
  return items;
}
// 人数を先に出す（月の表では、名前が切れても人数が見えるように）
function pilatesItems() {
  const items = lessonSlots().map((s) => { const n = S.booked(s.id); return { day: s.day, s: toMin(s.start), e: toMin(s.start) + s.min, kind: s.kind, id: s.id, full: n >= s.cap, label: `${n}/${s.cap}名 ${s.name}` }; });
  S.busy().filter((b) => b.kind === "rental").forEach((b) => items.push({ ...b, kind: "blocked", muted: true, no: null, label: "レンタル（使えない時間）" }));
  return items;
}
function calendarView(key) {
  const st = cal[key];
  const items = key === "rental" ? rentalItems() : pilatesItems();
  const legend = key === "rental"
    ? `<span><span class="lg rental"></span>確定・入金待ち</span><span><span class="lg rental pending"></span>承認待ち・変更の希望</span><span><span class="lg blocked"></span>レッスン・イベント（貸せない時間）</span><span><span class="lg off"></span>休業日</span>`
    : `<span><span class="lg lesson"></span>レッスン</span><span><span class="lg event"></span>イベント</span><span><span class="lg full"></span>満席</span><span><span class="lg blocked"></span>レンタル（使えない時間）</span><span><span class="lg off"></span>休業日</span>`;
  const head = `
    <div class="row" style="margin-bottom:12px">
      <div class="seg"><button class="btn ${st.mode === "month" ? "primary" : ""}" data-calmode="${key}:month">月</button><button class="btn ${st.mode === "week" ? "primary" : ""}" data-calmode="${key}:week">週</button></div>
      ${st.mode === "week"
        ? `<button class="btn" data-week="${key}:-7">前の週</button><button class="btn" data-week="${key}:0">今週</button><button class="btn" data-week="${key}:7">次の週</button><b class="cal-ttl">${md(st.week)}〜${md(st.week + 6)}</b>`
        : `<button class="btn" data-mon="${key}:-1">前の月</button><button class="btn" data-mon="${key}:0">今月</button><button class="btn" data-mon="${key}:1">次の月</button><b class="cal-ttl">${monthOf(st).y}年${monthOf(st).m + 1}月</b>`}
      <button class="btn" data-ics="${key}" style="margin-left:auto">カレンダーアプリに書き出す（.ics）</button>
    </div>
    <div class="legend">${legend}</div>`;
  const grid = st.mode === "month" ? monthGrid(key, items) : weekGrid(key, items);
  return head + `<div class="calwrap"><div class="calmain">${grid}<p class="note">日にちを押すと、その日の予定が${st.mode === "month" ? "右" : "下"}に出ます。予定を押すと、${key === "rental" ? "申込みの内容" : "予約した方の一覧と定員"}が開きます。</p></div>${dayPanel(key, items)}</div>`;
}
function monthGrid(key, items) {
  const st = cal[key];
  const { y, m } = monthOf(st);
  const first = S.offOf(y, m, 1);
  const count = new Date(y, m + 1, 0).getDate();
  const lead = S.dayOf(first).getDay();
  const start = first - lead;
  const weeks = Math.ceil((lead + count) / 7);
  const cells = [...Array(weeks * 7)].map((_, i) => start + i).map((d) => {
    const out = d < first || d >= first + count;
    const closed = D().closed.find((c) => c.day === d);
    const list = items.filter((b) => b.day === d && b.kind !== "closed").sort((a, b) => a.s - b.s);
    const dt = S.dayOf(d);
    const main = list.filter((b) => !b.muted), muted = list.filter((b) => b.muted);
    const pend = main.filter((b) => b.pending).length;
    const wd = dt.getDay();
    return `<div class="mday${out ? " out" : ""}${d < 0 ? " past" : ""}${d === 0 ? " today" : ""}${closed ? " off" : ""}${st.sel === d ? " sel" : ""}${wd === 0 ? " sun" : wd === 6 ? " sat" : ""}" data-day="${key}:${d}" role="button" tabindex="0" aria-label="${md(d)} の予定を見る" aria-pressed="${st.sel === d}">
      <span class="dhead"><span class="dn">${out ? `${dt.getMonth() + 1}/` : ""}${dt.getDate()}</span>${pend ? `<span class="pend" title="承認待ち・変更の希望">${pend}</span>` : ""}</span>
      ${closed ? `<span class="mi offl">休業日</span>` : ""}
      ${main.slice(0, 3).map((b) => `<span class="mi ${b.kind}${b.pending ? " pending" : ""}${b.full ? " full" : ""}" ${b.no ? `data-open="${b.no}"` : b.id ? `data-slot="${b.id}"` : ""} role="button" tabindex="0"><b>${toTime(b.s)}</b> ${esc(b.label.replace(/ 様$/, ""))}</span>`).join("")}
      ${main.length > 3 ? `<span class="mi more">＋${main.length - 3}件</span>` : ""}
      ${muted.length ? `<span class="mi muted">${kindName[key === "rental" ? "lesson" : "rental"]} ${muted.length}件</span>` : ""}</div>`;
  }).join("");
  return `<div class="tbl" style="border:0"><div class="mgrid">${S.WD.map((w, i) => `<div class="h${i === 0 ? " sun" : i === 6 ? " sat" : ""}">${w}</div>`).join("")}${cells}</div></div>`;
}
const dur = (min) => `${Math.floor(min / 60) ? `${Math.floor(min / 60)}時間` : ""}${min % 60 ? `${min % 60}分` : ""}`;
// 選んだ日の予定（月の表の右、週の表の下）
function dayPanel(key, items) {
  const d = cal[key].sel;
  const closed = D().closed.find((c) => c.day === d);
  const list = items.filter((b) => b.day === d && b.kind !== "closed").sort((a, b) => a.s - b.s || (a.pending ? 1 : -1));
  const OPEN = S.OPEN, CLOSE = S.CLOSE, total = CLOSE - OPEN;
  const pos = (a, b) => `left:${((Math.max(a, OPEN) - OPEN) / total) * 100}%;width:${((Math.min(b, CLOSE) - Math.max(a, OPEN)) / total) * 100}%`;
  const solid = list.filter((b) => !b.pending);
  const segs = solid.map((b) => `<span class="seg ${b.kind}${b.full ? " full" : ""}" style="${pos(b.s, b.e)}" title="${toTime(b.s)}〜${toTime(b.e)} ${esc(b.label)}"></span>`).join("")
    + list.filter((b) => b.pending).map((b) => `<span class="seg pending" style="${pos(b.s, b.e)}" title="${esc(b.label)}"></span>`).join("");
  // 空いている時間（確定した予約・レッスン・イベントを除いた残り）
  const busy = solid.map((b) => [Math.max(b.s, OPEN), Math.min(b.e, CLOSE)]).filter(([a, b]) => a < b).sort((a, b) => a[0] - b[0]);
  const free = []; let cur = OPEN;
  busy.forEach(([a, b]) => { if (a > cur) free.push([cur, a]); cur = Math.max(cur, b); });
  if (cur < CLOSE) free.push([cur, CLOSE]);
  const freeText = closed ? "休業日です" : free.length ? free.map(([a, b]) => `${toTime(a)}〜${toTime(b)}（${dur(b - a)}）`).join("、") : "空きはありません";
  const row = (b) => {
    if (b.muted) return `<li class="ag muted"><span class="t">${toTime(b.s)}〜${toTime(b.e)}</span><span class="w">${esc(b.label)}</span></li>`;
    if (b.no) {
      const r = S.req(b.no);
      const c = b.pending ? r.choices.find((x) => toMin(x.start) === b.s) || r.choices[0] : r.choices[r.pick];
      return `<li class="ag ${b.pending ? "pending" : "rental"}" data-open="${b.no}" role="button" tabindex="0"><span class="t">${toTime(b.s)}〜${toTime(b.e)}</span>
        <span class="w"><b>${esc(r.name)} 様</b> ${b.pending ? `<span class="chip pending">${esc(b.label.split(" ")[0])}</span>` : chip(r.status)}<br><span class="note">${esc(r.purpose)}・${r.people}名・${yen(PRICE[c.h])}${b.pending ? `・${hoursAgo(r)}時間前に受付` : ""}</span></span></li>`;
    }
    const s = S.slot(b.id);
    const n = S.booked(s.id);
    const ppl = who(s);
    return `<li class="ag ${s.kind}${n >= s.cap ? " full" : ""}" data-slot="${s.id}" role="button" tabindex="0"><span class="t">${span(s.start, s.min)}</span>
      <span class="w"><b>${esc(s.name)}</b> ${n >= s.cap ? '<span class="chip declined">満席</span>' : `<span class="note">あと${s.cap - n}名</span>`}
        <span class="seatbar"><span style="width:${Math.min(100, (n / s.cap) * 100)}%"></span></span>
        <span class="note">${n}/${s.cap}名${ppl.length ? `：${ppl.map((p) => `${esc(p.name)}${p.trial ? "（初回）" : ""}`).join("、")}` : ""}</span></span></li>`;
  };
  return `<aside class="dayp" aria-label="${md(d)} の予定">
    <div class="dayp-head">
      <button class="btn icon" type="button" data-dayshift="${key}:-1" aria-label="前の日">‹</button>
      <h2>${jd(d)}${d === 0 ? '<span class="today-tag">今日</span>' : ""}</h2>
      <button class="btn icon" type="button" data-dayshift="${key}:1" aria-label="次の日">›</button>
    </div>
    ${closed ? `<p class="closed-note">休業日（${esc(closed.reason)}）</p>` : ""}
    <div class="tl"><div class="bar">${segs}</div><div class="ticks">${[9, 12, 15, 18, 21].map((h) => `<span style="left:${((h * 60 - OPEN) / total) * 100}%">${h}</span>`).join("")}</div></div>
    ${key === "rental" ? `<p class="freet"><b>空いている時間</b>${freeText}</p>` : ""}
    ${list.length ? `<ul class="agenda">${list.map(row).join("")}</ul>` : `<p class="note" style="margin:12px 0">${closed ? "" : "この日の予定はありません。"}</p>`}
    <div class="row" style="margin-top:12px">
      ${cal[key].mode === "month" ? `<button class="btn" type="button" data-gotoweek="${key}:${d}">この週を時間ごとに見る</button>` : ""}
      ${key === "pilates" && d >= 0 && d < 42 && !closed ? `<button class="btn" type="button" data-addon="${d}">この日に回を足す</button>` : ""}
    </div>
  </aside>`;
}
function weekGrid(key, items) {
  const st = cal[key];
  const days = [...Array(7)].map((_, i) => st.week + i);
  const px = (min) => ((Math.min(Math.max(min, 540), 1260) - 540) / 60) * 52;
  const col = (d) => {
    const closed = D().closed.find((c) => c.day === d);
    const evs = items.filter((b) => b.day === d && b.kind !== "closed").map((b) => {
      const style = `top:${px(b.s)}px;height:${Math.max(px(b.e) - px(b.s), 18)}px;${b.pending ? "left:42%;" : ""}`;
      const attr = b.no && !b.muted ? `data-open="${b.no}" role="button" tabindex="0"` : b.id && !b.muted ? `data-slot="${b.id}" role="button" tabindex="0"` : "";
      return `<div class="ev ${b.kind}${b.pending ? " pending" : ""}${b.full ? " full" : ""}" style="${style}" ${attr}><b>${toTime(b.s)}</b> ${esc(b.label)}</div>`;
    }).join("");
    return `<div class="col${closed ? " off" : ""}">${closed ? `<div class="ev" style="top:8px;height:auto;border-color:var(--c-ink-muted)">休業日<br>${esc(closed.reason)}</div>` : ""}${evs}</div>`;
  };
  return `<div class="tbl" style="border:0"><div class="cal">
      <div class="h"></div>${days.map((d) => `<div class="h${d === 0 ? " today" : ""}${st.sel === d ? " sel" : ""}" data-day="${key}:${d}" role="button" tabindex="0">${md(d)}</div>`).join("")}
      <div class="times">${[...Array(13)].map((_, i) => `<span style="top:${i * 52}px">${9 + i}:00</span>`).join("")}</div>
      ${days.map(col).join("")}
    </div></div>`;
}

// ---- 画面 ----------------------------------------------------------------
const VIEWS = {};

VIEWS.dashboard = () => {
  const pending = D().req.filter((r) => r.status === "pending").sort((a, b) => a.recv - b.recv);
  const changes = D().req.filter((r) => r.change);
  const unpaid = D().req.filter((r) => r.status === "confirmed");
  const todayRentals = S.busy().filter((b) => b.day === 0 && b.kind === "rental").sort((a, b) => a.s - b.s);
  const lessons = todaysLessons();
  const week = lessonSlots().filter((s) => s.kind === "lesson" && s.day >= 0 && s.day < 7);
  const seats = week.reduce((n, s) => n + s.cap, 0), taken = week.reduce((n, s) => n + S.booked(s.id), 0);
  const trials = week.reduce((n, s) => n + who(s).filter((b) => b.trial).length, 0);
  return `
    <h1>ホーム</h1>
    <p class="note" style="margin-top:-12px">${jd(0)}。左がレンタルスペース、右がピラティスです。</p>
    <div class="dash2">
      <section class="dash rental" aria-labelledby="dh-rental">
        <h2 id="dh-rental"><span class="chip rental">レンタルスペース</span></h2>
        <div class="cards three">
          <a class="card ${pending.length ? "warn" : ""}" href="#rental-req" data-rf-link="pending"><p class="k">承認待ち</p><p class="v">${pending.length}<small>件</small></p><p class="s">${pending[0] ? `古いもので${hoursAgo(pending[0])}時間前` : "ありません"}</p></a>
          <a class="card ${changes.length ? "warn" : ""}" href="#rental-req" data-rf-link="change"><p class="k">日時の変更の希望</p><p class="v">${changes.length}<small>件</small></p><p class="s">確定済みの予約</p></a>
          <a class="card" href="#rental-req" data-rf-link="confirmed"><p class="k">入金待ち</p><p class="v">${unpaid.length}<small>件</small></p><p class="s">承認済み・お振込み前</p></a>
        </div>
        <h3>承認待ち（古い順）</h3>
        ${pending.length ? `<ul class="list">${pending.map((r) => `<li class="click" data-open="${r.no}" tabindex="0"><span class="time">${choiceText(r.choices[0]).split(" ")[0]}</span><span>${esc(r.name)} 様・${esc(r.purpose)}</span><span style="margin-left:auto">${waitNote(r)}</span></li>`).join("")}</ul>` : `<p class="note">承認待ちの申込みはありません。</p>`}
        <h3>今日の貸切</h3>
        <ul class="list">${todayRentals.length ? todayRentals.map((b) => `<li class="click" data-open="${b.no}" tabindex="0"><span class="time">${toTime(b.s)}〜${toTime(b.e)}</span><span>${esc(b.label.replace(/^レンタル /, ""))}</span></li>`).join("") : "<li>今日の貸切はありません</li>"}</ul>
        <p class="more"><a href="#rental-cal">カレンダーで見る</a></p>
      </section>
      <section class="dash lesson" aria-labelledby="dh-lesson">
        <h2 id="dh-lesson"><span class="chip lesson">ピラティス</span></h2>
        <div class="cards three">
          <a class="card" href="#pilates-cal"><p class="k">今日のレッスン</p><p class="v">${lessons.length}<small>回</small></p><p class="s">${lessons.reduce((n, s) => n + S.booked(s.id), 0)}名の予約</p></a>
          <a class="card" href="#pilates-slots"><p class="k">この7日間の埋まり具合</p><p class="v">${seats ? Math.round((taken / seats) * 100) : 0}<small>%</small></p><p class="s">${taken}/${seats}席</p></a>
          <a class="card" href="#pilates-book"><p class="k">この7日間の体験の方</p><p class="v">${trials}<small>名</small></p><p class="s">回数券の案内のきっかけに</p></a>
        </div>
        <h3>今日のレッスン</h3>
        <ul class="list">${lessons.length ? lessons.map((s) => { const n = S.booked(s.id); return `<li class="click" data-slot="${s.id}" tabindex="0"><span class="time">${span(s.start, s.min)}</span><span>${esc(s.name)}</span><span style="margin-left:auto">${n}/${s.cap}名${n >= s.cap ? '　<span class="chip declined">満席</span>' : ""}</span></li>`; }).join("") : "<li>今日のレッスンはありません</li>"}</ul>
        <p class="more"><a href="#pilates-cal">カレンダーで見る</a></p>
      </section>
    </div>

    <h2>届かなかった連絡</h2>
    ${D().failed.length ? `<div class="tbl"><table class="t"><thead><tr><th>いつ</th><th>宛先</th><th>内容</th><th>理由</th><th></th></tr></thead><tbody>
      ${D().failed.map((f) => `<tr><td>${fmtAt(f.at)}</td><td>${esc(f.to)} 様（${f.how}）</td><td>${f.what}</td><td>${f.why}</td><td><div class="row"><button class="btn" data-resend="${f.id}">送り直す</button><button class="btn" data-phoned="${f.id}">電話で伝えた</button></div></td></tr>`).join("")}
    </tbody></table></div>` : `<p class="note">届かなかった連絡はありません。</p>`}`;
};

VIEWS["rental-cal"] = () => `<h1><span class="chip rental">レンタルスペース</span> カレンダー</h1>${calendarView("rental")}`;
VIEWS["pilates-cal"] = () => `<h1><span class="chip lesson">ピラティス</span> カレンダー</h1>${calendarView("pilates")}`;

let reqFilter = "pending";
const inFilter = (r, k) => k === "all" || r.status === k || (k === "closed" && (r.status === "declined" || r.status === "cancelled")) || (k === "change" && !!r.change);
VIEWS["rental-req"] = () => {
  const tabs = [["pending", "承認待ち"], ["change", "変更の希望"], ["confirmed", "入金待ち"], ["paid", "入金済み"], ["closed", "お断り・キャンセル"], ["all", "すべて"]];
  const rows = D().req.filter((r) => inFilter(r, reqFilter)).sort((a, b) => b.recv - a.recv);
  return `
    <h1><span class="chip rental">レンタルスペース</span> 申込み</h1>
    <div class="row" style="margin-bottom:16px">${tabs.map(([k, l]) => `<button class="btn ${reqFilter === k ? "primary" : ""}" data-rf="${k}">${l}（${D().req.filter((r) => inFilter(r, k)).length}）</button>`).join("")}</div>
    ${rows.length ? `<div class="tbl"><table class="t"><thead><tr><th>受付番号</th><th>受付日時</th><th>お名前</th><th>目的・人数</th><th>日時</th><th>金額</th><th>状態</th></tr></thead><tbody>
      ${rows.map((r) => { const fixed = S.isHeld(r) || (r.status === "cancelled" && r.pick != null); const c = r.choices[fixed ? r.pick : 0]; return `<tr class="click" data-open="${r.no}" tabindex="0"><td>${r.no}</td><td>${fmtAt(r.recv)}</td><td>${esc(r.name)} 様</td><td>${esc(r.purpose)}・${r.people}名</td><td>${fixed ? "" : "第1希望 "}${choiceText(c)}${r.choices.length > 1 && r.status === "pending" ? `<br><span class="note">ほか${r.choices.length - 1}件の希望</span>` : ""}</td><td class="num">${yen(PRICE[c.h])}</td><td>${chip(r.status)} ${changeChip(r)} ${waitNote(r)}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<p class="note">この状態の申込みはありません。</p>`}
    <p class="note">行を押すと詳しい内容が右に開きます。承認すると、お客様に確定のお知らせとお振込みのご案内が自動で届きます。日にちで見たいときは <a href="#rental-cal">カレンダー</a>。</p>`;
};

let bookFilter = "all";
let movingNo = null;
const openSlotsFor = (b) => D().slots.filter((s) => s.kind === b.s.kind && s.id !== b.slot && s.day >= 0 && S.booked(s.id) < s.cap).sort((x, y) => x.day - y.day || toMin(x.start) - toMin(y.start));
const moveRow = (b) => `<div class="row"><select id="mv-to" style="width:auto">${openSlotsFor(b).map((s) => `<option value="${s.id}">${md(s.day)} ${s.start} ${esc(s.name)}（あと${s.cap - S.booked(s.id)}）</option>`).join("")}</select><button class="btn primary" data-mvgo="${b.no}">移す</button><button class="btn" data-mvstop>やめる</button></div>`;
VIEWS["pilates-book"] = () => {
  const rows = D().book.map((b) => ({ ...b, s: S.slot(b.slot) })).filter((b) => b.s && b.s.day >= 0 && (bookFilter === "all" || b.s.kind === bookFilter || (bookFilter === "trial" && b.trial))).sort((a, b) => a.s.day - b.s.day || toMin(a.s.start) - toMin(b.s.start));
  return `
    <h1><span class="chip lesson">ピラティス</span> 予約した方</h1>
    <p class="note">レッスンとイベントは、空きがあればその場で予約が確定します。承認はいりません。お客様はご予約のページから、別の回への変更とキャンセルができます。</p>
    <div class="row" style="margin-bottom:16px">${[["all", "すべて"], ["lesson", "レッスン"], ["trial", "体験の方"], ["event", "イベント"]].map(([k, l]) => `<button class="btn ${bookFilter === k ? "primary" : ""}" data-bf="${k}">${l}</button>`).join("")}</div>
    <div class="tbl"><table class="t"><thead><tr><th>日時</th><th>内容</th><th>お名前</th><th>予約番号</th><th>初回体験</th><th>状態</th><th></th></tr></thead><tbody>
      ${rows.map((b) => `<tr><td class="click" data-slot="${b.slot}" tabindex="0">${md(b.s.day)} ${span(b.s.start, b.s.min)}</td><td><span class="chip ${b.s.kind}">${kindName[b.s.kind]}</span> ${esc(b.s.name)}</td><td>${esc(b.name)} 様</td><td>${b.no}</td><td>${b.trial ? "初回" : ""}</td><td>${b.status === "confirmed" ? '<span class="chip confirmed">確定</span>' : '<span class="chip cancelled">キャンセル</span>'}</td>
        <td>${b.status !== "confirmed" ? "" : movingNo === b.no ? moveRow(b) : `<div class="row"><button class="btn" data-mv="${b.no}">回を変える</button><button class="btn" data-bcancel="${b.no}">キャンセルにする</button></div>`}</td></tr>`).join("")}
    </tbody></table></div>`;
};

let slotRange = 14;
let addDay = null; // カレンダーの「この日に回を足す」から来たときの日
VIEWS["pilates-slots"] = () => {
  setTimeout(() => { if (addDay != null) { const el = $("ns-day"); if (el) el.closest(".panel").scrollIntoView({ block: "center" }); addDay = null; } });
  const list = lessonSlots().filter((s) => s.day >= 0 && s.day < slotRange).sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
  return `
    <h1><span class="chip lesson">ピラティス</span> 回と定員</h1>
    <div class="row" style="margin-bottom:12px"><span class="note">表示：</span>${[[14, "2週間"], [42, "6週間"]].map(([n, l]) => `<button class="btn ${slotRange === n ? "primary" : ""}" data-range="${n}">${l}</button>`).join("")}</div>
    <div class="tbl"><table class="t"><thead><tr><th>日時</th><th>名前</th><th>定員</th><th>予約</th><th>予約した方</th><th></th></tr></thead><tbody>
      ${list.map((s) => { const n = S.booked(s.id); return `<tr><td class="click" data-slot="${s.id}" tabindex="0">${md(s.day)} ${span(s.start, s.min)}</td><td><span class="chip ${s.kind}">${kindName[s.kind]}</span> ${esc(s.name)}</td>
        <td><input type="number" min="${Math.max(n, 1)}" max="30" value="${s.cap}" data-cap="${s.id}" style="width:5em" aria-label="${md(s.day)} ${s.start} の定員">名</td>
        <td>${n}名${n >= s.cap ? '　<span class="chip declined">満席</span>' : ""}</td><td style="white-space:normal;font-size:13px">${who(s).map((b) => `${esc(b.name)}${b.trial ? "（初回）" : ""}`).join("、") || '<span class="note">まだいません</span>'}</td>
        <td><button class="btn danger" data-delslot="${s.id}" ${n ? "disabled title=\"予約が入っている回は消せません\"" : ""}>消す</button></td></tr>`; }).join("")}
    </tbody></table></div>
    <p class="note">定員は、いまの予約の人数より少なくはできません。変えるとすぐ、お客様の画面の「あと○名」に反映します。予約が入っている回は消せません。お客様に連絡して、予約をキャンセルにしてから消します。</p>
    <div class="panel" style="margin-top:16px">
      <p style="margin:0 0 12px;font-weight:700">回を足す</p>
      <div class="grid4">
        <div><label class="f" for="ns-kind">種類</label><select id="ns-kind"><option value="semi">セミパーソナル（60分・定員5名）</option><option value="personal">パーソナル（50分・1名）</option><option value="event">イベント（120分）</option></select></div>
        <div><label class="f" for="ns-day">日付</label><select id="ns-day">${dayOptions(42, addDay ?? 3)}</select></div>
        <div><label class="f" for="ns-start">開始</label><select id="ns-start">${timeOptions(9, 19, "10:00")}</select></div>
        <div><button class="btn primary" id="ns-add" type="button">この回を足す</button></div>
      </div>
      <p class="note hidden" id="ns-err" style="color:var(--c-danger)"></p>
      <p class="note">レンタルの確定した予約や休業日と重なる回は作れません。毎週同じ曜日・時間にまとめて作る機能は、本番で作ります。${todo("※時間割の決め方を確認中")}</p>
    </div>`;
};

const dayOptions = (n, sel) => [...Array(n)].map((_, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${md(i)}</option>`).join("");
const timeOptions = (from, to, sel) => { let o = ""; for (let m = from * 60; m <= to * 60; m += 30) o += `<option ${toTime(m) === sel ? "selected" : ""}>${toTime(m)}</option>`; return o; };

VIEWS.closed = () => `
  <h1>休業日</h1>
  <p class="note">休業日は、レンタルとピラティスの両方のカレンダーで「お休み」になります。予約やレッスンが入っている日は、先にお客様と調整してから休業日にします。</p>
  <div class="panel"><ul class="list">
    ${D().closed.length ? [...D().closed].sort((a, b) => a.day - b.day).map((c) => `<li><span class="time">${md(c.day)}</span><span>${esc(c.reason)}</span><button class="btn" style="margin-left:auto" data-delclosed="${c.day}">取り消す</button></li>`).join("") : "<li>登録された休業日はありません</li>"}
  </ul>
  <div class="grid4" style="margin-top:16px">
    <div><label class="f" for="nc-day">日付</label><select id="nc-day">${dayOptions(60, 14)}</select></div>
    <div style="grid-column: span 2"><label class="f" for="nc-reason">理由（お客様には「お休み」とだけ表示します）</label><input id="nc-reason" value="私用のため"></div>
    <div><button class="btn primary" id="nc-add" type="button">休業日にする</button></div>
  </div>
  <p class="note hidden" id="nc-err" style="color:var(--c-danger)"></p>
  <p class="note">定休日（毎週の休み）があるかどうかは ${todo("※要確認")}</p></div>`;

let openMail = null;
const tomorrowList = () => {
  const list = [];
  D().req.filter((x) => S.isHeld(x) && x.choices[x.pick].day === 1).forEach((x) => list.push({ to: x.name, what: `レンタル ${span(x.choices[x.pick].start, x.choices[x.pick].h * 60)}`, kind: "reminder_rental", args: [x] }));
  D().book.filter((b) => b.status === "confirmed").forEach((b) => { const s = S.slot(b.slot); if (s && s.day === 1) list.push({ to: b.name, what: `${s.name} ${span(s.start, s.min)}`, kind: "reminder_lesson", args: [b, s] }); });
  return list;
};
VIEWS.mails = () => {
  const tomorrow = tomorrowList();
  const sent = [...D().mails].sort((a, b) => b.at - a.at).slice(0, 60);
  const AUTO = [
    ["レンタル", "申込みが届いたとき", "お客様／オーナー様", "メール／LINE", "受付のお知らせ（まだ確定していないこと、受付番号）／新しい申込みのお知らせ"],
    ["レンタル", "承認・お断りしたとき", "お客様", "メール（希望者にはLINEも）", "確定のお知らせと振込先・期限／お断りと理由"],
    ["レンタル", "入金を記録したとき", "お客様", "メール", "入金確認のお知らせ"],
    ["レンタル", "日時の変更の希望が届いたとき・決めたとき", "お客様・オーナー様", "メール・LINE", "受付のお知らせ／変更後の日時、またはいまの予約のままであること"],
    ["ピラティス", "予約・変更・キャンセル", "お客様・オーナー様", "メール・LINE", "確定・変更・キャンセルのお知らせ"],
    ["共通", "キャンセルしたとき", "お客様・オーナー様", "メール・LINE", "キャンセルの受付とキャンセル料"],
    ["共通", "ご利用日の前日 17:00", "お客様", "メール（希望者にはLINE）", "場所・入り方・持ち物のご案内"],
    ["共通", "毎朝 7:00", "オーナー様", "LINE", "今日の貸切とレッスン、承認待ちの数"],
  ];
  return `
    <h1>お客様へのお知らせ</h1>
    <p class="note">予約が入ったとき、確定したとき、変わったときに、自動でお知らせを送ります。モックなので実際には送らず、送る文面をここに残しています。文面の ○ のところ（振込先、住所、入り方、キャンセル料のきまりなど）は ${todo("※要確認")}。</p>
    <h2>自動で送るもの</h2>
    <div class="tbl"><table class="t"><thead><tr><th>種類</th><th>いつ</th><th>だれに</th><th>どうやって</th><th>内容</th></tr></thead><tbody>
      ${AUTO.map((a) => `<tr><td><span class="chip ${a[0] === "レンタル" ? "rental" : a[0] === "ピラティス" ? "lesson" : "cancelled"}">${a[0]}</span></td><td>${a[1]}</td><td>${a[2]}</td><td>${a[3]}</td><td style="white-space:normal">${a[4]}</td></tr>`).join("")}
    </tbody></table></div>
    <h2>明日の分の前日のお知らせ（今日の17:00に送ります）</h2>
    ${tomorrow.length ? `<div class="tbl"><table class="t"><thead><tr><th>宛先</th><th>予約</th><th></th></tr></thead><tbody>
      ${tomorrow.map((t, i) => `<tr><td>${esc(t.to)} 様</td><td>${esc(t.what)}</td><td><button class="btn" data-preview="${i}">文面を見る</button></td></tr>`).join("")}
    </tbody></table></div><div id="pv-box"></div>` : `<p class="note">明日の予約はありません。</p>`}
    <h2>送ったお知らせ（新しい順）</h2>
    <div class="tbl"><table class="t"><thead><tr><th>日時</th><th>宛先</th><th>手段</th><th>件名・内容</th></tr></thead><tbody>
      ${sent.map((m) => `<tr class="click" data-mail="${m.id}" tabindex="0"><td>${fmtAt(m.at)}</td><td>${esc(m.to)}${m.kind === "owner" ? "" : " 様"}</td><td>${m.how}</td><td style="white-space:normal">${esc(m.kind === "owner" ? m.body : m.subject)}${openMail === m.id && m.kind !== "owner" ? `<pre class="mailpre">${esc(m.body)}</pre>` : ""}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="note">行を押すと、メールの本文が開きます。</p>`;
};

VIEWS.news = () => `
  <h1>お知らせとInstagram</h1>
  <div class="panel">
    <p style="margin:0 0 8px;font-weight:700">Instagramとのつながり（表示例）</p>
    <table class="t"><tbody>
      <tr><th style="width:12em">アカウント</th><td>@sui_musubiya</td></tr>
      <tr><th>状態</th><td><span class="chip paid">つながっています</span></td></tr>
      <tr><th>最後に取り込んだ時刻</th><td>${md(0)} 6:00（1時間ごとに取り込みます）</td></tr>
      <tr><th>つなぐための鍵の期限</th><td>あと41日。期限の前に自動で更新します。更新できなかったときは、ここに赤字で出て、オーナー様にメールが届きます。</td></tr>
    </tbody></table>
    <div class="row" style="margin-top:12px"><button class="btn" id="ig-sync" type="button">いま取り込む</button>
      <label style="display:flex;gap:8px;align-items:center;width:auto">トップに出す数 <select id="ig-count" style="width:auto"><option>3</option><option selected>6</option></select></label></div>
    <p class="note">取り込めなかったときは、前回取り込んだ投稿をそのまま表示します。サイトの表示が空になることはありません。Instagramはプロアカウント（ビジネスかクリエイター）への切り替えが必要です。${todo("※いまの種類を確認中")}</p>
  </div>
  <h2>サイトに出す投稿</h2>
  <div class="tbl"><table class="t"><thead><tr><th>投稿（表示例）</th><th style="width:9em">サイトに出す</th></tr></thead><tbody>
    ${IG.map((p) => `<tr><td>${p.cap}</td><td><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" style="width:auto" data-ig="${p.id}" ${p.show ? "checked" : ""}> 出す</label></td></tr>`).join("")}
  </tbody></table></div>
  <p class="note">お客様の写った投稿など、サイトに出したくないものはチェックを外します。</p>
  <h2>お知らせを書く</h2>
  <div class="panel">
    <div class="grid2">
      <div><label class="f" for="nw-title">タイトル</label><input id="nw-title" placeholder="例：年末年始のお休みについて"></div>
      <div><label class="f" for="nw-status">公開</label><select id="nw-status"><option>公開</option><option>下書き</option></select></div>
    </div>
    <label class="f" for="nw-body" style="margin-top:12px">本文</label><textarea id="nw-body" rows="4"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="nw-add" type="button">保存する</button><span class="note hidden" id="nw-err" style="color:var(--c-danger)">タイトルを入れてください。</span></div>
  </div>
  <div class="tbl"><table class="t"><thead><tr><th>日付</th><th>タイトル</th><th>状態</th><th></th></tr></thead><tbody>
    ${NEWS.map((n) => `<tr><td>${n.date}</td><td>${esc(n.title)}</td><td>${n.status === "公開" ? '<span class="chip paid">公開</span>' : '<span class="chip cancelled">下書き</span>'}</td><td><button class="btn danger" data-delnews="${n.id}">消す</button></td></tr>`).join("")}
  </tbody></table></div>`;

VIEWS.settings = () => `
  <h1>料金と設定</h1>
  <div class="panel">
    <p style="margin:0 0 12px;font-weight:700"><span class="chip rental">レンタルスペース</span> 料金（税込の総額）</p>
    <div class="grid4">${Object.entries(PRICE).map(([h, p]) => `<div><label class="f" for="pr-${h}">${h}時間</label><input id="pr-${h}" type="number" step="100" value="${p}"></div>`).join("")}</div>
    <p class="note">いまの料金は、2027年3月31日までのお申込みのキャンペーン価格です。4月からの料金は ${todo("※要確認")}。撮影の料金を分けるかも ${todo("※要確認")}</p>
    <button class="btn primary" type="button" data-save>料金を保存する</button>
  </div>
  <div class="panel">
    <p style="margin:0 0 12px;font-weight:700"><span class="chip rental">レンタルスペース</span> 受付のきまり</p>
    <div class="grid2">
      <div><label class="f" for="st-open">ご利用時間</label><div class="row"><select id="st-open" style="width:auto">${timeOptions(7, 12, "9:00")}</select>〜<select style="width:auto" aria-label="ご利用時間の終わり">${timeOptions(17, 23, "21:00")}</select></div></div>
      <div><label class="f" for="st-dead">申込みの締め切り</label><select id="st-dead"><option>利用日の2日前まで</option><option selected>利用日の3日前まで</option><option>利用日の7日前まで</option></select></div>
      <div><label class="f" for="st-far">何日先まで受けるか</label><select id="st-far"><option>30日先まで</option><option selected>60日先まで</option><option>90日先まで</option></select></div>
      <div><label class="f" for="st-reply">お返事の目安（お客様に表示）</label><select id="st-reply"><option selected>24時間以内</option><option>48時間以内</option></select></div>
      <div><label class="f" for="st-cancel">キャンセル料</label><select id="st-cancel"><option selected>利用日の7日前から全額</option><option>利用日の3日前から全額</option></select></div>
      <div><label class="f" for="st-change">お客様ができる変更</label><select id="st-change"><option selected>変更の希望を送る（承認制）</option><option>変更はお問い合わせから</option></select></div>
    </div>
    <button class="btn primary" type="button" data-save>保存する</button>
  </div>
  <div class="panel">
    <p style="margin:0 0 12px;font-weight:700"><span class="chip lesson">ピラティス</span> 料金と受付のきまり</p>
    <div class="grid4">
      <div><label class="f" for="lp-semi">セミパーソナル</label><input id="lp-semi" type="number" step="100" value="2000"></div>
      <div><label class="f" for="lp-semi-t">セミパーソナル（体験）</label><input id="lp-semi-t" type="number" step="100" value="1000"></div>
      <div><label class="f" for="lp-pers">パーソナル</label><input id="lp-pers" type="number" step="100" value="3500"></div>
      <div><label class="f" for="lp-pers-t">パーソナル（体験）</label><input id="lp-pers-t" type="number" step="100" value="2000"></div>
      <div><label class="f" for="st-ldead">予約の締め切り</label><select id="st-ldead"><option>開始の1時間前まで</option><option selected>開始の3時間前まで</option><option>前日まで</option></select></div>
      <div><label class="f" for="st-lchange">お客様ができる変更</label><select id="st-lchange"><option selected>空きがあればその場で別の回へ</option><option>変更はお問い合わせから</option></select></div>
    </div>
    <p class="note">パーソナルの1回ごとの料金（3,500円か3,000円か）、キャンセル料、お支払い方法は ${todo("※要確認")}</p>
    <button class="btn primary" type="button" data-save>保存する</button>
  </div>
  <div class="panel">
    <p style="margin:0 0 12px;font-weight:700">オーナー様への連絡</p>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" checked> レンタルの新しい申込み・変更の希望・キャンセルが来たら、LINEでお知らせする</label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" checked> ピラティスの予約・キャンセルが入ったら、LINEでお知らせする</label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" checked> 毎朝7時に、今日の貸切とレッスン、承認待ちの数をLINEで送る</label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" checked> お客様への連絡が届かなかったら、メールでお知らせする</label>
    <button class="btn primary" type="button" data-save style="margin-top:12px">保存する</button>
  </div>
  <div class="panel">
    <p style="margin:0 0 8px;font-weight:700">ログインとお客様の情報</p>
    <p class="note" style="margin:0">本番では、ログインにパスワードとスマホの認証アプリ（2段階認証）を使います。ログインできるのはオーナー様だけです。お客様の名前や連絡先を残しておく期間は ${todo("※要確認")}（例：ご利用日から1年で消す）。</p>
  </div>`;

// ---- 右から出る詳しい内容：レンタルの申込み、または ピラティスの回 ----------------
let openNo = null;     // レンタルの受付番号
let openSlot = null;   // ピラティスの回の id
let declining = false;
let cancelling = false;
function detailBox() {
  let box = document.querySelector(".detail");
  if (!box) { box = document.createElement("aside"); box.className = "detail"; document.body.appendChild(box); }
  return box;
}
function renderDetail() {
  const r = openNo ? S.req(openNo) : null;
  const s = openSlot ? S.slot(openSlot) : null;
  if (!r && !s) { const box = document.querySelector(".detail"); if (box) box.remove(); return; }
  const box = detailBox();
  box.setAttribute("aria-label", r ? "申込みの内容" : "回の内容");
  box.innerHTML = r ? rentalDetail(r) : slotDetail(s);
  const memo = $("memo");
  if (memo && r) memo.addEventListener("change", (e) => { r.memo = e.target.value; S.save(); });
}
function rentalDetail(r) {
  const fixed = S.isHeld(r) || (r.status === "cancelled" && r.pick != null);
  const choices = r.choices.map((c, i) => {
    const hit = S.conflict(c.day, c.start, c.h * 60, r.no);
    const chosen = fixed && r.pick === i;
    const action = r.status === "pending"
      ? `<button class="btn ${hit ? "" : "primary"}" data-approve="${i}" ${hit ? "disabled" : ""}>この日で承認</button>`
      : chosen ? `<span class="chip confirmed">${r.status === "cancelled" ? "キャンセルした日" : "この日で確定"}</span>` : "";
    return `<div class="choice"><div>${r.status === "pending" || !chosen ? `第${i + 1}希望　` : ""}${choiceText(c)}　${yen(PRICE[c.h])}
      ${r.status === "pending" ? (hit ? `<span class="conflict">${esc(hit.label)}と重なります</span>` : '<span class="free">空いています</span>') : ""}</div>${action}</div>`;
  }).filter((_, i) => r.status === "pending" || !fixed || r.pick === i).join("");
  const changeBox = r.change ? `<p style="font-weight:700;margin:16px 0 8px">日時の変更の希望（${fmtAt(r.change.recv)} 受付）</p>
    ${r.change.choices.map((c, i) => { const hit = S.conflict(c.day, c.start, c.h * 60, r.no); return `<div class="choice"><div>${r.change.choices.length > 1 ? `第${i + 1}希望　` : ""}${choiceText(c)}　${yen(PRICE[c.h])}${hit ? `<span class="conflict">${esc(hit.label)}と重なります</span>` : '<span class="free">空いています</span>'}</div><button class="btn ${hit ? "" : "primary"}" data-chgok="${i}" ${hit ? "disabled" : ""}>この日に変更</button></div>`; }).join("")}
    <div class="row"><button class="btn danger" data-chgno>変更をお断りする</button></div>
    <p class="note">変更すると、いまの日時は空きに戻ります。料金が変わる場合の差額の扱いは ${todo("※要確認")}</p>` : "";
  const held = S.isHeld(r) ? r.choices[r.pick] : null;
  const fee = held && held.day <= 7 ? PRICE[held.h] : 0;
  const until = held ? (held.day === 0 ? "今日がご利用日です。" : `ご利用日まであと${held.day}日です。`) : "";
  return `
    <button class="btn close" type="button" data-close>閉じる</button>
    <p style="margin:0"><span class="chip rental">レンタル</span> ${chip(r.status)} ${changeChip(r)} ${waitNote(r)}</p>
    <h3>${esc(r.name)} 様</h3>
    <dl>
      <dt>受付番号</dt><dd>${r.no}（${fmtAt(r.recv)} 受付）</dd>
      <dt>ふりがな</dt><dd>${esc(r.kana)}</dd>
      <dt>電話</dt><dd>${esc(r.tel)}</dd>
      <dt>メール</dt><dd>${esc(r.mail)}</dd>
      <dt>目的・人数</dt><dd>${esc(r.purpose)}・${r.people}名</dd>
      <dt>あてはまる</dt><dd>${r.flags.length ? r.flags.map((f) => esc(f)).join("、") : "なし"}</dd>
      <dt>内容</dt><dd>${esc(r.note || "")}</dd>
      <dt>知ったきっかけ</dt><dd>${esc(r.found)}</dd>
      <dt>LINEで連絡</dt><dd>${r.line ? "希望する" : "希望しない（メールで連絡）"}</dd>
      ${r.reason ? `<dt>お断りの理由</dt><dd>${esc(r.reason)}</dd>` : ""}
    </dl>
    <p style="font-weight:700;margin:0 0 8px">${r.status === "pending" ? "希望の日時" : "日時"}</p>
    ${choices}
    ${changeBox}
    ${r.status === "pending" ? `<p class="note">重なっている希望は承認できません（二重予約を防ぐため）。承認すると、ほかの希望は自動で外れます。</p>
      ${declining ? `<div class="panel"><label class="f" for="dc-reason">お断りの理由（お客様へのメールに入ります）</label>
        <select id="dc-reason"><option>ご希望の日時がすべて埋まってしまったため</option><option>ご利用の内容がこの場所に合わないため</option><option>定員を超えるため</option></select>
        <div class="row" style="margin-top:12px"><button class="btn danger" data-decline-send>お断りを送る</button><button class="btn" data-decline-cancel>やめる</button></div></div>`
      : `<div class="row"><button class="btn danger" data-decline>お断りする</button></div>`}` : ""}
    ${r.status === "confirmed" ? `<div class="row" style="margin-top:8px"><button class="btn primary" data-paid>入金を記録する</button></div><p class="note">お振込みの期限は ○ ${todo("※要確認")}</p>` : ""}
    ${held ? (cancelling ? `<div class="panel"><p style="margin:0 0 8px">${until}${fee ? `7日前からなので、キャンセル料は全額（${yen(fee)}）です。` : "いまならキャンセル料はかかりません。"}</p><div class="row"><button class="btn danger" data-cancel-send>キャンセルにする</button><button class="btn" data-cancel-stop>やめる</button></div></div>`
      : `<div class="row" style="margin-top:8px"><button class="btn" data-cancel>キャンセルにする</button></div>`) : ""}
    <label class="f" for="memo" style="margin-top:16px">メモ（お客様には見えません）</label>
    <textarea id="memo" rows="3">${esc(r.memo || "")}</textarea>`;
}
function slotDetail(s) {
  const list = D().book.filter((b) => b.slot === s.id);
  const n = S.booked(s.id);
  const past = s.day < 0 || (s.day === 0 && toMin(s.start) < nowMin());
  return `
    <button class="btn close" type="button" data-close>閉じる</button>
    <p style="margin:0"><span class="chip ${s.kind}">${kindName[s.kind]}</span>${n >= s.cap ? ' <span class="chip declined">満席</span>' : ""}</p>
    <h3>${esc(s.name)}　${md(s.day)} ${span(s.start, s.min)}</h3>
    <div class="seatbar" aria-label="${n}/${s.cap}名"><span style="width:${Math.min(100, (n / s.cap) * 100)}%"></span></div>
    <div class="row" style="margin:8px 0 16px"><label class="f" for="cap-${s.id}" style="margin:0">定員</label><input id="cap-${s.id}" type="number" min="${Math.max(n, 1)}" max="30" value="${s.cap}" data-cap="${s.id}" style="width:5em">名　<span class="note">予約 ${n}名・あと${Math.max(s.cap - n, 0)}名</span></div>
    <p style="font-weight:700;margin:0 0 8px">予約した方</p>
    ${list.length ? `<ul class="people">${list.map((b) => `<li class="${b.status !== "confirmed" ? "off" : ""}">
        <div><b>${esc(b.name)} 様</b>${b.trial ? ' <span class="chip pending">初回体験</span>' : ""}${b.status !== "confirmed" ? ' <span class="chip cancelled">キャンセル</span>' : ""}<br><span class="note">${b.no}・${esc(b.tel)}${b.note ? `・${esc(b.note)}` : ""}</span></div>
        ${b.status === "confirmed" && !past ? (movingNo === b.no ? moveRow({ ...b, s }) : `<div class="row"><button class="btn" data-mv="${b.no}">回を変える</button><button class="btn" data-bcancel="${b.no}">キャンセル</button></div>`) : ""}
      </li>`).join("")}</ul>` : `<p class="note">まだ予約はありません。</p>`}
    ${!past && n < s.cap ? `<div class="panel" style="margin-top:16px"><p style="margin:0 0 8px;font-weight:700">電話やLINEで受けた予約を入れる</p>
      <div class="grid2"><div><label class="f" for="mb-name">お名前</label><input id="mb-name"></div><div><label class="f" for="mb-tel">電話番号</label><input id="mb-tel" inputmode="tel"></div></div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="mb-trial" style="width:auto"> 初回体験</label>
      <div class="row" style="margin-top:8px"><button class="btn primary" data-mbadd="${s.id}">この回に入れる</button><span class="note hidden" id="mb-err" style="color:var(--c-danger)">お名前と電話番号を入れてください。</span></div></div>` : ""}
    ${n === 0 ? `<div class="row" style="margin-top:16px"><button class="btn danger" data-delslot="${s.id}">この回を消す</button></div>` : ""}`;
}
function openReq(no) { openNo = no; openSlot = null; declining = false; cancelling = false; movingNo = null; renderDetail(); }
function openSlotDetail(id) { openSlot = id; openNo = null; movingNo = null; renderDetail(); }
function closeDetail() { openNo = null; openSlot = null; movingNo = null; renderDetail(); }

// ---- 動き --------------------------------------------------------------
function render() {
  S.save();
  const view = (location.hash || "#dashboard").slice(1);
  const v = VIEWS[view] ? view : "dashboard";
  document.querySelectorAll(".side a").forEach((a) => a.classList.toggle("on", a.dataset.view === v));
  $("main").innerHTML = VIEWS[v]();
  updateBadges();
  renderDetail();
}
window.addEventListener("hashchange", () => { closeDetail(); render(); });

document.addEventListener("click", (e) => {
  const t = e.target.closest("button, [data-open], [data-slot], [data-mail], [data-rf-link], [data-day]");
  if (!t) return;
  const d = t.dataset;
  const r = openNo ? S.req(openNo) : null;

  if (d.rfLink) { reqFilter = d.rfLink; return; } // そのまま #rental-req へ移る
  if (d.open) return openReq(d.open);
  if (d.slot && !d.mvgo) return openSlotDetail(d.slot);
  if ("close" in d) return closeDetail();

  // レンタル
  if (d.approve !== undefined) {
    const c = r.choices[Number(d.approve)];
    const hit = S.conflict(c.day, c.start, c.h * 60, r.no);
    if (hit) return toast(`${hit.label}と重なるので承認できません。`);
    r.status = "confirmed"; r.pick = Number(d.approve);
    S.mail("rental_approved", r, [r]);
    toast(`第${r.pick + 1}希望で承認しました。${r.name} 様に確定のお知らせとお振込みのご案内を送りました（モック）`);
    return render();
  }
  if (d.chgok !== undefined) {
    const c = r.change.choices[Number(d.chgok)];
    const hit = S.conflict(c.day, c.start, c.h * 60, r.no);
    if (hit) return toast(`${hit.label}と重なるので変更できません。`);
    const before = { ...r.choices[r.pick] };
    r.choices = [{ ...c }]; r.pick = 0; r.change = null;
    S.mail("rental_change_approved", r, [r, before]);
    toast(`${choiceText(c)} に変更しました。${r.name} 様にお知らせを送りました（モック）`);
    return render();
  }
  if ("chgno" in d) { S.mail("rental_change_declined", r, [r]); r.change = null; toast(`変更をお断りしました。${r.name} 様にお知らせを送りました（モック）`); return render(); }
  if ("decline" in d) { declining = true; return renderDetail(); }
  if ("declineCancel" in d) { declining = false; return renderDetail(); }
  if ("declineSend" in d) { r.status = "declined"; r.reason = $("dc-reason").value; declining = false; S.mail("rental_declined", r, [r]); toast(`${r.name} 様にお断りのメールを送りました（モック）`); return render(); }
  if ("paid" in d) { r.status = "paid"; S.mail("rental_paid", r, [r]); toast("入金を記録しました。お客様に入金確認のお知らせを送りました（モック）"); return render(); }
  if ("cancel" in d) { cancelling = true; return renderDetail(); }
  if ("cancelStop" in d) { cancelling = false; return renderDetail(); }
  if ("cancelSend" in d) {
    const c = r.choices[r.pick];
    const fee = c.day <= 7 ? PRICE[c.h] : 0;
    r.status = "cancelled"; r.change = null; cancelling = false;
    S.mail("rental_cancelled", r, [r, fee]);
    toast("キャンセルにしました。お客様にお知らせを送りました（モック）");
    return render();
  }
  if (d.rf) { reqFilter = d.rf; return render(); }

  // ピラティス
  if (d.bf) { bookFilter = d.bf; return render(); }
  if (d.bcancel) {
    const b = S.bookOf(d.bcancel);
    b.status = "cancelled";
    S.mail("lesson_cancelled", b, [b, S.slot(b.slot)]);
    toast(`${b.name} 様の予約をキャンセルにしました。お客様にお知らせを送りました（モック）`);
    return render();
  }
  if (d.mv) { movingNo = d.mv; return render(); }
  if ("mvstop" in d) { movingNo = null; return render(); }
  if (d.mvgo) {
    const b = S.bookOf(d.mvgo);
    const to = S.slot($("mv-to") && $("mv-to").value);
    if (!to || S.booked(to.id) >= to.cap) return toast("移せる回がありません。");
    const before = { ...S.slot(b.slot) };
    b.slot = to.id; movingNo = null;
    S.mail("lesson_changed", b, [b, to, before]);
    toast(`${b.name} 様の予約を ${md(to.day)} ${to.start} に移しました。お客様にお知らせを送りました（モック）`);
    return render();
  }
  if (d.mbadd) {
    const s = S.slot(d.mbadd);
    const name = $("mb-name").value.trim(), tel = $("mb-tel").value.trim();
    if (!name || !tel) return $("mb-err").classList.remove("hidden");
    if (S.booked(s.id) >= s.cap) return toast("この回は満席です。");
    D().book.push({ no: S.code(), slot: s.id, name, kana: "", tel, mail: "", trial: $("mb-trial").checked, note: "電話・LINEで受付", status: "confirmed", recv: Date.now() });
    toast(`${name} 様を ${md(s.day)} ${s.start} の${s.name}に入れました`);
    return render();
  }
  if (d.range) { slotRange = Number(d.range); return render(); }
  if (t.id === "ns-add") {
    const kinds = { semi: ["lesson", "セミパーソナル", 60, 5], personal: ["lesson", "パーソナル", 50, 1], event: ["event", "イベント（名前は後で）", 120, 8] };
    const [kind, name, min, cap] = kinds[$("ns-kind").value];
    const day = Number($("ns-day").value), start = $("ns-start").value;
    const err = $("ns-err");
    if (toMin(start) + min > 21 * 60) { err.textContent = "21:00を過ぎてしまいます。"; return err.classList.remove("hidden"); }
    const hit = S.conflict(day, start, min);
    if (hit) { err.textContent = `${md(day)} は ${hit.label} と重なります。`; return err.classList.remove("hidden"); }
    D().slots.push({ id: `S${Date.now()}`, kind, day, start, min, name, cap });
    toast(`${md(day)} ${start} の回を足しました。お客様の画面にすぐ出ます（モック）`);
    return render();
  }
  if (d.delslot) { D().slots = D().slots.filter((s) => s.id !== d.delslot); if (openSlot === d.delslot) openSlot = null; toast("回を消しました"); return render(); }

  // カレンダー
  if (d.calmode) { const [k, m] = d.calmode.split(":"); cal[k].mode = m; return render(); }
  if (d.week) { const [k, n] = d.week.split(":"); cal[k].week = Number(n) === 0 ? sundayOf(0) : cal[k].week + Number(n); cal[k].sel = Number(n) === 0 ? 0 : cal[k].week; return render(); }
  if (d.mon) {
    const [k, n] = d.mon.split(":"); cal[k].mon = Number(n) === 0 ? 0 : cal[k].mon + Number(n);
    const { y, m } = monthOf(cal[k]); cal[k].sel = cal[k].mon === 0 ? 0 : S.offOf(y, m, 1); // 今月なら今日、ほかの月なら1日を選ぶ
    return render();
  }
  if (d.gotoweek) { const [k, n] = d.gotoweek.split(":"); cal[k].week = sundayOf(Number(n)); cal[k].sel = Number(n); cal[k].mode = "week"; return render(); }
  if (d.day) { const [k, n] = d.day.split(":"); cal[k].sel = Number(n); return render(); }
  if (d.dayshift) {
    const [k, n] = d.dayshift.split(":"); const st = cal[k]; st.sel += Number(n);
    // 選んだ日が表の外に出たら、表もいっしょに動かす
    if (st.mode === "week" && (st.sel < st.week || st.sel > st.week + 6)) st.week = sundayOf(st.sel);
    if (st.mode === "month") { const t = S.dayOf(0), x = S.dayOf(st.sel); st.mon = (x.getFullYear() - t.getFullYear()) * 12 + x.getMonth() - t.getMonth(); }
    return render();
  }
  if (d.addon !== undefined) { addDay = Number(d.addon); location.hash = "#pilates-slots"; return; }
  if (d.ics) {
    const evs = (d.ics === "rental" ? S.busy().filter((b) => b.kind === "rental") : S.busy().filter((b) => b.kind === "lesson" || b.kind === "event"))
      .filter((b) => b.day >= 0).map((b) => ({ day: b.day, s: b.s, e: b.e, title: `結び家SUI ${b.label}`, uid: `${b.kind}-${b.no || b.id}-${b.day}` }));
    S.download(`musubiya-sui-${d.ics}.ics`, S.ics(evs));
    return toast(`${evs.length}件の予定を書き出しました。カレンダーアプリで読み込めます`);
  }

  // 共通
  if (d.resend || d.phoned) { D().failed = D().failed.filter((f) => f.id !== (d.resend || d.phoned)); toast(d.resend ? "送り直しました（モック）" : "電話で伝えた、と記録しました"); return render(); }
  if (t.id === "nc-add") {
    const day = Number($("nc-day").value);
    const reason = $("nc-reason").value.trim() || "お休み";
    const err = $("nc-err");
    const hit = S.busy().find((b) => b.day === day);
    if (hit) { err.textContent = `${md(day)} には ${hit.label} が入っています。先にお客様と調整してください。`; return err.classList.remove("hidden"); }
    D().closed.push({ day, reason });
    toast(`${md(day)} を休業日にしました。お客様の画面では「お休み」になります`);
    return render();
  }
  if (d.delclosed) { D().closed = D().closed.filter((c) => c.day !== Number(d.delclosed)); toast("休業日を取り消しました"); return render(); }
  if (d.mail) { openMail = openMail === d.mail ? null : d.mail; return render(); }
  if (d.preview !== undefined) {
    const item = tomorrowList()[Number(d.preview)];
    const before = D().mails.length;
    const m = S.mail(item.kind, item.args[0], item.args);
    D().mails.splice(before, 1); // 文面を見るだけなので、送った記録には残さない
    $("pv-box").innerHTML = `<div class="panel" style="margin-top:12px"><p style="margin:0 0 8px;font-weight:700">${esc(m.subject)}</p><pre class="mailpre">${esc(m.body)}</pre></div>`;
    return;
  }
  if (t.id === "ig-sync") return toast("Instagramから取り込みました（モック）");
  if (t.id === "nw-add") {
    const title = $("nw-title").value.trim();
    $("nw-err").classList.toggle("hidden", !!title);
    if (!title) return;
    const now = new Date();
    NEWS.unshift({ id: Date.now(), date: `${now.getMonth() + 1}/${now.getDate()}`, title, status: $("nw-status").value });
    toast("お知らせを保存しました（モック）");
    return render();
  }
  if (d.delnews) { NEWS = NEWS.filter((n) => String(n.id) !== d.delnews); toast("お知らせを消しました"); return render(); }
  if ("save" in d) return toast("保存しました（モック）");
  if (t.id === "demo-reset") { S.reset(); closeDetail(); toast("見本のデータに戻しました"); return render(); }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.ig) {
    const p = IG.find((x) => x.id === el.dataset.ig);
    p.show = el.checked;
    toast(p.show ? "サイトに出します" : "サイトに出さないようにしました");
  }
  if (el.dataset.cap) {
    const s = S.slot(el.dataset.cap);
    const n = S.booked(s.id);
    const v = Math.max(n, 1, Math.min(30, Number(el.value) || s.cap));
    s.cap = v;
    toast(v === Number(el.value) ? `${md(s.day)} ${s.start} の定員を${v}名にしました。お客様の画面にすぐ反映します` : `いまの予約が${n}名なので、定員は${v}名にしました`);
    render();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (openNo || openSlot)) closeDetail();
  if (e.key === "Enter" && e.target.matches("[data-open]")) openReq(e.target.dataset.open);
  if (e.key === "Enter" && e.target.matches("[data-slot]")) openSlotDetail(e.target.dataset.slot);
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-day]")) { e.preventDefault(); e.target.click(); }
});
// お客様の画面（別のタブ）でデータが変わったら描き直す
window.addEventListener("storage", (e) => {
  if (e.key && !e.key.startsWith("sui-mock")) return;
  S.reload();
  if (!$("app").classList.contains("hidden")) render();
});

// ---- ログイン（モック） ----------------------------------------------------
function enter() { $("login").classList.add("hidden"); $("app").classList.remove("hidden"); render(); }
$("lg-go").addEventListener("click", () => { try { sessionStorage.setItem("sui-admin", "1"); } catch (_) {} enter(); });
$("logout").addEventListener("click", () => {
  try { sessionStorage.removeItem("sui-admin"); } catch (_) {}
  closeDetail();
  $("app").classList.add("hidden"); $("login").classList.remove("hidden");
});
try { if (sessionStorage.getItem("sui-admin") === "1") enter(); } catch (_) {}

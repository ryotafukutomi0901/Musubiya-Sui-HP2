// ご予約の確認・変更・キャンセル（reserve-check.html）。レンタルとピラティスをタブで分ける。
const { S, $, esc, yen, jd, span, toMin, PRICE, params, Month, RentalPicker, LessonPicker, slotState, mailHtml, addCalHtml } = window.BK;

let tab = params.get("type") === "pilates" ? "pilates" : "rental";
const TYPE = { rental: "rental", pilates: "lesson" };

// ---- 1件の予約がカレンダーのどの日に当たるか ----
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
function recCalendar(el, items, kind, onPick) {
  const first = items.length ? Math.min(...items.map((x) => x.day)) : 0;
  return Month(el, {
    min: 0, max: S.RENTAL_TO, start: Math.max(first, 0),
    info: (off) => { const hit = items.filter((x) => x.day === off); if (!hit.length) return { disabled: true }; return { cls: `${hit.some((x) => x.held) ? "mine" : "mine-p"} ${kind}`, mark: hit[0].mark, label: hit.map((x) => x.mark).join("・") }; },
    onPick: onPick || (() => {}),
  });
}

// ---- この端末で申し込んだご予約（タブの種類だけ） ----
const resolveMine = () => S.mine().map((x) => ({ ...x, rec: x.type === "rental" ? S.req(x.no) : S.bookOf(x.no) })).filter((x) => x.rec);
function mineLine(x) {
  if (x.type === "lesson") {
    const s = S.slot(x.rec.slot);
    return `<span class="when">${s ? `${s.name}　${jd(s.day)} ${span(s.start, s.min)}` : ""}</span><span class="chip ${x.rec.status === "confirmed" ? "paid" : "cancelled"}">${x.rec.status === "confirmed" ? "確定" : "キャンセル"}</span>`;
  }
  const r = x.rec;
  const fixed = S.isHeld(r) || (r.status === "cancelled" && r.pick != null);
  return `<span class="when">${fixed ? S.whenText(r.choices[r.pick]) : `第1希望 ${S.whenText(r.choices[0])}`}</span><span class="chip ${r.status}">${S.STATUS[r.status]}</span>${r.change ? '<span class="chip pending">変更の確認中</span>' : ""}`;
}
function renderTabs() {
  const all = resolveMine();
  ["rental", "pilates"].forEach((t) => {
    const n = all.filter((x) => x.type === TYPE[t]).length;
    $(`cnt-${t}`).textContent = n ? `（${n}）` : "";
    $(`tab-${t}`).setAttribute("aria-selected", t === tab);
  });
}
function renderMine() {
  renderTabs();
  const list = resolveMine().filter((x) => x.type === TYPE[tab]);
  const el = $("mine");
  const label = tab === "rental" ? "スペースのお申込み" : "ピラティスのご予約";
  $("mine-ttl").textContent = `この端末で申し込んだ${label}`;
  if (!list.length) {
    el.innerHTML = `<p class="note" style="margin:0">この端末で申し込んだ${label}は、まだありません。ほかの端末で申し込んだときは、下の「番号で探す」から探せます。</p>
      <div class="actions"><a class="btn" href="${tab === "rental" ? "reserve-rental.html" : "reserve-pilates.html"}">${tab === "rental" ? "空き状況を見る" : "レッスンの空きを見る"}</a></div>`;
    return;
  }
  el.innerHTML = `<div class="rec2"><div class="mine-cal"></div><div><p class="note" style="margin:0">塗りつぶしは確定したご予約、点線は確認中の希望です。日にちか一覧の「開く」を押すと、詳しい内容と、変更・キャンセルのボタンが出ます。</p><ul class="mine-list">${list.map((x, i) => `<li>${mineLine(x)}<button type="button" class="btn sm" data-mine="${i}">開く</button></li>`).join("")}</ul></div></div>`;
  const items = [];
  list.forEach((x, i) => recordDays(x.type, x.rec).forEach((d) => items.push({ ...d, i })));
  recCalendar(el.querySelector(".mine-cal"), items, TYPE[tab], (off) => { const hit = items.find((x) => x.day === off); if (hit) openRecord(list[hit.i].type, list[hit.i].rec); });
  el.querySelectorAll("[data-mine]").forEach((b) => b.addEventListener("click", () => { const x = list[Number(b.dataset.mine)]; openRecord(x.type, x.rec); }));
}
document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; cur = null; renderResult(); renderMine(); }));

// ---- 番号で探す ----
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
});
document.querySelectorAll("[data-try]").forEach((b) => b.addEventListener("click", () => {
  const [no, tel] = b.dataset.try.split(",");
  $("s-no").value = no; $("s-tel").value = tel;
  $("s-go").click();
}));

// ---- 1件の詳しい内容と、変更・キャンセル ----
let cur = null; // { type, no, mode, mail, msg, picker }
function openRecord(type, rec) {
  if (!rec) return;
  const t = type === "rental" ? "rental" : "pilates";
  if (t !== tab) { tab = t; renderMine(); }
  cur = { type, no: rec.no, mode: null, mail: null, msg: "" };
  renderResult();
  $("s-result").scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderResult() {
  const el = $("s-result");
  if (!cur) { el.innerHTML = ""; return; }
  const rec = cur.type === "rental" ? S.req(cur.no) : S.bookOf(cur.no);
  if (!rec) { el.innerHTML = ""; return; }
  el.innerHTML = cur.type === "rental" ? rentalResult(rec) : lessonResult(rec);
  recCalendar(el.querySelector(".rec-cal"), recordDays(cur.type, rec), cur.type);
  if (cur.mode === "rechoose" || cur.mode === "change") {
    cur.picker = RentalPicker(el.querySelector(".rec-picker"), { max: 3, exceptNo: rec.no, initial: cur.mode === "rechoose" ? rec.choices : [] });
  }
  if (cur.mode === "move") {
    // 変えられるのは同じプランの回だけ（プランが変わると料金も変わるため）
    const name = (S.slot(rec.slot) || {}).name;
    LessonPicker(el.querySelector(".rec-picker"), { exceptSlot: rec.slot, btn: "この回に変える", trial: rec.trial, filter: () => (s) => s.name === name, onPick: (s) => moveLesson(rec, s) });
  }
}
const shell = (head, title, body, calNote, actions) => `<div class="panel" style="margin-top:var(--s-4)">
  <div class="rec-head">${head}</div>
  <p class="rec-ttl">${title}</p>
  <div class="rec2"><div>${body}</div><div><div class="rec-cal"></div><p class="note" style="margin-top:var(--s-2)">${calNote}</p></div></div>
  ${cur.msg ? `<p style="margin-top:var(--s-4);font-weight:500" role="status">${cur.msg}</p>` : ""}
  ${actions}
  ${mailHtml(cur.mail, true)}
</div>`;

function rentalResult(r) {
  const held = S.isHeld(r);
  const c = held || (r.status === "cancelled" && r.pick != null) ? r.choices[r.pick] : null;
  const head = `<span class="chip rental">レンタル</span><span class="chip ${r.status}">${S.STATUS[r.status]}</span>${r.change ? '<span class="chip pending">変更の確認中</span>' : ""}<span class="note">受付番号 ${r.no}</span>`;
  const title = c ? S.whenText(c) : "ご希望の日時を確かめています";
  let body = `<table class="t"><tbody>`;
  if (c) body += `<tr><th scope="row">日時</th><td>${S.whenText(c)}</td></tr><tr><th scope="row">料金</th><td>${yen(PRICE[c.h])}（税込）${r.status === "paid" ? "　お振込み済み" : r.status === "confirmed" ? "　お振込みをお待ちしています" : ""}</td></tr>`;
  else body += r.choices.map((x, i) => `<tr><th scope="row">第${i + 1}希望</th><td>${S.whenText(x)}　${yen(PRICE[x.h])}</td></tr>`).join("");
  if (r.change) body += r.change.choices.map((x, i) => `<tr><th scope="row">変更の希望${r.change.choices.length > 1 ? i + 1 : ""}</th><td>${S.whenText(x)}　${yen(PRICE[x.h])}</td></tr>`).join("");
  body += `<tr><th scope="row">目的・人数</th><td>${esc(r.purpose)}・${r.people}名</td></tr>`;
  if (r.status === "declined") body += `<tr><th scope="row">お断りの理由</th><td>${esc(r.reason || "")}</td></tr>`;
  body += `</tbody></table>`;
  if (held) body += `<div class="addcal">${addCalHtml("結び家SUI レンタル", c.day, toMin(c.start), toMin(c.start) + c.h * 60, r.no)}</div>`;
  const calNote = held ? "塗りつぶしがご予約の日、点線は変更のご希望です。" : r.status === "pending" ? "点線の日がご希望の日です。確定すると塗りつぶしに変わります。" : "";
  const fee = c && held ? (c.day <= 7 ? PRICE[c.h] : 0) : 0;
  let actions = "";
  if (cur.mode === "rechoose" || cur.mode === "change") {
    actions = `<h3 style="margin:var(--s-5) 0 var(--s-2)">${cur.mode === "change" ? "変更したい日時を選ぶ（3つまで）" : "希望の日時を選び直す"}</h3>
      ${cur.mode === "change" ? '<p class="note">変更の希望を送っても、確定するまでは、いまのご予約がそのまま残ります。</p>' : ""}
      <div class="rec-picker"></div>
      <p class="err hidden" id="x-err" role="alert"></p>
      <div class="actions"><button class="btn" type="button" data-act="back">やめる</button><button class="btn accent" type="button" data-act="${cur.mode}-send">${cur.mode === "change" ? "変更を申し込む" : "この希望で送り直す"}</button></div>`;
  } else if (cur.mode === "cancel") {
    actions = `<div class="panel" style="margin-top:var(--s-4);background:var(--c-surface);border:0"><p style="margin:0 0 var(--s-2)">${held ? (fee ? `ご利用日の7日前を過ぎているので、キャンセル料は料金の全額（${yen(fee)}）です。` : "いまならキャンセル料はかかりません。") : "まだ確定していないお申込みなので、キャンセル料はかかりません。"}</p>
      <div class="actions" style="margin-top:0"><button class="btn" type="button" data-act="back">やめる</button><button class="btn accent" type="button" data-act="cancel-send">${held ? "キャンセルする" : "お申込みを取り消す"}</button></div></div>`;
  } else if (r.status === "pending") {
    actions = `<div class="actions"><button class="btn" type="button" data-act="rechoose">希望の日時を変える</button><button class="btn" type="button" data-act="cancel">お申込みを取り消す</button></div>`;
  } else if (held) {
    actions = `<div class="actions">${r.change ? '<button class="btn" type="button" data-act="withdraw">変更の希望を取り下げる</button>' : '<button class="btn" type="button" data-act="change">日時の変更を申し込む</button>'}<button class="btn" type="button" data-act="cancel">キャンセルする</button></div>`;
  }
  return shell(head, title, body, calNote, actions);
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
    actions = `<h3 style="margin:var(--s-5) 0 var(--s-2)">変更したい回を選ぶ</h3><p class="note">同じ${s ? s.name : "プラン"}の、空きのある回なら、その場で変更が確定します。ほかのプランに変えたいときは、いまの予約をキャンセルしてから予約し直してください。</p><div class="rec-picker"></div><div class="actions"><button class="btn" type="button" data-act="back">やめる</button></div>`;
  } else if (cur.mode === "cancel") {
    actions = `<div class="panel" style="margin-top:var(--s-4);background:var(--c-surface);border:0"><p style="margin:0 0 var(--s-2)">キャンセル料のきまり：○時間前までは無料 <span class="todo">※要確認</span></p>
      <div class="actions" style="margin-top:0"><button class="btn" type="button" data-act="back">やめる</button><button class="btn accent" type="button" data-act="lcancel-send">キャンセルする</button></div></div>`;
  } else if (ok) {
    actions = `<div class="actions"><button class="btn" type="button" data-act="move">別の回に変える</button><button class="btn" type="button" data-act="cancel">キャンセルする</button></div>`;
  }
  return shell(head, title, body, "塗りつぶしがご予約の日です。", actions);
}

function moveLesson(b, s) {
  if (!slotState(s).ok) return;
  const before = { ...S.slot(b.slot) };
  b.slot = s.id;
  cur.mail = S.mail("lesson_changed", b, [b, s, before]);
  S.save();
  cur.mode = null;
  cur.msg = `${s.name}　${jd(s.day)} ${span(s.start, s.min)} に変更しました。`;
  renderResult(); renderMine();
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
    if (!list.length) { $("x-err").textContent = "カレンダーで日時を1つ以上選んでください。"; return $("x-err").classList.remove("hidden"); }
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
    renderResult(); renderMine();
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
    renderResult(); renderMine();
    return;
  }
  if (act === "lcancel-send") {
    const s = S.slot(rec.slot);
    rec.status = "cancelled";
    cur.mail = S.mail("lesson_cancelled", rec, [rec, s]);
    S.owner("cancel_lesson", [rec, s]);
    S.save(); cur.mode = null;
    cur.msg = "キャンセルしました。";
    renderResult(); renderMine();
  }
});

window.addEventListener("storage", (e) => {
  if (e.key && !e.key.startsWith("sui-mock")) return;
  S.reload(); renderMine();
  if (cur && !cur.mode) renderResult();
});

// 完了の画面から来たとき（?no=）は、その予約を開く
renderMine();
const opened = resolveMine().find((x) => x.no === (params.get("no") || "").toUpperCase());
if (opened) openRecord(opened.type, opened.rec);

// 予約管理画面（/admin）のモック。予約のデータは assets/mock-db.js（ご予約のページと同じもの）を読み書きする。
// どこにも送らない。本番では、ログイン（2段階認証）、保存、お客様への連絡、二重予約の確認をサーバー側で行う。

const S = window.SUI;
const { PRICE, md, jd, toMin, toTime, span, yen, esc, STATUS } = S;
const $ = (id) => document.getElementById(id);
const fmtAt = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
const hoursAgo = (r) => Math.max(0, Math.floor((Date.now() - r.recv) / 3600e3));
const D = () => S.db;

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
const todo = (s) => `<span style="color:var(--c-danger)">${s}</span>`;
const needsAction = () => D().req.filter((r) => r.status === "pending" || r.change).length;
function updateBadge() { $("nav-pending").textContent = needsAction() || ""; }
const slotLabel = (s) => `${s.name}（${S.booked(s.id)}/${s.cap}名）`;

// ---- 画面 ----------------------------------------------------------------
const VIEWS = {};

VIEWS.dashboard = () => {
  const pending = D().req.filter((r) => r.status === "pending").sort((a, b) => a.recv - b.recv);
  const changes = D().req.filter((r) => r.change);
  const today = S.busy().filter((b) => b.day === 0 && b.kind !== "closed").sort((a, b) => a.s - b.s);
  const unpaid = D().req.filter((r) => r.status === "confirmed");
  const oldest = pending[0];
  return `
    <h1>ホーム</h1>
    <div class="cards">
      <div class="card ${pending.length ? "warn" : ""}"><p class="k">承認待ちの申込み</p><p class="v">${pending.length}<small>件</small></p><p class="s">${oldest ? `いちばん古いものは${hoursAgo(oldest)}時間前` : "ありません"}</p></div>
      <div class="card ${changes.length ? "warn" : ""}"><p class="k">日時の変更の希望</p><p class="v">${changes.length}<small>件</small></p><p class="s">確定済みのレンタル</p></div>
      <div class="card"><p class="k">今日の予定</p><p class="v">${today.length}<small>件</small></p><p class="s">${md(0)}</p></div>
      <div class="card ${D().failed.length ? "warn" : ""}"><p class="k">届かなかった連絡</p><p class="v">${D().failed.length}<small>件</small></p><p class="s">メール・LINE</p></div>
    </div>

    <h2>承認待ちの申込み</h2>
    ${pending.length ? `<div class="tbl"><table class="t"><thead><tr><th>受付</th><th>お名前</th><th>目的</th><th>第1希望</th><th>金額</th><th>経過</th></tr></thead><tbody>
      ${pending.map((r) => `<tr class="click" data-open="${r.no}"><td>${r.no}</td><td>${esc(r.name)} 様</td><td>${esc(r.purpose)}</td><td>${choiceText(r.choices[0])}</td><td class="num">${yen(PRICE[r.choices[0].h])}</td><td>${waitNote(r)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="note">お客様には「24時間以内にお返事します」と伝えています。${todo("※返事の期限は要確認")}</p>` : `<p class="note">承認待ちの申込みはありません。</p>`}

    ${changes.length ? `<h2>日時の変更の希望</h2><div class="tbl"><table class="t"><thead><tr><th>受付</th><th>お名前</th><th>いまの日時</th><th>変更の希望</th><th>届いた日時</th></tr></thead><tbody>
      ${changes.map((r) => `<tr class="click" data-open="${r.no}"><td>${r.no}</td><td>${esc(r.name)} 様</td><td>${choiceText(r.choices[r.pick])}</td><td>${r.change.choices.map(choiceText).join("<br>")}</td><td>${fmtAt(r.change.recv)}</td></tr>`).join("")}
    </tbody></table></div>` : ""}

    <div class="grid2">
      <div><h2>今日の予定</h2><div class="panel"><ul class="list">
        ${today.length ? today.map((b) => `<li${b.no ? ` class="click" data-open="${b.no}" style="cursor:pointer"` : ""}><span class="time">${toTime(b.s)}〜${toTime(b.e)}</span><span class="chip ${b.kind}">${{ rental: "レンタル", lesson: "レッスン", event: "イベント" }[b.kind]}</span><span>${esc(b.label)}</span></li>`).join("") : "<li>予定はありません</li>"}
      </ul></div></div>
      <div><h2>入金待ち</h2><div class="panel"><ul class="list">
        ${unpaid.length ? unpaid.map((r) => `<li class="click" data-open="${r.no}" style="cursor:pointer"><span class="time">${md(r.choices[r.pick].day)}</span><span>${esc(r.name)} 様</span><span style="margin-left:auto">${yen(PRICE[r.choices[r.pick].h])}</span></li>`).join("") : "<li>ありません</li>"}
      </ul></div></div>
    </div>

    <h2>届かなかった連絡</h2>
    ${D().failed.length ? `<div class="tbl"><table class="t"><thead><tr><th>いつ</th><th>宛先</th><th>内容</th><th>理由</th><th></th></tr></thead><tbody>
      ${D().failed.map((f) => `<tr><td>${fmtAt(f.at)}</td><td>${esc(f.to)} 様（${f.how}）</td><td>${f.what}</td><td>${f.why}</td><td><div class="row"><button class="btn" data-resend="${f.id}">送り直す</button><button class="btn" data-phoned="${f.id}">電話で伝えた</button></div></td></tr>`).join("")}
    </tbody></table></div>` : `<p class="note">届かなかった連絡はありません。</p>`}`;
};

let reqFilter = "pending";
const inFilter = (r, k) => k === "all" || r.status === k || (k === "closed" && (r.status === "declined" || r.status === "cancelled")) || (k === "change" && !!r.change);
VIEWS.requests = () => {
  const tabs = [["pending", "承認待ち"], ["change", "変更の希望"], ["confirmed", "入金待ち"], ["paid", "入金済み"], ["closed", "お断り・キャンセル"], ["all", "すべて"]];
  const rows = D().req.filter((r) => inFilter(r, reqFilter)).sort((a, b) => b.recv - a.recv);
  return `
    <h1>レンタルの申込み</h1>
    <div class="row" style="margin-bottom:16px">${tabs.map(([k, l]) => `<button class="btn ${reqFilter === k ? "primary" : ""}" data-rf="${k}">${l}（${D().req.filter((r) => inFilter(r, k)).length}）</button>`).join("")}</div>
    ${rows.length ? `<div class="tbl"><table class="t"><thead><tr><th>受付番号</th><th>受付日時</th><th>お名前</th><th>目的・人数</th><th>日時</th><th>金額</th><th>状態</th></tr></thead><tbody>
      ${rows.map((r) => { const fixed = S.isHeld(r) || (r.status === "cancelled" && r.pick != null); const c = r.choices[fixed ? r.pick : 0]; return `<tr class="click" data-open="${r.no}"><td>${r.no}</td><td>${fmtAt(r.recv)}</td><td>${esc(r.name)} 様</td><td>${esc(r.purpose)}・${r.people}名</td><td>${fixed ? "" : "第1希望 "}${choiceText(c)}${r.choices.length > 1 && r.status === "pending" ? `<br><span class="note">ほか${r.choices.length - 1}件の希望</span>` : ""}</td><td class="num">${yen(PRICE[c.h])}</td><td>${chip(r.status)} ${changeChip(r)} ${waitNote(r)}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<p class="note">この状態の申込みはありません。</p>`}
    <p class="note">行を押すと詳しい内容が開きます。承認すると、お客様に確定のお知らせとお振込みのご案内が自動で届きます。</p>`;
};

let bookFilter = "all";
let movingNo = null;
VIEWS.bookings = () => {
  const rows = D().book.map((b) => ({ ...b, s: S.slot(b.slot) })).filter((b) => b.s && (bookFilter === "all" || b.s.kind === bookFilter)).sort((a, b) => a.s.day - b.s.day || toMin(a.s.start) - toMin(b.s.start));
  const openSlots = (b) => D().slots.filter((s) => s.kind === b.s.kind && s.id !== b.slot && s.day >= 0 && S.booked(s.id) < s.cap).sort((x, y) => x.day - y.day || toMin(x.start) - toMin(y.start));
  return `
    <h1>レッスン・イベントの予約</h1>
    <p class="note">レッスンとイベントは、空きがあればその場で予約が確定します。承認はいりません。お客様はご予約のページから、別の回への変更とキャンセルができます。</p>
    <div class="row" style="margin-bottom:16px">${[["all", "すべて"], ["lesson", "レッスン"], ["event", "イベント"]].map(([k, l]) => `<button class="btn ${bookFilter === k ? "primary" : ""}" data-bf="${k}">${l}</button>`).join("")}</div>
    <div class="tbl"><table class="t"><thead><tr><th>日時</th><th>種類</th><th>内容</th><th>お名前</th><th>予約番号</th><th>初回体験</th><th>状態</th><th></th></tr></thead><tbody>
      ${rows.map((b) => `<tr><td>${md(b.s.day)} ${span(b.s.start, b.s.min)}</td><td><span class="chip ${b.s.kind}">${b.s.kind === "lesson" ? "レッスン" : "イベント"}</span></td><td>${esc(b.s.name)}</td><td>${esc(b.name)} 様</td><td>${b.no}</td><td>${b.trial ? "初回" : ""}</td><td>${b.status === "confirmed" ? '<span class="chip confirmed">確定</span>' : '<span class="chip cancelled">キャンセル</span>'}</td>
        <td>${b.status !== "confirmed" ? "" : movingNo === b.no
          ? `<div class="row"><select id="mv-to" style="width:auto">${openSlots(b).map((s) => `<option value="${s.id}">${md(s.day)} ${s.start} ${esc(s.name)}（あと${s.cap - S.booked(s.id)}）</option>`).join("")}</select><button class="btn primary" data-mvgo="${b.no}">移す</button><button class="btn" data-mvstop>やめる</button></div>`
          : `<div class="row"><button class="btn" data-mv="${b.no}">回を変える</button><button class="btn" data-bcancel="${b.no}">キャンセルにする</button></div>`}</td></tr>`).join("")}
    </tbody></table></div>`;
};

let calMode = "week";
let weekStart = 0;
let monthStart = 0;
function calItems() {
  const items = S.busy().map((b) => ({ ...b }));
  D().req.filter((r) => r.status === "pending").forEach((r) => r.choices.forEach((c, i) => items.push({ day: c.day, s: toMin(c.start), e: toMin(c.start) + c.h * 60, kind: "rental", pending: true, label: `第${i + 1}希望 ${r.name} 様`, no: r.no })));
  D().req.filter((r) => r.change).forEach((r) => r.change.choices.forEach((c) => items.push({ day: c.day, s: toMin(c.start), e: toMin(c.start) + c.h * 60, kind: "rental", pending: true, label: `変更の希望 ${r.name} 様`, no: r.no })));
  return items;
}
VIEWS.calendar = () => {
  const items = calItems();
  const head = `
    <h1>カレンダー</h1>
    <div class="row" style="margin-bottom:16px">
      <button class="btn ${calMode === "month" ? "primary" : ""}" data-calmode="month">月</button><button class="btn ${calMode === "week" ? "primary" : ""}" data-calmode="week">週</button>
      <span style="width:16px"></span>
      ${calMode === "week"
        ? `<button class="btn" data-week="-7">前の週</button><button class="btn" data-week="0">今日から</button><button class="btn" data-week="7">次の週</button><span class="note" style="margin-left:8px">${md(weekStart)}〜${md(weekStart + 6)}</span>`
        : `<button class="btn" data-month="-35">前へ</button><button class="btn" data-month="0">今日を含む週から</button><button class="btn" data-month="35">次へ</button>`}
      <button class="btn" data-ics-all style="margin-left:auto">カレンダーアプリに書き出す（.ics）</button>
    </div>
    <div class="legend"><span><span class="chip rental">レンタル</span></span><span><span class="chip lesson">レッスン</span></span><span><span class="chip event">イベント</span></span><span>点線＝承認待ち・変更の希望</span><span>斜線＝休業日</span></div>`;
  const foot = `
    <div class="panel" style="margin-top:16px">
      <p style="margin:0 0 8px;font-weight:700">ふだん使っているカレンダーで見る</p>
      <p class="note" style="margin:0">本番では、予定をオーナー様の Google カレンダー（スマホのカレンダー）にも自動で出します。やり方は2つあり、どちらにするかは ${todo("※要相談")}。1つは、カレンダーに「購読用のURL」を1回登録しておく方法（見るだけ。反映に数時間かかることがある）。もう1つは、予約が入るたびに Google カレンダーへ予定を書き込む方法（すぐ反映。Google との連携の設定が要る）。モックでは、いまの予定を .ics ファイルに書き出して、カレンダーアプリに読み込めます。</p>
    </div>`;
  if (calMode === "month") return head + monthGrid(items) + `<p class="note">日にちを押すと、その週の時間ごとの表が開きます。</p>` + foot;
  const days = [...Array(7)].map((_, i) => weekStart + i);
  const px = (min) => ((Math.min(Math.max(min, 540), 1260) - 540) / 60) * 52;
  const col = (d) => {
    const closed = D().closed.find((c) => c.day === d);
    const evs = items.filter((b) => b.day === d && b.kind !== "closed").map((b) => {
      const style = `top:${px(b.s)}px;height:${Math.max(px(b.e) - px(b.s), 18)}px;${b.pending ? "left:42%;" : ""}`;
      return `<div class="ev ${b.kind}${b.pending ? " pending" : ""}" style="${style}" ${b.no ? `data-open="${b.no}" role="button" tabindex="0"` : b.id ? `data-slotinfo="${b.id}" role="button" tabindex="0"` : ""}><b>${toTime(b.s)}</b> ${esc(b.label)}</div>`;
    }).join("");
    return `<div class="col${closed ? " off" : ""}">${closed ? `<div class="ev" style="top:8px;height:auto;border-color:var(--c-ink-muted)">休業日<br>${esc(closed.reason)}</div>` : ""}${evs}</div>`;
  };
  return head + `
    <div class="tbl" style="border:0">
      <div class="cal">
        <div class="h"></div>${days.map((d) => `<div class="h">${md(d)}</div>`).join("")}
        <div class="times">${[...Array(13)].map((_, i) => `<span style="top:${i * 52}px">${9 + i}:00</span>`).join("")}</div>
        ${days.map(col).join("")}
      </div>
    </div>
    <p class="note">レンタルの枠を押すと申込みの内容が、レッスンの枠を押すと予約した方の一覧が開きます。</p>` + foot;
};
function monthGrid(items) {
  const startDow = S.dayOf(monthStart).getDay();
  const first = monthStart - startDow;
  const cells = [...Array(35)].map((_, i) => first + i).map((d) => {
    const closed = D().closed.find((c) => c.day === d);
    const list = items.filter((b) => b.day === d && b.kind !== "closed").sort((a, b) => a.s - b.s);
    const dt = S.dayOf(d);
    return `<div class="mday${d < 0 ? " past" : ""}${d === 0 ? " today" : ""}${closed ? " off" : ""}" data-gotoweek="${d}" role="button" tabindex="0">
      <span class="dn">${dt.getDate() === 1 || d === first ? `${dt.getMonth() + 1}/` : ""}${dt.getDate()}</span>
      ${closed ? `<span class="mi">休業日</span>` : ""}
      ${list.slice(0, 4).map((b) => `<span class="mi ${b.kind}${b.pending ? " pending" : ""}">${toTime(b.s)} ${esc(b.label.replace(/ 様$/, ""))}</span>`).join("")}
      ${list.length > 4 ? `<span class="mi more">ほか${list.length - 4}件</span>` : ""}</div>`;
  }).join("");
  return `<div class="tbl" style="border:0"><div class="mgrid">${S.WD.map((w) => `<div class="h">${w}</div>`).join("")}${cells}</div></div>`;
}

const dayOptions = (n, sel) => [...Array(n)].map((_, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${md(i)}</option>`).join("");
const timeOptions = (from, to, sel) => { let o = ""; for (let m = from * 60; m <= to * 60; m += 30) o += `<option ${toTime(m) === sel ? "selected" : ""}>${toTime(m)}</option>`; return o; };

let slotRange = 14;
VIEWS.slots = () => {
  const list = [...D().slots].filter((s) => s.day >= 0 && s.day < slotRange).sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
  const who = (s) => D().book.filter((b) => b.slot === s.id && b.status === "confirmed").map((b) => `${esc(b.name)}${b.trial ? "（初回）" : ""}`).join("、");
  return `
    <h1>枠と定員・休業日</h1>
    <h2 style="margin-top:0">レッスン・イベントの枠</h2>
    <div class="row" style="margin-bottom:12px"><span class="note">表示：</span>${[[14, "2週間"], [42, "6週間"]].map(([n, l]) => `<button class="btn ${slotRange === n ? "primary" : ""}" data-range="${n}">${l}</button>`).join("")}</div>
    <div class="tbl"><table class="t"><thead><tr><th>日時</th><th>種類</th><th>名前</th><th>定員</th><th>予約</th><th>予約した方</th><th></th></tr></thead><tbody>
      ${list.map((s) => { const n = S.booked(s.id); return `<tr><td>${md(s.day)} ${span(s.start, s.min)}</td><td><span class="chip ${s.kind}">${s.kind === "lesson" ? "レッスン" : "イベント"}</span></td><td>${esc(s.name)}</td>
        <td><input type="number" min="${Math.max(n, 1)}" max="30" value="${s.cap}" data-cap="${s.id}" style="width:5em" aria-label="${md(s.day)} ${s.start} の定員">名</td>
        <td>${n}名${n >= s.cap ? '　<span class="chip declined">満席</span>' : ""}</td><td style="white-space:normal;font-size:13px">${who(s) || '<span class="note">まだいません</span>'}</td>
        <td><button class="btn danger" data-delslot="${s.id}" ${n ? "disabled title=\"予約が入っている枠は消せません\"" : ""}>消す</button></td></tr>`; }).join("")}
    </tbody></table></div>
    <p class="note">定員は、いまの予約の人数より少なくはできません。変えるとすぐ、ご予約のページの「あと○名」に反映します。予約が入っている枠は消せません。お客様に連絡して、予約をキャンセルにしてから消します。</p>

    <div class="panel" style="margin-top:16px">
      <p style="margin:0 0 12px;font-weight:700">枠を足す</p>
      <div class="grid4">
        <div><label class="f" for="ns-kind">種類</label><select id="ns-kind"><option value="semi">セミパーソナル（60分・定員5名）</option><option value="personal">パーソナル（50分・1名）</option><option value="event">イベント（120分）</option></select></div>
        <div><label class="f" for="ns-day">日付</label><select id="ns-day">${dayOptions(42, 3)}</select></div>
        <div><label class="f" for="ns-start">開始</label><select id="ns-start">${timeOptions(9, 19, "10:00")}</select></div>
        <div><button class="btn primary" id="ns-add" type="button">この枠を足す</button></div>
      </div>
      <p class="note hidden" id="ns-err" style="color:var(--c-danger)"></p>
      <p class="note">毎週同じ曜日・時間に枠をまとめて作る機能は、本番で作ります。${todo("※時間割の決め方を確認中")}</p>
    </div>

    <h2>休業日</h2>
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
};

let openMail = null;
VIEWS.mails = () => {
  const tomorrow = [];
  D().req.filter((r) => S.isHeld(r) && r.choices[r.pick].day === 1).forEach((r) => tomorrow.push({ to: r.name, what: `レンタル ${span(r.choices[r.pick].start, r.choices[r.pick].h * 60)}`, kind: "reminder_rental", args: [r] }));
  D().book.filter((b) => b.status === "confirmed").forEach((b) => { const s = S.slot(b.slot); if (s && s.day === 1) tomorrow.push({ to: b.name, what: `${s.name} ${span(s.start, s.min)}`, kind: "reminder_lesson", args: [b, s] }); });
  const sent = [...D().mails].sort((a, b) => b.at - a.at).slice(0, 60);
  const AUTO = [
    ["レンタルの申込みが届いたとき", "お客様", "メール", "受付のお知らせ（まだ確定していないこと、受付番号）"],
    ["レンタルの申込みが届いたとき", "オーナー様", "LINE", "新しい申込みのお知らせ"],
    ["承認したとき", "お客様", "メール（希望者にはLINEも）", "確定のお知らせと、振込先・期限"],
    ["お断りしたとき", "お客様", "メール", "お断りのお知らせと理由"],
    ["入金を記録したとき", "お客様", "メール", "入金確認のお知らせ"],
    ["日時の変更の希望が届いたとき", "お客様・オーナー様", "メール・LINE", "受付のお知らせ／変更の希望のお知らせ"],
    ["変更を承認・お断りしたとき", "お客様", "メール", "変更後の日時、またはいまの予約のままであること"],
    ["ピラティスの予約・変更・キャンセル", "お客様・オーナー様", "メール・LINE", "確定・変更・キャンセルのお知らせ"],
    ["キャンセルしたとき", "お客様・オーナー様", "メール・LINE", "キャンセルの受付とキャンセル料"],
    ["ご利用日の前日 18:00", "お客様", "メール（希望者にはLINE）", "場所・入り方・持ち物のご案内"],
    ["毎朝 7:00", "オーナー様", "LINE", "今日の予定と、承認待ちの数"],
  ];
  return `
    <h1>お客様へのお知らせ</h1>
    <p class="note">予約が入ったとき、確定したとき、変わったときに、自動でお知らせを送ります。モックなので実際には送らず、送る文面をここに残しています。文面の ○ のところ（振込先、住所、入り方、キャンセル料のきまりなど）は ${todo("※要確認")}。</p>
    <h2>自動で送るもの</h2>
    <div class="tbl"><table class="t"><thead><tr><th>いつ</th><th>だれに</th><th>どうやって</th><th>内容</th></tr></thead><tbody>
      ${AUTO.map((a) => `<tr><td>${a[0]}</td><td>${a[1]}</td><td>${a[2]}</td><td style="white-space:normal">${a[3]}</td></tr>`).join("")}
    </tbody></table></div>

    <h2>明日の分の前日のお知らせ（今日の18:00に送ります）</h2>
    ${tomorrow.length ? `<div class="tbl"><table class="t"><thead><tr><th>宛先</th><th>予約</th><th></th></tr></thead><tbody>
      ${tomorrow.map((t, i) => `<tr><td>${esc(t.to)} 様</td><td>${esc(t.what)}</td><td><button class="btn" data-preview="${i}">文面を見る</button></td></tr>`).join("")}
    </tbody></table></div><div id="pv-box"></div>` : `<p class="note">明日の予約はありません。</p>`}

    <h2>送ったお知らせ（新しい順）</h2>
    <div class="tbl"><table class="t"><thead><tr><th>日時</th><th>宛先</th><th>手段</th><th>件名・内容</th></tr></thead><tbody>
      ${sent.map((m) => `<tr class="click" data-mail="${m.id}"><td>${fmtAt(m.at)}</td><td>${esc(m.to)}${m.kind === "owner" ? "" : " 様"}</td><td>${m.how}</td><td style="white-space:normal">${esc(m.kind === "owner" ? m.body : m.subject)}${openMail === m.id && m.kind !== "owner" ? `<pre class="mailpre">${esc(m.body)}</pre>` : ""}</td></tr>`).join("")}
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
    <p style="margin:0 0 12px;font-weight:700">レンタルの料金（税込の総額）</p>
    <div class="grid4">${Object.entries(PRICE).map(([h, p]) => `<div><label class="f" for="pr-${h}">${h}時間</label><input id="pr-${h}" type="number" step="100" value="${p}"></div>`).join("")}</div>
    <p class="note">いまの料金は、2027年3月31日までのお申込みのキャンペーン価格です。4月からの料金は ${todo("※要確認")}。撮影の料金を分けるかも ${todo("※要確認")}</p>
    <button class="btn primary" type="button" data-save>料金を保存する</button>
  </div>

  <div class="panel">
    <p style="margin:0 0 12px;font-weight:700">受付のきまり</p>
    <div class="grid2">
      <div><label class="f" for="st-open">ご利用時間</label><div class="row"><select id="st-open" style="width:auto">${timeOptions(7, 12, "9:00")}</select>〜<select style="width:auto" aria-label="ご利用時間の終わり">${timeOptions(17, 23, "21:00")}</select></div></div>
      <div><label class="f" for="st-dead">レンタルの申込みの締め切り</label><select id="st-dead"><option>利用日の2日前まで</option><option selected>利用日の3日前まで</option><option>利用日の7日前まで</option></select></div>
      <div><label class="f" for="st-far">レンタルを何日先まで受けるか</label><select id="st-far"><option>30日先まで</option><option selected>60日先まで</option><option>90日先まで</option></select></div>
      <div><label class="f" for="st-reply">お返事の目安（お客様に表示）</label><select id="st-reply"><option selected>24時間以内</option><option>48時間以内</option></select></div>
      <div><label class="f" for="st-cancel">レンタルのキャンセル料</label><select id="st-cancel"><option selected>利用日の7日前から全額</option><option>利用日の3日前から全額</option></select></div>
      <div><label class="f" for="st-ldead">レッスンの予約の締め切り</label><select id="st-ldead"><option>開始の1時間前まで</option><option selected>開始の3時間前まで</option><option>前日まで</option></select></div>
      <div><label class="f" for="st-change">お客様ができる変更</label><select id="st-change"><option selected>レンタルは変更の希望を送る（承認制）、レッスンは空きがあればその場で変更</option><option>変更はお問い合わせから</option></select></div>
    </div>
    <p class="note">何日先まで受けるか、レッスンとイベントのキャンセル料、お支払い方法は ${todo("※要確認")}</p>
    <button class="btn primary" type="button" data-save>保存する</button>
  </div>

  <div class="panel">
    <p style="margin:0 0 12px;font-weight:700">オーナー様への連絡</p>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" checked> 新しい申込み・変更の希望・キャンセルが来たら、LINEでお知らせする</label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" checked> 毎朝7時に、今日の予定と承認待ちの数をLINEで送る</label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" checked> お客様への連絡が届かなかったら、メールでお知らせする</label>
    <button class="btn primary" type="button" data-save style="margin-top:12px">保存する</button>
  </div>

  <div class="panel">
    <p style="margin:0 0 8px;font-weight:700">ログインとお客様の情報</p>
    <p class="note" style="margin:0">本番では、ログインにパスワードとスマホの認証アプリ（2段階認証）を使います。ログインできるのはオーナー様だけです。お客様の名前や連絡先を残しておく期間は ${todo("※要確認")}（例：ご利用日から1年で消す）。</p>
  </div>`;

// ---- 申込みの詳しい内容（右から出る） ------------------------------------
let openNo = null;
let declining = false;
let cancelling = false;
function renderDetail() {
  let box = document.querySelector(".detail");
  const r = openNo ? S.req(openNo) : null;
  if (!r) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement("aside"); box.className = "detail"; box.setAttribute("aria-label", "申込みの内容"); document.body.appendChild(box); }
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
  box.innerHTML = `
    <button class="btn close" type="button" data-close>閉じる</button>
    <p style="margin:0">${chip(r.status)} ${changeChip(r)} ${waitNote(r)}</p>
    <h3>${esc(r.name)} 様</h3>
    <dl>
      <dt>受付番号</dt><dd>${r.no}（${fmtAt(r.recv)} 受付）</dd>
      <dt>ふりがな</dt><dd>${esc(r.kana)}</dd>
      <dt>電話</dt><dd>${esc(r.tel)}</dd>
      <dt>メール</dt><dd>${esc(r.mail)}</dd>
      <dt>目的・人数</dt><dd>${esc(r.purpose)}・${r.people}名</dd>
      <dt>あてはまる</dt><dd>${r.flags.length ? r.flags.map(esc).join("、") : "なし"}</dd>
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
  $("memo").addEventListener("change", (e) => { r.memo = e.target.value; S.save(); });
}
function openReq(no) { openNo = no; declining = false; cancelling = false; renderDetail(); }

// レッスンの枠を押したときの、予約した方の一覧
function slotInfo(id) {
  const s = S.slot(id);
  if (!s) return;
  const list = D().book.filter((b) => b.slot === id && b.status === "confirmed");
  toast(`${md(s.day)} ${span(s.start, s.min)} ${s.name}：${list.length ? list.map((b) => `${b.name}${b.trial ? "（初回）" : ""}`).join("、") : "まだ予約はありません"}（定員${s.cap}名）`);
}

// ---- 動き --------------------------------------------------------------
function render() {
  S.save();
  const view = (location.hash || "#dashboard").slice(1);
  const v = VIEWS[view] ? view : "dashboard";
  document.querySelectorAll(".side a").forEach((a) => a.classList.toggle("on", a.dataset.view === v));
  $("main").innerHTML = VIEWS[v]();
  updateBadge();
  renderDetail();
}
window.addEventListener("hashchange", () => { openNo = null; render(); });

document.addEventListener("click", (e) => {
  const t = e.target.closest("button, [data-open], [data-gotoweek], [data-slotinfo], [data-mail]");
  if (!t) return;
  const d = t.dataset;
  const r = openNo ? S.req(openNo) : null;

  if (d.open) return openReq(d.open);
  if (d.slotinfo) return slotInfo(d.slotinfo);
  if ("close" in d) { openNo = null; return renderDetail(); }

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
  if ("chgno" in d) {
    S.mail("rental_change_declined", r, [r]);
    r.change = null;
    toast(`変更をお断りしました。${r.name} 様にお知らせを送りました（モック）`);
    return render();
  }
  if ("decline" in d) { declining = true; return renderDetail(); }
  if ("declineCancel" in d) { declining = false; return renderDetail(); }
  if ("declineSend" in d) {
    r.status = "declined"; r.reason = $("dc-reason").value; declining = false;
    S.mail("rental_declined", r, [r]);
    toast(`${r.name} 様にお断りのメールを送りました（モック）`);
    return render();
  }
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

  if (d.resend || d.phoned) {
    D().failed = D().failed.filter((f) => f.id !== (d.resend || d.phoned));
    toast(d.resend ? "送り直しました（モック）" : "電話で伝えた、と記録しました");
    return render();
  }
  if (d.rf) { reqFilter = d.rf; return render(); }
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
    const to = S.slot($("mv-to").value);
    if (!to || S.booked(to.id) >= to.cap) return toast("その回は満席です。");
    const before = { ...S.slot(b.slot) };
    b.slot = to.id; movingNo = null;
    S.mail("lesson_changed", b, [b, to, before]);
    toast(`${b.name} 様の予約を ${md(to.day)} ${to.start} に移しました。お客様にお知らせを送りました（モック）`);
    return render();
  }
  if (d.calmode) { calMode = d.calmode; return render(); }
  if (d.week !== undefined) { weekStart = Number(d.week) === 0 ? 0 : weekStart + Number(d.week); return render(); }
  if (d.month !== undefined) { monthStart = Number(d.month) === 0 ? 0 : monthStart + Number(d.month); return render(); }
  if (d.gotoweek !== undefined) { weekStart = Number(d.gotoweek); calMode = "week"; return render(); }
  if ("icsAll" in d) {
    const evs = S.busy().filter((b) => b.kind !== "closed" && b.day >= 0).map((b) => ({ day: b.day, s: b.s, e: b.e, title: `結び家SUI ${b.label}`, uid: `${b.kind}-${b.no || b.id}-${b.day}` }));
    S.download("musubiya-sui-yoyaku.ics", S.ics(evs));
    return toast(`${evs.length}件の予定を書き出しました。カレンダーアプリで読み込めます`);
  }
  if (d.range) { slotRange = Number(d.range); return render(); }
  if (d.mail) { openMail = openMail === d.mail ? null : d.mail; return render(); }
  if (d.preview !== undefined) {
    const list = [];
    D().req.filter((x) => S.isHeld(x) && x.choices[x.pick].day === 1).forEach((x) => list.push(["reminder_rental", [x]]));
    D().book.filter((b) => b.status === "confirmed").forEach((b) => { const s = S.slot(b.slot); if (s && s.day === 1) list.push(["reminder_lesson", [b, s]]); });
    const [kind, args] = list[Number(d.preview)];
    const before = D().mails.length;
    const m = S.mail(kind, args[0], args);
    D().mails.splice(before, 1); // 文面を見るだけなので、送った記録には残さない
    $("pv-box").innerHTML = `<div class="panel" style="margin-top:12px"><p style="margin:0 0 8px;font-weight:700">${esc(m.subject)}</p><pre class="mailpre">${esc(m.body)}</pre></div>`;
    return;
  }

  if (t.id === "ns-add") {
    const kinds = { semi: ["lesson", "セミパーソナル", 60, 5], personal: ["lesson", "パーソナル", 50, 1], event: ["event", "イベント（名前は後で）", 120, 8] };
    const [kind, name, min, cap] = kinds[$("ns-kind").value];
    const day = Number($("ns-day").value), start = $("ns-start").value;
    const err = $("ns-err");
    if (toMin(start) + min > 21 * 60) { err.textContent = "21:00を過ぎてしまいます。"; return err.classList.remove("hidden"); }
    const hit = S.conflict(day, start, min);
    if (hit) { err.textContent = `${md(day)} は ${hit.label} と重なります。`; return err.classList.remove("hidden"); }
    D().slots.push({ id: `S${Date.now()}`, kind, day, start, min, name, cap });
    toast(`${md(day)} ${start} の枠を足しました。ご予約のページにすぐ出ます（モック）`);
    return render();
  }
  if (d.delslot) { D().slots = D().slots.filter((s) => s.id !== d.delslot); toast("枠を消しました"); return render(); }
  if (t.id === "nc-add") {
    const day = Number($("nc-day").value);
    const reason = $("nc-reason").value.trim() || "お休み";
    const err = $("nc-err");
    const hit = S.busy().find((b) => b.day === day);
    if (hit) { err.textContent = `${md(day)} には ${hit.label} が入っています。先にお客様と調整してください。`; return err.classList.remove("hidden"); }
    D().closed.push({ day, reason });
    toast(`${md(day)} を休業日にしました。ご予約のページでは「お休み」になります`);
    return render();
  }
  if (d.delclosed) { D().closed = D().closed.filter((c) => c.day !== Number(d.delclosed)); toast("休業日を取り消しました"); return render(); }

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
  if (t.id === "demo-reset") { S.reset(); openNo = null; toast("見本のデータに戻しました"); return render(); }
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
    toast(v === Number(el.value) ? `${md(s.day)} ${s.start} の定員を${v}名にしました。ご予約のページにすぐ反映します` : `いまの予約が${n}名なので、定員は${v}名にしました`);
    render();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openNo) { openNo = null; renderDetail(); }
  if (e.key === "Enter" && e.target.matches("[data-open]")) openReq(e.target.dataset.open);
  if (e.key === "Enter" && e.target.matches("[data-gotoweek]")) { weekStart = Number(e.target.dataset.gotoweek); calMode = "week"; render(); }
});
// ご予約のページ（別のタブ）でデータが変わったら描き直す
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
  openNo = null; renderDetail();
  $("app").classList.add("hidden"); $("login").classList.remove("hidden");
});
try { if (sessionStorage.getItem("sui-admin") === "1") enter(); } catch (_) {}

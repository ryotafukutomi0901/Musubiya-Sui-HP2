// スペースを借りる（reserve-rental.html）。日時を選ぶ → 内容を入れる → 確かめる → 送信完了 の4段。
const { S, $, esc, yen, PRICE, params, RentalPicker, mailHtml, setWizard, requireFields } = window.BK;

let step = 1;
const bar = $("bar");
document.body.classList.add("has-bk-bar");

function go(n) {
  step = n;
  [1, 2, 3, 4].forEach((k) => $(`st${k}`).classList.toggle("hidden", k !== n));
  setWizard($("wiz"), n);
  updateBar();
  $("wiz").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- 1 日時を選ぶ ----
// onChange は作る途中にも呼ばれるので、選んだ一覧を引数で受け取る（picker がまだないときに触らない）
const picker = RentalPicker($("r-picker"), { max: 3, onChange: (list) => updateBar(list) });
function updateBar(list = picker.choices) {
  bar.classList.toggle("on", step === 1);
  $("bar-next").disabled = !list.length;
  $("bar-sum").innerHTML = list.length
    ? `<b>希望 ${list.length}/3</b>　第1希望 ${S.whenText(list[0])}　${yen(PRICE[list[0].h])}<span class="sub">${list.length > 1 ? `ほか ${list.slice(1).map((c) => S.whenText(c)).join("、")}` : "ほかの日でもよければ、あと2つまで希望を足せます"}</span>`
    : `<b>日時を選んでください</b><span class="sub">カレンダーの ○ か △ の日を押して、時刻と時間を選びます</span>`;
}
$("bar-next").addEventListener("click", () => {
  const taken = picker.choices.filter((c) => S.conflict(c.day, c.start, c.h * 60));
  if (taken.length) {
    $("st1-err").textContent = `${taken.map((c) => S.whenText(c)).join("、")} は、ほかのご予約が入ってしまいました。外して選び直してください。`;
    return $("st1-err").classList.remove("hidden");
  }
  $("st1-err").classList.add("hidden");
  $("st2-sum").textContent = picker.choices.map((c, i) => `第${i + 1}希望 ${S.whenText(c)}`).join("　");
  go(2);
});

// ---- 2 内容を入れる ----
// 利用シーンのページから来たときは、目的を選んでおく
const PURPOSE = { "yoga-pilates": "ヨガ・ピラティス", class: "教室・レッスン", workshop: "ワークショップ", marche: "マルシェ", photo: "撮影", community: "交流会" };
if (PURPOSE[params.get("purpose")]) $("r-purpose").value = PURPOSE[params.get("purpose")];

const fields = () => ({ name: $("r-name").value.trim(), kana: $("r-kana").value.trim(), tel: $("r-tel").value.trim(), mail: $("r-mail").value.trim(), purpose: $("r-purpose").value, people: Number($("r-people").value) || 1 });
$("to3").addEventListener("click", () => {
  const missing = requireFields([["r-name", "お名前"], ["r-kana", "ふりがな"], ["r-tel", "電話番号"], ["r-mail", "メールアドレス"], ["r-purpose", "ご利用の目的"]]);
  const msgs = [];
  if (missing.length) msgs.push(`${missing.join("、")}を入れてください。`);
  if ($("r-tel").value && S.digits($("r-tel").value).length < 10) { msgs.push("電話番号は10桁か11桁で入れてください。"); $("r-tel").setAttribute("aria-invalid", "true"); }
  if (!$("r-agree").checked) msgs.push("利用規約への同意が必要です。");
  $("st2-err").textContent = msgs.join(" ");
  $("st2-err").classList.toggle("hidden", !msgs.length);
  if (msgs.length) return;
  const f = fields();
  const rows = picker.choices.map((c, k) => `<tr><th scope="row">第${k + 1}希望</th><td>${S.whenText(c)}</td><td class="num">${yen(PRICE[c.h])}</td></tr>`).join("");
  $("r-summary").innerHTML = `<table class="t"><tbody>${rows}
    <tr><th scope="row">お名前</th><td colspan="2">${esc(f.name)}（${esc(f.kana)}）</td></tr>
    <tr><th scope="row">ご連絡先</th><td colspan="2">${esc(f.tel)}／${esc(f.mail)}</td></tr>
    <tr><th scope="row">目的と人数</th><td colspan="2">${esc(f.purpose)}、${f.people}名</td></tr></tbody></table>
    <p class="note" style="margin-top:12px">承認した希望の料金をお支払いいただきます。ご利用日の7日前からのキャンセルは、料金の全額をいただきます。</p>`;
  go(3);
});
document.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) go(Number(b.dataset.go)); });

// ---- 3 → 4 申し込む ----
$("r-submit").addEventListener("click", () => {
  const f = fields();
  const r = { no: S.code(), recv: Date.now(), status: "pending", ...f, note: $("r-desc").value.trim(), flags: [...document.querySelectorAll("#r-flags input:checked")].map((x) => x.value), found: $("r-know").value || "（未回答）", line: $("r-line").checked, choices: picker.choices.map((c) => ({ ...c })) };
  S.db.req.push(r);
  const m = S.mail("rental_received", r, [r]);
  S.owner("new_rental", [r]);
  S.save();
  S.addMine("rental", r.no);
  $("r-no").textContent = r.no;
  $("r-check").href = `reserve-check.html?type=rental&no=${r.no}`;
  $("r-mail-box").innerHTML = mailHtml(m);
  go(4);
});
$("r-again").addEventListener("click", () => { picker.clear(); go(1); });

window.addEventListener("storage", (e) => { if (e.key && !e.key.startsWith("sui-mock")) return; S.reload(); picker.refresh(); });
updateBar();

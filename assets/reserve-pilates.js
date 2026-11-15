// ピラティスを予約する（reserve-pilates.html）。回を選ぶ → お名前と連絡先 → 予約の確定 の3段。
const { S, $, jd, span, toMin, params, LessonPicker, slotState, lessonPrice, mailHtml, addCalHtml, setWizard, requireFields } = window.BK;

let step = 1;
let menu = "all";
let chosen = null;
// ピラティスのページの「体験を予約する」から来たときは、体験の料金で見せる
$("trial").checked = params.get("trial") === "1";
if (params.get("menu") && ["セミパーソナル", "パーソナル"].includes(params.get("menu"))) menu = params.get("menu");

function go(n) {
  step = n;
  [1, 2, 3].forEach((k) => $(`st${k}`).classList.toggle("hidden", k !== n));
  setWizard($("wiz"), n);
  $("wiz").scrollIntoView({ behavior: "smooth", block: "start" });
}

const picker = LessonPicker($("l-picker"), {
  filter: () => (menu === "all" ? null : (s) => s.name === menu),
  trial: () => $("trial").checked,
  onPick: (s) => {
    chosen = s;
    $("l-first").checked = $("trial").checked;
    $("st2-sum").textContent = `${s.name}　${jd(s.day)} ${span(s.start, s.min)}`;
    showPrice();
    $("st2-err").classList.add("hidden");
    go(2);
  },
});
const drawChips = () => document.querySelectorAll("[data-menu]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.menu === menu));
document.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => { menu = b.dataset.menu; drawChips(); picker.reset(); }));
$("trial").addEventListener("change", () => picker.refresh());
drawChips();
picker.reset();

const showPrice = () => { if (chosen) $("l-price").textContent = lessonPrice(chosen, $("l-first").checked); };
$("l-first").addEventListener("change", showPrice);
document.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) go(Number(b.dataset.go)); });

$("l-submit").addEventListener("click", () => {
  const missing = requireFields([["l-name", "お名前"], ["l-kana", "ふりがな"], ["l-tel", "電話番号"], ["l-mail", "メールアドレス"]]);
  const msgs = [];
  if (missing.length) msgs.push(`${missing.join("、")}を入れてください。`);
  if (!$("l-agree").checked) msgs.push("お支払いとキャンセルのきまりへの同意が必要です。");
  if (chosen && !slotState(chosen).ok) msgs.push("この回は、いま満席になりました。回を選び直してください。");
  $("st2-err").textContent = msgs.join(" ");
  $("st2-err").classList.toggle("hidden", !msgs.length);
  if (msgs.length) return;
  const v = (id) => $(id).value.trim();
  const b = { no: S.code(), slot: chosen.id, name: v("l-name"), kana: v("l-kana"), tel: v("l-tel"), mail: v("l-mail"), trial: $("l-first").checked, note: v("l-body"), status: "confirmed", recv: Date.now() };
  S.db.book.push(b);
  const m = S.mail("lesson_confirmed", b, [b, chosen]);
  S.owner("new_lesson", [b, chosen]);
  S.save();
  S.addMine("lesson", b.no);
  $("l-no").textContent = b.no;
  $("l-done-txt").textContent = `${chosen.name}　${jd(chosen.day)} ${span(chosen.start, chosen.min)}　${S.lessonPriceText(chosen, b.trial)}`;
  $("l-addcal").innerHTML = addCalHtml(`結び家SUI ${chosen.name}`, chosen.day, toMin(chosen.start), toMin(chosen.start) + chosen.min, b.no);
  $("l-check").href = `reserve-check.html?type=pilates&no=${b.no}`;
  $("l-mail-box").innerHTML = mailHtml(m);
  picker.refresh();
  go(3);
});
$("l-again").addEventListener("click", () => { chosen = null; picker.refresh(); go(1); });

window.addEventListener("storage", (e) => { if (e.key && !e.key.startsWith("sui-mock")) return; S.reload(); picker.refresh(); });

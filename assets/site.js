// 結び家SUI モック（2案目） 共通部品：ヘッダー、全画面メニュー、フッター、写真の帯の誘い
// 各ページの <div data-include="header"></div> と <div data-include="footer"></div> に差し込む。
// ページの分け方と文章は1案目（Musubiya-Sui-HP）と同じ。見た目と並べ方だけを変えている。
const NAV = [
  ["index.html", "ホーム"],
  ["space.html", "スペース"],
  ["scenes.html", "利用シーン"],
  ["price.html", "料金"],
  ["guide.html", "ご利用案内"],
  ["pilates.html", "ピラティス"],
  ["reserve.html", "ご予約"],
  ["contact.html", "利用の相談"],
];
const IG_URL = "https://www.instagram.com/sui_musubiya/";
const LINE_URL = "https://lin.ee/OCzLIhO";
const ICON_IG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg>';
const ICON_LINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 4C7 4 3 7.2 3 11.2c0 3.5 3.1 6.4 7.3 7l-.6 2.6 3.4-2.5c4.8-.4 7.9-3.4 7.9-7.1C21 7.2 17 4 12 4Z"/></svg>';

const here = location.pathname.split("/").pop() || "index.html";

function header() {
  // 縦書きのメニューは左から右へ読む順に並べ、いちばん右に「利用の相談」が来る
  const v = NAV.slice(1).map(([href, label]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  const items = NAV.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("");
  return `
  <header class="hd">
    <a class="hd-logo" href="index.html"><small>古民家レンタルスペース</small>結び家SUI</a>
    <nav class="hd-vnav" aria-label="主なページ">${v}</nav>
    <a class="hd-cta" href="contact.html">利用の相談</a>
    <button class="hd-menu" type="button" aria-label="メニューを開く" aria-expanded="false"><span></span></button>
  </header>
  <div class="nav-overlay" role="dialog" aria-modal="true" aria-label="サイト内のページ">
    <div class="ph photo gen" style="background-image:url(assets/img/gen/contact-top.webp)" data-label=""></div>
    <button class="nav-close" type="button" aria-label="メニューを閉じる">×</button>
    <div class="inner">
      <p class="catch">民家の小さな空間から、<br>人と人がつながる場所を。</p>
      <ul>${items}</ul>
    </div>
    <div class="sns">
      <a href="${IG_URL}" target="_blank" rel="noopener">${ICON_IG}<span>Instagram</span></a>
      <a href="${LINE_URL}" target="_blank" rel="noopener">${ICON_LINE}<span>公式LINE</span></a>
    </div>
  </div>`;
}

function footer() {
  const nav = NAV.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("");
  return `
  <section class="f-cta" aria-label="利用の相談">
    <div class="ph darker ph-bg photo gen" style="background-image:linear-gradient(rgba(20,18,16,.45),rgba(20,18,16,.45)),url(assets/img/gen/about-band.webp)" data-label="写真：木の床と柱のある部屋（撮影予定）"></div>
    <div class="f-cta-inner">
      <p class="f-cta-lead">あなたのやってみたいを、<br>ここで実現しませんか？</p>
      <div class="f-cta-links">
        <a href="contact.html">利用について相談する<small>こんな使い方はできる？というご相談だけでも</small></a>
        <a href="contact.html?type=visit">見学を申し込む<small>借りる前に、部屋を見てから決めたい方へ</small></a>
        <a href="${LINE_URL}" target="_blank" rel="noopener">公式LINEで相談する<small>@661nckdf</small></a>
      </div>
    </div>
  </section>
  <footer class="ft">
    <div class="ft-main">
      <div>
        <p class="ft-logo"><small>古民家レンタルスペース</small>結び家SUI</p>
        <p class="ft-address">静岡県富士宮市（富士宮駅南口から徒歩圏内・無料駐車場あり）<br>詳しい住所は、お問い合わせいただいた方に個別にお知らせしています。<br>運営：○○ <span class="todo">※要確認</span><br>suimusubiya2026@gmail.com</p>
      </div>
      <ul class="ft-nav">${nav}</ul>
    </div>
    <div class="ft-bottom">
      <ul class="ft-links">
        <li><a href="#">利用規約</a></li>
        <li><a href="#">プライバシーポリシー</a></li>
        <li><a href="#">特定商取引法に基づく表記</a></li>
      </ul>
      <div class="ft-sns">
        <a href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram">${ICON_IG}</a>
        <a href="${LINE_URL}" target="_blank" rel="noopener" aria-label="公式LINE">${ICON_LINE}</a>
      </div>
    </div>
    <p class="copyright">© 古民家レンタルスペース 結び家SUI</p>
  </footer>`;
}

document.querySelectorAll('[data-include="header"]').forEach((el) => (el.outerHTML = header()));
document.querySelectorAll('[data-include="footer"]').forEach((el) => (el.outerHTML = footer()));

// ---- ヘッダー：写真の上は透明、写真を過ぎたら白い帯 ----
const hero = document.querySelector(".mv, .pv");
const hd = document.querySelector(".hd");
if (hero) document.body.classList.add("has-hero");
if (hd) {
  const solid = () => {
    const limit = hero ? hero.offsetHeight - 80 : -1;
    hd.classList.toggle("is-solid", window.scrollY > limit);
  };
  window.addEventListener("scroll", solid, { passive: true });
  window.addEventListener("resize", solid);
  solid();
}

// ---- 全画面メニュー ----
const menuBtn = document.querySelector(".hd-menu");
const closeNav = () => {
  document.body.classList.remove("nav-open");
  if (menuBtn) { menuBtn.setAttribute("aria-expanded", "false"); menuBtn.focus(); }
};
if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    document.body.classList.add("nav-open");
    menuBtn.setAttribute("aria-expanded", "true");
    document.querySelector(".nav-close").focus();
  });
  document.querySelector(".nav-close").addEventListener("click", closeNav);
  document.querySelectorAll(".nav-overlay a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("nav-open")));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("nav-open")) closeNav(); });
}

// ---- スマホの画面下に「利用の相談」と「LINE」 ----
if (!document.body.hasAttribute("data-no-bar")) {
  document.body.insertAdjacentHTML("beforeend", `
  <div class="sp-bar" aria-label="相談の入口">
    <a class="btn primary" href="contact.html">利用の相談</a>
    <a class="btn" href="${LINE_URL}" target="_blank" rel="noopener">LINEで相談</a>
  </div>`);
  document.body.classList.add("has-sp-bar");
  const toggleBar = () => document.body.classList.toggle("sp-bar-on", window.scrollY > 480);
  window.addEventListener("scroll", toggleBar, { passive: true });
  toggleBar();
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- TOP：ことばのまわりの写真を、スクロールに合わせて少しずつずらす ----
const floats = [...document.querySelectorAll(".floats [data-speed]")];
if (floats.length && !reduceMotion) {
  let ticking = false;
  const move = () => {
    const box = document.querySelector(".concept").getBoundingClientRect();
    const p = (window.innerHeight - box.top) / (window.innerHeight + box.height); // 0〜1
    floats.forEach((el) => { el.style.transform = `translateY(${((0.5 - p) * Number(el.dataset.speed)).toFixed(1)}px)`; });
    ticking = false;
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(move); } }, { passive: true });
  move();
}

// ---- TOP：番号つきの一覧。スクロールした量で、いま見せる項目と写真を切り替える ----
const steps = document.querySelector(".steps");
if (steps) {
  const items = [...steps.querySelectorAll(".steps-list li")];
  const photos = [...steps.querySelectorAll(".steps-photos .ph")];
  const track = steps.querySelector(".steps-track");
  const set = (i) => {
    items.forEach((li, k) => li.classList.toggle("on", k === i));
    photos.forEach((ph, k) => ph.classList.toggle("on", k === i));
  };
  const onScroll = () => {
    if (window.innerWidth < 1024) return;
    const r = track.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    const p = Math.min(Math.max(-r.top / Math.max(span, 1), 0), 0.999);
    set(Math.floor(p * items.length));
  };
  items.forEach((li, k) => li.addEventListener("click", (e) => {
    if (e.target.closest("a") || window.innerWidth < 1024) return;
    const r = track.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    window.scrollTo({ top: window.scrollY + r.top + (span * (k + 0.5)) / items.length, behavior: reduceMotion ? "auto" : "smooth" });
  }));
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  set(0); onScroll();
}

// ---- 横に流れるカードの矢印 ----
document.querySelectorAll(".slider").forEach((s) => {
  const track = s.querySelector(".slider-track");
  s.querySelectorAll("[data-dir]").forEach((b) => b.addEventListener("click", () => {
    track.scrollBy({ left: Number(b.dataset.dir) * track.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  }));
});

// 予約モックの共通データ。ご予約のページ（reserve.html）と予約管理（admin/）が同じものを読み書きする。
// データはこのブラウザの localStorage に置くだけで、どこにも送らない。日付が変わると見本のデータに戻る。
// 本番では、保存・二重予約の確認・お客様への連絡はサーバー側で行う（docs/WORK_SCHEDULE.html の「人が書く部分」）。
(function () {
  const KEY = "sui-mock-db-v2";
  const MINE_KEY = "sui-mock-mine-v2";
  const PRICE = { 2: 2000, 3: 3000, 4: 3600, 5: 4500, 6: 5400, 7: 5600, 8: 6400, 9: 7200, 10: 7500, 11: 7700, 12: 8400 };
  const LESSON_PRICE = { "セミパーソナル": [2000, 1000], "パーソナル": [3500, 2000] }; // [通常, 初回体験]。パーソナルは3,500円か3,000円か確認中
  const OPEN = 9 * 60, CLOSE = 21 * 60;
  const RENTAL_FROM = 3, RENTAL_TO = 60; // レンタルの申込みは利用日の3日前まで。何日先まで受けるかは確認中
  const LESSON_TO = 41;
  const WD = ["日", "月", "火", "水", "木", "金", "土"];

  const base = new Date(); base.setHours(0, 0, 0, 0);
  const dayOf = (off) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + off);
  const offOf = (y, m, d) => Math.round((new Date(y, m, d) - base) / 864e5);
  const md = (off) => { const d = dayOf(off); return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`; };
  const jd = (off) => { const d = dayOf(off); return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toTime = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  const span = (start, min) => `${start}〜${toTime(toMin(start) + min)}`;
  const yen = (n) => n.toLocaleString("ja-JP") + "円";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const digits = (s) => String(s).replace(/\D/g, "");
  const code = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
  const whenText = (c) => `${jd(c.day)} ${span(c.start, c.h * 60)}（${c.h}時間）`;
  const STATUS = { pending: "承認待ち", confirmed: "入金待ち", paid: "入金済み", declined: "お断り", cancelled: "キャンセル" };
  const isHeld = (r) => r.status === "confirmed" || r.status === "paid";

  // ---- お客様へのお知らせの文面（見本。○ のところは確認中） ------------------
  const SIGN = "\n\n――\n結び家SUI\n公式LINE：@661nckdf\nこのメールは送信専用です。ご返信は公式LINEかお問い合わせフォームへお願いします。";
  const CHECK_URL = "https://（サイトのドメイン）/reserve.html#status";
  const T = {
    rental_received: (r) => [`【結び家SUI】お申込みを受け付けました（受付番号 ${r.no}）`,
      `${r.name} 様\n\n結び家SUI です。レンタルスペースのお申込みを受け付けました。\nこの時点では、まだご予約は確定していません。内容を確かめて、24時間以内にご連絡します。\n\n受付番号：${r.no}\nご希望の日時：\n${r.choices.map((c, i) => `　第${i + 1}希望　${whenText(c)}　${yen(PRICE[c.h])}`).join("\n")}\nご利用の目的：${r.purpose}（${r.people}名）\n\nお申込みの確認と取り消しは、受付番号とお電話番号でこちらからできます。\n${CHECK_URL}`],
    rental_approved: (r) => { const c = r.choices[r.pick]; return [`【結び家SUI】ご予約が確定しました（受付番号 ${r.no}）`,
      `${r.name} 様\n\nお申込みいただいた日時で、ご予約が確定しました。\n\nご利用日時：${whenText(c)}\n料金：${yen(PRICE[c.h])}（税込）\n\nお支払いは、○月○日までに下の口座へお振り込みください。\n振込先：○○銀行 ○○支店 普通 ○○○○○○○\n\n場所：○○（住所はこのメールでお知らせします）\nキャンセル：ご利用日の7日前からは、料金の全額をいただきます。\n\nご利用日の前日に、あらためてご案内をお送りします。\n${CHECK_URL}`]; },
    rental_declined: (r) => [`【結び家SUI】お申込みについて（受付番号 ${r.no}）`,
      `${r.name} 様\n\nお申込みありがとうございました。申し訳ありませんが、今回はお受けできませんでした。\n理由：${r.reason}\n\nほかの日時でよろしければ、空き状況のページからあらためてお申し込みください。`],
    rental_paid: (r) => [`【結び家SUI】お振込みを確認しました（受付番号 ${r.no}）`,
      `${r.name} 様\n\nお振込みを確認しました。ありがとうございます。\n${whenText(r.choices[r.pick])} のご利用を、お待ちしています。`],
    rental_rechoose: (r) => [`【結び家SUI】ご希望の日時を変更しました（受付番号 ${r.no}）`,
      `${r.name} 様\n\nご希望の日時の変更を受け付けました。まだご予約は確定していません。内容を確かめて、ご連絡します。\n\n${r.choices.map((c, i) => `　第${i + 1}希望　${whenText(c)}　${yen(PRICE[c.h])}`).join("\n")}`],
    rental_change_received: (r) => [`【結び家SUI】日時の変更のご希望を受け付けました（受付番号 ${r.no}）`,
      `${r.name} 様\n\n日時の変更のご希望を受け付けました。変更できるかを確かめて、ご連絡します。\nそれまでは、いまのご予約（${whenText(r.choices[r.pick])}）がそのまま残っています。\n\n新しいご希望：\n${r.change.choices.map((c, i) => `　第${i + 1}希望　${whenText(c)}　${yen(PRICE[c.h])}`).join("\n")}`],
    rental_change_approved: (r, before) => [`【結び家SUI】ご予約の日時を変更しました（受付番号 ${r.no}）`,
      `${r.name} 様\n\nご予約の日時を変更しました。\n\n変更前：${whenText(before)}\n変更後：${whenText(r.choices[r.pick])}\n料金：${yen(PRICE[r.choices[r.pick].h])}（税込）\n\n料金が変わる場合の差額のお支払いやご返金は、○○でご案内します。`],
    rental_change_declined: (r) => [`【結び家SUI】日時の変更について（受付番号 ${r.no}）`,
      `${r.name} 様\n\n申し訳ありませんが、ご希望の日時には変更できませんでした。\nいまのご予約（${whenText(r.choices[r.pick])}）は、そのまま残っています。`],
    rental_cancelled: (r, fee) => [`【結び家SUI】キャンセルを受け付けました（受付番号 ${r.no}）`,
      `${r.name} 様\n\n${r.pick != null ? whenText(r.choices[r.pick]) : "お申込み"} のキャンセルを受け付けました。\nキャンセル料：${fee ? yen(fee) : "かかりません"}\n${fee ? "キャンセル料のお支払いの方法は、○○でご案内します。" : "お振り込み済みの場合のご返金は、○○でご案内します。"}`],
    lesson_confirmed: (b, s) => [`【結び家SUI】ご予約が確定しました（予約番号 ${b.no}）`,
      `${b.name} 様\n\nマットピラティスのご予約が確定しました。\n\n${s.name}　${jd(s.day)} ${span(s.start, s.min)}\n料金：${lessonPriceText(s, b.trial)}\n持ち物：動きやすい服装、飲み物、タオル\nキャンセル：○時間前までは無料です\n\n前日に、場所と持ち物をあらためてお送りします。\nご予約の確認・変更・キャンセルは、予約番号とお電話番号でこちらからできます。\n${CHECK_URL}`],
    lesson_changed: (b, s, before) => [`【結び家SUI】ご予約の日時を変更しました（予約番号 ${b.no}）`,
      `${b.name} 様\n\nご予約の日時を変更しました。\n\n変更前：${before.name}　${jd(before.day)} ${span(before.start, before.min)}\n変更後：${s.name}　${jd(s.day)} ${span(s.start, s.min)}\n料金：${lessonPriceText(s, b.trial)}`],
    lesson_cancelled: (b, s) => [`【結び家SUI】キャンセルを受け付けました（予約番号 ${b.no}）`,
      `${b.name} 様\n\n${s.name}　${jd(s.day)} ${span(s.start, s.min)} のご予約を、キャンセルしました。\nまたのご予約をお待ちしています。`],
    reminder_rental: (r) => [`【結び家SUI】明日のご利用のご案内`,
      `${r.name} 様\n\n明日 ${whenText(r.choices[r.pick])} のご利用をお待ちしています。\n場所：○○\n入り方：○○\n駐車場：○○`],
    reminder_lesson: (b, s) => [`【結び家SUI】明日のレッスンのご案内`,
      `${b.name} 様\n\n明日 ${span(s.start, s.min)} の${s.name}をお待ちしています。\n場所：○○\n持ち物：動きやすい服装、飲み物、タオル`],
  };
  function lessonPriceText(s, trial) {
    const p = LESSON_PRICE[s.name];
    if (!p) return "○円";
    return trial ? `${yen(p[1])}（初回体験）` : yen(p[0]);
  }
  // オーナー様へのお知らせ（LINE）
  const OWNER = {
    new_rental: (r) => `新しいレンタルの申込みがありました。${r.name} 様、第1希望 ${whenText(r.choices[0])}。承認は管理画面から。`,
    change_rental: (r) => `${r.name} 様から、日時の変更の希望が届きました。管理画面で確かめてください。`,
    cancel_rental: (r) => `${r.name} 様のレンタルがキャンセルされました。`,
    new_lesson: (b, s) => `${s.name} ${md(s.day)} ${s.start} に予約が入りました（${b.name} 様）。`,
    cancel_lesson: (b, s) => `${s.name} ${md(s.day)} ${s.start} の予約がキャンセルされました（${b.name} 様）。`,
  };

  // ---- 見本のデータ --------------------------------------------------------
  function seed() {
    const now = Date.now();
    const h = (x) => now - x * 3600e3;
    const req = [
      { no: "K7M2Q9XA", recv: h(3), status: "pending", name: "佐藤 美咲", kana: "さとう みさき", tel: "090-0000-1111", mail: "sato@example.com", purpose: "教室・レッスン", people: 8,
        note: "子ども向けの書道教室を月2回ひらきたいです。墨を使うので、床にシートを敷きます。", flags: ["子どもの参加"], found: "Instagram", line: true,
        choices: [{ day: 9, start: "10:00", h: 3 }, { day: 10, start: "13:00", h: 3 }, { day: 16, start: "10:00", h: 3 }] },
      { no: "R4T8W2NP", recv: h(14), status: "pending", name: "鈴木 由香", kana: "すずき ゆか", tel: "080-0000-2222", mail: "suzuki@example.com", purpose: "撮影", people: 3,
        note: "手づくりの器を撮りたいです。自然光の入る部屋を使わせてください。", flags: ["撮影"], found: "Google検索", line: false,
        choices: [{ day: 5, start: "12:00", h: 4 }, { day: 7, start: "9:00", h: 4 }] },
      { no: "H3J9C6LU", recv: h(27), status: "pending", name: "高橋 恵", kana: "たかはし めぐみ", tel: "090-0000-3333", mail: "takahashi@example.com", purpose: "教室・レッスン", people: 12,
        note: "ベビーマッサージの教室です。親子6組の予定です。", flags: ["子どもの参加"], found: "知人の紹介", line: true,
        choices: [{ day: 4, start: "10:00", h: 2 }, { day: 11, start: "10:00", h: 2 }] },
      { no: "P8Q2D5GH", recv: h(70), status: "confirmed", pick: 0, name: "田中 真理", kana: "たなか まり", tel: "080-0000-4444", mail: "tanaka@example.com", purpose: "教室・レッスン", people: 10,
        note: "夜のヨガ教室です。マットは持ち込みます。", flags: [], found: "Instagram", line: true,
        choices: [{ day: 3, start: "18:00", h: 3 }, { day: 10, start: "18:00", h: 3 }] },
      { no: "W6N3B7KT", recv: h(150), status: "paid", pick: 0, name: "渡辺 直子", kana: "わたなべ なおこ", tel: "090-0000-5555", mail: "watanabe@example.com", purpose: "交流会", people: 5,
        note: "地域の子育てサークルの集まりです。", flags: ["飲食"], found: "チラシ", line: false,
        choices: [{ day: 0, start: "13:00", h: 4 }] },
      { no: "Z2X5V8MC", recv: h(200), status: "paid", pick: 0, name: "中島 ゆり", kana: "なかじま ゆり", tel: "080-0000-6666", mail: "nakajima@example.com", purpose: "ワークショップ", people: 12,
        note: "季節の和菓子づくりと、お茶をいただく会です。", flags: ["飲食", "販売"], found: "Instagram", line: true,
        choices: [{ day: 12, start: "10:00", h: 6 }], change: { recv: h(5), choices: [{ day: 19, start: "10:00", h: 6 }, { day: 20, start: "10:00", h: 6 }] } },
      { no: "F9G4S3YE", recv: h(40), status: "declined", name: "山田 健", kana: "やまだ けん", tel: "090-0000-7777", mail: "yamada@example.com", purpose: "その他", people: 30,
        note: "バンドのライブをしたいです。", flags: ["音楽や大きな音"], found: "Google検索", line: false, reason: "定員を超えるため",
        choices: [{ day: 6, start: "17:00", h: 4 }] },
      { no: "A5E8R2WZ", recv: h(120), status: "cancelled", pick: 0, name: "木村 彩花", kana: "きむら あやか", tel: "080-0000-8888", mail: "kimura@example.com", purpose: "ワークショップ", people: 6,
        note: "フラワーアレンジの教室です。", flags: [], found: "知人の紹介", line: true,
        choices: [{ day: 2, start: "10:00", h: 3 }] },
    ];
    const closed = [{ day: 13, reason: "設備の点検" }];
    const d = { epoch: base.toDateString(), req, closed, slots: [], book: [], failed: [], mails: [] };

    // ピラティスの時間割（表示例。曜日ごとの枠を6週間分。レンタルや休業日と重なる回は作らない）
    const PATTERN = { 1: [["10:00", "セミパーソナル", 60, 5]], 2: [["19:00", "パーソナル", 50, 1]], 4: [["10:00", "パーソナル", 50, 1], ["14:00", "セミパーソナル", 60, 5]], 6: [["14:00", "セミパーソナル", 60, 5]] };
    for (let day = 0; day <= LESSON_TO; day++) {
      (PATTERN[dayOf(day).getDay()] || []).forEach(([start, name, min, cap]) => {
        if (conflictIn(d, day, start, min)) return;
        d.slots.push({ id: `L${day}-${start.replace(":", "")}`, kind: "lesson", day, start, min, name, cap });
      });
    }
    for (let day = 5; day <= 20; day++) {
      if (dayOf(day).getDay() === 0 && !conflictIn(d, day, "13:00", 120)) { d.slots.push({ id: "E1", kind: "event", day, start: "13:00", min: 120, name: "季節の手しごとワークショップ", cap: 8 }); break; }
    }

    const semi = d.slots.filter((s) => s.name === "セミパーソナル");
    const pers = d.slots.filter((s) => s.name === "パーソナル");
    const ev = d.slots.find((s) => s.id === "E1");
    let n = 0;
    const add = (slot, name, trial, extra = {}) => {
      if (!slot) return;
      n++;
      d.book.push({ no: extra.no || code(), slot: slot.id, name, kana: "", tel: extra.tel || `090-0000-9${String(100 + n).slice(1)}`, mail: `guest${n}@example.com`, trial: !!trial, status: extra.status || "confirmed", recv: h(20 + n * 7) });
    };
    add(semi[0], "伊藤 さくら", true); add(semi[0], "小林 舞"); add(semi[0], "斎藤 真由");
    add(semi[1], "加藤 優子", true); add(semi[1], "清水 杏", false, { no: "PL7K3M9A", tel: "080-0000-1212" });
    add(pers[0], "吉田 恵美");
    ["池田 美穂", "石川 葵", "森 理沙", "近藤 遥", "原 由美"].forEach((nm, i) => add(semi[2], nm, i === 1 || i === 2));
    add(semi[2], "山本 千尋", false, { status: "cancelled" });
    add(pers[1], "大野 真紀");
    ["中村 彩", "松本 香", "井上 奈々"].forEach((nm) => add(ev, nm));

    d.failed = [
      { id: "N1", to: "鈴木 由香", what: "申込み受付のお知らせ", how: "メール", why: "メールアドレスに届きませんでした（宛先が見つからない）", at: h(14) },
      { id: "N2", to: "小林 舞", what: "前日のお知らせ", how: "LINE", why: "公式LINEの友だち登録が外れています", at: h(15) },
    ];

    // これまでに送ったお知らせ（見本）
    req.forEach((r) => {
      logMail(d, "rental_received", r.recv, r, [r]);
      if (r.status === "declined") logMail(d, "rental_declined", r.recv + 3 * 3600e3, r, [r]);
      if (isHeld(r) || r.status === "cancelled") logMail(d, "rental_approved", r.recv + 2 * 3600e3, r, [r]);
      if (r.status === "paid") logMail(d, "rental_paid", r.recv + 30 * 3600e3, r, [r]);
      if (r.status === "cancelled") logMail(d, "rental_cancelled", r.recv + 40 * 3600e3, r, [r, 0]);
      if (r.change) logMail(d, "rental_change_received", r.change.recv, r, [r]);
    });
    d.book.forEach((b) => { const s = d.slots.find((x) => x.id === b.slot); logMail(d, "lesson_confirmed", b.recv, b, [b, s]); });
    return d;
  }

  // ---- 計算 ---------------------------------------------------------------
  function busyIn(d, exceptNo) {
    const list = [];
    d.req.forEach((r) => {
      if (!isHeld(r) || r.no === exceptNo) return;
      const c = r.choices[r.pick];
      list.push({ day: c.day, s: toMin(c.start), e: toMin(c.start) + c.h * 60, kind: "rental", label: `レンタル ${r.name} 様`, pub: "ほかのご予約", no: r.no, status: r.status });
    });
    d.slots.forEach((s) => list.push({ day: s.day, s: toMin(s.start), e: toMin(s.start) + s.min, kind: s.kind, id: s.id, label: `${s.name}（${bookedIn(d, s.id)}/${s.cap}名）`, pub: s.kind === "lesson" ? "レッスン" : "イベント" }));
    d.closed.forEach((c) => list.push({ day: c.day, s: 0, e: 24 * 60, kind: "closed", label: `休業日（${c.reason}）`, pub: "お休み" }));
    return list;
  }
  function conflictIn(d, day, start, min, exceptNo, exceptSlot) {
    const s = toMin(start), e = s + min;
    return busyIn(d, exceptNo).find((b) => b.day === day && s < b.e && b.s < e && (!exceptSlot || b.id !== exceptSlot));
  }
  const bookedIn = (d, id) => d.book.filter((b) => b.slot === id && b.status === "confirmed").length;

  function logMail(d, kind, at, rec, args, how = "メール") {
    const [subject, body] = T[kind](...args);
    const m = { id: `M${d.mails.length + 1}-${Math.floor(Math.random() * 1e6)}`, at, kind, to: rec.name, addr: rec.mail, how, subject, body, ref: rec.no };
    d.mails.push(m);
    return m;
  }
  function logOwner(d, kind, args) {
    const m = { id: `O${d.mails.length + 1}-${Math.floor(Math.random() * 1e6)}`, at: Date.now(), kind: "owner", to: "オーナー様", addr: "", how: "LINE", subject: "オーナー様へのお知らせ", body: OWNER[kind](...args), ref: args[0].no };
    d.mails.push(m);
    return m;
  }

  // ---- 読み書き ------------------------------------------------------------
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.epoch === base.toDateString()) return s;
    } catch (_) { /* 読めないときは見本から */ }
    const d = seed();
    write(d);
    return d;
  }
  function write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) { /* 保存できなくても画面は動く */ } }

  let db = load();
  const SUI = {
    PRICE, LESSON_PRICE, OPEN, CLOSE, RENTAL_FROM, RENTAL_TO, LESSON_TO, WD, STATUS,
    get db() { return db; },
    reload() { db = load(); return db; },
    save() { write(db); },
    reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(MINE_KEY); } catch (_) {} db = load(); },
    base, dayOf, offOf, md, jd, toMin, toTime, span, yen, esc, digits, code, whenText, isHeld, lessonPriceText,
    busy: (exceptNo) => busyIn(db, exceptNo),
    conflict: (day, start, min, exceptNo, exceptSlot) => conflictIn(db, day, start, min, exceptNo, exceptSlot),
    booked: (id) => bookedIn(db, id),
    slot: (id) => db.slots.find((s) => s.id === id),
    req: (no) => db.req.find((r) => r.no === no),
    bookOf: (no) => db.book.find((b) => b.no === no),
    mail: (kind, rec, args) => logMail(db, kind, Date.now(), rec, args),
    owner: (kind, args) => logOwner(db, kind, args),
    // この端末で申し込んだ予約（お客様の画面の「この端末で申し込んだ予約」に出す）
    mine() { try { return JSON.parse(localStorage.getItem(MINE_KEY)) || []; } catch (_) { return []; } },
    addMine(type, no) { try { const m = SUI.mine().filter((x) => x.no !== no); m.unshift({ type, no }); localStorage.setItem(MINE_KEY, JSON.stringify(m)); } catch (_) {} },
    // カレンダーに入れるためのファイル（.ics）と Google カレンダーのリンク
    ics(events) {
      const p = (n) => String(n).padStart(2, "0");
      const stamp = (off, min) => { const d = dayOf(off); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(Math.floor(min / 60))}${p(min % 60)}00`; };
      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//musubiya-sui mock//JA", "CALSCALE:GREGORIAN"];
      events.forEach((e, i) => lines.push("BEGIN:VEVENT", `UID:${e.uid || i}@musubiya-sui.mock`, `DTSTART;TZID=Asia/Tokyo:${stamp(e.day, e.s)}`, `DTEND;TZID=Asia/Tokyo:${stamp(e.day, e.e)}`, `SUMMARY:${e.title}`, `DESCRIPTION:${(e.desc || "").replace(/\n/g, "\\n")}`, "END:VEVENT"));
      lines.push("END:VCALENDAR");
      return lines.join("\r\n");
    },
    gcal(title, day, s, e) {
      const p = (n) => String(n).padStart(2, "0");
      const st = (min) => { const d = dayOf(day); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(Math.floor(min / 60))}${p(min % 60)}00`; };
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${st(s)}/${st(e)}&ctz=Asia/Tokyo`;
    },
    download(name, text) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };
  window.SUI = SUI;
})();

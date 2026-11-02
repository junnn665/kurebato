/* 俳句査定バトル — 音数カウントと自動査定（先生）
 *
 * よみ: kuromoji.js（形態素解析・ブラウザで動く辞書。vendor/kuromoji に同梱）で自動で出す。
 *       読みこめないときは「漢字1字＝2音」で推定し、画面でよみを手で直せる。
 * 査定: 「型」40点（音数15・季語15・切れ10）＋「表現」60点（見せる12・具体12・五感10・季語の生かし方8・調べ8・発想10）の9項目。
 *       同じ句なら必ず同じ点（ゆらぎなし）。名句と見本句で配点を合わせてある（tools/calibrate.js）。
 *       70 点以上「才能アリ」、50〜69 点「凡人」、49 点以下「才能ナシ」。
 */
(() => {
  "use strict";

  // ---------- よみ（音数） ----------
  const SMALL = "ゃゅょぁぃぅぇぉゎ";
  const toHira = (s) => String(s || "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const isKana = (c) => /[ぁ-ゖァ-ヺー]/.test(c);
  const isKanji = (c) => /[㐀-鿿々〆ヶ]/.test(c);
  const DIGIT_YOMI = { 0: "ぜろ", 1: "いち", 2: "に", 3: "さん", 4: "よん", 5: "ご", 6: "ろく", 7: "なな", 8: "はち", 9: "きゅう" };

  // ひらがな・カタカナの音数（拗音は1音、促音・撥音・長音は1音）
  function countMora(kana) {
    let n = 0;
    for (const c of toHira(kana)) {
      if (SMALL.includes(c)) continue;
      if (/[ぁ-ゖー]/.test(c)) n++;
    }
    return n;
  }

  let tokenizer = null;
  let dictState = "idle"; // idle | loading | ready | failed
  const listeners = [];
  const KUROMOJI = "vendor/kuromoji/kuromoji.js";
  const DICT = "vendor/kuromoji/dict/";

  function loadDict() {
    if (dictState !== "idle") return;
    dictState = "loading";
    notify();
    const s = document.createElement("script");
    s.src = KUROMOJI;
    s.onload = () => {
      try {
        window.kuromoji.builder({ dicPath: DICT }).build((err, tk) => {
          if (err || !tk) { dictState = "failed"; console.warn(err); }
          else { tokenizer = tk; dictState = "ready"; }
          notify();
        });
      } catch (e) { dictState = "failed"; console.warn(e); notify(); }
    };
    s.onerror = () => { dictState = "failed"; notify(); };
    document.head.appendChild(s);
    setTimeout(() => { if (dictState === "loading") { dictState = "failed"; notify(); } }, 45000);
  }
  function notify() { listeners.forEach((f) => { try { f(dictState); } catch { /* */ } }); }
  function onDict(f) { listeners.push(f); f(dictState); }

  function tokenize(line) {
    if (!tokenizer || !line) return null;
    try { return tokenizer.tokenize(line); } catch { return null; }
  }

  // 1行のよみ。{ yomi, mora, guess }  guess = 推定の部分がある
  function readLine(line, tokens) {
    line = String(line || "").trim();
    let yomi = "", guess = false;
    let kanjiRun = 0;
    const flushKanji = () => { if (kanjiRun) { yomi = yomi.slice(0, yomi.length - kanjiRun) + "〇".repeat(kanjiRun === 1 ? 2 : Math.round(kanjiRun * 1.6)); kanjiRun = 0; } };
    const fromChars = (str) => {
      for (const c of str) {
        if (!isKanji(c)) flushKanji();
        if (isKana(c)) yomi += toHira(c);
        else if (/[0-9０-９]/.test(c)) yomi += DIGIT_YOMI[String.fromCharCode(c.charCodeAt(0) > 0xff ? c.charCodeAt(0) - 0xfee0 : c.charCodeAt(0))] || "";
        else if (isKanji(c)) { yomi += "〇"; guess = true; kanjiRun++; continue; }
        else if (/[A-Za-zＡ-Ｚａ-ｚ]/.test(c)) { yomi += "〇"; guess = true; }
      }
      flushKanji();
    };
    if (tokens) {
      for (const t of tokens) {
        if (t.reading && t.reading !== "*") yomi += toHira(t.reading);
        else fromChars(t.surface_form);
      }
    } else fromChars(line);
    const mora = countMora(yomi.replace(/〇/g, "あ"));
    return { yomi, mora, guess };
  }

  // ---------- 査定 ----------
  const EMOTION = ["ありがとう", "ごめんね", "さようなら", "がんばれ", "頑張れ", "頑張ろう", "悲しい", "悲しき", "悲しさ", "かなしい", "寂しい", "寂しき", "淋しい", "さびしい", "さみしい", "嬉しい", "うれしい", "楽しい", "たのしい", "懐かしい", "なつかしい", "切ない", "せつない", "美しい", "うつくしい", "綺麗", "きれい", "キレイ", "素敵", "すてき", "幸せ", "しあわせ", "感動", "愛しい", "恋しい", "辛い", "つらい", "苦しい", "怖い", "こわい", "ワクワク", "わくわく", "ドキドキ", "どきどき", "最高", "大好き"];
  const EXPLAIN = ["ので", "だから", "なので", "けれど", "けれども", "だけど", "なのに", "ため", "それで", "しかし", "つまり"];
  const SIMILE = ["ように", "ような", "みたい", "のごと", "如く", "ごとく"];
  const KIREJI = ["や", "かな", "けり"];
  const SENSE = {
    色: ["赤", "青", "白", "黒", "黄", "緑", "紫", "茶色", "金", "銀", "紅", "碧", "朱", "藍", "紺", "灰色", "桃色", "水色"],
    音: ["音", "声", "鳴", "響", "ざわ", "鐘", "囁", "笛"],
    匂: ["匂", "香", "臭", "におい", "かおり"],
    触: ["冷た", "熱", "ぬる", "湿", "乾", "ざらざら", "重た", "柔らか", "硬"],
    味: ["甘", "苦", "酸っぱ", "辛口", "塩", "しょっぱ"],
    光: ["光", "影", "灯", "明か", "暗", "眩", "ひかり"],
  };
  const CLICHE = ["青い空", "青空の下", "夕焼け空", "桜舞う", "桜散る", "花吹雪舞う", "星降る", "満天の星", "風に乗り", "風に舞う", "思い出す", "思い出", "心まで", "胸に秘め", "あの日", "君と僕", "未来へと", "夢を見る", "輝いて", "永遠に", "とどけ", "届け"];
  const CLICHE_ONO = ["きらきら", "キラキラ", "ふわふわ", "フワフワ", "ひらひら", "ヒラヒラ", "しんしん", "ぽかぽか", "ポカポカ", "ザーザー", "ざーざー", "ミンミン", "みんみん", "ゆらゆら", "そよそよ", "ぴかぴか", "ピカピカ", "ころころ", "わいわい"];
  // ありふれていて景色が具体的にならない言葉
  const GENERIC = ["空", "雲", "道", "家", "学校", "窓", "外", "君", "僕", "私", "俺", "心", "夢", "光", "風", "海", "山", "町", "街", "人", "みんな", "皆", "友", "友達", "花", "木", "星", "夜", "朝", "昼", "日", "時", "今日", "明日", "昨日", "今", "中", "上", "下", "前", "後", "声", "音", "色", "気持ち", "世界", "未来", "思い出", "季節", "景色", "子", "子供", "子ども", "部屋", "地球", "命", "愛", "顔", "目", "手", "ため", "こと", "もの", "とき"];
  const NUM_RE = /[0-9０-９一二三四五六七八九十百千万]/;

  function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const uniq = (a) => [...new Set(a)];
  const odaiSeason = (o) => (o && o.season === "梅雨" ? "夏" : o && o.season);

  /**
   * judge({ lines:[上五,中七,下五], yomi?:[...]|null, odai? })
   * yomi を渡すと、それで音数を数える（手で直したよみ）
   */
  function judge({ lines, yomi, odai }) {
    lines = (lines || []).map((l) => String(l || "").replace(/\s+/g, "").trim());
    const text = lines.join("");
    const toks = lines.map((l) => tokenize(l));
    const reads = lines.map((l, i) => {
      if (yomi && yomi[i]) { const y = String(yomi[i]).replace(/\s+/g, ""); return { yomi: toHira(y), mora: countMora(y), guess: false, manual: true }; }
      return readLine(l, toks[i]);
    });
    const moras = reads.map((r) => r.mora);
    // 点は「型」（40点：音数15・季語15・切れ10）と「表現」（60点）の二本立て。ゆらぎは入れない
    const pts = []; // { d: 点の増減, t: コメント, k: good|bad|info, c: 項目の名前（音数・季語・切れ・見せる・具体・五感・季語の生かし方・調べ・発想） }
    const add = (d, t, k, c) => pts.push({ d, t, k: k || (d > 0 ? "good" : d < 0 ? "bad" : "info"), c: c || "表現" });
    const advice = [];

    if (!text) return { score: 0, verdict: "未提出", lines, moras, reads, kigo: [], pts: [], advice: [], summary: "白紙……。次は一句、出しましょう。", kata: 0, hyogen: 0, parts: [] };

    // ===== 型（40点） =====
    // --- 音数（15） ---
    const target = [5, 7, 5];
    const names = ["上五", "中七", "下五"];
    const guessed = reads.some((r) => r.guess);
    let onsu = 15, unsure = 0;
    moras.forEach((m, i) => {
      const diff = m - target[i];
      if (diff === 0) return;
      // よみが推定の行は、ずれが小さければ減点しない（辞書なしで漢字の音数がわからないため）
      if (reads[i].guess && Math.abs(diff) <= 3) { unsure++; return; }
      let d;
      if (diff > 0) {
        if (i === 0) { d = diff > 2 ? -4 : -1; add(d, diff > 2 ? `上五が${m}音。上五の字余りは許されやすいけれど、ここまで余ると重い。` : `上五が${m}音の字余り。上五なら許容範囲です。`, null, "音数"); }
        else if (i === 1) { d = diff >= 2 ? -10 : -6; add(d, `中七が${m}音の${m === 8 ? "「中八」" : "字余り"}。リズムがもたつきます。`, null, "音数"); advice.push("中七の助詞（の・が・を・は）を一つ削れないか探してみましょう。"); }
        else if (diff === 1 && toks[2] && toks[2].filter((t) => t.pos !== "記号").every((t) => t.pos === "名詞")) { d = -1; add(d, `下五が${m}音。名詞一語で切りようがないので、許容範囲の字余りです。`, null, "音数"); }
        else { d = diff >= 2 ? -7 : -4; add(d, `下五が${m}音の字余り。句の着地がもたつきます。`, null, "音数"); advice.push("下五は名詞で5音にきっちり収めると、句が締まります。"); }
      } else {
        d = -diff >= 2 ? -8 : -5;
        add(d, `${names[i]}が${m}音で字足らず。音が足りないと、読み手がつまずきます。`, null, "音数");
      }
      onsu += d;
    });
    onsu = Math.max(0, onsu);
    if (onsu === 15) add(0, unsure ? "五・七・五はだいたい守れていそうです（よみは推定）。" : "五・七・五のリズムがきちんと守れています。", "good", "音数");
    if (guessed) add(0, "よみを推定した部分があります（漢字1字＝2音）。音数がちがうときは「よみを直す」で直せます。", "info", "音数");

    // --- 発見・おかしみ（受賞作の選評で重視される「人のおかしみ」「意外な取り合わせ」「スケールの対比」） ---
    const allToks = toks.every((t) => t) ? toks.flat() : null;
    const hasTok = (w, pos) => !!allToks && allToks.some((t) => t.surface_form === w && (!pos || t.pos === pos));
    const OKASHIMI_RE = /(まで.{0,3}(測|量|計|はか|待|押|撮|探|選|見|拭|磨|直)|より先に|る前に|くせに|わりに|たびに|ついつい|こっそり|わざと|明日から|[二三四五六七八九]本目|[二三四五六七八九]度目|[二三四五六七八九]回目|[二三四五六七八九]杯目|いい数字|ふりをし|ふりする|ふりして|ことにする|ことにした)/;
    const okashimi = OKASHIMI_RE.test(text) || hasTok("のに", "助詞") || (hasTok("ばかり", "助詞") && !/ばかりかな$/.test(text));
    const BIG_RE = /(億|万年|光年|宇宙|銀河系|地球|太陽系|天地|千年|百年|世界中|地平|水平線)/;
    const scale = BIG_RE.test(text);
    const MODERN_RE = /(計$|[^時]計|スマホ|レシート|コンビニ|エレベーター|自販機|充電|改札|体重|血圧|アプリ|ゲーム|ランドセル|リモコン|イヤホン|マスク|冷蔵庫|洗濯機|電子レンジ|宅配|ポイント|履歴|既読|保存|再生|検索|残高|ATM|Wi|LINE)/;
    const modern = MODERN_RE.test(text);
    const hakken = okashimi || scale;

    // --- 季語（15） ---
    const kigo = window.KIGO.find(text);
    const seasons = uniq(kigo.map((k) => k.season));
    let kigoPt;
    if (kigo.length === 0) {
      if (hakken) {
        // 季語がなくても、人のおかしみや大きな発見が主題として立っていれば「無季の句」として認める
        kigoPt = 10;
        add(-5, "季語はありませんが、発見そのものが主題として立っています（無季の句・川柳の味わい）。季語を入れると、さらに奥行きが出ます。", null, "季語");
      } else {
        kigoPt = 6;
        add(-9, "季語が見当たりません。無季の句は、季語のかわりに強い発見が要ります。まずは季語を一つ入れてみましょう。", null, "季語");
      }
      const s = odaiSeason(odai);
      const pool = window.KIGO.SUGGEST[s && s !== "四季" ? s : ["春", "夏", "秋", "冬"][hashStr(text) % 4]];
      advice.push(`たとえば「${pool.slice(hashStr(text) % 4, hashStr(text) % 4 + 3).join("」「")}」のような季語を入れてみては。`);
    } else if (kigo.length === 1) {
      kigoPt = 15;
      add(0, `季語「${kigo[0].w}」（${kigo[0].season}）が一句の主役になっています。`, "good", "季語");
    } else {
      const ws = kigo.map((k) => `${k.w}（${k.season}）`).join("・");
      if (seasons.length > 1) { kigoPt = 5; add(-10, `季語が${kigo.length}つ、しかも季節がばらばら（${ws}）。季違いの季重なりです。`, null, "季語"); }
      else { kigoPt = 9; add(-6, `季語が${kigo.length}つ（${ws}）。季重なりで主役がぼやけます。`, null, "季語"); }
      advice.push(`季語は「${kigo[0].w}」か「${kigo[1].w}」のどちらか一つに絞り、空いた音で“モノ”を描きましょう。`);
    }
    const os = odaiSeason(odai);
    if (kigo.length && os && os !== "四季" && !seasons.includes(os)) add(0, `お題は${os}の場面ですが、季語は${seasons.join("・")}。お題を大胆に飛ばした発想とも読めます。`, "info", "季語の生かし方");

    // --- 切れ（10） ---
    const ends = lines.map((l) => l.replace(/[。、！!？?]+$/, ""));
    const kire = [];
    ends.forEach((l, i) => { for (const k of KIREJI) if (l.endsWith(k)) kire.push({ k, i }); });
    // 「や」は上五・中七の終わりだけ、「かな」「けり」は下五の終わりだけを切れ字とみなす
    const kireOk = kire.filter((x) => (x.k === "や" ? x.i < 2 : x.i === 2));
    // 文語の言い切り（哉・ぞ・なり・ぬ・たり・ぬべし…）で終わる下五も「切れ」とみなす
    if (!kireOk.some((x) => x.i === 2)) { const m = ends[2].match(/(哉|ぞ|なり|ぬべし|ぬ|たり|らむ|らん|けむ)$/); if (m) kireOk.push({ k: m[1], i: 2 }); }
    const all = toks.every((t) => t) ? toks.flat() : null;
    let taigen;
    if (all) { const last = [...toks[2]].reverse().find((t) => t.pos !== "記号"); taigen = !!last && last.pos === "名詞"; }
    else taigen = /[㐀-鿿ァ-ヺー]$/.test(ends[2]); // 辞書なし：漢字かカタカナで終われば名詞とみなす
    let kirePt;
    if (kireOk.length === 1) { kirePt = 10; add(0, `切れ字「${kireOk[0].k}」で一句に「間」が生まれ、場面がくっきりしました。`, "good", "切れ"); }
    else if (kireOk.length >= 2) { kirePt = 3; add(-7, "切れ字が二つ。切れは一句に一つが原則。どちらが言いたいことか決めましょう。", null, "切れ"); }
    else if (taigen) { kirePt = 8; add(0, "名詞で止めた「体言止め」。句がすっと締まり、余韻が残ります。", "good", "切れ"); }
    else { kirePt = 6; add(-4, "切れがなく、文章のように流れています。「や」で切るか、名詞で止めると句が締まります。", null, "切れ"); }
    const kata = onsu + kigoPt + kirePt;

    // ===== 表現（60点）：六つの見どころ =====
    // 見せる12・具体12・五感10・季語の生かし方8・調べ8・発想10
    const P = {
      見せる: { got: 9, max: 12 },
      具体: { got: 3, max: 12 },
      五感: { got: 3, max: 10 },
      季語の生かし方: { got: kigo.length ? 4 : hakken ? 4 : 2, max: 8 },
      調べ: { got: 4, max: 8 },
      発想: { got: 5, max: 10 },
    };
    const ex = (item, d, t, k) => { P[item].got += d; add(d, t, k, item); };

    // --- 見せる（言わずに見せる） ---
    const emo = EMOTION.filter((w) => text.includes(w));
    if (emo.length) {
      ex("見せる", -7 * Math.min(emo.length, 2), `「${emo[0]}」と気持ちを言ってしまうと、読み手が想像する余地がなくなります。`);
      advice.push(`「${emo[0]}」を消して、その気持ちがにじむ“モノ”や“しぐさ”を一つ置きましょう。`);
    }
    const exp = EXPLAIN.filter((w) => text.includes(w));
    if (exp.length) ex("見せる", -5, `「${exp[0]}」は理屈・説明の言葉。俳句では理由を言わず、並べて見せるだけで伝わります。`);
    const sim = SIMILE.filter((w) => text.includes(w));
    if (sim.length) ex("見せる", -2, `「${sim[0]}」の直喩は便利なぶん、安易になりがち。比喩にするなら、だれも思いつかない取り合わせを。`);
    const murmur = ends.find((l) => /(ろう|よう|たい|たく|ましょう|だな|だね|だよ|なあ)$/.test(l));
    if (murmur) ex("見せる", -4, "「〜したい」「〜しよう」「〜だな」のような気持ち・つぶやきが出ています。言わずに、景色に語らせましょう。");
    if (!emo.length && !exp.length && !murmur) ex("見せる", 3, "気持ちや理屈を言わず、景色だけで見せています。");

    // --- 具体（手に取れるモノ・固有名詞・数字） ---
    let specific = [];
    if (all) {
      const nouns = all.filter((t) => t.pos === "名詞" && !["非自立", "代名詞", "数", "接尾"].includes(t.pos_detail_1));
      const kigoText = kigo.map((k) => k.w).join("|");
      specific = uniq(nouns.map((t) => t.surface_form)).filter((w) => !GENERIC.includes(w) && !(kigoText && kigoText.includes(w)) && !window.KIGO.find(w).length);
      if (specific.length >= 2) ex("具体", 6, `「${specific.slice(0, 2).join("」「")}」と具体的なモノが描けていて、景色が手に取れます。`);
      else if (specific.length === 1) ex("具体", 3, `「${specific[0]}」が具体的。もう一つ、手に取れるモノがあるとさらに立体的に。`);
      else { ex("具体", kigo.length ? -2 : -3, "空・道・家・君など、ありふれた言葉が中心でふわっとした印象。自分だけが見た具体的なモノを一つ。"); advice.push("「空」「道」より「改札口」「銀の匙」のように、手に取れる具体的なモノを。"); }
      if (all.some((t) => t.pos === "名詞" && t.pos_detail_1 === "固有名詞")) ex("具体", 2, "固有名詞が効いて、場所や時代が見えます。");
    } else P.具体.got = 7; // 辞書なし：判定できないので中くらい
    if (NUM_RE.test(text)) ex("具体", 2, "数字が入って、景色がくっきりしました。");

    // --- 五感 ---
    const senses = Object.entries(SENSE).filter(([, ws]) => ws.some((w) => text.includes(w))).map(([k]) => k);
    if (senses.length) ex("五感", Math.min(senses.length * 3, 7), `${senses.join("・")}の言葉があって、映像や感覚が立ち上がります。`);
    else { add(0, "色・音・匂い・手ざわりなどの言葉がまだありません。", "info", "五感"); advice.push("色・音・匂い・手ざわりなど、五感の言葉を一つ入れると映像がはっきりします。"); }

    // --- 季語の生かし方 ---
    const OBVIOUS = [
      [/(雪|雨|霰|霙|時雨|五月雨|夕立)[がのはも]?(降|ふ[るりっ])/, "降る"],
      [/(花|桜|花びら|紅葉|もみじ|落葉|落ち葉|枯葉)[がのはも]?(舞|散|ちる|ちり|まう|まい)/, "舞う・散る"],
      [/(とんぼ|蜻蛉|赤とんぼ|蝶|燕|つばめ|雁)[がのはも]?(飛|とぶ|とん)/, "飛ぶ"],
      [/(蝉|せみ|虫|鈴虫|蛙|鶯|うぐいす|雲雀)[がのはも]?(鳴|なく|ない|啼)/, "鳴く"],
      [/(桜|梅|向日葵|ひまわり|朝顔|菊|コスモス|蒲公英|たんぽぽ|菜の花)[がのはも]?(咲|さく|さい)/, "咲く"],
      [/(風|木枯し?|凩|東風|春一番)[がのはも]?(吹|ふく|ふい)/, "吹く"],
    ];
    const obv = OBVIOUS.find(([re]) => re.test(text));
    if (obv) { ex("季語の生かし方", -4, `季語に「${obv[1]}」という当たり前の動きを足しています。季語はそれだけで景色が浮かぶので、空いた音で別のものを描きましょう。`); advice.push("季語の説明（雪が降る・花が散る など）はやめて、その音で季語とは別の“モノ”を一つ。"); }
    if (kigo.length === 1 && /^(春|夏|秋|冬)の/.test(kigo[0].w)) ex("季語の生かし方", -1, `「${kigo[0].w}」のように季節の名前をそのまま入れた季語は手軽なぶん、印象が薄くなりがち。`);
    if (kigo.length === 1 && !obv && specific.length >= 1) {
      const kl = lines.findIndex((l) => window.KIGO.find(l).length);
      const others = lines.filter((l, i) => i !== kl).join("");
      if (specific.some((w) => others.includes(w))) ex("季語の生かし方", 3, `季語「${kigo[0].w}」と、別の行の「${specific.find((w) => others.includes(w))}」の取り合わせ。ふたつが響き合っています。`);
    }

    // --- 調べ（リズムの心地よさ・言葉の運び） ---
    if (/(けり|けむ|らむ|ぬべし|たる|たり|なり|哉|ぞ|ぬ)$/.test(ends[2]) || /(たる|ける|なる|へば|ねば)/.test(text)) ex("調べ", 2, "文語の言い回しが句に格調を与えています。");
    if (/(へ|ている|ていた|でいる|でいた|ました|です)$/.test(ends[2])) ex("調べ", -3, "下五が「〜へ」「〜ている」の報告調。名詞で止めるか、切れ字で締めると句になります。");
    if (all) {
      const verbs = all.filter((t) => t.pos === "動詞" && t.pos_detail_1 === "自立");
      if (verbs.length >= 3) { ex("調べ", -3, `動詞が${verbs.length}つ（${uniq(verbs.map((v) => v.basic_form)).join("・")}）。動きが多いと焦点がぼやけます。`); advice.push("動詞は一つか二つに。いちばん大事な動きだけを残しましょう。"); }
      else if (verbs.length === 0 && kireOk.length) ex("調べ", 1, "動詞を使わず、名詞と切れだけで景色を定めています。");
    }
    const kanjiWords = text.match(/[㐀-鿿]{2,}/g) || [];
    const dup = kanjiWords.find((w, i) => kanjiWords.indexOf(w) !== i);
    if (dup) ex("調べ", -2, `「${dup}」が二度出てきます。くり返すなら狙いをはっきり。`);

    // --- 発想（新鮮さ・お題との距離） ---
    if (okashimi) ex("発想", 4, "人のしぐさに、思わずくすっとする“おかしみ”があります。説明せずに人間くささを見せる発見です。");
    if (scale) ex("発想", 3, "大きな時間・空間と、身近なものを並べたスケールの対比。想像がぐっと広がります。");
    if (modern && !CLICHE.some((w) => text.includes(w))) ex("発想", 2, "今の暮らしのモノを持ちこんで、句に新しさがあります。");
    const cl = CLICHE.filter((w) => text.includes(w));
    if (cl.length) ex("発想", -4, `「${cl[0]}」はよく見かける言い回し。あなただけの発見を一つ。`);
    const clo = CLICHE_ONO.filter((w) => text.includes(w));
    if (clo.length) ex("発想", -3, `「${clo[0]}」は手垢のついたオノマトペ。自分の耳で聞いた音にしてみては。`);
    else {
      const ono = text.match(/([ぁ-ゖ]{2})\1|([ァ-ヺ]{2})\2/);
      if (ono) ex("発想", 2, `オノマトペ「${ono[0]}」が新鮮。音がそのまま景色になっています。`);
    }
    if (odai && odai.kw) {
      const hit = odai.kw.filter((k) => text.includes(k));
      if (hit.length >= 3) { ex("発想", -5, "お題の場面をそのままなぞっています。写真に写っていない“何か”を一つ。"); advice.push("お題に写っているものは一つまでに。残りの音で、写真の外（音・匂い・記憶）を描きましょう。"); }
      else if (hit.length === 0) ex("発想", 2, "お題から発想をうまく飛ばしています。");
      else add(0, "お題の場面を足がかりに詠んでいます。", "info", "発想");
    }

    Object.values(P).forEach((x) => { x.got = Math.max(0, Math.min(x.max, x.got)); });
    const hyogen = Object.values(P).reduce((a, x) => a + x.got, 0);
    const score = Math.max(5, Math.min(98, kata + hyogen));
    const verdict = verdictOf(score);
    const parts = [
      { name: "音数", got: onsu, max: 15, group: "型", desc: "五・七・五のリズム" },
      { name: "季語", got: kigoPt, max: 15, group: "型", desc: "季語が一つ、主役になっているか" },
      { name: "切れ", got: kirePt, max: 10, group: "型", desc: "切れ字や体言止めで句が締まっているか" },
      { name: "見せる", ...P.見せる, group: "表現", desc: "気持ちや理屈を言わず、景色で見せているか" },
      { name: "具体", ...P.具体, group: "表現", desc: "手に取れるモノ・固有名詞・数字" },
      { name: "五感", ...P.五感, group: "表現", desc: "色・音・匂い・手ざわり・味・光" },
      { name: "季語の生かし方", ...P.季語の生かし方, group: "表現", desc: "季語の説明をせず、別のモノと響き合わせているか" },
      { name: "調べ", ...P.調べ, group: "表現", desc: "言葉の運び・動詞の数・言い切り" },
      { name: "発想", ...P.発想, group: "表現", desc: "ありがちでないか・お題から飛べているか" },
    ];

    if (!advice.length) {
      if (score >= 85) advice.push("直すところはほぼなし。このまま句帳に残しましょう。");
      else advice.push("型はできています。次は「取り合わせ」（季語と関係なさそうなモノのぶつけ合い）で表現の点を伸ばしましょう。");
    }

    const goods = pts.filter((p) => p.k === "good").sort((a, b) => b.d - a.d);
    const bads = pts.filter((p) => p.k === "bad").sort((a, b) => a.d - b.d);
    let summary;
    if (score >= 85) summary = `お見事。${goods[0] ? goods[0].t : ""}一語一語に無駄がありません。`;
    else if (score >= 70) summary = `いい句です。${goods[0] ? goods[0].t : ""}${bads[0] ? "ただ、" + bads[0].t : ""}`;
    else if (score >= 50) summary = `惜しい。${bads[0] ? bads[0].t : ""}${goods[0] ? "とはいえ、" + goods[0].t : ""}`;
    else summary = `厳しく言います。${bads[0] ? bads[0].t : ""}${bads[1] ? bads[1].t : ""}でも、ここから伸びます。`;

    return { score, verdict, lines, moras, reads, kigo, pts, advice: uniq(advice).slice(0, 3), summary, kata, hyogen, parts };
  }

  function verdictOf(score) {
    if (score >= 70) return "才能アリ";
    if (score >= 50) return "凡人";
    return "才能ナシ";
  }

  window.Judge = { judge, readLine, tokenize, countMora, loadDict, onDict, verdictOf, toHira, get ready() { return dictState === "ready"; } };
})();

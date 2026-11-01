/* 俳句査定バトル — 音数カウントと自動査定（先生）
 *
 * よみ: kuromoji.js（形態素解析・ブラウザで動く辞書。vendor/kuromoji に同梱）で自動で出す。
 *       読みこめないときは「漢字1字＝2音」で推定し、画面でよみを手で直せる。
 * 査定: 五七五・季語・切れ・具体性・五感・説明くささ などを点数化して 0〜100 点。
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
  const EMOTION = ["悲しい", "悲しき", "悲しさ", "かなしい", "寂しい", "寂しき", "淋しい", "さびしい", "さみしい", "嬉しい", "うれしい", "楽しい", "たのしい", "懐かしい", "なつかしい", "切ない", "せつない", "美しい", "うつくしい", "綺麗", "きれい", "キレイ", "素敵", "すてき", "幸せ", "しあわせ", "感動", "愛しい", "恋しい", "辛い", "つらい", "苦しい", "怖い", "こわい", "ワクワク", "わくわく", "ドキドキ", "どきどき", "最高", "大好き"];
  const EXPLAIN = ["ので", "だから", "なので", "けれど", "けれども", "だけど", "なのに", "ため", "それで", "しかし", "つまり"];
  const SIMILE = ["ように", "ような", "みたい", "のごと", "如く", "ごとく"];
  const KIREJI = ["や", "かな", "けり"];
  const SENSE = {
    色: ["赤", "青", "白", "黒", "黄", "緑", "紫", "茶色", "金色", "銀色", "朱", "藍", "紺", "灰色", "桃色", "水色"],
    音: ["音", "声", "鳴", "響", "ざわ", "鐘", "囁", "笛"],
    匂: ["匂", "香", "臭", "におい", "かおり"],
    触: ["冷た", "熱", "ぬる", "湿", "乾", "ざらざら", "重た", "柔らか", "硬"],
    味: ["甘", "苦", "酸っぱ", "辛口", "塩", "しょっぱ"],
    光: ["光", "影", "灯", "明か", "暗", "眩", "ひかり"],
  };
  const CLICHE = ["青い空", "青空の下", "夕焼け空", "桜舞う", "桜散る", "花吹雪舞う", "星降る", "満天の星", "風に乗り", "風に舞う", "思い出す", "思い出", "心まで", "胸に秘め", "あの日", "君と僕", "未来へと", "夢を見る", "輝いて", "永遠に", "とどけ", "届け"];
  const CLICHE_ONO = ["きらきら", "キラキラ", "ふわふわ", "フワフワ", "ひらひら", "ヒラヒラ", "しんしん", "ぽかぽか", "ポカポカ", "ザーザー", "ざーざー", "ミンミン", "みんみん", "ゆらゆら", "そよそよ", "ぴかぴか", "ピカピカ", "ころころ", "わいわい"];
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
    const pts = []; // { d: 点の増減, t: コメント, k: good|bad|info }
    const add = (d, t, k) => pts.push({ d, t, k: k || (d > 0 ? "good" : d < 0 ? "bad" : "info") });
    const advice = [];
    let score = 50;

    if (!text) return { score: 0, verdict: "未提出", lines, moras, reads, kigo: [], pts: [], advice: [], summary: "白紙……。次は一句、出しましょう。" };

    // --- 五七五 ---
    const target = [5, 7, 5];
    const names = ["上五", "中七", "下五"];
    const guessed = reads.some((r) => r.guess);
    let perfect = true;
    let unsure = 0;
    moras.forEach((m, i) => {
      const diff = m - target[i];
      if (diff === 0) return;
      // よみが推定の行は、ずれが小さければ減点しない（辞書なしで漢字の音数がわからないため）
      if (reads[i].guess && Math.abs(diff) <= 3) { unsure++; return; }
      perfect = false;
      if (diff > 0) {
        if (i === 0) add(diff > 2 ? -4 : -1, diff > 2 ? `上五が${m}音。上五の字余りは許されやすいけれど、ここまで余ると重い。` : `上五が${m}音の字余り。上五なら許容範囲です。`);
        else if (i === 1) { add(-6 * Math.min(diff, 2), `中七が${m}音の${m === 8 ? "「中八」" : "字余り"}。リズムがもたつきます。`); advice.push("中七の助詞（の・が・を・は）を一つ削れないか探してみましょう。"); }
        else { add(-4 * Math.min(diff, 2), `下五が${m}音の字余り。句の着地がもたつきます。`); advice.push("下五は名詞で5音にきっちり収めると、句が締まります。"); }
      } else {
        add(-5 * Math.min(-diff, 2), `${names[i]}が${m}音で字足らず。音が足りないと、読み手がつまずきます。`);
      }
    });
    if (perfect && !unsure) add(6, "五・七・五のリズムがきちんと守れています。");
    else if (perfect) add(3, "五・七・五はだいたい守れていそうです（よみは推定）。");
    if (guessed) add(0, "よみを推定した部分があります（漢字1字＝2音）。音数がちがうときは「よみを直す」で直せます。", "info");

    // --- 季語 ---
    const kigo = window.KIGO.find(text);
    const seasons = uniq(kigo.map((k) => k.season));
    if (kigo.length === 0) {
      add(-8, "季語が見当たりません。無季の句は上級者の技。まずは季語を一つ入れましょう。");
      const s = odaiSeason(odai);
      const pool = window.KIGO.SUGGEST[s && s !== "四季" ? s : ["春", "夏", "秋", "冬"][hashStr(text) % 4]];
      advice.push(`たとえば「${pool.slice(hashStr(text) % 4, hashStr(text) % 4 + 3).join("」「")}」のような季語を入れてみては。`);
    } else if (kigo.length === 1) {
      add(8, `季語「${kigo[0].w}」（${kigo[0].season}）が一句の主役になっています。`);
    } else {
      const ws = kigo.map((k) => `${k.w}（${k.season}）`).join("・");
      if (seasons.length > 1) add(-8, `季語が${kigo.length}つ、しかも季節がばらばら（${ws}）。季違いの季重なりです。`);
      else add(-5, `季語が${kigo.length}つ（${ws}）。季重なりで主役がぼやけます。`);
      advice.push(`季語は「${kigo[0].w}」か「${kigo[1].w}」のどちらか一つに絞り、空いた音で“モノ”を描きましょう。`);
    }
    const os = odaiSeason(odai);
    if (kigo.length && os && os !== "四季" && !seasons.includes(os)) add(0, `お題は${os}の場面ですが、季語は${seasons.join("・")}。お題を大胆に飛ばした発想とも読めます。`, "info");

    // --- 切れ字 ---
    const ends = lines.map((l) => l.replace(/[。、！!？?]+$/, ""));
    const kire = [];
    ends.forEach((l, i) => { for (const k of KIREJI) if (l.endsWith(k) && !(k === "や" && /(しや|ちや|きや|にや|りや|いや|おや|まや|もや)$/.test(l) && l.length < 3)) kire.push({ k, i }); });
    // 「や」は上五・中七の終わりだけ、「かな」「けり」は下五の終わりだけを切れ字とみなす
    const kireOk = kire.filter((x) => (x.k === "や" ? x.i < 2 : x.i === 2));
    if (kireOk.length === 1) add(5, `切れ字「${kireOk[0].k}」で一句に「間」が生まれ、場面がくっきりしました。`);
    else if (kireOk.length >= 2) { add(-5, "切れ字が二つ。切れは一句に一つが原則。どちらが言いたいことか決めましょう。"); }

    // --- 感情語・説明・比喩 ---
    const emo = EMOTION.filter((w) => text.includes(w));
    if (emo.length) {
      add(-6 * Math.min(emo.length, 2), `「${emo[0]}」と気持ちを言ってしまうと、読み手が想像する余地がなくなります。`);
      advice.push(`「${emo[0]}」を消して、その気持ちがにじむ“モノ”や“しぐさ”を一つ置きましょう。`);
    }
    const exp = EXPLAIN.filter((w) => text.includes(w));
    if (exp.length) { add(-4, `「${exp[0]}」は理屈・説明の言葉。俳句では理由を言わず、並べて見せるだけで伝わります。`); }
    const sim = SIMILE.filter((w) => text.includes(w));
    if (sim.length) add(-2, `「${sim[0]}」の直喩は便利なぶん、安易になりがち。比喩にするなら、だれも思いつかない取り合わせを。`);

    // --- 五感・具体 ---
    const senses = Object.entries(SENSE).filter(([, ws]) => ws.some((w) => text.includes(w))).map(([k]) => k);
    if (senses.length) add(Math.min(senses.length, 3) * 3, `${senses.join("・")}の言葉があって、映像や感覚が立ち上がります。`);
    else advice.push("色・音・匂い・手ざわりなど、五感の言葉を一つ入れると映像がはっきりします。");
    if (NUM_RE.test(text)) add(3, "数字が入って、景色が具体的になりました。");

    // 形態素解析が使えるときの詳しい分析
    const all = toks.every((t) => t) ? toks.flat() : null;
    if (all) {
      const verbs = all.filter((t) => t.pos === "動詞" && t.pos_detail_1 === "自立");
      if (verbs.length >= 3) {
        add(-5, `動詞が${verbs.length}つ（${uniq(verbs.map((v) => v.basic_form)).join("・")}）。動きが多いと焦点がぼやけます。`);
        advice.push("動詞は一つか二つに。いちばん大事な動きだけを残しましょう。");
      }
      const nouns = all.filter((t) => t.pos === "名詞" && !["非自立", "代名詞", "数", "接尾"].includes(t.pos_detail_1));
      if (nouns.length >= 3) add(3, "名詞（モノ）がしっかり描けていて、具体的です。");
      else if (nouns.length <= 1) add(-3, "モノ（名詞）が少なく、ふわっとした印象。手に取れるモノを一つ。");
      if (all.some((t) => t.pos === "名詞" && t.pos_detail_1 === "固有名詞")) add(2, "固有名詞が効いて、場所や時代が見えます。");
      const last = [...toks[2]].reverse().find((t) => t.pos !== "記号");
      if (last && last.pos === "名詞" && !kireOk.some((x) => x.i === 2)) add(3, "名詞で止めた「体言止め」。余韻が残ります。");
    }

    // --- 手垢のついた表現 ---
    const cl = CLICHE.filter((w) => text.includes(w));
    if (cl.length) add(-3, `「${cl[0]}」はよく見かける言い回し。あなただけの発見を一つ。`);
    const clo = CLICHE_ONO.filter((w) => text.includes(w));
    if (clo.length) add(-3, `「${clo[0]}」は手垢のついたオノマトペ。自分の耳で聞いた音にしてみては。`);
    else {
      const ono = text.match(/([ぁ-ゖ]{2})\1|([ァ-ヺ]{2})\2/);
      if (ono) add(3, `オノマトペ「${ono[0]}」が新鮮。音がそのまま景色になっています。`);
    }

    // --- お題との距離 ---
    if (odai && odai.kw) {
      const hit = odai.kw.filter((k) => text.includes(k));
      if (hit.length >= 3) { add(-5, "お題の場面をそのままなぞっています。写真に写っていない“何か”を一つ。"); advice.push("お題に写っているものは一つまでに。残りの音で、写真の外（音・匂い・記憶）を描きましょう。"); }
      else if (hit.length === 0) add(2, "お題から発想をうまく飛ばしています。");
    }

    // --- くり返し ---
    const kanjiWords = text.match(/[㐀-鿿]{2,}/g) || [];
    const dup = kanjiWords.find((w, i) => kanjiWords.indexOf(w) !== i);
    if (dup) add(-2, `「${dup}」が二度出てきます。くり返すなら狙いをはっきり。`);

    // --- 一句の味わい（ほんの少しのゆらぎ） ---
    const jitter = (hashStr(text) % 7) - 3;
    score += pts.reduce((a, p) => a + p.d, 0) + jitter;
    score = Math.max(5, Math.min(98, Math.round(score)));
    const verdict = verdictOf(score);

    if (!advice.length) {
      if (score >= 85) advice.push("直すところはほぼなし。このまま句帳に残しましょう。");
      else advice.push("基本はできています。次は「取り合わせ」（季語と関係なさそうなモノのぶつけ合い）に挑戦してみましょう。");
    }

    const goods = pts.filter((p) => p.k === "good").sort((a, b) => b.d - a.d);
    const bads = pts.filter((p) => p.k === "bad").sort((a, b) => a.d - b.d);
    let summary;
    if (score >= 85) summary = `お見事。${goods[0] ? goods[0].t : ""}一語一語に無駄がありません。`;
    else if (score >= 70) summary = `いい句です。${goods[0] ? goods[0].t : ""}${bads[0] ? "ただ、" + bads[0].t : ""}`;
    else if (score >= 50) summary = `惜しい。${bads[0] ? bads[0].t : ""}${goods[0] ? "とはいえ、" + goods[0].t : ""}`;
    else summary = `厳しく言います。${bads[0] ? bads[0].t : ""}${bads[1] ? bads[1].t : ""}でも、ここから伸びます。`;

    return { score, verdict, lines, moras, reads, kigo, pts, advice: uniq(advice).slice(0, 3), summary };
  }

  function verdictOf(score) {
    if (score >= 70) return "才能アリ";
    if (score >= 50) return "凡人";
    return "才能ナシ";
  }

  window.Judge = { judge, readLine, tokenize, countMora, loadDict, onDict, verdictOf, toHira, get ready() { return dictState === "ready"; } };
})();

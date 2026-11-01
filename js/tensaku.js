/* 句レバト — 添削のビフォーアフター
 * 先生の指摘をもとに「一か所だけ」差しかえた案をいくつも作って査定し直し、
 * いちばん点が上がった案を「この一語で 62点 → 74点」と見せる。
 *
 * 案の作り方
 *  1. 字余りの行：助詞（の・が・を・は・に・て・と・も・へ・で）を一つ削る
 *  2. 気持ちを言う言葉・説明・ありがちな言い回しがある行：同じ音数の“モノ”の言葉に差しかえる
 *  3. 季重なり：季語の入った行を、季語のない同じ音数の言葉に差しかえる
 *  4. 季語なし：上五（または下五）を季語の言葉に差しかえる
 *  5. それ以外：下五を名詞で止める案など
 * 差しかえの言葉は「はじめての一句」の言葉札（kotoba.js）から選ぶ。
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const J = window.Judge, K = window.KOTOBA, KG = window.KIGO;
  const esc = (s) => window.App.esc(s);
  const TARGET = [5, 7, 5];
  const PARTICLES = ["の", "が", "を", "は", "に", "て", "と", "も", "へ", "で"];
  const EMO_RE = /悲し|かなし|寂し|淋し|さびし|さみし|嬉し|うれし|楽し|たのし|懐かし|なつかし|切な|せつな|美し|うつくし|綺麗|きれい|キレイ|素敵|すてき|幸せ|しあわせ|感動|愛し|恋し|辛い|つらい|苦し|怖い|こわい|ワクワク|わくわく|ドキドキ|どきどき|最高|大好き|ので|だから|なので|けれど|だけど|なのに|ように|ような|みたい|青い空|夕焼け空|桜舞う|思い出|あの日|永遠|きらきら|キラキラ|ふわふわ|ひらひら|ぽかぽか/;
  const seasonOf = (odai) => {
    const s = odai && odai.season;
    if (s === "梅雨") return "夏";
    if (!s || s === "四季") return window.Fuzei ? window.Fuzei.today.season : "春";
    return s === "新年" ? "冬" : s;
  };
  // 罠札は使わない。行に合わせた候補の言葉
  function pool(i, kind, season) {
    if (i === 1) return K.naka.ふつう;
    if (kind === "kigo") return i === 0 ? K.kami[season] || [] : K.shimo.季.filter((x) => KG.find(x.w).some((k) => k.season === season));
    if (kind === "nokigo") return i === 0 ? K.kami.無季 : K.shimo.ふつう;
    return i === 0 ? [...K.kami.無季, ...(K.kami[season] || [])] : K.shimo.ふつう;
  }
  const sample = (arr, n, seed) => {
    const a = [...arr];
    let s = seed || 1;
    for (let i = a.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  };

  const sum = (pts) => pts.reduce((a, p) => a + p.d, 0);
  function suggest(result, odai) {
    if (!result || !result.lines || result.score >= 95) return [];
    const lines = result.lines;
    const baseYomi = result.reads.map((r) => (r.guess ? null : r.yomi));
    const season = seasonOf(odai);
    const kigoLines = lines.map((l) => KG.find(l).length);
    const totalKigo = KG.find(lines.join("")).length;
    let seed = 7; for (const c of lines.join("")) seed = (seed * 31 + c.charCodeAt(0)) % 2147483647;
    const cands = [];
    const push = (i, to, yomi, why, minimal) => {
      if (!to || to === lines[i]) return;
      const nl = lines.slice(); nl[i] = to;
      const ny = baseYomi.slice(); ny[i] = yomi || null;
      cands.push({ i, from: lines[i], to, lines: nl, yomi: ny, why, minimal: !!minimal });
    };

    lines.forEach((l, i) => {
      const m = result.moras[i];
      // 1. 字余り → 助詞を一つ削る
      if (m > TARGET[i] && !result.reads[i].guess) {
        [...l].forEach((c, k) => {
          if (!PARTICLES.includes(c) || k === 0) return;
          // 行のまん中の「の」「て」を削ると日本語がくずれやすいので、行末か、ほかの助詞だけ
          if (k < l.length - 1 && (c === "の" || c === "て")) return;
          const to = l.slice(0, k) + l.slice(k + 1);
          const y = result.reads[i].yomi;
          const yi = y.lastIndexOf(c === "は" ? "は" : c);
          push(i, to, yi >= 0 ? y.slice(0, yi) + y.slice(yi + 1) : null, `助詞「${c}」を一つ削って${TARGET[i]}音に`, true);
        });
      }
      // 字余り・字足らず → 同じ音数の言葉に
      if (m !== TARGET[i]) sample(pool(i, totalKigo ? "nokigo" : "kigo", season), 6, seed + i).forEach((x) => push(i, x.w, x.y, `${TARGET[i]}音の言葉に差しかえて、リズムを整える`));
      // 2. 気持ち・説明・ありがち → モノの言葉に
      if (EMO_RE.test(l)) sample(pool(i, kigoLines[i] ? "kigo" : totalKigo ? "nokigo" : "kigo", season), 8, seed + 10 + i).forEach((x) => push(i, x.w, x.y, `気持ちや説明を言わずに、“${x.w}”というモノに語らせる`));
      // 3. 季重なり → 季語のない言葉に（季語が入った行のうち、主役でないほう）
      if (totalKigo >= 2 && kigoLines[i]) sample(pool(i, "nokigo", season), 6, seed + 20 + i).forEach((x) => push(i, x.w, x.y, `季語を一つに絞る（「${KG.find(l)[0].w}」を外す）`));
    });
    // 4. 季語なし → 上五か下五を季語に
    if (totalKigo === 0) {
      sample(pool(0, "kigo", season), 8, seed + 30).forEach((x) => push(0, x.w, x.y, `季語「${KG.find(x.w)[0] ? KG.find(x.w)[0].w : x.w}」を入れて季節を立てる`));
      sample(pool(2, "kigo", season), 4, seed + 31).forEach((x) => push(2, x.w, x.y, `下五に季語を置いて季節を立てる`));
    }
    // 5. まだ案が少なければ、下五を名詞止めに
    if (cands.length < 6) sample(K.shimo.ふつう.filter((x) => !KG.find(x.w).length), 8, seed + 40).forEach((x) => push(2, x.w, x.y, `下五を手に取れる“モノ”で止める`));

    const seen = new Set();
    const out = [];
    for (const c of cands) {
      const key = c.lines.join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const r = J.judge({ lines: c.lines, yomi: c.yomi.some(Boolean) ? c.yomi : null, odai });
      const delta = r.score - result.score;
      // 点のゆらぎはもうないので、3点以上上がったものだけ
      const real = delta;
      if (delta < 3) continue;
      c.real = real;
      const before = new Set(result.pts.map((p) => p.t));
      const after = new Set(r.pts.map((p) => p.t));
      c.gone = result.pts.filter((p) => p.k === "bad" && !after.has(p.t)).map((p) => p.t);
      c.gain = r.pts.filter((p) => p.k === "good" && !before.has(p.t)).map((p) => p.t);
      c.result = r; c.score = r.score; c.delta = delta;
      out.push(c);
    }
    // いちばん小さな直し（助詞を削るだけ）は少し優先する
    out.sort((a, b) => (b.real + (b.minimal ? 4 : 0)) - (a.real + (a.minimal ? 4 : 0)) || b.delta - a.delta);
    // 同じ行の案ばかりにならないよう、行ごとにいちばんいいものを優先して3つ
    const pick = [];
    for (const c of out) if (!pick.some((p) => p.i === c.i)) pick.push(c);
    for (const c of out) if (pick.length < 3 && !pick.includes(c)) pick.push(c);
    return pick.slice(0, 3);
  }

  // ---------- 画面 ----------
  let list = [], idx = 0, base = null, applyCb = null;
  function render(el) {
    if (!list.length) {
      el.innerHTML = base && base.score >= 70
        ? `<div class="ts-title">添削のビフォーアフター</div><p class="ts-none">${base.score >= 85 ? "一語も直すところが見当たりません。お見事。" : "一か所の差しかえで良くなる所は見つかりませんでした。基本はできています。次は自分の言葉で、もう一段上を。"}</p>`
        : `<div class="ts-title">添削のビフォーアフター</div><p class="ts-none">一か所の差しかえでは点が上がりませんでした。下の添削ポイントを手がかりに、自分の言葉で直してみましょう。</p>`;
      return;
    }
    const c = list[idx];
    const NAMES = ["上五", "中七", "下五"];
    const col = (lines, hi, cls) => `<div class="ts-tan ${cls}">${lines.map((l, i) => `<span class="${i === hi ? "hi" : ""}">${esc(l)}</span>`).join("")}</div>`;
    el.innerHTML = `
      <div class="ts-title">添削のビフォーアフター</div>
      <p class="ts-lead">${NAMES[c.i]}の一か所で <b>${base.score}点 → ${c.score}点</b><br><small>型 ${base.kata}→${c.result.kata}　表現 ${base.hyogen}→${c.result.hyogen}</small></p>
      <div class="ts-pair">
        <div class="ts-side"><div class="ts-label">before</div>${col(base.lines, c.i, "before")}<div class="ts-score">${base.score}<small>点</small></div></div>
        <div class="ts-arrow"><span>添削</span>→</div>
        <div class="ts-side"><div class="ts-label">after</div>${col(c.lines, c.i, "after")}<div class="ts-score up">${c.score}<small>点</small><em>+${c.delta}</em></div></div>
      </div>
      <div class="ts-change">「<s>${esc(c.from)}</s>」→「<b>${esc(c.to)}</b>」</div>
      <p class="ts-why">🖌️ ${esc(c.why)}</p>
      <ul class="ts-diff">${c.gone.map((t) => `<li class="gone">消えた減点：${esc(t)}</li>`).join("")}${c.gain.map((t) => `<li class="gain">ついた加点：${esc(t)}</li>`).join("")}</ul>
      <div class="ts-btns">${list.length > 1 ? `<button class="btn" data-a="next">ほかの添削案（${idx + 1}/${list.length}）</button>` : ""}${applyCb ? `<button class="btn" data-a="apply">この案で書きなおす</button>` : ""}</div>
      <p class="note">※ 言葉の札から機械的に選んだ例です。意味が変わることもあるので、「どこを直すと点が動くか」の手がかりにしてください。</p>`;
  }
  function show(el, result, odai, onApply) {
    base = result; idx = 0; applyCb = onApply || null;
    el.classList.remove("hidden");
    el.innerHTML = `<div class="ts-title">添削のビフォーアフター</div><p class="ts-none">先生が朱を入れています…</p>`;
    setTimeout(() => {
      try { list = suggest(result, odai); } catch (e) { console.warn(e); list = []; }
      render(el);
    }, 60);
    if (!el.dataset.bound) {
      el.dataset.bound = "1";
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-a]"); if (!b) return;
        if (b.dataset.a === "next") { idx = (idx + 1) % list.length; render(el); }
        if (b.dataset.a === "apply" && applyCb && list[idx]) applyCb(list[idx].lines);
      });
    }
  }
  window.Tensaku = { suggest, show };
})();

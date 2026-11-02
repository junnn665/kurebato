/* 句レバト — 画面・ひとりモード（お題・句を書く・査定・段位・句帳） */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const J = window.Judge;
  const ODAI = window.ODAI;

  // ---------- screens ----------
  let current = "home";
  let curOdai = null; // いま見ているお題（季節の演出に使う）
  const ODAI_SCREENS = ["soloOdai", "write", "easy", "judging", "soloResult", "mpVote", "mpReveal"];
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("hidden", s.id !== id));
    current = id;
    window.scrollTo(0, 0);
    if (id === "home") renderHome();
    if (window.Fuzei) window.Fuzei.setSeason(ODAI_SCREENS.includes(id) && curOdai ? curOdai.season : "");
  }
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));

  function toast(html, ms) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = html;
    if (ms) t.style.animationDuration = ms + "ms";
    $("toasts").appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }

  // ---------- お題カード ----------
  const SEASON_LABEL = { 春: "春", 夏: "夏", 秋: "秋", 冬: "冬", 新年: "新年", 梅雨: "梅雨", 四季: "いつでも" };
  function odaiHtml(o, mini) {
    if (!o) return "";
    curOdai = o;
    if (window.Fuzei && ODAI_SCREENS.includes(current)) window.Fuzei.setSeason(o.season);
    return `<div class="odai${mini ? " mini" : ""}">
      <div class="odai-photo" style="background:linear-gradient(135deg,${o.bg[0]},${o.bg[1]})">${o.scene}</div>
      <span class="odai-label">お題</span><span class="odai-season">${SEASON_LABEL[o.season] || o.season}</span>
      <div class="odai-text"><div><div class="odai-title">${esc(o.title)}</div><div class="odai-desc">${esc(o.desc)}</div></div></div>
    </div>`;
  }
  const odaiById = (id) => ODAI.find((o) => o.id === id) || ODAI[0];
  function pickOdai(season, not) {
    let pool = ODAI.filter((o) => !season || o.season === season || (season === "夏" && o.season === "梅雨") || (season === "冬" && o.season === "新年"));
    if (pool.length > 1 && not) pool = pool.filter((o) => o.id !== not);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- 段位 ----------
  const TIERS = ["新人"];
  ["5級", "4級", "3級", "2級", "1級"].forEach((k) => TIERS.push("特待生" + k));
  ["初段", "二段", "三段", "四段", "五段", "六段", "七段", "八段", "九段", "十段"].forEach((k) => TIERS.push("名人" + k));
  TIERS.push("永世名人");
  const MAX = TIERS.length - 1;
  const passLine = (L) => Math.min(88, 72 + (L - 1));
  const DOWN_LINE = 45;
  const ARI_NEED = 3;
  const getRank = () => ls.get("kure.rank", { L: 0, ari: 0 });
  function applyRank(score) {
    const r = getRank();
    const before = r.L;
    let kind = "stay", text = "";
    if (r.L === 0) {
      if (score >= 70) {
        r.ari++;
        if (r.ari >= ARI_NEED) { r.L = 1; kind = "up"; text = "才能アリ 3回達成！ 特待生に昇格"; }
        else { kind = "step"; text = `才能アリ ${r.ari} / ${ARI_NEED}　特待生まで あと${ARI_NEED - r.ari}回`; }
      } else text = `特待生まで 才能アリ あと${ARI_NEED - r.ari}回`;
    } else if (r.L < MAX) {
      const line = passLine(r.L);
      if (score >= line) { r.L++; kind = "up"; text = `昇格試験 合格！（合格ライン ${line}点）`; }
      else if (score < DOWN_LINE && r.L > 1) { r.L--; kind = "down"; text = `${DOWN_LINE}点未満で 1ランク降格……`; }
      else text = `現状維持（合格ライン ${line}点・${DOWN_LINE}点未満で降格）`;
    } else text = "永世名人。もうあなたに教えることはありません。";
    ls.set("kure.rank", r);
    return { kind, text, before: TIERS[before], after: TIERS[r.L], L: r.L };
  }
  function rankLabel() {
    const r = getRank();
    return r.L === 0 ? `新人 <small>（才能アリ ${r.ari}/${ARI_NEED}）</small>` : TIERS[r.L];
  }

  // ---------- ホーム ----------
  function renderHome() {
    const kucho = ls.get("kure.kucho", []);
    const T = window.Fuzei && window.Fuzei.today;
    if (T) $("jikou").innerHTML = `<span class="j-mon">${T.getsumei}</span><span class="j-sek">${T.sekki}のころ</span><span class="j-sea">季は${T.season}</span>`;
    $("rankBadge").innerHTML = `🏅 <b>${rankLabel()}</b>${kucho.length ? `<span class="note">・${kucho.length}句</span>` : ""}`;
  }

  // ---------- ひとり：お題 ----------
  let soloSeason = "";
  let soloOdai = null;
  $("soloBtn").addEventListener("click", () => { soloOdai = pickOdai(soloSeason); renderSoloOdai(); show("soloOdai"); });
  $("seasonSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    soloSeason = b.dataset.season;
    $("seasonSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    soloOdai = pickOdai(soloSeason, soloOdai && soloOdai.id); renderSoloOdai();
  });
  $("odaiShuffle").addEventListener("click", () => { soloOdai = pickOdai(soloSeason, soloOdai && soloOdai.id); renderSoloOdai(); });
  function renderSoloOdai() { $("soloOdaiCard").innerHTML = odaiHtml(soloOdai); }
  $("odaiGo").addEventListener("click", () => openWrite({ odai: soloOdai, mode: "solo", onSubmit: soloSubmit, onBack: () => show("soloOdai") }));

  // ---------- 句を書く ----------
  let W = null; // 今の書く画面の設定
  let timerId = null;
  const L = [0, 1, 2].map((i) => $("l" + i));
  const YE = [0, 1, 2].map((i) => $("ye" + i));

  function openWrite(opts) {
    W = { ...opts, submitted: false };
    $("writeOdai").innerHTML = odaiHtml(opts.odai, true);
    $("writeTitle").textContent = opts.title || "一句どうぞ";
    if (!opts.keep) { L.forEach((x) => (x.value = "")); YE.forEach((x) => (x.value = "")); $("yomiEdit").classList.add("hidden"); }
    setWriteLocked(false);
    $("submitBtn").textContent = opts.mode === "mp" ? "📮 提出する" : "🖌️ 査定してもらう";
    $("writeMsg").textContent = "";
    $("writeMsg").className = "msg";
    $("mpProgress").classList.toggle("hidden", opts.mode !== "mp");
    $("writeBack").textContent = opts.mode === "mp" ? "‹ 部屋を出る" : "‹ もどる";
    clearInterval(timerId);
    $("writeTimer").classList.toggle("hidden", !opts.deadline);
    if (opts.deadline) { timerId = setInterval(tickTimer, 250); tickTimer(); }
    show("write");
    updateMora();
    J.loadDict();
  }
  function tickTimer() {
    if (!W || !W.deadline) return;
    const left = Math.max(0, W.deadline - W.now());
    const s = Math.ceil(left / 1000);
    $("writeTimer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("writeTimer").classList.toggle("hurry", s <= 20);
    if (left <= 600 && !W.submitted) { doSubmit(true); }
    if (left <= 0) clearInterval(timerId);
  }
  function setWriteLocked(on) {
    [...L, ...YE].forEach((x) => (x.disabled = on));
    $("submitBtn").disabled = on;
  }
  $("writeBack").addEventListener("click", () => {
    if (W && W.onBack) W.onBack();
    else show("home");
  });

  // 1行目に「a b c」と貼りつけたら3行に分ける
  L[0].addEventListener("input", () => {
    const parts = L[0].value.trim().split(/[\s　／/]+/).filter(Boolean);
    if (parts.length === 3) { parts.forEach((p, i) => (L[i].value = p)); L[2].focus(); }
  });
  L.forEach((x, i) => {
    x.addEventListener("input", updateMora);
    x.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); if (i < 2) L[i + 1].focus(); else x.blur(); } });
  });
  YE.forEach((x) => x.addEventListener("input", updateMora));
  $("yomiToggle").addEventListener("click", () => {
    const ed = $("yomiEdit");
    ed.classList.toggle("hidden");
    if (!ed.classList.contains("hidden")) YE.forEach((x, i) => { if (!x.value) x.placeholder = (lastReads[i] && lastReads[i].yomi.replace(/〇/g, "？")) || x.placeholder; });
  });
  let lastReads = [];
  function updateMora() {
    const target = [5, 7, 5];
    lastReads = L.map((x, i) => {
      const manual = YE[i].value.trim();
      if (manual) return { yomi: J.toHira(manual), mora: J.countMora(manual), guess: false };
      return J.readLine(x.value, J.tokenize(x.value.trim()));
    });
    lastReads.forEach((r, i) => {
      const m = $("m" + i);
      const has = L[i].value.trim().length > 0;
      m.textContent = has ? r.mora : 0;
      m.className = "mora" + (!has ? "" : r.mora === target[i] ? " ok" : r.mora > target[i] ? " over" : " under") + (has && r.guess ? " guess" : "");
      $("y" + i).textContent = has ? r.yomi.replace(/〇/g, "？") : "";
    });
    const kigo = window.KIGO.find(L.map((x) => x.value).join(""));
    $("kigoHint").innerHTML = kigo.length
      ? `季語：${kigo.map((k) => `<span class="kigo-chip${kigo.length > 1 ? " warn" : ""}">${esc(k.w)}・${k.season}</span>`).join("")}${kigo.length > 1 ? "<span class='note'>季重なり？</span>" : ""}`
      : (L.some((x) => x.value.trim()) ? `<span class="note">季語：まだ見つかりません</span>` : "");
  }
  J.onDict((st) => {
    $("dictState").textContent = { idle: "", loading: "📖 辞書を読みこみ中…（よみは推定）", ready: "📖 よみ 自動", failed: "📖 よみは推定（漢字1字＝2音）" }[st];
    if (st === "ready" && current === "write") updateMora();
  });

  $("submitBtn").addEventListener("click", () => doSubmit(false));
  function doSubmit(auto) {
    if (!W || W.submitted) return;
    const lines = L.map((x) => x.value.trim());
    if (!auto && lines.some((l) => !l)) { $("writeMsg").textContent = "上五・中七・下五、ぜんぶ書いてね"; return; }
    const yomi = YE.map((x) => x.value.trim() || null);
    W.submitted = true;
    setWriteLocked(true);
    const result = J.judge({ lines, yomi: yomi.some(Boolean) ? yomi : null, odai: W.odai });
    W.onSubmit(result, lines, yomi, auto);
  }

  // ---------- ひとり：査定 ----------
  let lastMode = "solo";
  let tensakuLines = [];
  let pendingChain = null; // 推敲中の句のつながり（初稿の時刻）
  const chainOf = (k) => k.chain || k.t; // 添削案（そのまま出した句は段位・番付に数えない）
  let lastEntry = null;
  function soloSubmit(result, lines, mode, odai) {
    mode = mode === "easy" ? "easy" : "solo";
    odai = odai || W.odai;
    lastMode = mode;
    show("judging");
    setTimeout(() => {
      const now = Date.now();
      const entry = { t: now, lines, score: result.score, verdict: result.verdict, odai: odai.id, mode, chain: pendingChain || now };
      pendingChain = null;
      addKucho(entry);
      renderResult($("soloResultBody"), result, { name: "", odai });
      const fromTensaku = tensakuLines.some((t) => t.join("|") === lines.join("|"));
      if (fromTensaku) {
        $("rankChange").innerHTML = `<div class="rank-change">✍️ 先生の添削案そのままの句です<span class="big">段位・番付には数えません</span></div>`;
      } else if (mode === "easy") {
        $("rankChange").innerHTML = `<div class="rank-change">🔰 はじめての一句（段位には影響しません）<span class="big">${result.score >= 70 ? "見事！ 次は「一句詠む」で自分の言葉を" : "札を入れかえて、もう一句"}</span></div>`;
      } else {
        const rc = applyRank(result.score);
        $("rankChange").innerHTML = `<div class="rank-change ${rc.kind === "up" ? "up" : rc.kind === "down" ? "down" : ""}">${esc(rc.text)}<span class="big">${rc.kind === "up" || rc.kind === "down" ? `${esc(rc.before)} → ${esc(rc.after)}` : esc(rc.after)}</span></div>`;
      }
      lastShare = { lines, score: result.score, verdict: result.verdict, odai };
      lastEntry = { lines, score: result.score, odai: odai.id, div: mode === "easy" ? "easy" : "normal", t: entry.t, chain: entry.chain };
      const versions = ls.get("kure.kucho", []).filter((k) => chainOf(k) === entry.chain).length;
      $("suikouNoteBtn").classList.toggle("hidden", versions < 2);
      $("suikouNoteBtn").textContent = `推敲ノートを見る（${versions}稿）`;
      show("soloResult");
      if (window.Banzuke) window.Banzuke.offer(fromTensaku ? null : lastEntry);
      if (window.Tensaku) {
        window.Tensaku.show($("tensaku"), result, odai, (newLines) => {
          tensakuLines.push(newLines);
          pendingChain = entry.chain;
          L.forEach((x, i) => { x.value = newLines[i] || ""; YE[i].value = ""; });
          openWrite({ odai, mode: "solo", keep: true, title: "添削案から書きなおす", onSubmit: soloSubmit, onBack: () => { pendingChain = null; show("soloResult"); } });
        });
      }
      if (window.Zukan) window.Zukan.collect(lines, result.score);
    }, 1700);
  }
  // 採点の内訳：型3項目・表現6項目。項目ごとに点・しるし・先生のひとこと
  const mark = (got, max) => { const r = got / max; return r >= 0.9 ? "◎" : r >= 0.65 ? "○" : r >= 0.4 ? "△" : "×"; };
  function breakdownHtml(r, compact) {
    if (!r || !r.parts || !r.parts.length) return "";
    const pts = r.pts || [];
    const sign = (d) => (d > 0 ? `+${d}` : d < 0 ? `${d}` : "");
    const group = (g, total, max) => `
      <div class="bd-group">
        <div class="bd-ghead"><span class="bd-gname">${g}</span><span class="bd-gbar ${g === "型" ? "kata" : "hyo"}"><i style="width:${Math.round((total / max) * 100)}%"></i></span><span class="bd-gnum"><b>${total}</b>/${max}</span></div>
        ${r.parts.filter((p) => p.group === g).map((p) => {
          const notes = compact ? [] : pts.filter((x) => x.c === p.name && x.t);
          return `<div class="bd-item">
            <div class="bd-line"><span class="bd-mark m${mark(p.got, p.max)}">${mark(p.got, p.max)}</span><span class="bd-name">${p.name}</span><span class="bd-bar ${g === "型" ? "kata" : "hyo"}"><i style="width:${Math.round((p.got / p.max) * 100)}%"></i></span><span class="bd-num">${p.got}<small>/${p.max}</small></span></div>
            ${compact ? "" : `<div class="bd-desc">${esc(p.desc || "")}</div>`}
            ${notes.length ? `<ul class="bd-notes">${notes.map((x) => `<li class="${x.k}">${x.d ? `<b>${sign(x.d)}</b>` : ""}${esc(x.t)}</li>`).join("")}</ul>` : ""}
          </div>`;
        }).join("")}
      </div>`;
    return `<div class="breakdown${compact ? " compact" : ""}">${group("型", r.kata, 40)}${group("表現", r.hyogen, 60)}</div>`;
  }
  const vClass = (v) => (v === "才能アリ" ? "ari" : v === "凡人" ? "bon" : v === "才能ナシ" ? "nashi" : "none");
  function renderResult(el, r, { name }) {
    const sign = (d) => (d > 0 ? `+${d}` : d < 0 ? `${d}` : "・");
    el.innerHTML = `
      <div class="result">
        <div class="tanzaku">${r.lines.map((l) => `<span class="t-line">${esc(l)}</span>`).join("")}${name ? `<span class="t-name">${esc(name)}</span>` : ""}</div>
        <div class="verdict-box">
          <div class="hanko ${vClass(r.verdict)}"><span>${r.verdict.replace("才能", "才能<br>")}<small>査定</small></span></div>
          <div class="score">${r.score}<small>点</small></div>
          <div class="summary">${esc(r.summary)}</div>
        </div>
      </div>
      <div class="paper">
        ${breakdownHtml(r)}
        <div class="advice"><b>添削ポイント</b><br>${r.advice.map(esc).join("<br>")}</div>
        <p class="note">音数：${r.moras.join("・")}（${r.reads.map((x) => esc(x.yomi.replace(/〇/g, "？"))).join(" / ")}）</p>
      </div>`;
  }
  $("againBtn").addEventListener("click", () => {
    if (lastMode === "easy") { startEasy(); return; }
    soloOdai = pickOdai(soloSeason, soloOdai && soloOdai.id); renderSoloOdai(); show("soloOdai");
  });

  let lastShare = null;
  // ---------- 推敲ノート ----------
  $("suikouBtn").addEventListener("click", () => {
    if (!lastShare || !lastEntry) return;
    pendingChain = lastEntry.chain;
    L.forEach((x, i) => { x.value = lastShare.lines[i] || ""; YE[i].value = ""; });
    openWrite({ odai: lastShare.odai, mode: "solo", keep: true, title: "推敲", onSubmit: soloSubmit, onBack: () => { pendingChain = null; show("soloResult"); } });
  });
  let suikouFrom = "soloResult";
  $("suikouNoteBtn").addEventListener("click", () => { if (lastEntry) openSuikou(lastEntry.chain, "soloResult"); });
  $("suikouBack").addEventListener("click", () => { if (suikouFrom === "kucho") renderKucho(); show(suikouFrom); });
  const KAN = (n) => (window.Fuzei ? window.Fuzei.kan(n) : String(n));
  function openSuikou(chain, from) {
    suikouFrom = from || "kucho";
    const vs = ls.get("kure.kucho", []).filter((k) => chainOf(k) === chain).sort((a, b) => a.t - b.t);
    if (!vs.length) return;
    const o = odaiById(vs[0].odai);
    // 点数の移り変わり（折れ線）
    const Wd = 320, Hd = 120, pad = 22;
    const xs = (i) => (vs.length === 1 ? Wd / 2 : pad + (i * (Wd - pad * 2)) / (vs.length - 1));
    const lo = Math.max(0, Math.min(60, ...vs.map((k) => k.score)) - 10);
    const ys = (v) => Hd - pad - ((v - lo) * (Hd - pad * 2)) / (100 - lo);
    const pts = vs.map((k, i) => `${xs(i)},${ys(k.score)}`).join(" ");
    const graph = `<svg class="sk-graph" viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="点数の移り変わり">
      <line x1="${pad}" x2="${Wd - pad}" y1="${ys(70)}" y2="${ys(70)}" class="g70"/><text x="${Wd - pad}" y="${ys(70) - 4}" class="g70t">才能アリ 70</text>
      <polyline points="${pts}" class="gl"/>
      ${vs.map((k, i) => `<circle cx="${xs(i)}" cy="${ys(k.score)}" r="5" class="gp ${vClass(k.verdict)}"/><text x="${xs(i)}" y="${ys(k.score) - 10}" class="gv">${k.score}</text><text x="${xs(i)}" y="${Hd - 4}" class="gx">${i === 0 ? "初稿" : KAN(i + 1) + "稿"}</text>`).join("")}
    </svg>`;
    const first = vs[0].score, last = vs[vs.length - 1].score;
    $("suikouBody").innerHTML = `
      <div class="paper center"><div class="note">お題「${esc(o.title)}」</div>
        <div class="sk-sum">${vs.length}稿　<b>${first}点 → ${last}点</b>${last > first ? `<span class="up">+${last - first}</span>` : ""}</div>
        ${graph}</div>
      <div class="sk-list">${vs.map((k, i) => {
        const prev = vs[i - 1];
        const d = prev ? k.score - prev.score : 0;
        return `<div class="sk-ver ${vClass(k.verdict)}">
          <div class="sk-head"><span class="sk-no">${i === 0 ? "初稿" : KAN(i + 1) + "稿"}</span><span class="rv ${vClass(k.verdict)}">${esc(k.verdict)}</span><span class="sk-score">${k.score}<small>点</small>${prev ? `<em class="${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "+" : ""}${d}</em>` : ""}</span></div>
          <div class="sk-text">${k.lines.map((l, j) => `<span class="${prev && prev.lines[j] !== l ? "changed" : ""}">${esc(l)}</span>`).join("")}</div>
          ${prev ? `<div class="sk-diff">${k.lines.map((l, j) => (prev.lines[j] !== l ? `「<s>${esc(prev.lines[j])}</s>」→「<b>${esc(l)}</b>」` : "")).filter(Boolean).join("　")}</div>` : ""}
        </div>`;
      }).join("")}</div>`;
    show("suikou");
  }
  const myHaigo = () => ls.get("kure.name", "") || "";
  $("shikishiBtn").addEventListener("click", () => {
    if (!lastShare || !window.Shikishi) return;
    window.Shikishi.open({ lines: lastShare.lines, name: myHaigo(), score: lastShare.score, verdict: lastShare.verdict, odai: lastShare.odai.title });
  });
  $("shareBtn").addEventListener("click", () => {
    if (!lastShare) return;
    const s = lastShare;
    const text = `【句レバト】お題「${s.odai.title}」\n${s.lines.join("　")}\n査定：${s.score}点 ${s.verdict}\n#句レバト`;
    const url = location.origin + location.pathname;
    if (navigator.share) navigator.share({ text, url }).catch(() => {});
    else navigator.clipboard.writeText(text + "\n" + url).then(() => toast("コピーしました"), () => toast("コピーできませんでした"));
  });

  // ---------- 句帳 ----------
  $("kuchoBtn").addEventListener("click", () => { renderKucho(); show("kucho"); });
  function renderKucho() {
    const list = ls.get("kure.kucho", []);
    const n = list.length;
    const best = n ? Math.max(...list.map((k) => k.score)) : 0;
    const avg = n ? Math.round(list.reduce((a, k) => a + k.score, 0) / n) : 0;
    const ari = list.filter((k) => k.verdict === "才能アリ").length;
    $("kuchoStats").innerHTML = `<div><b>${n}</b>句</div><div><b>${best}</b>最高点</div><div><b>${avg}</b>平均</div><div><b>${ari}</b>才能アリ</div>`;
    const chainCount = {};
    list.forEach((k) => { chainCount[chainOf(k)] = (chainCount[chainOf(k)] || 0) + 1; });
    const shownChain = new Set();
    $("kuchoList").innerHTML = n ? list.map((k) => {
      const o = odaiById(k.odai);
      const c = chainOf(k);
      const isLatest = !shownChain.has(c); shownChain.add(c);
      const sk = chainCount[c] > 1 && isLatest ? `<button class="k-suikou" data-chain="${c}">✍️ 推敲 ${chainCount[c]}稿</button>` : "";
      const d = new Date(k.t);
      return `<div class="kitem"><button class="k-shikishi" data-i="${list.indexOf(k)}" aria-label="色紙にする">🖼</button><div class="k-text">${k.lines.map(esc).join("　")}</div>
        <div class="k-score">${k.score}<small class="v-${vClass(k.verdict)}">${esc(k.verdict)}</small></div>
        ${sk}<div class="k-meta">お題「${esc(o.title)}」・${d.getMonth() + 1}/${d.getDate()}${k.mode === "mp" ? "・⚔️対戦" + (k.rank ? ` ${k.rank}位` : "") : k.mode === "easy" ? "・🔰はじめて" : ""}</div></div>`;
    }).join("") : `<div class="empty">まだ一句もありません。<br>ひとりで査定 か 対戦で一句詠もう</div>`;
  }
  $("kuchoList").addEventListener("click", (e) => {
    const sb = e.target.closest(".k-suikou");
    if (sb) { openSuikou(Number(sb.dataset.chain), "kucho"); return; }
    const b = e.target.closest(".k-shikishi"); if (!b || !window.Shikishi) return;
    const k = ls.get("kure.kucho", [])[Number(b.dataset.i)]; if (!k) return;
    window.Shikishi.open({ lines: k.lines, name: myHaigo(), score: k.score, verdict: k.verdict, odai: odaiById(k.odai).title });
  });
  function addKucho(entry) { const k = ls.get("kure.kucho", []); k.unshift(entry); ls.set("kure.kucho", k.slice(0, 300)); }

  // ---------- 段位 ----------
  $("dankiBtn").addEventListener("click", () => { renderDanki(); show("danki"); });
  function renderDanki() {
    const r = getRank();
    $("dankiBody").innerHTML = `
      <div class="paper center"><div class="note">いまの段位</div><div class="code" style="font-size:34px;letter-spacing:.05em">${rankLabel()}</div>
      <p class="note">${r.L === 0 ? `才能アリ（70点以上）を ${ARI_NEED} 回とると 特待生5級` : r.L < MAX ? `次の昇格試験の合格ライン：<b>${passLine(r.L)}点</b>（${DOWN_LINE}点未満で降格）` : "頂点です"}</p></div>
      <ul class="ladder">${TIERS.map((t, i) => `<li class="${i === r.L ? "me" : i < r.L ? "done" : ""}"><span>${t}</span><span class="need">${i === 0 ? "" : i === 1 ? `才能アリ${ARI_NEED}回` : `${passLine(i - 1)}点で昇格`}</span></li>`).reverse().join("")}</ul>
      <p class="note center">段位は「ひとりで査定」で上がります（対戦の点は句帳に記録）</p>`;
  }

  $("howtoBtn").addEventListener("click", () => show("howto"));

  // ---------- はじめての一句（言葉の札をえらぶ） ----------
  const K = window.KOTOBA;
  const LINE_NAMES = ["上五", "中七", "下五"];
  const LINE_GUIDE = [
    "まずは<b>上五</b>。季語の札から季節をえらぼう",
    "つぎは<b>中七</b>。だれが・何が・どうしている？",
    "さいごに<b>下五</b>。手に取れる“モノ”で止めると締まる",
  ];
  // mp: 対戦で使うときの設定 { deadline, now, onSubmit, onBack, title }
  const E = { odai: null, picks: [null, null, null], active: 0, offers: [[], [], []], mp: null, submitted: false };
  let easyTimer = null;
  // 札バトルでは、全員に同じ札を配るため、決まった種から乱数を出す
  let rnd = Math.random;
  const seeded = (seed) => { let t = seed >>> 0; return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const take = (arr, n, not) => shuffle(arr.filter((x) => !not || !not.some((y) => y.w === x.w))).slice(0, n);
  const todaySeason = () => (window.Fuzei ? window.Fuzei.today.season : "春");
  function easySeason() {
    const s = E.odai && E.odai.season;
    return s === "梅雨" ? "夏" : !s || s === "四季" ? todaySeason() : s;
  }
  // 一度に出す札は各行12枚（「ほかの札」を押すと、いま出ている札とは別の12枚）
  const OFFER = 12;
  const seasonOfWord = (w) => { const k = window.KIGO.find(w)[0]; return k ? (k.season === "新年" ? "冬" : k.season) : null; };
  function makeOffer(i) {
    const prev = E.offers[i];
    let out;
    if (i === 0) {
      const s = easySeason();
      const pool = s === "新年" ? [...K.kami.新年, ...K.kami.冬] : K.kami[s];
      out = [...take(pool, 8, prev), ...take(K.kami.無季, 2, prev), ...take(K.kami.罠, 2, prev)];
    } else if (i === 1) {
      out = [...take(K.naka.ふつう, 10, prev), ...take(K.naka.罠, 2, prev)];
    } else {
      // 下五の季語の札は、お題の季節のものを1枚と、ほかの季節のものを1枚（季重なり・季違いの罠）
      const s = easySeason() === "新年" ? "冬" : easySeason();
      const same = K.shimo.季.filter((x) => seasonOfWord(x.w) === s);
      const other = K.shimo.季.filter((x) => seasonOfWord(x.w) !== s);
      out = [...take(K.shimo.ふつう, 8, prev), ...take(same, 1, prev), ...take(other, 1, prev), ...take(K.shimo.罠, 2, prev)];
    }
    E.offers[i] = shuffle(out).slice(0, OFFER);
  }
  function startEasy(keepOdai, mp) {
    E.mp = mp || null;
    if (mp) E.odai = mp.odai;
    else if (!keepOdai || !E.odai) E.odai = pickOdai("", E.odai && E.odai.id);
    E.picks = [null, null, null]; E.active = 0; E.offers = [[], [], []]; E.submitted = false;
    rnd = mp && mp.seed != null ? seeded(mp.seed) : Math.random;
    [0, 1, 2].forEach(makeOffer);
    // 対戦のときは、お題の変更と「自分で直す」はなし。タイマーと進み具合を出す
    $("easyOdaiNext").classList.toggle("hidden", !!mp);
    $("easyEdit").classList.toggle("hidden", !!mp);
    $("easyProgress").classList.toggle("hidden", !mp);
    $("easyTimer").classList.toggle("hidden", !mp);
    $("easyTitle").textContent = mp ? mp.title || "言葉の札で一句" : "はじめての一句";
    $("easyBack").textContent = mp ? "‹ 部屋を出る" : "‹ もどる";
    $("easySubmit").textContent = mp ? "📮 提出する" : "🖌️ 査定してもらう";
    $("easyMsg").textContent = "";
    lockEasy(false); // 前のラウンドで提出したときのロックを外す
    clearInterval(easyTimer);
    if (mp) { easyTimer = setInterval(tickEasy, 250); tickEasy(); }
    show("easy");
    renderEasy();
  }
  function tickEasy() {
    if (!E.mp) { clearInterval(easyTimer); return; }
    const left = Math.max(0, E.mp.deadline - E.mp.now());
    const sec = Math.ceil(left / 1000);
    $("easyTimer").textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    $("easyTimer").classList.toggle("hurry", sec <= 20);
    if (left <= 600 && !E.submitted) {
      // 時間切れ：書きかけの言葉があればそれを使い、残りの空いた欄は出ている札から自動で埋めて提出
      if (!E.picks[E.active] && $("easyInput").value.trim()) takeTyped();
      E.picks = E.picks.map((p, i) => p || E.offers[i].find((x) => !K.isTrap(x)) || E.offers[i][0]);
      submitEasy(true);
    }
    if (left <= 0) clearInterval(easyTimer);
  }
  function updateTypedMora() {
    const w = $("easyInput").value.trim();
    const r = w ? J.readLine(w, J.tokenize(w)) : { mora: 0, yomi: "", guess: false };
    const t = E.active === 1 ? 7 : 5;
    $("easyInputMora").textContent = r.mora + (r.guess ? "?" : "");
    $("easyInputMora").className = "et-mora" + (!w ? "" : r.mora === t ? " ok" : " ng");
    $("easyInputYomi").textContent = w ? r.yomi.replace(/〇/g, "？") : "";
    $("easyInputOk").disabled = !w || E.submitted;
  }
  function takeTyped() {
    const w = $("easyInput").value.replace(/\s+/g, "").trim();
    if (!w || E.submitted) return false;
    E.picks[E.active] = { w, y: null, typed: true };
    return true;
  }
  $("easyInput").addEventListener("input", updateTypedMora);
  $("easyInputOk").addEventListener("click", () => {
    if (!takeTyped()) return;
    $("easyInput").blur();
    const next = E.picks.findIndex((p) => !p);
    if (next >= 0) E.active = next;
    renderEasy();
  });
  $("easyInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); $("easyInputOk").click(); } });
  function lockEasy(on) {
    $("easyInput").disabled = on;
    $("easyInputOk").disabled = on || !$("easyInput").value.trim();
    $("easySubmit").disabled = on || !E.picks.every(Boolean);
    $("easyMore").disabled = on;
    $("easyChips").querySelectorAll("button").forEach((b) => (b.disabled = on));
    $("easySlots").querySelectorAll("button").forEach((b) => (b.disabled = on));
  }
  function submitEasy(auto) {
    if (E.submitted || !E.picks.every(Boolean)) return;
    const lines = E.picks.map((p) => p.w);
    const result = J.judge({ lines, yomi: E.picks.map((p) => p.y || null), odai: E.odai });
    if (E.mp) {
      E.submitted = true;
      renderEasy();
      lockEasy(true);
      $("easyMsg").textContent = auto ? "⏰ 時間切れ。札をそろえて提出しました" : "📮 提出しました。みんなを待っています…";
      E.mp.onSubmit(result, lines, null, auto);
      return;
    }
    soloSubmit(result, lines, "easy", E.odai);
  }
  function renderEasy() {
    $("easyOdai").innerHTML = odaiHtml(E.odai, true);
    $("easySlots").innerHTML = E.picks.map((p, i) => `<button class="slot${i === E.active ? " on" : ""}${p ? " filled" : ""}${p && p.typed ? " typed" : ""}" data-i="${i}"><span class="slot-name">${LINE_NAMES[i]}</span><span class="slot-word">${p ? esc(p.w) : "　？　"}</span>${p && p.typed ? '<span class="slot-typed">✍️</span>' : ""}</button>`).join("");
    $("easyPreview").innerHTML = `<div class="mini-tanzaku">${E.picks.map((p) => `<span>${p ? esc(p.w) : "　"}</span>`).join("")}</div>`;
    $("easyGuide").innerHTML = E.picks.every(Boolean) ? "そろいました。入れかえるなら、上の欄をタップ" : LINE_GUIDE[E.active];
    // 手で書く欄：いまの行の名前と、手で書いた言葉が入っていればそれを出す
    $("etLine").textContent = LINE_NAMES[E.active];
    const cur = E.picks[E.active];
    if (document.activeElement !== $("easyInput")) $("easyInput").value = cur && cur.typed ? cur.w : "";
    $("easyInput").placeholder = `${LINE_NAMES[E.active]}（${E.active === 1 ? 7 : 5}音）を書く`;
    updateTypedMora();
    const kigoIn = (w) => window.KIGO.find(w).length > 0;
    // 上五・下五（5音）は3列、中七（7音）は2列
    $("easyChips").classList.toggle("c3", E.active !== 1);
    $("easyChips").innerHTML = E.offers[E.active].map((x, j) => {
      const sel = E.picks[E.active] && E.picks[E.active].w === x.w;
      const mora = J.countMora(x.y);
      return `<button class="chip${sel ? " on" : ""}" data-j="${j}"><span class="chip-w">${esc(x.w)}</span><span class="chip-y">${esc(x.y)}</span><span class="chip-m${mora !== (E.active === 1 ? 7 : 5) ? " over" : ""}">${mora}</span>${kigoIn(x.w) ? '<span class="chip-k">季</span>' : ""}</button>`;
    }).join("");
    $("easySubmit").disabled = E.submitted || !E.picks.every(Boolean);
    if (E.submitted) lockEasy(true);
  }
  $("easyBtn").addEventListener("click", () => startEasy(false));
  $("easyBack").addEventListener("click", () => { if (E.mp && E.mp.onBack) E.mp.onBack(); else show("home"); });
  $("easySlots").addEventListener("click", (e) => { const b = e.target.closest(".slot"); if (!b || E.submitted) return; E.active = Number(b.dataset.i); renderEasy(); });
  $("easyChips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b || E.submitted) return;
    E.picks[E.active] = E.offers[E.active][Number(b.dataset.j)];
    const next = E.picks.findIndex((p) => !p);
    if (next >= 0) E.active = next;
    renderEasy();
  });
  $("easyMore").addEventListener("click", () => { makeOffer(E.active); renderEasy(); });
  $("easyOdaiNext").addEventListener("click", () => { E.odai = pickOdai("", E.odai && E.odai.id); E.offers[0] = []; makeOffer(0); renderEasy(); });
  $("easyEdit").addEventListener("click", () => {
    E.picks.forEach((p, i) => { L[i].value = p ? p.w : ""; YE[i].value = ""; });
    openWrite({ odai: E.odai, mode: "solo", keep: true, onSubmit: soloSubmit, onBack: () => show("easy") });
  });
  $("easySubmit").addEventListener("click", () => submitEasy(false));

  // 他のファイル（net.js）から使う
  window.App = { get lastEntry() { return lastEntry; }, breakdownHtml, show, toast, esc, ls, odaiHtml, odaiById, pickOdai, openWrite, renderResult, vClass, addKucho, get current() { return current; }, get write() { return W; }, setWriteMsg(t, info) { $("writeMsg").textContent = t; $("writeMsg").className = "msg" + (info ? " info" : ""); }, stopTimer() { clearInterval(timerId); clearInterval(easyTimer); },
    openEasyMp(opts) { startEasy(false, opts); },
    get easy() { return E; },
    lockEasy(lines) { E.submitted = true; if (lines) E.picks = lines.map((w) => ({ w, y: "" })); renderEasy(); lockEasy(true); $("easyMsg").textContent = "📮 提出しました。みんなを待っています…"; },
    lockWrite(lines) { if (!W) return; W.submitted = true; (lines || []).forEach((l, i) => { if (L[i] && !L[i].value) L[i].value = l; }); setWriteLocked(true); updateMora(); } };

  renderHome();
  // 辞書は最初の操作の前に裏で読みはじめる（重いので少し待ってから）
  setTimeout(() => J.loadDict(), 1200);
})();

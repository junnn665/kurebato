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
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("hidden", s.id !== id));
    current = id;
    window.scrollTo(0, 0);
    if (id === "home") renderHome();
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
  function soloSubmit(result, lines) {
    show("judging");
    setTimeout(() => {
      const rc = applyRank(result.score);
      const entry = { t: Date.now(), lines, score: result.score, verdict: result.verdict, odai: W.odai.id, mode: "solo" };
      const kucho = ls.get("kure.kucho", []); kucho.unshift(entry); ls.set("kure.kucho", kucho.slice(0, 300));
      renderResult($("soloResultBody"), result, { name: "", odai: W.odai });
      $("rankChange").innerHTML = `<div class="rank-change ${rc.kind === "up" ? "up" : rc.kind === "down" ? "down" : ""}">${esc(rc.text)}<span class="big">${rc.kind === "up" || rc.kind === "down" ? `${esc(rc.before)} → ${esc(rc.after)}` : esc(rc.after)}</span></div>`;
      lastShare = { lines, score: result.score, verdict: result.verdict, odai: W.odai };
      show("soloResult");
    }, 1700);
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
        <ul class="pts">${r.pts.map((p) => `<li class="${p.k}"><span class="d">${sign(p.d)}</span><span>${esc(p.t)}</span></li>`).join("")}</ul>
        <div class="advice"><b>添削ポイント</b><br>${r.advice.map(esc).join("<br>")}</div>
        <p class="note">音数：${r.moras.join("・")}（${r.reads.map((x) => esc(x.yomi.replace(/〇/g, "？"))).join(" / ")}）</p>
      </div>`;
  }
  $("againBtn").addEventListener("click", () => { soloOdai = pickOdai(soloSeason, soloOdai && soloOdai.id); renderSoloOdai(); show("soloOdai"); });

  let lastShare = null;
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
    $("kuchoList").innerHTML = n ? list.map((k) => {
      const o = odaiById(k.odai);
      const d = new Date(k.t);
      return `<div class="kitem"><div class="k-text">${k.lines.map(esc).join("　")}</div>
        <div class="k-score">${k.score}<small class="v-${vClass(k.verdict)}">${esc(k.verdict)}</small></div>
        <div class="k-meta">お題「${esc(o.title)}」・${d.getMonth() + 1}/${d.getDate()}${k.mode === "mp" ? "・⚔️対戦" + (k.rank ? ` ${k.rank}位` : "") : ""}</div></div>`;
    }).join("") : `<div class="empty">まだ一句もありません。<br>ひとりで査定 か 対戦で一句詠もう</div>`;
  }
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

  // 他のファイル（net.js）から使う
  window.App = { show, toast, esc, ls, odaiHtml, odaiById, pickOdai, openWrite, renderResult, vClass, addKucho, get current() { return current; }, get write() { return W; }, setWriteMsg(t, info) { $("writeMsg").textContent = t; $("writeMsg").className = "msg" + (info ? " info" : ""); }, stopTimer() { clearInterval(timerId); },
    lockWrite(lines) { if (!W) return; W.submitted = true; (lines || []).forEach((l, i) => { if (L[i] && !L[i].value) L[i].value = l; }); setWriteLocked(true); updateMora(); } };

  renderHome();
  // 辞書は最初の操作の前に裏で読みはじめる（重いので少し待ってから）
  setTimeout(() => J.loadDict(), 1200);
})();

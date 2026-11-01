/* 句レバト — 歳時記の図鑑
 * 査定された句に入っていた季語を集める（ひとり・はじめて・対戦 ぜんぶ）。
 * 表記ゆれ（桜・さくら・サクラ）は kigo-alias.js で一つにまとめる。
 * 保存: localStorage "kure.zukan" = { 代表の表記: { s: 季節, n: 使った回数, t: 初めての時刻, best: 最高点, ku: [その句] } }
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const A = window.App, KG = window.KIGO;
  const esc = A.esc;
  const SEASONS = ["春", "夏", "秋", "冬", "新年"];
  const get = () => A.ls.get("kure.zukan", {});

  // 句から季語を集める。新しく集まった季語を返す
  function collect(lines, score) {
    const z = get();
    const found = KG.find((lines || []).join(""));
    const fresh = [];
    const now = Date.now();
    found.forEach((k) => {
      const w = KG.canon(k.w);
      const e = z[w];
      if (!e) { z[w] = { s: k.season, n: 1, t: now, best: score, ku: lines }; fresh.push(w); }
      else { e.n++; if (score > e.best) { e.best = score; e.ku = lines; } }
    });
    A.ls.set("kure.zukan", z);
    if (fresh.length) A.toast(`📗 歳時記に「${fresh.map(esc).join("」「")}」が加わりました`, 3400);
    return fresh;
  }

  let season = null;
  function open(s) {
    season = s || season || (window.Fuzei ? window.Fuzei.today.season : "春");
    render();
    A.show("saijiki");
  }
  function render() {
    const z = get();
    const total = Object.keys(z).length;
    const all = SEASONS.reduce((a, s) => a + KG.heads(s).length, 0);
    $("sjTotal").innerHTML = `集めた季語 <b>${total}</b> / ${all}`;
    $("sjTabs").innerHTML = SEASONS.map((s) => {
      const have = KG.heads(s).filter((w) => z[w]).length;
      return `<button data-s="${s}" class="${s === season ? "on" : ""}"><span class="sj-s">${s}</span><small>${have}/${KG.heads(s).length}</small></button>`;
    }).join("");
    const heads = KG.heads(season);
    const got = heads.filter((w) => z[w]).sort((a, b) => z[b].n - z[a].n || z[a].t - z[b].t);
    const pct = heads.length ? Math.round((got.length / heads.length) * 100) : 0;
    $("sjBar").innerHTML = `<div class="sj-bar"><i style="width:${pct}%"></i></div><div class="note center">${season}の季語　${got.length} / ${heads.length}（${pct}%）</div>`;
    $("sjList").innerHTML = got.length ? got.map((w) => {
      const e = z[w];
      return `<div class="sj-card"><span class="sj-w">${esc(w)}</span><span class="sj-n">${e.n}回</span><span class="sj-ku">${(e.ku || []).map(esc).join("　")}</span><span class="sj-best">${e.best}点</span></div>`;
    }).join("") : `<div class="empty">${season}の季語には、まだ出会っていません</div>`;
    // まだ出会っていない季語を三つ（ヒント）
    const rest = heads.filter((w) => !z[w]);
    const pick = [];
    for (let i = 0; i < 3 && rest.length; i++) pick.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
    $("sjHint").innerHTML = pick.length ? `<div class="sj-hint-t">まだ出会っていない季語</div><div class="sj-hint">${pick.map((w) => `<span>${esc(w)}</span>`).join("")}</div><p class="note center">これを入れて一句詠むと、歳時記に加わります</p>` : `<div class="sj-hint-t">${season}の季語、ぜんぶ集めました！</div>`;
  }
  $("saijikiBtn").addEventListener("click", () => open());
  $("sjTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { season = b.dataset.s; render(); } });
  $("sjMore").addEventListener("click", render);

  window.Zukan = { collect, open };
})();

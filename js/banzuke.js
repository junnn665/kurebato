/* 句レバト — 番付（ランキング）
 * 才能アリ（70点以上）の句だけが載る。
 * データ: rooms/haiku-ranking/<normal|easy>/<id> : name, lines, score, odai, t, pid
 *   normal = 本場所（一句詠む） / easy = 初心者の部（はじめての一句）
 * 「今場所」は今月の分、「歴代」はぜんぶ。点の高い順、同点は早い者勝ち。
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const A = window.App, N = window.Net, F = window.Fuzei;
  const esc = A.esc;
  const PATH = (div) => `rooms/haiku-ranking/${div}`;
  const LINE = 70;
  const SHOW = 60;
  const kan = F ? F.kan : String;

  // 地位：横綱・大関・関脇・小結・前頭n枚目・十両・幕下
  function rankName(i) {
    if (i === 0) return "横綱";
    if (i === 1) return "大関";
    if (i === 2) return "関脇";
    if (i === 3) return "小結";
    if (i < 20) return `前頭${kan(i - 3)}枚目`;
    if (i < 34) return "十両";
    return "幕下";
  }
  const tcy = (n) => `<span class="tcy">${n}</span>`;

  // ---------- 載せる ----------
  let entry = null, posted = null;
  function offer(e) {
    entry = e; posted = null;
    const box = $("bzEntry");
    box.classList.toggle("hidden", !(e && e.score >= LINE));
    $("bzEntryMsg").textContent = "";
    $("bzSubmit").disabled = false;
    $("bzName").disabled = false;
    $("bzName").value = N.myName() || "";
    box.querySelector(".bz-entry-title").textContent = e && e.div === "easy" ? "才能アリ！ 番付（初心者の部）に名を連ねますか？" : "才能アリ！ 番付に名を連ねますか？";
    if (e && e.score >= LINE) N.ensure();
  }
  $("bzSubmit").addEventListener("click", async () => {
    if (!entry || posted) return;
    const name = $("bzName").value.trim();
    if (!name) { $("bzEntryMsg").textContent = "俳号（なまえ）を入れてね"; return; }
    N.saveName(name);
    $("bzSubmit").disabled = true;
    if (!(await N.ensure())) { $("bzEntryMsg").textContent = N.error("net"); $("bzSubmit").disabled = false; return; }
    const db = N.db;
    const id = db.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const data = { name: name.slice(0, 10), lines: entry.lines.map((l) => String(l).slice(0, 20)), score: entry.score, odai: entry.odai, t: db.now(), pid: N.pid };
    try {
      await db.set(`${PATH(entry.div)}/${id}`, data);
      posted = { id, div: entry.div };
      $("bzName").disabled = true;
      const list = await load(entry.div);
      const pos = month(list).findIndex((x) => x.id === id);
      $("bzEntryMsg").innerHTML = `載りました！ 今場所 <b>${pos >= 0 ? rankName(pos) : "番付外"}</b>（${pos + 1}番目）　<button class="link" id="bzGo">番付を見る</button>`;
      $("bzGo").addEventListener("click", () => openBoard(entry.div, "month"));
    } catch (e) { $("bzEntryMsg").textContent = N.error(e); $("bzSubmit").disabled = false; }
  });

  // ---------- 見る ----------
  async function load(div) {
    const v = (await N.db.get(PATH(div))) || {};
    return Object.entries(v).filter(([, x]) => x && typeof x.score === "number" && x.score >= LINE)
      .map(([id, x]) => ({ id, ...x }))
      .sort((a, b) => b.score - a.score || a.t - b.t);
  }
  function month(list) {
    const now = new Date(N.db ? N.db.now() : Date.now());
    return list.filter((x) => { const d = new Date(x.t); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  }

  let div = "normal", term = "month";
  async function openBoard(d, t) {
    if (d) div = d; if (t) term = t;
    $("bzDiv").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === div));
    $("bzTerm").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === term));
    $("bzBasho").textContent = term === "month" ? (F ? F.basho() : "今場所") : "歴代";
    A.show("banzuke");
    $("bzCols").innerHTML = "";
    $("bzMsg").textContent = "番付を読みこみ中…";
    if (!(await N.ensure())) { $("bzMsg").textContent = N.error("net"); return; }
    try {
      let list = await load(div);
      if (term === "month") list = month(list);
      list = list.slice(0, SHOW);
      $("bzMsg").textContent = list.length ? "" : (div === "easy" ? "まだだれも載っていません。「はじめての一句」で才能アリをとろう" : "まだだれも載っていません。才能アリ（70点以上）で一番乗り！");
      $("bzCols").innerHTML = list.map((x, i) => {
        const o = A.odaiById(x.odai);
        const mine = x.pid === N.pid;
        return `<div class="bz-col${i < 4 ? " sanyaku" : ""}${i === 0 ? " yokozuna" : ""}${mine ? " mine" : ""}">
          <span class="bz-rank">${rankName(i)}</span>
          <span class="bz-name">${esc(x.name)}</span>
          <span class="bz-score">${tcy(x.score)}点</span>
          <span class="bz-ku">${(x.lines || []).map(esc).join("　")}</span>
          <span class="bz-odai">題「${esc(o.title)}」</span>
        </div>`;
      }).join("");
      $("bzCols").scrollLeft = 0;
    } catch (e) { $("bzMsg").textContent = N.error(e); }
  }
  $("banzukeBtn").addEventListener("click", () => openBoard());
  $("bzDiv").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) openBoard(b.dataset.v, null); });
  $("bzTerm").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) openBoard(null, b.dataset.v); });

  window.Banzuke = { offer, open: openBoard };
  if (A.lastEntry) offer(A.lastEntry);
})();

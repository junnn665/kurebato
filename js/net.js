/* 句レバト — みんなで対戦（Firebase Realtime Database）
 *
 * データの置き場所: rooms/haiku-<4ケタ>   （都道府県ゲーム・お題当て と同じデータベースを共用。キーに haiku- を付けて区別）
 *   game: "haiku", created, host
 *   cfg: { rounds, time(秒), vote(1=先生＋みんな / 0=先生だけ), season }
 *   ph:  { s: "lobby" | "write" | "vote" | "reveal", r: ラウンド(0〜), dl: しめきり(サーバー時刻ms) }
 *   odai: [お題id, ...]           ← ラウンドごと
 *   entrants/<pid>: true          ← この対戦に参加している人（途中で入った人は次の対戦から）
 *   players/<pid>: name, joined, online
 *   sub/<r>/<pid>: lines, score, verdict, summary, advice, t   ← 提出した句と先生の査定
 *   votes/<r>/<voter>/<pid>: 点                                 ← みんなの査定
 *   ev/<id>: type:"stamp", from, name, stamp, t
 */
(() => {
  "use strict";
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyARjb_t0hEpQKM_6Wmbzl_H7z-e7rMcKjY",
    authDomain: "odeko-ddb38.firebaseapp.com",
    databaseURL: "https://odeko-ddb38-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "odeko-ddb38",
    storageBucket: "odeko-ddb38.firebasestorage.app",
    messagingSenderId: "310865503380",
    appId: "1:310865503380:web:fb1c2b173cb6fbee70c081",
  };
  const FIREBASE_VER = "10.12.2";
  const KEY = (c) => `rooms/haiku-${c}`;
  const ROOM_TTL = 24 * 60 * 60 * 1000;
  const TEACHER_W = 0.4; // 先生＋みんな のときの先生の重み
  const STAMPS = ["👍", "😂", "😱", "🔥", "👏", "うまい！", "季重なり", "中八！", "才能アリ"];

  const $ = (id) => document.getElementById(id);
  const A = window.App;
  const J = window.Judge;
  const esc = A.esc;

  // ---------- identity ----------
  const PID = (() => {
    let p = A.ls.get("kure.pid", null);
    if (!p) { p = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); A.ls.set("kure.pid", p); }
    return p;
  })();
  const myName = () => A.ls.get("kure.name", "") || "";
  const saveName = (v) => A.ls.set("kure.name", v);
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* */ } },
  };

  // ---------- network ----------
  let NET = null, netPromise = null;
  function loadScript(src) {
    return new Promise((ok, ng) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ng; document.head.appendChild(s); });
  }
  function firebaseNet() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();
    let offset = 0;
    db.ref(".info/serverTimeOffset").on("value", (s) => { offset = s.val() || 0; });
    return {
      on(path, cb) { const r = db.ref(path), h = (s) => cb(s.val()); r.on("value", h); return () => r.off("value", h); },
      get(path) { return db.ref(path).once("value").then((s) => s.val()); },
      set(path, v) { return db.ref(path).set(v); },
      update(path, v) { return db.ref(path).update(v); },
      remove(path) { return db.ref(path).remove(); },
      tx(path, fn) { return db.ref(path).transaction(fn).then((r) => ({ committed: r.committed, val: r.snapshot.val() })); },
      now() { return Date.now() + offset; },
      onDisconnectSet(path, v) { return db.ref(path).onDisconnect().set(v); },
      cancelDisconnect(path) { return db.ref(path).onDisconnect().cancel(); },
      cleanOld(cutoff) {
        return db.ref("rooms").orderByChild("created").endAt(cutoff).limitToFirst(30).once("value").then((snap) => {
          const jobs = [];
          snap.forEach((c) => { const v = c.val(); if (String(c.key).startsWith("haiku-") && v && v.created <= cutoff) jobs.push(c.ref.remove()); });
          return Promise.all(jobs);
        });
      },
    };
  }
  function ensureNet() {
    if (NET) return Promise.resolve(true);
    if (window.NET_OVERRIDE) { NET = window.NET_OVERRIDE; return Promise.resolve(true); }
    if (!netPromise) {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VER}/`;
      const timeout = new Promise((_, ng) => setTimeout(() => ng(new Error("timeout")), 10000));
      netPromise = Promise.race([loadScript(base + "firebase-app-compat.js").then(() => loadScript(base + "firebase-database-compat.js")), timeout])
        .then(() => { NET = firebaseNet(); return true; })
        .catch(() => { netPromise = null; return false; });
    }
    return netPromise;
  }
  function netError(e) {
    console.warn(e);
    const m = String((e && (e.code || e.message)) || e);
    if (/permission/i.test(m)) return "データベースに書きこめませんでした（Firebase のルール設定を確認してね）";
    return "通信できませんでした。電波のよい所でもう一度ためしてね";
  }

  // ---------- state ----------
  let code = null, R = null, unsub = null, tickId = null;
  let joinedAt = 0;
  const seenEv = new Set();
  let openedWrite = -1, builtVote = -1, builtReveal = -1, savedKucho = -1;
  const ph = () => (R && R.ph) || { s: "lobby", r: 0 };
  const cfg = () => (R && R.cfg) || { rounds: 3, time: 180, vote: 1, season: "" };
  const isHost = () => !!R && R.host === PID;
  const players = () => (R && R.players) || {};
  const online = (pid) => { const p = players()[pid]; return !!p && p.online !== false; };
  const entrants = () => Object.keys((R && R.entrants) || {});
  const amEntrant = () => !!(R && R.entrants && R.entrants[PID]);
  const nameOf = (pid) => (players()[pid] && players()[pid].name) || "だれか";
  const subs = (r) => (R && R.sub && R.sub[r]) || {};
  const votes = (r) => (R && R.votes && R.votes[r]) || {};
  const inviteUrl = () => `${location.origin}${location.pathname}?room=${code}`;

  // ---------- 作る・参加 ----------
  const pick = { rounds: 3, time: 180, vote: 1, season: "" };
  const segs = { segRounds: "rounds", segTime: "time", segVote: "vote", segSeason: "season" };
  Object.entries(segs).forEach(([id, key]) => {
    $(id).addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      pick[key] = key === "season" ? b.dataset.v : Number(b.dataset.v);
      $(id).querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    });
  });
  $("mpCreateBtn").addEventListener("click", () => { $("mpNameC").value = myName(); $("mpCreateMsg").textContent = ""; A.show("mpCreate"); ensureNet(); });
  $("mpJoinBtn").addEventListener("click", () => openJoin(""));
  function openJoin(c) { $("mpCode").value = c || ""; $("mpNameJ").value = myName(); $("mpJoinMsg").textContent = ""; A.show("mpJoin"); ensureNet(); }
  $("mpCode").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });

  async function busy(btn, fn) { btn.disabled = true; try { await fn(); } finally { btn.disabled = false; } }

  $("mpCreateGo").addEventListener("click", () => busy($("mpCreateGo"), async () => {
    const name = $("mpNameC").value.trim();
    if (!name) { $("mpCreateMsg").textContent = "なまえを入れてね"; return; }
    saveName(name);
    if (!(await ensureNet())) { $("mpCreateMsg").textContent = netError("net"); return; }
    try {
      NET.cleanOld(NET.now() - ROOM_TTL).catch(() => {});
      let c = null;
      for (let i = 0; i < 12 && !c; i++) {
        const t = String(Math.floor(1000 + Math.random() * 9000));
        const res = await NET.tx(`${KEY(t)}/created`, (cur) => (cur ? undefined : NET.now()));
        if (res.committed) c = t;
      }
      if (!c) throw new Error("no room");
      const now = NET.now();
      await NET.update(KEY(c), {
        game: "haiku", host: PID,
        cfg: { rounds: pick.rounds, time: pick.time, vote: pick.vote, season: pick.season },
        ph: { s: "lobby", r: 0, dl: 0 },
        players: { [PID]: { name, joined: now, online: true } },
      });
      enter(c);
    } catch (e) { $("mpCreateMsg").textContent = netError(e); }
  }));

  $("mpJoinGo").addEventListener("click", () => busy($("mpJoinGo"), async () => {
    const c = $("mpCode").value.trim();
    const name = $("mpNameJ").value.trim();
    if (c.length !== 4) { $("mpJoinMsg").textContent = "部屋番号は4ケタ"; return; }
    if (!name) { $("mpJoinMsg").textContent = "なまえを入れてね"; return; }
    saveName(name);
    if (!(await ensureNet())) { $("mpJoinMsg").textContent = netError("net"); return; }
    try {
      const room = await NET.get(KEY(c));
      if (!room || room.game !== "haiku") { $("mpJoinMsg").textContent = "その部屋は見つかりません"; return; }
      const old = room.players && room.players[PID];
      await NET.update(`${KEY(c)}/players/${PID}`, { name, joined: old ? old.joined : NET.now(), online: true });
      enter(c);
    } catch (e) { $("mpJoinMsg").textContent = netError(e); }
  }));

  function enter(c) {
    code = c;
    ss.set("kure.room", c);
    joinedAt = NET.now();
    openedWrite = builtVote = builtReveal = savedKucho = -1;
    NET.onDisconnectSet(`${KEY(c)}/players/${PID}/online`, false);
    if (unsub) unsub();
    unsub = NET.on(KEY(c), (v) => { R = v; onRoom(); });
    clearInterval(tickId);
    tickId = setInterval(tick, 700);
    $("stampWrap").classList.remove("hidden");
    document.body.classList.add("in-room");
  }

  async function leave() {
    if (!code) { A.show("home"); return; }
    const c = code;
    code = null; R = null;
    if (unsub) unsub(); unsub = null;
    clearInterval(tickId);
    A.stopTimer();
    ss.set("kure.room", null);
    $("stampWrap").classList.add("hidden");
    document.body.classList.remove("in-room");
    $("stampBar").classList.add("hidden");
    try { await NET.cancelDisconnect(`${KEY(c)}/players/${PID}/online`); await NET.remove(`${KEY(c)}/players/${PID}`); } catch { /* */ }
    A.show("home");
  }
  ["mpLeave1", "mpLeave2"].forEach((id) => $(id).addEventListener("click", leave));

  // ---------- 部屋の変化 ----------
  function onRoom() {
    if (!code) return;
    if (!R) { A.toast("部屋がなくなりました"); leave(); return; }
    if (!players()[PID]) {
      // 自分が消えていたら（別タブなど）入りなおす
      NET.update(`${KEY(code)}/players/${PID}`, { name: myName() || "だれか", joined: NET.now(), online: true }).catch(() => {});
      return;
    }
    if (players()[PID].online === false) NET.set(`${KEY(code)}/players/${PID}/online`, true).catch(() => {});
    fixHost();
    showStamps();
    const p = ph();
    if (p.s === "lobby" || !amEntrant()) { renderLobby(); return; }
    if (p.s === "write") renderWrite();
    else if (p.s === "vote") renderVote();
    else if (p.s === "reveal") renderReveal();
  }

  // ホストがいなくなったら、早く入った順で次のホスト
  function fixHost() {
    if (!R || online(R.host)) return;
    const next = Object.entries(players()).filter(([, p]) => p && p.online !== false).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))[0];
    if (next && next[0] === PID) {
      const old = R.host;
      NET.tx(`${KEY(code)}/host`, (cur) => (cur === old ? PID : undefined)).catch(() => {});
    }
  }

  // ---------- 待合室 ----------
  let qrFor = null;
  function renderLobby() {
    if (ph().s === "lobby") { openedWrite = builtVote = builtReveal = savedKucho = -1; revealDone = false; }
    A.stopTimer();
    if (A.current !== "mpLobby") A.show("mpLobby");
    $("lobbyCode").textContent = code;
    if (qrFor !== code) {
      qrFor = code;
      try { const q = qrcode(0, "M"); q.addData(inviteUrl()); q.make(); $("lobbyQr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch { $("lobbyQr").innerHTML = ""; }
    }
    const c = cfg();
    const host = isHost() && ph().s === "lobby";
    const chip = (k, label) => host ? `<button class="ch" data-k="${k}">${label}</button>` : `<span>${label}</span>`;
    $("lobbyRule").innerHTML = [
      chip("rounds", `${c.rounds}ラウンド`),
      chip("time", `1句 ${Math.round(c.time / 60)}分`),
      chip("vote", c.vote ? "先生＋みんなで査定" : "先生だけで査定"),
      chip("season", c.season ? `お題：${c.season}` : "お題：ぜんぶの季節"),
    ].join("") + (host ? `<span class="note" style="background:none">タップで変更</span>` : "");
    const list = Object.entries(players()).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
    $("lobbyPlayers").innerHTML = list.map(([id, p]) => `<li class="${p.online === false ? "off" : ""}">${esc(p.name)}${id === R.host ? '<span class="tag">ホスト</span>' : ""}${id === PID ? '<span class="tag me">あなた</span>' : ""}<span class="st">${p.online === false ? "通信待ち" : R.entrants && R.entrants[id] && ph().s !== "lobby" ? "対戦中" : ""}</span></li>`).join("");
    const n = list.filter(([, p]) => p.online !== false).length;
    $("mpStart").classList.toggle("hidden", !host);
    $("mpStart").textContent = n < 2 ? `スタート（ひとりでもOK）` : `スタート（${n}人）`;
    $("lobbyMsg").textContent = ph().s !== "lobby" ? "いま対戦中です。つぎの対戦から参加できます" : host ? "みんながそろったらスタート" : "ホストのスタートを待っています…";
  }
  const CYCLE = { rounds: [1, 3, 5], time: [120, 180, 300], vote: [1, 0], season: ["", "春", "夏", "秋", "冬"] };
  $("lobbyRule").addEventListener("click", (e) => {
    const b = e.target.closest("button.ch"); if (!b || !isHost()) return;
    const k = b.dataset.k, arr = CYCLE[k];
    const next = arr[(arr.indexOf(cfg()[k]) + 1) % arr.length];
    NET.set(`${KEY(code)}/cfg/${k}`, next).catch((er) => A.toast(netError(er)));
  });
  $("inviteBtn").addEventListener("click", () => {
    const url = inviteUrl();
    const text = `句レバトで俳句対戦しよう！ 部屋番号 ${code}`;
    if (navigator.share) navigator.share({ text, url }).catch(() => {});
    else navigator.clipboard.writeText(`${text}\n${url}`).then(() => A.toast("招待リンクをコピーしました"), () => A.toast(url));
  });

  $("mpStart").addEventListener("click", () => busy($("mpStart"), async () => {
    if (!isHost()) return;
    const c = cfg();
    const ids = [];
    for (let i = 0; i < c.rounds; i++) { let o; let n = 0; do { o = A.pickOdai(c.season); n++; } while (ids.includes(o.id) && n < 30); ids.push(o.id); }
    const ent = {};
    Object.entries(players()).forEach(([id, p]) => { if (p.online !== false) ent[id] = true; });
    const now = NET.now();
    try {
      await NET.update(KEY(code), { odai: ids, entrants: ent, sub: null, votes: null, ph: { s: "write", r: 0, dl: now + c.time * 1000 + 2000 } });
    } catch (e) { A.toast(netError(e)); }
  }));

  // ---------- 句を書く ----------
  function renderWrite() {
    const p = ph();
    const mine = subs(p.r)[PID];
    if (openedWrite !== p.r) {
      openedWrite = p.r;
      const odai = A.odaiById(R.odai[p.r]);
      A.openWrite({
        odai, mode: "mp", deadline: p.dl, now: () => NET.now(),
        title: `第${p.r + 1}句 / 全${cfg().rounds}句`,
        onSubmit: (res, lines, yomi, auto) => submitHaiku(p.r, res, lines, auto),
        onBack: () => { if (confirm("部屋を出ますか？")) leave(); },
      });
      A.toast(`第${p.r + 1}句　お題「${esc(odai.title)}」`);
    }
    if (mine) {
      if (A.write && !A.write.submitted) A.lockWrite(mine.lines);
      A.setWriteMsg("📮 提出しました。みんなを待っています…", true);
    }
    const ent = entrants().filter(online);
    $("mpProgress").innerHTML = ent.map((id) => `<span class="${subs(p.r)[id] ? "done" : ""}">${subs(p.r)[id] ? "✓ " : "✍️ "}${esc(nameOf(id))}</span>`).join("");
  }
  function submitHaiku(r, res, lines, auto) {
    const data = {
      lines, score: res.score, verdict: res.verdict, summary: res.summary,
      advice: res.advice, pts: res.pts.filter((p) => p.d !== 0).map((p) => [p.d, p.t]).slice(0, 8),
      moras: res.moras, empty: lines.every((l) => !l), t: NET.now(),
    };
    NET.set(`${KEY(code)}/sub/${r}/${PID}`, data).then(() => {
      A.setWriteMsg(auto ? "⏰ 時間切れ。書いたところまで提出しました" : "📮 提出しました。みんなを待っています…", true);
    }).catch((e) => A.toast(netError(e)));
  }

  // ---------- みんなで査定 ----------
  let voteDraft = {};
  let voteTimer = null;
  const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  function renderVote() {
    const p = ph();
    if (A.current !== "mpVote") A.show("mpVote");
    const all = Object.entries(subs(p.r)).filter(([, s]) => !s.empty);
    if (builtVote !== p.r) {
      builtVote = p.r;
      voteDraft = {};
      $("voteOdai").innerHTML = A.odaiHtml(A.odaiById(R.odai[p.r]), true);
      const order = all.sort((a, b) => hash(a[0] + code + p.r) - hash(b[0] + code + p.r));
      $("voteList").innerHTML = order.map(([id, s]) => {
        const mine = id === PID;
        if (!mine) voteDraft[id] = 60;
        return `<div class="vcard${mine ? " mine" : ""}" data-id="${id}">
          <div class="v-text">${s.lines.map((l) => `<span>${esc(l)}</span>`).join("")}</div>
          ${mine ? '<p class="note center">あなたの句（自分には付けられません）</p>' : `
          <div class="vrow"><input type="range" min="0" max="100" step="1" value="60"><div class="vval"></div></div>
          <div class="vquick"><button data-v="35">才能ナシ</button><button data-v="60">凡人</button><button data-v="80">才能アリ</button></div>`}
        </div>`;
      }).join("") || `<p class="note center">査定できる句がありません</p>`;
      $("voteList").querySelectorAll(".vcard:not(.mine)").forEach(setVoteCard);
      $("voteSubmit").disabled = false;
      $("voteMsg").textContent = "";
      clearInterval(voteTimer);
      voteTimer = setInterval(tickVote, 250);
    }
    const voted = !!votes(p.r)[PID];
    $("voteSubmit").classList.toggle("hidden", voted);
    $("voteList").querySelectorAll("input,button").forEach((x) => (x.disabled = voted));
    if (voted) {
      const need = entrants().filter((id) => online(id) && subs(p.r)[id]);
      const done = need.filter((id) => votes(p.r)[id]).length;
      $("voteMsg").textContent = `査定を送りました。みんなを待っています（${done}/${need.length}）`;
    }
  }
  function setVoteCard(card) {
    const id = card.dataset.id;
    const range = card.querySelector("input");
    const out = card.querySelector(".vval");
    const draw = () => {
      const v = Number(range.value);
      voteDraft[id] = v;
      const vd = J.verdictOf(v);
      out.innerHTML = `${v}点<small class="v-${A.vClass(vd)}">${vd}</small>`;
      card.querySelectorAll(".vquick button").forEach((b) => b.classList.toggle("on", J.verdictOf(Number(b.dataset.v)) === vd));
    };
    range.addEventListener("input", draw);
    card.querySelectorAll(".vquick button").forEach((b) => b.addEventListener("click", () => { range.value = b.dataset.v; draw(); }));
    draw();
  }
  function tickVote() {
    const p = ph();
    if (!R || p.s !== "vote") { clearInterval(voteTimer); return; }
    const left = Math.max(0, p.dl - NET.now());
    const s = Math.ceil(left / 1000);
    $("voteTimer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("voteTimer").classList.toggle("hurry", s <= 10);
    if (left < 800 && !votes(p.r)[PID] && subs(p.r)[PID]) sendVote();
  }
  let sendingVote = false;
  function sendVote() {
    if (sendingVote || !R) return;
    sendingVote = true;
    const r = ph().r;
    const data = { ...voteDraft, _: 1 };
    NET.set(`${KEY(code)}/votes/${r}/${PID}`, data).catch((e) => A.toast(netError(e))).finally(() => { sendingVote = false; });
  }
  $("voteSubmit").addEventListener("click", sendVote);

  // ---------- 点数の計算 ----------
  function roundScores(r) {
    const s = subs(r), v = votes(r);
    const out = Object.keys((R && R.entrants) || {}).filter((id) => s[id] || online(id)).map((id) => {
      const sub = s[id];
      if (!sub || sub.empty) return { id, name: nameOf(id), sub, score: 0, verdict: "未提出", teacher: 0, crowd: null, n: 0 };
      const got = Object.entries(v).filter(([voter, m]) => voter !== id && m && typeof m[id] === "number").map(([, m]) => m[id]);
      const crowd = got.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
      const score = cfg().vote && crowd != null ? Math.round(sub.score * TEACHER_W + crowd * (1 - TEACHER_W)) : sub.score;
      return { id, name: nameOf(id), sub, score, verdict: J.verdictOf(score), teacher: sub.score, crowd: crowd == null ? null : Math.round(crowd), n: got.length };
    });
    out.sort((a, b) => b.score - a.score || (a.sub ? a.sub.t : 9e15) - (b.sub ? b.sub.t : 9e15));
    let rank = 0, prev = null;
    out.forEach((x, i) => { if (x.score !== prev) rank = i + 1; x.rank = rank; prev = x.score; });
    return out;
  }
  function totals(upto) {
    const t = {};
    for (let r = 0; r <= upto; r++) roundScores(r).forEach((x) => { t[x.id] = t[x.id] || { id: x.id, name: x.name, sum: 0, ari: 0 }; t[x.id].sum += x.score; if (x.verdict === "才能アリ") t[x.id].ari++; });
    return Object.values(t).sort((a, b) => b.sum - a.sum);
  }

  // ---------- 結果発表 ----------
  let revealTimers = [];
  let revealDone = false;
  function renderReveal() {
    const p = ph();
    if (A.current !== "mpReveal") A.show("mpReveal");
    const last = p.r >= cfg().rounds - 1;
    if (builtReveal !== p.r) {
      builtReveal = p.r;
      revealDone = false;
      revealTimers.forEach(clearTimeout); revealTimers = [];
      $("revealTitle").textContent = `第${p.r + 1}句 結果発表`;
      $("revealOdai").innerHTML = A.odaiHtml(A.odaiById(R.odai[p.r]), true);
      $("revealList").innerHTML = "";
      $("revealTotals").innerHTML = "";
      $("mpNext").classList.add("hidden");
      $("finalBtns").classList.add("hidden");
      $("revealMsg").textContent = "";
      const list = roundScores(p.r);
      saveToKucho(p.r, list);
      // 最下位から発表。1位の前にドラムロール
      const order = [...list].reverse();
      let t = 400;
      order.forEach((x, i) => {
        const isTop = i === order.length - 1;
        if (isTop && order.length > 1) {
          revealTimers.push(setTimeout(() => { $("revealList").insertAdjacentHTML("afterbegin", `<div class="drumroll" id="drumroll"><svg class="enso" viewBox="0 0 120 120"><path d="M60 12a48 48 0 1 1-34 14" /></svg>第一位は……</div>`); }, t));
          t += 1800;
        }
        revealTimers.push(setTimeout(() => {
          const d = $("drumroll"); if (d) d.remove();
          $("revealList").insertAdjacentHTML("afterbegin", rcardHtml(x));
        }, t));
        t += isTop ? 600 : 1100;
      });
      revealTimers.push(setTimeout(() => {
        const tot = totals(p.r);
        if (cfg().rounds > 1 || last) {
          const top = tot[0];
          $("revealTotals").innerHTML = `<div class="totals">${last && top ? `<div class="champion"><span class="crown">🏆</span>優勝　${esc(top.name)}</div>` : ""}
            <h3>${last ? "最終結果" : `合計（${p.r + 1}/${cfg().rounds}句）`}</h3>
            <table>${tot.map((x, i) => `<tr class="${i === 0 ? "win" : ""}"><td class="kn">${kansuji(i + 1)}位</td><td>${esc(x.name)}${x.id === PID ? "（あなた）" : ""}</td><td class="n">${x.sum}点</td><td class="n">才能アリ×${x.ari}</td></tr>`).join("")}</table></div>`;
        }
        revealDone = true;
        afterReveal();
      }, t + 200));
    } else if (revealDone) afterReveal();
  }
  function afterReveal() {
    const p = ph();
    const last = p.r >= cfg().rounds - 1;
    if (isHost()) {
      $("mpNext").classList.remove("hidden");
      $("mpNext").textContent = last ? "待合室にもどる（もう一回）" : "つぎのお題へ";
      $("revealMsg").textContent = "";
    } else {
      $("mpNext").classList.add("hidden");
      $("revealMsg").textContent = last ? "ホストが待合室にもどすのを待っています" : "ホストが次のお題に進むのを待っています";
    }
    $("finalBtns").classList.toggle("hidden", !last);
  }
  const kansuji = (n) => (["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n] || String(n));
  function rcardHtml(x) {
    const vc = A.vClass(x.verdict);
    const s = x.sub;
    return `<div class="rcard ${vc === "ari" ? "ari" : ""} ${x.rank === 1 ? "first" : ""}">
      <div class="rhead"><div class="rrank">${kansuji(x.rank)}<small>位</small></div><div class="rname">${esc(x.name)}${x.id === PID ? "（あなた）" : ""}</div><span class="rv ${vc}">${esc(x.verdict)}</span><div class="rscore">${x.score}</div></div>
      ${s && !s.empty ? `<div class="rtext">${s.lines.map((l) => `<span>${esc(l)}</span>`).join("")}</div>
      <div class="rbreak">先生 ${x.teacher}点${cfg().vote ? `　みんな ${x.crowd == null ? "—" : x.crowd + "点"}（${x.n}人）` : ""}</div>
      <div class="rcomment">🖌️ 先生（${x.teacher}点）：${esc(s.summary)}</div>
      <details><summary>先生の査定をくわしく</summary><ul class="pts">${(s.pts || []).map(([d, t]) => `<li class="${d > 0 ? "good" : "bad"}"><span class="d">${d > 0 ? "+" + d : d}</span><span>${esc(t)}</span></li>`).join("")}</ul>
      <div class="advice"><b>添削ポイント</b><br>${(s.advice || []).map(esc).join("<br>")}</div></details>` : `<div class="rbreak">未提出……</div>`}
    </div>`;
  }
  function saveToKucho(r, list) {
    if (savedKucho === r) return;
    savedKucho = r;
    const me = list.find((x) => x.id === PID);
    if (me && me.sub && !me.sub.empty) A.addKucho({ t: Date.now(), lines: me.sub.lines, score: me.score, verdict: me.verdict, odai: R.odai[r], mode: "mp", rank: me.rank });
  }
  $("mpNext").addEventListener("click", () => busy($("mpNext"), async () => {
    if (!isHost()) return;
    const p = ph();
    const last = p.r >= cfg().rounds - 1;
    try {
      if (last) {
        await NET.update(KEY(code), { ph: { s: "lobby", r: 0, dl: 0 }, entrants: null, sub: null, votes: null });
      } else {
        const ent = { ...(R.entrants || {}) };
        await NET.update(KEY(code), { entrants: ent, ph: { s: "write", r: p.r + 1, dl: NET.now() + cfg().time * 1000 + 2000 } });
      }
    } catch (e) { A.toast(netError(e)); }
  }));

  // ---------- 進行（だれのスマホからでも進められる） ----------
  function tick() {
    if (!R || !code) return;
    const p = ph();
    const now = NET.now();
    if (p.s === "write") {
      const ent = entrants().filter(online);
      const allIn = ent.length > 0 && ent.every((id) => subs(p.r)[id]);
      if (allIn || now > p.dl + 2500) {
        const real = Object.values(subs(p.r)).filter((s) => !s.empty).length;
        const goVote = cfg().vote && real >= 2;
        const dl = now + Math.min(120, 25 + 15 * real) * 1000;
        advance(p, goVote ? { s: "vote", r: p.r, dl } : { s: "reveal", r: p.r, dl: 0 });
      }
    } else if (p.s === "vote") {
      const need = entrants().filter((id) => online(id) && subs(p.r)[id] && !subs(p.r)[id].empty);
      const allIn = need.every((id) => votes(p.r)[id]);
      if (allIn || now > p.dl + 2500) advance(p, { s: "reveal", r: p.r, dl: 0 });
    }
  }
  let advancing = false;
  function advance(from, to) {
    if (advancing) return;
    advancing = true;
    NET.tx(`${KEY(code)}/ph`, (cur) => (cur && cur.s === from.s && cur.r === from.r ? to : undefined))
      .catch(() => {}).finally(() => { advancing = false; });
  }

  // ---------- スタンプ ----------
  $("stampBar").innerHTML = STAMPS.map((s) => `<button>${s}</button>`).join("");
  $("stampBtn").addEventListener("click", () => $("stampBar").classList.toggle("hidden"));
  $("stampBar").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !code) return;
    const id = NET.now().toString(36) + Math.random().toString(36).slice(2, 5);
    NET.set(`${KEY(code)}/ev/${id}`, { type: "stamp", from: PID, name: myName() || "だれか", stamp: b.textContent.slice(0, 8), t: NET.now() }).catch(() => {});
    $("stampBar").classList.add("hidden");
  });
  function showStamps() {
    const ev = (R && R.ev) || {};
    Object.entries(ev).forEach(([id, e]) => {
      if (seenEv.has(id)) return;
      seenEv.add(id);
      if (!e || e.type !== "stamp" || e.t < joinedAt - 1000 || NET.now() - e.t > 15000) return;
      A.toast(`${esc(e.name)}${e.from === PID ? "（あなた）" : ""}<span class="st">${esc(e.stamp)}</span>`);
    });
    // 古いスタンプはホストがおそうじ
    if (isHost()) {
      const old = Object.entries(ev).filter(([, e]) => !e || NET.now() - e.t > 60000).map(([id]) => id);
      if (old.length) { const u = {}; old.forEach((id) => (u[id] = null)); NET.update(`${KEY(code)}/ev`, u).catch(() => {}); }
    }
  }

  // ---------- 招待リンク・再読みこみ ----------
  const q = new URLSearchParams(location.search).get("room");
  const saved = ss.get("kure.room");
  if (q && /^\d{4}$/.test(q)) {
    history.replaceState(null, "", location.pathname);
    if (saved === q && myName()) rejoin(q); else openJoin(q);
  } else if (saved && myName()) rejoin(saved);
  async function rejoin(c) {
    if (!(await ensureNet())) return;
    try {
      const room = await NET.get(KEY(c));
      if (!room || room.game !== "haiku") { ss.set("kure.room", null); return; }
      const old = room.players && room.players[PID];
      await NET.update(`${KEY(c)}/players/${PID}`, { name: myName(), joined: old ? old.joined : NET.now(), online: true });
      enter(c);
    } catch { /* */ }
  }
})();

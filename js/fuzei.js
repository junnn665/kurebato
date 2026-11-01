/* 句レバト — 風情（季節のうつろい）
 *  ・今日の和風月名と二十四節気
 *  ・季節ごとに舞うもの（春：桜の花びら／夏：蛍／秋：紅葉／冬：雪）
 *  ・画面の下に水墨の山並み
 */
(() => {
  "use strict";
  const GETSUMEI = ["睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"];
  // [月, 日, 名前]（年によって1日ほどずれるが、ここでは目安）
  const SEKKI = [
    [1, 5, "小寒"], [1, 20, "大寒"], [2, 4, "立春"], [2, 19, "雨水"], [3, 5, "啓蟄"], [3, 20, "春分"],
    [4, 4, "清明"], [4, 20, "穀雨"], [5, 5, "立夏"], [5, 21, "小満"], [6, 5, "芒種"], [6, 21, "夏至"],
    [7, 7, "小暑"], [7, 22, "大暑"], [8, 7, "立秋"], [8, 23, "処暑"], [9, 7, "白露"], [9, 23, "秋分"],
    [10, 8, "寒露"], [10, 23, "霜降"], [11, 7, "立冬"], [11, 22, "小雪"], [12, 7, "大雪"], [12, 21, "冬至"],
  ];
  function sekki(d) {
    const m = d.getMonth() + 1, day = d.getDate();
    let cur = SEKKI[SEKKI.length - 1][2];
    for (const [sm, sd, name] of SEKKI) if (m > sm || (m === sm && day >= sd)) cur = name;
    return cur;
  }
  // 俳句の季節は暦（立春・立夏・立秋・立冬）で分ける
  function seasonOf(d) {
    const i = ["立春", "雨水", "啓蟄", "春分", "清明", "穀雨"].includes(sekki(d)) ? "春"
      : ["立夏", "小満", "芒種", "夏至", "小暑", "大暑"].includes(sekki(d)) ? "夏"
      : ["立秋", "処暑", "白露", "秋分", "寒露", "霜降"].includes(sekki(d)) ? "秋" : "冬";
    return i;
  }
  const now = new Date();
  const TODAY = { getsumei: GETSUMEI[now.getMonth()], sekki: sekki(now), season: seasonOf(now) };
  const REIWA = now.getFullYear() - 2018;
  const KANSUJI = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const kan = (n) => (n <= 10 ? KANSUJI[n] : n < 20 ? "十" + (n % 10 ? KANSUJI[n % 10] : "") : KANSUJI[Math.floor(n / 10)] + "十" + (n % 10 ? KANSUJI[n % 10] : ""));

  // ---------- 水墨の山並み ----------
  const sansui = document.createElement("div");
  sansui.className = "sansui";
  sansui.innerHTML = `<svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="sm1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1714" stop-opacity=".55"/><stop offset="1" stop-color="#1c1714" stop-opacity="0"/></linearGradient>
      <linearGradient id="sm2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1714" stop-opacity=".35"/><stop offset=".9" stop-color="#1c1714" stop-opacity="0"/></linearGradient>
      <filter id="smb"><feGaussianBlur stdDeviation="1.4"/></filter>
    </defs>
    <circle class="tsuki" cx="318" cy="38" r="17"/>
    <path filter="url(#smb)" fill="url(#sm2)" d="M0 120 L30 92 L52 104 L88 62 L112 84 L140 70 L176 98 L210 76 L236 90 L268 54 L300 82 L330 72 L360 96 L400 80 L400 160 L0 160Z"/>
    <path filter="url(#smb)" fill="url(#sm1)" d="M0 140 L40 112 L70 128 L104 96 L132 120 L160 110 L196 132 L232 104 L262 124 L296 100 L330 128 L366 112 L400 130 L400 160 L0 160Z"/>
  </svg>`;
  document.body.appendChild(sansui);

  // ---------- 舞うもの ----------
  const cv = document.createElement("canvas");
  cv.className = "fuzei";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let season = TODAY.season, parts = [], W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const R = (a, b) => a + Math.random() * (b - a);
  function spawn(init) {
    const p = { x: R(0, W), y: init ? R(0, H) : R(-40, -10), r: 0, vr: R(-0.03, 0.03), t: R(0, 6.28) };
    if (season === "春") Object.assign(p, { s: R(5, 9), vy: R(0.35, 0.8), vx: R(-0.2, 0.5), c: ["#f6c1cc", "#f3aebe", "#fbd5dd"][Math.floor(R(0, 3))] });
    if (season === "夏") Object.assign(p, { y: init ? R(H * 0.3, H) : R(H * 0.5, H), s: R(1.8, 3), vy: R(-0.2, 0.1), vx: R(-0.25, 0.25), c: "#d8ef6a", life: R(0, 6.28) });
    if (season === "秋") Object.assign(p, { s: R(7, 12), vy: R(0.4, 0.9), vx: R(-0.3, 0.3), c: ["#c0392b", "#d35400", "#b9770e", "#a93226"][Math.floor(R(0, 4))] });
    if (season === "冬") Object.assign(p, { s: R(1.5, 3.4), vy: R(0.3, 0.8), vx: R(-0.2, 0.2), c: "#ffffff" });
    return p;
  }
  function count() { return season === "夏" ? 14 : season === "冬" ? 34 : 13; }
  function reset() { parts = Array.from({ length: count() }, () => spawn(true)); }
  function momiji(s) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.62;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.lineTo(Math.cos(a + 0.31) * s * 0.45, Math.sin(a + 0.31) * s * 0.45);
    }
    ctx.lineTo(0, s * 0.35); ctx.closePath(); ctx.fill();
    ctx.fillRect(-0.6, s * 0.2, 1.2, s * 0.55);
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.t += 0.02; p.r += p.vr;
      p.x += p.vx + Math.sin(p.t) * (season === "夏" ? 0.3 : 0.45);
      p.y += p.vy;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (season === "春") {
        ctx.fillStyle = p.c; ctx.globalAlpha = 0.85;
        ctx.scale(1, 0.55 + 0.4 * Math.abs(Math.sin(p.t)));
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#efe6d2"; ctx.beginPath(); ctx.arc(p.s * 0.95, 0, p.s * 0.22, 0, Math.PI * 2); ctx.fill();
      } else if (season === "夏") {
        p.life += 0.03;
        const a = 0.25 + 0.75 * Math.max(0, Math.sin(p.life));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.s * 5);
        g.addColorStop(0, `rgba(216,239,106,${0.55 * a})`); g.addColorStop(1, "rgba(216,239,106,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.s * 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(150,170,40,${a})`; ctx.beginPath(); ctx.arc(0, 0, p.s * 0.8, 0, Math.PI * 2); ctx.fill();
      } else if (season === "秋") {
        ctx.fillStyle = p.c; ctx.globalAlpha = 0.85;
        ctx.scale(0.55 + 0.45 * Math.abs(Math.cos(p.t)), 1);
        momiji(p.s);
      } else {
        ctx.fillStyle = p.c; ctx.shadowColor = "rgba(90,110,140,.55)"; ctx.shadowBlur = 3;
        ctx.beginPath(); ctx.arc(0, 0, p.s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (p.y > H + 30 || p.x < -40 || p.x > W + 40 || (season === "夏" && p.y < H * 0.15)) Object.assign(p, spawn(false), season === "夏" ? { y: R(H * 0.6, H) } : {});
    }
    if (!document.hidden) requestAnimationFrame(draw);
  }
  function setSeason(s) {
    if (s === "梅雨") s = "夏";
    if (s === "新年") s = "冬";
    if (!s || s === "四季") s = TODAY.season;
    document.documentElement.dataset.season = s;
    if (s === season && parts.length) return;
    season = s;
    reset();
  }
  if (!reduce) {
    resize(); addEventListener("resize", resize);
    setSeason(TODAY.season); reset();
    requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) requestAnimationFrame(draw); });
  } else {
    cv.remove();
    document.documentElement.dataset.season = TODAY.season;
  }

  window.Fuzei = {
    today: TODAY, kan, setSeason: reduce ? (s) => { document.documentElement.dataset.season = s === "四季" || !s ? TODAY.season : s; } : setSeason,
    basho: () => `令和${kan(REIWA)}年 ${TODAY.getsumei}場所`,
  };
})();

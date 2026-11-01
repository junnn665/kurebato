/* 句レバト — 色紙で書き出し
 * 句を筆文字の色紙（1080×1200 の PNG）にして、保存・シェアできるようにする。
 * Shikishi.open({ lines, name, score, verdict, odai })
 */
(() => {
  "use strict";
  const W = 1080, H = 1200;
  const FUDE = '"Yuji Syuku", "Shippori Mincho B1", serif';
  const MINCHO = '"Shippori Mincho B1", serif';
  const SMALL = "ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ";
  const ROTATE = "ー〜～…‥―－-()（）「」『』";
  const PUNCT = "、。，．";

  // 縦書きで1文字ずつ描く
  function vtext(ctx, str, x, y, size, step) {
    for (const c of str) {
      ctx.save();
      if (PUNCT.includes(c)) ctx.translate(x + size * 0.55, y - size * 0.55);
      else if (SMALL.includes(c)) ctx.translate(x + size * 0.12, y - size * 0.12);
      else ctx.translate(x, y);
      if (ROTATE.includes(c)) ctx.rotate(Math.PI / 2);
      ctx.fillText(c, 0, 0);
      ctx.restore();
      y += size * step;
    }
    return y;
  }
  // 和紙の地と金箔
  function paper(ctx, seed) {
    let s = seed || 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = "#fbf5e6"; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) { // 繊維
      ctx.strokeStyle = `rgba(150,120,80,${0.03 + rnd() * 0.05})`;
      ctx.lineWidth = 0.6 + rnd();
      const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, l = 8 + rnd() * 30;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    for (let i = 0; i < 160; i++) { // 金箔（砂子・切箔）
      const x = rnd() * W, y = rnd() < 0.6 ? rnd() * H * 0.28 : H - rnd() * H * 0.22;
      const g = ctx.createLinearGradient(x, y, x + 10, y + 10);
      g.addColorStop(0, "rgba(214,178,94,.85)"); g.addColorStop(1, "rgba(170,130,50,.75)");
      ctx.fillStyle = g;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * Math.PI);
      const r = rnd();
      if (r < 0.75) { ctx.beginPath(); ctx.arc(0, 0, 1 + rnd() * 2.6, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-6, -4, 6 + rnd() * 14, 4 + rnd() * 8);
      ctx.restore();
    }
    // 金の縁
    const b = 30;
    const gg = ctx.createLinearGradient(0, 0, W, H);
    gg.addColorStop(0, "#d9b867"); gg.addColorStop(0.5, "#b88e36"); gg.addColorStop(1, "#d6b25e");
    ctx.strokeStyle = gg; ctx.lineWidth = b; ctx.strokeRect(b / 2, b / 2, W - b, H - b);
    ctx.strokeStyle = "rgba(120,90,30,.5)"; ctx.lineWidth = 2; ctx.strokeRect(b + 10, b + 10, W - (b + 10) * 2, H - (b + 10) * 2);
  }
  function seal(ctx, x, y, size, text, rot, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || -0.06);
    ctx.fillStyle = color || "#c0392b";
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.08); else ctx.rect(-size / 2, -size / 2, size, size); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = size * 0.04;
    ctx.strokeRect(-size / 2 + size * 0.1, -size / 2 + size * 0.1, size * 0.8, size * 0.8);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const chars = [...text];
    if (chars.length <= 1) { ctx.font = `${size * 0.55}px ${FUDE}`; ctx.fillText(chars[0] || "句", 0, size * 0.02); }
    else { // 2〜4文字：右上から縦に2列
      const fs = size * 0.33; ctx.font = `${fs}px ${FUDE}`;
      const cols = chars.length <= 2 ? [chars] : [chars.slice(0, 2), chars.slice(2, 4)];
      cols.forEach((col, ci) => col.forEach((c, ri) => ctx.fillText(c, (cols.length === 1 ? 0 : (ci === 0 ? 1 : -1) * fs * 0.6), (ri - (col.length - 1) / 2) * fs * 1.05)));
    }
    ctx.restore();
  }

  async function draw(d) {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const text = (d.lines || []).join("") + (d.name || "") + "句レバト才能アリ凡人ナシ点題";
    try { await Promise.all([document.fonts.load(`100px ${FUDE}`, text), document.fonts.load(`30px ${MINCHO}`, text)]); } catch { /* 読めなければ代わりの書体 */ }
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    paper(ctx, (h % 100000) + 11);

    ctx.fillStyle = "#1c1714"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // 句：散らし書き（右の列から、少しずつ下げる）
    const lines = (d.lines || []).filter(Boolean);
    const longest = Math.max(...lines.map((l) => [...l].length), 5);
    const size = Math.min(112, Math.floor(760 / (longest * 1.06)));
    const colGap = size * 1.65;
    const x0 = W / 2 + colGap * 1.15;
    lines.forEach((l, i) => {
      ctx.font = `${size}px ${FUDE}`;
      ctx.shadowColor = "rgba(28,23,20,.25)"; ctx.shadowBlur = 1.2;
      vtext(ctx, l, x0 - colGap * i, 170 + size * 0.5 + i * size * 0.75, size, 1.06);
    });
    ctx.shadowBlur = 0;
    // 俳号と落款
    const name = d.name || "詠み人知らず";
    const nx = x0 - colGap * lines.length - size * 0.35;
    const ns = 46;
    ctx.font = `${ns}px ${FUDE}`;
    const nEnd = H - 250;
    const nStart = nEnd - [...name].length * ns * 1.05;
    vtext(ctx, name, nx, nStart, ns, 1.05);
    seal(ctx, nx, nEnd + 34, 62, [...name][0] || "句", -0.05);
    // お題（右上に小さく）
    if (d.odai) {
      ctx.font = `28px ${MINCHO}`; ctx.fillStyle = "rgba(28,23,20,.6)";
      vtext(ctx, `題「${d.odai}」`, W - 100, 120, 28, 1.1);
    }
    // 査定の朱印（左下）
    if (d.score != null) {
      seal(ctx, W - 160, H - 170, 120, d.verdict === "才能アリ" ? "才能有" : d.verdict === "凡人" ? "凡人" : d.verdict === "才能ナシ" ? "才能無" : "査定", 0.08, d.verdict === "凡人" ? "#1f3a63" : d.verdict === "才能ナシ" ? "#6f6a63" : "#c0392b");
      ctx.fillStyle = "#c0392b"; ctx.font = `bold 34px ${MINCHO}`; ctx.textAlign = "center";
      ctx.fillText(`${d.score}点`, W - 160, H - 88);
    }
    // 落款のかわりに小さくサイト名
    ctx.fillStyle = "rgba(28,23,20,.45)"; ctx.font = `22px ${MINCHO}`; ctx.textAlign = "center";
    ctx.fillText("句レバト", W / 2, H - 62);
    return cv;
  }

  // ---------- 見せる・保存・シェア ----------
  let modal = null, lastBlob = null, lastName = "";
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "shikishi-modal hidden";
    modal.innerHTML = `<div class="sk-inner">
      <div class="sk-img"><div class="sk-wait">墨をすっています…</div></div>
      <div class="sk-btns"><button class="btn primary" data-a="share">📤 シェア</button><button class="btn" data-a="save">💾 保存</button></div>
      <button class="btn sk-close" data-a="close">閉じる</button>
      <p class="note center">長押しで写真に保存もできます</p>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", async (e) => {
      const a = e.target.closest("[data-a]");
      if (!a) { if (e.target === modal) close(); return; }
      if (a.dataset.a === "close") close();
      if (a.dataset.a === "save") save();
      if (a.dataset.a === "share") share();
    });
    return modal;
  }
  function close() { modal.classList.add("hidden"); }
  function save() {
    if (!lastBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(lastBlob); a.download = lastName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function share() {
    if (!lastBlob) return;
    const file = new File([lastBlob], lastName, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: "#句レバト" }); } catch { /* やめた */ }
    } else save();
  }
  async function open(d) {
    ensureModal();
    modal.classList.remove("hidden");
    modal.querySelector(".sk-img").innerHTML = `<div class="sk-wait">墨をすっています…</div>`;
    const cv = await draw(d);
    lastBlob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
    lastName = `kurebato_${Date.now()}.png`;
    const img = new Image();
    img.src = URL.createObjectURL(lastBlob);
    img.alt = (d.lines || []).join(" ");
    modal.querySelector(".sk-img").innerHTML = "";
    modal.querySelector(".sk-img").appendChild(img);
  }

  window.Shikishi = { open, draw };
})();

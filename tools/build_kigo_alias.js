// 季語の表記ゆれ（桜・さくら・サクラ など）を、よみが同じものどうしでまとめる。
// 使い方: npm i kuromoji && node tools/build_kigo_alias.js > js/kigo-alias.js
const path = require("path");
const kuromoji = require("kuromoji");
global.window = {};
require(path.join(__dirname, "../js/kigo.js"));
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
kuromoji.builder({ dicPath: path.join(path.dirname(require.resolve("kuromoji")), "../dict") }).build((err, tk) => {
  if (err) throw err;
  const all = window.KIGO.all();
  const alias = {};
  const groups = {};
  for (const k of all) {
    const y = toHira(tk.tokenize(k.w).map((t) => (t.reading && t.reading !== "*" ? t.reading : t.surface_form)).join(""));
    const key = k.season + ":" + y;
    (groups[key] = groups[key] || []).push(k.w);
  }
  for (const ws of Object.values(groups)) {
    if (ws.length < 2) continue;
    const head = ws.find((w) => /[㐀-鿿]/.test(w)) || ws[0];
    for (const w of ws) if (w !== head) alias[w] = head;
  }
  console.log("/* 自動生成: tools/build_kigo_alias.js — 表記ゆれ → 代表の表記 */");
  console.log("window.KIGO_ALIAS = " + JSON.stringify(alias) + ";");
});

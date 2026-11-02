// 先生の物差しあわせ：名句・よい句・ふつうの句・よくない句を査定して、点のならびを確かめる。
// 使い方: npm i kuromoji && node tools/calibrate.js
//   目安：名句の大半が才能アリ（70〜）で中央値80前後／よい句 70〜80台／ふつう 50〜60台／よくない句 50未満
const path = require("path");
const kuromoji = require("kuromoji");
const ROOT = path.join(__dirname, "..");
global.window = { App: { esc: (s) => s } };
global.document = { getElementById: () => null };
for (const f of ["kigo-alias", "kigo", "kotoba", "odai", "judge"]) require(path.join(ROOT, "js", f + ".js"));
// meiku.js は画面の部品に触るので、句の一覧だけ取り出す
const src = require("fs").readFileSync(path.join(ROOT, "js/meiku.js"), "utf8");
const MEIKU = eval(src.slice(src.indexOf("const MEIKU = [") + 14, src.indexOf("];", src.indexOf("const MEIKU = [")) + 1));

const SETS = {
  名句: MEIKU.map((m) => [m[0], m[1], m[2]]),
  よい句: [
    ["夕立や", "軒に並んだ", "赤い傘"], ["新米を", "研ぐ母の手の", "赤さかな"], ["木枯しや", "父の眼鏡の", "銀の匙"],
    ["鰯雲", "錆びた自転車", "坂の上"], ["冬の月", "改札口の", "白い息"], ["風鈴や", "祖母の手紙の", "青インク"],
    ["春の土", "小さき靴の", "跡ふたつ"], ["蝉時雨", "黒板の字の", "消し残し"],
  ],
  // 受賞作の選評で評価される持ち味（おかしみ・自嘲・スケールの対比・日常の小さな動作）をまねた句。
  // 実際の受賞作は著作物なので載せず、持ち味だけをまねて作った句（1句目はユーザーの例）
  受賞作風: [
    ["いい数字", "出るまで測る", "血圧計"], ["体重計", "乗る前に脱ぐ", "腕時計"], ["ダイエット", "明日からにする", "おでん鍋"],
    ["宇宙から", "見れば一点", "大掃除"], ["父の日の", "ネクタイ二本目", "同じ柄"], ["目覚ましを", "止めた記憶の", "ない朝だ"],
    ["席替えの", "窓際にいる", "春の雲"], ["一億年", "前の光を", "浴びて寝る"],
  ],
  ふつう: [
    ["冬の朝", "白い息吐き", "学校へ"], ["夕焼けや", "家に帰ろう", "カラスたち"], ["春の風", "花びら舞って", "きれいだな"],
    ["夏祭り", "浴衣の君と", "花火見る"], ["秋の空", "赤とんぼが", "飛んでいる"], ["雪が降る", "窓の外には", "白い道"],
  ],
  よくない句: [
    ["悲しいな", "桜が散って", "寂しいな"], ["今月は", "月曜からずっと", "雨だから"], ["楽しいな", "みんなで遊ぶ", "夏休み"],
    ["きれいだな", "青い空には", "白い雲"], ["思い出す", "あの日の夢を", "忘れない"], ["学校に", "行きたくないので", "休みたい"],
    ["ありがとう", "君と僕との", "永遠に"], ["寒いので", "こたつに入って", "みかん食う"],
  ],
};

kuromoji.builder({ dicPath: path.join(path.dirname(require.resolve("kuromoji")), "../dict") }).build((err, tk) => {
  if (err) throw err;
  window.kuromoji = { builder: () => ({ build: (cb) => cb(null, tk) }) };
  global.document = { createElement: () => ({}), head: { appendChild: (s) => setTimeout(() => s.onload(), 0) }, getElementById: () => null };
  window.Judge.loadDict();
  setTimeout(() => {
    const verbose = process.argv.includes("-v");
    for (const [name, list] of Object.entries(SETS)) {
      const scores = list.map((l) => {
        const r = window.Judge.judge({ lines: l });
        if (verbose) console.log(`  ${String(r.score).padStart(3)} (型${r.kata}/表${r.hyogen}) ${l.join(" ")}  ${r.pts.filter((p) => p.d).map((p) => p.d).join(",")}`);
        return r.score;
      }).sort((a, b) => a - b);
      const med = scores[Math.floor(scores.length / 2)];
      const ari = scores.filter((x) => x >= 70).length;
      console.log(`${name.padEnd(5, "　")} 中央値 ${med}  最小 ${scores[0]}  最大 ${scores[scores.length - 1]}  才能アリ ${ari}/${scores.length}`);
    }
  }, 50);
});

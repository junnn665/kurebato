/* 句レバト — 名句の穴埋め
 * 江戸〜明治の名句（いずれも百年以上前の作品）の、上五・中七・下五のどこか一つを4択で当てる。
 * 10問で一局。自己ベストは localStorage "kure.meiku"。
 * 書式: [上五, 中七, 下五, 作者, 季節, 季語, ひとこと]
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const A = window.App;
  const esc = A.esc;
  const MEIKU = [
    ["古池や", "蛙飛び込む", "水の音", "松尾芭蕉", "春", "蛙", "静けさの中に響く、一瞬の水の音。芭蕉の作風を決めた一句。"],
    ["夏草や", "兵どもが", "夢の跡", "松尾芭蕉", "夏", "夏草", "平泉で、かつての戦場に茂る夏草を見て。"],
    ["閑さや", "岩にしみ入る", "蝉の声", "松尾芭蕉", "夏", "蝉", "山寺の静けさ。蝉の声が岩にしみこんでいくようだ。"],
    ["五月雨を", "集めて早し", "最上川", "松尾芭蕉", "夏", "五月雨", "梅雨の水を集めて、勢いよく流れる最上川。"],
    ["荒海や", "佐渡によこたふ", "天河", "松尾芭蕉", "秋", "天の川", "荒れる日本海の向こう、佐渡島へ天の川が横たわる。"],
    ["秋深き", "隣は何を", "する人ぞ", "松尾芭蕉", "秋", "秋深し", "晩秋、となりの人の暮らしにふと思いを寄せる。"],
    ["行春や", "鳥啼魚の", "目は泪", "松尾芭蕉", "春", "行く春", "『おくのほそ道』の旅立ち。鳥も魚も別れを惜しむ。"],
    ["山路来て", "何やらゆかし", "すみれ草", "松尾芭蕉", "春", "菫", "山道で見つけた小さなすみれに、なぜか心ひかれる。"],
    ["旅に病で", "夢は枯野を", "かけ廻る", "松尾芭蕉", "冬", "枯野", "芭蕉が最後に詠んだ句。夢の中で枯野をかけめぐる。"],
    ["菊の香や", "奈良には古き", "仏達", "松尾芭蕉", "秋", "菊", "菊の香りがただよう奈良の、古い仏たち。"],
    ["名月や", "池をめぐりて", "夜もすがら", "松尾芭蕉", "秋", "名月", "名月の夜、池のまわりを一晩じゅう歩いた。"],
    ["菜の花や", "月は東に", "日は西に", "与謝蕪村", "春", "菜の花", "一面の菜の花。東に月がのぼり、西に日が沈む。"],
    ["春の海", "終日のたり", "のたり哉", "与謝蕪村", "春", "春の海", "一日じゅう、のたりのたりとうねる春の海。"],
    ["五月雨や", "大河を前に", "家二軒", "与謝蕪村", "夏", "五月雨", "水かさの増した大河の前に、家がたった二軒。"],
    ["牡丹散て", "打かさなりぬ", "二三片", "与謝蕪村", "夏", "牡丹", "牡丹の花びらが二、三枚、重なり合って散った。"],
    ["夏河を", "越すうれしさよ", "手に草履", "与謝蕪村", "夏", "夏河", "草履を手に持って、冷たい夏の川を渡るうれしさ。"],
    ["しら梅に", "明る夜ばかりと", "なりにけり", "与謝蕪村", "春", "白梅", "蕪村の辞世。白梅の花に夜が明けていく。"],
    ["雀の子", "そこのけそこのけ", "御馬が通る", "小林一茶", "春", "雀の子", "小さな雀の子に「馬が通るからよけなさい」。"],
    ["やせ蛙", "負けるな一茶", "是にあり", "小林一茶", "春", "蛙", "やせた蛙の喧嘩を「負けるな、一茶がついてるぞ」と応援。"],
    ["我と来て", "遊べや親の", "ない雀", "小林一茶", "春", "雀の子", "親のいない雀に「いっしょに遊ぼう」。幼いころの自分を重ねて。"],
    ["名月を", "取ってくれろと", "泣く子かな", "小林一茶", "秋", "名月", "あの満月を取ってくれと泣く子ども。"],
    ["是がまあ", "つひの栖か", "雪五尺", "小林一茶", "冬", "雪", "雪深いふるさとに帰り、ここが終の住みかか、と。"],
    ["雪とけて", "村一ぱいの", "子どもかな", "小林一茶", "春", "雪解", "雪がとけて、村じゅうに子どもがあふれ出す。"],
    ["やれ打つな", "蝿が手をすり", "足をする", "小林一茶", "夏", "蝿", "手足をすり合わせる蝿に「打たないでやって」。"],
    ["柿食へば", "鐘が鳴るなり", "法隆寺", "正岡子規", "秋", "柿", "奈良で柿を食べていると、法隆寺の鐘が鳴った。"],
    ["いくたびも", "雪の深さを", "尋ねけり", "正岡子規", "冬", "雪", "病で寝たきりの子規が、外の雪の深さを何度も尋ねる。"],
    ["鶏頭の", "十四五本も", "ありぬべし", "正岡子規", "秋", "鶏頭", "病床から、庭の鶏頭は十四、五本はあるだろうと思う。"],
    ["朝顔に", "つるべ取られて", "もらひ水", "加賀千代女", "秋", "朝顔", "井戸のつるべに朝顔が巻きつき、となりへ水をもらいに行く。"],
    ["目には青葉", "山ほととぎす", "初鰹", "山口素堂", "夏", "青葉", "青葉・ほととぎす・初鰹。初夏の喜びを目・耳・舌で。"],
    ["遠山に", "日の当りたる", "枯野かな", "高浜虚子", "冬", "枯野", "手前は一面の枯野、遠くの山にだけ日が当たっている。"],
    ["赤い椿", "白い椿と", "落ちにけり", "河東碧梧桐", "春", "椿", "赤い椿と白い椿が、つぎつぎに落ちていく。"],
  ];
  const POS = ["上五", "中七", "下五"];
  const N = 10;
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const best = () => A.ls.get("kure.meiku", { best: 0, plays: 0 });
  const TITLE = (n) => (n >= 10 ? "宗匠" : n >= 8 ? "師範" : n >= 5 ? "門人" : "見習い");

  let Q = [], qi = 0, right = 0, answered = false;
  function start() {
    const picks = shuffle(MEIKU.map((_, i) => i)).slice(0, N);
    Q = picks.map((mi) => {
      const m = MEIKU[mi];
      const pos = Math.random() < 0.25 ? 1 : Math.random() < 0.5 ? 0 : 2;
      const others = shuffle(MEIKU.filter((x, i) => i !== mi && x[pos] !== m[pos]).map((x) => x[pos]));
      const opts = shuffle([m[pos], ...[...new Set(others)].slice(0, 3)]);
      return { m, pos, opts };
    });
    qi = 0; right = 0;
    A.show("meiku");
    render();
  }
  function render() {
    answered = false;
    const q = Q[qi];
    $("mkProgress").innerHTML = `第${window.Fuzei ? window.Fuzei.kan(qi + 1) : qi + 1}問 / ${N}　<span class="mk-right">正解 ${right}</span>`;
    $("mkTan").innerHTML = q.m.slice(0, 3).map((l, i) => `<span class="${i === q.pos ? "blank" : ""}">${i === q.pos ? "〇".repeat(Math.max(3, [...l].length)) : esc(l)}</span>`).join("");
    $("mkAsk").innerHTML = `<b>${POS[q.pos]}</b>に入るのは？`;
    $("mkOpts").innerHTML = q.opts.map((o, i) => `<button class="chip mk-opt" data-i="${i}"><span class="chip-w">${esc(o)}</span></button>`).join("");
    $("mkInfo").classList.add("hidden");
    $("mkNext").classList.add("hidden");
  }
  function answer(i) {
    if (answered) return;
    answered = true;
    const q = Q[qi];
    const ok = q.opts[i] === q.m[q.pos];
    if (ok) right++;
    $("mkOpts").querySelectorAll(".mk-opt").forEach((b, j) => {
      b.disabled = true;
      if (q.opts[j] === q.m[q.pos]) b.classList.add("correct");
      else if (j === i) b.classList.add("wrong");
    });
    $("mkTan").innerHTML = q.m.slice(0, 3).map((l, k) => `<span class="${k === q.pos ? "filled" : ""}">${esc(l)}</span>`).join("");
    $("mkInfo").innerHTML = `<div class="mk-verdict ${ok ? "ok" : "ng"}">${ok ? "正解" : "残念"}</div>
      <div class="mk-who">${esc(q.m[3])}</div>
      <div class="mk-kigo">季語「${esc(q.m[5])}」<span>${esc(q.m[4])}</span></div>
      <p class="mk-note">${esc(q.m[6])}</p>`;
    $("mkInfo").classList.remove("hidden");
    $("mkNext").textContent = qi < N - 1 ? "つぎの句へ" : "結果を見る";
    $("mkNext").classList.remove("hidden");
    $("mkProgress").querySelector(".mk-right").textContent = `正解 ${right}`;
  }
  function finish() {
    const b = best();
    const isBest = right > b.best;
    A.ls.set("kure.meiku", { best: Math.max(b.best, right), plays: b.plays + 1 });
    $("mkTan").innerHTML = `<span>十問中</span><span class="mk-final">${right}</span><span>問正解</span>`;
    $("mkAsk").innerHTML = `称号　<b>${TITLE(right)}</b>${isBest ? "　🎉 自己ベスト！" : ""}`;
    $("mkOpts").innerHTML = "";
    $("mkInfo").innerHTML = `<p class="mk-note center">自己ベスト ${Math.max(b.best, right)}問　・　挑戦 ${b.plays + 1}回</p><p class="note center">名句は歳時記の生きた見本。季語の使い方をまねてみよう</p>`;
    $("mkInfo").classList.remove("hidden");
    $("mkNext").textContent = "もう一局";
    $("mkNext").classList.remove("hidden");
    $("mkProgress").innerHTML = "一局おわり";
    qi = N;
  }
  $("meikuBtn").addEventListener("click", start);
  $("mkOpts").addEventListener("click", (e) => { const b = e.target.closest(".mk-opt"); if (b) answer(Number(b.dataset.i)); });
  $("mkNext").addEventListener("click", () => {
    if (qi >= N) { start(); return; }
    if (qi < N - 1) { qi++; render(); } else finish();
  });
  window.Meiku = { start, list: MEIKU };
})();

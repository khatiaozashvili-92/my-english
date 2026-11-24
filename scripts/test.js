/* My English — ლოგიკის შემოწმება node-ით (DOM-ის იმიტაცია) */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const DIR = "C:/Users/Khatia/Desktop/claude/my-english";

const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const dataJs = fs.readFileSync(path.join(DIR, "data.js"), "utf8");
const m = html.match(/<script>\n([\s\S]*?)<\/script>/);
if (!m) throw new Error("inline script not found");
const appJs = m[1];

let lastHtml = "";
const fails = [];
let promptAnswer = null;
function ok(cond, msg){ if (!cond) fails.push(msg); }

// ერთ HTML-ზე ერთივე ელემენტები უნდა დაბრუნდეს, თორემ აპის მიერ
// მიბმული onclick იკარგება. ქეში ატრიბუტის სახელზეა — ასე [data-ps] და
// [data-ps=jay] ერთსა და იმავე ობიექტებს ხედავს.
let elCache = new Map();
function camel(a){ return a.replace(/-(.)/g, (_,c)=>c.toUpperCase()); }
function allFor(h, attr){
  if (elCache.has(attr)) return elCache.get(attr);
  const out = [];
  const re = new RegExp('data-' + attr + '(?:="([^"]*)")?', 'g');
  let r;
  while ((r = re.exec(h))){
    const ds = {}; ds[camel(attr)] = r[1] === undefined ? "" : r[1];
    out.push({ dataset: ds, onclick: null, closest: () => null, style:{}, value:"", select(){} });
  }
  elCache.set(attr, out);
  return out;
}
function findAll(h, sel){
  const mm = sel.match(/^\[data-([a-z0-9-]+)(?:=([^\]]+))?\]$/i);
  if (!mm) return [];
  const list = allFor(h, mm[1]);
  if (!mm[2]) return list;
  return list.filter(e => e.dataset[camel(mm[1])] === mm[2]);
}

function makeEl(){
  return {
    set innerHTML(v){ lastHtml = v; this._html = v; elCache = new Map(); },
    get innerHTML(){ return this._html || ""; },
    querySelector(sel){ return findAll(lastHtml, sel)[0] || null; },
    querySelectorAll(sel){ return findAll(lastHtml, sel); },
    style: {}, value: "", select(){},
  };
}

const store = {};
const appEl = makeEl();
const sandbox = {
  document: {
    getElementById: () => appEl,
    createElement: () => makeEl(),
  },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k,v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  navigator: {},
  location: { origin: "http://x" },
  confirm: () => true,
  prompt: () => promptAnswer,
  alert: () => {},
  scrollTo: () => {},
  addEventListener: () => {},
  console,
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(dataJs, ctx);
// let/const არ ხდება global property vm-ში — ვამატებ ხიდს
vm.runInContext(appJs + ";globalThis.__t={get view(){return view},set view(v){view=v},get dir(){return dir},set dir(v){dir=v},get sel(){return sel},get dsel(){return dsel},set dsel(v){dsel=v},get diffs(){return diffs}};", ctx);

const S = sandbox;
const T = () => S.__t;
Object.defineProperty(S, "view", { get: () => T().view, set: v => { T().view = v; } });
Object.defineProperty(S, "dir",  { get: () => T().dir,  set: v => { T().dir = v; } });
Object.defineProperty(S, "dsel", { get: () => T().dsel, set: v => { T().dsel = v; } });

const click = (sel, i) => {
  const els = appEl.querySelectorAll(sel);
  ok(els.length > (i||0), "ღილაკი ვერ ვიპოვე: " + sel);
  const el = els[i||0];
  if (el && el.onclick) el.onclick({ target:{ closest: () => null } });
  return el;
};

/* ───────── მონაცემები ───────── */
ok(S.DATA.sections.map(s=>s.name).join("|") === "JAY'S Lab|Interested|next",
  "განყოფილებები: " + S.DATA.sections.map(s=>s.name).join("|"));
ok(S.DATA.cards.length === 300, "300 ბარათი უნდა იყოს, არის " + S.DATA.cards.length);
ok(S.DATA.groups.length === 1 && S.DATA.groups[0].name === "იდიომები",
  "ერთი ჯგუფი „იდიომები“ უნდა იყოს");
const themes = [...new Set(S.DATA.cards.map(c=>c.src))];
ok(themes.length === 30, "30 თემა, არის " + themes.length);
const keys = S.DATA.cards.map(c=>c.en.trim().toLowerCase());
ok(new Set(keys).size === 300, "ინგლისური ტექსტები უნიკალური უნდა იყოს (" + new Set(keys).size + ")");
S.DATA.cards.forEach(c => {
  ok(c.en && c.ka, "ცარიელი ბარათი: " + JSON.stringify(c));
  ok(c.sec === null && c.grp === null, "ყველა ბარათი გასანაწილებელში უნდა იყოს: " + c.en);
  ok(!/[ა-ჰ][a-zA-Z]|[a-zA-Z][ა-ჰ]/.test(c.ka), "ქართულში ლათინური ასო: " + c.ka);
});

/* ───────── მთავარი ეკრანი ───────── */
S.go({name:"home"});
ok(/გასანაწილებელი — 300/.test(lastHtml), "მთავარზე გასანაწილებელი 300: " + (lastHtml.match(/გასანაწილებელი — \d+/)||[]));
ok(/JAY/.test(lastHtml) && /Interested/.test(lastHtml) && /next/.test(lastHtml), "სამივე განყოფილება");

/* ───────── ჯგუფი სამივე განყოფილებაში ───────── */
["jay","interested","next"].forEach(id => {
  S.go({name:"section", sec:id});
  ok(/იდიომები/.test(lastHtml), "„იდიომები“ უნდა ჩანდეს განყოფილებაში " + id);
});

/* ───────── გასანაწილებელი → თემები ───────── */
S.go({name:"inboxThemes"});
ok(/300 ბარათი · 30 თემა/.test(lastHtml), "თემების ეკრანი: " + (lastHtml.match(/\d+ ბარათი · \d+ თემა/)||[]));
ok(/ყოველდღიური საუბარი/.test(lastHtml), "თემის სახელი ჩანს");

/* ───────── ერთი თემის სია → ყველას მონიშვნა → ჯგუფის მინიჭება ───────── */
S.go({name:"list", kind:"theme", theme:themes[0], back:{name:"inboxThemes"}});
ok(/10 ბარათი/.test(lastHtml), "თემაში 10 ბარათი: " + (lastHtml.match(/\d+ ბარათი/)||[]));
ok(/ჯგუფი არ აქვს/.test(lastHtml), "ბარათს ჯერ ჯგუფი არ უნდა ჰქონდეს");
click("[data-all]");
ok(Object.keys(T().sel).length === 10, "10 ბარათი უნდა მოინიშნოს, მოინიშნა " + Object.keys(T().sel).length);
ok(/მონიშნული 10/.test(lastHtml) && /🗂 ჯგუფის მინიჭება/.test(lastHtml), "ქვედა ღილაკი მონიშვნის მერე");
click("[data-move]");
ok(S.view.name === "assign", "უნდა გადავიდეს მინიჭების ეკრანზე, გადავიდა: " + S.view.name);
ok(/10 ბარათი/.test(lastHtml) && /რომელ განყოფილებაში/.test(lastHtml), "მინიჭების ეკრანი");
click("[data-ps=jay]");
click("[data-pg=idioms]");
ok(/JAY'S Lab \/ იდიომები/.test(lastHtml), "არჩეული მიმართულება ღილაკზე: " + (lastHtml.match(/✅ 10 ბარათი → [^<]*/)||[]));
click("[data-save]");
ok(S.view.name === "inboxThemes", "შენახვის მერე თემების სიაში უნდა დაბრუნდეს, არის: " + S.view.name);
ok(/290 ბარათი · 29 თემა/.test(lastHtml), "გასანაწილებელში 290 უნდა დარჩეს: " + (lastHtml.match(/\d+ ბარათი · \d+ თემა/)||[]));

/* ჯგუფი მიენიჭა და ჩანს JAY'S Lab-ში */
S.go({name:"section", sec:"jay"});
ok(/<b>10<\/b> ბარათი/.test(lastHtml), "JAY'S Lab/იდიომები = 10 ბარათი: " + (lastHtml.match(/<b>\d+<\/b> ბარათი/g)||[]));
S.go({name:"section", sec:"interested"});
ok(/<b>0<\/b> ბარათი/.test(lastHtml), "Interested-ში ჯერ 0 უნდა იყოს");

/* ───────── ბარათები: ქართული წინა მხარეს არ ჩანს ───────── */
S.go({name:"cards", sec:"jay", grp:"idioms", i:0, flip:false, deck:null});
const deck = S.view.deck.items;
ok(deck.length === 10, "დასტაში 10 ბარათი: " + deck.length);
const kaAll = deck.map(c=>c.ka);
ok(!kaAll.some(t => lastHtml.includes(t)), "⚠️ წინა მხარეს ქართული არ უნდა ჩანდეს!");
ok(/დააჭირე პასუხისთვის/.test(lastHtml) && /🔊/.test(lastHtml), "მინიშნება და ხმის ღილაკი");
S.view.flip = true; S.render();
ok(kaAll.some(t => lastHtml.includes(t)), "გადაბრუნებისას ქართული ჩანს");

/* „ვიცი“ ერთი მხარე = ½, ორივე = 🏆 */
const c0 = deck[0];
S.view.flip = false; S.render();
click("[data-know]");
ok(S.view.i === 1, "„ვიცი“-ს მერე შემდეგ ბარათზე უნდა გადავიდეს");
S.go({name:"section", sec:"jay"});
ok(/½ 1/.test(lastHtml), "ერთი მიმართულება = ½ 1: " + (lastHtml.match(/½ \d+|🏆 \d+/g)||[]));
S.dir = "ka";
S.go({name:"cards", sec:"jay", grp:"idioms", i:0, flip:false, deck:null});
const kaDeck = S.view.deck.items;
ok(kaDeck.length === 10, "ქარ→EN მიმართულებით ისევ 10 ბარათი: " + kaDeck.length);
ok(!/🔊/.test(lastHtml), "ქარ→EN წინა მხარეს ხმის ღილაკი არ უნდა იყოს");
const idx = kaDeck.findIndex(c => c.en === c0.en);
S.view.i = idx; S.view.flip = false; S.render();
click("[data-know]");
S.go({name:"section", sec:"jay"});
ok(/🏆 1/.test(lastHtml), "ორივე მიმართულების მერე 🏆 1: " + (lastHtml.match(/½ \d+|🏆 \d+/g)||[]));
S.dir = "en";

/* ───────── ტესტი ───────── */
S.go({name:"quiz", sec:"jay", grp:"idioms", qi:0, score:0, qs:null});
const qs = S.view.qs;
ok(qs.length === 10, "10 ბარათზე 10 კითხვა: " + qs.length);
qs.forEach((q,i) => {
  ok(q.opts.length === 4, "კითხვა " + i + ": 4 ვარიანტი (" + q.opts.length + ")");
  ok(q.opts.filter(o=>o.ok).length === 1, "კითხვა " + i + ": ზუსტად ერთი სწორი");
  ok(new Set(q.opts.map(o=>o.text)).size === 4, "კითხვა " + i + ": ვარიანტები არ უნდა გაიმეოროს");
});
const q0 = qs[0];
const wrongIdx = q0.opts.findIndex(o => !o.ok);
q0.answered = true; q0.chosen = wrongIdx; S.render();
ok(/არასწორია/.test(lastHtml), "არასწორი პასუხი");
ok(/სინამდვილეში/.test(lastHtml) && lastHtml.includes(q0.opts[wrongIdx].owner.en),
  "⚠️ უნდა დაწეროს, არჩეული ქართული რომელ ინგლისურს ეკუთვნის");
q0.chosen = q0.opts.findIndex(o=>o.ok); S.render();
ok(/სწორია/.test(lastHtml), "სწორი პასუხი");

/* ───────── ჯგუფის შეცვლა მოგვიანებით ───────── */
S.go({name:"list", kind:"grp", sec:"jay", grp:"idioms", back:{name:"home"}});
ok(/JAY'S Lab · იდიომები/.test(lastHtml), "სიაში ჩანს მიმდინარე ადგილი");
click("[data-all]");
click("[data-move]");
click("[data-ps=next]");
click("[data-pg=idioms]");
click("[data-save]");
ok(S.view.name === "list", "შენახვის მერე იმავე სიაში უნდა დაბრუნდეს: " + S.view.name);
S.go({name:"section", sec:"next"});
ok(/<b>10<\/b> ბარათი/.test(lastHtml), "ბარათები next-ში უნდა გადავიდნენ: " + (lastHtml.match(/<b>\d+<\/b> ბარათი/g)||[]));
S.go({name:"section", sec:"jay"});
ok(/<b>0<\/b> ბარათი/.test(lastHtml), "JAY'S Lab უნდა დაიცარიელდეს");

/* პროგრესი გადატანის მერე არ უნდა დაიკარგოს */
S.go({name:"section", sec:"next"});
ok(/🏆 1/.test(lastHtml), "⚠️ გადატანის მერე პროგრესი უნდა შენარჩუნდეს: " + (lastHtml.match(/🏆 \d+|½ \d+/g)||[]));

/* ───────── გასანაწილებელში დაბრუნება ───────── */
S.go({name:"list", kind:"grp", sec:"next", grp:"idioms", back:{name:"home"}});
click("[data-all]");
click("[data-move]");
click("[data-inbox]");
S.go({name:"inboxThemes"});
ok(/300 ბარათი · 30 თემა/.test(lastHtml), "გასანაწილებელში უნდა დაბრუნდეს 300: " + (lastHtml.match(/\d+ ბარათი · \d+ თემა/)||[]));

/* ───────── ახალი ჯგუფის შექმნა ───────── */
promptAnswer = "ფრაზული ზმნები";
S.go({name:"grpAdmin"});
click("[data-newg]");
ok(/ფრაზული ზმნები/.test(lastHtml), "ახალი ჯგუფი უნდა გამოჩნდეს");
S.go({name:"section", sec:"interested"});
ok(/ფრაზული ზმნები/.test(lastHtml), "ახალი ჯგუფი სამივე განყოფილებაში უნდა იყოს");

/* სახელის შეცვლა */
promptAnswer = "იდიომები და გამოთქმები";
S.go({name:"grpAdmin"});
click("[data-ren=idioms]");
ok(/იდიომები და გამოთქმები/.test(lastHtml), "ჯგუფის სახელი უნდა შეიცვალოს");
S.go({name:"section", sec:"jay"});
ok(/იდიომები და გამოთქმები/.test(lastHtml), "ახალი სახელი განყოფილებაშიც");

/* ───────── ყველა ერთად მინიჭება ───────── */
S.go({name:"inboxThemes"});
click("[data-allinbox]");
ok(Object.keys(T().sel).length === 300, "ყველა 300 უნდა მოინიშნოს: " + Object.keys(T().sel).length);
click("[data-ps=interested]");
click("[data-pg=idioms]");
click("[data-save]");
S.go({name:"section", sec:"interested"});
ok(/<b>300<\/b> ბარათი/.test(lastHtml), "300 ბარათი Interested-ში: " + (lastHtml.match(/<b>\d+<\/b> ბარათი/g)||[]));
S.go({name:"home"});
ok(!/გასანაწილებელი —/.test(lastHtml), "გასანაწილებელი ცარიელია — კუბიკი არ უნდა ჩანდეს");

/* ───────── ტესტი დიდ დასტაზე (მაქს. 20 კითხვა) ───────── */
S.go({name:"quiz", sec:"interested", grp:"idioms", qi:0, score:0, qs:null});
ok(S.view.qs.length === 20, "დიდ დასტაზე 20 კითხვა: " + S.view.qs.length);

/* ───────── პროგრესი ───────── */
S.go({name:"progress"});
ok(/\/ 300/.test(lastHtml), "პროგრესზე სულ 300: " + (lastHtml.match(/\d+ \/ \d+/)||[]));

/* ═════════ სირთულე: მარტივი / საშუალო / რთული ═════════ */
S.dsel = "all";

/* ჯგუფის ეკრანზე ხუთი არჩევანი უნდა იყოს */
S.go({name:"group", sec:"interested", grp:"idioms"});
["🎲 ყველა — 300","🟢 მარტივი — 0","🟡 საშუალო — 0","🔴 რთული — 0","⚪ შეუფასებელი — 300"]
  .forEach(t => ok(lastHtml.includes(t), "ჯგუფის ეკრანზე უნდა ეწეროს „" + t + "“"));

/* ბარათზე სამი ღილაკი და დაჭერით შემდეგზე გადასვლა */
S.go({name:"cards", sec:"interested", grp:"idioms", i:0, flip:false, deck:null});
ok(/data-rate="easy"/.test(lastHtml) && /data-rate="mid"/.test(lastHtml) && /data-rate="hard"/.test(lastHtml),
  "ბარათზე სამივე სირთულის ღილაკი უნდა იყოს");
const d0 = S.view.deck.items[0], d1 = S.view.deck.items[1], d2 = S.view.deck.items[2];
click("[data-rate=easy]");
ok(T().diffs[d0.en.toLowerCase()] === "easy", "ბარათს „მარტივი“ უნდა მიენიჭოს");
ok(S.view.i === 1, "მინიჭების მერე შემდეგ ბარათზე უნდა გადავიდეს: i=" + S.view.i);
click("[data-rate=hard]");
click("[data-rate=mid]");
ok(T().diffs[d1.en.toLowerCase()] === "hard" && T().diffs[d2.en.toLowerCase()] === "mid",
  "რთული და საშუალო უნდა მიენიჭოს");

/* მთავარ ეკრანზე და ჯგუფში რიცხვები უნდა განახლდეს */
S.go({name:"section", sec:"interested"});
ok(/🟢 1 · 🟡 1 · 🔴 1 · ⚪ 297/.test(lastHtml), "ჯგუფის კუბიკზე სირთულის რიცხვები: " + (lastHtml.match(/🟢 \d+ · 🟡 \d+ · 🔴 \d+ · ⚪ \d+/)||[]));

/* „მარტივში“ შესვლა — მხოლოდ ერთი ბარათი */
S.dsel = "easy";
S.go({name:"group", sec:"interested", grp:"idioms"});
ok(/არჩეულია <b>1<\/b> ბარათი/.test(lastHtml), "მარტივში 1 ბარათი: " + (lastHtml.match(/არჩეულია <b>\d+<\/b>/)||[]));
S.go({name:"cards", sec:"interested", grp:"idioms", i:0, flip:false, deck:null});
ok(S.view.deck.items.length === 1, "მარტივის დასტაში 1 ბარათი: " + S.view.deck.items.length);
ok(lastHtml.includes(d0.en), "დასტაში სწორი ბარათი უნდა იყოს");
ok(/🟢/.test(lastHtml), "ბარათზე მიმდინარე სირთულე უნდა ჩანდეს");

/* მარტივიდან რთულში გადატანა — ბარათი მაშინვე ამოვარდება დასტიდან */
click("[data-rate=hard]");
ok(T().diffs[d0.en.toLowerCase()] === "hard", "მარტივიდან რთულში უნდა გადავიდეს");
ok(S.view.deck.items.length === 0, "⚠️ გადატანილი ბარათი მიმდინარე დასტიდან უნდა ამოვარდეს: " + S.view.deck.items.length);
ok(/დასტა დასრულდა/.test(lastHtml), "დასტა უნდა დასრულდეს");
S.dsel = "easy";
S.go({name:"group", sec:"interested", grp:"idioms"});
ok(/🟢 მარტივი — 0/.test(lastHtml), "მარტივში 0 უნდა დარჩეს");
S.dsel = "hard";
S.go({name:"group", sec:"interested", grp:"idioms"});
ok(/🔴 რთული — 2/.test(lastHtml), "რთულში 2 უნდა იყოს: " + (lastHtml.match(/🔴 რთული — \d+/)||[]));

/* სირთულის მოხსნა */
S.go({name:"cards", sec:"interested", grp:"idioms", i:0, flip:false, deck:null});
const h0 = S.view.deck.items[0];
click("[data-unrate]");
ok(!T().diffs[h0.en.toLowerCase()], "სირთულე უნდა მოიხსნას");

/* სიიდან ბულკ-მინიჭება */
S.dsel = "none";
S.go({name:"list", kind:"grp", sec:"interested", grp:"idioms", back:{name:"home"}});
const noneRows = S.view.kind;
click("[data-all]");
ok(Object.keys(T().sel).length > 200, "შეუფასებლები უნდა მოინიშნოს: " + Object.keys(T().sel).length);
ok(/მონიშნულ \d+ ბარათს სირთულე/.test(lastHtml), "ბულკ-სირთულის ზოლი უნდა გამოჩნდეს");
click("[data-bulk=mid]");
ok(Object.keys(T().sel).length === 0, "ბულკის მერე მონიშვნა უნდა მოიხსნას");
S.dsel = "mid";
S.go({name:"group", sec:"interested", grp:"idioms"});
ok(/🟡 საშუალო — 29[89]/.test(lastHtml), "საშუალოში ~298 ბარათი: " + (lastHtml.match(/🟡 საშუალო — \d+/)||[]));
S.dsel = "none";
S.go({name:"group", sec:"interested", grp:"idioms"});
ok(/⚪ შეუფასებელი — 0/.test(lastHtml), "შეუფასებელი უნდა დაიცარიელდეს: " + (lastHtml.match(/⚪ შეუფასებელი — \d+/)||[]));

/* სირთულე ჯგუფის გადატანისას არ უნდა დაიკარგოს */
S.dsel = "all";
S.go({name:"list", kind:"grp", sec:"interested", grp:"idioms", back:{name:"home"}});
click("[data-all]");
click("[data-move]");
click("[data-ps=jay]");
click("[data-pg=idioms]");
click("[data-save]");
S.go({name:"section", sec:"jay"});
ok(/🟡 29[89]/.test(lastHtml), "⚠️ გადატანის მერე სირთულე უნდა შენარჩუნდეს: " + (lastHtml.match(/🟢 \d+ · 🟡 \d+ · 🔴 \d+ · ⚪ \d+/)||[]));

/* ტესტში პასუხის მერე სირთულის მინიჭება */
S.dsel = "all";
S.go({name:"quiz", sec:"jay", grp:"idioms", qi:0, score:0, qs:null});
S.view.qs[0].answered = true; S.view.qs[0].chosen = 0; S.render();
ok(/data-rate="hard"/.test(lastHtml), "ტესტში პასუხის მერე სირთულის ღილაკები უნდა იყოს");
const qc = S.view.qs[0].c;
click("[data-rate=hard]");
ok(T().diffs[qc.en.toLowerCase()] === "hard", "ტესტიდანაც უნდა მიენიჭოს სირთულე");

/* ექსპორტში სირთულეც უნდა იყოს */
S.go({name:"grpAdmin"});
ok(!/<textarea/.test(lastHtml), "სარეზერვო ტექსტი დამალული უნდა იყოს");
click("[data-showexp]");
ok(/<textarea/.test(lastHtml), "„ტექსტის ნახვა“ უნდა აჩვენებდეს");
const expJson = lastHtml.match(/<textarea readonly id="exp">([\s\S]*?)<\/textarea>/);
ok(!!expJson, "ექსპორტის ველი უნდა იყოს");
if (expJson){
  const parsed = JSON.parse(expJson[1].replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">"));
  ok(parsed.diff && Object.keys(parsed.diff).length > 200, "ექსპორტში სირთულეები უნდა იყოს");
  ok(parsed.place && Object.keys(parsed.place).length > 200, "ექსპორტში ჯგუფები უნდა იყოს");
}

/* ───────── ფაილები ───────── */
["index.html","data.js","sw.js","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png","README.md"]
  .forEach(f => ok(fs.existsSync(path.join(DIR,f)), "ფაილი არ არსებობს: " + f));
JSON.parse(fs.readFileSync(path.join(DIR,"manifest.webmanifest"),"utf8"));

if (fails.length){
  console.log("❌ " + fails.length + " შეცდომა:");
  fails.forEach(f => console.log("   • " + f));
  process.exit(1);
}
console.log("✅ ყველა შემოწმება გავლილია (" + S.DATA.cards.length + " ბარათი, " + themes.length + " თემა)");

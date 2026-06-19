require("dotenv").config();
const fs    = require("fs");
const axios = require("axios");
const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// ─── STORAGE ──────────────────────────────────────────────────────────────────

const DATA_FILE = "./data.json";

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { users: {} }; }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(data, uid) {
  if (!data.users[uid]) data.users[uid] = {};
  const u = data.users[uid];
  u.inventory   = u.inventory   ?? [];
  u.balance     = u.balance     ?? 0;
  u.xp          = u.xp          ?? 0;
  u.cooldowns   = u.cooldowns   ?? {};
  u.quest       = u.quest       ?? null;
  u.usageCounts = u.usageCounts ?? {};
  return u;
}

// ─── LEVELS ──────────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1,  xp: 0,    title: "Krusty Krab Newbie 🐣" },
  { level: 2,  xp: 100,  title: "Junior Fry Cook 🍳" },
  { level: 3,  xp: 250,  title: "Jellyfish Wrangler 🪼" },
  { level: 4,  xp: 500,  title: "Coral Guardian 🪸" },
  { level: 5,  xp: 900,  title: "Spatula Knight ⚔️" },
  { level: 6,  xp: 1400, title: "Bikini Bottom Veteran 🌊" },
  { level: 7,  xp: 2100, title: "Krabby Legend 🍔" },
  { level: 8,  xp: 3000, title: "Deep Sea Master 🌑" },
  { level: 9,  xp: 5000, title: "Barnacle King 🐚" },
  { level: 10, xp: 8000, title: "Legendary Sponge 🧽✨" },
];

function calcLevel(xp) {
  let cur = LEVELS[0];
  for (const l of LEVELS) { if (xp >= l.xp) cur = l; else break; }
  return cur;
}

function nextLvl(xp) { return LEVELS.find(l => l.xp > xp) || null; }

function applyXP(user, amount) {
  const before = calcLevel(user.xp);
  user.xp += amount;
  const after = calcLevel(user.xp);
  return after.level > before.level
    ? `\n🎉 *LEVEL UP!!* You're now Level ${after.level}: *${after.title}*!`
    : "";
}

function xpBar(user) {
  const cur  = calcLevel(user.xp);
  const next = nextLvl(user.xp);
  if (!next) return `⭐ ${user.xp} XP · *MAX LEVEL*`;
  const filled = Math.round(((user.xp - cur.xp) / (next.xp - cur.xp)) * 10);
  return `⭐ ${"█".repeat(filled)}${"░".repeat(10 - filled)} ${user.xp}/${next.xp} XP`;
}

// ─── COOLDOWNS ───────────────────────────────────────────────────────────────

const CD = { fish: 30 * 60 * 1000, jellyfish: 20 * 60 * 1000, work: 60 * 60 * 1000 };

function checkCD(user, action) {
  const elapsed = Date.now() - (user.cooldowns[action] || 0);
  if (elapsed < CD[action]) {
    const mins = Math.ceil((CD[action] - elapsed) / 60000);
    return `⏳ *Cooldown!* Come back in *${mins} min*.`;
  }
  return null;
}

function setCD(user, action) { user.cooldowns[action] = Date.now(); }

// ─── QUESTS ──────────────────────────────────────────────────────────────────

const QUEST_POOL = [
  {
    id: "sandy_coral", character: "Sandy 🤠",
    description: "Bring me *3 Glowing Coral 🪸* for my treedome experiments!",
    target: "Glowing Coral 🪸", count: 3,
    reward: { sd: 80, xp: 60, item: "Sandy's Telescope 🔭" },
  },
  {
    id: "spongebob_patty", character: "SpongeBob 🧽",
    description: "I need *2 Krabby Patties 🍔* to cheer Patrick up!! PLEASE!!",
    target: "Krabby Patty 🍔", count: 2,
    reward: { sd: 60, xp: 50, item: "Bubble Wand 🫧" },
  },
  {
    id: "krabs_shell", character: "Mr. Krabs 💰",
    description: "ME LUCKY DIME IS GONE!! Bring me *2 Golden Shell 🐚* or I'll charge ya double!",
    target: "Golden Shell 🐚", count: 2,
    reward: { sd: 100, xp: 70, item: "Mr. Krabs' Lucky Dime 🪙" },
  },
  {
    id: "plankton_helmet", character: "Plankton 🦠",
    description: "Psst! Bring me *Plankton's Tiny Helmet 🪖*. I lost it. Don't ask questions.",
    target: "Plankton's Tiny Helmet 🪖", count: 1,
    reward: { sd: 120, xp: 80, item: "Plankton's Secret Formula 📜 (probably fake)" },
  },
  {
    id: "patrick_boot", character: "Patrick 🪨",
    description: "Hey... can you bring me *1 Soggy Boot 👢*? I lost mine. Maybe it was yours.",
    target: "Soggy Boot 👢", count: 1,
    reward: { sd: 30, xp: 25, item: "Patrick's Favorite Rock 🪨" },
  },
  {
    id: "squidward_anchor", character: "Squidward 😒",
    description: "Fine. I need *1 Ancient Anchor ⚓*. For artistic purposes. Don't look at me.",
    target: "Ancient Anchor ⚓", count: 1,
    reward: { sd: 50, xp: 35, item: "Squidward's Signed Clarinet Reed 😒" },
  },
];

function questHint(user) {
  if (!user.quest) return "";
  const have = user.inventory.filter(i => i === user.quest.target).length;
  if (have >= user.quest.count)
    return `\n🎯 *Quest ready!* ${have}/${user.quest.count} ${user.quest.target} — \`/bikinibot-quest submit\``;
  if (have > 0)
    return `\n🎯 Quest progress: ${have}/${user.quest.count} ${user.quest.target}`;
  return "";
}

// ─── MILESTONES ──────────────────────────────────────────────────────────────

const MILESTONES = {
  spongebob: {
    10: "🧽 WAIT — you've talked to me *10 TIMES*?! YOU'RE MY BEST FRIEND!!",
    25: "🧽 *25 TIMES!!* YOU LOVE ME!! I KNEW IT!! GARY COME LOOK!! 🌈",
    50: "🧽 *50 INTERACTIONS!!* THIS IS THE GREATEST MOMENT OF MY LIFE!!",
    100:"🧽 *ONE HUNDRED!!* MR KRABS COME LOOK!! THEY LOVE ME MORE THAN MONEY!!",
  },
  patrick: {
    10: "🪨 ...hey. you come here a lot. that's nice.",
    25: "🪨 you've talked to me 25 times. i counted. slowly.",
    50: "🪨 okay so we're like... best friends now, right? right.",
    100:"🪨 100 times. wow. i'm gonna go tell my rock.",
  },
  squidward: {
    10: "😒 ...you've been back 10 times. I genuinely don't understand.",
    25: "😒 25 visits. You are either bored or you enjoy my suffering.",
    50: "😒 50 times. I've started expecting you. That's terrible.",
    100:"😒 One hundred. Fine. You can sit at my table. Don't talk.",
  },
  mrkrabs: {
    10: "💰 10 VISITS!! That's loyalty!! That'll cost extra!!",
    25: "💰 25 TIMES!! You're me best customer!! That also costs extra!!",
    50: "💰 50 VISITS!! I should charge you a subscription fee!!",
    100:"💰 ONE HUNDRED!! Here's a commemorative coin! It costs 5 SD!",
  },
};

function trackMilestone(user, char) {
  user.usageCounts[char] = (user.usageCounts[char] || 0) + 1;
  const ms = MILESTONES[char];
  return ms?.[user.usageCounts[char]] ? `\n\n${ms[user.usageCounts[char]]}` : "";
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function has(text, words) { return words.some(w => text.includes(w)); }
function clean(text) { return (text || "").toLowerCase().trim(); }
function hasItem(user, name) { return user.inventory.includes(name); }

app.error(err => console.error("GLOBAL SLACK ERROR:", err));

// ─── CHARACTER COMMANDS ───────────────────────────────────────────────────────

const spongebobReplies = [
  t => `🧽 OMG "${t}"!!! THAT'S AMAZING!!!`,
  t => `🧽 "${t}"? LET'S TURN IT INTO FUN!!!`,
  t => `🧽 I LOVE THAT IDEA: "${t}"!!!`,
  () => `🧽 I'M READY!! I'M READY!! I'M READY!!`,
  () => `🧽 LET'S GOOO!!!`,
  () => `🧽 THIS IS THE BEST DAY EVER!!!`,
  () => `🧽 ABSOLUTELY BUBBLY ENERGY!!!`,
  t => `🧽 "${t}" MAKES ME WANT TO FLIP PATTIES!!!`,
  () => `🧽 YIPPEE!!!`,
  () => `🧽 GARY!! GARY!! MEOOOW!!`,
  t => `🧽 I WROTE "${t}" IN MY BEST DAY JOURNAL!!`,
  () => `🧽 IMAGINATION!!! 🌈🌈🌈`,
  t => `🧽 "${t}" IS MY NEW FAVORITE THING IN THE OCEAN!!`,
  () => `🧽 SQUIDWARD COME LOOK AT THIS RIGHT NOW!!!`,
  () => `🧽 I MADE A NEW FRIEND AND IT WAS ME!!`,
  () => `🧽 ARE YOU FEELING IT NOW MR KRABS?? BECAUSE I AM!!`,
];

app.command("/bikinibot-spongebob", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const text = clean(command.text);
  const ms = trackMilestone(user, "spongebob"); saveData(data);
  if (!text) return respond("🧽 SAY SOMETHING!!" + ms);
  if (has(text, ["sad", "bad", "upset", "angry"])) return respond("🧽 DON'T WORRY!! KRABBY PATTY ENERGY!! 🍔✨" + ms);
  if (has(text, ["gary", "snail"])) return respond("🧽 GARY I LOVE YOU!!! 🐌💙" + ms);
  if (has(text, ["patrick"])) return respond("🧽 PATRICK IS MY BEST FRIEND IN THE WHOLE OCEAN!!! 🌊💛" + ms);
  if (has(text, ["squidward"])) return respond("🧽 HI SQUIDWARD!! HAVE A GREAT DAY!!! 🧽" + ms);
  return respond(pick(spongebobReplies)(text) + ms);
});

const patrickReplies = [
  t => `🪨 I heard "${t}"... I think.`,
  t => `🪨 "${t}" sounds like a rock problem.`,
  () => `🪨 Is mayonnaise involved?`,
  () => `🪨 I forgot what we were talking about.`,
  () => `🪨 That made my brain hurt.`,
  () => `🪨 I agree. Maybe. Probably not.`,
  () => `🪨 I like rocks.`,
  t => `🪨 "${t}"? sounds edible.`,
  () => `🪨 huh.`,
  () => `🪨 ...is this the Krusty Krab?`,
  () => `🪨 I had a thought once. It left.`,
  t => `🪨 "${t}"... like donuts?`,
  () => `🪨 I'm not dumb. I just have a unique relationship with thinking.`,
  () => `🪨 SpongeBob would know. Where is he.`,
  () => `🪨 I was going to say something. Give me a minute.`,
];

app.command("/bikinibot-patrick", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const text = clean(command.text);
  const ms = trackMilestone(user, "patrick"); saveData(data);
  if (!text) return respond("🪨 ...hi" + ms);
  if (has(text, ["smart", "genius", "idea"])) return respond("🪨 THAT'S IT! THAT'S THE GENIUS IDEA!! ...wait what was it." + ms);
  if (has(text, ["food", "eat", "hungry"])) return respond("🪨 I'M HUNGRY TOO. LET'S GO GET STUFF. 🍩" + ms);
  return respond(pick(patrickReplies)(text) + ms);
});

const squidwardReplies = [
  t => `😒 "${t}"... why would you say that.`,
  t => `😒 I regret reading "${t}".`,
  t => `😒 You said "${t}" and I lost motivation.`,
  () => `😒 Do I care? No.`,
  () => `😒 I hate everything.`,
  () => `😒 This is exhausting.`,
  () => `😒 Please stop talking.`,
  () => `😒 I would like silence.`,
  t => `😒 "${t}" is deeply unnecessary.`,
  () => `😒 I was just about to practice clarinet. Please go away.`,
  () => `😒 Fascinating. I don't care.`,
  t => `😒 That's nice, "${t}". I'm going home.`,
  () => `😒 I've made a terrible mistake. Not this one, a previous one, but still.`,
  () => `😒 My therapist says I should engage more. This is engagement. Goodbye.`,
  () => `😒 I'm not upset. This is just my face. Forever.`,
];

app.command("/bikinibot-squidward", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const text = clean(command.text);
  const ms = trackMilestone(user, "squidward"); saveData(data);
  if (!text) return respond("😒 ..." + ms);
  if (has(text, ["hello", "hi", "hey", "yo"])) return respond("😒 hello. unfortunately." + ms);
  if (has(text, ["clarinet", "music", "art"])) return respond("😒 Finally someone appreciates real talent. Unlike SOME people." + ms);
  if (has(text, ["spongebob"])) return respond("😒 Please. Not today. Not ever." + ms);
  return respond(pick(squidwardReplies)(text) + ms);
});

const krabsReplies = [
  t => `💰 "${t}" = PROFIT DETECTED?!`,
  t => `💰 I LOVE "${t}" AND MONEY!!`,
  t => `💰 "${t}" is worth at least 5 cents!!`,
  () => `💰 WHERE'S MY MONEY?!`,
  () => `💰 I SMELL PROFIT!!!`,
  () => `💰 CHARGE THEM EXTRA!!!`,
  () => `💰 MONEY MONEY MONEY!!`,
  () => `💰 EVERYTHING IS PROFITABLE IF YOU BELIEVE HARD ENOUGH!!`,
  t => `💰 "${t}" better cost money!!`,
  () => `💰 I CAN HEAR THE MONEY CALLING MY NAME!!!`,
  () => `💰 ELEVEN CENTS!! ELEVEN WHOLE CENTS!!`,
  t => `💰 "${t}" gives me a business idea! Patent pending.`,
  () => `💰 ME MONEY! ME WANT MONEY! MONEY MONEY MONEY!!`,
  () => `💰 SpongeBob! Get back in that kitchen! We have a 2-cent profit margin!!`,
];

app.command("/bikinibot-mrkrabs", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const text = clean(command.text);
  const ms = trackMilestone(user, "mrkrabs"); saveData(data);
  if (!text) return respond("💰 DID YOU BRING MONEY?!" + ms);
  if (has(text, ["money", "profit", "$", "cash", "sd", "sand dollar"])) return respond("💰 PROFIT DETECTED!! GIVE ME MORE!!" + ms);
  if (has(text, ["free", "discount"])) return respond("💰 FREE?! *wheeze* THERE'S NO SUCH THING AS FREE AT THE KRUSTY KRAB!!!" + ms);
  return respond(pick(krabsReplies)(text) + ms);
});

const sandyReplies = [
  t => `🤠 Scientifically speaking, "${t}" is fascinating!`,
  t => `🤠 Let's break down "${t}" logically.`,
  t => `🤠 Interesting hypothesis: "${t}"`,
  () => `🤠 Let's analyze this situation.`,
  () => `🤠 Science says that's questionable.`,
  () => `🤠 That needs testing.`,
  () => `🤠 I got theories about that.`,
  t => `🤠 "${t}" could be an experiment!`,
  () => `🤠 Back in Texas we'd call that a challenge. Challenge accepted.`,
  () => `🤠 I've run the numbers. The numbers are alarming.`,
  t => `🤠 "${t}" violates at least three laws of physics. I love it.`,
  () => `🤠 My treedome experiments confirm: this is interesting.`,
  () => `🤠 Y'all need to read more marine biology. Starting now.`,
];

app.command("/bikinibot-sandy", async ({ ack, command, respond }) => {
  await ack();
  const text = clean(command.text);
  if (!text) return respond("🤠 Got something to analyze?");
  if (has(text, ["texas", "home"])) return respond("🤠 Don't mess with Texas! Or with me! 🤠⭐");
  if (has(text, ["karate", "fight", "battle"])) return respond("🤠 HI-YAH!! You wanna go?! I'm ready!! 🥋");
  return respond(pick(sandyReplies)(text));
});

const planktonReplies = [
  t => `🦠 "${t}" will finally help me steal the formula!!`,
  t => `🦠 KAREN!! "${t}" is part of my evil plan!!`,
  t => `🦠 "${t}" is genius... for me!!`,
  () => `🦠 KAREN!! EXECUTE PLAN!!`,
  () => `🦠 I WILL WIN THIS TIME!!`,
  () => `🦠 EVERYTHING IS GOING ACCORDING TO PLAN!!`,
  () => `🦠 SO CLOSE TO VICTORY!!`,
  () => `🦠 I AM NOT SMALL, I AM STRATEGIC!!`,
  t => `🦠 "${t}" will be weaponized!!`,
  () => `🦠 KAREN DO YOU BELIEVE IN ME?? ...KAREN?`,
  () => `🦠 ONE PERCENT EVIL. NINETY-NINE PERCENT HOT GAS!!`,
  t => `🦠 "${t}" is going into my evil database IMMEDIATELY.`,
  () => `🦠 I'VE BEEN RUNNING THIS PLAN FOR 374 YEARS AND TODAY IS THE DAY.`,
  () => `🦠 THE FORMULA WILL BE MINE!! *tiny evil laugh*`,
];

app.command("/bikinibot-plankton", async ({ ack, command, respond }) => {
  await ack();
  const text = clean(command.text);
  if (!text) return respond("🦠 SAY SOMETHING USEFUL!!");
  if (has(text, ["formula", "krabby patty", "secret"])) return respond("🦠 YOU KNOW ABOUT THE FORMULA?! TELL ME EVERYTHING!! NOW!!!!");
  if (has(text, ["karen", "computer"])) return respond("🦠 KAREN IS MY BRILLIANT WIFE AND COMPUTER!! SHE IS PERFECT!! ...mostly.");
  return respond(pick(planktonReplies)(text));
});

const bubblebassReplies = [
  () => `📢 I DEMAND A DOUBLE KRABBY PATTY WITH NO PICKLES!!!`,
  () => `📢 THIS IS UNACCEPTABLE CUSTOMER SERVICE!!!`,
  t => `📢 "${t}" IS OFFENSIVE TO MY PALATE!!!`,
  () => `📢 I WANT TO SPEAK TO THE MANAGER!!!`,
  () => `📢 I'VE BEEN WAITING THREE HOURS AND I WILL WAIT THREE MORE!!!`,
  () => `📢 THE PICKLES WERE UNDER MY TONGUE. AGAIN.`,
  t => `📢 "${t}" IS NOT ON THE MENU AND I DEMAND IT ANYWAY!!!`,
  () => `📢 I HAVE REVIEWED THIS ESTABLISHMENT. ONE STAR. ZERO IF I COULD.`,
];

app.command("/bikinibot-bubblebass", async ({ ack, command, respond }) => {
  await ack();
  const text = clean(command.text);
  if (!text) return respond("📢 EXCUSE ME???");
  if (has(text, ["pickle", "pickles"])) return respond("📢 THEY WERE UNDER MY TONGUE!!! HOW DID YOU KNOW???");
  return respond(pick(bubblebassReplies)(text));
});

const garyMeows = [
  () => `🐌 meow.`,
  () => `🐌 MEOW.`,
  () => `🐌 meow meow.`,
  () => `🐌 meoooow.`,
  () => `🐌 meow? meow.`,
  () => `🐌 ...meow.`,
  () => `🐌 MEOW MEOW MEOW.`,
  () => `🐌 meow :)`,
  () => `🐌 meow meow meow meow meow.`,
  () => `🐌 *looks at you* meow.`,
  () => `🐌 meow. _(translation: I knew you'd come back.)_`,
  () => `🐌 meow. _(translation: You should eat more vegetables.)_`,
  () => `🐌 meow. _(translation: SpongeBob forgot to feed me again.)_`,
  () => `🐌 meow. _(translation: I've seen things. Terrible things.)_`,
  () => `🐌 meow. _(translation: I love you but please go away.)_`,
  () => `🐌 meow. _(translation: I was a king in another life.)_`,
  () => `🐌 meow. _(translation: You look tired. Rest.)_`,
  () => `🐌 meow. _(translation: I know where the formula is. I won't tell you.)_`,
];

app.command("/bikinibot-gary", async ({ ack, command, respond }) => {
  await ack();
  const text = clean(command.text);
  if (has(text, ["spongebob", "bob"])) return respond("🐌 meow. _(translation: He means well. He really does.)_");
  if (has(text, ["food", "eat", "hungry", "snack"])) return respond("🐌 MEOW!! _(translation: FINALLY. I've been waiting ALL DAY.)_");
  if (has(text, ["love", "miss", "friend"])) return respond("🐌 ...meow. _(translation: I love you too. Don't make it weird.)_");
  if (has(text, ["bad", "sad", "upset", "hard"])) return respond("🐌 meow meow. _(translation: Come sit with me. I'll be here.)_");
  return respond(pick(garyMeows)());
});

// ─── UTILITY ─────────────────────────────────────────────────────────────────

app.command("/bikinibot-ping", async ({ ack, respond }) => {
  await ack();
  return respond("🏓 BikiniBot is alive!! 🟢");
});

// ─── FISH ────────────────────────────────────────────────────────────────────

const FISH_LOOT = {
  common:    [
    { name: "Rusty Spatula 🍳",  flavor: "Smells like decades of fry cook regret." },
    { name: "Broken Pearl 🔮",   flavor: "Pearl probably doesn't want it back." },
    { name: "Sea Trash Bag 🗑️", flavor: "Classic Bikini Bottom litter." },
    { name: "Soggy Boot 👢",     flavor: "Someone had a bad day." },
  ],
  uncommon:  [
    { name: "Cursed Tuna 🐟",   flavor: "It's looking at you. It knows." },
    { name: "Glowing Coral 🪸", flavor: "It hums a little tune." },
  ],
  rare:      [
    { name: "Golden Shell 🐚",      flavor: "It's warm. Don't ask why." },
    { name: "Ancient Anchor ⚓",    flavor: "Probably from a very old ship. Or Mr. Krabs." },
    { name: "Sandy's Telescope 🔭", flavor: "HOW did this end up down here." },
  ],
  legendary: [
    { name: "Plankton's Tiny Helmet 🪖", flavor: "He's going to be SO mad." },
  ],
};

app.command("/bikinibot-fish", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);

  const cd = checkCD(user, "fish");
  if (cd) { saveData(data); return respond(cd); }

  const hasNet = hasItem(user, "Fishing Net 🥅");
  const roll   = Math.random();
  const [t1, t2, t3] = hasNet ? [0.40, 0.70, 0.92] : [0.60, 0.85, 0.97];
  const rarity  = roll < t1 ? "common" : roll < t2 ? "uncommon" : roll < t3 ? "rare" : "legendary";
  const caught  = pick(FISH_LOOT[rarity]);
  const xpGain  = { common: 8, uncommon: 15, rare: 30, legendary: 75 }[rarity];
  const badge   = { common: "", uncommon: "✨ Uncommon! ", rare: "⭐ *Rare!* ", legendary: "🌟 *LEGENDARY!!* " }[rarity];

  user.inventory.push(caught.name);
  const levelUp = applyXP(user, xpGain);
  const hint    = questHint(user);
  setCD(user, "fish");
  saveData(data);

  return respond(
    `🎣 You cast your line into the deep...\n` +
    `${badge}*You caught: ${caught.name}*\n_${caught.flavor}_\n` +
    `⭐ +${xpGain} XP  ·  🎒 Added to inventory!` +
    levelUp + hint
  );
});

// ─── JELLYFISH ───────────────────────────────────────────────────────────────

app.command("/bikinibot-jellyfish", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);

  const cd = checkCD(user, "jellyfish");
  if (cd) { saveData(data); return respond(cd); }

  const hasJar = hasItem(user, "Jelly Jar 🫙");
  const roll   = Math.random();
  let jellyName, sd, xpGain, flavor;

  if (roll < 0.5) {
    jellyName = "Pink Jellyfish 🪼";    sd = 5;  xpGain = 10;
    flavor = "A gentle pink jelly drifts into your net!";
  } else if (roll < 0.8) {
    jellyName = "Electric Jellyfish ⚡"; sd = 15; xpGain = 20;
    flavor = "ZAP!! You barely catch it — singed but victorious!";
  } else {
    jellyName = "LEGENDARY Ghost Jellyfish 👻"; sd = 50; xpGain = 60;
    flavor = "🌟 THE GHOST JELLY APPEARS FROM THE VOID!! Caught with LEGENDARY skill!!";
  }

  const jarBonus = hasJar ? 10 : 0;
  user.inventory.push(jellyName);
  user.balance += sd + jarBonus;
  const levelUp = applyXP(user, xpGain);
  const hint    = questHint(user);
  setCD(user, "jellyfish");
  saveData(data);

  return respond(
    `🪼 ${flavor}\n*Caught: ${jellyName}*\n` +
    `💰 +${sd + jarBonus} SD${hasJar ? ` _(+${jarBonus} Jelly Jar bonus!)_` : ""}  ·  Balance: ${user.balance} SD\n` +
    `⭐ +${xpGain} XP  ·  🎒 Added to inventory!` +
    levelUp + hint
  );
});

// ─── WORK ────────────────────────────────────────────────────────────────────

app.command("/bikinibot-work", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);

  const cd = checkCD(user, "work");
  if (cd) { saveData(data); return respond(cd); }

  const jobs = [
    { title: "Krusty Krab fry cook",     flavor: "You flipped 300 patties. Your arms are sponge now." },
    { title: "jellyfish wrangler",        flavor: "Got zapped twice. The jellies respect you." },
    { title: "coral cleaner",            flavor: "So much algae. So, so much algae." },
    { title: "Plankton's test subject",  flavor: "You don't remember what happened. Your hair is gone." },
    { title: "Goo Lagoon lifeguard",     flavor: "Nobody drowned. You count that as a win." },
    { title: "Boating School assistant", flavor: "Mrs. Puff's eye is twitching. You did your best." },
    { title: "snail walker",             flavor: "Gary said meow 47 times. You understood all of them." },
    { title: "Chum Bucket taste tester", flavor: "Plankton paid you to eat it. Worth it. Barely." },
  ];

  const pay     = Math.floor(Math.random() * 40) + 5;
  const bonus   = hasItem(user, "Golden Spatula 🍳") ? 5 : 0;
  const total   = pay + bonus;
  const job     = pick(jobs);
  user.balance += total;
  const levelUp = applyXP(user, 10);
  setCD(user, "work");
  saveData(data);

  return respond(
    `💼 You worked as *${job.title}*\n_${job.flavor}_\n` +
    `💰 +${total} SD${bonus ? ` _(+${bonus} Spatula bonus!)_` : ""}  ·  Balance: ${user.balance} SD\n` +
    `⭐ +10 XP` + levelUp
  );
});

// ─── SHOP ────────────────────────────────────────────────────────────────────

const SHOP_ITEMS = [
  { name: "Net 🥅",          cost: 20, item: "Fishing Net 🥅",    desc: "Better fish rarity odds" },
  { name: "Spatula 🍳",      cost: 25, item: "Golden Spatula 🍳", desc: "+5 SD bonus when working" },
  { name: "Jelly Jar 🫙",    cost: 30, item: "Jelly Jar 🫙",      desc: "+10 SD per jellyfish catch" },
  { name: "Mystery Box 📦",  cost: 40, item: null,                desc: "Random rare item!" },
  { name: "Cursed Coral 🪸", cost: 35, item: "Cursed Coral 🪸",   desc: "Ominous. Collectable." },
  { name: "Bubble Wand 🫧",  cost: 15, item: "Bubble Wand 🫧",    desc: "Makes bubbles. Iconic." },
];

const MYSTERY_BOX_ITEMS = [
  "Plankton's Secret Formula 📜 (probably fake)",
  "SpongeBob's Old Spatula 🍳",
  "Patrick's Favorite Rock 🪨",
  "Squidward's Signed Clarinet Reed 😒",
  "Mr. Krabs' Lucky Dime 🪙",
  "Sandy's Karate Glove 🥋",
  "Gary's Shell Polish 🐌",
  "Mermaid Man's Belt Buckle 🦸",
];

app.command("/bikinibot-shop", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const text = clean(command.text);

  if (text.startsWith("buy ")) {
    const query = text.slice(4).trim();
    const found = SHOP_ITEMS.find(i => i.name.toLowerCase().includes(query));
    if (!found) { saveData(data); return respond(`🛒 Couldn't find "*${query}*" — check the shop with \`/bikinibot-shop\`!`); }
    if (user.balance < found.cost) { saveData(data); return respond(`💸 Not enough SD! You have *${user.balance} SD* but *${found.name}* costs *${found.cost} SD*.\n💼 Earn more with /bikinibot-work!`); }

    user.balance -= found.cost;
    if (!found.item) {
      const prize = pick(MYSTERY_BOX_ITEMS);
      user.inventory.push(prize);
      saveData(data);
      return respond(`📦 You bought a *Mystery Box* for ${found.cost} SD!\n*It contained: ${prize}* 🎉\n💰 Balance: ${user.balance} SD  ·  🎒 Added to inventory!`);
    }
    user.inventory.push(found.item);
    saveData(data);
    return respond(`🛒 You bought *${found.name}* for ${found.cost} SD!\n_${found.desc}_\n💰 Balance: ${user.balance} SD  ·  🎒 Added to inventory!`);
  }

  const listing = SHOP_ITEMS.map(i => `• *${i.name}* — ${i.cost} SD  _${i.desc}_`).join("\n");
  return respond(`🛒 *KRUSTY KRAB SHOP*\n${listing}\n\n💰 Your balance: ${user.balance} SD\n_Type \`/bikinibot-shop buy <item name>\` to purchase!_`);
});

// ─── KRABBY / ORDER / MENU ───────────────────────────────────────────────────

app.command("/bikinibot-krabby", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const ings = ["jellyfish jelly 🪼","coral crunch 🪸","sea lettuce 🥬","barnacle bits 🦪","pickle shards 🥒","seaweed sauce 🌿"];
  const bun  = pick(["sesame bun 🍞","burnt bun 🔥","no bun (panic) 😱"]);
  const ing1 = pick(ings); const ing2 = pick(ings.filter(i => i !== ing1));
  user.inventory.push("Krabby Patty 🍔");
  const levelUp = applyXP(user, 8); const hint = questHint(user);
  saveData(data);
  return respond(`🍔 *KRABBY PATTY MADE TO ORDER!*\n${ing1} + ${ing2} on a ${bun}\n⭐ +8 XP  ·  🎒 *Krabby Patty 🍔* added to inventory!` + levelUp + hint);
});

app.command("/bikinibot-order", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const results = [
    { msg: "🍔 *PERFECT ORDER!* Chef's kiss. SpongeBob is weeping with pride.", cost: 10 },
    { msg: "😭 *WRONG ORDER* — you got seaweed soup instead of a burger.", cost: 8 },
    { msg: "💰 *MR KRABS OVERCHARGED YOU.* He charged for the air too.", cost: 20 },
    { msg: "😒 *SQUIDWARD RUINED IT.* Somehow cold AND burnt. A new frontier.", cost: 10 },
    { msg: "🔥 *YOUR FOOD WAS ON FIRE* but was served with full confidence.", cost: 12 },
    { msg: "🪼 *You ordered the jellyfish special.* It's still alive.", cost: 15 },
  ];
  const result = pick(results);
  if (user.balance < result.cost) {
    saveData(data);
    return respond(`${result.msg}\n💸 But you only have *${user.balance} SD* (needs ${result.cost} SD). Mr. Krabs is calling the authorities.\n💼 /bikinibot-work to earn more!`);
  }
  user.balance -= result.cost;
  const levelUp = applyXP(user, 5);
  saveData(data);
  return respond(`${result.msg}\n💰 -${result.cost} SD  ·  Balance: ${user.balance} SD  ·  ⭐ +5 XP` + levelUp);
});

app.command("/bikinibot-menu", async ({ ack, respond }) => {
  await ack();
  return respond(
    "🍽️ *KRUSTY KRAB MENU*\n" +
    "• 🍔 Krabby Patty Deluxe — 10 SD\n• 🍟 Barnacle Fries — 5 SD\n• 🥤 Jellyfish Shake — 8 SD\n" +
    "• 🍔 Coral Burger Deluxe — 12 SD\n• 🍲 Seaweed Surprise Soup — 6 SD\n• 🪼 Jellyfish Special _(it's alive)_ — 15 SD\n\n" +
    "_Order with /bikinibot-order_"
  );
});

// ─── INVENTORY ───────────────────────────────────────────────────────────────

app.command("/bikinibot-inventory", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const text = clean(command.text);

  if (has(text, ["clear", "reset"])) {
    user.inventory = []; saveData(data);
    return respond("🎒 Inventory cleared! Fresh start in Bikini Bottom.");
  }

  const level = calcLevel(user.xp);
  const inv   = user.inventory;

  if (inv.length === 0) {
    saveData(data);
    return respond(
      `🎒 *YOUR INVENTORY* — Level ${level.level} ${level.title}\n${xpBar(user)}\n💰 ${user.balance} SD\n\n` +
      `_Nothing here yet! Try /bikinibot-fish, /bikinibot-jellyfish, or /bikinibot-krabby_`
    );
  }

  const counts  = {};
  inv.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
  const listing = Object.entries(counts).map(([item, n]) => `• ${item}${n > 1 ? ` ×${n}` : ""}`).join("\n");
  const qStatus = user.quest
    ? `\n\n🎯 Active quest: *${user.quest.target}* (${inv.filter(i => i === user.quest.target).length}/${user.quest.count}) — /bikinibot-quest`
    : "\n\n_No active quest — try /bikinibot-quest!_";
  saveData(data);

  return respond(
    `🎒 *YOUR INVENTORY* (${inv.length} items) — Level ${level.level} ${level.title}\n` +
    `${xpBar(user)}\n💰 ${user.balance} SD\n\n${listing}` + qStatus
  );
});

// ─── QUEST ───────────────────────────────────────────────────────────────────

app.command("/bikinibot-quest", async ({ ack, command, respond }) => {
  await ack();
  const data = loadData(); const user = getUser(data, command.user_id);
  const text = clean(command.text);

  if (has(text, ["submit", "done", "complete", "turn in", "finish"])) {
    if (!user.quest) { saveData(data); return respond("🎯 No active quest! Use `/bikinibot-quest` to get one."); }
    const have = user.inventory.filter(i => i === user.quest.target).length;
    if (have < user.quest.count) {
      saveData(data);
      return respond(`🎯 Not quite! Need *${user.quest.count} ${user.quest.target}* — you have ${have}.\nKeep fishing, wrangling, and crafting!`);
    }
    let removed = 0;
    user.inventory = user.inventory.filter(i => {
      if (i === user.quest.target && removed < user.quest.count) { removed++; return false; }
      return true;
    });
    const { sd, xp, item } = user.quest.reward;
    const charName = user.quest.character;
    user.balance += sd;
    const levelUp = applyXP(user, xp);
    if (item) user.inventory.push(item);
    user.quest = null;
    saveData(data);
    return respond(`🎯 *QUEST COMPLETE!* ${charName} thanks you!\n💰 +${sd} SD  ·  ⭐ +${xp} XP${item ? `  ·  🎒 *${item}*` : ""}` + levelUp);
  }

  if (!user.quest) {
    const q = pick(QUEST_POOL);
    user.quest = { id: q.id, character: q.character, description: q.description, target: q.target, count: q.count, reward: q.reward };
    saveData(data);
    return respond(
      `🎯 *NEW QUEST from ${q.character}*\n"${q.description}"\n\n` +
      `*Reward:* 💰 ${q.reward.sd} SD  ·  ⭐ ${q.reward.xp} XP${q.reward.item ? `  ·  🎒 ${q.reward.item}` : ""}\n\n` +
      `_Check progress: \`/bikinibot-quest\`  ·  Submit: \`/bikinibot-quest submit\`_`
    );
  }

  const have = user.inventory.filter(i => i === user.quest.target).length; 
  saveData(data);
  return respond(
    `🎯 *ACTIVE QUEST from ${user.quest.character}*\n"${user.quest.description}"\n\n` +
    `Progress: *${have}/${user.quest.count}* ${user.quest.target}\n` +
    `*Reward:* 💰 ${user.quest.reward.sd} SD  ·  ⭐ ${user.quest.reward.xp} XP${user.quest.reward.item ? `  ·  🎒 ${user.quest.reward.item}` : ""}\n\n` +
    (have >= user.quest.count ? `✅ Ready! Use \`/bikinibot-quest submit\`` : `_Keep going! Try /bikinibot-fish, /bikinibot-jellyfish, /bikinibot-krabby_`)
  );
});

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

app.command("/bikinibot-leaderboard", async ({ ack, respond }) => {
  await ack();
  const data   = loadData();
  const ranked = Object.entries(data.users)
    .map(([uid, u]) => ({ uid, balance: u.balance || 0, level: calcLevel(u.xp || 0) }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  if (ranked.length === 0) return respond("🏆 Nobody has earned SD yet! Try /bikinibot-work or /bikinibot-jellyfish!");

  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
  const lines  = ranked.map((r, i) => `${medals[i]} <@${r.uid}> — *${r.balance} SD* · Lvl ${r.level.level} ${r.level.title}`);
  return respond(`🏆 *BIKINI BOTTOM LEADERBOARD*\n${lines.join("\n")}`);
});

// ─── WHOAMI (full profile) ───────────────────────────────────────────────────

app.command("/bikinibot-whoami", async ({ ack, command, respond }) => {
  await ack();
  const data  = loadData(); const user = getUser(data, command.user_id);
  const level = calcLevel(user.xp);
  saveData(data);
  return respond(
    `🧍 *Your Bikini Bottom Profile*\n` +
    `*Level ${level.level}:* ${level.title}\n${xpBar(user)}\n` +
    `💰 ${user.balance} SD  ·  🎒 ${user.inventory.length} items\n` +
    (user.quest ? `🎯 Active quest from ${user.quest.character}` : `_No active quest — /bikinibot-quest to get one!_`)
  );
});

// ─── FUN COMMANDS ─────────────────────────────────────────────────────────────

const quotes = [
  "The ocean is just water with commitment issues.",
  "SpongeBob is proof chaos can be friendly.",
  "Even Squidward shows up sometimes.",
  "Jellyfish don't ask questions, they just sting.",
  "Profit is a lifestyle, not a choice.",
  "Happiness is 40% sponge, 60% noise.",
  "Failure is just underwater progress.",
  "Krabby Patties solve emotional problems temporarily.",
  "Patrick has never been wrong once. He's just rarely right.",
  "Every great adventure starts with a net and low expectations.",
  "The Krusty Krab is not responsible for emotional damage.",
  "Rock bottom has a rock. Which Patrick calls home.",
];
app.command("/bikinibot-quote", async ({ ack, respond }) => { await ack(); return respond(`💬 _"${pick(quotes)}"_`); });

const moods = [
  "🧽 SpongeBob: aggressively joyful",
  "🪨 Patrick: peacefully confused",
  "😒 Squidward: emotionally unavailable",
  "💰 Mr. Krabs: financially unstable",
  "🦠 Plankton: dramatic evil fatigue",
  "🤠 Sandy: science overload",
  "🐌 Gary: meow (untranslatable wisdom)",
  "📢 Bubble Bass: aggressively hungry",
  "🦀 Larry the Lobster: unreasonably confident",
  "🐡 Mrs. Puff: one breath away from a breakdown",
  "🧜 Mermaid Man: heroically sleepy",
  "🦹 Barnacle Boy: tired of this job",
  "🌊 The Ocean: vast and unconcerned",
  "🍔 A Krabby Patty: content. warm. purposeful.",
  "🪨 A Rock: same as always",
  "🐙 The Flying Dutchman: dramatically haunted",
];
app.command("/bikinibot-mood", async ({ ack, respond }) => { await ack(); return respond(`🌊 Today's Bikini Bottom mood: ${pick(moods)}`); });

const imagination = [
  "Everything turns into jellyfish disco chaos 🪼✨",
  "Reality becomes a Krabby Patty factory 🍔",
  "You accidentally summon Squidward's worst day 😒",
  "The ocean starts glitching like a video game 🌊",
  "SpongeBob takes over physics itself 🧽",
  "Patrick discovers a rock that is also a door 🚪🪨",
  "Plankton wins but immediately slips on a banana peel 🦠🍌",
  "The Krusty Krab becomes sentient and has OPINIONS 🏠",
];
app.command("/bikinibot-imagination", async ({ ack, respond }) => { await ack(); return respond(`💭 *IMAGINATION!* ${pick(imagination)}`); });

const rockBottom = [
  "Even when it's dark, plankton still tries.",
  "You are not lost, just submerged.",
  "Squidward still clocks in.",
  "Rock Bottom is just emotional buffering.",
  "The tide always changes eventually.",
  "Gary believed in SpongeBob when nobody else did. Someone out there is your Gary.",
  "Even Patrick finds his rock eventually.",
  "The ocean is big. So is your potential.",
];
app.command("/bikinibot-rockbottom", async ({ ack, respond }) => { await ack(); return respond(`🌑 ${pick(rockBottom)}`); });

// ─── API COMMANDS ─────────────────────────────────────────────────────────────

app.command("/bikinibot-sandyfact", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("https://uselessfacts.jsph.pl/api/v2/facts/random");
    return respond(
      `🤠 *Sandy's Science Corner!*\n\n_"${res.data.text}"_\n\n🤠 "Y'all need to read more."`
    );
  } catch {
    return respond("🤠 Sandy's internet is down. She's investigating. Scientifically.");
  }
});

app.command("/bikinibot-squidwardjoke", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("https://official-joke-api.appspot.com/random_joke");
    return respond(
      `😒 Fine. Squidward performs comedy. Against his will.\n\n` +
      `*${res.data.setup}*\n\n...\n\n${res.data.punchline}\n\n` +
      `😒 _That's it. Show's over. I hate all of you._`
    );
  } catch {
    return respond("😒 The joke API failed. Good. I didn't want to do this anyway.");
  }
});

// ─── HELP ─────────────────────────────────────────────────────────────────────

app.command("/bikinibot-help", async ({ ack, respond }) => {
  await ack();
  return respond(
`🧽 *BIKINIBOT — ALL COMMANDS*

*👥 Characters*
\`/bikinibot-spongebob <text>\` — SpongeBob reacts enthusiastically
\`/bikinibot-patrick <text>\` — Patrick reacts confusedly
\`/bikinibot-squidward <text>\` — Squidward is dismissive
\`/bikinibot-mrkrabs <text>\` — Mr. Krabs wants your money
\`/bikinibot-sandy <text>\` — Sandy analyzes your message
\`/bikinibot-plankton <text>\` — Plankton schemes
\`/bikinibot-bubblebass <text>\` — Bubble Bass complains
\`/bikinibot-gary <text>\` — Gary says meow

*🎣 Economy*
\`/bikinibot-fish\` — Catch an item _(30 min cooldown)_
\`/bikinibot-jellyfish\` — Catch a jellyfish + earn SD _(20 min cooldown)_
\`/bikinibot-work\` — Earn SD with a random job _(60 min cooldown)_
\`/bikinibot-krabby\` — Make a Krabby Patty → inventory
\`/bikinibot-order\` — Order food (costs SD)
\`/bikinibot-menu\` — View the Krusty Krab menu
\`/bikinibot-shop\` — Browse the shop
\`/bikinibot-shop buy <item>\` — Buy an item with SD

*🎒 Inventory & Stats*
\`/bikinibot-inventory\` — See your items, balance, level & quest
\`/bikinibot-leaderboard\` — Top 5 SD earners in Bikini Bottom

*🎯 Quests*
\`/bikinibot-quest\` — Get a new quest or check progress
\`/bikinibot-quest submit\` — Turn in a completed quest

*🌐 Live from the Internet*
\`/bikinibot-sandyfact\` — Sandy presents a real random fact
\`/bikinibot-squidwardjoke\` — Squidward is forced to tell a joke

*✨ Fun*
\`/bikinibot-quote\` — Bikini Bottom wisdom
\`/bikinibot-rockbottom\` — Motivational quote
\`/bikinibot-ping\` — Check if the bot is alive`
  );
});

(async () => {
  try {
    await app.start();
    console.log("🟢 BikiniBot FULL CHARACTER SYSTEM RUNNING");
  } catch (err) {
    console.error("FAILED:", err);
  }
})();
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
                    
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             
                                                                                                                                                                                  
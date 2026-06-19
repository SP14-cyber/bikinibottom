# bikinibottom

# 🧽 BikiniBot

A Slack-based Bikini Bottom RPG where you can fish, work, complete quests, and interact with SpongeBob characters through a fully playable economy system.

---

## 🎮 Demo

👉 After installing the Slack app, use commands directly inside Slack:

```bash
/bikinibot-help
```

---

## ⚙️ Setup / Installation

🎮 How to Use

To use BikiniBot, you don’t need to download anything.

Join the Slack workspace where BikiniBot is installed

Type any slash command like:
/bikinibot-help

That’s it.

---

## ✨ What it is

BikiniBot turns Slack into a **playable SpongeBob-themed RPG**, where every message becomes part of a game world.

You can:

* fish for loot 🐟
* earn sand dollars 💰
* complete quests 🎯
* level up with XP 📈
* collect rare items 🎒
* interact with Bikini Bottom characters 🎭

---

## 🚀 Features

* 🎭 Fully interactive SpongeBob character system (SpongeBob, Patrick, Squidward, Mr. Krabs, Sandy, Plankton, Gary, Bubble Bass)
* 🎣 Fishing system with rarity-based loot drops
* 🪼 Jellyfish catching minigame with rewards
* 💼 Random job system to earn currency
* 🧭 Quest system with item-based objectives and rewards
* 🛒 Shop with upgrades, tools, and mystery boxes
* 🎒 Persistent inventory system (stored per user)
* 📈 XP + leveling system with titles and progression
* 🏆 Leaderboard tracking richest players
* 🎲 Random events and personality-based responses

---

## 🧠 How it works

BikiniBot is built using:

* Node.js
* Slack Bolt (Socket Mode)
* JSON-based persistent storage

Each slash command triggers a game mechanic or character AI response:

* Economy commands modify stored user data (balance, inventory, XP)
* Fishing/jellyfish systems use randomized rarity rolls
* Quests dynamically assign objectives and track progress
* Characters respond using randomized dialogue pools + keyword triggers
* Items affect gameplay (better loot, higher rewards, bonuses)

All user data is stored in a local `data.json` file.

---

## 🎮 Commands

### 👥 Characters

* `/bikinibot-spongebob`
* `/bikinibot-patrick`
* `/bikinibot-squidward`
* `/bikinibot-mrkrabs`
* `/bikinibot-sandy`
* `/bikinibot-plankton`
* `/bikinibot-bubblebass`
* `/bikinibot-gary`

### 🎣 Economy & Gameplay

* `/bikinibot-fish`
* `/bikinibot-jellyfish`
* `/bikinibot-work`
* `/bikinibot-krabby`
* `/bikinibot-order`
* `/bikinibot-menu`

### 🎒 Progression

* `/bikinibot-inventory`
* `/bikinibot-quest`
* `/bikinibot-leaderboard`
* `/bikinibot-whoami`

### 🛒 Shop

* `/bikinibot-shop`
* `/bikinibot-shop buy <item>`

### 🎲 Fun

* `/bikinibot-imagination`
* `/bikinibot-rockbottom`
* `/bikinibot-quote`
* `/bikinibot-mood`
* `/bikinibot-ping`

### 🌐 API Features

* `/bikinibot-sandyfact`
* `/bikinibot-squidwardjoke`

---

## 🧪 Local Development

```bash
npm install
node index.js
```

### Environment variables

```env
SLACK_BOT_TOKEN=your-token
SLACK_APP_TOKEN=your-app-token
```

---

## 🧩 Design Philosophy

BikiniBot is designed as a **Slack-native game world**, not just a chatbot.

Core ideas:

* Every command is a game action, not just a response
* Progression systems (XP, inventory, quests) create long-term engagement
* Randomized character dialogue keeps interactions unpredictable
* Economy systems give players reasons to return and grind

The goal is to make Slack feel like a **playable RPG environment**.

---

## 🙌 Credits

* Inspired by *SpongeBob SquarePants*
* Built with Slack Bolt
* APIs: Useless Facts API, Official Joke API
* All game systems, dialogue, and mechanics designed for BikiniBot

---

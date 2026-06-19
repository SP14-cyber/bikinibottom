BikiniBot

A Slack based Bikini Bottom RPG where you can fish, work, complete quests, and interact with SpongeBob characters through a text economy

Getting started: 

You do not need to download or host anything to play1 Join the Slack workspace where BikiniBot is installed. Run the main help command to see what is available: /bikinibot-help

The concept:

BikiniBot turns your Slack workspace into a text RPG Instead of just replying with static quotes, the bot tracks your progress, inventory, and currency directly within your chat channels.

You can fish and hunt for loot using randomized rarity mechanics, take on jobs to earn Sand Dollars and build up your bank account, track quest objectives to unlock rewards and gain XP, compete with friends to climb the leaderboard

Core features include interactive NPC system for SpongeBob, Patrick, Squidward, Mr Krabs, Sandy, Plankton, Gary, and Bubble Bass, fishing and jellyfish catching minigames with randomized drop rates, active job system and dynamic quest logsShop system to buy upgrades, tools, and mystery boxes, persistent inventory tracking and user leveling with custom titlesRandom events and character responses triggered by workspace activity

The coding:

BikiniBot runs on Node.js using the Slack Bolt framework over Socket ModeUnlike massive cloud apps, this project uses a lightweight JSON file (data json) to handle game state. Slash commands modify user data structures locally, drop tables utilize randomized weight distributions for loot and fishing, and character dialogue relies on keyword matching triggers combined with dynamic arrays to keep interactions fresh. 

Available slash commands: 

NPC Interactions: 
/bikinibot-spongebob
/bikinibot-patrick/
bikinibot-squidward
/bikinibot-mrkrabs
/bikinibot-sandy
/bikinibot-plankton
/bikinibot-bubblebass
/bikinibot-gary

Gameplay & Economy
/bikinibot-fish
/bikinibot-jellyfish
/bikinibot-work
/bikinibot-krabby
/bikinibot-order
/bikinibot-menu

Profile & Progression
/bikinibot-inventory
/bikinibot-quest
/bikinibot-leaderboard
/bikinibot-whoami

Marketplace
/bikinibot-shop
/bikinibot-shop buy [item]

Miscellaneous
/bikinibot-imagination
/bikinibot-rockbottom
/bikinibot-quote
/bikinibot-mood
/bikinibot-ping
/bikinibot-sandyfact
/bikinibot-squidwardjoke

Local development:
If you want to clone this repository and host your own instance of the bot, follow these steps

Install the dependencies: npm install
Create a .env file in the root directory and add your Slack credentials:
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-app-token
Start the application: node index js 

Why did I build this?
Most Slack bots are productivity tools or simple single response joke commands BikiniBot was built to see how far the Slack interface could be pushed into an actual game loop By combining persistent state with interactive commands, it transforms a standard chat app into a passive, engaging MMO environment that communities can play together throughout the workday

Credits
Inspired by Nickolodeon's TV Show SpongeBob SquarePants
Built using the Slack Bolt Framework
External data sourced via the Useless Facts API and Official Joke API


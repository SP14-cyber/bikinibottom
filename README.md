BikiniBot

A Slack based Bikini Bottom RPG where you can fish, work, complete quests, and interact with SpongeBob characters through a text economy.

Getting started: 

You do not need to download or host anything to play. Join the Slack workspace where BikiniBot is installed. Run the main help command to see what is available: /bikinibot-help

The concept:

BikiniBot turns your Slack workspace into a text RPG Instead of just replying with static quotes, the bot tracks your progress, inventory, and currency directly within your chat channels.

You can fish and hunt for loot using randomized rarity mechanics, take on jobs to earn Sand Dollars and build up your bank account, track quest objectives to unlock rewards and gain XP, compete with friends to climb the leaderboard.

Some of the other key features of the BikiniBot include the ability to communicate and interact with 8 NPCs (SpongeBob, Patrick, Squidward, Mr. Krabs, Sandy, Plankton, Gary and Bubble Bass), minigames for fishing and jelly fishing (via random drop rates), an active job system, a dynamic quest log, a shop to buy upgrades, tools and mystery boxes, user tracking (persistent) for their inventory, user leveling with ability to choose custom titles and random events and NPCs will respond in a completely different fashion based on recent activity in your workspace.

The coding:

While many of the large scale cloud applications that have been created to accomplish similar tasks (such as WoW, Call of Duty, etc.) utilize heavy, complex databases to store game state, the BikiniBot project is using a very lightweight JSON file (data.json) as the main database for handling game state. Interaction with the BikiniBot through slash commands create modifications to a user's data object that are stored locally. Loot and fishing from drop tables (via random weight distribution) are assigned to users based on their respective character class, and dialogue with NPCs is handled through keyword matching which is then matched against a dynamic/running array of arrays to allow for a new and interesting experience.

Available slash commands: 

NPC interactions: 
/bikinibot-spongebob
/bikinibot-patrick/
bikinibot-squidward
/bikinibot-mrkrabs
/bikinibot-sandy
/bikinibot-plankton
/bikinibot-bubblebass
/bikinibot-gary

Gameplay and economy:
/bikinibot-fish
/bikinibot-jellyfish
/bikinibot-work
/bikinibot-krabby
/bikinibot-order
/bikinibot-menu

Profile and progression:
/bikinibot-inventory
/bikinibot-quest
-> /bikinibot-quest submit
/bikinibot-leaderboard

Marketplace:
/bikinibot-shop
-> /bikinibot-shop buy [item]

Miscellaneous:
/bikinibot-rockbottom
/bikinibot-quote
/bikinibot-ping
/bikinibot-sandyfact
/bikinibot-squidwardjoke

Local development:
If you want to clone this repository and host your own instance of the bot, follow these steps:

Install the dependencies: 
npm install
Create a .env file in the root directory and add your Slack credentials:
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-app-token
Start the application: node index js 

Why did I build this?
A majority of Slack Bots consist of either productivity or an easy way to send a single response to joke commands that might have been introduced to your channel; BikiniBot was designed to test the limits of how far you can take the Slack app into an actual game loop by combining persistent game state with interactive commands and creating a way for communities to interactively play together within a standard chat application during business hours.

Credits
Inspired by Nickolodeon's TV Show SpongeBob SquarePants
Built using the Slack Bolt Framework
External data sourced via the Useless Facts API and Official Joke API


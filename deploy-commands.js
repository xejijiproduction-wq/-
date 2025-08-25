const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load commands from gameResultsHandler.js
const { commands } = require('./gameResultsHandler');

const token = process.env.BOT_TOKEN;
const clientId = process.env.BOT_CLIENT_ID; // Application (bot) ID
const guildId = process.env.DEPLOY_GUILD_ID; // Optional: for guild-scoped faster updates

if (!token || !clientId) {
    console.error('Missing env: BOT_TOKEN and BOT_CLIENT_ID are required.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function deploy() {
    try {
        const body = commands.map(c => c.data.toJSON());
        if (guildId) {
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body }
            );
            console.log('Successfully reloaded guild application (/) commands.');
        } else {
            await rest.put(
                Routes.applicationCommands(clientId),
                { body }
            );
            console.log('Successfully reloaded global application (/) commands.');
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

deploy();


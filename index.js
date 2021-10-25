const Discord = require('discord.js');
const fs = require('fs');
const GameSession = require('./classes/game-session');
const { readConfig, writeConfig } = require('./utils');

const client = new Discord.Client({
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES
    ]
});

const GLOBAL_CONFIG_PATH = './config/global.json';
const GUILDS_CONFIG_PATH = './config/guilds';

/**
 * @type {Map<string, GameSession>} Map of <messageId, Session>
 */
const sessions = new Map();

client.on('messageCreate', async (msg) => {
    const config = readConfig(msg.guild.id);
    let msgContent = msg.content;

    if (msgContent.startsWith(config.prefix)) {
        msgContent = msgContent.slice(config.prefix.length).trim();
    } else {
        return;
    }

    const args = msgContent.split(/ +/);
    const commandName = args[0].toLowerCase();
    args.shift();

    if (commandName == 'prefix') {
        if (args[0]) {
            config.prefix = args[0];
            writeConfig(msg.guild.id, config);
            msg.channel.send(`Prefix set to \`${config.prefix}\``);
        } else {
            msg.channel.send(`Prefix: \`${config.prefix}\``);
        }
    } else if (commandName == 'host') {
        let session = sessions.get(msg.channelId);
        if (!session) {
            const gameMsg = await msg.channel.send(`**## Game Message ##**`);
            session = new GameSession(msg.member, gameMsg);
            sessions.set(msg.channelId, session);
        } else {
            msg.delete();
        }
    } else if (commandName == 'join') {
        const session = sessions.get(msg.channelId);
        if (session) {
            session.addPlayer(msg.member, args[0]);
            msg.delete();
        } else {
            msg.channel.send(
                `There is no game session running on this channel.\nTo start one, type: \`${config.prefix}host\``
            );
        }
    } else if (['block', 'kick'].includes(commandName)) {
        const session = sessions.get(msg.channelId);
        if (session?.host.id == msg.member.id) {
            session.blockPlayers(msg.mentions.members);
        }
        msg.delete();
    } else if (commandName == 'leave') {
        const session = sessions.get(msg.channelId);
        if (session) {
            session.removePlayer(msg.member);
        }
        msg.delete();
    } else if (commandName == 'start') {
        const session = sessions.get(msg.channelId);
        if (session?.host.id == msg.member.id) {
            session.start();
        }
        msg.delete();
    } else if (commandName == 'cancel') {
        const session = sessions.get(msg.channelId);
        if (session?.host.id == msg.member.id) {
            sessions.delete(msg.channelId);
            msg.channel.send(':x: **Game session canceled**');
        }
    } else if (['spymaster', 'sm'].includes(commandName)) {
        const session = sessions.get(msg.channelId);
        if (session) {
            session.setSpymaster(msg.member);
        }
        msg.delete();
    } else if (['guess', 'g'].includes(commandName)) {
        const session = sessions.get(msg.channelId);
        if (session?.started) {
            const gameEnded = session.guess(msg.member, args[0]);

            if (gameEnded) {
                sessions.delete(msg.channelId);
            }
        }
        msg.delete();
    } else if (['end', 'endturn'].includes(commandName)) {
        const session = sessions.get(msg.channelId);
        if (session?.started) {
            session.endTurn(msg.member);
        }
        msg.delete();
    } else if (['help', 'h'].includes(commandName)) {
        const helpText =
            '**Commands:**\n```\nhost\njoin\nstart\nleave\nblock/kick\ncancel\nspymaster/sm\nguess/g\nendturn/end\nprefix\n```';
        msg.channel.send(helpText);
    }
});

function createGuildConfig(guildId) {
    const configFilePath = `${GUILDS_CONFIG_PATH}/${guildId}.json`;
    if (!fs.existsSync(configFilePath)) {
        fs.copyFileSync(GLOBAL_CONFIG_PATH, configFilePath);
    }
}

client.on('guildCreate', (guild) => {
    createGuildConfig(guild.id);
});

client.on('guildDelete', (guild) => {
    const configFilePath = `${GUILDS_CONFIG_PATH}/${guild.id}.json`;
    if (fs.existsSync(configFilePath)) {
        fs.rm(configFilePath, console.log);
    }
});

client.once('ready', () => {
    console.log(`Codenames is running on ${client.user.tag}...`);
});

client.login(require('./secret.json').botToken);

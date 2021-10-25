const { Message, GuildMember } = require('discord.js');
const { getWords } = require('../utils');
const TurnManager = require('./turn-manager');

const TURN_DURATION = 120;
const BLUE_WORDS_COUNT = 7;
const RED_WORDS_COUNT = 6;

class GameSession {
    #turnIntervalId;

    /** Active words <word, cardColor>
     * @type {Array<{word: string, color: string}>}*/
    words = [];
    displayedWords = [];
    blueWordsCount = BLUE_WORDS_COUNT;
    redWordsCount = RED_WORDS_COUNT;

    started = false;
    turnTimeLeft = TURN_DURATION;

    /** The turn manager for this game session
     * @type {TurnManager}*/
    turnManager = null;

    /** The message displaying the game
     * @type {Message}*/
    msg;

    /** The message displaying the current turn
     * @type {Message}*/
    turnMsg;

    lastErrorMessage;

    /** The game session's host
     * @type {GuildMember}*/
    host;

    blockedMemberIds = [];

    /** Blue team members
     * @type {Array<GuildMember>}*/
    blueTeam = [];

    /** Red team members
     * @type {Array<GuildMember>}*/
    redTeam = [];

    /** Blue team's spymaster
     * @type {GuildMember}*/
    blueSpymaster;

    /** Red team's spymaster
     * @type {GuildMember}*/
    redSpymaster;

    /**
     *
     * @param {GuildMember} host
     * @param {Message} msg
     */
    constructor(host, msg) {
        this.host = host;
        this.msg = msg;

        this.updateGameText();
    }

    getGameText() {
        const blueTeamNames = [];
        this.blueTeam.forEach((m) => {
            if (m.id != this.blueSpymaster?.id)
                blueTeamNames.push(m.displayName);
        });
        const redTeamNames = [];
        this.redTeam.forEach((m) => {
            if (m.id != this.redSpymaster?.id) redTeamNames.push(m.displayName);
        });
        const displayedWords = [];
        this.displayedWords.forEach((w, i) => {
            const color = w.color;
            let emote = ':yellow_square:';

            if (color == 'blue') {
                emote = ':blue_square:';
            } else if (color == 'red') {
                emote = ':red_square:';
            } else if (color == 'black') {
                emote = ':skull:';
            }
            const num = i < 10 ? `\`${i}. \`` : `\`${i}.\``;
            displayedWords.push(`${num} ${emote} ${w.word}`);
        });
        const text = `**:crown: Host:** ${
            this.host.displayName
        }\n\n**:blue_circle: Blue Team:**\n${
            this.blueSpymaster
                ? `${this.blueSpymaster.displayName} **:detective:**\n`
                : ''
        }${blueTeamNames.join('\n')}\n\n**:red_circle: Red Team:**\n${
            this.redSpymaster
                ? `${this.redSpymaster.displayName} **:detective:**\n`
                : ''
        }${redTeamNames.join('\n')}${
            displayedWords.length > 0
                ? `\n\n**Words:**\n${displayedWords.join('\n')}`
                : ''
        }`;
        return text;
    }

    updateGameText() {
        this.msg.edit(this.getGameText());
    }

    /**
     *
     * @param {GuildMember} member
     * @param {string} word
     * @returns {boolean} true if the game ended and false otherwise
     */
    guess(member, word) {
        if (!word || this.turnManager.current().endsWith('SM')) {
            return false;
        }
        if (
            this.turnManager.current() == 'red' &&
            this.redSpymaster.id != member.id &&
            this.blueSpymaster.id != member.id &&
            this.redTeam.some((m) => m.id == member.id)
        ) {
            return false;
        }
        if (
            this.turnManager.current() == 'blue' &&
            this.redSpymaster.id != member.id &&
            this.blueSpymaster.id != member.id &&
            this.blueTeam.some((m) => m.id == member.id)
        ) {
            return false;
        }

        word = word.toLowerCase();

        const index = this.words.findIndex((w) => w.word == word);

        let winner = null;

        if (index > -1) {
            this.displayedWords[index] = this.words[index];
            const color = this.words[index].color;
            if (color == 'blue') {
                this.blueWordsCount--;
                if (this.blueWordsCount <= 0) {
                    winner = 'blue';
                }
            } else if (color == 'red') {
                this.redWordsCount--;
                if (this.redWordsCount <= 0) {
                    winner = 'red';
                }
            } else if (color == 'black') {
                if (this.turnManager.current() == 'blue') {
                    winner = 'red';
                } else if (this.turnManager.current() == 'red') {
                    winner = 'blue';
                }
            }
        } else {
            return false;
        }

        this.updateGameText();

        if (winner) {
            this.endGame(winner);
            return true;
        }

        return false;
    }

    endGame(winner) {
        clearInterval(this.#turnIntervalId);

        let msgText;

        if (winner == 'blue') {
            msgText = '**Blue team won!**';
        } else if (winner == 'red') {
            msgText = '**Red team won!**';
        } else {
            msgText = ':x: **Game ended abruptly.**';
        }

        this.msg.channel.send(msgText);
    }

    /**
     *
     * @param {GuildMember} member
     */
    endTurn(member) {
        if (
            (this.turnManager.current() == 'blueSM' &&
                this.blueSpymaster.id == member.id) ||
            (this.turnManager.current() == 'redSM' &&
                this.redSpymaster.id == member.id) ||
            (this.turnManager.current() == 'blue' &&
                this.redSpymaster.id != member.id &&
                this.blueSpymaster.id != member.id &&
                this.blueTeam.some((m) => m.id == member.id)) ||
            (this.turnManager.current() == 'red' &&
                this.redSpymaster.id != member.id &&
                this.blueSpymaster.id != member.id &&
                this.redTeam.some((m) => m.id == member.id))
        ) {
            this.switchTurns();
        }
    }

    switchTurns() {
        this.turnTimeLeft = TURN_DURATION;
        return this.turnManager.next();
    }

    /**
     *
     * @param {GuildMember} member
     * @param {string} team
     */
    addPlayer(member, team) {
        if (this.blockedMemberIds.includes(member.id)) {
            return;
        }

        if (this.blueSpymaster?.id == member.id) {
            this.blueSpymaster = null;
        } else if (this.redSpymaster?.id == member.id) {
            this.redSpymaster = null;
        }
        team = team?.toLowerCase();
        if (team == 'red' && this.redTeam.every((m) => m.id != member.id)) {
            this.blueTeam = this.blueTeam.filter((m) => m.id != member.id);
            this.redTeam.push(member);
        } else if (
            team == 'blue' &&
            this.blueTeam.every((m) => m.id != member.id)
        ) {
            this.redTeam = this.redTeam.filter((m) => m.id != member.id);
            this.blueTeam.push(member);
        }

        this.updateGameText();
    }

    blockPlayers(members) {
        members.forEach((m) => {
            this.blockedMemberIds.push(m.id);
            this.removePlayer(m, true);
        });
        this.updateGameText();
    }

    removePlayer(member, massRemove = false) {
        if (this.blueSpymaster?.id == member.id) {
            this.blueSpymaster = null;
        } else if (this.redSpymaster?.id == member.id) {
            this.redSpymaster = null;
        }

        this.blueTeam = this.blueTeam.filter((m) => m.id != member.id);
        this.redTeam = this.redTeam.filter((m) => m.id != member.id);

        if (!massRemove) {
            this.updateGameText();
        }
    }

    /**
     *
     * @param {GuildMember} member
     */
    setSpymaster(member) {
        if (
            this.blueTeam.some((m) => m.id == member.id) &&
            !this.blueSpymaster
        ) {
            this.blueSpymaster = member;
        } else if (
            this.redTeam.some((m) => m.id == member.id) &&
            !this.redSpymaster
        ) {
            this.redSpymaster = member;
        }

        this.updateGameText();
    }

    async start() {
        this.lastErrorMessage?.delete();
        this.lastErrorMessage = null;

        if (
            !this.blueSpymaster ||
            !this.redSpymaster ||
            this.blueTeam.length < 2 ||
            this.redTeam.length < 2
        ) {
            let msgText = '';
            if (!this.blueSpymaster)
                msgText += ':exclamation: Blue team does not have a spymaster';
            if (!this.redSpymaster)
                msgText += '\n:exclamation: Red team does not have a spymaster';
            if (this.blueTeam.length < 2)
                msgText +=
                    '\n:exclamation: Blue team does not have enough players';
            if (this.redTeam.length < 2)
                msgText +=
                    '\n:exclamation: Red team does not have enough players';

            this.msg.channel
                .send(msgText)
                .then((m) => (this.lastErrorMessage = m));
            return;
        }

        const wordsList = getWords(25);
        const teamsWordCount = BLUE_WORDS_COUNT + RED_WORDS_COUNT;

        for (let i = 0; i < teamsWordCount; i++) {
            this.words.push({
                word: wordsList[i],
                color: i % 2 == 0 ? 'blue' : 'red'
            });
        }

        for (let i = teamsWordCount; i < wordsList.length - 1; i++) {
            this.words.push({ word: wordsList[i], color: 'gray' });
        }

        this.words.push({
            word: wordsList[wordsList.length - 1],
            color: 'black'
        });

        this.words.sort(() => Math.random() * 2 - 1); // Shuffle

        this.words.forEach((w) =>
            this.displayedWords.push({ word: w.word, color: 'gray' })
        );

        const words = [];
        this.words.forEach((w, i) => {
            const color = w.color;
            let emote = ':yellow_square:';

            if (color == 'blue') {
                emote = ':blue_square:';
            } else if (color == 'red') {
                emote = ':red_square:';
            } else if (color == 'black') {
                emote = ':skull:';
            }
            const num = i < 10 ? `\`${i}. \`` : `\`${i}.\``;
            words.push(`${num} ${emote} ${w.word}`);
        });

        this.updateGameText();

        const msgText = `**Words:**\n${words.join('\n')}`;

        try {
            await this.blueSpymaster.send(msgText);
            await this.redSpymaster.send(msgText);
        } catch (err) {
            let errorText =
                ':exclamation: Could not start; make sure spymasters allow direct messages.';
            this.msg.channel
                .send(errorText)
                .then((m) => (this.lastErrorMessage = m));
            return;
        }

        this.started = true;

        this.turnManager = new TurnManager();

        this.turnMsg = await this.msg.channel.send('## Turn Message ##');

        this.#turnIntervalId = setInterval(() => {
            if (this.turnTimeLeft <= 0) {
                this.switchTurns();
                return;
            }

            this.turnTimeLeft--;

            const turn = this.turnManager.current();
            const emote = turn.startsWith('blue')
                ? ':blue_square:'
                : ':red_square:';

            let turnName;

            switch (turn) {
                case 'blue':
                    turnName = 'Blue team';
                    break;
                case 'red':
                    turnName = 'Red team';
                    break;
                case 'blueSM':
                    turnName = 'Blue spymaster';
                    break;
                case 'redSM':
                    turnName = 'Red spymaster';
                    break;
            }

            let minutes = (this.turnTimeLeft / 60).toString().split('.')[0];
            minutes = minutes.length > 1 ? minutes : '0' + minutes;
            let seconds = (this.turnTimeLeft % 60).toString().split('.')[0];
            seconds = seconds.length > 1 ? seconds : '0' + seconds;

            this.turnMsg.edit(
                `**${emote} ${turnName}'s turn\n${emote} Time remaining: \`${minutes}:${seconds}\`**`
            );
        }, 1000);
    }
}

module.exports = GameSession;

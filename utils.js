const fs = require('fs');

const GLOBAL_CONFIG_PATH = './config/global.json';
const GUILDS_CONFIG_PATH = './config/guilds';
const WORDS_PATH = './data/words.txt';

const words = fs.readFileSync(WORDS_PATH, 'utf-8').split(/\s+/);

module.exports = {
    readConfig: (guildId = null) => {
        if (!guildId) {
            return JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8'));
        }

        try {
            return JSON.parse(
                fs.readFileSync(
                    `${GUILDS_CONFIG_PATH}/${guildId}.json`,
                    'utf-8'
                )
            );
        } catch (err) {
            return module.exports.writeConfig(
                guildId,
                module.exports.readConfig()
            );
        }
    },

    writeConfig: (guildId, config) => {
        fs.writeFileSync(
            `${GUILDS_CONFIG_PATH}/${guildId}.json`,
            JSON.stringify(config)
        );
        return config;
    },

    /**
     *
     * @param {number} count The number of random words to get
     * @returns {Array<string>} words
     */
    getWords: (count) => {
        const result = [];
        for (let i = 0; i < count; ) {
            const rand = Math.floor(Math.random() * words.length);
            if (!result.includes(words[rand])) {
                result.push(words[rand]);
                i++;
            }
        }
        return result;
    }
};

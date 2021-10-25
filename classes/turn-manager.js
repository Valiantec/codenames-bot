class TurnManager {
    static TURNS = ['blueSM', 'blue', 'redSM', 'red'];

    #current = 0;

    current() {
        return TurnManager.TURNS[this.#current];
    }

    next() {
        this.#current++;
        if (this.#current >= TurnManager.TURNS.length) {
            this.#current = 0;
        }
        return this.current();
    }
}

module.exports = TurnManager;

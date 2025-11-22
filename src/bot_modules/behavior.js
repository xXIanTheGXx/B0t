const { BotStateMachine, NestedStateMachine, StateTransition, BehaviorIdle } = require('mineflayer-statemachine');
const { goals } = require('./navigation');

class BehaviorEscape {
    constructor(bot) {
        this.bot = bot;
    }

    onStateEntered() {
        if (!this.bot.pathfinder) return;

        // Pick a random direction 500 blocks away (conservative for now)
        const dist = 500;
        const angle = Math.random() * Math.PI * 2;
        const x = this.bot.entity.position.x + Math.cos(angle) * dist;
        const z = this.bot.entity.position.z + Math.sin(angle) * dist;

        // console.log(`[Behavior] Escaping spawn to X:${Math.round(x)} Z:${Math.round(z)}`);
        this.bot.pathfinder.setGoal(new goals.GoalXZ(x, z));
    }

    onStateExited() {
        if (this.bot.pathfinder) this.bot.pathfinder.setGoal(null);
    }
}

function createAgent(bot) {
    // Define States
    const idle = new BehaviorIdle();
    const escape = new BehaviorEscape(bot);

    // Define Transitions
    const transitions = [
        new StateTransition({
            parent: idle,
            child: escape,
            name: 'startEscaping',
            shouldTransition: () => true // Immediately start escaping
        }),
        new StateTransition({
            parent: escape,
            child: idle,
            name: 'finishedEscaping',
            shouldTransition: () => !bot.pathfinder.isMoving() && !bot.pathfinder.goal
        })
    ];

    // Create Machine
    const rootLayer = new NestedStateMachine(transitions, idle);
    const root = new BotStateMachine(bot, rootLayer);
    return root;
}

module.exports = {
    createAgent,
    BehaviorEscape
};

// ---- The computer opponent ----
// The AI plays by exactly the same rules as a human: it holds the left/right keys and calls jump() and
// attack(), nothing else. It has no special speed, no extra jumps and no knowledge a player lacks beyond
// the layout of the level, which a human can see. This file is shared: it runs in the browser (training
// mode) and headless in Node (the tests).

// ---- Knowing the level: which platform can reach which ----
// Jump numbers (pixels). A full-health double jump rises about 100px; the AI plans with a safety margin.
const AI_MAX_RISE = 85       //Highest platform it will plan to jump up to
const AI_MAX_GAP_UP = 60     //Widest sideways gap it will plan to jump across when going up
const AI_MAX_GAP_DOWN = 80   //Widest gap it will plan to walk off and fall across

let platformGraph = null     //Built once, the first time an AI is made (the level never changes)

/**
 * Groups blocks into "runs": a platform is a row of touching blocks at the same height.
 * @param {CollisionBlock[]} blocks
 * @param {Boolean} solid - true for ground blocks; only their exposed top surface can be stood on
 * @returns {{x0: number, x1: number, y: number, solid: boolean}[]} y is the surface you stand on
 */
function groupIntoRuns(blocks, solid) {
    const filled = new Set(blocks.map(block => `${block.position.x},${block.position.y}`))
    const rowsByTop = new Map()
    for (const block of blocks) {
        //A solid block with another directly above it has no top surface to stand on
        if (solid && filled.has(`${block.position.x},${block.position.y - TILE}`)) continue
        if (!rowsByTop.has(block.position.y)) rowsByTop.set(block.position.y, [])
        rowsByTop.get(block.position.y).push(block.position.x)
    }
    const runs = []
    for (const [y, xs] of rowsByTop) {
        xs.sort((a, b) => a - b)
        let start = xs[0], previous = xs[0]
        for (let i = 1; i <= xs.length; i++) {
            if (xs[i] !== previous + TILE) { //Gap (or the end): the run is finished
                runs.push({x0: start, x1: previous + TILE, y, solid})
                start = xs[i]
            }
            previous = xs[i]
        }
    }
    return runs
}

/** Horizontal distance between two runs' x-ranges (0 if they overlap). */
function horizontalGap(a, b) {
    return Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1))
}

/**
 * Builds the map the AI plans with: every platform, which others it can get to, and for each platform
 * the best next step towards the door (a shortest-path search run backwards from the door).
 * @returns {{runs: Object[], doorRun: Object}}
 */
function buildPlatformGraph() {
    const runs = [...groupIntoRuns(collisionBlocks, true), ...groupIntoRuns(platformBlocks, false)]
    runs.forEach((run, id) => { run.id = id; run.reach = [] })

    // An edge a -> b means "from a, the AI can get onto b"
    for (const a of runs) {
        for (const b of runs) {
            if (a === b) continue
            const gap = horizontalGap(a, b)
            const rise = a.y - b.y //Positive: b is higher than a
            const canClimb = rise > 0 && rise <= AI_MAX_RISE && gap <= AI_MAX_GAP_UP
            const canDrop = rise <= 0 && gap <= AI_MAX_GAP_DOWN
            if (canClimb || canDrop) {
                // The cost of a hop is how hard it is, not just that it is one hop. Climbing difficulty grows with the
                // SQUARE of the rise (16px = 0.3, 48px = 2.7, 80px = 7.5), wide gaps cost a little, and drops are cheap.
                // So the AI prefers a staircase of easy steps, which is also what still works when it is injured
                // (at full injury a double jump only rises 68px, so the map's 80px hops are out of reach).
                const climbCost = rise > 0 ? (rise / 16) ** 2 * 0.3 : 0
                a.reach.push({run: b, cost: 1 + gap * 0.02 + climbCost})
            }
        }
    }

    // The door stands on the run whose surface is at the door's feet and whose x-range holds the door
    const doorFeet = door.position.y + door.height
    const doorX = door.position.x + door.width / 2
    const doorRun = runs.find(run => !run.solid && run.y === doorFeet && run.x0 <= doorX && doorX <= run.x1)

    // Dijkstra backwards from the door: each platform learns its distance to the door and its best next hop
    runs.forEach(run => { run.distance = Infinity; run.next = null })
    doorRun.distance = 0
    const unvisited = new Set(runs)
    while (unvisited.size) {
        let current = null
        for (const run of unvisited) if (!current || run.distance < current.distance) current = run
        if (current.distance === Infinity) break
        unvisited.delete(current)
        for (const other of runs) {
            const edge = other.reach.find(e => e.run === current)
            if (edge && other.distance > current.distance + edge.cost) {
                other.distance = current.distance + edge.cost
                other.next = current
            }
        }
    }
    return {runs, doorRun}
}

/** @returns {{runs: Object[], doorRun: Object}} The platform map, built on first use */
function getPlatformGraph() {
    return platformGraph ||= buildPlatformGraph()
}

// ---- Seeded randomness ----
// The AI makes "random" choices (which attack, how long to wait). A seeded generator gives the same
// sequence every time for the same seed, so a test (or a bug report) can replay exactly what the AI did.
function seededRandom(seed) {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6D2B79F5) >>> 0 //mulberry32
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// ---- Difficulty ----
// Every number that makes the AI easier or harder is here. Each level is a set of the same knobs:
//   thinkInterval      seconds between decisions: its reaction time
//   engageRange        fights a rival on its own level within this many px sideways
//   leaveAloneAbove    ...but leaves a rival this injured behind to race on (unless they are attacking it)
//   strikeDistance     swings once the rival is this close (px between body centres); the sword reaches about 38
//   attackChance       chance to swing at each decision once in range and off cooldown
//   cooldown           [min, max] seconds between swings
//   respectInvulnerability   doesn't waste swings on a rival who was just hit
//   dodgeChance        chance to jump back from a slow attack (low or overhead)
//   hesitate / pause   chance per decision to stop and dither while climbing, and for how long [min, max] seconds
//   restAbove          when this injured and no rival is near, stands still to heal (resting heals 2.5x faster)
const AI_LEVELS = {
    // Stands still and never acts: for practising attacks and combos
    dummy: {acts: false},
    easy: {
        acts: true, thinkInterval: 0.3, engageRange: 80, leaveAloneAbove: 40, strikeDistance: 30,
        attackChance: 0.35, cooldown: [1.4, 2.4], respectInvulnerability: false, dodgeChance: 0,
        hesitate: 0.6, pause: [0.8, 2.2], restAbove: Infinity,
    },
    normal: {
        acts: true, thinkInterval: 0.12, engageRange: 110, leaveAloneAbove: 60, strikeDistance: 32,
        attackChance: 0.6, cooldown: [0.6, 1.2], respectInvulnerability: true, dodgeChance: 0.15,
        hesitate: 0.2, pause: [0.3, 0.9], restAbove: 80,
    },
    hard: {
        acts: true, thinkInterval: 0.06, engageRange: 140, leaveAloneAbove: 75, strikeDistance: 34,
        attackChance: 0.9, cooldown: [0.35, 0.7], respectInvulnerability: true, dodgeChance: 0.4,
        hesitate: 0, pause: [0, 0], restAbove: 60,
    },
}

const AI_SAME_LEVEL = 28     //Rivals whose feet are within this many px of its own count as "on the same level"
const AI_ATTACK_WEIGHTS = [['mid', 0.5], ['low', 0.3], ['overhead', 0.2]] //How often it picks each attack

const AI_JUMP_ALIGN = 20     //The AI jumps once it is this close (px) to the spot under its next platform

/**
 * Creates a computer player that controls the given slot.
 * It holds keys and calls jump()/attack(), exactly like a human, so it obeys every rule of the game.
 * @param {Object} options
 * @param {Number} options.slot - Which player it controls
 * @param {String} [options.level='normal'] - A key of AI_LEVELS
 * @param {Number} [options.seed=1] - Seeds its random choices
 * @returns {{slot: number, level: string, update: Function, reset: Function}}
 */
function createAiController({slot, level = 'normal', seed = 1}) {
    const config = AI_LEVELS[level]
    if (!config) throw new Error(`Unknown AI level: ${level}`)
    const random = seededRandom(seed)
    const graph = getPlatformGraph()
    const memory = {thinkTimer: 0, goal: null, stuckFor: 0, lastRun: null, cooldown: 0, pausedFor: 0}

    const keys = () => playerKeys[slot]
    const hold = direction => { keys().a.pressed = direction < 0; keys().d.pressed = direction > 0 } //-1 left, 0 none, +1 right
    const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

    /** Where the player's body is: centre x, and the y of the feet. */
    const bodyOf = player => {
        const box = player.hitbox
        return {cx: box.position.x + box.width / 2, feet: box.position.y + box.height}
    }

    /** Moves towards an x position, stopping once within the tolerance. */
    function steerTo(x, tolerance, body) {
        hold(Math.abs(x - body.cx) <= tolerance ? 0 : Math.sign(x - body.cx))
    }

    /** The platform the player is standing on, or null while airborne. */
    function currentRun(me, body) {
        if (Math.abs(me.velocity.y) >= 1) return null
        return graph.runs.find(run => Math.abs(run.y - body.feet) <= 3 && body.cx >= run.x0 - 4 && body.cx <= run.x1 + 4) || null
    }

    /** In the air: steer towards the platform being aimed at, and use the second jump if a miss is coming. */
    function steerAirborne(me, body) {
        const goal = memory.goal
        if (!goal) return hold(0)
        steerTo(clamp(body.cx, goal.x0 + 6, goal.x1 - 6), 3, body)
        //Past the top of the first jump and still below the platform's surface: jump again
        if (me.jumps > 0 && me.velocity.y > -30 && goal.y < body.feet - 4) jump(me)
    }

    /** On a platform: head for the next one on the route to the door. */
    function climb(me, body, run) {
        const next = run.next
        if (!next) return steerTo(door.position.x + door.width / 2, 3, body) //Already on the door's platform: walk to the door
        const target = clamp(body.cx, next.x0 + 4, next.x1 - 4)
        memory.goal = next
        if (run.y - next.y > 0 && Math.abs(target - body.cx) <= AI_JUMP_ALIGN) {
            steerTo(target, 2, body) //Keep drifting towards it while jumping
            jump(me)
        } else {
            steerTo(target, 2, body)
        }
    }

    /** The closest rival on the same level within range, or null. */
    function findRival(me, body) {
        let best = null
        for (const other of activePlayers()) {
            if (other === me) continue
            const rival = bodyOf(other)
            const dx = rival.cx - body.cx
            if (Math.abs(rival.feet - body.feet) > AI_SAME_LEVEL || Math.abs(dx) > config.engageRange) continue
            //This is a race: once a rival is hurt badly enough, running for the door beats beating them up
            if (other.injury >= config.leaveAloneAbove && !other.isAttacking) continue
            if (!best || Math.abs(dx) < Math.abs(best.dx)) best = {player: other, dx}
        }
        return best
    }

    /** Picks an attack: overhead against someone in the air, otherwise a weighted random choice. */
    function chooseAttack(rival) {
        if (rival.velocity.y !== 0) return 'overhead' //Its box reaches above the head
        let roll = random()
        for (const [type, weight] of AI_ATTACK_WEIGHTS) {
            roll -= weight
            if (roll < 0) return type
        }
        return 'mid'
    }

    /**
     * Faces, approaches and attacks a rival. Returns true if it fought (so it should not climb this step).
     * Turning and walking happen every step; the CHOICES (dodge? swing now?) only on a decision step,
     * so the AI's reaction time sets how often it acts, not how well it walks.
     */
    function fight(me, body, decide) {
        const rival = findRival(me, body)
        if (!rival) return false
        const towards = Math.sign(rival.dx) || 1

        // A slow attack (low, overhead) has a visible wind-up: sometimes jump out of the way
        const theirs = rival.player
        if (decide && theirs.isAttacking && theirs.currentAttack !== 'mid' && Math.abs(rival.dx) < 50 && random() < config.dodgeChance) {
            hold(-towards) //Jump back, away from the swing
            jump(me)
            return true
        }
        //Facing only changes while walking, so a step towards them turns the AI around
        if (me.facingLeft !== (towards < 0)) {
            hold(towards)
            return true
        }
        if (Math.abs(rival.dx) > config.strikeDistance) { //Close the distance
            hold(towards)
            return true
        }
        hold(0) //In range: stand and fight
        const wasted = config.respectInvulnerability && theirs.invulnerableTimer > 0.1
        if (decide && memory.cooldown <= 0 && !me.isAttacking && !wasted && random() < config.attackChance) {
            attack(me, chooseAttack(theirs))
            memory.cooldown = config.cooldown[0] + random() * (config.cooldown[1] - config.cooldown[0])
        }
        return true
    }

    /** Anyone (on any level) close enough to be a threat soon? */
    function rivalNearby(me, body) {
        return activePlayers().some(other => other !== me && Math.abs(bodyOf(other).cx - body.cx) < 200 && Math.abs(bodyOf(other).feet - body.feet) < 60)
    }

    /**
     * What to do this step while on the ground. Runs every step; `decide` is true only on the AI's
     * "reaction time" ticks, when it makes its choices (fight? rest? dither?).
     */
    function think(me, decide, dt) {
        const body = bodyOf(me)
        if (fight(me, body, decide)) return
        const run = currentRun(me, body)
        if (!run) return

        // Badly hurt and nobody about: stand still and heal (injury slows walking and weakens jumps)
        if (me.injury >= config.restAbove && !rivalNearby(me, body)) return hold(0)
        // Dithering: an easier AI sometimes stops for a moment instead of pressing on
        if (memory.pausedFor > 0) {
            memory.pausedFor -= dt
            return hold(0)
        }
        if (decide && random() < config.hesitate) {
            memory.pausedFor = config.pause[0] + random() * (config.pause[1] - config.pause[0])
            return hold(0)
        }
        // Stuck on the same platform for a long time (bad luck, an odd landing): hop and walk to shake things up
        memory.stuckFor = run === memory.lastRun ? memory.stuckFor + dt : 0
        memory.lastRun = run
        if (memory.stuckFor > 5) {
            memory.stuckFor = 0
            hold(random() < 0.5 ? -1 : 1)
            return jump(me)
        }
        climb(me, body, run) //Walking onto the right spot and the moment to jump: every step, never "slow reflexes"
    }

    return {
        slot, level,

        /** Called every game step, before the rules run. @param {Number} dt - seconds since the last step */
        update(dt) {
            const me = players[slot]
            if (!me || me.departed) return
            if (!config.acts || match.over || !me.canAct()) return hold(0)
            const body = bodyOf(me)
            if (!currentRun(me, body)) return steerAirborne(me, body) //In the air: fine control, every step
            memory.cooldown -= dt
            memory.thinkTimer -= dt
            const decide = memory.thinkTimer <= 0 //Is this one of the AI's reaction-time ticks?
            if (decide) memory.thinkTimer += config.thinkInterval
            think(me, decide, dt)
        },

        /** Back to a clean slate (a new round). */
        reset() {
            hold(0)
            Object.assign(memory, {thinkTimer: 0, goal: null, stuckFor: 0, lastRun: null, cooldown: 0, pausedFor: 0})
        },
    }
}

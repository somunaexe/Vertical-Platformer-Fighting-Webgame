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

// ---- Particles: tiny pixel squares that fly, fall and fade ----
// A small pool-based particle system on top of Pixi sprites. Effects (sparks, dust, confetti)
// call burst(); updateEffects(dt) moves everything once per frame. All motion uses dt,
// so it looks the same on any monitor.

const PARTICLE_TEXTURE_SIZE = 2 //The shared particle texture is a 2x2 white square, tinted per particle

const effects = {
    layer: null,     //Pixi container for the particles, on top of the players, inside the camera's world
    texture: null,
    active: [],      //Particles currently flying
    pool: [],        //Finished particles waiting to be reused (avoids creating new sprites constantly)
}

/**
 * Creates the particle layer and texture. Call once, after the players exist
 * so the particles draw on top of them.
 */
function initEffects() {
    const square = new PIXI.Graphics().rect(0, 0, PARTICLE_TEXTURE_SIZE, PARTICLE_TEXTURE_SIZE).fill(0xffffff)
    effects.texture = app.renderer.generateTexture(square)
    effects.texture.source.scaleMode = "nearest"
    effects.layer = new PIXI.Container()
    world.addChild(effects.layer)
}

/**
 * Launches one particle.
 * @param {Object} o
 * @param {Number} o.x - Start position in world pixels
 * @param {Number} o.y
 * @param {Number} o.vx - Start velocity in pixels per second
 * @param {Number} o.vy
 * @param {Number} o.life - Seconds until it disappears
 * @param {Number} o.size - Size in world pixels at the start
 * @param {Number} o.color - 0xRRGGBB
 * @param {Number} [o.gravity=0] - Downward acceleration in pixels per second squared
 * @param {Number} [o.drag=0] - Air resistance: fraction of velocity lost per second (exponential)
 */
function spawnParticle({x, y, vx, vy, life, size, color, gravity = 0, drag = 0}) {
    const sprite = effects.pool.pop() || new PIXI.Sprite(effects.texture)
    sprite.anchor.set(0.5)
    sprite.tint = color
    sprite.position.set(x, y)
    sprite.visible = true
    effects.layer.addChild(sprite)
    effects.active.push({sprite, x, y, vx, vy, life, maxLife: life, size, gravity, drag})
}

/**
 * Launches many particles at once, fanned out around a direction.
 * @param {Object} o
 * @param {Number} o.x - Centre in world pixels
 * @param {Number} o.y
 * @param {Number} o.count - How many particles
 * @param {Number} o.angle - Direction of the fan in radians (0 = right, -PI/2 = up)
 * @param {Number} o.spread - Total width of the fan in radians (2*PI = all directions)
 * @param {Number} o.speedMin - Slowest particle (pixels per second)
 * @param {Number} o.speedMax - Fastest particle
 * @param {Number} o.life - Average lifetime in seconds (each varies by +-30%)
 * @param {Number} o.size - Average size in world pixels
 * @param {Number|Number[]} o.color - One colour, or a list to pick from at random
 * @param {Number} [o.gravity=0]
 * @param {Number} [o.drag=0]
 */
function burst({x, y, count, angle, spread, speedMin, speedMax, life, size, color, gravity = 0, drag = 0}) {
    const random = (min, max) => min + Math.random() * (max - min)
    for (let i = 0; i < count; i++) {
        const direction = angle + random(-spread / 2, spread / 2)
        const speed = random(speedMin, speedMax)
        spawnParticle({
            x, y,
            vx: Math.cos(direction) * speed,
            vy: Math.sin(direction) * speed,
            life: life * random(0.7, 1.3),
            size: size * random(0.7, 1.3),
            color: Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color,
            gravity, drag,
        })
    }
}

/**
 * Moves every particle, fades and shrinks it as it ages, and recycles the finished ones.
 * @param {Number} dt - Seconds since the previous frame
 */
function updateEffects(dt) {
    for (let i = effects.active.length - 1; i >= 0; i--) {
        const p = effects.active[i]
        p.life -= dt
        if (p.life <= 0) {
            p.sprite.visible = false
            effects.layer.removeChild(p.sprite)
            effects.pool.push(p.sprite)
            effects.active.splice(i, 1)
            continue
        }
        p.vx *= Math.exp(-p.drag * dt)
        p.vy = p.vy * Math.exp(-p.drag * dt) + p.gravity * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        const age = p.life / p.maxLife //1 when new, 0 when about to vanish
        p.sprite.position.set(p.x, p.y)
        p.sprite.alpha = Math.min(1, age * 2) //Solid for the first half of its life, then fades
        p.sprite.scale.set(p.size / PARTICLE_TEXTURE_SIZE * (0.4 + 0.6 * age))
    }
}

/** Removes every particle immediately (used when a new round starts). */
function clearEffects() {
    for (const p of effects.active) {
        p.sprite.visible = false
        effects.layer.removeChild(p.sprite)
        effects.pool.push(p.sprite)
    }
    effects.active.length = 0
}

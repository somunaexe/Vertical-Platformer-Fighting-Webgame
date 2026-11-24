class Player extends Sprite {
    constructor({name, color = 0xffffff, imageSrc, position, velocity, collisionBlocks, platformBlocks, frames, collidedVertically=false, scale = 0.5, animations, facingLeft, sounds}) {
        super({imageSrc, position, frames, scale})
        this.name = name
        this.color = color //Identifies the player on the HUD (name tint, progress dot)
        this.spawn = {x: position.x, y: position.y, facingLeft} //Where reset() puts the player back
        this.velocity = velocity;
        this.collisionBlocks = collisionBlocks
        this.platformBlocks = platformBlocks
        this.frames = frames
        this.facingLeft = facingLeft
        this.jumps = 2
        this.injury = 0 //0 = fresh; rises when hit (see MAX_INJURY)
        this.hitTimer = 0 //Seconds of hit-stun left
        this.invulnerableTimer = 0 //Seconds of invulnerability left
        this.flashTimer = 0 //Seconds of white hit-flash left
        this.knockbackDirection = 0 //-1 pushed left, +1 pushed right
        this.currentAttack = null //Key of ATTACKS while attacking
        this.attackHasHit = false //Each swing can only land once
        this.collidedVertically = collidedVertically
        this.hitbox = {
            position: {
                x: this.position.x + 35,
                y: this.position.y + 26,
            },
            width: 14,
            height: 27,
        }
        this.animations = animations

        for (let key in this.animations) {
            this.animations[key].textures = sheetFrames(this.animations[key].imageSrc, this.animations[key].frames)
        }
        this.sounds = sounds
    }

    checkForHorizontalCanvasCollisions(dt) {
        // Look ahead by the distance we are about to travel this frame (speed * time)
        const step = this.velocity.x * dt
        if(this.hitbox.position.x + this.hitbox.width + step >= LEVEL.width || this.hitbox.position.x + step <= 0)
            this.velocity.x = 0
    }
    switchSprite(key) {
        const animation = this.animations[key]
        if(this.textures === animation.textures) return //Already showing this animation
        this.currentFrame = 0
        this.elapsedTime = 0
        this.textures = animation.textures
        this.mirrorWhenLeft = !!this.animations[key].mirrorWhenLeft
        this.frameBuffer = this.animations[key].frameBuffer
        this.frames = this.animations[key].frames
    }
    update(dt) {
        this.hitTimer = Math.max(0, this.hitTimer - dt)
        this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt)
        this.flashTimer = Math.max(0, this.flashTimer - dt)
        this.recoverInjury(dt)
        this.updateFrames(dt)
        this.updateHitbox()
        this.draw()
        this.position.x += this.velocity.x * dt;
        this.updateHitbox()
        this.checkForHorizontalCollisions()
        this.applyGravity(dt)
        this.updateHitbox()
        this.checkForVerticalCollisions()
    }

    /**
     * Heals injury over time. Faster while resting (standing still on the ground, not attacking);
     * not at all while stunned. Velocities here are still last frame's, i.e. what the player was just doing.
     * @param {Number} dt - Seconds elapsed since the previous frame
     */
    recoverInjury(dt) {
        if (this.hitTimer > 0 || match.over) return
        const resting = this.velocity.x === 0 && this.velocity.y === 0 && !this.isAttacking
        const rate = RECOVERY_RATE * (resting ? RESTING_RECOVERY_MULTIPLIER : 1)
        this.injury = Math.max(0, this.injury - rate * dt)
    }

    updateHitbox(){
        this.hitbox = {
            position: {
                x: this.position.x + 35,
                y: this.position.y + 26,
            },
            width: 14,
            height: 27,
        }
    }
    checkForHorizontalCollisions() {
        // Detects collision blocks
        for (let i =0; i < this.collisionBlocks.length; i++) {
            const block = this.collisionBlocks[i]

            if(collision(this.hitbox, block)){
                if(this.velocity.x < 0) {
                    this.velocity.x = 0
                    const offset = this.hitbox.position.x - this.position.x
                    this.position.x = block.position.x + block.width - offset + 0.01
                    break
                }
                if(this.velocity.x > 0) {
                    this.velocity.x = 0
                    const offset = this.hitbox.position.x - this.position.x + this.hitbox.width
                    this.position.x = block.position.x - offset - 0.01
                    break
                }
            }
        }
    }

    applyGravity(dt) {
        this.velocity.y += gravity * dt //acceleration -> speed
        this.position.y += this.velocity.y * dt //speed -> distance
    }

    /**
     * Announces a landing, but only for a real fall: a grounded player picks up a tiny downward speed
     * from gravity every frame, and that must not count. Call BEFORE velocity.y is reset to 0.
     */
    announceLanding() {
        if (this.velocity.y < LAND_EVENT_MIN_SPEED) return
        GameEvents.emit('land', {
            player: this,
            speed: this.velocity.y,
            x: this.hitbox.position.x + this.hitbox.width / 2,
            y: this.hitbox.position.y + this.hitbox.height, //The feet
        })
    }

    checkForVerticalCollisions() {
        // Detects collision blocks
        for (let i =0; i < this.collisionBlocks.length; i++) {
            const block = this.collisionBlocks[i]

            if(collision(this.hitbox, block)){
                if(this.velocity.y > 0) {
                    this.announceLanding()
                    this.collidedVertically = true
                    this.velocity.y = 0
                    const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
                    this.position.y = block.position.y - offset - 0.01
                    this.jumps = 2
                    break
                }
                if(this.velocity.y < 0) {
                    this.velocity.y = 0
                    const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
                    this.position.y = block.position.y + block.height - offset + 0.01
                    this.jumps = 2
                    break
                }
            }
        }

        //Detects platform block
        for (let i =0; i < this.platformBlocks.length; i++) {
            const platformBlock = this.platformBlocks[i]

            if(platformCollision({object1 : this.hitbox, object2 : platformBlock})){
                this.collidedVertically = true
                if(this.velocity.y > 0) {
                    this.announceLanding()
                    this.velocity.y = 0
                    const offset = this.hitbox.position.y - this.position.y + this.hitbox.height
                    this.position.y = platformBlock.position.y - offset - 0.01
                    this.jumps = 2
                    break
                }
            }
        }
    }

    /**
     * Draws the player, mirrored when facing left on a sheet that only exists facing right,
     * and see-through while invulnerable.
     */
    draw() {
        this.flipX = this.facingLeft && this.mirrorWhenLeft
        if (this.flipX) {
            //Mirroring about the sprite centre would move the body, so nudge it back under the hitbox
            const bodyCentre = this.hitbox.position.x - this.position.x + this.hitbox.width / 2
            this.flipShift = 2 * (bodyCentre - this.width / 2)
        }
        this.view.alpha = this.invulnerableTimer > 0 ? 0.6 : 1
        this.view.filters = this.flashTimer > 0 ? [whiteFlashFilter] : null //Solid white for a split second after a hit
        super.draw()
    }

    /** Injury as a fraction: 0 = fresh, 1 = maximum injury. */
    get injuryRatio() {
        return this.injury / MAX_INJURY
    }

    /** Multiplier on walking speed: 1 when fresh, INJURY_SPEED_FLOOR at maximum injury. */
    get speedMultiplier() {
        return 1 - (1 - INJURY_SPEED_FLOOR) * this.injuryRatio
    }

    /** Multiplier on jump take-off speed: 1 when fresh, INJURY_JUMP_FLOOR at maximum injury. */
    get jumpMultiplier() {
        return 1 - (1 - INJURY_JUMP_FLOOR) * this.injuryRatio
    }

    /** True when the player is free to start a jump or attack. */
    canAct() {
        return this.hitTimer <= 0 && !match.over
    }

    /** True while the current attack's sword is able to hurt (an active frame, and not yet landed). */
    isAttackActive() {
        return this.isAttacking
            && !this.attackHasHit
            && ATTACKS[this.currentAttack].activeFrames.includes(this.currentFrame)
    }

    /** The rectangle the sword covers right now: in front of the body, in the facing direction. */
    attackHitbox() {
        const attack = ATTACKS[this.currentAttack]
        const body = this.hitbox
        return {
            position: {
                x: this.facingLeft ? body.position.x - attack.reach : body.position.x + body.width,
                y: body.position.y + attack.offsetY,
            },
            width: attack.reach,
            height: attack.height,
        }
    }

    /** Horizontal knockback speed, fading to zero as the hit-stun runs out. */
    get knockbackSpeed() {
        return this.knockbackDirection * KNOCKBACK_SPEED * (this.hitTimer / HIT_STUN)
    }

    /**
     * Applies a hit: adds injury, interrupts any attack and stuns for a moment.
     * There is no death: injury only makes the player weaker.
     * @param {Number} injury - How much injury the hit adds
     * @param {Player} attacker - Who hit us (decides the knockback direction)
     */
    takeHit(injury, attacker) {
        this.injury = Math.min(MAX_INJURY, this.injury + injury)
        this.isAttacking = false
        this.currentAttack = null

        const attackerCentre = attacker.hitbox.position.x + attacker.hitbox.width / 2
        const ourCentre = this.hitbox.position.x + this.hitbox.width / 2
        this.knockbackDirection = attackerCentre < ourCentre ? 1 : -1
        this.facingLeft = this.knockbackDirection > 0 //Pushed away from the attacker, so we face them

        this.hitTimer = HIT_STUN
        this.invulnerableTimer = INVULNERABLE_TIME
        this.flashTimer = FLASH_TIME
        this.velocity.y = -KNOCKBACK_POP //Launch upwards; gravity brings them back down, maybe onto a lower platform
        this.collidedVertically = false
    }

    /** Puts the player back at their spawn point fully recovered, ready for a new round. */
    reset() {
        this.position.x = this.spawn.x
        this.position.y = this.spawn.y
        this.updateHitbox() //The camera reads the hitbox, which would otherwise lag a frame behind the move
        this.velocity.x = 0
        this.velocity.y = 0
        this.facingLeft = this.spawn.facingLeft
        this.injury = 0
        this.hitTimer = 0
        this.invulnerableTimer = 0
        this.flashTimer = 0
        this.isAttacking = false
        this.currentAttack = null
        this.jumps = 2
        this.switchSprite(this.facingLeft ? 'idleLeft' : 'idle')
    }
}

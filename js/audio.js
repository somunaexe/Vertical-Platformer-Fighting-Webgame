// ---- Sound effects: reacts to game events ----

/**
 * Plays a sound from the start (restarting it if it is already playing).
 * @param {AudioSFX} sound
 * @param {Number} [rate=1] - Playback speed; 2 = twice as fast and an octave higher
 */
function playSound(sound, rate = 1) {
    sound.currentTime = 0
    sound.playbackRate = rate
    //Browsers refuse to play audio before the first click/keypress; that is fine, just stay silent
    sound.play().catch(() => {})
}

GameEvents.on('jump', ({player}) => playSound(player.sounds.jump, 2))
GameEvents.on('attack', ({player, type}) => playSound(player.sounds[ATTACKS[type].sound]))
GameEvents.on('hit', ({victim}) => {
    playSound(victim.sounds.hit)
    playSound(victim.sounds.grunt)
})

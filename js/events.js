const player1Keys = {
    a: { pressed: false },
    w: { pressed: false },
    s: { pressed: false },
    d: { pressed: false }
  };
  
const player2Keys = {
    a: { pressed: false },
    w: { pressed: false },
    s: { pressed: false },
    d: { pressed: false }
};
  

window.addEventListener("keydown", event => {
    console.log(event.code)
    switch (event.code) {
        //Player 1 movement cases
        case "KeyA":
            player1Keys.a.pressed = true;
            break
        case "KeyD":
            player1Keys.d.pressed = true;
            break
        case "KeyW":
            player1.jumps > 0 && (
                player1.collidedVertically = false,
                player1.jumps--,
                player1.velocity.y = -4
            )
            break
        //Player 1 attack cases
        case "KeyX":
            !player1.isAttacking && (
                player1.isAttacking = true,
                player1.sounds.lowAttack.currentTime = 0,
                player1.sounds.lowAttack.play(),
                player1.switchSprite('attackLow')
            )
            break
        case "KeyC":
            !player1.isAttacking && (
                player1.isAttacking = true,
                player1.sounds.midAttack.currentTime = 0,
                player1.sounds.midAttack.play(),
                player1.switchSprite('attackMid')
            )
            break
        case "KeyV":
        !player1.isAttacking && (
            player1.isAttacking = true,
            player1.sounds.overheadAttack.currentTime = 0,
            player1.sounds.overheadAttack.play(),
            player1.switchSprite('attackOverhead')
            )
            break

        //Player 2 movement cases
        case "ArrowLeft":
            player2Keys.a.pressed = true;
            break
        case "ArrowRight":
            player2Keys.d.pressed = true;
            break
        case "ArrowUp":
            player2.jumps > 0 && (
                player2.collidedVertically = false,
                player2.jumps--,
                player2.velocity.y = -4
            )
            break

        //Player 2 attack cases
        case "KeyI":
            !player2.isAttacking &&(
                player2.isAttacking = true,
                player2.sounds.lowAttack.currentTime = 0,
                player2.sounds.lowAttack.play(),
                player2.switchSprite('attackLow')
            )
            break
        case "KeyO":
            !player2.isAttacking && (
                player2.isAttacking = true,
                player2.sounds.midAttack.currentTime = 0,
                player2.sounds.midAttack.play(),
                player2.switchSprite('attackMid')
            )
            break
        case "KeyP":
            !player2.isAttacking && (
                player2.isAttacking = true,
                player2.sounds.overheadAttack.currentTime = 0,
                player2.sounds.overheadAttack.play(),
                player2.switchSprite('attackOverhead')
            )
            break
    }
})

window.addEventListener("keyup", event => {
    switch (event.code) {
        //Player 1 movement cases
        case "KeyA":
            player1Keys.a.pressed = false;
            // if(player1.sounds.run.isPlaying) player1.sounds.run.stop()
            break
        case "KeyD":
            player1Keys.d.pressed = false;
            // if(player1.sounds.run.isPlaying) player1.sounds.run.stop()
            break
        
        //Player 2 movement cases
        case "ArrowLeft":
            player2Keys.a.pressed = false;
            // if(player2.sounds.run.isPlaying) player2.sounds.run.stop()
            break
        case "ArrowRight":
            player2Keys.d.pressed = false;
            // if(player2.sounds.run.isPlaying) player2.sounds.run.stop()
            break
    }
})

//Resize the canvas to fit the window
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
})

//Start playing the music on first interaction
window.addEventListener("click", playMusic)
window.addEventListener("keydown", playMusic)
window.addEventListener("touchstart", playMusic)

function playMusic() {
    bgMusic.play().then(() => {
        console.log("music played")
    })
    .catch(error => {
        console.log("Error playing music", error) //Music couldn't be played
    })

    //Remove event listeners to prevent repeating
    window.removeEventListener("click", playMusic)
    window.removeEventListener("keydown", playMusic)
    window.removeEventListener("touchstart", playMusic)
}
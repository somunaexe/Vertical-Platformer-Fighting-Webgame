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
        //Player 1 cases
        case "KeyA":
            player1Keys.a.pressed = true;
            break
        case "KeyD":
            player1Keys.d.pressed = true;
            break
        case "KeyW":
            player1.jumps > 0 && (
                player1.jumps--,
                player1.velocity.y = -4
            )
            break
        case "KeyX":
            !player1.isAttacking && (
                player1.isAttacking = true,
                player1.switchSprite('attackLow')
            )
            break
        case "KeyC":
            !player1.isAttacking && (
                player1.isAttacking = true,
                player1.switchSprite('attackMid')
            )
            break
        case "KeyV":
        !player1.isAttacking && (
            player1.isAttacking = true,
            player1.switchSprite('attackOverhead')
            )
            break

        //Player 2 cases
        case "ArrowLeft":
            player2Keys.a.pressed = true;
            break
        case "ArrowRight":
            player2Keys.d.pressed = true;
            break
        case "ArrowUp":
            player2.jumps > 0 && (
                player2.jumps--,
                player2.velocity.y = -4
            )
            break
    }
})

window.addEventListener("keyup", event => {
    switch (event.code) {
        //Player 1 cases
        case "KeyA":
            player1Keys.a.pressed = false;
            break
        case "KeyD":
            player1Keys.d.pressed = false;
            break
        
        //Player 2 cases
        case "ArrowLeft":
            player2Keys.a.pressed = false;
            break
        case "ArrowRight":
            player2Keys.d.pressed = false;
            break
    }
})
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
})

window.addEventListener("click", playMusic)
window.addEventListener("keydown", playMusic)
window.addEventListener("touchstart", playMusic)

function playMusic() {
    bgMusic.play().then(() => {
        console.log("music played")
    })
    .catch(error => {
        console.log("Error playing music", error)
    })

    window.removeEventListener("click", playMusic)
    window.removeEventListener("keydown", playMusic)
    window.removeEventListener("touchstart", playMusic)
}
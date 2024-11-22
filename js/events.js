const a = {pressed: false}
const w = {pressed: false}
const s = {pressed: false}
const d = {pressed: false}
const keys = {a,w,s,d}

window.addEventListener("keydown", event => {
    console.log(event.code)
    switch (event.code) {
        case "KeyA":
            keys.a.pressed = true;
            break
        case "KeyD":
            keys.d.pressed = true;
            break
        case "KeyW":
            player1.jumps > 0 && (
                player1.jumps--,
                player1.velocity.y = -4
            )
            break
        case "KeyC":
            player1.switchSprite('attackMid')
        // case "L"
    }
})

window.addEventListener("keyup", event => {
    switch (event.code) {
        case "KeyA":
            keys.a.pressed = false;
            break
        case "KeyD":
            keys.d.pressed = false;
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
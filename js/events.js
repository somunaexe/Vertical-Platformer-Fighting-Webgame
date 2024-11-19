const a = {pressed: false}
const w = {pressed: false}
const s = {pressed: false}
const d = {pressed: false}
const keys = {a,w,s,d}

window.addEventListener("keydown", event => {
    switch (event.code) {
        case "KeyA":
            keys.a.pressed = true;
            break
        case "KeyD":
            keys.d.pressed = true;
            break
        case "KeyW":
            player1.velocity.y = -8;
            break
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
const canvas = document.querySelector("canvas");
const c = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
c.fillStyle = 'green';
c.fillRect(0, 0, canvas.width, canvas.height);
const gravity = 0.15;

const scaledCanvas = {
    width: canvas.width / 4,
    height: canvas.height / 4
}

const floorCollisions2D = []
for (let i = 0; i < floorCollisions.length; i+= 36) {
    floorCollisions2D.push(floorCollisions.slice(i, i + 36))
}
const collisionBlocks = []
floorCollisions2D.forEach((row, y) => {
    row.forEach((symbol, x) => {
        if (symbol === 202) {
            collisionBlocks.push(new CollisionBlock({
                position: {
                    x: x * 16, 
                    y: y * 16
                }
            }))
        }
    })
})

const platformCollisions2D = []
for (let i = 0; i < platformCollisions.length; i+= 36) {
    platformCollisions2D.push(platformCollisions.slice(i, i + 36))
}
const platformBlocks = []
platformCollisions2D.forEach((row, y) => {
    row.forEach((symbol, x) => {
        if (symbol === 202) {
            platformBlocks.push(new CollisionBlock({
                position: {
                    x: x * 16, 
                    y: y * 16
                },
                height: 4,
            }))
        }
    })
})

const background = new Sprite({
    imageSrc: "assets/images/background.png",
    position: {x: 0, y: 0}
})

const bgMusic = new AudioSFX({src: '/assets/audio/bg-music.mp3', autoplay: true, loop: true});

const player1 = new Player({
    imageSrc: "assets/images/warrior/Idle.png",
    position: {x: 100, y: 300},
    velocity:  {x: 0, y: 0},
    collisionBlocks,
    platformBlocks,
    frames: 8,
    facingLeft: false,
    animations: {
        idle: {
            imageSrc: "assets/images/warrior/Idle.png",
            frames: 8,
            frameBuffer: 3,
        },
        run: {
            imageSrc: "assets/images/warrior/Run.png",
            frames: 8,
            frameBuffer: 5
        },
        jump: {
            imageSrc: "assets/images/warrior/Jump.png",
            frames: 2,
            frameBuffer: 5
        },
        fall: {
            imageSrc: "assets/images/warrior/Fall.png",
            frames: 2,
            frameBuffer: 5
        },
        idleLeft: {
            imageSrc: "assets/images/warrior/IdleLeft.png",
            frames: 8,
            frameBuffer: 3
        },
        runLeft: {
            imageSrc: "assets/images/warrior/RunLeft.png",
            frames: 8,
            frameBuffer: 5
        },
        jumpLeft: {
            imageSrc: "assets/images/warrior/JumpLeft.png",
            frames: 2,
            frameBuffer: 5
        },
        fallLeft: {
            imageSrc: "assets/images/warrior/FallLeft.png",
            frames: 2,
            frameBuffer: 5
        },
        attackLow: {
            imageSrc: "assets/images/warrior/AttackLow.png",
            frames: 4,
            frameBuffer: 6
        },
        attackMid: {
            imageSrc: "assets/images/warrior/AttackMid.png",
            frames: 4,
            frameBuffer: 4
        },
        attackOverhead: {
            imageSrc: "assets/images/warrior/AttackOverhead.png",
            frames: 4,
            frameBuffer: 5
        },
        // attackLowLeft: {
        //     imageSrc: "assets/images/warrior/AttackLowLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        // attackMidLeft: {
        //     imageSrc: "assets/images/warrior/AttackMidLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        // attackOverheadLeft: {
        //     imageSrc: "assets/images/warrior/AttackOverheadLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        hit: {
            imageSrc: "assets/images/warrior/Take Hit.png",
            frames: 2,
            frameBuffer: 5
        },
        hitSilhouette: {
            imageSrc: "assets/images/warrior/HitSilhouette.png",
            frames: 2,
            frameBuffer: 5
        } ,
        // hitSilhouetteLeft: {
        //     imageSrc: "assets/images/warrior/HitSilhouetteLeft.png",
        //     frames: 2,
        //     frameBuffer: 5
        // },
        // hitLeft: {
        //     imageSrc: "assets/images/warrior/HitLeft.png",
        //     frames: 2,
        //     frameBuffer: 5
        // },
        death: {
            imageSrc: "assets/images/warrior/Death.png",
            frames: 6,
            frameBuffer: 5
        },
        // deathLeft: {
        //     imageSrc: "assets/images/warrior/DeathLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // }
    },
    sounds: {
        death: new AudioSFX({src: '/assets/audio/death.mp3'}),
        fall: new AudioSFX({src: '/assets/audio/fall.mp3'}),
        grunt: new AudioSFX({src: '/assets/audio/grunt.mp3'}),
        hit: new AudioSFX({src: '/assets/audio/hit.mp3'}),
        jump: new AudioSFX({src: '/assets/audio/jump.mp3'}),
        lowAttack: new AudioSFX({src: '/assets/audio/low-attack.mp3', volume: 1.0}),
        midAttack: new AudioSFX({src: '/assets/audio/mid-attack.mp3', volume: 1.0}),
        overheadAttack: new AudioSFX({src: '/assets/audio/overhead-attack.mp3', volume: 1.0}),
        run: new AudioSFX({src: '/assets/audio/run.mp3', volume: 1.0, loop: true}),
    }
});

const player2 = new Player({
    imageSrc: "assets/images/warrior/IdleLeft.png",
    position: {x: 300, y: 300},
    velocity:  {x: 0, y: 0},
    collisionBlocks,
    platformBlocks,
    frames: 8,
    facingLeft: true,
    animations: {
        idle: {
            imageSrc: "assets/images/warrior/Idle.png",
            frames: 8,
            frameBuffer: 3,
        },
        run: {
            imageSrc: "assets/images/warrior/Run.png",
            frames: 8,
            frameBuffer: 5
        },
        jump: {
            imageSrc: "assets/images/warrior/Jump.png",
            frames: 2,
            frameBuffer: 5
        },
        fall: {
            imageSrc: "assets/images/warrior/Fall.png",
            frames: 2,
            frameBuffer: 5
        },
        idleLeft: {
            imageSrc: "assets/images/warrior/IdleLeft.png",
            frames: 8,
            frameBuffer: 3
        },
        runLeft: {
            imageSrc: "assets/images/warrior/RunLeft.png",
            frames: 8,
            frameBuffer: 5
        },
        jumpLeft: {
            imageSrc: "assets/images/warrior/JumpLeft.png",
            frames: 2,
            frameBuffer: 5
        },
        fallLeft: {
            imageSrc: "assets/images/warrior/FallLeft.png",
            frames: 2,
            frameBuffer: 5
        },
        attackLow: {
            imageSrc: "assets/images/warrior/AttackLow.png",
            frames: 4,
            frameBuffer: 6
        },
        attackMid: {
            imageSrc: "assets/images/warrior/AttackMid.png",
            frames: 4,
            frameBuffer: 4
        },
        attackOverhead: {
            imageSrc: "assets/images/warrior/AttackOverhead.png",
            frames: 4,
            frameBuffer: 5
        },
        // attackLowLeft: {
        //     imageSrc: "assets/images/warrior/AttackLowLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        // attackMidLeft: {
        //     imageSrc: "assets/images/warrior/AttackMidLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        // attackOverheadLeft: {
        //     imageSrc: "assets/images/warrior/AttackOverheadLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // },
        hit: {
            imageSrc: "assets/images/warrior/Take Hit.png",
            frames: 2,
            frameBuffer: 5
        },
        hitSilhouette: {
            imageSrc: "assets/images/warrior/HitSilhouette.png",
            frames: 2,
            frameBuffer: 5
        } ,
        // hitSilhouetteLeft: {
        //     imageSrc: "assets/images/warrior/HitSilhouetteLeft.png",
        //     frames: 2,
        //     frameBuffer: 5
        // },
        // hitLeft: {
        //     imageSrc: "assets/images/warrior/HitLeft.png",
        //     frames: 2,
        //     frameBuffer: 5
        // },
        death: {
            imageSrc: "assets/images/warrior/Death.png",
            frames: 6,
            frameBuffer: 5
        },
        // deathLeft: {
        //     imageSrc: "assets/images/warrior/DeathLeft.png",
        //     frames: 6,
        //     frameBuffer: 5
        // }
    },
    sounds: {
        death: new AudioSFX({src: '/assets/audio/death.mp3'}),
        fall: new AudioSFX({src: '/assets/audio/fall.mp3'}),
        grunt: new AudioSFX({src: '/assets/audio/grunt.mp3'}),
        hit: new AudioSFX({src: '/assets/audio/hit.mp3'}),
        jump: new AudioSFX({src: '/assets/audio/jump.mp3'}),
        lowAttack: new AudioSFX({src: '/assets/audio/low-attack.mp3'}),
        midAttack: new AudioSFX({src: '/assets/audio/mid-attack.mp3'}),
        overheadAttack: new AudioSFX({src: '/assets/audio/overhead-attack.mp3'}),
        run: new AudioSFX({src: '/assets/audio/run.mp3', volume: 1.0, loop: true}),
    }
});

const backgroundHeight = 432
const camera = {
    position: {
        x: 0,
        y: -backgroundHeight + scaledCanvas.height,
    },
}

function runPlayerAnimation(player, keys) {
    player.checkForHorizontalCanvasCollisions()
    player.update();
    player.velocity.x = 0
    
    if (keys.d.pressed) {
        player.velocity.x = 2
        player.facingLeft = false
        player.switchSprite('run')
        // if(!player.sounds.run.isPlaying && player.collidedVertically) player.sounds.run.play()
        player.panCameraToLeft(canvas, camera)
    }
    else if (keys.a.pressed) {
        player.velocity.x = -2
        player.facingLeft = true
        player.switchSprite('runLeft')
        // if(!player.sounds.run.isPlaying && player.collidedVertically) player.sounds.run.play()
        player.panCameraToRight(camera)
    }
    else if (player.velocity.y === 0 && !player.isAttacking) {
        if(player.facingLeft) player.switchSprite('idleLeft')
        else player.switchSprite('idle')
    }

    if (player.velocity.y < 0) {
        player.panCameraToDown(camera)
        if(player.facingLeft) player.switchSprite('jumpLeft')
        else player.switchSprite('jump')
        // if(!player.sounds.jump.isPlaying) player.sounds.jump.play()
        } 
    else if (player.velocity.y > 0) {
        player.panCameraToUp(camera, canvas)
        if(player.facingLeft) player.switchSprite('fallLeft')
        else player.switchSprite('fall')
        // if(player.sounds.jump.isPlaying) player.sounds.jump.stop()
    }
}
function animate() {
    window.requestAnimationFrame(animate)
    c.fillStyle = 'white';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.save()
    c.scale(4, 4)
    c.translate(camera.position.x, camera.position.y)
    background.update()
    runPlayerAnimation(player1, player1Keys)
    runPlayerAnimation(player2, player2Keys)
    c.restore()
}
animate()
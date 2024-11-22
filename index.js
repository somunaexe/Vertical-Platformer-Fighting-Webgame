//Instantiate the canvas using the canvas html tag and context
const canvas = document.querySelector("canvas");
const c = canvas.getContext('2d');

//Set the canvas width and height
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

//Fill the canvas with a green color. Used only for debugging
c.fillStyle = 'green';
c.fillRect(0, 0, canvas.width, canvas.height);

const gravity = 0.15; //The drag/acceleration due to gravity on the player

//Canvas is scaled to fill entire screen. Hence, it's actual width and height are stored in scaledCanvas for calculations
const scaledCanvas = {
    width: canvas.width / 4,
    height: canvas.height / 4
}

//Set up a 2D array to store the collision tileset data
const floorCollisions2D = []
for (let i = 0; i < floorCollisions.length; i+= 36) {
    floorCollisions2D.push(floorCollisions.slice(i, i + 36))//Each pushed/sliced array represents a row
}

//Set up collision blocks in the canvas using the collision tileset data
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

//Set up a 2D array to store the platform collision tileset data
const platformCollisions2D = []
for (let i = 0; i < platformCollisions.length; i+= 36) {
    platformCollisions2D.push(platformCollisions.slice(i, i + 36))
}

//Set up platform collision blocks in the canvas using the collision tileset data
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

//Add the background sprite
const background = new Sprite({
    imageSrc: "assets/images/background.png",
    position: {x: 0, y: 0}
})

//Add the background music
const bgMusic = new AudioSFX({src: '/assets/audio/bg-music.mp3', volume: 0.5, autoplay: true, loop: true});

//Instantiate a player into the scene
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
        lowAttack: new AudioSFX({src: '/assets/audio/low-attack.mp3'}),
        midAttack: new AudioSFX({src: '/assets/audio/mid-attack.mp3'}),
        overheadAttack: new AudioSFX({src: '/assets/audio/overhead-attack.mp3'}),
        run: new AudioSFX({src: '/assets/audio/run.mp3', loop: true}),
    }
});

//Instantiate a second player into the scene
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
//Camera object for tracking the player
const camera = {
    position: {
        x: 0,
        y: -backgroundHeight + scaledCanvas.height,
    },
}

/**
 * Updates the player's animation and position based on the given keys
 * @param {Player} player - The player to update
 * @param {Object} keys - An object containing the pressed state of the left and right arrow keys
 */
function runPlayerAnimation(player, keys) {
    player.checkForHorizontalCanvasCollisions()
    player.update();
    // if (player.sounds.run.isPlaying && (!player.collidedVertically || (!keys.d.pressed && !keys.a.pressed))) {
    //     player.sounds.run.pause();
    // }
    player.velocity.x = 0

    if (keys.d.pressed) {
        player.velocity.x = 2 //Move the player 2 pixels to the right
        player.facingLeft = false //Set the player's facing direction
        player.switchSprite('run') //Switch to the run animation
        
        //  if (player.collidedVertically) {
        //     if (!player.sounds.run.isPlaying) {
        //         player.sounds.run.currentTime = 0;
        //         player.sounds.run.play();
        //     }
        // }
        player.panCameraToLeft(canvas, camera) //Pan the camera to the left if the player is exceeding the right boundary
    }
    else if (keys.a.pressed) {
        player.velocity.x = -2 //Move the player 2 pixels to the left
        player.facingLeft = true //Set the player's facing direction
        player.switchSprite('runLeft') //Switch to the runLeft animation
        // if(!player.sounds.run.isPlaying && player.collidedVertically) player.sounds.run.play()
        player.panCameraToRight(camera) //Pan the camera to the right if the player is exceeding the left boundary
    }
    else if (player.velocity.y === 0 && !player.isAttacking) {
        if(player.facingLeft) player.switchSprite('idleLeft') //Switch to the idleLeft animation
        else player.switchSprite('idle') //Switch to the idle animation
    }

    //If player is jumping
    if (player.velocity.y < 0) {
        player.panCameraToDown(camera) //Pan the camera to the down if the player is exceeding the top boundary

        //Play the jump sound
        player.sounds.jump.currentTime = 0
        player.sounds.jump.playbackRate = 2.0
        player.sounds.jump.play()

        //Switch to the jump animation depending on the player's facing direction
        if(player.facingLeft) player.switchSprite('jumpLeft')
        else player.switchSprite('jump')
    } 
    else if (player.velocity.y > 0) {
        player.panCameraToUp(camera, canvas) //Pan the camera to the up if the player is exceeding the bottom boundary

        //Switch to the fall animation depending on the player's facing direction
        if(player.facingLeft) player.switchSprite('fallLeft')
        else player.switchSprite('fall')
        // if(player.sounds.jump.isPlaying) player.sounds.jump.stop()
    }
}

/**
 * Continuously animates the game frame by clearing the canvas, updating
 * the background and player animations, and applying camera transformations.
 * Utilizes requestAnimationFrame for smooth rendering.
 */
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
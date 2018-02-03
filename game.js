const TIME_BETWEEN_BONUS_CREATION = 10000
let DEBUG_PLAYER_MOVEMENT = false
let DEBUG_MOVEMENT_SPEED = 4

let game = new Phaser.Game(900, 700, Phaser.AUTO, 'game-div')

let state
let cursor

let phaserState = new Phaser.State()

phaserState.preload = function preload () {
  loadImages()
  loadAudio()

  function loadImages() {
    game.load.image('player', 'img/parrot.png')
    game.load.image('bonus', 'img/boxItem.png')
    game.load.image('bubble', 'img/bubble4.png')
    game.load.image('water', 'img/waterTop_low.png')
    game.load.image('coin', 'img/coinGold.png')
    game.load.image('hudcoin', 'img/hudCoin.png')
    game.load.image('background', 'img/blue_land.png')
    game.load.image('plane', 'img/planeYellow1.png')
    game.load.image('box', 'img/boxCoin_boxed.png')
  }

  function loadAudio() {
    game.load.audio('coin', 'audio/coin.mp3');
    game.load.audio('bubble', 'audio/bubble.mp3');
  }
}

phaserState.create = function create () {
  createBackground()

  state = createState()
  state.lastBubble = createBubble()

  cursor = game.input.keyboard.createCursorKeys()

  game.physics.startSystem(Phaser.Physics.ARCADE)

  game.sound.setDecodedCallback([ 'coin', 'bubble' ], this.start, this);

  function createBackground () {
    game.stage.backgroundColor = '#3498db'
    game.add.tileSprite(0, -30, 1024, 1024, 'background')
  }

  function createState () {
    return {
      score: 0,
      scoreLabel: createScoreLabel(),
      scoreIcon: createScoreIcon(),
      frontWaves: createWaves(60, 0xeeeeee),
      droppingCoins: game.add.physicsGroup(),
      player: createPlayer(),
      bonuses: game.add.physicsGroup(),
      bubbles: createBubbles(),
      coins: game.add.physicsGroup(),
      backWaves: createWaves(40),
      gameoverLabel: createGameoverLabel(),
      countdownLabel: createCountdownLabel(),
      gameover: false,
      frame: 0,
      lastBonusCollectionTime: 0,
      audio: {
        coin: game.add.audio('coin'),
        bubble: game.add.audio('bubble')
      }
    }

    function createPlayer () {
      const player = game.add.sprite(350, 350, 'player')
      game.physics.arcade.enable(player)
      player.body.collideWorldBounds = true
      player.anchor.setTo(0.5, 0.5)
      player.width = 40
      player.height = 40
      return player
    }

    function createGameoverLabel () {
      const gameoverLabel = game.add.text(game.width / 2 - 50, game.height / 2, 'Game Over')
      gameoverLabel.visible = false

      return gameoverLabel
    }

    function createCountdownLabel () {
      const countdownLabel = game.add.text(
        game.width / 2 - 21,
        game.height / 2 - 100,
        '3',
        {fill: '#BC2905', fontSize: '60px'}
      )
      countdownLabel.visible = false
      return countdownLabel
    }

    function createWaves (bottomOffset, tint) {
      const tileWidth = 40
      const waterGroup = game.add.physicsGroup()
      const numberOfTiles = Math.ceil(game.width / tileWidth) + 1
      for (let i = -2; i < numberOfTiles; i++) {
        let waveTile = waterGroup.create(i * tileWidth, 700 - bottomOffset, 'water')
        waveTile.width = tileWidth
        waveTile.height = 40
        waveTile.body.immovable = true
        if (tint) waveTile.tint = tint
      }
      return waterGroup
    }

    function createScoreLabel () {
      const scoreLabel = game.add.text(39, 5, '0', {'fill': '#FFCC00', fontSize: '32px'})
      scoreLabel.stroke = '#8c7001'
      scoreLabel.strokeThickness = 5
      return scoreLabel
    }

    function createScoreIcon () {
      const scoreIcon = game.add.sprite(0, 6, 'hudcoin')
      game.physics.arcade.enable(scoreIcon)
      scoreIcon.body.immovable = true
      scoreIcon.width = 40
      scoreIcon.height = 40
      return scoreIcon
    }

    function createBubbles () {
      const bubbles = game.add.physicsGroup()
      return bubbles
    }
  }
}

phaserState.start = function start () {
  state.bubbles.removeAll(true)
  state.bonuses.removeAll(true)

  state.player.position.y = game.height / 2
  state.player.position.x = game.width / 2
  state.player.body.velocity.x = 0
  state.player.body.velocity.y = 0
  state.player.body.gravity.y = 0
  state.playerWait = 180

  state.gameover = false
  state.gameoverLabel.visible = false

  state.countdownLabel.text = '3'
  
  state.lastBonusCollectionTime = 0
}

phaserState.update = function update () {
  handleGameover(this.start)

  incrementFrame()

  updateGameObjects()

  handleCollisions()

  handleCountdownProcess()

  handlePlayerMovement()

  function handleGameover(start) {
    if (state.player.position.y > 670) state.gameover = true
    if (state.gameover) start()
  }

  function incrementFrame() {
    state.frame++
    if (state.frame > 120) state.frame = 0
  }

  function handleCollisions() {
    game.physics.arcade.collide(state.player, state.bubbles, bubbleCollision, null, state)
    game.physics.arcade.collide(state.scoreIcon, state.coins, coinScoreCollision, null, state)
    game.physics.arcade.collide(state.bubbles, state.droppingCoins, bubbleDroppingCoinsCollision, null, state)

    function bubbleCollision (player, bubble) {
      if (!DEBUG_PLAYER_MOVEMENT) player.body.velocity.y = -500
      bubble.destroy()
      state.audio.bubble.play()
      spawnGold(bubble.position.x, bubble.position.y)
    }

    function bubbleDroppingCoinsCollision(bubble, droppingCoin) {
      const bubblePosition = bubble.position
      state.audio.bubble.play()
      bubble.kill()
      createDroppingCoin(bubblePosition.x, bubblePosition.y)
    }

    function coinScoreCollision (hudCoin, coin) {
      coin.destroy()
      state.audio.coin.play()
      state.score++
    }
  }

  function updateGameObjects() {
    moveWater(state.frontWaves, state.frame, 0)
    moveWater(state.backWaves, state.frame, 60)

    updateScore()
    updateBonuses()
    updateDroppingCoins()
    updateBubbles()
  }

  function updateBonuses() {
    state.bonuses.forEach(bonus => {
      if (Phaser.Rectangle.intersects(state.player.body, bonus.body)) {
        bonusCollision(bonus)
      }
    })

    if (state.bonuses.length < 1 && bonusCreationTimeOutPassed(game.time.time, state.lastBonusCollectionTime)) {
      state.bonus = addBonus()
    }

    function bonusCollision (bonus) {
      bonus.kill()
      state.bonuses.removeAll(true)
      state.score += 10
      state.lastBonusCollectionTime = game.time.time
    }

    function addBonus () {
      const random = Math.round(Math.random() * 20)
      const x = random / 20 * game.width
      const y = 100
      let newBonus = state.bonuses.create(x, y, 'bonus')
      newBonus.width = 40
      newBonus.height = 40
      newBonus.body.immovable = true
      return newBonus
    }
  }

  function updateScore() {
    state.scoreLabel.text = state.score.toString()
  }

  function handleCountdownProcess() {
    state.countdownLabel.visible = state.playerWait > 0
    if (state.playerWait === 170) createBubble(state.player.x, 700)
    if (state.playerWait <= 180 - 60) {
      state.countdownLabel.text = '2'
    }
    if (state.playerWait <= 180 - 120) state.countdownLabel.text = '1'

    if (state.playerWait === 1) state.score = 0
    if (state.playerWait === 0) {
      if(!DEBUG_PLAYER_MOVEMENT) state.player.body.gravity.y = 750
    } else {
      state.playerWait--
    }
  }

  function updateDroppingCoins() {
    state.droppingCoins.forEach(droppingCoin => {
      if (Phaser.Rectangle.intersects(state.player.body, droppingCoin.body)) {
        droppingCoinCollision(droppingCoin)
      }
      if (droppingCoin.position.y > game.height) {
        droppingCoin.kill()
      }
    })

    function droppingCoinCollision (coin) {
      spawnGold(coin.position.x, coin.position.y)
      state.audio.coin.play()
      coin.destroy()
    }
  }

  function updateBubbles() {
    state.bubbles.forEach(bubble => {
      bubble.body.velocity.x = bubble.sidewaysVelocityOffset * Math.sin((state.frame + bubble.sidewaysVelocityPhaseOffset) / 120 * Math.PI * 2)
      if(bubble.position.y <= 0) {
        const x = bubble.position.x
        const y = bubble.position.y
        bubble.destroy()
        createDroppingCoin(x, y)
      }
    })

    if (!state.lastBubble.alive || state.lastBubble.y < 660) { state.lastBubble = createBubble() }
  }

  function bonusCreationTimeOutPassed (currentTime, lastCreationTime) {
    return currentTime - lastCreationTime > TIME_BETWEEN_BONUS_CREATION
  }

  function moveWater (water, frame, phase) {
    water.forEach(function (wave) {
      wave.x += Math.sin((frame + phase) / 120 * Math.PI * 2)
    })
  }

  function handlePlayerMovement() {
    if (state.playerWait === 0) {
      if (DEBUG_PLAYER_MOVEMENT) {
        if (cursor.left.isDown) {
          state.player.body.position.x -= DEBUG_MOVEMENT_SPEED
        }
        if (cursor.right.isDown) {
          state.player.body.position.x += DEBUG_MOVEMENT_SPEED
        }
        if (cursor.up.isDown) {
          state.player.body.position.y -= DEBUG_MOVEMENT_SPEED
        }
        if (cursor.down.isDown) {
          state.player.body.position.y += DEBUG_MOVEMENT_SPEED
        }
        state.player.body.velocity.x = 0
        state.player.body.velocity.y = 0
      } else {
        if (cursor.left.isDown) {
          state.player.body.velocity.x -= (state.player.body.velocity.x + 400) / 15
        } else if (cursor.right.isDown) {
          state.player.body.velocity.x += (400 - state.player.body.velocity.x) / 15
        } else {
          state.player.body.velocity.x /= 1.02
        }
      }
    }
  }

  function createDroppingCoin (x, y) {
    const coin = state.droppingCoins.create(x, y, 'coin')
    coin.width = 40
    coin.height = 40
    coin.body.setSize(26,26,7,7)
    coin.body.gravity.y = 750
    return coin
  }

  function spawnGold (x, y) {
    const newCoin = state.coins.create(x, y, 'coin')
    newCoin.width = 40
    newCoin.height = 40
    newCoin.body.gravity.y = 10
    game.physics.arcade.moveToXY(newCoin, 0, 0, 100, 600)
    return newCoin
  }
}

game.state.add('main', phaserState)
game.state.start('main')

function createBubble (x, y) {
  const sideOffset = 80
  x = x || (Math.random() * (game.width - sideOffset * 2)) + sideOffset
  y = y || game.height
  let newBubble = state.bubbles.create(x, y, 'bubble')
  newBubble.checkWorldBounds = true
  newBubble.body.velocity.y = -40
  newBubble.width = 40
  newBubble.height = 40
  newBubble.body.immovable = true
  newBubble.sidewaysVelocityOffset = 10 + 100 * Math.random()
  newBubble.sidewaysVelocityPhaseOffset = 240 * Math.random()
  return newBubble
}

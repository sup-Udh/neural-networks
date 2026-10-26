var requestAnimFrame = (function(){
  return window.requestAnimationFrame       ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
    window.oRequestAnimationFrame      ||
    window.msRequestAnimationFrame     ||
    function(callback){
      window.setTimeout(callback, 1000 / 60);
    };
})();

//create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext('2d');
var updateables = [];
var fireballs = [];
var player = new Mario.Player([0,0]);

//we might have to get the size and calculate the scaling
//but this method should let us make it however big.
//Cool!
//TODO: Automatically scale the game to work and look good on widescreen.
//TODO: fiddling with scaled sprites looks BETTER, but not perfect. Hmm.
canvas.width = 762;
canvas.height = 720;
ctx.scale(3,3);
// MarioGame.tsx sets this before loading the legacy scripts. The canvas stays
// inside the React-owned game area instead of being attached to the site body.
var gameHost = window.__marioGameHost;
if (!gameHost) {
  throw new Error('Mario needs a game host. Set window.__marioGameHost before loading game.js.');
}
gameHost.appendChild(canvas);

//viewport
var vX = 0,
    vY = 0,
    vWidth = 256,
    vHeight = 240;

//load our images
resources.load([
  'sprites/player.png',
  'sprites/enemy.png',
  'sprites/tiles.png',
  'sprites/playerl.png',
  'sprites/items.png',
  'sprites/enemyr.png',
]);

resources.onReady(init);
var level;
var sounds;
var music;
var gameTime = 0;
var animationFrameId;
var destroyed = false;
var blockedAudio = null;

// Modern browsers reject play() until the learner has interacted with the
// document. Always consume that Promise so an optional sound never crashes the
// game or creates an unhandled rejection during level startup.
function playAudio(audio) {
  var playing = audio.play();
  if (playing && playing.catch) {
    playing.catch(function(error) {
      // Remember the blocked track so a click or key press can start it after
      // the browser grants permission for audio playback.
      if (error && error.name === 'NotAllowedError') blockedAudio = audio;
    });
  }
}

window.__marioEnableAudio = function() {
  if (!blockedAudio) return;
  var audio = blockedAudio;
  blockedAudio = null;
  playAudio(audio);
};

//initialize
var lastTime;
function init() {
  if (destroyed) return;
  music = {
    overworld: new Audio('/game/mario/sounds/aboveground_bgm.ogg'),
    underground: new Audio('/game/mario/sounds/underground_bgm.ogg'),
    clear: new Audio('/game/mario/sounds/stage_clear.wav'),
    death: new Audio('/game/mario/sounds/mariodie.wav')
  };
  sounds = {
    smallJump: new Audio('/game/mario/sounds/jump-small.wav'),
    bigJump: new Audio('/game/mario/sounds/jump-super.wav'),
    breakBlock: new Audio('/game/mario/sounds/breakblock.wav'),
    bump: new Audio('/game/mario/sounds/bump.wav'),
    coin: new Audio('/game/mario/sounds/coin.wav'),
    fireball: new Audio('/game/mario/sounds/fireball.wav'),
    flagpole: new Audio('/game/mario/sounds/flagpole.wav'),
    kick: new Audio('/game/mario/sounds/kick.wav'),
    pipe: new Audio('/game/mario/sounds/pipe.wav'),
    itemAppear: new Audio('/game/mario/sounds/itemAppear.wav'),
    powerup: new Audio('/game/mario/sounds/powerup.wav'),
    stomp: new Audio('/game/mario/sounds/stomp.wav')
  };
  Mario.oneone();
  lastTime = Date.now();
  main();
}

//set up the game loop
function main() {
  if (destroyed) return;
  var now = Date.now();
  var dt = (now - lastTime) / 1000.0;

  update(dt);
  render();

  lastTime = now;
  animationFrameId = requestAnimFrame(main);
}

// The original demo never unmounted. React needs a way to stop its loop,
// audio, and document-level input handlers when the route changes.
window.__marioGameDestroy = function() {
  destroyed = true;
  window.cancelAnimationFrame(animationFrameId);
  window.clearTimeout(animationFrameId);
  if (music) {
    Object.keys(music).forEach(function(key) {
      music[key].pause();
    });
  }
  if (sounds) {
    Object.keys(sounds).forEach(function(key) {
      sounds[key].pause();
    });
  }
  if (window.input && window.input.destroy) window.input.destroy();
  if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  blockedAudio = null;
  delete window.__marioEnableAudio;
};

function update(dt) {
  gameTime += dt;

  handleInput(dt);
  updateEntities(dt, gameTime);

  checkCollisions();
}

function handleInput(dt) {
  if (player.piping || player.dying || player.noInput) return; //don't accept input

  if (input.isDown('RUN')){
    player.run();
  } else {
    player.noRun();
  }
  if (input.isDown('JUMP')) {
    player.jump();
  } else {
    //we need this to handle the timing for how long you hold it
    player.noJump();
  }

  if (input.isDown('DOWN')) {
    player.crouch();
  } else {
    player.noCrouch();
  }

  if (input.isDown('LEFT')) { // 'd' or left arrow
    player.moveLeft();
  }
  else if (input.isDown('RIGHT')) { // 'k' or right arrow
    player.moveRight();
  } else {
    player.noWalk();
  }
}

//update all the moving stuff
function updateEntities(dt, gameTime) {
  player.update(dt, vX);
  updateables.forEach (function(ent) {
    ent.update(dt, gameTime);
  });

  //This should stop the jump when he switches sides on the flag.
  if (player.exiting) {
    if (player.pos[0] > vX + 96)
      vX = player.pos[0] - 96
  }else if (level.scrolling && player.pos[0] > vX + 80) {
    vX = player.pos[0] - 80;
  }

  if (player.powering.length !== 0 || player.dying) { return; }
  level.items.forEach (function(ent) {
    ent.update(dt);
  });

  level.enemies.forEach (function(ent) {
    ent.update(dt, vX);
  });

  fireballs.forEach(function(fireball) {
    fireball.update(dt);
  });
  level.pipes.forEach (function(pipe) {
    pipe.update(dt);
  });
}

//scan for collisions
function checkCollisions() {
  if (player.powering.length !== 0 || player.dying) { return; }
  player.checkCollisions();

  //Apparently for each will just skip indices where things were deleted.
  level.items.forEach(function(item) {
    item.checkCollisions();
  });
  level.enemies.forEach (function(ent) {
    ent.checkCollisions();
  });
  fireballs.forEach(function(fireball){
    fireball.checkCollisions();
  });
  level.pipes.forEach (function(pipe) {
    pipe.checkCollisions();
  });
}

//draw the game!
function render() {
  updateables = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = level.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  //scenery gets drawn first to get layering right.
  for(var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++){
      if (level.scenery[i][j]) {
        renderEntity(level.scenery[i][j]);
      }
    }
  }

  //then items
  level.items.forEach (function (item) {
    renderEntity(item);
  });

  level.enemies.forEach (function(enemy) {
    renderEntity(enemy);
  });



  fireballs.forEach(function(fireball) {
    renderEntity(fireball);
  })

  //then we draw every static object.
  for(var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++){
      if (level.statics[i][j]) {
        renderEntity(level.statics[i][j]);
      }
      if (level.blocks[i][j]) {
        renderEntity(level.blocks[i][j]);
        updateables.push(level.blocks[i][j]);
      }
    }
  }

  //then the player
  if (player.invincibility % 2 === 0) {
    renderEntity(player);
  }

  //Mario goes INTO pipes, so naturally they go after.
  level.pipes.forEach (function(pipe) {
    renderEntity(pipe);
  });
}

function renderEntity(entity) {
  entity.render(ctx, vX, vY);
}

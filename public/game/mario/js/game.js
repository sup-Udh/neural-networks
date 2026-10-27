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

// External-controller adapter (used by the React wrapper). Nothing here changes
// physics: it only lets a controller supply the key states, pause the loop,
// reset the level, and read a plain-data snapshot of the real game objects.
//   keys:         null -> the human keyboard (input.js) is used. An object like
//                 {RIGHT:true, RUN:true, JUMP:false} replaces the keyboard.
//   beforeUpdate: called once per simulated frame, before input is read.
var marioHooks = window.__marioHooks = {
  paused: false,
  keys: null,
  beforeUpdate: null,
  frame: 0,
  snapshot: function() {
    var h = player.power > 0 ? 32 : 16;
    var enemies = [];
    level.enemies.forEach(function(e) {
      var type = e instanceof Mario.Goomba ? 'goomba' : (e.shell ? 'koopaShell' : 'koopa');
      enemies.push({ type: type, x: e.pos[0], y: e.pos[1], vx: e.vel[0], dying: !!e.dying });
    });
    return {
      frame: marioHooks.frame,
      viewportX: vX,
      levelExitX: level.exit * 16,
      rows: 15,
      player: {
        x: player.pos[0], y: player.pos[1], vx: player.vel[0], vy: player.vel[1],
        width: 16, height: h, standing: !!player.standing, power: player.power,
        coins: player.coins, dying: !!player.dying, flagging: !!player.flagging,
        exiting: !!player.exiting, piping: !!player.piping, noInput: !!player.noInput
      },
      enemies: enemies,
      // A tile cell is solid if a static/block tile occupies it OR a warp pipe's hitbox overlaps it. Pipes created
      // with putRealPipe live in level.pipes (not in the tile grids) but block Mario like walls.
      isSolid: function(col, row) {
        if (row < 0 || row >= 15 || col < 0) return false;
        if (level.statics[row][col] || level.blocks[row][col]) return true;
        var x0 = col * 16, y0 = row * 16;
        for (var i = 0; i < level.pipes.length; i++) {
          var p = level.pipes[i];
          if (p.pos[0] < x0 + 16 && p.pos[0] + p.hitbox[2] > x0 && p.pos[1] < y0 + 16 && p.pos[1] + p.hitbox[3] > y0) return true;
        }
        return false;
      }
    };
  },
  // Restart World 1-1 from a clean state. The game's own death path reloads `level.loader`, which for the
  // underground tunnel would reload the tunnel, so reset always rebuilds the first level explicitly.
  reset: function() {
    player = new Mario.Player([56, 192]);
    fireballs.length = 0;
    updateables = [];
    Mario.oneone();
    input.reset();
    gameTime = 0;
    vX = 0;
    marioHooks.frame = 0;
  },
  // Advance the simulation exactly one frame with a fixed time step. Only for use when the animation loop is not
  // running (the headless evaluator never schedules requestAnimationFrame); calling it next to the live loop
  // would double-update the physics.
  step: function(dt) {
    if (destroyed) return;
    update(dt || 1 / 60);
    render();
  }
};

function isKeyDown(key) {
  if (!marioHooks.keys) return input.isDown(key);
  // player.js only initialises moveAcc inside noRun(). With the keyboard, RUN is never down on a fresh Mario's
  // first frame, but an external controller can press RUN immediately, which leaves velocity NaN. Report RUN as
  // up until noRun() has run once, exactly what the keyboard path would have done.
  if (key === 'RUN' && player.moveAcc === undefined) return false;
  return !!marioHooks.keys[key];
}

//set up the game loop
function main() {
  if (destroyed) return;
  var now = Date.now();
  var dt = (now - lastTime) / 1000.0;

  if (!marioHooks.paused) {
    update(dt);
  }
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
  delete window.__marioHooks;
};

function update(dt) {
  gameTime += dt;
  marioHooks.frame += 1;
  if (marioHooks.beforeUpdate) marioHooks.beforeUpdate();

  handleInput(dt);
  updateEntities(dt, gameTime);

  checkCollisions();
}

function handleInput(dt) {
  if (player.piping || player.dying || player.noInput) return; //don't accept input

  if (isKeyDown('RUN')){
    player.run();
  } else {
    player.noRun();
  }
  if (isKeyDown('JUMP')) {
    player.jump();
  } else {
    //we need this to handle the timing for how long you hold it
    player.noJump();
  }

  if (isKeyDown('DOWN')) {
    player.crouch();
  } else {
    player.noCrouch();
  }

  if (isKeyDown('LEFT')) { // 'd' or left arrow
    player.moveLeft();
  }
  else if (isKeyDown('RIGHT')) { // 'k' or right arrow
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

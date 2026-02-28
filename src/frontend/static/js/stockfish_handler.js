var stockfish = null;
var currentSkillLevel = 5; // Default skill level, updated when user changes it

function stockfish_load() {
  if (!stockfish) {
    console.log('Initializing stockfish');
    stockfish = new Worker("./stockfish.js");
  }
  return stockfish;
}

function stockfish_start(fen, rating, customSkillLevel = null) {
  let threads = window.navigator.hardwareConcurrency || 1;
    
  // Use custom skill level if provided, otherwise use stored level
  if (customSkillLevel !== null) {
    currentSkillLevel = customSkillLevel;
  }

  console.log('Loading stockfish with fen: ' + fen + ' and skill level ' + currentSkillLevel);

  stockfish.postMessage('uci');
  stockfish.postMessage('ucinewgame');
  stockfish.postMessage(`setoption name Threads value ${threads}`);
  stockfish.postMessage(`setoption name Skill Level value ${currentSkillLevel}`);
  stockfish.postMessage(`position startpos fen ${fen}`);
  stockfish.postMessage('isready');
}

function stockfish_move(fen) {
    let movetime = 1000;
    // Apply the current skill level before each move to ensure it's always set
    stockfish.postMessage(`setoption name Skill Level value ${currentSkillLevel}`);
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go movetime ${movetime}`);
}

function stockfish_set_skill_level(skillLevel) {
    // Just store the skill level, don't send to engine yet
    // It will be applied on the next move via stockfish_move()
    currentSkillLevel = skillLevel;
    console.log('Skill level set to: ' + skillLevel + ' (will apply on next engine move)');
}

export { stockfish_load, stockfish_move, stockfish_start, stockfish_set_skill_level }

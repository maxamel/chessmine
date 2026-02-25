var stockfish = null;

function stockfish_load() {
  if (!stockfish) {
    console.log('Initializing stockfish');
    stockfish = new Worker("./stockfish.js");
  }
  return stockfish;
}

function stockfish_start(fen, rating, customSkillLevel = null) {
  let threads = window.navigator.hardwareConcurrency || 1;
    var skill_level;
    
    // Use custom skill level if provided, otherwise derive from rating
    if (customSkillLevel !== null) {
      skill_level = customSkillLevel;
    } else {
      skill_level = 4;
    }

  console.log('Loading stockfish with fen: ' + fen + ' and skill level ' + skill_level);

  stockfish.postMessage('uci');
  stockfish.postMessage('ucinewgame');
  stockfish.postMessage(`setoption name Threads value ${threads}`);
  stockfish.postMessage(`setoption name Skill Level value ${skill_level}`);
  stockfish.postMessage(`position startpos fen ${fen}`);
  stockfish.postMessage('isready');
}

function stockfish_move(fen) {
    let movetime = 1000;
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go movetime ${movetime}`);
}

function stockfish_set_skill_level(skillLevel) {
    if (stockfish) {
        console.log('Updating stockfish skill level to: ' + skillLevel);
        stockfish.postMessage(`setoption name Skill Level value ${skillLevel}`);
    }
}

export { stockfish_load, stockfish_move, stockfish_start, stockfish_set_skill_level }
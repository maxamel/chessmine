var stockfish = null;

function stockfish_load(fen, rating) {
  if (!stockfish) {
    let threads = window.navigator.hardwareConcurrency || 1;
    var skill_level;
    if (rating < 1150)
      skill_level = 1
    else if (rating < 1450)
      skill_level = 2
    else if (rating < 1650)
      skill_level = 3
    else if (rating < 1850)
      skill_level = 4
    else if (rating < 2050)
      skill_level = 5
    else if (rating < 2250)
      skill_level = 7
    else
      skill_level = 8

    console.log('Loading stockfish with fen: ' + fen + ' and skill level ' + skill_level);

    stockfish = STOCKFISH();
    stockfish.postMessage('uci');
    stockfish.postMessage('ucinewgame');
    stockfish.postMessage(`setoption name Threads value ${threads}`);
    stockfish.postMessage(`setoption name Skill Level value ${skill_level}`);
    stockfish.postMessage(`position startpos fen ${fen}`);
    stockfish.postMessage('isready');
  }
  return stockfish;
}

function stockfish_move(fen) {
    let movetime = 1000;
    /*if (movesList !== undefined && movesList.length > 0) {
        movesList = 'moves ' + movesList;
    }
    console.log('The moves list: ' + movesList);
     */
    //stockfish.postMessage('ucinewgame');
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go movetime ${movetime}`);
}

export { stockfish_load, stockfish_move }
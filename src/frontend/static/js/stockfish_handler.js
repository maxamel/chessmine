var stockfish = null;

function stockfish_load(moves) {
  if (!stockfish) {
    let threads = window.navigator.hardwareConcurrency || 1;
    var movesSteps = '';
    if (moves !== undefined && moves.length > 0) {
        movesSteps += 'moves ';
        movesSteps += moves.join(' ');
    }
    console.log('Loading stockfish with moves: ' + movesSteps);

    stockfish = STOCKFISH();
    stockfish.postMessage('uci');
    stockfish.postMessage('ucinewgame');
    stockfish.postMessage(`setoption name Threads value ${threads}`);
    stockfish.postMessage("setoption name Skill Level value 10");
    stockfish.postMessage(`position startpos ` + movesSteps);
    stockfish.postMessage('isready');
  }
  return stockfish;
}

function stockfish_move(movesList) {
    let movetime = 1000;
    if (movesList !== undefined && movesList.length > 0) {
        movesList = 'moves ' + movesList;
    }
    console.log('The moves list: ' + movesList);
    stockfish.postMessage('ucinewgame');
    stockfish.postMessage(`position startpos ${movesList}`);
    stockfish.postMessage(`go movetime ${movetime}`);
}

export { stockfish_load, stockfish_move }
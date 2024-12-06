

    function getBoardColorsByName(str) {
        if (str === "urban") return urban_board_theme;
        if (str === "standard") return standard_board_theme;
        if (str === "wiki") return wiki_board_theme;
        if (str === "wood") return wood_board_theme;
        if (str === "alpha") return alpha_board_theme;
        if (str === "american") return american_board_theme;
        if (str === "metro") return metro_board_theme;
        if (str === "classical") return classical_board_theme;
        return ["#f0d9b5", "#b58863"];
    }

    function getPieceFuncByName(str) {
        if (str === "urban") return urban_piece_theme;
        if (str === "standard") return standard_piece_theme;
        if (str === "wiki") return wiki_piece_theme;
        if (str === "wood") return wood_piece_theme;
        if (str === "american") return american_piece_theme;
        if (str === "metro") return metro_piece_theme;
        if (str === "classical") return classical_piece_theme;
        if (str === "alpha") return alpha_piece_theme
        return null;
    }

    function getTimeRemaining(endtime) {
        /*
            Get time remaining from endtime by extracting millis, seconds, minutes
         */
        var t = endtime;// - new Date().getTime();
        var millis = Math.floor((t % 1000) / 10);
        var seconds = Math.floor((t / 1000) % 60);
        var minutes = Math.floor((t / 1000 / 60) % 60);
        return {
            "total": t,
            "minutes": minutes,
            "seconds": seconds,
            "millis": millis
        };
    }

    function fenToObj (fen) {
        // cut off any move, castling, etc info from the end
        // we're only interested in position information
        fen = fen.replace(/ .+$/, '')
        var COLUMNS = 'abcdefgh'.split('')
        var rows = fen.split('/')
        var position = {}

        var currentRow = 8
        for (var i = 0; i < 8; i++) {
          var row = rows[i].split('')
          var colIdx = 0

          // loop through each character in the FEN section
          for (var j = 0; j < row.length; j++) {
            // number / empty squares
            if (row[j].search(/[1-8]/) !== -1) {
              var numEmptySquares = parseInt(row[j], 10)
              colIdx = colIdx + numEmptySquares
            } else {
              // piece
              var square = COLUMNS[colIdx] + currentRow
              position[square] = fenToPieceCode(row[j])
              colIdx = colIdx + 1
            }
          }

          currentRow = currentRow - 1
        }

        return position
    }

    function fenToPieceCode (piece) {
        // black piece
        if (piece.toLowerCase() === piece) {
          return 'b' + piece.toUpperCase()
        }

        // white piece
        return 'w' + piece.toUpperCase()
    }

    function setupBoard(boardTheme) {
          console.log('setting board themes as ' + boardTheme);
          var board_func = getBoardColorsByName(boardTheme);
          document.querySelector('cg-board').style.backgroundColor=board_func[0];
      }

    function setupThemes(pieceTheme) {
          console.log('setting piece themes as ' + pieceTheme);
          var piece_func = getPieceFuncByName(pieceTheme);
          var pieces = document.getElementsByClassName("black");
          for (var iter = 0; iter < 2; iter++) {
            for (var t = 0; t < pieces.length; t++) {
              var classes = pieces[t].className.split(' ');
              var color_first_letter = classes[0][0];
              if (color_first_letter === 'w' || color_first_letter === 'b') {   // if not w/b it's probably not a piece
                var piece_first_letter = classes[1] === 'knight' ? "N" : classes[1][0].toUpperCase();
                var piece_representation = piece_func(color_first_letter + piece_first_letter)
                if (piece_representation)   // if null it's probably not a piece
                  pieces[t].style.backgroundImage = "url(" + piece_representation + ")"
              }
            }
            pieces = document.getElementsByClassName("white");
          }
    }

    export { getPieceFuncByName, getBoardColorsByName, getTimeRemaining, fenToObj, setupThemes, setupBoard }
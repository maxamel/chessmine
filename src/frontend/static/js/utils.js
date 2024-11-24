

    function getBoardColorsByName(str) {
        if (str === "urban") return urban_board_theme;
        if (str === "standard") return standard_board_theme;
        if (str === "wiki") return wiki_board_theme;
        if (str === "wood") return wood_board_theme;
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
        return alpha_piece_theme;
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

    function setupThemes(pieceTheme) {
          console.log('setting piece themes as ' + pieceTheme);
          var piece_func = getPieceFuncByName(pieceTheme);
          var pieces = document.getElementsByClassName("black");
          for (var t = 0; t < pieces.length; t++) {
              var classes = pieces[t].className.split(' ');
              var piece_first_letter = classes[1] === 'knight' ? "N" : classes[1][0].toUpperCase();
              pieces[t].style.backgroundImage = "url(" + piece_func(classes[0][0] + piece_first_letter) + ")"
          }
          var pieces = document.getElementsByClassName("white");

          for (var t = 0; t < pieces.length; t++) {
              var classes = pieces[t].className.split(' ');
              var piece_first_letter = classes[1] === 'knight' ? "N" : classes[1][0].toUpperCase();
              pieces[t].style.backgroundImage = "url(" + piece_func(classes[0][0] + piece_first_letter) + ")"
          }
      }

    export { getPieceFuncByName, getBoardColorsByName, getTimeRemaining, fenToObj, setupThemes }
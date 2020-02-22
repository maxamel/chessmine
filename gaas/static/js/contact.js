$(document).ready(function(){


    var timeintervalA = null
    var timeintervalB = null
    setTime('clockdivA', 300000)
    setTime('clockdivB', 300000)
    ///// CLOCK
    function getTimeRemaining(endtime) {
          var t = endtime// - new Date().getTime();
          var millis = Math.floor((t % 1000) / 10);
          var seconds = Math.floor((t / 1000) % 60);
          var minutes = Math.floor((t / 1000 / 60) % 60);
          return {
            'total': t,
            'minutes': minutes,
            'seconds': seconds,
            'millis': millis
          };
    }

    function setTime(id, endtime, word) {
        var clock = document.getElementById(id);
        var minutesSpan = clock.querySelector('.minutes');
        var secondsSpan = clock.querySelector('.seconds');
        var millisSpan = clock.querySelector('.millis');
        var t = getTimeRemaining(endtime);
        minutesSpan.innerHTML = ('0' + t.minutes).slice(-2);
        secondsSpan.innerHTML = ('0' + t.seconds).slice(-2);
        millisSpan.innerHTML = ('0' + t.millis).slice(-2);
    }

    function initializeClock(id, endtime) {
      var clock = document.getElementById(id);
      var minutesSpan = clock.querySelector('.minutes');
      var secondsSpan = clock.querySelector('.seconds');
      var millisSpan = clock.querySelector('.millis');
      var lastCall = new Date().getTime()

      function updateClock() {
            now = new Date().getTime()
            endtime -= now - lastCall
            lastCall = now
            var t = getTimeRemaining(endtime);
            if (t.total <= 0){
                clearInterval(timeintervalA);
                clearInterval(timeintervalB);

              millisSpan.innerHTML = ('00').slice(-2);
              return;
            }
            minutesSpan.innerHTML = ('0' + t.minutes).slice(-2);
            secondsSpan.innerHTML = ('0' + t.seconds).slice(-2);
            millisSpan.innerHTML = ('0' + t.millis).slice(-2);
      }
      updateClock();
      if (id == 'clockdivA') {
          timeintervalA = setInterval( function() { updateClock(); }, 10 );
      }
      else {
          timeintervalB = setInterval( function() { updateClock(); }, 10 );
      }
    }
    ///// CLOCK
    var board = null
    var $board = $('#myBoard')
    var game = new Chess()
    var $status = $('#status')
    var $fen = $('#fen')
    var $pgn = $('#pgn')
    var whiteSquareGrey = '#a9a9a9'
    var blackSquareGrey = '#696969'
    var futureMove = false
    var futureMoveData = null
    var player_id = null
    var other_remaining = 300000

    var data = localStorage.getItem("chessjazz")
    var socket = io('http://localhost:5000/connect');
    if (data == null) {
        socket.on('connection_id', function (ans) {
            player_id = ans.id
            localStorage.setItem("chessjazz", player_id)
        });
        socket.on('game_over', function (ans) {
            alert(JSON.stringify(ans))
            clearInterval(timeintervalA)
            clearInterval(timeintervalB)
        });
        socket.on('game', function (ans) {
            the_game = JSON.stringify(ans.color)
            the_game = the_game.replace(/\\"/g, '"');
            var config = {
                  pieceTheme: 'static/img/chesspieces/chess24/{piece}.png',
                  draggable: true,
                  position: 'start',
                  orientation: JSON.parse(the_game),
                  onDragStart: onDragStart,
                  onDrop: onDrop,
                  //onMoveEnd: onMoveEnd,
                  onMouseoutSquare: onMouseoutSquare,
                  onMouseoverSquare: onMouseoverSquare,
                  onSnapEnd: onSnapEnd
            }
            board = Chessboard('myBoard', config)
        });
        socket.on('move', function (ans) {
            ans = JSON.parse(ans)
            the_move = ans.move
            game.move(the_move.san)
            // chessboard.js doesn't handle castling, en-passant and pawn promotion correctly.
            if (the_move.san == "O-O-O" ||
                the_move.san == "O-O" ||
                the_move.san.indexOf("=")>-1 ||
                (the_move.san.indexOf("x")>-1 && the_move.flags == "e")
            )
                board.position(game.fen(), useAnimation=true)
            else
                board.move(the_move.from + "-" + the_move.to)

            if (ans.remaining) {
                other_remaining = ans.other_remaining
                initializeClock('clockdivB', ans.remaining);
                clearInterval(timeintervalA)
                setTime('clockdivA', ans.other_remaining)
            }

            if (futureMoveData != null) {
                var move = game.move({
                    from: futureMoveData.from,
                    to: futureMoveData.to,
                    promotion: 'q' // NOTE: always promote to a queen for example simplicity
                })
                var json = {
                    "id": player_id,
                    "move": move
                }
                if (move != null) {
                    socket.emit('update', json, function(ret){
                        ret = JSON.parse(ret)
                        if (ret.remaining) {
                            clearInterval(timeintervalB)
                            console.log("LINCOLN " + ret["other_remaining"] + " " + ret["remaining"])
                            setTime('clockdivB', ret["other_remaining"])
                            initializeClock('clockdivA', ret["remaining"])
                        }
                    })
                    if (move.san == "O-O-O" ||
                        move.san == "O-O" ||
                        move.san.indexOf("=")>-1 ||
                        (move.san.indexOf("x")>-1 && move.flags == "e")
                    )
                        board.position(game.fen(), useAnimation=true)
                    else
                        board.move(move.from + "-" + move.to)
                }
                removeHighlights('yellow')
                futureMoveData = null
            }
        });
        res = socket.emit('connection', function(ans) {
            //alert(JSON.stringify(ans))
        })
    } else {
        player_id = data
    }

    function removeGreySquares () {
      $('#myBoard .square-55d63').css('background', '')
    }

    function removeHighlights (color) {
      $('#myBoard .square-55d63').removeClass('highlight-' + color)
    }

    function greySquare (square) {
      var $square = $('#myBoard .square-' + square)

      var background = whiteSquareGrey
      if ($square.hasClass('black-3c85d')) {
        background = blackSquareGrey
      }

      $square.css('background', background)
    }

    function onDragStart (source, piece, position, orientation) {
        // do not pick up pieces if the game is over
        if (game.game_over()) return false
        if (orientation == 'white' && piece.indexOf('b') != -1) return false
        if (orientation == 'black' && piece.indexOf('w') != -1) return false

          removeHighlights('yellow')
          // record future move
          if ((game.turn() === 'w' && piece.indexOf('b') !== -1) ||
          (game.turn() === 'b' && piece.indexOf('w') !== -1)) {
              futureMove = true
      }
    }

    function onDrop (source, target) {
      // see if the move is legal
      var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
      })
        removeHighlights('yellow')
      if (futureMove == true && source != target) {
          $board.find('.square-' + source).addClass('highlight-yellow')
          $board.find('.square-' + target).addClass('highlight-yellow')
          futureMove = false
          futureMoveData = {from: source, to: target}
      }
      removeGreySquares()
      // illegal move
        updateStatus()
        var json = {
            "id": player_id,
            "move": move
        }
        if (move != null) {
            socket.emit('update', json, function(ret){
                ret = JSON.parse(ret)
                if (ret.remaining) {
                    clearInterval(timeintervalB)
                    setTime('clockdivB', ret["other_remaining"])
                    initializeClock('clockdivA', ret["remaining"])
                }
            })
        }
    }

    function onMouseoverSquare (square, piece, position, orientation) {
        if (game.game_over() || piece == false) return false
        if (orientation == 'white' && piece.indexOf('b') != -1) return false
        if (orientation == 'black' && piece.indexOf('w') != -1) return false
      // get list of possible moves for this square
      var moves = game.moves({
        square: square,
        verbose: true
      })

      // exit if there are no moves available for this square
      if (moves.length === 0) return

      // highlight the square they moused over
      greySquare(square)

      // highlight the possible squares for this piece
      for (var i = 0; i < moves.length; i++) {
        greySquare(moves[i].to)
      }
    }

    function onMouseoutSquare (square, piece) {
      removeGreySquares()
    }
    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    function onSnapEnd () {
      board.position(game.fen(), useAnimation=true)
    }

    function updateStatus () {
      var status = ''

      var moveColor = 'White'
      if (game.turn() === 'b') {
        moveColor = 'Black'
      }

      // checkmate?
      if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.'
      }

      // draw?
      else if (game.in_draw()) {
        status = 'Game over, drawn position'
      }

      // game still on
      else {
        status = moveColor + ' to move'

        // check?
        if (game.in_check()) {
          status += ', ' + moveColor + ' is in check'
        }
      }

      $status.html(status)
      $fen.html(game.fen())
      $pgn.html(game.pgn())
    }


    (function($) {
        "use strict";

    
    jQuery.validator.addMethod('answercheck', function (value, element) {
        return this.optional(element) || /^\bcat\b$/.test(value)
    }, "type the correct answer -_-");

    // validate contactForm form
    $(function() {
        $('#contactForm').validate({
            rules: {
                name: {
                    required: true,
                    minlength: 2
                },
                subject: {
                    required: true,
                    minlength: 4
                },
                number: {
                    required: true,
                    minlength: 5
                },
                email: {
                    required: true,
                    email: true
                },
                message: {
                    required: true,
                    minlength: 20
                }
            },
            messages: {
                name: {
                    required: "come on, you have a name, don't you?",
                    minlength: "your name must consist of at least 2 characters"
                },
                subject: {
                    required: "come on, you have a subject, don't you?",
                    minlength: "your subject must consist of at least 4 characters"
                },
                number: {
                    required: "come on, you have a number, don't you?",
                    minlength: "your Number must consist of at least 5 characters"
                },
                email: {
                    required: "no email, no message"
                },
                message: {
                    required: "um...yea, you have to write something to send this form.",
                    minlength: "thats all? really?"
                }
            },
            submitHandler: function(form) {
                $(form).ajaxSubmit({
                    type:"POST",
                    data: $(form).serialize(),
                    url:"contact_process.php",
                    success: function() {
                        $('#contactForm :input').attr('disabled', 'disabled');
                        $('#contactForm').fadeTo( "slow", 1, function() {
                            $(this).find(':input').attr('disabled', 'disabled');
                            $(this).find('label').css('cursor','default');
                            $('#success').fadeIn()
                            $('.modal').modal('hide');
		                	$('#success').modal('show');
                        })
                    },
                    error: function() {
                        $('#contactForm').fadeTo( "slow", 1, function() {
                            $('#error').fadeIn()
                            $('.modal').modal('hide');
		                	$('#error').modal('show');
                        })
                    }
                })
            }
        })
    })
        
 })(jQuery)
})
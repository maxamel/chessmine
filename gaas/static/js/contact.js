$(document).ready(function(){


    var timeintervalA = null
    var timeintervalB = null
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

    function setTime(id, endtime) {
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

    var data = localStorage.getItem("chess_info")
    var socket = io('http://localhost:5000/connect');

    socket.on('connection_id', function (ans) {
        localStorage.setItem("chess_info", JSON.stringify(ans.user))
        data = localStorage.getItem("chess_info")
    });
    socket.on('game_over', function (ans) {
        alert(JSON.stringify(ans))
        clearInterval(timeintervalA)
        clearInterval(timeintervalB)
    });
    socket.on('game', function (ans) {
        my_color = JSON.stringify(ans.color)
        the_game = ans.game
        my_time = JSON.stringify(the_game.white_remaining)
        rival_time = JSON.stringify(the_game.black_remaining)
        me = the_game.white
        rival = the_game.black
        my_color = my_color.slice(1, -1);
        if (my_color === "black") {        // swap
            my_time = [rival_time, rival_time=my_time][0];
            me = [rival, rival=me][0]
        }
        the_game_fen = the_game.position
        obj = JSON.parse(data)
        player_id = obj.sid
        document.getElementById("labelTitleA").innerText = rival["name"]
        document.getElementById("labelRatingA").innerText = rival["rating"]
        document.getElementById("labelTitleASmall").innerText = rival["name"]
        document.getElementById("labelRatingASmall").innerText = rival["rating"]
        document.getElementById("labelTitleB").innerText = obj.name
        document.getElementById("labelRatingB").innerText = obj.rating
        document.getElementById("labelTitleBSmall").innerText = obj.name
        document.getElementById("labelRatingBSmall").innerText = obj.rating
        document.getElementById("playerInfoA").style.visibility = "visible"
        document.getElementById("playerInfoB").style.visibility = "visible"
        var panes = document.getElementsByClassName("clock")
        for (var pane of panes) {
            pane.style.opacity = 1
        }
        document.getElementById("gameBox").style.opacity = 1
        document.getElementById("ldbar").style.opacity = 0
        setTime('clockdivA', rival_time)
        setTime('clockdivB', my_time)

        fenobj = Chessboard.fenToObj(the_game_fen)
        var config = {
              pieceTheme: 'static/img/chesspieces/chess24/{piece}.png',
              draggable: true,
              position: the_game_fen,
              orientation: my_color,
              onDragStart: onDragStart,
              onDrop: onDrop,
              //onMoveEnd: onMoveEnd,
              onMouseoutSquare: onMouseoutSquare,
              onMouseoverSquare: onMouseoverSquare,
              onSnapEnd: onSnapEnd
        }
        board = Chessboard('myBoard', config)

        isStart = the_game_fen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        if (!isStart) {
            game = new Chess(the_game_fen)
            turn = game.turn()
            mine = my_color.charAt(0)
            if (turn === mine) {
                initializeClock('clockdivB', my_time);
            } else {
                initializeClock('clockdivA', rival_time);
            }
        }

        function myFunction(x) {
          if (x.matches) { // If media query matches
            board.resize()
          }
          else {
            board.resize()
          }
        }

        var x = window.matchMedia("(max-width: 1105px)")
        //myFunction(x) // Call listener function at run time
        x.addEventListener("change", myFunction) // Attach listener function on state changes
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
                "sid": player_id,
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
    res = socket.emit('connection', {"data": data}, function(ans) {
            var progress = 0
            var bar = new ldBar("#ldbar");
            // repeat with the interval of 2 seconds
            let timerId = setInterval(function() {
                    bar.set(progress + 2);
                    progress += 2;
                }, 100
            );
            // after 10 seconds stop
            setTimeout(() => {
                clearInterval(timerId);
            }, 8000);
    })


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
      else if (futureMove == true && source == target) {
          futureMove = false
          futureMoveData = null
      }
      removeGreySquares()
      // illegal move
        updateStatus()
        var json = {
            "sid": player_id,
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
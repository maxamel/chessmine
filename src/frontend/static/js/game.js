import { getPieceFuncByName, getBoardColorsByName } from './utils.js';
import { initializeClock, setTime, discardTimeInterval, setClockGlow } from './clock.js'
import { stockfish_load, stockfish_move } from './stockfish_handler.js';

$(document).ready(function () {
    load_cookies()

    var moveInterval = null;
    var board = null;
    var $board = $("#myBoard");
    var game = new Chess();
    var futureMove = false;
    var futureMoveData = null;
    var player_id = null;
    var other_remaining = 300000;
    var my_color = null;
    var needsBoardRendering = false;
    var boardTheme = "metro";
    var pieceTheme = "metro";
    var timeControl = "5+0";
    var queenAutopromote = false;
    var highlightMoves = false;
    var the_game_moves = [];
    var the_game_fens = [];
    var promotion_in_progress = [];
    var promote = "q";
    var game_over = false;
    var last_call = null;
    var heartbeatOK = false;
    var abort_button = null;
    var attached_listeners = false;
    var engine = null;       // stockfish instance
    var engine_sid = null;   // for engine play only

    var prefs = localStorage.getItem("user_prefs");
    var cookie_data = localStorage.getItem("user_session");
    var socket = io("APP_URL/connect", {
        transports: ["websocket", "polling"],
        rememberUpgrade: true,
        timestampParam: "timestamp",
        retries: 2,
        tryAllTransports: true
    });

    var cancel = document.getElementById("cancelSearch");
    cancel.addEventListener("click", function(evt) {
        var json = {
            "data": {
                "sid": player_id,
                "time_control": timeControl
            }
        };
        socket.emit("/api/cancelSearch", json, function (ret) {
            if (ret === 0) {
                evt.target.style.opacity = 0.5;
                evt.target.style.pointerEvents = 'none';
            } else {
                window.location.href = "/settings";
            }
        });
    });

    socket.on("game_over", function (ans) {
        console.log("Game Over")
        console.log(JSON.stringify(ans))
        game_over = true;
        discardTimeInterval('all');
        disableGameButtons();
        //update_ratings(ans);
        showEndGame(ans.winner, ans.message);
        setRatings(ans);
    });

    function handle_engine_init (rival, the_game, the_game_fen, rating) {
        if (rival.player_type == 1) {   // rival is engine
            // lazy initialization of stockfish
            engine_sid = the_game.engine_sid
            console.log(game.fen());
            engine = stockfish_load(game.fen(), rating)
            console.log(`The current position ${the_game_fen}`)
            engine.onmessage = function (line) {
                //console.log(line);
                var responseWords = line.split(' ')
                if (responseWords[0] === 'bestmove') {
                    // make move to get full structure of chess move and then undo. This move will be processed
                    // properly nce it goes through the server and back
                    var preetified_engine_move = game.move(responseWords[1])
                    game.undo()
                    var json = {
                        'sid': engine_sid,
                        'move': preetified_engine_move
                    }
                    console.log('Sending move on behalf of engine with payload: ' + JSON.stringify(json))
                    socket.emit('/api/move', json, function (ret) {
                        console.log('Sent engine move ' + JSON.stringify(preetified_engine_move))
                        console.log('Response to engine move: ' + JSON.stringify(ret))
                    })
                }
            }
        }
    }

    socket.on("game", function (ans) {
        load_cookies();
        console.log(ans)
        my_color = JSON.stringify(ans.color);
        var the_game = ans.game;
        var my_time = JSON.stringify(the_game.white.time_remaining);
        var rival_time = JSON.stringify(the_game.black.time_remaining);
        var ttl_time = JSON.stringify(the_game.move_ttl);
        var draw_offer = the_game.draw_offer
        var game_status = the_game.status;
        var me = the_game.white;
        var rival = the_game.black;
        var the_game_fen = the_game.position;
        if (parseInt(rival_time) === 0 || parseInt(my_time) === 0 || game_status === 3) {
            game_over = true;
        }
        my_color = my_color.slice(1, -1);       // remove quotes from both sides
        if (my_color === "black") {        // swap objects
            my_time = [rival_time, rival_time = my_time][0];
            me = [rival, rival = me][0];
        }

        the_game_moves = JSON.parse(the_game.moves);
        the_game_fens = JSON.parse(the_game.fens);
        player_id = cookie_data.sid;

        document.getElementById("labelTitleA").innerText = rival["name"];
        document.getElementById("labelRatingA").innerText = rival["rating"];
        document.getElementById("labelTitleASmall").innerText = rival["name"];
        document.getElementById("labelRatingASmall").innerText = rival["rating"];
        document.getElementById("labelTitleB").innerText = me.name;
        document.getElementById("labelRatingB").innerText = me.rating;
        document.getElementById("labelTitleBSmall").innerText = me.name;
        document.getElementById("labelRatingBSmall").innerText = me.rating;
        document.getElementById("playerInfoA").style.visibility = "visible";
        document.getElementById("playerInfoB").style.visibility = "visible";
        var panes = document.getElementsByClassName("clock");
        for (var pane of panes) {
            pane.style.opacity = 1;
        }
        document.getElementById("gameBox").style.opacity = 1;
        setTime("clockdivA", rival_time);
        setTime("clockdivB", my_time);

        var config = {
            pieceTheme: "../img/chesspieces/" + pieceTheme + "/{piece}.png",
            boardTheme: getBoardColorsByName(boardTheme),
            draggable: true,
            position: the_game_fen,
            orientation: my_color,
            onDragStart: onDragStart,
            onDrop: onDrop,
            //onMoveEnd: onMoveEnd,
            onDragMove: onDragMove,
            onMouseoutSquare: onMouseoutSquare,
            onMouseoverSquare: onMouseoverSquare,
            onSnapEnd: onSnapEnd,
        };
        board = Chessboard("myBoard", config);
        game = new Chess(the_game_fen);
        insertBulkMoves(the_game_moves, ttl_time);

        handle_engine_init(rival, the_game, the_game_fen, me.rating)

        var isStart = the_game_moves.length < 2;
        if (!isStart) abort_button = false;

        if (game_status != 3) {     // NOT ENDED
            if (!attached_listeners) {
                window.onclick = function(event) {
                  if (event.target.id != 'drawOfferedButton') {
                      var inner_div = document.getElementById("droppedDrawOffer");
                      inner_div.style.display = "none";
                  }
                };

                attachPromotionListeners();

                var draw = document.getElementById("drawButton");
                draw.addEventListener("click", drawAction);

                var resign = document.getElementById("resignButton");
                resign.addEventListener("click", resignAction);

                var abort = document.getElementById("abortButton");
                abort.addEventListener("click", abortAction);

                var offeredDraw = document.getElementById("drawOffer");
                offeredDraw.addEventListener("click", offeredDrawAction);

                var acceptDraw = document.getElementById("acceptDraw");
                acceptDraw.addEventListener("click", drawAction);

                var declineDraw = document.getElementById("declineDraw");
                declineDraw.addEventListener("click", declineDrawAction);
                attached_listeners = true;
            }

            hideArrows();
            enableGameButtons();

            if (my_color == draw_offer) {
                // I offered draw
                changeDrawButton('disabled');
            } else if (draw_offer != null){
                // Rival offered draw
                changeDrawButton('hidden');
            }

            if (game_status == 2) {     // PLAYING
                if (is_my_turn()) {
                    discardTimeInterval('A');
                    initializeClock("clockdivB", my_time);
                } else {
                    discardTimeInterval('B');
                    initializeClock("clockdivA", rival_time);
                }
            } else if (game_status == 1) {      // STARTED
                game_over = false;
                hideEndGameBoxes();
            }
        } else {
            console.log("BUDDY " + JSON.stringify(the_game.end_game_info));
            setRatings(the_game.end_game_info);
            disableGameButtons();
        }

        var rematches = document.getElementsByClassName("button-box");
        for (var t = 0; t < rematches.length; t++) {
            var rematch = rematches.item(t);
            rematch.addEventListener("click", rematchAction);
        }
        var dots = document.getElementsByClassName("dot");
        for (var t = 0; t < dots.length; t++) {
            var dot = dots.item(t);
            dot.addEventListener("click", function (evt) {
                evt.target.parentElement.style.display = "none";
                var json = {
                    "data": {
                        "sid": player_id,
                        "flag": false
                    }
                };
                socket.emit("/api/rematch", json, function (ret) {
                    updateLastCall();
                });
            });
        }

        var x = window.matchMedia("(max-width: 1105px)");
        //myFunction(x) // Call listener function at run time
        x.addEventListener("change", boardResize); // Attach listener function on state changes
        heartbeatOK = true;
        $(".fullpage").fadeOut("slow");


        function rematchAction(x) {
            const json = {
                'data': {
                    'sid': player_id,
                    'flag': true
                }
            }
            socket.emit("/api/rematch", json, function (ret) {
                if (ret) {
                    changeRematchButton('disabled')
                }
            });
        }

        function attachPromotionListeners(){
            var conts = document.getElementsByClassName("themeContainer");
            for (var c = 0; c < conts.length; c++) {
                conts[c].addEventListener("click", function (event) {
                    var elem = event.srcElement;
                    while (elem.className != "themeContainer") {
                        elem = elem.parentElement;
                    }
                    if (elem.parentElement.id === "promotion") {
                        $("#promotion .themeContainer").css("color", "white");
                        $("#promotion .themeContainer").css("backgroundColor", "");
                        $("#promotion .themeContainer").css("fontWeight", "");
                        elem.style.backgroundColor = "#bdcad8";
                        elem.style.color = "black";
                        elem.style.fontWeight = "bold";
                        elem.parentElement.style.display = "none";
                        var gc = document.getElementById("gameBox");
                        gc.style.opacity = 1;
                        promote = elem.id;
                        onDrop(promotion_in_progress[0], promotion_in_progress[1]);
                        console.log('Rerendering board position');
                        board.position(game.fen(), true);
                        promotion_in_progress = [];
                    }
                    elem.style.border = "3px solid #fc5185";
                    elem.style.color = "white";
                    elem.style.fontWeight = "bolder";
                }, false);
            }
        }

        function drawAction(x) {
            var json = {"data": {
                    "sid": player_id,
                    "flag": true
                }};
            socket.emit("/api/draw", json, function (ret) {
                if (ret) {
                    updateLastCall();
                    changeDrawButton('disabled')
                }
            });
        }
        function declineDrawAction(x) {
            var json = {"data": {
                    "sid": player_id,
                    "flag": false
                }};
            socket.emit("/api/draw", json, function (ret) {
                if (ret) {
                    updateLastCall();
                    changeDrawButton('enabled')
                }
            });
        }

        function offeredDrawAction(x) {
            var inner_div = document.getElementById("droppedDrawOffer");
            inner_div.style.display = "block";
        }

        function resignAction(x) {
            var json = {"data": {
                    "sid": player_id
                }};
            socket.emit("/api/resign", json, function (ret) {
                if (ret) {
                    updateLastCall();
                }
            });
        }

        function abortAction(x) {
            var json = {"data": {
                    "sid": player_id
            }};
            socket.emit("/api/abort", json, function (ret) {
                if (ret) {
                    updateLastCall();
                    x = document.getElementById("abortButton")
                    x.style.opacity = 0.5;
                    x.style.pointerEvents = 'none';
                }
            });
        }

        function boardResize(x) {
            console.log('called board resize');
            if (x.matches) { // If media query matches
                board.resize();
            } else {
                board.resize();
            }
        }
    });

    socket.on("draw", function (ans) {
        if (ans.color === my_color) {
            // Got my own draw offer back
            if (ans.flag == 1) {    // I offered draw
                changeDrawButton('disabled')
            } else {                // I declined draw
                console.log("Got Draw that I declined")
                changeDrawButton('enabled')
            }
        } else {
            if (ans.flag == 1) {    // Draw offer
                console.log("Got Draw offered to me")
                changeDrawButton('hidden');
            } else {                  // My draw offer declined
                console.log("Got Draw declined to me")
                changeDrawButton('enabled')
            }
        }
    });

    socket.on("rematch", function (ans) {
        console.log("Got Rematch " + ans.flag)
        if (ans.color === my_color) {
            // Got my own rematch offer back
            if (ans.flag == 4) {    // I offered rematch
                changeRematchButton('disabled')
            } else if (ans.flag == 5) {    // Rematch agreed
                heartbeatOK = false;
                heartbeat(true);
            }
        } else {
            if (ans.flag == 4) {    // Rematch offered to me
                changeRematchButton('glow');
            } else if (ans.flag == 6) {    // Rematch declined
                changeRematchButton('disabled');
            } else if (ans.flag == 5) {    // Rematch agreed
                heartbeatOK = false;
                heartbeat(true);
            }
        }
    });

    function handleMoveOnBoard(the_move) {
        // chessboard.js doesn't handle castling, en-passant and pawn promotion correctly.
        if (the_move.san === 'O-O-O' ||
          the_move.san === 'O-O' ||
          the_move.san.indexOf('=') > -1 ||
          (the_move.san.indexOf('x') > -1 && the_move.flags == 'e')
        ) {
            console.log('Called board positioning while move handling');
            board.position(game.fen(), true)
        }
        else {
            board.move(the_move.from + '-' + the_move.to)
        }
    }

    function highlight_check_mate() {
        var array = 0
        if (game.isCheckmate()) {
            array = get_piece_positions(game, { type: 'k', color: game.turn() })
            let source = array[0]
            $board.find('.square-' + source).addClass('highlight-mate')
            game_over = true
        } else if (game.inCheck()) {
            array = get_piece_positions(game, { type: 'k', color: game.turn() })
            let source = array[0]
            $board.find('.square-' + source).addClass('highlight-check')
        }
    }

    socket.on("move", function (ans) {
        var the_move = ans.move;
        console.log('Got move data ' + JSON.stringify(ans));
        if (game.turn() != the_move.color) {
            return;      // Got my own move back
        }
        game.move(the_move.san);

        handleMoveOnBoard(the_move);
        removeCheck();
        insertMove(the_move);
        changeDrawButton('enabled');
        if (ans.remaining) {
            if (my_color.charAt(0) == the_move.color) {
                other_remaining = ans.remaining;
                initializeClock("clockdivA", ans.remaining);
                discardTimeInterval('B');
                setTime("clockdivB", ans.other_remaining);
            } else {
                other_remaining = ans.other_remaining;
                initializeClock("clockdivB", ans.remaining);
                discardTimeInterval('A');
                setTime("clockdivA", ans.other_remaining);
            }
        }
        var array = get_piece_positions(game, {type: "k", color: game.turn()});
        var source = array[0];
        if (game.isCheckmate()) {
            $board.find(".square-" + source).addClass("highlight-mate");
            game_over = true;
            return;
        } else if (game.inCheck()) {
            $board.find(".square-" + source).addClass("highlight-check");
        }
        // handle future move
        if (futureMoveData != null) {
            if (handlePromotion(futureMoveData.from, futureMoveData.to)) {
                futureMoveData = null;
                return;
            }
            var move = gameMove(futureMoveData.from, futureMoveData.to, promote);
            if (move != null) {
                var json = {
                    "sid": player_id,
                    "move": move
                };
                socket.emit("/api/move", json, function (ret) {
                    updateLastCall();
                    if (ret == null) {      // In case this move is illegal we should abort
                        game.undo();
                        heartbeat(true);
                        futureMoveData = null;
                        return;
                    }
                    if (ret.remaining) {
                        discardTimeInterval('B');
                        setTime("clockdivB", ret["other_remaining"]);
                        initializeClock("clockdivA", ret["remaining"]);
                    }
                    insertMove(move);
                    changeDrawButton('enabled');
                    handleMoveOnBoard(move);
                    highlight_check_mate();

                    if (engine) {
                        console.log('Generating engine move after future move: ' + move.lan);
                        stockfish_move(game.fen());
                    }
                });
            }
            removeHighlights();
            futureMoveData = null;
        }
    });

    heartbeat();
    setInterval(heartbeat, 3000, false);

    function hideEndGameBoxes() {
        document.getElementById("conty").style.display = "none";
        document.getElementById("draw-box").style.display = "none";
        document.getElementById("win-box").style.display = "none";
        document.getElementById("lose-box").style.display = "none";
        document.getElementById("abort-box").style.display = "none";
    }

    function showEndGame(color_win, msg) {

        var y = document.getElementById("conty");
        y.style.display = "block";
        console.log(color_win + " " + my_color);
        var x = null;
        if (color_win === 'Draw') {
            x = document.getElementById("draw-box");
            x.style.display = "block";
        } else if (color_win === 'Abort') {
            x = document.getElementById("abort-box");
            x.style.display = "block";
        } else if (my_color === color_win) {
            x = document.getElementById("win-box");
            x.style.display = "block";
        } else {
            x = document.getElementById("lose-box");
            x.style.display = "block";
        }
        changeRematchButton('enabled');
        for (var r = 0; r < x.children.length; r++) {
            if (x.children[r].className === 'message') {
                var message = x.children[r];
                for (var t = 0; t < message.children.length; t++) {
                    if (message.children[t].tagName === 'P') {
                        message.children[t].innerHTML = msg;
                        break;
                    }
                }
            }
            if (x.children[r].className.includes('experiment')) {
                var exp = x.children[r];
                for (var t = 0; t < exp.children.length; t++) {
                    if (exp.children[t].className === 'endgame') {
                        if (my_color === 'black')
                            exp.children[t].innerHTML = "&#x265A;";
                        else
                            exp.children[t].innerHTML = "&#x2654;";
                        break;
                    }
                }
            }
        }
    }

    function updateLastCall() {
        last_call = new Date().getTime();
    }

    function hideArrows() {
        document.getElementById("arrowRatingA").style.display = "none";
        document.getElementById("arrowRatingB").style.display = "none";
    }

    function setRatings(dict) {
        if (my_color == "white") {      // I'm white
            console.log("Setting ratings as white")
            if (dict.black_rating_delta > 0) {
                console.log("RED")
                setRating("arrowRatingA", "labelRatingA", "up", dict.black_rating, dict.black_rating_delta);
                setRating("arrowRatingB", "labelRatingB", "down", dict.white_rating, dict.white_rating_delta);
            } else if (dict.black_rating_delta < 0) {
                console.log("BLUE")
                setRating("arrowRatingB","labelRatingB", "up", dict.white_rating, dict.white_rating_delta);
                setRating("arrowRatingA", "labelRatingA", "down", dict.black_rating, dict.black_rating_delta);
            } else console.log("PINK")
        } else {    // I'm black
            console.log("Setting ratings as black")
            if (dict.white_rating_delta > 0) {
                setRating("arrowRatingA", "labelRatingA", "up", dict.white_rating, dict.white_rating_delta);
                setRating("arrowRatingB", "labelRatingB", "down", dict.black_rating, dict.black_rating_delta);
            } else if (dict.white_rating_delta < 0) {
                setRating("arrowRatingB", "labelRatingB", "up", dict.black_rating, dict.black_rating_delta);
                setRating("arrowRatingA", "labelRatingA", "down", dict.white_rating, dict.white_rating_delta);
            }
        }
    }

    function setRating(arrow, label, orient, rating, delta) {
        document.getElementById(arrow).style.display = "inline-block";
        if (orient == 'up') {
            document.getElementById(arrow).innerHTML = "&#x2197(+" + delta +")";
            document.getElementById(arrow).style.color = "green";
        } else if (orient == 'down') {
            document.getElementById(arrow).innerHTML = "&#x2198(" + delta +")";
            document.getElementById(arrow).style.color = "crimson";
        }
        document.getElementById(label).innerHTML = rating;
    }

    function disableGameButtons() {
        var x = document.getElementById("resignButton");
        x.style.display = 'block';
        x.style.opacity = 0.5;
        x.style.pointerEvents = 'none';

        x = document.getElementById("drawButton");
        x.style.display = 'block';
        x.style.opacity = 0.5;
        x.style.pointerEvents = 'none';

        x = document.getElementById("drawOffer");
        x.style.display = 'none';
        var inner_div = document.getElementById("droppedDrawOffer");
        inner_div.style.display = "none";

        x = document.getElementById("abortButton");
        x.style.display = 'none';
        x.style.pointerEvents = 'none';
    }
    function enableGameButtons() {
        console.log("About to enable buttons " + the_game_moves.length + " " + abort_button);
        if (the_game_moves.length > 1) {
            var x = document.getElementById("abortButton");
            x.style.display = 'none';
            x.style.pointerEvents = 'none';

            x = document.getElementById("resignButton");
            x.style.display = 'block';
            x.style.opacity = 1;
            x.style.pointerEvents = '';

            x = document.getElementById("drawButton");
            x.style.display = 'block';
            x.style.opacity = 1;
            x.style.pointerEvents = '';

            abort_button = false;
        } else {
            x = document.getElementById("drawButton");
            x.style.display = 'none';
            x.style.pointerEvents = 'none';

            x = document.getElementById("resignButton");
            x.style.display = 'none';
            x.style.pointerEvents = 'none';

            x = document.getElementById("abortButton");
            x.style.display = 'block';
            x.style.opacity = 1;
            x.style.pointerEvents = '';

            abort_button = true;
        }

        x = document.getElementById("drawOffer");
        x.style.display = 'none';
        var inner_div = document.getElementById("droppedDrawOffer");
        inner_div.style.display = "none";

    }

    function changeRematchButton(status) {
        var buttons = document.getElementsByClassName("button-box");
        for (var d=0; d<buttons.length; d++)
        {
            var x = buttons.item(d);
            if (status === 'enabled') {
                x.style.display = 'block';
                x.style.opacity = 1;
                x.style.pointerEvents = '';
            } else if (status === 'disabled') {
                x.style.display = 'block';
                x.style.opacity = 0.5;
                x.style.pointerEvents = 'none';
                x.style.animation = '';
            } else if (status === 'glow') {
                x.style.display = 'block';
                x.style.opacity = 1;
                x.style.pointerEvents = '';
                x.style.animation = "scale 1s ease-in infinite"
            }
        }
    }

    function changeDrawButton(status) {
        if (!abort_button) {
            var x = document.getElementById("drawButton");
            if (status === 'enabled') {
                x.style.display = 'block';
                x.style.opacity = 1;
                x.style.pointerEvents = '';
                var offeredButton = document.getElementById("drawOffer");
                offeredButton.style.display = "none";
                var inner_div = document.getElementById("droppedDrawOffer");
                inner_div.style.display = "none";
            } else if (status === 'disabled') {
                x.style.display = 'block';
                x.style.opacity = 0.5;
                x.style.pointerEvents = 'none';
                offeredButton = document.getElementById("drawOffer");
                offeredButton.style.display = "none";
                inner_div = document.getElementById("droppedDrawOffer");
                inner_div.style.display = "none";
            } else if (status === 'hidden') {
                x.style.display = 'none';
                offeredButton = document.getElementById("drawOffer");
                offeredButton.style.display = "block";
            }
        }
    }

    function insertMove(move) {
        var index = 0;
        if (game.turn() === "b") {
            document.getElementById("moveTable").insertRow(-1);
        } else {
            index = 2;
        }
        //moveList.push(move.san);
        the_game_fens.push(game.fen());
        the_game_moves.push(move.san);
        if (abort_button)
            enableGameButtons();
        handle_move(move.san, index, 30000, true);
    }

    function insertBulkMoves(moves, ttl) {
        var table = document.getElementById("moveTable");
        var rowCount = table.rows.length;
        for (var i = 0; i < rowCount; i++) {
            table.deleteRow(-1);
        }
        let index = 0;
        //moveList = moves;
        for (var i = 0; i < moves.length; i++) {
            if (i % 2 == 0) {
                index = 0;
                document.getElementById("moveTable").insertRow(-1);
            } else {
                index = 2;
            }
            handle_move(moves[i], index, ttl, moves.length == 1);
        }
    }

    function insert_counter_cell(index, ttl) {
        var num_rows = document.getElementById("moveTable").rows.length;
        var cell = document.getElementById("moveTable").rows[num_rows - 1].insertCell(index);
        cell.innerHTML = Math.floor(ttl / 1000);
        cell.setAttribute("class", "timeCell");
        clearInterval(moveInterval);
        moveInterval = setInterval(function () {
            cell.innerHTML = cell.innerHTML - 1;
            if (cell.innerHTML == 0) {
                console.log("No move was made on time. Game abandoned.");
                clearInterval(moveInterval);
            }
        }, 1000);
    }

    function handle_move(move, index, ttl, isFirstMove) {
        var num_rows = document.getElementById("moveTable").rows.length;
        if (index == 0) {
            cell = document.getElementById("moveTable").rows[num_rows - 1].insertCell(index);
            cell.innerHTML = num_rows;
            cell.setAttribute("class", "edgeCell");
            index++;
        }
        var row = document.getElementById("moveTable").rows[num_rows - 1];
        if (row.cells.length == 3) {        // remove timer cell
            clearInterval(moveInterval);
            document.getElementById("moveTable").rows[num_rows - 1].deleteCell(-1);
        }
        var cell = document.getElementById("moveTable").rows[num_rows - 1].insertCell(index);
        cell.innerHTML = move;
        cell.setAttribute("class", "regularCell");
        cell.addEventListener("click", clickedCell, false);
        if (num_rows == 1 && index == 1 && isFirstMove) {
            index++;
            insert_counter_cell(index, ttl);
        }
        var d = document.getElementById("tableWrapper");
        d.scrollTo(0, d.scrollHeight);
    }

    function clickedCell(cell) {
        var row = cell.srcElement.parentElement.rowIndex;
        var index = cell.srcElement.cellIndex;
        var normalized_index = index - 1;
        var position_in_array = row * 2 + normalized_index;
        var selected_fen = the_game_fens[position_in_array];
        board.position(selected_fen, true);
        $("td").removeClass("selectedCell");
        if (position_in_array < the_game_fens.length - 1) {
            cell.target.classList.add("selectedCell");
            $("#myBoard .square-55d63").removeClass("highlight-check");
            $("#myBoard .square-55d63").removeClass("highlight-mate");
        } else {
            highlight_check_mate();
        }
    }

    function heartbeat(force) {
        var d = new Date();
        console.log("Calling heartbeat at " + d.toLocaleTimeString() + " with hearbeatOK=" + heartbeatOK + " and force=" + force);
        if (!force) {
            var now = new Date().getTime();
            if (now - last_call < 3000) { // In case server has already been contacted in past 3 secs
                return;
            }
        }
        load_cookies();
        var dict = {}
        if (last_call == null || force || !heartbeatOK) {
            console.log("Requesting full heartbeat");
            dict = {"data": cookie_data};
        }
        else {
            var json = {
                "sid": player_id,
                "checkin": true
            };
            dict = {"data": json};
        }
        socket.emit("/api/heartbeat", dict, function (ans) {
            updateLastCall();
            if (ans) {
                console.log("Got heartbeat response " + JSON.stringify(ans))
                document.getElementById("gameBox").style.display = "flex";
                var connect_icons = document.getElementsByClassName("dottop");
                if (ans.rival_connect_status === 2) {
                    for (const icon of connect_icons)
                        icon.style.backgroundColor = "#59fb74"
                } else if (ans.rival_connect_status === 3 && engine_sid != null) {
                    console.log("Rival disconnected")
                    for (const icon of connect_icons)
                        icon.style.backgroundColor = "crimson"
                }
            } else {
                console.log("Got empty heartbeat response. See you next time");
                window.location.href = "/settings";
            }
        });
    }

    function load_cookies() {
        cookie_data = localStorage.getItem("user_session");
        cookie_data = JSON.parse(cookie_data);
        prefs = localStorage.getItem("user_prefs");
        var obj_prefs = JSON.parse(prefs);
        if (cookie_data != null)
            cookie_data.preferences = obj_prefs;
            player_id = cookie_data.sid
        if (cookie_data && obj_prefs != null) {
            boardTheme = obj_prefs.board_theme;
            pieceTheme = obj_prefs.piece_theme;
            timeControl = obj_prefs.time_control;
            queenAutopromote = obj_prefs.queen_autopromote;
            highlightMoves = obj_prefs.highlight_moves;
            setClockGlow(obj_prefs.clock_glow);
        }
    }

    function removeGreySquares() {
        //$('#myBoard .white-1e1d7').css('background', whiteSquare)
        //$('#myBoard .black-3c85d').css('background', blacksquare)
        $("svg").remove();
        $("img").css("box-shadow", "");
    }

    function removeCheck() {
        $("#myBoard .square-55d63").removeClass("highlight-check");
        $("img").css("box-shadow", "");
    }

    function removeHighlights() {
        $("#myBoard .square-55d63").removeClass(Chessboard.CSS.highlight1);
        $("#myBoard .square-55d63").removeClass(Chessboard.CSS.highlight2);
    }

    function changeCursor(square, change) {
        var $square = $("#myBoard .square-" + square);
        var isPiece = false;
        var image = null;
        if ($square.children().length > 0) {
            for (var r = 0; r < $square.children().length; r++) {
                if ($square.children()[r].tagName == "IMG")
                    isPiece = true;
                image = $square.children()[r];
                if (isPiece) {
                    image.style.cursor = change;
                 }
            }
        }
    }

    function greySquare(square) {
        if (!highlightMoves){
            return
        }
        var $square = $("#myBoard .square-" + square);
        var isPiece = false;
        var image = null;
        if ($square.children().length > 0) {
            for (var r = 0; r < $square.children().length; r++) {
                if ($square.children()[r].tagName == "IMG")
                    isPiece = true;
                image = $square.children()[r];
            }
        }
        if (isPiece) {
            image.style.boxShadow = "inset 0 0 6px 3px #fc5185";
        } else {
            var the_square = $square.get()[0];
            var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "50");
            svg.setAttribute("height", "50");
            var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttributeNS(null, "cx", the_square.offsetHeight/2);
            circle.setAttributeNS(null, "cy", the_square.offsetWidth/2);
            circle.setAttributeNS(null, "r", 5);
            //circle.setAttributeNS(null, 'stroke', "red")
            //circle.setAttributeNS(null, 'stroke-width', "3")
            circle.setAttributeNS(null, "fill", "#fc5185");
            circle.setAttributeNS(null, "align", "center");
            svg.appendChild(circle);

            the_square.appendChild(svg);
        }
    }

    function onDragStart(source, piece, position, orientation) {
        // do not pick up pieces if the game is over
        var cut_game_fen = game.fen().substr(0, game.fen().indexOf(" "));
        removeHighlights();
        if (game.isGameOver() || cut_game_fen != board.fen() || promotion_in_progress.length > 0 || game_over) return false;
        if (orientation == "white" && piece.indexOf("b") != -1) return false;
        if (orientation == "black" && piece.indexOf("w") != -1) return false;
        // record future move
        if ((game.turn() === "w" && piece.indexOf("b") !== -1) ||
            (game.turn() === "b" && piece.indexOf("w") !== -1)) {
            futureMove = true;
        }
    }

    function is_my_turn() {
        var turn = game.turn();
        var mine = my_color.charAt(0);
        return turn === mine;

    }

    function gameMove(source, target, promotion) {
        var move = null;
        try {
            move = game.move({
                from: source,
                to: target,
                promotion: promote
            });
        }
        catch (e) {
            console.log(`Detected pre-move since move is invalid:  ${JSON.stringify(move)} `);
        }
        return move;
    }

    function onDrop(source, target) {
        // see if the move is legal
        if (handlePromotion(source, target)) {
            removeHighlights();
            return;
        }
        var move = gameMove(source, target, promote);
        if (futureMove === true && source !== target) {
            futureMove = false;
            futureMoveData = {from: source, to: target};
            const moves = game.moves();
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            game.move(randomMove);
            try {
                game.move(futureMoveData);
                // undo both moves but keep the highlights as it appears to be a legal move
                game.undo();
                game.undo();
            } catch (e) {
                // this move is illegal and should not be counted as a future move
                game.undo();    // undo the random move
                removeHighlights();
                futureMove = false;
                futureMoveData = null;
            }
        } else if (futureMove === true && source === target) {
            futureMove = false;
            futureMoveData = null;
            removeHighlights();
        } else {
            removeHighlights();
        }
        removeGreySquares();
        // illegal move
        updateStatus();
        var json = {
            "sid": player_id,
            "move": move
        };
        if (move != null) {
            removeCheck();

            if (move.san == "O-O-O" ||
                move.san == "O-O" ||
                move.san.indexOf("=") > -1 ||
                (move.san.indexOf("x") > -1 && move.flags == "e")
            ) {
                needsBoardRendering = true;
            }

            socket.emit("/api/move", json, function (ret) {
                updateLastCall();
                insertMove(move);
                highlight_check_mate();
                if (!game_over) {
                    if (ret.remaining) {
                        console.log("Answer from api/move");
                        discardTimeInterval('B');
                        setTime("clockdivB", ret["other_remaining"]);
                        initializeClock("clockdivA", ret["remaining"]);
                    }
                    var offeredButton = document.getElementById("drawOffer");
                    if (offeredButton.style.display != "none") {
                        changeDrawButton('enabled');
                    }
                    // handle engine move if needed
                    if (engine) {
                        console.log('Generating engine move after move: ' + move.lan);
                        stockfish_move(game.fen());
                    }
                }
            });
            return 'drop'
        } else {
            // This was snapped back - rerender
            //needsBoardRendering = true;
            return 'snapback'
        }
    }

    function handlePromotion(source, target) {
        // Handle promotion banner display (only if move is legal)
        // Returns true if this is a valid promotion move and false otherwise
        if (source === undefined || target === undefined) {
            return false;
        }
        var curr_position = Chessboard.fenToObj(game.fen());
        var piece = curr_position[source];
        if (!queenAutopromote && promotion_in_progress.length === 0 && (target[1] === "1" || target[1] === "8" ) && piece[1] === "P") {
            var move = gameMove(source, target, promote);
            if (move != null) {
                if (piece[1] == "P") {
                    promotion_in_progress = [source, target];
                    var pieceType = ["B", "N", "R", "Q"];
                    var themes = document.getElementsByClassName("promotionPieceHolder");
                    for (var t = 0; t < themes.length; t++) {
                        var theme = themes.item(t);
                        var piece_theme = getPieceFuncByName(pieceTheme);
                        my_color.charAt(0);
                        var img = document.createElement("IMG");
                        img.src = piece_theme(my_color.charAt(0) + pieceType[t]);
                        img.style.maxHeight = "100%";
                        img.style.maxWidth = "100%";
                        theme.appendChild(img);
                    }
                    var promotionTab = document.getElementById("promotion");
                    promotionTab.style.display = "flex";
                    var gc = document.getElementById("gameBox");
                    gc.style.opacity = 0.2;
                    game.undo();
                    return true;
                } else {
                    game.undo();
                    return false;
                }
            }
            return false
        }
        return false
    }

    function get_piece_positions(game, piece) {
        return [].concat(...game.board()).map((p, index) => {
            if (p !== null && p.type === piece.type && p.color === piece.color) {
                return index;
            }
        }).filter(Number.isInteger).map((piece_index) => {
            const row = "abcdefgh"[piece_index % 8];
            const column = Math.ceil((64 - piece_index) / 8);
            return row + column;
        });
    }

    function onMouseoverSquare(square, piece, position, orientation) {
        var cut_game_fen = game.fen().substr(0, game.fen().indexOf(" "));
        if (game.isGameOver() || piece == false || cut_game_fen != board.fen() || promotion_in_progress.length > 0 || game_over) return false;
        if (orientation == "white" && piece.indexOf("b") != -1) return false;
        if (orientation == "black" && piece.indexOf("w") != -1) return false;
        changeCursor(square, "grab");
        // get list of possible moves for this square
        var moves = game.moves({
            square: square,
            verbose: true
        });

        // exit if there are no moves available for this square
        if (moves.length === 0) return;
        removeGreySquares();
        // highlight the possible squares for this piece
        for (var i = 0; i < moves.length; i++) {
            if (moves[i].to != "")
                greySquare(moves[i].to);
        }
    }

    function onMouseoutSquare(square, piece) {
        changeCursor(square, "default");
        removeGreySquares();
    }

    function onDragMove (newLocation, oldLocation, source, piece, position, orientation) {
        if (newLocation === 'offboard') {
            changeCursor(newLocation, "no-drop");
        }
    }


    // update the board position after the piece snap
    // for castling, en passant, pawn promotion and illegal moves
    function onSnapEnd(draggedPieceSource, square, draggedPiece) {
        if (needsBoardRendering) {
            board.position(game.fen(), true);
        }
        needsBoardRendering = false;
    }

    function updateStatus() {
        var status = "";

        var moveColor = "White";
        if (game.turn() === "b") {
            moveColor = "Black";
        }

        // checkmate?
        if (game.isCheckmate()) {
            status = "Game over, " + moveColor + " is in checkmate.";
        }

        // draw?
        else if (game.isDraw()) {
            status = "Game over, drawn position";
        }

        // game still on
        else {
            status = moveColor + " to move";

            // check?
            if (game.inCheck()) {
                status += ", " + moveColor + " is in check";
            }
        }
    }
    (jQuery);
});
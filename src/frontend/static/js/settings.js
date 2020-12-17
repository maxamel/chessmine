$(document).ready(function () {
    $(".fullpage").fadeOut("slow");
    var timeintervalA = null;
    var timeintervalB = null;
    var timecolorintervalA = null
    var timecolorintervalB = null
    var moveInterval = null;
    var clockStatus = false;

    ///// CLOCK
    function getTimeRemaining(endtime) {
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

    function setTime(id, endtime) {
        var clock = document.getElementById(id);
        var minutesSpan = clock.querySelector(".minutes");
        var secondsSpan = clock.querySelector(".seconds");
        var millisSpan = clock.querySelector(".millis");
        var t = getTimeRemaining(endtime);
        minutesSpan.innerHTML = ("0" + t.minutes).slice(-2);
        secondsSpan.innerHTML = ("0" + t.seconds).slice(-2);
        millisSpan.innerHTML = ("0" + t.millis).slice(-2);
    }

    function initializeClock(id, endtime) {
        var clock = document.getElementById(id);
        var clockspan = clock.children.item(0);
        var minutesSpan = clock.querySelector(".minutes");
        var secondsSpan = clock.querySelector(".seconds");
        var millisSpan = clock.querySelector(".millis");
        var lastCall = new Date().getTime();

        function changeClockColor() {
            if (clockStatus) {
                clockspan.style.backgroundColor = "#E1ECE0";
                clockspan.style.color = "black";
                clockspan.style.boxShadow = "inset 0px 0px 10px 5px #c2d0c1";
                clockStatus = !clockStatus;
            } else {
                clockspan.style.backgroundColor = "black";
                clockspan.style.boxShadow = "";
                clockspan.style.color = "#E1ECE0";
                clockStatus = !clockStatus;
            }
        }

        function updateClock() {
            now = new Date().getTime();
            endtime -= now - lastCall;
            lastCall = now;
            var t = getTimeRemaining(endtime);
            if (clockGlow) {
                if (t.total < 30000 && id == "clockdivA" && timecolorintervalA == null) {
                    timecolorintervalA = setInterval(function () {
                        changeClockColor();
                    }, 500);
                }
                if (t.total < 30000 && id == "clockdivB" && timecolorintervalB == null) {
                    timecolorintervalB = setInterval(function () {
                        changeClockColor();
                    }, 500);
                }
            }
            if (t.total <= 0) {
                discardTimeInterval('all');

                millisSpan.innerHTML = ("00").slice(-2);
                return;
            }
            minutesSpan.innerHTML = ("0" + t.minutes).slice(-2);
            secondsSpan.innerHTML = ("0" + t.seconds).slice(-2);
            millisSpan.innerHTML = ("0" + t.millis).slice(-2);
        }

        updateClock();
        if (id == "clockdivA") {
            discardTimeInterval('A');
            timeintervalA = setInterval(function () {
                updateClock();
            }, 10);
        } else {
            discardTimeInterval('B');
            timeintervalB = setInterval(function () {
                updateClock();
            }, 10);
        }
    }

    ///// CLOCK
    var board = null;
    var $board = $("#myBoard");
    var game = new Chess();
    //var moveList = [];
    //var $status = $("#status");
    //var $fen = $("#fen");
    //var $pgn = $("#pgn");
    //var whiteSquareGrey = "#a9a9a9";
    //var blackSquareGrey = "#696969";
    //var whiteSquare = "#9e7863";
    //var blacksquare = "#633526";
    var futureMove = false;
    var futureMoveData = null;
    var player_id = null;
    var other_remaining = 300000;
    var my_color = null;
    var needsBoardRendering = false;
    var boardTheme = "classical";
    var pieceTheme = "classical";
    var timeControl = "5+0";
    var queenAutopromote = false;
    var highlightMoves = false;
    var clockGlow = false;
    var the_game_moves = [];
    var the_game_fens = [];
    var promotion_in_progress = [];
    var promote = "q";
    var game_over = false;

    var cookie_data = localStorage.getItem("user_session");
    var socket = io("http://localhost:5000/connect");

    socket.on("connection_id", function (ans) {
        load_cookies();
        data = ans.user;
        prefs = data.preferences;
        delete data.preferences;
        user_data = JSON.stringify(data);
        localStorage.setItem("user_session", user_data);
        cookie_data = user_data;
    });

    /*socket.on("game", function (ans) {
        load_cookies();
        console.log(ans)
        my_color = JSON.stringify(ans.color);
        the_game = ans.game;
        my_time = JSON.stringify(the_game.white.time_remaining);
        rival_time = JSON.stringify(the_game.black.time_remaining);
        ttl_time = JSON.stringify(the_game.move_ttl);
        draw_offer = the_game.draw_offer;
        game_status = the_game.status;
        me = the_game.white;
        rival = the_game.black;
        if (parseInt(rival_time) === 0 || parseInt(my_time) === 0 || game_status === 3) {
            game_over = true;
        }
        my_color = my_color.slice(1, -1);       // remove quotes from both sides
        if (my_color === "black") {        // swap objects
            my_time = [rival_time, rival_time = my_time][0];
            me = [rival, rival = me][0];
        }
        console.log("DRAW OFFER " + my_color + " " + draw_offer)
        if (my_color == draw_offer) {
            // I offered draw
            changeDrawButton('disabled');
        } else if (draw_offer != null){
            // Rival offered draw
            changeDrawButton('hidden');
        }
        the_game_fen = the_game.position;
        the_game_moves = JSON.parse(the_game.moves);
        the_game_fens = JSON.parse(the_game.fens);
        player_id = cookie_data.sid;
        console.log(me)
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

        fenobj = Chessboard.fenToObj(the_game_fen);
        var config = {
            pieceTheme: "static/img/chesspieces/" + pieceTheme + "/{piece}.png",
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
            onSnapEnd: onSnapEnd
        };
        board = Chessboard("myBoard", config);
        game = new Chess(the_game_fen);
        insertBulkMoves(the_game_moves, ttl_time);
        isStart = my_time === rival_time && my_time % 1000 == 0;
        if (game_status != 3) {     // NOT ENDED
            draw = document.getElementById("drawButton");
            draw.addEventListener("click", drawAction);

            resign = document.getElementById("resignButton");
            resign.addEventListener("click", resignAction);

            offeredDraw = document.getElementById("drawOffer");
            offeredDraw.addEventListener("click", offeredDrawAction);

            acceptDraw = document.getElementById("acceptDraw");
            acceptDraw.addEventListener("click", drawAction);

            declineDraw = document.getElementById("declineDraw");
            declineDraw.addEventListener("click", declineDrawAction);
            hideArrows();
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
                enableGameButtons();
                hideEndGameBoxes();
            }
        } else {
            disableGameButtons();
        }
        rematches = document.getElementsByClassName("button-box");
        for (var t = 0; t < rematches.length; t++) {
            rematch = rematches.item(t);
            rematch.addEventListener("click", rematchAction);
        }
        dots = document.getElementsByClassName("dot");
        for (var t = 0; t < dots.length; t++) {
            dot = dots.item(t);
            dot.addEventListener("click", function(evt) {
                evt.target.parentElement.style.display = "none";
                json = {"data": {
                    "sid": player_id,
                    "flag": false
                }};
                socket.emit("rematch", json, function (ret) {});
            });
        }
        window.onclick = function(event) {
          if (event.target.id != 'drawOfferedButton') {
              inner_div = document.getElementById("droppedDrawOffer");
              inner_div.style.display = "none";
          }
        };

        var x = window.matchMedia("(max-width: 1105px)");
        //myFunction(x) // Call listener function at run time
        x.addEventListener("change", boardResize); // Attach listener function on state changes
        $(".fullpage").fadeOut("slow");

        function rematchAction(x) {
            json = {"data": {
                    "sid": player_id,
                    "flag": true
                }};
            socket.emit("rematch", json, function (ret) {
                if (ret) {
                    changeRematchButton('disabled')
                }
            });
        }

        function drawAction(x) {
            json = {"data": {
                    "sid": player_id,
                    "flag": true
                }};
            socket.emit("draw", json, function (ret) {
                if (ret) {
                    changeDrawButton('disabled')
                }
            });
        }
        function declineDrawAction(x) {
            json = {"data": {
                    "sid": player_id,
                    "flag": false
                }};
            socket.emit("draw", json, function (ret) {
                if (ret) {
                    changeDrawButton('enabled')
                }
            });
        }

        function offeredDrawAction(x) {
            inner_div = document.getElementById("droppedDrawOffer");
            inner_div.style.display = "block";
        }

        function resignAction(x) {
            json = {"data": {
                    "sid": player_id
                }};
            socket.emit("resign", json, function (ret) {
                if (ret != null) {
                }
            });
        }

        function boardResize(x) {
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
                changeDrawButton('enabled')
            }
        } else {
            if (ans.flag == 1) {    // Draw offer
                changeDrawButton('hidden');
            } else {                  // My draw offer declined
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
            }
        } else {
            if (ans.flag == 4) {    // Rematch offered to me
                changeRematchButton('glow');
            } else if (ans.flag == 6) {    // Rematch declined
                changeRematchButton('disabled');
            }
        }
    });
    socket.on("move", function (ans) {
        ans = JSON.parse(ans);
        the_move = ans.move;
        if (game.turn() != the_move.color) {
            return;      // Got my own move back
        }
        game.move(the_move.san);
        // chessboard.js doesn't handle castling, en-passant and pawn promotion correctly.
        if (the_move.san == "O-O-O" ||
            the_move.san == "O-O" ||
            the_move.san.indexOf("=") > -1 ||
            (the_move.san.indexOf("x") > -1 && the_move.flags == "e")
        )
            board.position(game.fen(), useAnimation = true);
        else
            board.move(the_move.from + "-" + the_move.to);

        removeCheck()
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
        array = get_piece_positions(game, {type: "k", color: game.turn()});
        source = array[0];
        if (game.in_checkmate()) {
            $board.find(".square-" + source).addClass("highlight-mate");
            game_over = true;
            return;
        } else if (game.in_check()) {
            $board.find(".square-" + source).addClass("highlight-check");
        }
        if (futureMoveData != null) {
            if (handlePromotion(futureMoveData.from, futureMoveData.to)) {
                return;
            }
            var move = game.move({
                from: futureMoveData.from,
                to: futureMoveData.to,
                promotion: promote // NOTE: always promote to a queen for simplicity
            });
            var json = {
                "sid": player_id,
                "move": move
            };
            if (move != null) {
                socket.emit("move", json, function (ret) {
                    if (ret == null) {      // In case this move is illegal we should abort
                        game.undo();
                        heartbeat();
                        return;
                    }
                    ret = JSON.parse(ret);
                    insertMove(move);
                    changeDrawButton('enabled');
                    if (ret.remaining) {
                        discardTimeInterval('B');
                        setTime("clockdivB", ret["other_remaining"]);
                        initializeClock("clockdivA", ret["remaining"]);
                    }
                    if (move.san == "O-O-O" ||
                        move.san == "O-O" ||
                        move.san.indexOf("=") > -1 ||
                        (move.san.indexOf("x") > -1 && move.flags == "e")
                    )
                        board.position(game.fen(), useAnimation = true);
                    else
                        board.move(move.from + "-" + move.to);
                });
            }

            removeHighlights("yellow");
            futureMoveData = null;
        }
    });
    alert("HEARTBEAT");
    heartbeat();

    function hideEndGameBoxes() {
        y = document.getElementById("conty");
        y.style.display = "none";
        x = document.getElementById("draw-box");
        x.style.display = "none";
        x = document.getElementById("win-box");
        x.style.display = "none";
        x = document.getElementById("lose-box");
        x.style.display = "none";
    }

    function discardTimeInterval(str) {
        if (str === 'B') {
            clearInterval(timeintervalB);
            clearInterval(timecolorintervalB);
            clock = document.getElementById("clockdivB");
            clockspan = clock.children.item(0);
            clockspan.style.color = "black";
            clockspan.style.backgroundColor = "#E1ECE0";
            clockspan.style.boxShadow = "inset 0px 0px 10px 5px #c2d0c1";
            timecolorintervalB = null;
        }
        else if (str === 'A') {
            clearInterval(timeintervalA);
            clearInterval(timecolorintervalA);
            clock = document.getElementById("clockdivA");
            clockspan = clock.children.item(0);
            clockspan.style.color = "black";
            clockspan.style.backgroundColor = "#E1ECE0";
            clockspan.style.boxShadow = "inset 0px 0px 10px 5px #c2d0c1";
            timecolorintervalA = null;
        }
        else {
            clearInterval(timeintervalA);
            clearInterval(timecolorintervalA);
            timecolorintervalA = null;
            clearInterval(timeintervalB);
            clearInterval(timecolorintervalB);
            timecolorintervalB = null;

            clock = document.getElementById("clockdivA");
            clockspan = clock.children.item(0);
            clockspan.style.color = "black";
            clockspan.style.backgroundColor = "#E1ECE0";

            clock = document.getElementById("clockdivB");
            clockspan = clock.children.item(0);
            clockspan.style.color = "black";
            clockspan.style.backgroundColor = "#E1ECE0";
        }
    }

    function showEndGame(color_win, msg) {
        var y = document.getElementById("conty");
        y.style.display = "block";
        console.log(color_win + " " + my_color);
        var x = null;
        if (color_win === '-') {
            x = document.getElementById("draw-box");
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
                message = x.children[r];
                for (var t = 0; t < message.children.length; t++) {
                    if (message.children[t].tagName === 'P') {
                        message.children[t].innerHTML = msg;
                        break;
                    }
                }
            }
            if (x.children[r].className.includes('experiment')) {
                exp = x.children[r];
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

    function hideArrows() {
        document.getElementById("arrowRatingA").style.display = "none";
        document.getElementById("arrowRatingB").style.display = "none";
    }

    function setRatings(dict) {
        if (my_color == "white") {      // I'm white
            if (parseInt(document.getElementById("labelRatingA").innerHTML) < dict.black_rating) {
                setRating("arrowRatingA", "labelRatingA", "up", dict.black_rating);
                setRating("arrowRatingB", "labelRatingB", "down", dict.white_rating);
            } else if (parseInt(document.getElementById("labelRatingA").innerHTML) > dict.black_rating) {
                setRating("arrowRatingB","labelRatingB", "up", dict.white_rating);
                setRating("arrowRatingA", "labelRatingA", "down", dict.black_rating);
            }
        } else {    // I'm black
            if (parseInt(document.getElementById("labelRatingA").innerHTML) < dict.white_rating) {
                setRating("arrowRatingA", "labelRatingA", "up", dict.white_rating);
                setRating("arrowRatingB", "labelRatingB", "down", dict.black_rating);
            } else if (parseInt(document.getElementById("labelRatingA").innerHTML) > dict.white_rating) {
                setRating("arrowRatingB", "labelRatingB", "up", dict.black_rating);
                setRating("arrowRatingA", "labelRatingA", "down", dict.white_rating);
            }
        }
    }

    function setRating(arrow, label, orient, rating) {
        document.getElementById(arrow).style.display = "inline-block";
        if (orient == 'up') {
            document.getElementById(arrow).innerHTML = "&#x2197";
            document.getElementById(arrow).style.color = "green";
        } else if (orient == 'down') {
            document.getElementById(arrow).innerHTML = "&#x2198";
            document.getElementById(arrow).style.color = "crimson";
        }
        document.getElementById(label).innerHTML = rating;
    }

    function disableGameButtons() {
        x = document.getElementById("resignButton");
        x.style.display = 'block';
        x.style.opacity = 0.5;
        x.style.pointerEvents = 'none';

        x = document.getElementById("drawButton");
        x.style.display = 'block';
        x.style.opacity = 0.5;
        x.style.pointerEvents = 'none';

        x = document.getElementById("drawOffer");
        x.style.display = 'none';
        inner_div = document.getElementById("droppedDrawOffer");
        inner_div.style.display = "none";
    }
    function enableGameButtons() {
        x = document.getElementById("resignButton");
        x.style.display = 'block';
        x.style.opacity = 1;
        x.style.pointerEvents = '';

        x = document.getElementById("drawButton");
        x.style.display = 'block';
        x.style.opacity = 1;
        x.style.pointerEvents = '';

        x = document.getElementById("drawOffer");
        x.style.display = 'none';
        inner_div = document.getElementById("droppedDrawOffer");
        inner_div.style.display = "none";
    }

    function changeRematchButton(status) {
        buttons = document.getElementsByClassName("button-box");
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
        x = document.getElementById("drawButton");
        if (status === 'enabled') {
            x.style.display = 'block';
            x.style.opacity = 1;
            x.style.pointerEvents = '';
            offeredButton = document.getElementById("drawOffer");
            offeredButton.style.display = "none";
            inner_div = document.getElementById("droppedDrawOffer");
            inner_div.style.display = "none";
        }
        else if (status === 'disabled') {
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
    */

    /*
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

    function insertMove(move) {
        index = 0;
        if (game.turn() === "b") {
            document.getElementById("moveTable").insertRow(-1);
        } else {
            index = 2;
        }
        //moveList.push(move.san);
        the_game_fens.push(game.fen());
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
        num_rows = document.getElementById("moveTable").rows.length;
        cell = document.getElementById("moveTable").rows[num_rows - 1].insertCell(index);
        cell.innerHTML = Math.floor(ttl / 1000);
        cell.setAttribute("class", "timeCell");
        clearInterval(moveInterval);
        moveInterval = setInterval(function () {
            cell.innerHTML = cell.innerHTML - 1;
            if (cell.innerHTML == 0) {
                alert("No move was made on time. Game abandoned.");
                clearInterval(moveInterval);
            }
        }, 1000);
    }

    function handle_move(move, index, ttl, isFirstMove) {
        num_rows = document.getElementById("moveTable").rows.length;
        if (index == 0) {
            cell = document.getElementById("moveTable").rows[num_rows - 1].insertCell(index);
            cell.innerHTML = num_rows;
            cell.setAttribute("class", "edgeCell");
            index++;
        }
        row = document.getElementById("moveTable").rows[num_rows - 1];
        if (row.cells.length == 3) {        // remove timer cell
            clearInterval(moveInterval);
            document.getElementById("moveTable").rows[num_rows - 1].deleteCell(-1);
        }
        cell = document.getElementById("moveTable").rows[num_rows - 1].insertCell(index);
        cell.innerHTML = move;
        cell.setAttribute("class", "regularCell");
        cell.addEventListener("click", clickedCell, false);
        if (num_rows == 1 && index == 1 && isFirstMove) {
            index++;
            insert_counter_cell(index, ttl);
        }
        d = document.getElementById("tableWrapper");
        d.scrollTo(0, d.scrollHeight);
    }

    function clickedCell(cell) {
        row = cell.srcElement.parentElement.rowIndex;
        index = cell.srcElement.cellIndex;
        normalized_index = index - 1;
        position_in_array = row * 2 + normalized_index;
        selected_fen = the_game_fens[position_in_array];
        board.position(selected_fen, useAnimation = true);
        $("td").removeClass("selectedCell");
        if (position_in_array < the_game_fens.length - 1) {
            cell.target.classList.add("selectedCell");
        }
    }

    function heartbeat() {
        load_cookies();
        socket.emit("heartbeat", {"data": JSON.stringify(cookie_data)}, function (ans) {
            if (ans) {
                document.getElementById("settingsBox").style.display = "none";
                document.getElementById("gameBox").style.display = "flex";
            } else {
                initSettings();
            }
        });
    }
    */
    function load_cookies() {
        cookie_data = localStorage.getItem("user_session");
        cookie_data = JSON.parse(cookie_data);
        prefs = localStorage.getItem("user_prefs");
        obj_prefs = JSON.parse(prefs);
        if (cookie_data != null)
            cookie_data.preferences = obj_prefs;
        if (cookie_data && obj_prefs != null) {
            boardTheme = obj_prefs.board_theme;
            pieceTheme = obj_prefs.piece_theme;
            timeControl = obj_prefs.time_control;
            queenAutopromote = obj_prefs.queen_autopromote;
            highlightMoves = obj_prefs.highlight_moves;
            clockGlow = obj_prefs.clock_warn;
        }
    }

    function initSettings() {
        // prerequisite is load_cookies
        load_cookies();
        board_themes = [
            urban_board_theme,
            standard_board_theme,
            wiki_board_theme,
            wood_board_theme,
            american_board_theme,
            metro_board_theme,
            classical_board_theme
        ];
        piece_themes = [
            urban_piece_theme,
            standard_piece_theme,
            wiki_piece_theme,
            wood_piece_theme,
            american_piece_theme,
            metro_piece_theme,
            classical_piece_theme,
            alpha_piece_theme,
        ];
        themes = document.getElementsByClassName("themeTable");
        for (var t = 0; t < themes.length; t++) {
            theme = themes.item(t);
            board_theme = board_themes[t];
            for (var j = 0; j < 2; j++) {
                // table row creation
                var row = document.createElement("tr");
                for (var i = 0; i < 2; i++) {
                    var cell = document.createElement("td");
                    if (j == 0) cell.style.backgroundColor = board_theme[i];
                    else cell.style.backgroundColor = board_theme[1 - i];
                    row.appendChild(cell);
                }
                //row added to end of table body
                theme.appendChild(row);
            }
        }
        themes = document.getElementsByClassName("pieceHolder");
        for (var t = 0; t < themes.length; t++) {
            theme = themes.item(t);
            piece_theme = piece_themes[t];
            var img = document.createElement("IMG");
            img.src = piece_theme("wB");
            img.style.maxHeight = "100%";
            img.style.maxWidth = "100%";
            theme.appendChild(img);
        }
        highlights = document.getElementsByClassName("highlightTable");
        for (var t = 0; t < highlights.length; t++) {
            theme = highlights.item(t);
            board_theme = ["#f0d9b5", "#b58863"];
            for (var j = 0; j < 3; j++) {
                // table row creation
                var row = document.createElement("tr");
                for (var i = 0; i < 3; i++) {
                    var cell = document.createElement("td");
                    if (j == i || Math.abs(i - j) == 2) cell.style.backgroundColor = board_theme[0];
                    else cell.style.backgroundColor = board_theme[1];
                    cell.style.width = "auto";
                    row.appendChild(cell);
                }
                //row added to end of table body
                theme.appendChild(row);
            }
        }
        conts = document.getElementsByClassName("themeContainer");
        for (var c = 0; c < conts.length; c++) {
            if (cookie_data != null && cookie_data.preferences != null ) {
                if (conts[c].parentElement.id === "settingItemBoard" && conts[c].id.includes(cookie_data.preferences.board_theme)) {
                    conts[c].style.border = "3px solid #fc5185";
                    conts[c].style.color = "white";
                    conts[c].style.fontWeight = "bolder";
                }
                if (conts[c].parentElement.id === "settingItemPiece" && conts[c].id.includes(cookie_data.preferences.piece_theme)) {
                    conts[c].style.border = "3px solid #fc5185";
                    conts[c].style.color = "white";
                    conts[c].style.fontWeight = "bolder";
                }
                if (conts[c].parentElement.id === "settingItemTimeControl" && conts[c].children[0].innerHTML.toLowerCase() === cookie_data.preferences.time_control) {
                    conts[c].style.border = "3px solid #fc5185";
                    conts[c].style.color = "white";
                    conts[c].style.fontWeight = "bolder";
                }
            } else {        // load default config
                if (conts[c].parentElement.id === "settingItemBoard" && conts[c].id.includes(boardTheme)) {
                    conts[c].style.border = "3px solid #fc5185";
                    conts[c].style.color = "white";
                    conts[c].style.fontWeight = "bolder";
                }
                if (conts[c].parentElement.id === "settingItemPiece" && conts[c].id.includes(pieceTheme)) {
                    conts[c].style.border = "3px solid #fc5185";
                    conts[c].style.color = "white";
                    conts[c].style.fontWeight = "bolder";
                }
                if (conts[c].parentElement.id === "settingItemTimeControl" && conts[c].children[0].innerHTML.toLowerCase() === timeControl) {
                    conts[c].style.border = "3px solid #fc5185";
                    conts[c].style.color = "white";
                    conts[c].style.fontWeight = "bolder";
                }
            }
            conts[c].addEventListener("click", function (event) {
                var elem = event.srcElement;
                while (elem.className != "themeContainer") {
                    elem = elem.parentElement;
                }
                if (elem.parentElement.id === "settingItemBoard") {
                    boardTheme = elem.children[1].id;
                    $("#settingItemBoard .themeContainer").css("backgroundColor", "");
                    $("#settingItemBoard .themeContainer").css("border", "3px solid transparent");
                    $("#settingItemBoard .themeContainer").css("color", "white");
                    $("#settingItemBoard .themeContainer").css("fontWeight", "");
                }
                if (elem.parentElement.id === "settingItemPiece") {
                    pieceTheme = elem.children[0].innerHTML.toLowerCase();
                    $("#settingItemPiece .themeContainer").css("color", "white");
                    $("#settingItemPiece .themeContainer").css("border", "3px solid transparent");
                    $("#settingItemPiece .themeContainer").css("backgroundColor", "");
                    $("#settingItemPiece .themeContainer").css("fontWeight", "");
                }
                if (elem.parentElement.id === "settingItemTimeControl") {
                    timeControl = elem.children[0].innerHTML.toLowerCase();
                    $("#settingItemTimeControl .themeContainer").css("color", "white");
                    $("#settingItemTimeControl .themeContainer").css("border", "3px solid lavender");
                    $("#settingItemTimeControl .themeContainer").css("backgroundColor", "");
                    $("#settingItemTimeControl .themeContainer").css("fontWeight", "");
                    $("#settingItemTimeControl .timeLabel").css("border", "");
                }
                if (elem.parentElement.id === "promotion") {
                    $("#promotion .themeContainer").css("color", "white");
                    $("#promotion .themeContainer").css("backgroundColor", "");
                    $("#promotion .themeContainer").css("fontWeight", "");
                    elem.style.backgroundColor = "#bdcad8";
                    elem.style.color = "black";
                    elem.style.fontWeight = "bold";
                    elem.parentElement.style.display = "none";
                    gc = document.getElementById("gameBox");
                    gc.style.opacity = 1;
                    promote = elem.id;
                    onDrop(promotion_in_progress[0], promotion_in_progress[1]);
                    board.position(game.fen(), useAnimation = true);
                    promotion_in_progress = [];
                }
                elem.style.border = "3px solid #fc5185";
                elem.style.color = "white";
                elem.style.fontWeight = "bolder";
            }, false);
        }

        if (cookie_data != null) {
            checks = document.getElementsByClassName("checkContainer");
            for (var ch = 0; ch < checks.length; ch++) {
                box = checks[ch].children[0];
                box.style.checked = "";
                if (cookie_data.preferences != null) {
                    if (box.id === "qa" && cookie_data.preferences.queen_autopromote) {
                        box.checked = "checked";
                    }
                    if (box.id === "mh" && cookie_data.preferences.highlight_moves) {
                        box.checked = "checked";
                    }
                    if (box.id === "cg" && cookie_data.preferences.clock_warn) {
                        box.checked = "checked";
                    }
                }
            }
        } else
            cookie_data = {};

        goButton = document.getElementById("goButton");
        goButton.addEventListener("click", function (event) {
            $(".fullpage").fadeIn("fast");
            qa = document.getElementById("settingItemQueenAutopromote");
            qa_checked = qa.children[0].children[0].checked;
            mh = document.getElementById("settingItemMoveHighlight");
            mh_checked = mh.children[0].children[0].checked
            cg = document.getElementById("settingItemClockGlow");
            cg_checked = cg.children[0].children[0].checked;
            prefs = {
                "board_theme": boardTheme,
                "piece_theme": pieceTheme,
                "time_control": timeControl,
                "queen_autopromote": qa_checked,
                "highlight_moves": mh_checked,
                "clock_warn": cg_checked
            };
            cookie_data.preferences = prefs;
            localStorage.setItem("user_prefs", JSON.stringify(prefs));
            res = socket.emit("/api/play", {"data": cookie_data}, function (ans) {
                // Save my sid
                cookie_data.sid = ans;
                localStorage.setItem("user_session", JSON.stringify(cookie_data));
                window.location.href = "/game";
                //document.getElementById("settingsBox").style.display = "none";
                //document.getElementById("gameBox").style.display = "flex";
            });

        });

    }

    initSettings();
    /*
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

    function removeHighlights(color) {
        $("#myBoard .square-55d63").removeClass("highlight-" + color);
    }

    function changeCursor(square, change) {
        var $square = $("#myBoard .square-" + square);
        isPiece = false;
        image = null;
        if ($square.children().length > 0) {
            for (var r = 0; r < $square.children().length; r++) {
                if ($square.children()[r].tagName == "IMG")
                    isPiece = true;
                image = $square.children()[r];
            }
        }
        if (isPiece) {
            image.style.cursor = change;
        }
    }

    function greySquare(square) {
        if (!highlightMoves){
            return
        }
        var $square = $("#myBoard .square-" + square);
        isPiece = false;
        image = null;
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
            var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "50");
            svg.setAttribute("height", "50");
            var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttributeNS(null, "cx", 28);
            circle.setAttributeNS(null, "cy", 28);
            circle.setAttributeNS(null, "r", 5);
            //circle.setAttributeNS(null, 'stroke', "red")
            //circle.setAttributeNS(null, 'stroke-width', "3")
            circle.setAttributeNS(null, "fill", "#fc5185");
            svg.appendChild(circle);
            the_square = $square.get()[0];
            the_square.appendChild(svg);
        }
    }

    function onDragStart(source, piece, position, orientation) {
        // do not pick up pieces if the game is over
        cut_game_fen = game.fen().substr(0, game.fen().indexOf(" "));
        if (game.game_over() || cut_game_fen != board.fen() || promotion_in_progress.length > 0 || game_over) return false;
        if (orientation == "white" && piece.indexOf("b") != -1) return false;
        if (orientation == "black" && piece.indexOf("w") != -1) return false;
        removeHighlights("yellow");
        // record future move
        if ((game.turn() === "w" && piece.indexOf("b") !== -1) ||
            (game.turn() === "b" && piece.indexOf("w") !== -1)) {
            futureMove = true;
        }
    }

    function is_my_turn() {
        turn = game.turn();
        mine = my_color.charAt(0);
        return turn === mine;

    }

    function onDrop(source, target) {
        // see if the move is legal
        if (handlePromotion(source, target)) {
            return;
        }
        var move = game.move({
            from: source,
            to: target,
            promotion: promote
        });
        removeHighlights("yellow");
        if (futureMove == true && source != target) {
            $board.find(".square-" + source).addClass("highlight-yellow");
            $board.find(".square-" + target).addClass("highlight-yellow");
            futureMove = false;
            futureMoveData = {from: source, to: target};
        } else if (futureMove == true && source == target) {
            futureMove = false;
            futureMoveData = null;
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

            socket.emit("move", json, function (ret) {
                ret = JSON.parse(ret);
                if (ret.remaining) {
                    discardTimeInterval('B');
                    setTime("clockdivB", ret["other_remaining"]);
                    initializeClock("clockdivA", ret["remaining"]);
                }
                insertMove(move);
                offeredButton = document.getElementById("drawOffer");
                if (offeredButton.style.display != "none") {
                    changeDrawButton('enabled');
                }
                if (game.in_checkmate()) {
                    array = get_piece_positions(game, {type: "k", color: game.turn()});
                    source = array[0];
                    $board.find(".square-" + source).addClass("highlight-mate");
                    game_over = true;
                } else if (game.in_check()) {
                    array = get_piece_positions(game, {type: "k", color: game.turn()});
                    source = array[0];
                    $board.find(".square-" + source).addClass("highlight-check");
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
        if (!queenAutopromote && promotion_in_progress.length == 0 &&
            ((target[1] == "1" && my_color === "black") || (target[1] == "8" && my_color === "white"))) {
            var move = game.move({
                from: source,
                to: target,
                promotion: "q" // NOTE: always promote to a queen for example simplicity
            });
            if (move != null) {
                curr_position = Chessboard.fenToObj(the_game.position);
                piece = curr_position[source];
                if (piece[1] == "P") {
                    promotion_in_progress = [source, target];
                    pieceType = ["B", "N", "R", "Q"];
                    themes = document.getElementsByClassName("promotionPieceHolder");
                    for (var t = 0; t < themes.length; t++) {
                        theme = themes.item(t);
                        piece_theme = getPieceFuncByName(pieceTheme);
                        my_color.charAt(0);
                        var img = document.createElement("IMG");
                        img.src = piece_theme(my_color.charAt(0) + pieceType[t]);
                        img.style.maxHeight = "100%";
                        img.style.maxWidth = "100%";
                        theme.appendChild(img);
                    }
                    promotionTab = document.getElementById("promotion");
                    promotionTab.style.display = "flex";
                    gc = document.getElementById("gameBox");
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
        cut_game_fen = game.fen().substr(0, game.fen().indexOf(" "));
        if (game.game_over() || piece == false || cut_game_fen != board.fen() || promotion_in_progress.length > 0 || game_over) return false;
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
            board.position(game.fen(), useAnimation = true);
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
        if (game.in_checkmate()) {
            status = "Game over, " + moveColor + " is in checkmate.";
        }

        // draw?
        else if (game.in_draw()) {
            status = "Game over, drawn position";
        }

        // game still on
        else {
            status = moveColor + " to move";

            // check?
            if (game.in_check()) {
                status += ", " + moveColor + " is in check";
            }
        }

        //$status.html(status);
        //$fen.html(game.fen());
        //$pgn.html(game.pgn());
    }
    */
    (jQuery);
});
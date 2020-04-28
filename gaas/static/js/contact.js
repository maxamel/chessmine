$(document).ready(function () {
    $(".fullpage").fadeOut("slow");
    var timeintervalA = null;
    var timeintervalB = null;
    var clockColorIntervalA = null
    var clockColorIntervalB = null
    var moveInterval = null;

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
        var minutesSpan = clock.querySelector(".minutes");
        var secondsSpan = clock.querySelector(".seconds");
        var millisSpan = clock.querySelector(".millis");
        var lastCall = new Date().getTime();

        function changeClockColor() {
            if (clock.style.color == "red")
                clock.style.color = "black"
            else
                clock.style.color = "red"
        }

        function updateClock() {
            now = new Date().getTime();
            endtime -= now - lastCall;
            lastCall = now;
            var t = getTimeRemaining(endtime);
            if (t.total < 600000 && id == "clockdivA" && clockColorIntervalA == null) {
                clockColorIntervalA = setInterval(function () {
                    changeClockColor();
                }, 500);
            }
            if (t.total < 600000 && id == "clockdivB" && clockColorIntervalB == null) {
                clockColorIntervalB = setInterval(function () {
                    changeClockColor();
                }, 500);
            }
            if (t.total <= 0) {
                clearInterval(timeintervalA);
                clearInterval(timeintervalB);

                millisSpan.innerHTML = ("00").slice(-2);
                return;
            }
            minutesSpan.innerHTML = ("0" + t.minutes).slice(-2);
            secondsSpan.innerHTML = ("0" + t.seconds).slice(-2);
            millisSpan.innerHTML = ("0" + t.millis).slice(-2);
        }

        updateClock();
        if (id == "clockdivA") {
            clearInterval(timeintervalA);
            timeintervalA = setInterval(function () {
                updateClock();
            }, 10);
        } else {
            clearInterval(timeintervalB);
            timeintervalB = setInterval(function () {
                updateClock();
            }, 10);
        }
    }

    ///// CLOCK
    var board = null;
    var $board = $("#myBoard");
    var game = new Chess();
    var moveList = [];
    var $status = $("#status");
    var $fen = $("#fen");
    var $pgn = $("#pgn");
    var whiteSquareGrey = "#a9a9a9";
    var blackSquareGrey = "#696969";
    var whiteSquare = "#9e7863";
    var blacksquare = "#633526";
    var futureMove = false;
    var futureMoveData = null;
    var player_id = null;
    var other_remaining = 300000;
    var my_color = null;
    var boardTheme = "metro";
    var pieceTheme = "metro";
    var timeControl = "5+0";
    var queenAutopromote = false;
    var highlightMoves = false;
    var the_game_moves = [];
    var the_game_fens = [];
    var promotion_in_progress = [];
    var promote = "q";

    var cookie_data = localStorage.getItem("user_session");
    var socket = io("http://localhost:5000/connect");

    socket.on("connection_id", function (ans) {
        delete ans.user.preferences;
        user_data = JSON.stringify(ans.user);
        localStorage.setItem("user_session", user_data);
        cookie_data = user_data;
    });
    socket.on("game_over", function (ans) {
        alert(JSON.stringify(ans));
        clearInterval(timeintervalA);
        clearInterval(timeintervalB);
    });
    socket.on("game", function (ans) {
        load_cookies();
        my_color = JSON.stringify(ans.color);
        the_game = ans.game;
        my_time = JSON.stringify(the_game.white_remaining);
        rival_time = JSON.stringify(the_game.black_remaining);
        ttl_time = JSON.stringify(the_game.move_ttl);
        me = the_game.white;
        rival = the_game.black;
        my_color = my_color.slice(1, -1);
        if (my_color === "black") {        // swap
            my_time = [rival_time, rival_time = my_time][0];
            me = [rival, rival = me][0];
        }
        the_game_fen = the_game.position;
        the_game_moves = JSON.parse(the_game.moves);
        the_game_fens = JSON.parse(the_game.fens);
        player_id = cookie_data.sid;
        document.getElementById("labelTitleA").innerText = rival["name"];
        document.getElementById("labelRatingA").innerText = rival["rating"];
        document.getElementById("labelTitleASmall").innerText = rival["name"];
        document.getElementById("labelRatingASmall").innerText = rival["rating"];
        document.getElementById("labelTitleB").innerText = cookie_data.name;
        document.getElementById("labelRatingB").innerText = cookie_data.rating;
        document.getElementById("labelTitleBSmall").innerText = cookie_data.name;
        document.getElementById("labelRatingBSmall").innerText = cookie_data.rating;
        document.getElementById("playerInfoA").style.visibility = "visible";
        document.getElementById("playerInfoB").style.visibility = "visible";
        var panes = document.getElementsByClassName("clock");
        for (var pane of panes) {
            pane.style.opacity = 1;
        }
        document.getElementById("gameBox").style.opacity = 1;
        //document.getElementById("ldbar").style.opacity = 0
        setTime("clockdivA", rival_time);
        setTime("clockdivB", my_time);

        whiteSquare = boardTheme[0];
        blacksquare = boardTheme[1];
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
            onMouseoutSquare: onMouseoutSquare,
            onMouseoverSquare: onMouseoverSquare,
            onSnapEnd: onSnapEnd
        };
        board = Chessboard("myBoard", config);
        game = new Chess(the_game_fen);
        insertBulkMoves(the_game_moves, ttl_time);
        isStart = my_time === rival_time && my_time % 1000 == 0;
        if (!isStart) {
            if (is_my_turn()) {
                clearInterval(timeintervalA);
                initializeClock("clockdivB", my_time);
            } else {
                clearInterval(timeintervalB);
                initializeClock("clockdivA", rival_time);
            }
        }

        function myFunction(x) {
            if (x.matches) { // If media query matches
                board.resize();
            } else {
                board.resize();
            }
        }

        var x = window.matchMedia("(max-width: 1105px)");
        //myFunction(x) // Call listener function at run time
        x.addEventListener("change", myFunction); // Attach listener function on state changes
        $(".fullpage").fadeOut("slow");
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
        if (ans.remaining) {
            if (my_color.charAt(0) == the_move.color) {
                other_remaining = ans.remaining;
                initializeClock("clockdivA", ans.remaining);
                clearInterval(timeintervalB);
                setTime("clockdivB", ans.other_remaining);
            } else {
                other_remaining = ans.other_remaining;
                initializeClock("clockdivB", ans.remaining);
                clearInterval(timeintervalA);
                setTime("clockdivA", ans.other_remaining);
            }
        }
        array = get_piece_positions(game, {type: "k", color: game.turn()});
        source = array[0];
        if (game.in_checkmate()) {
            $board.find(".square-" + source).addClass("highlight-mate");
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
                socket.emit("update", json, function (ret) {
                    if (ret == null) {      // In case this move is illegal we should abort
                        game.undo();
                        checkIn();
                        return;
                    }
                    ret = JSON.parse(ret);
                    insertMove(move);
                    if (ret.remaining) {
                        clearInterval(timeintervalB);
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
            //onDrop()
            futureMoveData = null;
        }
    });
    checkIn();

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
        moveList.push(move.san);
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
        moveList = moves;
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

    function checkIn() {
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
        }
    }

    function initSettings() {
        // prerequisite is load_cookies
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
            conts[c].addEventListener("click", function (event) {
                var elem = event.srcElement;
                while (elem.className != "themeContainer") {
                    elem = elem.parentElement;
                }
                if (elem.parentElement.id === "settingItemBoard") {
                    boardTheme = elem.children[1].id;
                    $("#settingItemBoard .themeContainer").css("backgroundColor", "");
                    $("#settingItemBoard .themeContainer").css("color", "white");
                    $("#settingItemBoard .themeContainer").css("fontWeight", "");
                }
                if (elem.parentElement.id === "settingItemPiece") {
                    pieceTheme = elem.children[0].innerHTML.toLowerCase();
                    $("#settingItemPiece .themeContainer").css("color", "white");
                    $("#settingItemPiece .themeContainer").css("backgroundColor", "");
                    $("#settingItemPiece .themeContainer").css("fontWeight", "");
                }
                if (elem.parentElement.id === "settingItemTimeControl") {
                    timeControl = elem.children[0].innerHTML.toLowerCase();
                    $("#settingItemTimeControl .themeContainer").css("color", "white");
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
                    onSnapEnd();
                    promotion_in_progress = [];
                }
                elem.style.backgroundColor = "#fc5185"//"#bdcad8";
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
                    if (box.id == "qa" && cookie_data.preferences.queen_autopromote)
                        box.style.checked = "checked";
                    if (box.id == "mh" && cookie_data.preferences.highlight_moves)
                        box.style.checked = "checked";
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
            mh_checked = mh.children[0].children[0].checked;
            prefs = {
                "board_theme": boardTheme,
                "piece_theme": pieceTheme,
                "time_control": timeControl,
                "queen_autopromote": qa_checked,
                "highlight_moves": mh_checked
            };
            cookie_data.preferences = prefs;
            localStorage.setItem("user_prefs", JSON.stringify(prefs));
            res = socket.emit("play", {"data": JSON.stringify(cookie_data)}, function (ans) {
                document.getElementById("settingsBox").style.display = "none";
                document.getElementById("gameBox").style.display = "flex";
            });
        });
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

    function removeHighlights(color) {
        $("#myBoard .square-55d63").removeClass("highlight-" + color);
    }

    function greySquare(square) {
        if (highlightMoves){
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
        if (game.game_over() || cut_game_fen != board.fen() || promotion_in_progress.length > 0) return false;
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
            removeCheck()
            socket.emit("update", json, function (ret) {
                ret = JSON.parse(ret);
                if (ret.remaining) {
                    clearInterval(timeintervalB);
                    setTime("clockdivB", ret["other_remaining"]);
                    initializeClock("clockdivA", ret["remaining"]);
                }
                insertMove(move);
            });
        }
        if (game.in_checkmate()) {
            array = get_piece_positions(game, {type: "k", color: game.turn()});
            source = array[0];
            $board.find(".square-" + source).addClass("highlight-mate");
        } else if (game.in_check()) {
            array = get_piece_positions(game, {type: "k", color: game.turn()});
            source = array[0];
            $board.find(".square-" + source).addClass("highlight-check");
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
            console.log("UNABLE TO HANDLE PROMOTION " + source + " " + target + " " + promotion_in_progress)
            return false
        }
        console.log("CANNOT HANDLE PROMOTION " + source + " " + target)
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
        if (game.game_over() || piece == false || cut_game_fen != board.fen() || promotion_in_progress.length > 0) return false;
        if (orientation == "white" && piece.indexOf("b") != -1) return false;
        if (orientation == "black" && piece.indexOf("w") != -1) return false;
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
        removeGreySquares();
    }

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    function onSnapEnd() {
        board.position(game.fen(), useAnimation = true);
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

        $status.html(status);
        $fen.html(game.fen());
        $pgn.html(game.pgn());
    }

    (jQuery);
});
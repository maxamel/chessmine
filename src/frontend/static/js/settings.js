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
            var now = new Date().getTime();
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
    var prefs = localStorage.getItem("user_prefs");
    //var socket = io("APP_URL/connect");

    function load_cookies() {
        cookie_data = localStorage.getItem("user_session");
        cookie_data = JSON.parse(cookie_data);
        prefs = localStorage.getItem("user_prefs");
        var obj_prefs = JSON.parse(prefs);
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
        var board_themes = [
            urban_board_theme,
            standard_board_theme,
            wiki_board_theme,
            wood_board_theme,
            american_board_theme,
            metro_board_theme,
            classical_board_theme
        ];
        var piece_themes = [
            urban_piece_theme,
            standard_piece_theme,
            wiki_piece_theme,
            wood_piece_theme,
            american_piece_theme,
            metro_piece_theme,
            classical_piece_theme,
            alpha_piece_theme,
        ];
        var themes = document.getElementsByClassName("themeTable");
        for (var t = 0; t < themes.length; t++) {
            var theme = themes.item(t);
            var board_theme = board_themes[t];
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
            var theme = themes.item(t);
            var piece_theme = piece_themes[t];
            var img = document.createElement("IMG");
            img.src = piece_theme("wB");
            img.style.maxHeight = "100%";
            img.style.maxWidth = "100%";
            theme.appendChild(img);
        }
        var highlights = document.getElementsByClassName("highlightTable");
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
        var conts = document.getElementsByClassName("themeContainer");
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
                    var gc = document.getElementById("gameBox");
                    gc.style.opacity = 1;
                    promote = elem.id;
                    onDrop(promotion_in_progress[0], promotion_in_progress[1]);
                    board.position(game.fen(), true);
                    promotion_in_progress = [];
                }
                elem.style.border = "3px solid #fc5185";
                elem.style.color = "white";
                elem.style.fontWeight = "bolder";
            }, false);
        }

        if (cookie_data != null) {
            var checks = document.getElementsByClassName("checkContainer");
            for (var ch = 0; ch < checks.length; ch++) {
                var box = checks[ch].children[0];
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

        var goButton = document.getElementById("goButton");
        goButton.addEventListener("click", function (event) {
            $(".fullpage").fadeIn("fast");
            var qa = document.getElementById("settingItemQueenAutopromote");
            var qa_checked = qa.children[0].children[0].checked;
            var mh = document.getElementById("settingItemMoveHighlight");
            var mh_checked = mh.children[0].children[0].checked
            var cg = document.getElementById("settingItemClockGlow");
            var cg_checked = cg.children[0].children[0].checked;
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
            var res = socket.emit("/api/play", {"data": cookie_data}, function (ans) {
                // Save my sid
                cookie_data.sid = ans;
                localStorage.setItem("user_session", JSON.stringify(cookie_data));
                window.location.href = "/game";
                //document.getElementById("settingsBox").style.display = "none";
                //document.getElementById("gameBox").style.display = "flex";
            });
            /*
            $.ajax({
                url: "/api/play",
                type: 'POST',
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify({"data": cookie_data}),
                success: function (ans) {
                    //alert("Got data back " + JSON.parse(obj));
                    cookie_data.sid = ans.dst_sid;
                    localStorage.setItem("user_session", JSON.stringify(cookie_data));
                    window.location.href = "/game";
                },
                error: function(ans) {
                    console.log("Error in API play " + ans);
                }
            });
            */
        });
    }

    initSettings();
    (jQuery);
});
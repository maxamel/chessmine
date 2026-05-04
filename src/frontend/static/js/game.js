import { getPieceFuncByName, fenToObj, setupThemes, getBoardColorsByName, setupBoard } from './utils.js'
import { showEndGame } from './endgame.js'
import { initializeClock, setTime, discardTimeInterval, setClockGlow } from './clock.js'
import { stockfish_load, stockfish_move, stockfish_start, stockfish_set_skill_level } from './stockfish_handler.js';
import { Chessground } from './chessground.js';
import { displayFlag, removeFlag, displayStockfishLogo } from './flag_utils.js';

$(document).ready(function () {
    // Parse invite params before load_cookies so guest flow works with empty localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const waitingIdFromUrl = urlParams.get("waiting_id");
    const inviteRoleFromUrl = urlParams.get("role");

    load_cookies();

    var moveInterval = null;
    var board = null;       // the chessground board
    var $board = document.getElementById('myBoard')
    var game = new Chess();     // the chess logic
    var conf = null;            // the conf of the chessground board
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
    var computerLevel = 5;
    var the_game_moves = [];
    var the_game_fens = [];
    var promotion_in_progress = [];
    var promote = "q";
    var emptyHeartbeats = 0;
    var game_over = false;
    var last_call = null;
    var heartbeatOK = false;
    var abort_button = null;
    var attached_listeners = false;
    var currentMoveIndex = -1;
    var engine = null;       // stockfish instance
    var engine_sid = null;   // for engine play only

    function getThemeNameFromPreviewId(idValue, prefix) {
        return idValue.replace(prefix + "-", "").trim().toLowerCase();
    }

    function renderPiecePreview(childDiv, themeName) {
        const imagePath = `img/chesspieces/${themeName}/wB.png`;
        childDiv.style.backgroundImage = `url(${imagePath})`;
        childDiv.style.backgroundSize = 'contain';
        childDiv.style.backgroundPosition = 'center';
        childDiv.style.backgroundRepeat = 'no-repeat';
    }

    function clearPiecePreview(childDiv) {
        childDiv.style.backgroundImage = 'none';
    }

    function renderBoardPreview(childDiv, themeName) {
        const colorBoard = getBoardColorsByName(themeName);
        const light = colorBoard[0];
        const dark = colorBoard[1];

        childDiv.innerHTML = '';
        childDiv.style.display = 'flex';
        childDiv.style.flexWrap = 'wrap';
        childDiv.style.borderRadius = '6px';
        childDiv.style.overflow = 'hidden';
        childDiv.style.height = '40px';

        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 2; col++) {
                const sq = document.createElement('div');
                sq.style.width = '50%';
                sq.style.height = '50%';
                sq.style.backgroundColor = (row + col) % 2 === 0 ? light : dark;
                childDiv.appendChild(sq);
            }
        }
    }

    function clearBoardPreview(childDiv) {
        childDiv.innerHTML = '';
        childDiv.style.display = '';
        childDiv.style.height = '';
    }

    function setActiveSettingLink(links, activeLink) {
        links.forEach(link => {
            const isActive = link === activeLink;
            link.classList.toggle('active', isActive);

            if (isActive) {
                link.setAttribute('aria-current', 'true');
                link.setAttribute('aria-disabled', 'true');
            } else {
                link.removeAttribute('aria-current');
                link.removeAttribute('aria-disabled');
            }
        });
    }

    function settingsUsePersistentPreviews() {
        return window.matchMedia('(hover: none), (pointer: coarse), (max-width: 991px)').matches;
    }

    function attachSettingsMenuListeners() {
        const settingsMenu = document.getElementById('settingsNavigator');
        if (!settingsMenu) {
            return;
        }

        const settingsHolder = document.getElementById('settingsHolder');
        const settingsButton = document.getElementById('settingsMenuButton');
        const settingsItems = Array.from(settingsMenu.querySelectorAll('.settings-item'));
        const closeTimers = new WeakMap();

        function getTrigger(item) {
            return item.querySelector(':scope > .settings-toggle');
        }

        function getSubmenu(item) {
            return item.querySelector(':scope > .dropdown-menu-right');
        }

        function supportsDesktopHover() {
            return window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 992px)').matches;
        }

        function closeItem(item) {
            clearCloseTimer(item);
            const trigger = getTrigger(item);
            item.classList.remove('is-open', 'submenu-inline', 'submenu-flip');

            if (trigger) {
                trigger.setAttribute('aria-expanded', 'false');
            }
        }

        function closeAllItems() {
            settingsItems.forEach(closeItem);
        }

        function clearCloseTimer(item) {
            const timerId = closeTimers.get(item);
            if (timerId) {
                window.clearTimeout(timerId);
                closeTimers.delete(item);
            }
        }

        function scheduleClose(item) {
            clearCloseTimer(item);
            closeTimers.set(item, window.setTimeout(() => {
                closeTimers.delete(item);
                closeItem(item);
            }, 900));
        }

        function syncSubmenuLayout(item) {
            const submenu = getSubmenu(item);
            const trigger = getTrigger(item);
            if (!submenu || !trigger) {
                return;
            }

            item.classList.remove('submenu-inline', 'submenu-flip');

            if (window.matchMedia('(max-width: 991px)').matches) {
                item.classList.add('submenu-inline');
                return;
            }

            const submenuWidth = Math.max(submenu.offsetWidth, submenu.scrollWidth, 220);
            const triggerRect = trigger.getBoundingClientRect();
            const viewportPadding = 16;
            const spaceRight = window.innerWidth - triggerRect.right - viewportPadding;
            const spaceLeft = triggerRect.left - viewportPadding;

            if (spaceRight >= submenuWidth) {
                return;
            }

            if (spaceLeft >= submenuWidth) {
                item.classList.add('submenu-flip');
                return;
            }

            item.classList.add('submenu-inline');
        }

        function openItem(item, focusFirstOption) {
            const trigger = getTrigger(item);
            if (!trigger) {
                return;
            }

            const wasOpen = item.classList.contains('is-open');
            closeAllItems();

            if (wasOpen) {
                return;
            }

            item.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            syncSubmenuLayout(item);

            if (focusFirstOption) {
                const firstOption = getSubmenu(item)?.querySelector('a, button');
                if (firstOption) {
                    window.requestAnimationFrame(() => firstOption.focus());
                }
            }
        }

        function toggleItem(item) {
            if (item.classList.contains('is-open')) {
                closeItem(item);
            } else {
                openItem(item, false);
            }
        }

        settingsItems.forEach(item => {
            const trigger = getTrigger(item);
            const submenu = getSubmenu(item);
            if (!trigger) {
                return;
            }

            trigger.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                toggleItem(item);
            });

            item.addEventListener('mouseenter', function () {
                if (supportsDesktopHover()) {
                    clearCloseTimer(item);
                    openItem(item, false);
                }
            });

            item.addEventListener('mouseleave', function () {
                if (supportsDesktopHover()) {
                    scheduleClose(item);
                }
            });

            if (submenu) {
                submenu.addEventListener('mouseenter', function () {
                    if (supportsDesktopHover()) {
                        clearCloseTimer(item);
                    }
                });

                submenu.addEventListener('mouseleave', function () {
                    if (supportsDesktopHover()) {
                        scheduleClose(item);
                    }
                });
            }

            trigger.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleItem(item);
                    return;
                }

                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    openItem(item, true);
                    return;
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeItem(item);
                    trigger.focus();
                }
            });

            if (submenu) {
                submenu.addEventListener('keydown', function (event) {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        closeItem(item);
                        trigger.focus();
                    }
                });
            }
        });

        settingsMenu.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeAllItems();

                if (settingsButton && typeof bootstrap !== 'undefined') {
                    bootstrap.Dropdown.getOrCreateInstance(settingsButton).hide();
                } else if (settingsButton) {
                    settingsButton.focus();
                }
            }
        });

        document.addEventListener('click', function (event) {
            if (settingsHolder && !settingsHolder.contains(event.target)) {
                closeAllItems();
            }
        });

        window.addEventListener('resize', function () {
            const openItemNode = settingsItems.find(item => item.classList.contains('is-open'));
            if (openItemNode) {
                syncSubmenuLayout(openItemNode);
            }
        });

        if (settingsHolder) {
            settingsHolder.addEventListener('shown.bs.dropdown', function () {
                const openItemNode = settingsItems.find(item => item.classList.contains('is-open'));
                if (openItemNode) {
                    syncSubmenuLayout(openItemNode);
                }
            });

            settingsHolder.addEventListener('hidden.bs.dropdown', function () {
                closeAllItems();
            });
        }
    }

    var prefs = localStorage.getItem("user_prefs");
    var cookie_data = localStorage.getItem("user_session");
    var socket = io("https://APP_URL/connect", {
        transports: [ "polling", "websocket"],
        timestampParam: "timestamp",
        tryAllTransports: true,
        query: {
            nonce: (Math.random() + 1).toString(36).substring(8)
        }
    });
    const waitingId = waitingIdFromUrl;
    const inviteRole = inviteRoleFromUrl; // "host" when coming from Invite Friend menu
    console.log("game.js URL params:", window.location.search, "waitingId =", waitingId, "inviteRole =", inviteRole);

    // Adjust loading message and cancel behaviour for Invite Friend
    var cancel = document.getElementById("cancelSearch");
    var loadMessage = document.querySelector(".loadMessage");

    if (waitingId) {
        console.log("Invite Friend flow detected. waiting_id =", waitingId, "role =", inviteRole);
        if (inviteRole === "host") {
            // Host: show invite waiting UI (structure in HTML/CSS); only set URL, QR and copy handler here
            var fullpageEl = document.getElementById("fullpage");
            if (fullpageEl) {
                fullpageEl.classList.add("invite-waiting");
            }
            var inviteUrl = window.location.origin + "/game?waiting_id=" + encodeURIComponent(waitingId);
            var urlInput = document.getElementById("inviteUrlInput");
            var qrCodeDiv = document.getElementById("invite-qrcode");
            var copyBtn = document.getElementById("inviteCopyBtn");
            if (urlInput) {
                urlInput.value = inviteUrl;
            }
            if (qrCodeDiv && typeof QRCode !== "undefined") {
                try {
                    new QRCode(qrCodeDiv, {
                        text: inviteUrl,
                        width: 200,
                        height: 200,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } catch (e) {
                    qrCodeDiv.textContent = "QR code unavailable";
                }
            } else if (qrCodeDiv) {
                qrCodeDiv.textContent = "QR code unavailable";
            }
            if (copyBtn && urlInput) {
                copyBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    urlInput.select();
                    urlInput.setSelectionRange(0, 99999);
                    var icon = copyBtn.querySelector("i.fa");
                    var showCopied = function () {
                        if (icon) {
                            icon.className = "fa fa-check";
                            setTimeout(function () { icon.className = "fa fa-copy"; }, 2000);
                        }
                    };
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(inviteUrl).then(showCopied).catch(function () {
                            document.execCommand("copy");
                            showCopied();
                        });
                    } else {
                        document.execCommand("copy");
                        showCopied();
                    }
                });
            }
        } else {
            // Guest: hide loading overlay until /api/invite response; only then show it or redirect
            var fullpageElGuest = document.getElementById("fullpage");
            if (fullpageElGuest) {
                fullpageElGuest.style.display = "none";
            }
            if (cancel) {
                cancel.style.display = "none";
            }
        }

        if (cancel && inviteRole === "host") {
            cancel.addEventListener("click", function (evt) {
                evt.preventDefault();
                evt.stopPropagation();
                var btn = evt.currentTarget;
                if (btn.getAttribute("data-cancel-disabled") === "1") return;
                btn.setAttribute("data-cancel-disabled", "1");
                btn.style.opacity = "0.6";
                btn.style.pointerEvents = "none";
                console.log("Sending cancel waiting for friend, waiting_id:", waitingId);
                var redirectFallbackId = setTimeout(function () {
                    window.location.href = "/";
                }, 400);
                socket.emit("/api/cancelWaiting", { "waiting_id": waitingId }, function (ret) {
                    clearTimeout(redirectFallbackId);
                    if (ret === 0 || ret === "0") {
                        btn.style.opacity = "0.5";
                    } else {
                        window.location.href = "/";
                    }
                });
            });
        }
    } else if (cancel) {
        // Default Quick Game cancellation behaviour
        cancel.addEventListener("click", function(evt) {
            var json = {
                "data": {
                    "sid": player_id,
                    "time_control": timeControl
                }
            };
            console.log('sending out cancellation');
            socket.emit("/api/cancelSearch", json, function (ret) {
                console.log('cancel search resulted in ' + ret);
                if (ret === 0) {        // we could not cancel this search since that has been a match
                    evt.target.style.opacity = 0.5;
                    evt.target.style.pointerEvents = 'none';
                } else {
                    window.location.href = "/";
                }
            });
        });
    }

    socket.on("game_over", function (ans) {
        console.log("Game Over " + JSON.stringify(ans))
        game_over = true;
        discardTimeInterval('all');
        disableGameButtons();
        resetBoard(null);
        showEndGame(ans.winner, ans.message, my_color);
        changeRematchButton('enabled');
        setRatings(ans);
    });

    function handle_engine_init (rival, the_game, the_game_fen, rating) {
        if (rival.player_type === 1) {   // rival is engine
            // lazy initialization of stockfish
            engine_sid = the_game.engine_sid
            engine = stockfish_load()
            console.log(`The current position ${the_game_fen}`)

            engine.onmessage = function (line) {
                var responseWords = line.data.split(' ')
                if (responseWords[0] === 'bestmove') {
                    // make move to get full structure of chess move and then undo. This move will be processed
                    // properly once it goes through the server and back
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
            stockfish_start(the_game_fen, rating, computerLevel)
        }
    }

    socket.on("game", function (ans) {
        load_cookies();
        console.log(ans);
        emptyHeartbeats = 0;
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
        }   else {
            game_over = false;
        }
        my_color = my_color.slice(1, -1);       // remove quotes from both sides
        if (my_color === "black") {        // swap objects
            my_time = [rival_time, rival_time = my_time][0];
            me = [rival, rival = me][0];
        }

        the_game_moves = JSON.parse(the_game.moves);
        the_game_fens = JSON.parse(the_game.fens);
        player_id = cookie_data.sid;

        // Remove existing flags before adding new ones
        removeFlag("labelTitleA");
        removeFlag("labelTitleASmall");
        removeFlag("labelTitleB");
        removeFlag("labelTitleBSmall");

        document.getElementById("labelTitleA").innerText = rival["name"];
        document.getElementById("labelRatingA").innerText = rival["rating"];
        document.getElementById("labelTitleASmall").innerText = rival["name"];
        document.getElementById("labelRatingASmall").innerText = rival["rating"];
        document.getElementById("labelTitleB").innerText = me.name;
        document.getElementById("labelRatingB").innerText = me.rating;
        document.getElementById("labelTitleBSmall").innerText = me.name;
        document.getElementById("labelRatingBSmall").innerText = me.rating;
        
        if (rival.player_type === 1) {
            // Rival is Stockfish engine
            console.log('Rival is Stockfish engine');
            displayStockfishLogo("labelTitleA");
            displayStockfishLogo("labelTitleASmall");
        } else if (rival.country_code && rival.country_code !== 'None') {
            displayFlag("labelTitleA", rival.country_code);
            displayFlag("labelTitleASmall", rival.country_code);
        } else {
            console.log('No rival flag to display');
        }
        
        if (me.player_type === 1) {
            // I am Stockfish engine (shouldn't happen, but handle it)
            console.log('I am Stockfish engine');
            displayStockfishLogo("labelTitleB");
            displayStockfishLogo("labelTitleBSmall");
        } else if (me.country_code && me.country_code !== 'None') {
            displayFlag("labelTitleB", me.country_code);
            displayFlag("labelTitleBSmall", me.country_code);
        } else {
            console.log('No my flag to display - country_code:', me.country_code);
        }
        
        document.getElementById("playerInfoA").style.visibility = "visible";
        document.getElementById("playerInfoB").style.visibility = "visible";
        var panes = document.getElementsByClassName("clock");
        for (var pane of panes) {
            pane.style.opacity = 1;
        }
        document.getElementById("gameBox").style.opacity = 1;
        setTime("clockdivA", rival_time);
        setTime("clockdivB", my_time);

        game = new Chess(the_game_fen);
        conf = {
              fen: the_game_fen,
              orientation: my_color,
              turnColor: getColorFromTurn(),
              //coordinatesOnSquares: true,
              premovable: {
                  enabled: game_status !== 3, // allow premoves for color that can not move
                  showDests: true, // whether to add the premove-dest class on squares
                  castle: true, // whether to allow king castle premoves
                  events: {
                      set: onPreMoveSet,
                      unset: onPreMoveUnSet
                  }
              },
              movable: {
                  free: false,
                  color: my_color,
                  showDests: true,
                  dests: getMovesMap(),
                  rookCastle: true,
              },
              draggable: { enabled: game_status !== 3, showGhost: false },
              selectable: { enabled: game_status !== 3 },
              highlight: { check: true, lastMove: true },
              events: {
                  //change?: () => void; // called after the situation changes on the board
                  // called after a piece has been moved.
                  // capturedPiece is undefined or like {color: 'white'; 'role': 'queen'}
                  move: onDrop,

                  //dropNewPiece?: (piece: cg.Piece, key: cg.Key) => void;
                  //select?: (key: cg.Key) => void; // called when a square is selected
                  //insert?: (elements: cg.Elements) => void; // when the board DOM has been (re)inserted
              },
              drawable: {
                enabled: true, // can draw
                visible: true, // can view
                defaultSnapToValidMove: false,
                // false to keep the drawing if a movable piece is clicked.
                // Clicking an empty square or immovable piece will clear the drawing regardless.
                //eraseOnClick: boolean;
                //shapes?: DrawShape[];
                //autoShapes?: DrawShape[];
                //brushes?: DrawBrushes;
                //onChange?: (shapes: DrawShape[]) => void; // called after drawable shapes change
              }
        }
        console.log('setting board to fen ' + the_game_fen);
        board = Chessground($board, conf);
        setupThemes(pieceTheme, boardTheme);
        // Defer layout sync so the browser finishes its first paint before we measure.
        requestAnimationFrame(function() {
            syncBoardRelatedLayout();
            // Second pass in case fonts/images shifted things slightly.
            setTimeout(syncBoardRelatedLayout, 150);
        });

        insertBulkMoves(the_game_moves, ttl_time);

        handle_engine_init(rival, the_game, the_game_fen, me.rating)

        var isStart = the_game_moves.length < 2;
        if (!isStart) abort_button = false;
        attachSettingsMenuListeners();
        attachPieceThemeListeners();
        attachColorThemeListener();
        attachComputerLevelListener();
        attachNavigationListeners();

        if (game_status !== 3) {     // NOT ENDED
            if (!attached_listeners) {

                attachPromotionListeners();

                var draw = document.getElementById("drawButton");
                draw.addEventListener("click", drawAction);

                var resign = document.getElementById("resignButton");
                resign.addEventListener("click", resignAction);

                var abort = document.getElementById("abortButton");
                abort.addEventListener("click", abortAction);

                var offeredDraw = document.getElementById("drawOfferedButton");
                offeredDraw.addEventListener("click", offeredDrawAction);

                var acceptDraw = document.getElementById("acceptDraw");
                acceptDraw.addEventListener("click", function (ev) {
                    ev.stopPropagation();
                    drawAction(ev);
                });

                var declineDraw = document.getElementById("declineDraw");
                declineDraw.addEventListener("click", function (ev) {
                    ev.stopPropagation();
                    declineDrawAction(ev);
                });
                attached_listeners = true;
            }

            hideArrows();
            enableGameButtons();

            if (my_color === draw_offer) {
                // I offered draw
                changeDrawButton('disabled');
            } else if (draw_offer != null){
                // Rival offered draw
                changeDrawButton('hidden');
            }

            if (game_status === 2) {     // PLAYING
                if (is_my_turn()) {
                    discardTimeInterval('A');
                    initializeClock("clockdivB", my_time);
                } else {
                    discardTimeInterval('B');
                    initializeClock("clockdivA", rival_time);
                }
            } else if (game_status === 1) {      // STARTED
                game_over = false;
                hideEndGameBoxes();
            }
        } else {
            game_over = true;
            highlight_check_mate();
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
                var endgameBox = evt.currentTarget.closest(".endgame-box");
                if (endgameBox) {
                    endgameBox.style.display = "none";
                }
                hideEndGameBoxes();
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

        //var x = window.matchMedia("(max-width: 1105px)");
        // chessground does not require resize
        //x.addEventListener("change", boardResize); // Attach listener function on state changes
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

        function attachPieceThemeListeners() {
            const subNavLinks = document.querySelectorAll('.settings-menu .dropdown-menu-right .sub-nav-link');

            function syncPiecePreviews() {
                const showAllPreviews = settingsUsePersistentPreviews();

                subNavLinks.forEach(link => {
                    const childDiv = link.querySelector('div');
                    if (!childDiv) {
                        return;
                    }

                    const themeName = getThemeNameFromPreviewId(childDiv.id, 'piece');
                    if (showAllPreviews || link.classList.contains('active')) {
                        renderPiecePreview(childDiv, themeName);
                    } else {
                        clearPiecePreview(childDiv);
                    }
                });
            }

            // Set initial active state based on current pieceTheme
            subNavLinks.forEach(link => {
                const childDiv = link.querySelector('div');
                if (childDiv) {
                    const linkValue = getThemeNameFromPreviewId(childDiv.id, 'piece');
                    if (linkValue === pieceTheme.toLowerCase()) {
                        setActiveSettingLink(subNavLinks, link);
                    }
                }
            });

            syncPiecePreviews();
            window.addEventListener('resize', syncPiecePreviews);

            // Iterate over each sub-nav-link
            subNavLinks.forEach(link => {
                // Find the `div` inside this link
                // Check if the `div` exists
                const childDiv = link.querySelector('div');
                if (childDiv) {
                    // Attach a hover event listener
                    link.addEventListener('mouseover', () => {
                        if (settingsUsePersistentPreviews()) {
                            return;
                        }

                        // Don't show preview if this is the active item
                        if (!link.classList.contains('active')) {
                            const themeName = getThemeNameFromPreviewId(childDiv.id, 'piece');
                            renderPiecePreview(childDiv, themeName);
                        }
                    });

                    link.addEventListener('mouseout', () => {
                        if (!settingsUsePersistentPreviews() && !link.classList.contains('active')) {
                            clearPiecePreview(childDiv);
                        }
                    });

                    // Attach a click event listener
                    link.addEventListener('click', (event) => {
                        event.preventDefault(); // Prevent default link behavior if needed
                        
                        // Don't process if already active
                        if (link.classList.contains('active')) {
                            return;
                        }
                        
                        console.log(`clicker!`);
                        const linkValue = getThemeNameFromPreviewId(childDiv.id, 'piece');
                        console.log(`You clicked on: ${linkValue}`);
                        pieceTheme = linkValue.toLowerCase();
                        
                        // Ensure prefs is initialized
                        if (!prefs) {
                            prefs = JSON.stringify({
                                board_theme: boardTheme,
                                piece_theme: pieceTheme,
                                time_control: timeControl,
                                queen_autopromote: queenAutopromote,
                                highlight_moves: highlightMoves,
                                computer_level: computerLevel
                            });
                        }
                        
                        var preferences = JSON.parse(prefs)
                        preferences.piece_theme = pieceTheme
                        prefs = JSON.stringify(preferences);
                        localStorage.setItem("user_prefs", prefs);
                        setupThemes(pieceTheme, boardTheme);

                        setActiveSettingLink(subNavLinks, link);
                        syncPiecePreviews();
                    });
                }
            });
        }

        function attachColorThemeListener() {
            const subNavLinks = document.querySelectorAll('.board-sub-nav-link');

            function syncBoardPreviews() {
                const showAllPreviews = settingsUsePersistentPreviews();

                subNavLinks.forEach(link => {
                    const childDiv = link.querySelector('div');
                    if (!childDiv) {
                        return;
                    }

                    const themeName = getThemeNameFromPreviewId(childDiv.id, 'board');
                    if (showAllPreviews || link.classList.contains('active')) {
                        renderBoardPreview(childDiv, themeName);
                    } else {
                        clearBoardPreview(childDiv);
                    }
                });
            }
            
            // Set initial active state based on current boardTheme
            subNavLinks.forEach(link => {
                const childDiv = link.querySelector('div');
                if (childDiv) {
                    const linkValue = getThemeNameFromPreviewId(childDiv.id, 'board');
                    if (linkValue === boardTheme.toLowerCase()) {
                        setActiveSettingLink(subNavLinks, link);
                    }
                }
            });

            syncBoardPreviews();
            window.addEventListener('resize', syncBoardPreviews);
            
            // Iterate over each sub-nav-link
            subNavLinks.forEach(link => {
                // Find the `div` inside this link
                // Check if the `div` exists
                const childDiv = link.querySelector('div');
                if (childDiv) {
                    // Attach a hover event listener
                    link.addEventListener('mouseenter', () => {
                        if (settingsUsePersistentPreviews()) {
                            return;
                        }

                        // Don't show preview if this is the active item
                        if (!link.classList.contains('active')) {
                            const themeName = getThemeNameFromPreviewId(childDiv.id, 'board');
                            renderBoardPreview(childDiv, themeName);
                        }
                    });

                    link.addEventListener('mouseleave', () => {
                        // Reset preview
                        if (!settingsUsePersistentPreviews() && !link.classList.contains('active')) {
                            clearBoardPreview(childDiv);
                        }
                    });

                    // Attach a click event listener
                    link.addEventListener('click', (event) => {
                        event.preventDefault(); // Prevent default link behavior if needed
                        
                        // Don't process if already active
                        if (link.classList.contains('active')) {
                            return;
                        }
                        
                        console.log(`clicker!`);
                        const linkValue = getThemeNameFromPreviewId(childDiv.id, 'board');
                        console.log(`You clicked on: ${linkValue}`);
                        boardTheme = linkValue.toLowerCase();
                        
                        // Ensure prefs is initialized
                        if (!prefs) {
                            prefs = JSON.stringify({
                                board_theme: boardTheme,
                                piece_theme: pieceTheme,
                                time_control: timeControl,
                                queen_autopromote: queenAutopromote,
                                highlight_moves: highlightMoves,
                                computer_level: computerLevel
                            });
                        }
                        
                        var preferences = JSON.parse(prefs)
                        preferences.board_theme = boardTheme
                        prefs = JSON.stringify(preferences);
                        localStorage.setItem("user_prefs", prefs);
                        setupBoard(boardTheme);

                        setActiveSettingLink(subNavLinks, link);
                        syncBoardPreviews();
                    });
                }
            });
        }

        function attachComputerLevelListener() {
            const levelLinks = document.querySelectorAll('.computer-level-link');
            
            // Set initial active state based on current computerLevel
            levelLinks.forEach(link => {
                const level = parseInt(link.getAttribute('data-level'));
                if (level === computerLevel) {
                    setActiveSettingLink(levelLinks, link);
                }
            });
            
            levelLinks.forEach(link => {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    
                    // Don't process if already active
                    if (link.classList.contains('active')) {
                        return;
                    }
                    
                    const level = parseInt(link.getAttribute('data-level'));
                    console.log(`Computer level changed to: ${level}`);
                    computerLevel = level;
                    
                    // Ensure prefs is initialized
                    if (!prefs) {
                        prefs = JSON.stringify({
                            board_theme: boardTheme,
                            piece_theme: pieceTheme,
                            time_control: timeControl,
                            queen_autopromote: queenAutopromote,
                            highlight_moves: highlightMoves,
                            computer_level: computerLevel
                        });
                    }
                    
                    // Update preferences
                    var preferences = JSON.parse(prefs);
                    preferences.computer_level = computerLevel;
                    prefs = JSON.stringify(preferences);
                    localStorage.setItem("user_prefs", prefs);
                    
                    // Update stockfish skill level if engine is active
                    if (engine) {
                        stockfish_set_skill_level(computerLevel);
                    }
                    
                    setActiveSettingLink(levelLinks, link);
                });
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
                        resetBoard({"from": promotion_in_progress[0], "to": promotion_in_progress[1]});
                        promotion_in_progress = [];
                    }
                    elem.style.border = "3px solid #c8a96b";
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
            var toggle = document.getElementById("drawOfferedButton");
            // Treat anything other than an explicit "block" as closed so the
            // first click after the menu becomes visible always opens it
            // (the default CSS state is display:none with no inline style).
            var isOpen = inner_div.style.display === "block";
            inner_div.style.display = isOpen ? "none" : "block";
            inner_div.setAttribute("aria-hidden", String(isOpen));
            if (toggle) {
                toggle.setAttribute("aria-expanded", String(!isOpen));
            }
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
        /*
        function boardResize(x) {
            console.log('called board resize');
            if (x.matches) { // If media query matches
                board.resize;
            } else {
                board.resize();
            }
        }*/
    });

    socket.on("draw", function (ans) {
        if (ans.color === my_color) {
            // Got my own draw offer back
            if (ans.flag === 1) {    // I offered draw
                changeDrawButton('disabled')
            } else {                // I declined draw
                console.log("Got Draw that I declined")
                changeDrawButton('enabled')
            }
        } else {
            if (ans.flag === 1) {    // Draw offer
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
            }
            // flag == 5 (agreed): server pushes the new "game" event directly,
            // no client-side resync needed.
        } else {
            if (ans.flag == 4) {    // Rematch offered to me
                changeRematchButton('glow');
            } else if (ans.flag == 6) {    // Rematch declined
                changeRematchButton('disabled');
            }
            // flag == 5 (agreed): server pushes the new "game" event directly,
            // no client-side resync needed.
        }
    });

    function handleMoveOnBoard(the_move) {
        // chessboard.js doesn't handle castling, en-passant and pawn promotion correctly.
        console.log('This is the move handled! ' + JSON.stringify(the_move));
        resetBoard(the_move);
    }

    function resetBoard(last_move) {
        conf.movable.dests = getMovesMap();
        if (last_move)
            conf.lastMove = [last_move["from"], last_move["to"]];
        if (game.isGameOver() || game_over) {
            conf.premovable.enabled = false;
            conf.draggable.enabled = false;
            conf.selectable.enabled = false;
        }
        conf.turnColor = getColorFromTurn();
        conf.fen = game.fen();
        board.set(conf);
        setupThemes(pieceTheme, boardTheme);
    }

    function getMovesMap() {
        var moves_list = game.isGameOver() || game_over ? [] : game.moves({ verbose: true});
        var map = new Map() ;
        moves_list.forEach((move) => {
            if (!map.has(move["from"])) {
              map.set(move["from"], []);
            }
            map.get(move["from"]).push(move["to"]);
        });
        return map;
    }

    socket.on("move", function (ans) {
        // move recieved from server considered valid
        var the_move = ans.move;
        console.log('Got move data ' + JSON.stringify(ans));
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
        if (game.turn() !== the_move.color) {
            console.log('Got my own move back so quitting');
            return;      // Got my own move back
        }
        game.move(the_move.san);
        handleMoveOnBoard(the_move);
        removeHighlights();
        removeCheckAndMate();
        insertMove(the_move);
        changeDrawButton('enabled');

        highlight_check_mate();
        if (game.isCheckmate()) {
            game_over = true;
            return;
        }
        // handle future move
        console.log('the futureMoveData ' + futureMoveData);
        if (futureMoveData != null) {
            if (handlePromotion(futureMoveData.from, futureMoveData.to)) {
                futureMoveData = null;
                return;
            }
            console.log('about to perform premove ' + futureMoveData.from + " " + futureMoveData.to);
            var move = gameMove(futureMoveData.from, futureMoveData.to, promote);
            if (move != null) {
                var json = {
                    "sid": player_id,
                    "move": move
                };
                socket.emit("/api/move", json, function (ret) {
                    updateLastCall();
                    if (ret && ret.illegal) {
                        // Server rejected the premove. Roll back the
                        // speculative chess.js move and re-render from the
                        // authoritative FEN — no full heartbeat resync needed.
                        game.undo();
                        futureMoveData = null;
                        if (ret.fen) {
                            try {
                                game.load(ret.fen);
                            } catch (e) {
                                console.warn("Failed to load authoritative fen after illegal move", e);
                            }
                            resetBoard(null);
                        }
                        return;
                    }
                    if (ret == null || ret === false) {  // game already ended / late move
                        game.undo();
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
                    removeCheckAndMate();
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

    var heartbeatIntervalId = null;
    var HEARTBEAT_INTERVAL_MS = 5000;
    var HEARTBEAT_THROTTLE_MS = 5000;
    var HEARTBEAT_TYPE_SHORT = "short";
    var HEARTBEAT_TYPE_LONG = "long";

    function startHeartbeatLoop() {
        heartbeat();
        stopHeartbeatLoop();
        heartbeatIntervalId = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeatLoop() {
        if (heartbeatIntervalId !== null) {
            clearInterval(heartbeatIntervalId);
            heartbeatIntervalId = null;
        }
    }

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
            // Pause the loop while the tab is backgrounded — the browser may
            // throttle timers anyway, and we don't want stale checkins on resume.
            stopHeartbeatLoop();
            return;
        }
        // On resume, the socket may have been suspended and we may have missed
        // game events. Force a long sync to catch up, then restart the loop.
        heartbeat(HEARTBEAT_TYPE_LONG);
        stopHeartbeatLoop();
        heartbeatIntervalId = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    });

    // For Invite Friend guest (non-host), we must first register via /api/invite with waiting_id
    if (waitingId && inviteRole !== "host") {
        // Build minimal cookie_data similar to Quick Game header flow
        var rawPrefs = localStorage.getItem("user_prefs");
        var localPrefs;
        if (rawPrefs == null) {
            localPrefs = {
                "time_control": "5+0",
                "piece_theme": "classical",
                "board_theme": "classical",
                "computer_level": 5
            };
        } else {
            try {
                localPrefs = JSON.parse(rawPrefs);
            } catch (e) {
                localPrefs = {
                    "time_control": "5+0",
                    "piece_theme": "classical",
                    "board_theme": "classical",
                    "computer_level": 5
                };
            }
        }

        var session = localStorage.getItem("user_session");
        var localCookie;
        if (!session) {
            localCookie = {};
        } else {
            try {
                localCookie = JSON.parse(session) || {};
            } catch (e) {
                localCookie = {};
            }
        }
        localCookie.preferences = localPrefs;

        socket.emit("/api/invite", { "data": localCookie, "waiting_id": waitingId }, function (ans) {
            if (ans && ans.dst_sid) {
                localCookie.sid = ans.dst_sid;
            }
            localStorage.setItem("user_session", JSON.stringify(localCookie));
            // If inviter cancelled, BE returns extra_data with only 'user' (no 'waiting_id') – redirect to home
            var extra = ans && ans.extra_data;
            if (typeof extra === "string") {
                try {
                    extra = JSON.parse(extra);
                } catch (e) {
                    extra = {};
                }
            }
            if (!extra || !extra.waiting_id) {
                window.location.href = "/";
                return;
            }
            // Room is valid: keep overlay hidden and go straight to heartbeat; game will show when data arrives
            startHeartbeatLoop();
        });
    } else {
        // Regular Quick Game or Invite Friend host who already has sid
        startHeartbeatLoop();
    }

    function hideEndGameBoxes() {
        document.getElementById("conty").style.display = "none";
        document.getElementById("draw-box").style.display = "none";
        document.getElementById("win-box").style.display = "none";
        document.getElementById("lose-box").style.display = "none";
        document.getElementById("abort-box").style.display = "none";
    }

    function updateLastCall() {
        last_call = new Date().getTime();
    }

    function hideArrows() {
        document.getElementById("arrowRatingA").style.display = "none";
        document.getElementById("arrowRatingB").style.display = "none";
        var smallTop = document.getElementById("arrowRatingASmall");
        var smallBottom = document.getElementById("arrowRatingBSmall");
        if (smallTop) {
            smallTop.style.display = "none";
        }
        if (smallBottom) {
            smallBottom.style.display = "none";
        }
    }

    function syncBoardRelatedLayout() {
        var boardHolder = document.getElementById("boardHolder");
        var boxesHolder = document.getElementById("boxesHolder");
        var moveBox = document.getElementById("boxZ");
        var rightPane = document.getElementById("rightPane");

        if (!boardHolder || !boxesHolder || !moveBox || !rightPane) {
            return;
        }

        if (window.matchMedia("(min-width: 1200px)").matches) {
            // Read positions from the fully-laid-out DOM.
            // getBoundingClientRect() forces a synchronous layout so values are accurate.
            var boardRect = boardHolder.getBoundingClientRect();
            var rightRect = rightPane.getBoundingClientRect();

            var boardHeight = boardRect.height;
            if (!boardHeight) { return; }

            var topOffset = boardRect.top - rightRect.top;   // distance from rightPane top to board top

            // Safety guard: if rightPane has somehow wrapped below the board (topOffset < 0),
            // bail out so we don't place boxesHolder over the board.
            if (topOffset < 0) {
                boxesHolder.style.position = "";
                boxesHolder.style.top = "";
                boxesHolder.style.left = "";
                boxesHolder.style.right = "";
                boxesHolder.style.height = "";
                boxesHolder.style.marginTop = "";
                moveBox.style.height = "";
                return;
            }

            // Position boxesHolder absolutely so it sits exactly over the board area.
            // rightPane must be position:relative (set in CSS).
            boxesHolder.style.position = "absolute";
            boxesHolder.style.top = topOffset + "px";
            boxesHolder.style.left = "0";
            boxesHolder.style.right = "0";
            boxesHolder.style.height = boardHeight + "px";
            boxesHolder.style.marginTop = "";

            // moveBox fills whatever remains after the two player-box rows (auto height).
            // CSS grid-template-rows: auto 1fr auto handles this automatically.
            moveBox.style.height = "";
        } else {
            boxesHolder.style.position = "";
            boxesHolder.style.top = "";
            boxesHolder.style.left = "";
            boxesHolder.style.right = "";
            boxesHolder.style.height = "";
            boxesHolder.style.marginTop = "";
            moveBox.style.height = "";
        }

        if (board && typeof board.resize === "function") {
            board.resize();
        }
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
        var arrowSmall = document.getElementById(arrow + "Small");
        var labelSmall = document.getElementById(label + "Small");
        if (orient == 'up') {
            document.getElementById(arrow).innerHTML = "&#x2197(+" + delta +")";
            document.getElementById(arrow).style.color = "#c8a96b";
        } else if (orient == 'down') {
            document.getElementById(arrow).innerHTML = "&#x2198(" + delta +")";
            document.getElementById(arrow).style.color = "crimson";
        }
        if (arrowSmall) {
            arrowSmall.innerHTML = "";
            arrowSmall.style.display = "none";
        }
        document.getElementById(label).innerHTML = rating;
        if (labelSmall) {
            labelSmall.innerHTML = rating;
        }
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

    function updateMobileMoveIndex(currentIndex) {
        var mobileMoveIndex = document.getElementById("mobileMoveIndex");
        if (!mobileMoveIndex) {
            return;
        }

        if (!the_game_fens.length || currentIndex >= the_game_fens.length - 1) {
            mobileMoveIndex.textContent = "Live position";
            return;
        }

        mobileMoveIndex.textContent = "Move " + (currentIndex + 1) + " of " + the_game_fens.length;
    }

    function clearSelectedMoves() {
        document.querySelectorAll("#moveTable .selectedCell, #mobileMoveReel .selectedCell").forEach(function (element) {
            element.classList.remove("selectedCell");
        });
    }

    function highlightSelectedMove(position_in_array) {
        var row = Math.floor(position_in_array / 2);
        var cellIndex = (position_in_array % 2) + 1;
        var table = document.getElementById("moveTable");
        var reel = document.getElementById("mobileMoveReel");

        if (table.rows[row] && table.rows[row].cells[cellIndex]) {
            table.rows[row].cells[cellIndex].classList.add("selectedCell");
        }

        if (reel) {
            var chip = reel.querySelector('[data-move-index="' + position_in_array + '"]');
            if (chip) {
                chip.classList.add("selectedCell");
                // Scroll only the reel — never the page.
                // scrollIntoView with inline:"center" would scroll ALL ancestors including body.
                var chipLeft = chip.offsetLeft;
                var chipWidth = chip.offsetWidth;
                var reelWidth = reel.offsetWidth;
                var target = chipLeft - (reelWidth / 2) + (chipWidth / 2);
                reel.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
            }
        }

        updateMobileMoveIndex(position_in_array);
    }

    function renderMobileMoves() {
        var reel = document.getElementById("mobileMoveReel");
        if (!reel) {
            return;
        }

        reel.innerHTML = "";

        if (!the_game_moves.length) {
            updateMobileMoveIndex(the_game_fens.length - 1);
            return;
        }

        the_game_moves.forEach(function (move, index) {
            var moveButton = document.createElement("button");
            moveButton.type = "button";
            moveButton.className = "mobileMoveChip";
            moveButton.dataset.moveIndex = index.toString();
            moveButton.innerHTML =
                '<span class="mobileMoveChipMoveNo">' + (index + 1) + '</span>' +
                '<span class="mobileMoveChipSan">' + move + "</span>";
            moveButton.addEventListener("click", clickedCell, false);
            reel.appendChild(moveButton);
        });
    }

    function applyMovePosition(position_in_array) {
        if (position_in_array < 0 || position_in_array >= the_game_fens.length) {
            return;
        }

        currentMoveIndex = position_in_array;
        var selected_fen = the_game_fens[position_in_array];
        conf.fen = selected_fen;
        clearSelectedMoves();
        highlightSelectedMove(position_in_array);

        if (position_in_array < the_game_fens.length - 1) {
            removeCheckAndMate();
            conf.highlight.lastMove = false;
            conf.movable.dests = new Map();
            conf.movable.color = undefined;
            $board.style.opacity = 0.8;
        } else {
            conf.highlight.lastMove = true;
            conf.movable.dests = getMovesMap();
            conf.movable.color = my_color;
            conf.turnColor = getColorFromTurn();
            highlight_check_mate();
            $board.style.opacity = 1;
        }

        board.set(conf);
        setupThemes(pieceTheme, boardTheme);
        updateNavigationButtons();
    }

    function insertMove(move) {
        var previousIndex = getCurrentMoveIndex();
        var wasAtLive = previousIndex >= the_game_fens.length - 1;
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
        currentMoveIndex = wasAtLive ? the_game_fens.length - 1 : previousIndex;
        renderMobileMoves();
        clearSelectedMoves();
        highlightSelectedMove(currentMoveIndex);
        updateNavigationButtons();
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
            handle_move(moves[i], index, ttl, moves.length === 1);
        }
        currentMoveIndex = the_game_fens.length - 1;
        renderMobileMoves();
        clearSelectedMoves();
        if (currentMoveIndex >= 0) {
            highlightSelectedMove(currentMoveIndex);
        }
        updateNavigationButtons();
    }

    function insert_counter_cell(index, ttl) {
        var num_rows = document.getElementById("moveTable").rows.length;
        var cell = document.getElementById("moveTable").rows[num_rows - 1].insertCell(index);
        cell.innerHTML = Math.floor(ttl / 1000);
        cell.setAttribute("class", "timeCell");
        clearInterval(moveInterval);
        moveInterval = setInterval(function () {
            if (cell.innerHTML < 1) {
                console.log("No move was made on time. Game abandoned.");
                clearInterval(moveInterval);
            }
            else
                cell.innerHTML = cell.innerHTML - 1;
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
        var target = cell.currentTarget || cell.target;
        var position_in_array = -1;

        if (target && target.dataset && target.dataset.moveIndex !== undefined) {
            position_in_array = parseInt(target.dataset.moveIndex, 10);
        } else if (target && target.parentElement) {
            var row = target.parentElement.rowIndex;
            var index = target.cellIndex;
            position_in_array = row * 2 + (index - 1);
        }

        navigateToMove(position_in_array);
    }

    function getCurrentMoveIndex() {
        if (currentMoveIndex >= 0) {
            return currentMoveIndex;
        }

        var selectedCell = document.querySelector('#moveTable .selectedCell, #mobileMoveReel .selectedCell');
        if (selectedCell) {
            if (selectedCell.dataset && selectedCell.dataset.moveIndex !== undefined) {
                return parseInt(selectedCell.dataset.moveIndex, 10);
            }

            var row = selectedCell.parentElement.rowIndex;
            var index = selectedCell.cellIndex;
            return row * 2 + (index - 1);
        }
        return the_game_fens.length - 1;
    }

    function navigateToMove(position_in_array) {
        applyMovePosition(position_in_array);
    }

    function updateNavigationButtons() {
        var currentIndex = getCurrentMoveIndex();
        var groups = [
            ["firstMoveBtn", "mobileFirstMoveBtn"],
            ["prevMoveBtn", "mobilePrevMoveBtn"],
            ["nextMoveBtn", "mobileNextMoveBtn"],
            ["lastMoveBtn", "mobileLastMoveBtn"]
        ];

        groups.forEach(function (ids, groupIndex) {
            ids.forEach(function (id) {
                var button = document.getElementById(id);
                if (!button) {
                    return;
                }

                var shouldDisable = the_game_fens.length < 1;
                if (!shouldDisable) {
                    if (groupIndex < 2) {
                        shouldDisable = currentIndex <= 0;
                    } else {
                        shouldDisable = currentIndex >= the_game_fens.length - 1;
                    }
                }

                button.classList.toggle("disabled", shouldDisable);
                if (button.tagName === "BUTTON") {
                    button.disabled = shouldDisable;
                } else {
                    button.style.opacity = shouldDisable ? "0.45" : "1";
                }
            });
        });
    }

    function attachNavigationListeners() {
        var actions = {
            firstMoveBtn: function () { navigateToMove(0); },
            mobileFirstMoveBtn: function () { navigateToMove(0); },
            prevMoveBtn: function () { navigateToMove(getCurrentMoveIndex() - 1); },
            mobilePrevMoveBtn: function () { navigateToMove(getCurrentMoveIndex() - 1); },
            nextMoveBtn: function () { navigateToMove(getCurrentMoveIndex() + 1); },
            mobileNextMoveBtn: function () { navigateToMove(getCurrentMoveIndex() + 1); },
            lastMoveBtn: function () { navigateToMove(the_game_fens.length - 1); },
            mobileLastMoveBtn: function () { navigateToMove(the_game_fens.length - 1); }
        };

        Object.keys(actions).forEach(function (id) {
            var button = document.getElementById(id);
            if (!button) {
                return;
            }

            button.addEventListener("click", function () {
                if (!button.classList.contains("disabled") && !button.disabled) {
                    actions[id]();
                }
            });
        });

        updateNavigationButtons();
    }

    // Debounce resize so we only measure after the browser has finished
    // settling the layout. Firing on every pixel of a drag-resize gives
    // stale getBoundingClientRect values and causes the table to jump.
    var _syncLayoutTimer = null;
    window.addEventListener("resize", function () {
        clearTimeout(_syncLayoutTimer);
        _syncLayoutTimer = setTimeout(function () {
            requestAnimationFrame(syncBoardRelatedLayout);
        }, 120);
    });

    function heartbeat(type) {
        // Default behavior:
        //   - first call (heartbeatOK=false) -> "long" to fetch full game state
        //   - subsequent calls               -> "short" liveness ping
        // Callers can pass HEARTBEAT_TYPE_LONG explicitly to force a full sync
        // (e.g. on visibilitychange resume).
        if (type !== HEARTBEAT_TYPE_SHORT && type !== HEARTBEAT_TYPE_LONG) {
            type = heartbeatOK ? HEARTBEAT_TYPE_SHORT : HEARTBEAT_TYPE_LONG;
        }

        // Throttle "short" pings against any recent /api/* traffic — server now
        // bumps LAST_SEEN on every authenticated call, so an active player
        // doesn't need a redundant checkin on top.
        if (type === HEARTBEAT_TYPE_SHORT && last_call != null) {
            var now = Date.now();
            if (now - last_call < HEARTBEAT_THROTTLE_MS) {
                return;
            }
        }

        load_cookies();
        if (player_id == null) {
            return;
        }

        var d = new Date();
        console.log("Calling heartbeat at " + d.toLocaleTimeString() + " type=" + type + " heartbeatOK=" + heartbeatOK);

        var payload = { "data": { "type": type, "sid": player_id } };
        socket.emit("/api/heartbeat", payload, function (ans) {
            updateLastCall();
            // NOTE: heartbeatOK is intentionally NOT set here. It's set inside
            // socket.on("game") once a game has actually been loaded — that's
            // what flips future default heartbeats from "long" to "short". An
            // empty {} ack from a player still in the matchmaking pool must
            // keep us issuing long heartbeats until the game arrives.
            if (ans) {
                console.log("Got heartbeat response " + JSON.stringify(ans));
                emptyHeartbeats = 0;
                document.getElementById("gameBox").style.display = "flex";
                var connect_icons = document.getElementsByClassName("dottop");
                if (ans.rival_connect_status === 2) {
                    for (const icon of connect_icons)
                        icon.style.backgroundColor = "#c8a96b"
                } else if (ans.rival_connect_status === 3 && engine_sid != null) {
                    console.log("Rival disconnected")
                    for (const icon of connect_icons)
                        icon.style.backgroundColor = "crimson"
                }
            } else {
                emptyHeartbeats++;
                console.log("Got empty heartbeat response. emptyHeartbeats =", emptyHeartbeats, "waitingId =", waitingId);
                // For regular Quick Game, redirect home after a couple of empty heartbeats.
                // For Invite Friend flows (waitingId present), stay on the waiting screen instead.
                if (!waitingId && emptyHeartbeats > 1) {
                    window.location.href = "/";
                }
            }
        });
    }

    function load_cookies() {
        var storedSession = localStorage.getItem("user_session");
        try {
            cookie_data = (storedSession != null && storedSession !== "") ? JSON.parse(storedSession) : null;
        } catch (e) {
            cookie_data = null;
        }
        prefs = localStorage.getItem("user_prefs");
        var obj_prefs = null;
        try {
            obj_prefs = (prefs != null && prefs !== "") ? JSON.parse(prefs) : null;
        } catch (e) {
            obj_prefs = null;
        }
        if (cookie_data != null) {
            cookie_data.preferences = obj_prefs || {};
            player_id = cookie_data.sid;
        } else {
            player_id = null;
        }
        if (cookie_data && obj_prefs != null) {
            boardTheme = obj_prefs.board_theme || "classical";
            pieceTheme = obj_prefs.piece_theme || "classical";
            timeControl = obj_prefs.time_control || "5+0";
            queenAutopromote = obj_prefs.queen_autopromote || false;
            highlightMoves = obj_prefs.highlight_moves || false;
            computerLevel = obj_prefs.computer_level || 5;
            setClockGlow(obj_prefs.clock_glow);
        } else {
            // Ensure defaults are set even if no preferences exist
            boardTheme = "classical";
            pieceTheme = "classical";
            timeControl = "5+0";
            queenAutopromote = false;
            highlightMoves = false;
            computerLevel = 5;
        }
    }

    function removePremoveHighlight() {
        var collection = document.getElementsByClassName("current-premove");
        var d = collection.length;
        for(var i=0; i < d; i++) {
            console.log('Removing premove highlight ' + collection[0]['cgKey'] + " " + collection[0].className);
            collection[0].classList.remove("current-premove");
        }
        conf.premovable.current = null;
    }

    function highlight_check_mate() {
        const positions = document.getElementsByClassName(getColorFromTurn(game.turn()) + " king");
        if (game.isCheckmate()) {
            if (positions.length > 0)
                positions[0].classList.add('highlight-mate');
            game_over = true
        } else if (game.inCheck()) {
            if (positions.length > 0)
                positions[0].classList.add('highlight-check');
        }
    }

    function removeCheckAndMate() {
        let positions = document.getElementsByClassName("white king");
        positions[0].classList.remove("highlight-check");
        positions[0].classList.remove("highlight-mate");
        positions = document.getElementsByClassName("black king");
        positions[0].classList.remove("highlight-check");
        positions[0].classList.remove("highlight-mate");
        //$("img").css("box-shadow", "");
    }

    function removeHighlights() {
        removePremoveHighlight();
    }

    function is_my_turn() {
        var turn = game.turn();
        var mine = my_color.charAt(0);
        return turn === mine;
    }

    function getColorFromTurn() {
        var turn = game.turn();
        if (turn === 'b') {
            return 'black';
        }
        return 'white';
    }

    function gameMove(source, target, promote) {
        var move = null;
        console.log('Handling game move ' + source + " " + target)
        try {
            move = game.move({
                from: source,
                to: target,
                promotion: promote
            });
        }
        catch (e) {
            console.log(`Detected pre-move since move is invalid: ${move}`);
        }
        return move;
    }

    function onPreMoveSet(source, target) {
        if (source !== target) {
            futureMoveData = {from: source, to: target};
            let moves = game.moves({ verbose: true });
            // A pawn pushing forward needs the destination square to be empty,
            // so we must NOT pick an opponent reply that lands on it (which
            // would falsely flag the push as blocked). On a 2-square push the
            // pawn also passes through an intermediate square, which must be
            // empty too. For every other piece we keep the original heuristic
            // of preferring replies that land on `target`, which lets
            // capture-style premoves be validated.
            const sourcePiece = game.get(source);
            const isPawnForwardPush = sourcePiece && sourcePiece.type === 'p' && source[0] === target[0];
            const intermediateSquare = isPawnForwardPush && Math.abs(parseInt(source[1]) - parseInt(target[1])) === 2
                ? source[0] + (parseInt(source[1]) + parseInt(target[1])) / 2
                : null;
            const filtered = isPawnForwardPush
                ? moves.filter(move => move.to !== target && move.to !== intermediateSquare)
                : moves.filter(move => move.to === target);
            moves = filtered.length > 0 ? filtered : moves
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
                futureMoveData = null;
            }
        } else if (source === target) {
            futureMoveData = null;
            removeHighlights();
        } else {
            removeHighlights();
        }
    }

    function onPreMoveUnSet() {
        futureMoveData = null;
        removeHighlights();
    }

    function onDrop(source, target, captured) {
        // see if the move is legal
        console.log('onDrop invoked with ' + source + ' ' + target)
        if (handlePromotion(source, target)) {
            removeHighlights();
            return;
        }
        var move = gameMove(source, target, promote);
        if (!move) {
            // we now call onDrop for opponent moves as well so we need to skip here in this case
            console.log('skipping onDrop due to opponent move');
            return;
        }
        removeHighlights();
        // illegal move
        updateStatus();
        var json = {
            "sid": player_id,
            "move": move
        };
        if (move !== null) {
            removeCheckAndMate();

            if (move.san == "O-O-O" ||
                move.san == "O-O" ||
                move.san.indexOf("=") > -1 ||
                (move.san.indexOf("x") > -1 && move.flags == "e")
            ) {
                needsBoardRendering = true;
            }

            socket.emit("/api/move", json, function (ret) {
                updateLastCall();
                console.log("Answer from api/move " + JSON.stringify(ret));
                if (ret && ret.illegal) {
                    // Server rejected the move. Roll back the speculative
                    // chess.js move and re-render from authoritative FEN.
                    game.undo();
                    if (ret.fen) {
                        try {
                            game.load(ret.fen);
                        } catch (e) {
                            console.warn("Failed to load authoritative fen after illegal move", e);
                        }
                        resetBoard(null);
                    }
                    return;
                }
                insertMove(move);
                highlight_check_mate();
                if (!game_over) {
                    if (captured){
                        resetBoard(move);
                    }
                    if (ret && ret.remaining) {
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
        var curr_position = fenToObj(game.fen());
        var piece = curr_position[source];
        console.log('about to perform promotion, queenAutopromote:' + queenAutopromote + " target:" + target + " " + " promotion_in_progress: " + promotion_in_progress + " piece " + piece)
        if (!queenAutopromote && promotion_in_progress.length === 0 && (target[1] === "1" || target[1] === "8" ) && piece[1] === "P") {
            var move = gameMove(source, target, promote);
            if (move != null) {
                promotion_in_progress = [source, target];
                var pieceType = ["B", "N", "R", "Q"];
                console.log('promotion in progress')
                var themes = document.getElementsByClassName("promotionPieceHolder");
                for (var t = 0; t < themes.length; t++) {
                    var theme = themes.item(t);
                    var piece_theme = getPieceFuncByName(pieceTheme);
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
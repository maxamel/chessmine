$(document).ready(function () {
    var cookie_data = localStorage.getItem("user_session");
    var prefs = localStorage.getItem("user_prefs");
    var socket = io("https://APP_URL/connect", {
        transports: [ "polling", "websocket"],
        timestampParam: "timestamp",
        tryAllTransports: true,
        query: {
            nonce: (Math.random() + 1).toString(36).substring(8)
        }
    });

    function getOrInitPrefs() {
        let storedPrefs = localStorage.getItem("user_prefs");
        if (storedPrefs == null) {
            return {
                "time_control": "5+0",
                "piece_theme": "classical",
                "board_theme": "classical",
                "computer_level": 5
            };
        }
        try {
            return JSON.parse(storedPrefs);
        } catch (e) {
            return {
                "time_control": "5+0",
                "piece_theme": "classical",
                "board_theme": "classical",
                "computer_level": 5
            };
        }
    }

    function getOrInitCookie() {
        let storedCookie = localStorage.getItem("user_session");
        if (!storedCookie) {
            return {};
        }
        try {
            return JSON.parse(storedCookie) || {};
        } catch (e) {
            return {};
        }
    }

    // Quick Game time controls (all time-control links that are NOT invite-friend-time)
    var quick_time_controls = document.querySelectorAll(".time-control.sub-nav-link:not(.invite-friend-time)");
    quick_time_controls.forEach(function (elem) {
        elem.addEventListener("click", function () {
            $(".fullpage").fadeIn("fast");

            prefs = getOrInitPrefs();
            cookie_data = getOrInitCookie();

            console.log("Current prefs:", prefs);
            console.log("Setting time_control to: " + elem.textContent);

            prefs.time_control = elem.textContent;
            cookie_data.preferences = prefs;
            localStorage.setItem("user_prefs", JSON.stringify(prefs));

            socket.emit("/api/play", { "data": cookie_data }, function (ans) {
                cookie_data.sid = ans;
                localStorage.setItem("user_session", JSON.stringify(cookie_data));
                window.location.href = "/game";
            });
        });
    });

    // Invite Friend time controls
    var invite_time_controls = document.querySelectorAll(".invite-friend-time");
    invite_time_controls.forEach(function (elem) {
        elem.addEventListener("click", function () {
            $(".fullpage").fadeIn("fast");

            prefs = getOrInitPrefs();
            cookie_data = getOrInitCookie();

            console.log("Current prefs (invite):", prefs);
            console.log("Setting time_control for invite to: " + elem.textContent);

            prefs.time_control = elem.textContent;
            cookie_data.preferences = prefs;
            // For Invite Friend we always want a fresh room, not to be pulled back
            // into an existing ongoing game through an old sid.
            if (cookie_data.sid) {
                console.log("Clearing existing sid for Invite Friend flow:", cookie_data.sid);
                delete cookie_data.sid;
            }
            localStorage.setItem("user_prefs", JSON.stringify(prefs));

            socket.emit("/api/invite", { "data": cookie_data }, function (ans) {
                console.log("Response from /api/invite:", ans);
                // extra_data can be a JSON string (BE returns serialized dict) or an object
                var extra = ans && ans.extra_data;
                if (typeof extra === "string") {
                    try {
                        extra = JSON.parse(extra);
                    } catch (e) {
                        extra = {};
                    }
                }
                var waitingId = (extra && extra.waiting_id) || (ans && ans.waiting_id) || null;
                if (ans && ans.dst_sid) {
                    cookie_data.sid = ans.dst_sid;
                }
                localStorage.setItem("user_session", JSON.stringify(cookie_data));

                if (waitingId) {
                    window.location.href = "/game?waiting_id=" + encodeURIComponent(waitingId) + "&role=host";
                } else {
                    // Fallback: behave like quick game if something unexpected happens
                    window.location.href = "/game";
                }
            });
        });
    });
});
$(document).ready(function () {
    var socket = io("https://APP_URL/connect", {
        transports: ["polling", "websocket"],
        timestampParam: "timestamp",
        tryAllTransports: true,
        query: {
            nonce: (Math.random() + 1).toString(36).substring(8)
        }
    });

    function getDefaultPrefs() {
        return {
            "time_control": "5+0",
            "piece_theme": "classical",
            "board_theme": "classical",
            "computer_level": 5
        };
    }

    function getOrInitPrefs() {
        var storedPrefs = localStorage.getItem("user_prefs");
        if (!storedPrefs) {
            return getDefaultPrefs();
        }
        try {
            return JSON.parse(storedPrefs) || getDefaultPrefs();
        } catch (e) {
            return getDefaultPrefs();
        }
    }

    function getOrInitCookie() {
        var storedCookie = localStorage.getItem("user_session");
        if (!storedCookie) {
            return {};
        }
        try {
            return JSON.parse(storedCookie) || {};
        } catch (e) {
            return {};
        }
    }

    function closeMobileMenu() {
        document.body.classList.remove("site-mobile-menu-open");
        document.querySelectorAll(".site-mobile-subpanel.is-open").forEach(function (panel) {
            panel.classList.remove("is-open");
        });
        document.querySelectorAll(".site-mobile-toggle[aria-expanded='true']").forEach(function (toggle) {
            toggle.setAttribute("aria-expanded", "false");
        });
    }

    function toggleMobilePanel(toggleButton) {
        var targetId = toggleButton.getAttribute("data-mobile-target");
        var targetPanel = targetId ? document.getElementById(targetId) : null;

        if (!targetPanel) {
            return;
        }

        var isOpen = targetPanel.classList.contains("is-open");
        var parent = targetPanel.parentElement;

        if (parent) {
            Array.prototype.forEach.call(parent.children, function (child) {
                if (child !== targetPanel && child.classList && child.classList.contains("site-mobile-subpanel")) {
                    child.classList.remove("is-open");
                }
                if (child !== toggleButton && child.classList && child.classList.contains("site-mobile-toggle")) {
                    child.setAttribute("aria-expanded", "false");
                }
            });
        }

        targetPanel.querySelectorAll(".site-mobile-subpanel.is-open").forEach(function (panel) {
            panel.classList.remove("is-open");
        });
        targetPanel.querySelectorAll(".site-mobile-toggle[aria-expanded='true']").forEach(function (button) {
            button.setAttribute("aria-expanded", "false");
        });

        targetPanel.classList.toggle("is-open", !isOpen);
        toggleButton.setAttribute("aria-expanded", String(!isOpen));
    }

    function startQuickGame(timeControl) {
        var prefs = getOrInitPrefs();
        var cookieData = getOrInitCookie();

        prefs.time_control = timeControl.replace(/\s+/g, "");
        cookieData.preferences = prefs;
        localStorage.setItem("user_prefs", JSON.stringify(prefs));

        socket.emit("/api/play", { "data": cookieData }, function (ans) {
            cookieData.sid = ans;
            localStorage.setItem("user_session", JSON.stringify(cookieData));
            window.location.href = "/game";
        });
    }

    function startInvite(timeControl) {
        var prefs = getOrInitPrefs();
        var cookieData = getOrInitCookie();

        prefs.time_control = timeControl.replace(/\s+/g, "");
        cookieData.preferences = prefs;

        if (cookieData.sid) {
            delete cookieData.sid;
        }

        localStorage.setItem("user_prefs", JSON.stringify(prefs));

        socket.emit("/api/invite", { "data": cookieData }, function (ans) {
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
                cookieData.sid = ans.dst_sid;
            }

            localStorage.setItem("user_session", JSON.stringify(cookieData));

            if (waitingId) {
                window.location.href = "/game?waiting_id=" + encodeURIComponent(waitingId) + "&role=host";
            } else {
                window.location.href = "/game";
            }
        });
    }

    document.addEventListener("click", function (event) {
        var menuToggle = event.target.closest("[data-mobile-menu-toggle]");
        if (menuToggle) {
            event.preventDefault();
            document.body.classList.add("site-mobile-menu-open");
            return;
        }

        var menuClose = event.target.closest("[data-mobile-menu-close]");
        if (menuClose) {
            event.preventDefault();
            closeMobileMenu();
            return;
        }

        var mobileToggle = event.target.closest(".site-mobile-toggle");
        if (mobileToggle) {
            event.preventDefault();
            toggleMobilePanel(mobileToggle);
            return;
        }

        var playAction = event.target.closest("[data-play-action][data-time-control]");
        if (playAction) {
            event.preventDefault();

            var action = playAction.getAttribute("data-play-action");
            var timeControl = playAction.getAttribute("data-time-control");

            closeMobileMenu();

            if (action === "invite") {
                startInvite(timeControl);
            } else {
                startQuickGame(timeControl);
            }
            return;
        }

        var link = event.target.closest(".site-mobile-link[href]");
        if (link) {
            closeMobileMenu();
        }
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth >= 992) {
            closeMobileMenu();
        }
    });
});
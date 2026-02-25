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

    var time_controls = document.getElementsByClassName("time-control")
    for (let i = 0; i<time_controls.length; i++) {
      time_controls[i].addEventListener("click", function (event) {
        $(".fullpage").fadeIn("fast");
        
        // Always re-read prefs from localStorage to get latest values
        prefs = localStorage.getItem("user_prefs");
        cookie_data = localStorage.getItem("user_session");
        
        if (prefs == null) {
          prefs = {
            "time_control": "5+0",
            "piece_theme": "classical",
            "board_theme": "classical",
            "computer_level": 5
          }
        } else {
          prefs = JSON.parse(prefs);
        }
        
        console.log('Current prefs:', prefs);
        console.log('Setting time_control to: ' + time_controls[i].textContent);
        
        // Only update the time control, preserve other preferences
        prefs.time_control = time_controls[i].textContent;
        
        cookie_data = JSON.parse(cookie_data);
        if (cookie_data == null) {
          cookie_data = {}
        }
        
        cookie_data.preferences = prefs;
        localStorage.setItem("user_prefs", JSON.stringify(prefs));
        
        var res = socket.emit("/api/play", { "data": cookie_data }, function (ans) {
          // Save my sid
          cookie_data.sid = ans;
          localStorage.setItem("user_session", JSON.stringify(cookie_data));
          window.location.href = "/game";
        });
      });
    }
});
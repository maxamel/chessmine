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
        if (prefs == null) {
          prefs = {
            "time_control": "3 + 0",
            "piece_theme": "classical"
          }
        } else {
          prefs = JSON.parse(prefs);
        }
        console.log(prefs)
        console.log('The time_control before ' + prefs.time_control + " and what we're setting " + time_controls[i].textContent)
        prefs.time_control = time_controls[i].textContent;
        prefs.piece_theme = "classical";
        cookie_data = JSON.parse(cookie_data);
        if (cookie_data == null) {
          cookie_data = {}
        } else {
          if (cookie_data.preferences.piece_theme)
            prefs.piece_theme = cookie_data.preferences.piece_theme;
        }
        cookie_data.preferences = prefs;
        localStorage.setItem("user_prefs", JSON.stringify(prefs));
        var res = socket.emit("/api/play", { "data": cookie_data }, function (ans) {
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
});
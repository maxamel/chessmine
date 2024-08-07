import { getTimeRemaining } from './utils.js'

    var timeintervalA = null;
    var timeintervalB = null;
    var timecolorintervalA = null
    var timecolorintervalB = null
    var clockStatus = false;
    var clockGlow = false;

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

    function setClockGlow(clock_glow) {
        clockGlow = clock_glow;
    }

    function initializeClock(id, endtime) {
        var clock = document.getElementById(id);
        var clockspan = clock.children.item(0);
        var minutesSpan = clock.querySelector(".minutes");
        var secondsSpan = clock.querySelector(".seconds");
        var millisSpan = clock.querySelector(".millis");
        var lastClockSet = new Date().getTime();

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
            endtime -= now - lastClockSet;
            lastClockSet = now;
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

    function discardTimeInterval(str) {
        if (str === 'B') {
            clearInterval(timeintervalB);
            clearInterval(timecolorintervalB);
            var clock = document.getElementById("clockdivB");
            var clockspan = clock.children.item(0);
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

    export { initializeClock, setTime, discardTimeInterval, setClockGlow }
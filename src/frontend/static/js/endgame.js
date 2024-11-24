function showEndGame(color_win, msg, my_color) {

        var y = document.getElementById("conty");
        y.style.display = "block";
        y.style.opacity = "0.95";
        y.style.cursor = "grab"
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
        dragElement(x);
    }

    // Make the DIV element draggable:
    function dragElement(elmnt) {
      var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
      var element = elmnt
      if (document.getElementById(elmnt.id + "header")) {
        // if present, the header is where you move the DIV from:
        document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
      } else {
        // otherwise, move the DIV from anywhere inside the DIV:
        elmnt.onmousedown = dragMouseDown;
      }

      function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
        element.style.cursor = "grabbing"
      }

      function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
      }

      function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
        element.style.cursor = "grab"
      }
    }

    export { showEndGame }
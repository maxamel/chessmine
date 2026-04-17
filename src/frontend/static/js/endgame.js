function positionEndGameBox(box) {
    if (!box) {
        return;
    }

    var container = document.getElementById("boardHolder");
    if (!container) {
        return;
    }

    var width = box.offsetWidth || Math.min(container.clientWidth * 0.76, 320);
    var height = box.offsetHeight || Math.min(container.clientHeight * 0.76, 320);
    var left = (container.clientWidth - width) / 2;
    var top = (container.clientHeight - height) / 2;

    box.style.left = "";
    box.style.top = "";
    box.style.bottom = "";
    box.style.transform = "";
    box.style.left = Math.max(8, left) + "px";
    box.style.top = Math.max(8, top) + "px";
}

function updateEndGameCopy(box, msg, my_color) {
    var message = box.querySelector(".message p");
    var piece = box.querySelector(".endgame");

    if (message) {
        message.innerHTML = msg;
    }

    if (piece) {
        piece.innerHTML = my_color === "black" ? "&#x265A;" : "&#x2654;";
    }
}

function showEndGame(color_win, msg, my_color) {
    var overlay = document.getElementById("conty");
    var box = null;

    if (color_win === "Draw") {
        box = document.getElementById("draw-box");
    } else if (color_win === "Abort") {
        box = document.getElementById("abort-box");
    } else if (my_color === color_win) {
        box = document.getElementById("win-box");
    } else {
        box = document.getElementById("lose-box");
    }

    if (!overlay || !box) {
        return;
    }

    overlay.style.display = "flex";
    overlay.style.opacity = "1";
    overlay.querySelectorAll(".endgame-box").forEach(function (item) {
        item.style.display = "none";
    });

    updateEndGameCopy(box, msg, my_color);
    box.style.display = "block";
    positionEndGameBox(box);
    dragElement(box);
}

function dragElement(elmnt) {
    if (!elmnt || elmnt.dataset.dragInitialized === "true") {
        return;
    }

    var handle = elmnt.querySelector("[data-endgame-drag-handle]") || elmnt;
    var lastClientX = 0;
    var lastClientY = 0;

    function pointerMove(event) {
        var deltaX = event.clientX - lastClientX;
        var deltaY = event.clientY - lastClientY;
        lastClientX = event.clientX;
        lastClientY = event.clientY;

        elmnt.style.left = (elmnt.offsetLeft + deltaX) + "px";
        elmnt.style.top = (elmnt.offsetTop + deltaY) + "px";
        elmnt.style.bottom = "auto";
        elmnt.style.transform = "none";
    }

    function pointerUp() {
        window.removeEventListener("pointermove", pointerMove);
        window.removeEventListener("pointerup", pointerUp);
        elmnt.classList.remove("is-dragging");
        handle.style.cursor = "grab";
    }

    handle.addEventListener("pointerdown", function (event) {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        event.preventDefault();
        var rect = elmnt.getBoundingClientRect();
        var parentRect = elmnt.offsetParent.getBoundingClientRect();
        lastClientX = event.clientX;
        lastClientY = event.clientY;
        elmnt.style.left = rect.left - parentRect.left + "px";
        elmnt.style.top = rect.top - parentRect.top + "px";
        elmnt.style.bottom = "auto";
        elmnt.style.transform = "none";
        elmnt.classList.add("is-dragging");
        handle.style.cursor = "grabbing";
        window.addEventListener("pointermove", pointerMove);
        window.addEventListener("pointerup", pointerUp, { once: true });
    });

    elmnt.dataset.dragInitialized = "true";
}

window.addEventListener("resize", function () {
    document.querySelectorAll("#conty .endgame-box").forEach(function (box) {
        if (box.style.display === "block" && !box.classList.contains("is-dragging")) {
            positionEndGameBox(box);
        }
    });
});

export { showEndGame }
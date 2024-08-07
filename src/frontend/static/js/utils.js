

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

    function getTimeRemaining(endtime) {
        /*
            Get time remaining from endtime by extracting millis, seconds, minutes
         */
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

    export { getPieceFuncByName, getBoardColorsByName, getTimeRemaining }
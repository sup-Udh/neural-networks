(function() {
    var pressedKeys = {};

    function setKey(event, status) {
        var code = event.keyCode;
        var key;

        switch(code) {
        case 32:
            key = 'SPACE'; break;
        case 37:
            key = 'LEFT'; break;
        case 38:
            key = 'UP'; break;
        case 39:
            key = 'RIGHT'; break;
        case 40:
            key = 'DOWN'; break;
        case 88:
            key = 'JUMP'; break;
        case 90:
            key = 'RUN'; break;
        default:
            key = String.fromCharCode(code);
        }

        pressedKeys[key] = status;
    }

    function onKeyDown(e) {
        setKey(e, true);
    }

    function onKeyUp(e) {
        setKey(e, false);
    }

    function onBlur() {
        pressedKeys = {};
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    window.input = {
        isDown: function(key) {
            return pressedKeys[key.toUpperCase()];
        },
        reset: function() {
          pressedKeys['RUN'] = false;
          pressedKeys['LEFT'] = false;
          pressedKeys['RIGHT'] = false;
          pressedKeys['DOWN'] = false;
          pressedKeys['JUMP'] = false;
        },
        // React calls this when the game route unmounts, preventing duplicate
        // document-level handlers if the learner later returns to the page.
        destroy: function() {
          document.removeEventListener('keydown', onKeyDown);
          document.removeEventListener('keyup', onKeyUp);
          window.removeEventListener('blur', onBlur);
        }
    };
})();

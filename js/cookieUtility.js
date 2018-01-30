function createCookie(name, value,days) {
    if (localStorage) {
        localStorage.setItem(name, value);
    } else {
        if (days) {
            var date = new Date();
            var expires = "; expires="+date.toGMTString();
        }
        else var expires = "";
        document.cookie = name + "=" + value+expires + "; path=/";
    }
}

function readCookie(name) {
    if (localStorage) {
        return localStorage.getItem(name);
    } else {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }
}

function eraseCookie(name) {
    if (localStorage) {
        localStorage.removeItem(name);
    } else {
        createCookie(name,"",-1);
    }
}


exports.createCookie = createCookie;
exports.readCookie = readCookie;
exports.eraseCookie = eraseCookie;
/*
 * Adapted from: Version 1.0 12/25/99 Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 */

// Declare internals

var internals = {

    encodeChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    decodeChars: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
                  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
                  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63,
                  52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1,
                  -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
                  15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1,
                  -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
                  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1]
};


// Base64 encode

exports.encode = function (string) {

    var c1, c2, c3;

    var len = string.length;
    var i = 0;
    var result = '';

    while (i < len) {

        c1 = string.charCodeAt(i++) & 0xff;

        if (i === len) {

            result += internals.encodeChars.charAt(c1 >> 2);
            result += internals.encodeChars.charAt((c1 & 0x3) << 4);
            result += '===';
            break;
        }

        c2 = string.charCodeAt(i++);

        if (i === len) {

            result += internals.encodeChars.charAt(c1 >> 2);
            result += internals.encodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
            result += internals.encodeChars.charAt((c2 & 0xF) << 2);
            result += '=';
            break;
        }

        c3 = string.charCodeAt(i++);

        result += internals.encodeChars.charAt(c1 >> 2);
        result += internals.encodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
        result += internals.encodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
        result += internals.encodeChars.charAt(c3 & 0x3F);
    }

    return result;
};


// Base64 decode

exports.decode = function (string) {

    var c1, c2, c3, c4;

    var len = string.length;
    var i = 0;
    var result = '';

    while (i < len) {

        do {
            c1 = internals.decodeChars[string.charCodeAt(i++) & 0xff];
        }
        while (i < len && c1 === -1);

        if (c1 === -1) {
            break;
        }

        do {
            c2 = internals.decodeChars[string.charCodeAt(i++) & 0xff];
        }
        while (i < len && c2 === -1);

        if (c2 === -1) {
            break;
        }

        result += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));

        do {

            c3 = string.charCodeAt(i++) & 0xff;
            if (c3 === 61) {
                return result;
            }

            c3 = internals.decodeChars[c3];
        }
        while (i < len && c3 === -1);

        if (c3 === -1) {
            break;
        }

        result += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2));

        do {

            c4 = string.charCodeAt(i++) & 0xff;
            if (c4 === 61) {
                return result;
            }

            c4 = internals.decodeChars[c4];
        }
        while (i < len && c4 === -1);

        if (c4 === -1) {
            break;
        }

        result += String.fromCharCode(((c3 & 0x03) << 6) | c4);
    }

    return result;
};

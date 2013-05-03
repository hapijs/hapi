// Load modules

var Events = require('events');
var Stream = require('stream');
var StreamSearch = require('streamsearch');
var Utils = require('./utils');


var internals = {
    dashBuffer: new Buffer('-'),
    crlfBuffer: new Buffer('\r\n'),
    doubleCrlfBuffer: new Buffer('\r\n\r\n')
};


module.exports = internals.Parser = function (options) {

    var self = this;

    Stream.Writable.call(this);

    if (!options.headerFirst && typeof options.boundary !== 'string')
        throw new TypeError('Boundary required');

    if (typeof options.boundary === 'string')
        this.setBoundary(options.boundary);
    else
        this._bparser = undefined;

    this._headerFirst = options.headerFirst;

    this._dashes = 0;
    this._isPreamble = true;
    this._justMatched = false;
    this._firstWrite = true;
    this._inHeader = true;
    this._part = undefined;

    this._hparser = new HeaderParser();
    this._hparser.on('header', function (header) {
        self._inHeader = false;
        self._part.emit('header', header);
    });

    return this;
};

Utils.inherits(internals.Parser, Stream.Writable);


internals.Parser.prototype._write = function (data, encoding, cb) {

    if (this._headerFirst && this._isPreamble) {
        if (!this._part) {
            this._part = new PartStream();
            this.emit('preamble', this._part);
        }
        var r = this._hparser.push(data);
        if (!this._inHeader && r !== undefined && r < data.length)
            data = data.slice(r);
        else
            return cb();
    }

    // allows for "easier" testing
    if (this._firstWrite) {
        this._bparser.push(crlfBuffer);
        this._firstWrite = false;
    }

    this._bparser.push(data);

    cb();
};


internals.Parser.prototype.reset = function () {

    this._part = undefined;
    this._bparser = undefined;
    this._hparser = undefined;
};


internals.Parser.prototype.setBoundary = function (boundary) {

    var self = this;
    this._bparser = new StreamSearch('\r\n--' + boundary);
    this._bparser.on('info', function (isMatch, data, start, end) {
        self._oninfo(isMatch, data, start, end);
    });
};


internals.Parser.prototype._oninfo = function (isMatch, data, start, end) {

    var buf, self = this;

    if (!this._part && this._justMatched && data) {
        var i = 0;
        while (this._dashes < 2 && (start + i) < end) {
            if (data[start + i] === 45) {
                ++i;
                ++this._dashes;
            } else {
                if (this._dashes)
                    buf = internals.dashBuffer;
                this._dashes = 0;
                break;
            }
        }
        if (this._dashes === 2) {
            if ((start + i) < end && this._events.trailer)
                this.emit('trailer', data.slice(start + i, end));
            this.reset();
            process.nextTick(function () { self.emit('end'); });
        }
        if (this._dashes)
            return;
    }
    if (this._justMatched)
        this._justMatched = false;
    if (!this._part) {
        this._part = new PartStream();
        this.emit(this._isPreamble ? 'preamble' : 'part', this._part);
        if (!this._isPreamble)
            this._inHeader = true;
    }
    if (data && start < end) {
        if (this._isPreamble || !this._inHeader) {
            if (buf)
                this._part.push(buf);
            this._part.push(data.slice(start, end));
        } else if (!this._isPreamble && this._inHeader) {
            if (buf)
                this._hparser.push(buf);
            var r = this._hparser.push(data.slice(start, end));
            if (!this._inHeader && r !== undefined && r < end)
                this._oninfo(false, data, start + r, end);
        }
    }
    if (isMatch) {
        if (this._isPreamble)
            this._isPreamble = false;
        this._hparser.reset();
        this._part.push(null);
        this._part = undefined;
        this._justMatched = true;
        this._dashes = 0;
    }
};


function PartStream() {

    Stream.Readable.call(this);
};

Utils.inherits(PartStream, Stream.Readable);

PartStream.prototype._read = function (n) { };


function HeaderParser() {
    Events.EventEmitter.call(this);

    var self = this;
    this.buffer = '';
    this.header = {};
    this.finished = false;
    this.ss = new StreamSearch(doubleCrlfBuffer);
    this.ss.on('info', function (isMatch, data, start, end) {
        if (data)
            self.buffer += data.toString('ascii', start, end);
        if (isMatch) {
            if (self.buffer)
                self._parseHeader();
            self.ss.matches = self.ss.maxMatches;
            var header = self.header;
            self.header = {};
            self.buffer = '';
            self.finished = true;
            self.emit('header', header);
        }
    });
}
Utils.inherits(HeaderParser, Events.EventEmitter);

HeaderParser.prototype.push = function (data) {
    var r = this.ss.push(data);
    if (this.finished)
        return r;
};

HeaderParser.prototype.reset = function () {
    this.finished = false;
    this.buffer = '';
    this.header = {};
    this.ss.reset();
};

HeaderParser.prototype._parseHeader = function () {
    var lines = this.buffer.split(/\r\n/g), len = lines.length, m, h,
        modded = false;

    for (var i = 0; i < len; ++i) {
        if (lines[i].length === 0)
            continue;
        if (lines[i][0] === '\t' || lines[i][0] === ' ') {
            this.header[h][this.header[h].length - 1] += lines[i];
        } else {
            m = /^([^:]+):[ \t]?(.+)?$/.exec(lines[i]);
            if (m) {
                h = m[1].toLowerCase();
                if (m[2]) {
                    if (this.header[h] === undefined)
                        this.header[h] = [m[2]];
                    else
                        this.header[h].push(m[2]);
                } else
                    this.header[h] = [''];
            } else {
                this.buffer = lines[i];
                modded = true;
                break;
            }
        }
    }
    if (!modded)
        this.buffer = '';
};



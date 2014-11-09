// Load modules

var Stream = require('stream');
var Code = require('code');
var Hapi = require('..');
var Hoek = require('hoek');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('transmit()', function () {

    it('handles stream errors on the response after the response has been piped', function (done) {

        var handler = function (request, reply) {

            var TestStream = function () {

                Stream.Readable.call(this);
            };

            Hoek.inherits(TestStream, Stream.Readable);

            TestStream.prototype._read = function (size) {

                var self = this;

                if (this.isDone) {
                    return;
                }
                this.isDone = true;

                self.push('success');

                setImmediate(function () {

                    self.emit('error', new Error());
                });
            };

            var stream = new TestStream();
            return reply(stream);
        };

        var server = new Hapi.Server();
        server.connection();
        server.route({ method: 'GET', path: '/', handler: handler });

        server.inject('/', function (res) {

            expect(res.result).to.equal('success');
            done();
        });
    });
});

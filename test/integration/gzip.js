// Load modules

var expect = require('chai').expect;
var libPath = process.env.TEST_COV ? '../../lib-cov/' : '../../lib/';
var Hapi = require(libPath + 'hapi');
var Zlib = require("zlib");


describe('Payload', function() {
    var server = new Hapi.Server('0.0.0.0', 8080);
    var message = {"msg": "This message is going to be gzipped."};
    var badMessage = '{ this is just wrong }';
    
    var postHandler = {
        method: 'POST', 
        path: '/',
        config: {
            handler: function(req) {
                req.reply(req.payload)
            }
        }
    }
    server.addRoute(postHandler);
    
    it('returns without error if given gzipped payload', function(done) {
        var input = JSON.stringify(message);
        
        Zlib.deflate(input, function(err, buf) {
            var request = {
                method: 'POST',
                url: '/',
                headers: {
                  'content-type': "application/json",
                  'content-encoding': "gzip",
                  'content-length': buf.length
                },
                payload: buf
            }
            
            server.inject(request, function (res) {
                expect(res.result).to.exist;
                expect(res.result).to.deep.equal(message);
                done();
            })
        })
    })
    
    it('returns without error if given non-gzipped payload', function(done) {
        var payload = JSON.stringify(message);
        
        var request = {
            method: 'POST',
            url: '/',
            headers: {
              'content-type': "application/json",
              'content-length': payload.length
            },
            payload: payload
        }
        
        server.inject(request, function (res) {
            expect(res.result).to.exist;
            expect(res.result).to.deep.equal(message);
            done();
        })
    })
    
    it('returns error if given non-JSON gzipped payload when expecting gzip', function(done) {
        Zlib.deflate(badMessage, function(err, buf) {
            var request = {
                method: 'POST',
                url: '/',
                headers: {
                  'content-type': "application/json",
                  'content-encoding': "gzip",
                  'content-length': buf.length
                },
                payload: buf
            }
            
            server.inject(request, function (res) {
                expect(res.result).to.exist;
                expect(res.result.message).to.exist;
                expect(res.result.message).to.equal('Invalid JSON body');
                done();
            })
        })
    })
})
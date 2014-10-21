// Load modules

var Fs = require('fs');
var Path = require('path');
var Code = require('code');
var Boom = require('boom');
var Hapi = require('..');
var Lab = require('lab');


// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


describe('Directory', function () {

    it('returns a 403 when no index exists and listing is disabled', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: '.' } } });      // Use '.' to test path normalization

        server.inject('/directory/', function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('returns a 403 when requesting a path containing \'..\'', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: './' } } });

        server.inject('/directory/..', function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('returns a 404 when requesting an unknown file within a directory', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: './' } } });

        server.inject('/directory/xyz', function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('returns a file when requesting a file from the directory', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: './' } } });

        server.inject('/directory/response.js', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('hapi');
            done();
        });
    });

    it('returns a file when requesting a file from multi directory setup', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/multiple/{path*}', handler: { directory: { path: ['./', '../'], listing: true } } });

        server.inject('/multiple/package.json', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('name": "hapi"');
            done();
        });
    });

    it('returns a file when requesting a file from multi directory function response', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/multiple/{path*}', handler: { directory: { path: function () { return ['./', '../']; }, listing: true } } });

        server.inject('/multiple/package.json', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('name": "hapi"');
            done();
        });
    });

    it('returns the correct file when requesting a file from a child directory', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: './' } } });

        server.inject('/directory/directory/index.html', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('test');
            done();
        });
    });

    it('returns the correct listing links when viewing top level path', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('href="/response.js"');
            done();
        });
    });

    it('does not contain any double / when viewing sub path listing', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/showindex/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('/showindex/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.not.contain('//');
            done();
        });
    });

    it('has the correct link to sub folders when inside of a sub folder listing', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/showindex/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('/showindex/directory/subdir/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('href="/showindex/directory/subdir/subsubdir"');
            done();
        });
    });

    it('has the correct link to a sub folder with spaces when inside of a sub folder listing', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/showindex/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('/showindex/directory/subdir/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('href="/showindex/directory/subdir/sub%20subdir%3D"');
            done();
        });
    });

    it('has the correct link to a file when inside of a listing of a sub folder that is inside a subfolder with spaces', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/showindex/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('/showindex/directory/subdir/sub%20subdir%3D/subsubsubdir/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('href="/showindex/directory/subdir/sub%20subdir%3D/subsubsubdir/test.txt"');
            done();
        });
    });

    it('returns the correct file when requesting a file from a directory with spaces', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('/directory/directory/subdir/sub%20subdir%3D/test%24.json', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('{"test":"test"}');
            done();
        });
    });

    it('returns the correct file when requesting a file from a directory that its parent directory has spaces', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('/directory/directory/subdir/sub%20subdir%3D/subsubsubdir/test.txt', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.equal('test');
            done();
        });
    });

    it('returns a 403 when index and listing are disabled', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directoryx/{path*}', handler: { directory: { path: '../', index: false } } });

        server.inject('/directoryx/', function (res) {

            expect(res.statusCode).to.equal(403);
            done();
        });
    });

    it('returns a list of files when listing is enabled', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directorylist/{path*}', handler: { directory: { path: '../', listing: true } } });

        server.inject('/directorylist/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('package.json');
            done();
        });
    });

    it('returns a list of files for subdirectory', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directorylist/{path*}', handler: { directory: { path: '../', listing: true } } });

        server.inject('/directorylist/test/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('server.js');
            done();
        });
    });

    it('returns a list of files when listing is enabled and index disabled', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directorylistx/{path*}', handler: { directory: { path: '../', listing: true, index: false } } });

        server.inject('/directorylistx/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('package.json');
            done();
        });
    });

    it('returns the index when found', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directoryIndex/{path*}', handler: { directory: { path: './directory/' } } });

        server.inject('/directoryIndex/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('<p>test</p>');
            done();
        });
    });

    it('returns the index when found in hidden folder', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory/.dot' } } });

        server.inject('/index.html', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('<p>test</p>');

            server.inject('/', function (res) {

                expect(res.statusCode).to.equal(200);
                expect(res.payload).to.contain('<p>test</p>');
                done();
            });
        });
    });

    it('returns listing when found in hidden folder', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/{path*}', handler: { directory: { path: './directory/.dot', index: false, listing: true } } });

        server.inject('/', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('index.html');
            done();
        });
    });

    it('returns a 500 when index.html is a directory', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname }, debug: false });
        server.route({ method: 'GET', path: '/directoryIndex/{path*}', handler: { directory: { path: './directory/' } } });

        server.inject('/directoryIndex/invalid/', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('returns the correct file when using a fn directory handler', function (done) {

        var directoryFn = function (request) {

            return '../lib';
        };

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directoryfn/{path?}', handler: { directory: { path: directoryFn } } });

        server.inject('/directoryfn/defaults.js', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('export');
            done();
        });
    });

    it('returns listing with hidden files when hidden files should be shown', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/showhidden/{path*}', handler: { directory: { path: './', showHidden: true, listing: true } } });

        server.inject('/showhidden/', function (res) {

            expect(res.payload).to.contain('.hidden');
            done();
        });
    });

    it('returns listing without hidden files when hidden files should not be shown', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/noshowhidden/{path*}', handler: { directory: { path: './', listing: true } } });

        server.inject('/noshowhidden/', function (res) {

            expect(res.payload).to.not.contain('.hidden');
            expect(res.payload).to.contain('response.js');
            done();
        });
    });

    it('returns a 404 response when requesting a hidden file when showHidden is disabled', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/noshowhidden/{path*}', handler: { directory: { path: './', listing: true } } });

        server.inject('/noshowhidden/.hidden', function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('returns a file when requesting a hidden file when showHidden is enabled', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/showhidden/{path*}', handler: { directory: { path: './', showHidden: true, listing: true } } });

        server.inject('/showhidden/.hidden', function (res) {

            expect(res.payload).to.contain('Ssssh!\n');
            done();
        });
    });

    it('redirects to the same path with / appended if asking for a directory', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/redirect/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('http://example.com/redirect/directory/subdir', function (res) {

            expect(res.statusCode).to.equal(302);
            expect(res.headers.location).to.equal('http://example.com/redirect/directory/subdir/');
            done();
        });
    });

    it('does not redirect to the same path with / appended redirectToSlash disabled', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/redirect/{path*}', handler: { directory: { path: './', index: true, listing: true, redirectToSlash: false } } });

        server.inject('http://example.com/redirect/directory/subdir', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.contain('<html>');
            done();
        });
    });

    it('does not redirect to the same path with / appended when server stripTrailingSlash is true', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname }, router: { stripTrailingSlash: true } });
        server.route({ method: 'GET', path: '/redirect/{path*}', handler: { directory: { path: './', index: true, listing: true } } });

        server.inject('http://example.com/redirect/directory/subdir', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.contain('<html>');
            done();
        });
    });

    it('ignores unused path params', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/{ignore}/4/{path*}', handler: { directory: { path: './' } } });

        server.inject('/crap/4/response.js', function (res) {

            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.contain('hapi');
            done();
        });
    });

    it('returns error when failing to prepare file response due to bad state', function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname }, debug: false });
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: './' } } });

        server.ext('onRequest', function (request, reply) {

            reply.state('bad', {});
            reply();
        });

        server.inject('/directory/response.js', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('returns error when listing fails due to directory read error', { parallel: false }, function (done) {

        var server = new Hapi.Server({ files: { relativeTo: __dirname } });
        server.route({ method: 'GET', path: '/directorylist/{path*}', handler: { directory: { path: '../', listing: true } } });

        var orig = Fs.readdir;
        Fs.readdir = function (path, callback) { Fs.readdir = orig; callback(new Error('Simulated Directory Error')); };
        server.inject('/directorylist/', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('appends default extension', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: __dirname, defaultExtension: 'html' } } });

        server.inject('/directory/directory/index', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('appends default extension when resource ends with /', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: __dirname, defaultExtension: 'html' } } });

        server.inject('/directory/directory/index/', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('appends default extension and fails to find file', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: __dirname, defaultExtension: 'html' } } });

        server.inject('/directory/directory/none', function (res) {

            expect(res.statusCode).to.equal(404);
            done();
        });
    });

    it('does not append default extension when directory exists', function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/directory/{path*}', handler: { directory: { path: __dirname, defaultExtension: 'html' } } });

        server.inject('/directory/directory', function (res) {

            expect(res.statusCode).to.equal(302);
            done();
        });
    });

    it('resolves windows path name from pack using root path', { skip: process.platform !== 'win32' }, function (done) {

        // Note: This uses a root path of where the test file lives (to simulate requiring a pack), which is why the
        //       directory handler path is ./directory instead of ./test/directory like the other test below

        var pack = {
            name: 'directory test',
            version: '1.0',
            path: __dirname,
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/test/{path*}', config: { handler: { directory: { path: './directory', index: false, listing: false } } } });
                return next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(pack, {}, function () { });

        server.inject('/test/index.html', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('resolves windows path name from pack using relative path', { skip: process.platform !== 'win32' }, function (done) {

        // Note: This simulates a pack which is not "required", and therefore doesn't have a path set. This will use
        //       the process' root directory then, so the directory handler needs to specify the path relative to that

        var pack = {
            name: 'directory test',
            version: '1.0',
            register: function (plugin, options, next) {

                plugin.route({ method: 'GET', path: '/test/{path*}', config: { handler: { directory: { path: './test/directory', index: false, listing: false } } } });
                return next();
            }
        };

        var server = new Hapi.Server();
        server.pack.register(pack, {}, function () { });

        server.inject('/test/index.html', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('resolves root pathnames on windows', { skip: process.platform !== 'win32' }, function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/test/{path*}', handler: { directory: { path: Path.join(__dirname, 'directory') } } });

        server.inject('/test/index.html', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('resolves relative pathnames on windows', { skip: process.platform !== 'win32' }, function (done) {

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/test/{path*}', handler: { directory: { path: './test/directory' } } });

        server.inject('/test/index.html', function (res) {

            expect(res.statusCode).to.equal(200);
            done();
        });
    });

    it('returns error when path function returns error', function (done) {

        var path = function () {

            return Boom.badRequest('Really?!');
        };

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/test/{path*}', handler: { directory: { path: path } } });

        server.inject('/test/index.html', function (res) {

            expect(res.statusCode).to.equal(400);
            expect(res.result.message).to.equal('Really?!');
            done();
        });
    });

    it('returns error when path function returns invalid response', function (done) {

        var path = function () {

            return 5;
        };

        var server = new Hapi.Server({ debug: false });
        server.route({ method: 'GET', path: '/test/{path*}', handler: { directory: { path: path } } });

        server.inject('/test/index.html', function (res) {

            expect(res.statusCode).to.equal(500);
            done();
        });
    });

    it('returns a gzipped file using precompressed file', function (done) {

        var content = Fs.readFileSync('./test/file/image.png.gz');

        var server = new Hapi.Server();
        server.route({ method: 'GET', path: '/{p*}', handler: { directory: { path: './test/file', lookupCompressed: true } } });

        server.inject({ url: '/image.png', headers: { 'accept-encoding': 'gzip' } }, function (res) {

            expect(res.headers['content-type']).to.equal('image/png');
            expect(res.headers['content-encoding']).to.equal('gzip');
            expect(res.headers['content-length']).to.equal(content.length);
            expect(res.payload.length).to.equal(content.length);
            done();
        });
    });
});

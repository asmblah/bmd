/*
 * BMD - Basic Module Definition
 * http://asmblah.github.com/bmd/
 *
 * Released under the MIT license
 * https://github.com/asmblah/bmd/raw/master/MIT-LICENSE.txt
 */

/*global require */
'use strict';

var _ = require('_'),
    esprima = require('../vendor/esprima.js'),
    BMD = require('bmd').BMD;

describe('require() with dependencies', function () {
    var bmd,
        bmdRequire,
        entryModuleExports,
        responseTexts;

    beforeEach(function () {
        responseTexts = {};

        function FakeXMLHttpRequest() {}

        FakeXMLHttpRequest.prototype = {
            open: function (method, uri, async) {
                this.method = method;
                this.uri = uri;
                this.async = async;
            },
            send: function () {
                if (!{}.hasOwnProperty.call(responseTexts, this.uri)) {
                    throw new Error('Stub dependency "' + this.uri + '" not defined, only ' + Object.keys(responseTexts));
                }

                this.readyState = 4;
                this.status = 0;
                this.responseText = responseTexts[this.uri];
                this.onload();
            }
        };

        bmd = new BMD(FakeXMLHttpRequest, 'http://my.app/path/');
        bmdRequire = bmd.createRequirer();

        bmd.createDefiner()('../vendor/esprima.js', esprima);
    });

    _.each({
        'when the dependency is referenced with a directory-relative path, current directory': {
            modules: {
                '/path/lib.js': 'exports.myResult = 7;',
                '/path/entry.js': 'exports.theLib = require("./lib");'
            },
            entry: './entry',
            expectedExports: {
                theLib: {
                    myResult: 7
                }
            }
        },
        'when the dependency is referenced with a parent directory-relative path above the entry module': {
            modules: {
                '/path/lib.js': 'exports.myResult = 7;',
                '/path/stuff/entry.js': 'exports.theLib = require("../lib");'
            },
            entry: './stuff/entry',
            expectedExports: {
                theLib: {
                    myResult: 7
                }
            }
        },
        'when the dependency is referenced with a parent directory-relative path below the entry module': {
            modules: {
                '/path/stuff/things/lib2.js': 'exports.theLib1 = require("../lib1");',
                '/path/stuff/lib1.js': 'exports.myResult = 6;',
                '/path/stuff/entry.js': 'exports.theLib2 = require("./things/lib2");'
            },
            entry: './stuff/entry',
            expectedExports: {
                theLib2: {
                    theLib1: {
                        myResult: 6
                    }
                }
            }
        },
        'when the dependency is referenced with a directory-relative path above the base path': {
            modules: {
                '/lib.js': 'exports.myResult = 22;',
                '/path/entry.js': 'exports.theLib = require("../lib");'
            },
            entry: './entry',
            expectedExports: {
                theLib: {
                    myResult: 22
                }
            }
        }
    }, function (scenario, description) {
        describe(description, function () {
            beforeEach(function (done) {
                _.each(scenario.modules, function (code, name) {
                    responseTexts['http://my.app' + name] = code;
                });

                bmdRequire(scenario.entry, function (moduleExports) {
                    entryModuleExports = moduleExports;

                    done();
                });
            });

            it('should result in the expected exports', function () {
                expect(entryModuleExports).to.deep.equal(scenario.expectedExports);
            });
        });
    });
});

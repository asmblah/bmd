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

describe('Path mappings', function () {
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
        'when the dependency is referenced with its full name': {
            modules: {
                '/path/lib.js': 'exports.myResult = 7;',
                '/path/entry.js': 'exports.theLib = require("my-special-dep");'
            },
            entry: './entry',
            config: {
                paths: {
                    'my-special-dep': '/lib.js'
                }
            },
            expectedExports: {
                theLib: {
                    myResult: 7
                }
            }
        },
        'when the mapping is for a directory': {
            modules: {
                '/path/my/stuff/js/World.js': 'exports.World = 41;',
                '/path/entry.js': 'exports.myExports = require("my-lib/js/World");'
            },
            entry: './entry',
            config: {
                paths: {
                    'my-lib': '/my/stuff'
                }
            },
            expectedExports: {
                myExports: {
                    World: 41
                }
            }
        }
    }, function (scenario, description) {
        describe(description, function () {
            beforeEach(function (done) {
                _.each(scenario.modules, function (code, name) {
                    responseTexts['http://my.app' + name] = code;
                });

                bmdRequire(scenario.config, scenario.entry, function (moduleExports) {
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

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

describe('Node.js compatibility', function () {
    var bmd,
        bmdRequire,
        entryModuleExports,
        errorResponses,
        responseTexts;

    beforeEach(function () {
        responseTexts = {};
        errorResponses = {};

        function FakeXMLHttpRequest() {}

        FakeXMLHttpRequest.prototype = {
            open: function (method, uri, async) {
                this.method = method;
                this.uri = uri;
                this.async = async;
            },
            send: function () {
                if (!{}.hasOwnProperty.call(responseTexts, this.uri) && !{}.hasOwnProperty.call(errorResponses, this.uri)) {
                    throw new Error('Stub dependency "' + this.uri + '" not defined, only ' + Object.keys(responseTexts));
                }

                this.readyState = 4;
                this.status = 0;

                if ({}.hasOwnProperty.call(responseTexts, this.uri)) {
                    this.responseText = responseTexts[this.uri];
                    this.onload();
                } else {
                    this.responseText = errorResponses[this.uri];
                    this.onerror();
                }
            }
        };

        bmd = new BMD(FakeXMLHttpRequest, 'http://my.app/path/');
        bmdRequire = bmd.createRequirer();

        bmd.createDefiner()('../vendor/esprima.js', esprima);
    });

    _.each({
        'when another folder is required': {
            modules: {
                '/path/a/folder/index.js': 'exports.myResult = 22;',
                '/path/entry.js': 'exports.theLib = require("a/folder/");'
            },
            entry: './entry',
            expectedExports: {
                theLib: {
                    myResult: 22
                }
            }
        },
        'when the current folder is required': {
            modules: {
                '/path/index.js': 'exports.myResult = 21;',
                '/path/entry.js': 'exports.theLib = require(".");'
            },
            entry: './entry',
            expectedExports: {
                theLib: {
                    myResult: 21
                }
            }
        },
        'when an implicitly-referenced index.js refers to a file in its own directory': {
            modules: {
                '/path/js/World.js': 'exports.World = 42;',
                '/path/js/index.js': 'exports.myClasses = require("./World");',
                '/path/entry.js': 'exports.myExports = require("./js");'
            },
            errorResponses: {
                '/path/js.js': ''
            },
            entry: './entry',
            expectedExports: {
                myExports: {
                    myClasses: {
                        World: 42
                    }
                }
            }
        },
        'when a module refers to an immediate dependency\'s index module by name': {
            modules: {
                '/path/package.json': JSON.stringify({
                    'main': 'entry',
                    'dependencies': {
                        'cool-lib': '0.1.x'
                    }
                }),
                '/path/node_modules/cool-lib/package.json': JSON.stringify({
                    'main': 'cool-index'
                }),
                '/path/node_modules/cool-lib/cool-index.js': 'exports.cool = "Yeah!";',
                '/path/entry.js': 'exports.myExports = require("cool-lib");'
            },
            entry: './entry',
            expectedExports: {
                myExports: {
                    cool: 'Yeah!'
                }
            }
        },
        'when a module refers to the parent dependency\'s index module by name': {
            modules: {
                '/path/package.json': JSON.stringify({
                    'main': 'entry',
                    'dependencies': {
                        'parent-lib': '0.1.x'
                    }
                }),

                '/path/node_modules/parent-lib/package.json': JSON.stringify({
                    'main': 'parent-index'
                }),

                '/path/node_modules/parent-lib/node_modules/child-lib/package.json': JSON.stringify({
                    'main': 'child-index',
                    'dependencies': {
                        'child-lib': '0.1.x'
                    }
                }),

                '/path/node_modules/parent-lib/parent-index.js': 'exports.myValue = 21;',
                '/path/node_modules/parent-lib/node_modules/child-lib/child-index.js': 'exports.myResult = require("parent-lib");',
                '/path/entry.js': 'exports.myExports = require("./node_modules/parent-lib/node_modules/child-lib/child-index");'
            },
            entry: './entry',
            expectedExports: {
                myExports: {
                    myResult: {
                        myValue: 21
                    }
                }
            }
        }
    }, function (scenario, description) {
        describe(description, function () {
            beforeEach(function (done) {
                _.each(scenario.modules, function (code, name) {
                    responseTexts['http://my.app' + name] = code;
                });

                _.each(scenario.errorResponses, function (code, name) {
                    errorResponses['http://my.app' + name] = code;
                });

                bmdRequire(scenario.config || {}, scenario.entry, function (moduleExports) {
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

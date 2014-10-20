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
                this.onreadystatechange();
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
            entry: 'entry',
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
            entry: 'entry',
            expectedExports: {
                theLib: {
                    myResult: 21
                }
            }
        }
    }, function (scenario, description) {
        describe(description, function () {
            beforeEach(function (done) {
                _.each(scenario.modules, function (code, name) {
                    responseTexts['http://my.app' + name] = code;
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

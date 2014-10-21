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
    BMD = require('bmd').BMD;

describe('require() with no dependencies', function () {
    var bmdRequire,
        lastModuleExports,
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

        bmdRequire = new BMD(FakeXMLHttpRequest, 'http://my.app/path/').createRequirer();
    });

    describe('when the module is empty', function () {
        beforeEach(function (done) {
            responseTexts['http://my.app/path/my-module.js'] = '';

            bmdRequire('./my-module', function (moduleExports) {
                lastModuleExports = moduleExports;

                done();
            });
        });

        it('should leave the module exports as an empty object', function () {
            expect(lastModuleExports).to.deep.equal({});
        });
    });

    describe('when the module adds a property to the provided exports', function () {
        _.each({
            'when value is a number': {
                script: 'exports.myResult = 7;',
                expectedExports: {
                    myResult: 7
                }
            },
            'when value is an object': {
                script: 'exports.myStuff = {result: 4};',
                expectedExports: {
                    myStuff: {result: 4}
                }
            }
        }, function (scenario, description) {
            describe(description, function () {
                beforeEach(function (done) {
                    responseTexts['http://my.app/path/my-module.js'] = scenario.script;

                    bmdRequire('./my-module', function (moduleExports) {
                        lastModuleExports = moduleExports;

                        done();
                    });
                });

                it('should add the property', function () {
                    expect(lastModuleExports).to.deep.equal(scenario.expectedExports);
                });
            });
        });
    });
});

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
    BMD = require('../bmd').BMD;

describe('require()', function () {
    var bmdRequire,
        lastModuleExports,
        responseText;

    beforeEach(function () {
        function FakeXMLHttpRequest() {}

        FakeXMLHttpRequest.prototype = {
            open: function (method, uri, async) {
                this.method = method;
                this.uri = uri;
                this.async = async;
            },
            send: function () {
                this.readyState = 4;
                this.responseText = responseText;
                this.onreadystatechange();
            }
        };

        bmdRequire = new BMD(FakeXMLHttpRequest).createRequirer();
    });

    describe('when the module is empty', function () {
        beforeEach(function (done) {
            responseText = '';

            bmdRequire('my-module', function (moduleExports) {
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
                    responseText = scenario.script;

                    bmdRequire('my-module', function (moduleExports) {
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

/*
 * BMD - Basic Module Definition
 * http://asmblah.github.com/bmd/
 *
 * Released under the MIT license
 * https://github.com/asmblah/bmd/raw/master/MIT-LICENSE.txt
 */

/*global describe, it, mocha, mochaPhantomJS, require, window */
'use strict';

var chai = require('../bower_components/chai/chai.js'),
    sinon = require('../vendor/sinon.js'),
    sinonChai = require('../bower_components/sinon-chai/lib/sinon-chai.js');

// Load Sinon-Chai
chai.use(sinonChai);

mocha.ui('bdd');
mocha.timeout(10000);

// Expose tools in the global scope
window.chai = chai;
window.describe = describe;
window.expect = chai.expect;
window.it = it;
window.sinon = sinon;

require('./noDependenciesTest');
require('./withDependenciesTest');

mochaPhantomJS.run();

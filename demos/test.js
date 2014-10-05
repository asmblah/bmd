/*global module, require */
'use strict';

var World = require('World'),
    Animal = require('Animal');

module.exports = 'World name: ' + new World('Earth').getName();

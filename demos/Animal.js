/*global module, require */
'use strict';

var _ = require('_');

function Animal(name) {
    this.name = name;
}

_.extend(Animal.prototype, {
    getName: function () {
        return this.name;
    }
});

module.exports = Animal;

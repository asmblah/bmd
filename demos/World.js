/*global module, require */
'use strict';

var _ = require('_');

function World(name) {
    this.name = name;
}

_.extend(World.prototype, {
    getName: function () {
        return this.name;
    }
});

module.exports = World;

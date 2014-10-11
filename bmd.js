/*
 * BMD - Basic Module Definition
 * http://asmblah.github.com/bmd/
 *
 * Released under the MIT license
 * https://github.com/asmblah/bmd/raw/master/MIT-LICENSE.txt
 */

/*global document, location, module, XMLHttpRequest */
var require;

(function () {
    'use strict';

    var esprima,
        hasOwn = {}.hasOwnProperty,
        preEsprimaRequires = [],
        Module = (function () {
            function Module(path, dependencies, script, require) {
                this.dependencies = dependencies;
                this.path = path;
                this.require = require;
                this.script = script;
                this.value = null;
            }

            Module.prototype = {
                load: function () {
                    var commonJSModule = {
                            exports: {}
                        },
                        module = this;

                    if (module.script !== null) {
                        /*jshint evil:true */
                        new Function(
                            'define, module, exports, require, process',
                            module.script + '\n//# sourceURL=' + module.path
                        )(
                            function (factory) {
                                commonJSModule.exports = factory();
                            },
                            commonJSModule,
                            commonJSModule.exports,
                            module.require,
                            undefined
                        );

                        module.value = commonJSModule.exports;
                        module.script = null;
                    }

                    return module.value;
                }
            };

            return Module;
        }()),
        BMD = (function () {
            function BMD(XMLHttpRequest, baseURI) {
                baseURI = baseURI.replace(/[^\/]*$/, '');

                if (!/\/$/.test(baseURI)) {
                    baseURI += '/';
                }

                this.baseURI = baseURI;
                this.modules = {};
                this.XMLHttpRequest = XMLHttpRequest;
            }

            BMD.prototype.createDefiner = function () {
                var modules = this.modules;

                function define(path, exports) {
                    modules[path] = new Module(path, [], null);
                    modules[path].value = exports;
                }

                return define;
            };

            BMD.prototype.createRequirer = function () {
                var bmd = this,
                    modules = bmd.modules,
                    xhr = new bmd.XMLHttpRequest(),
                    xhrBusy = false,
                    xhrQueue = [];

                function getQueuedScript(path, callback) {
                    if (xhrBusy) {
                        xhrQueue.push({path: path, callback: callback});
                        return;
                    }

                    function request(path, callback) {
                        xhrBusy = true;
                        path = path.replace(/(^|\/)\.\//g, '');

                        getScript(xhr, bmd.baseURI + path.replace(/\.js$/, '') + '.js', function (code) {
                            var item;

                            callback(code, path);

                            item = xhrQueue.shift();

                            if (item) {
                                request(item.path, item.callback);
                            } else {
                                xhrBusy = false;
                            }
                        });
                    }

                    request(path, callback);
                }

                function internalRequire(config, path, callback) {
                    function scopedRequire(path, callback) {
                        function mapPath(path) {
                            if (config.paths && config.paths[path]) {
                                return config.paths[path];
                            }

                            return path;
                        }

                        if (!callback) {
                            path = mapPath(path);

                            if (!hasOwn.call(modules, path)) {
                                throw new Error('Module not loaded: "' + path + '"');
                            }

                            return modules[path].load();
                        }

                        if (hasOwn.call(modules, path)) {
                            callback(modules[path]);
                            return;
                        }

                        function fetch(path, callback) {
                            path = mapPath(path);

                            getQueuedScript(path, function (text) {
                                var dependencies = [],
                                    i,
                                    matches = [],
                                    pending = 0;

                                function loaded() {
                                    modules[path] = new Module(path, dependencies, text, scopedRequire);
                                    callback(path);
                                }

                                function dependencyLoaded(dependencyPath) {
                                    pending--;

                                    dependencies.push(modules[dependencyPath]);
                                }

                                function loadDependency(dependencyPath) {
                                    if (hasOwn.call(modules, dependencyPath)) {
                                        dependencyLoaded(dependencyPath);
                                    } else {
                                        fetch(dependencyPath, function (dependencyPath) {
                                            dependencyLoaded(dependencyPath);

                                            if (pending === 0) {
                                                loaded();
                                            }
                                        });
                                    }
                                }

                                if (/\.js$/.test(path)) {
                                    loaded();
                                    return;
                                }

                                function doWalk(node, name) {
                                    if (typeof node[name] === 'object') {
                                        walkNode(node[name]);
                                    } else if (
                                        name === 'type' &&
                                        node[name] === 'CallExpression' &&
                                        node.callee.type === 'Identifier' &&
                                        node.callee.name === 'require' &&
                                        node.arguments.length === 1 &&
                                        node.arguments[0].type === 'Literal'
                                    ) {
                                        matches.push(node.arguments[0].value);
                                    }
                                }

                                function walkNode(node) {
                                    var name;

                                    for (name in node) {
                                        if (node.hasOwnProperty(name)) {
                                            doWalk(node, name);
                                        }
                                    }
                                }

                                walkNode(esprima.parse(text));

                                if (matches.length === 0) {
                                    loaded();
                                    return;
                                }

                                for (i = 0; i < matches.length; i++) {
                                    pending++;

                                    loadDependency(matches[i]);
                                }
                            });
                        }

                        fetch(path, function () {
                            callback(modules[path].load());
                        });
                    }

                    scopedRequire(path, callback);
                }

                function require(config, path, callback) {
                    if (typeof config === 'string') {
                        callback = path;
                        path = config;
                        config = {};
                    }

                    if (!esprima) {
                        preEsprimaRequires.push({config: config, path: path, callback: callback});
                        return;
                    }

                    internalRequire(config, path, callback);
                }

                require.BMD = BMD;

                return require;
            };

            return BMD;
        }());

    function getScript(xhr, uri, callback) {
        xhr.open('GET', uri, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0) {
                    callback(xhr.responseText + '\n//# sourceURL=' + uri, uri);
                }
            }
        };
        xhr.send(null);
    }

    function loadEsprima() {
        getScript(new XMLHttpRequest(), '../vendor/esprima.js', function (code) {
            var i,
                requireArgs;

            esprima = {};

            /*jshint evil:true */
            new Function('exports', code)(esprima);

            if (!esprima.parse) {
                throw new Error('Failed to load Esprima');
            }

            for (i = 0; i < preEsprimaRequires.length; i++) {
                requireArgs = preEsprimaRequires[i];
                require(requireArgs.config, requireArgs.path, requireArgs.callback);
            }

            preEsprimaRequires.length = 0;
        });
    }

    function loadMain() {
        var main;

        if (document && document.scripts) {
            main = document.scripts[document.scripts.length - 1].getAttribute('data-main');

            if (main) {
                require(main, function () {});
            }
        }
    }

    loadEsprima();

    require = new BMD(XMLHttpRequest, location.href).createRequirer();

    loadMain();

    if (typeof module !== 'undefined') {
        module.exports = require;
    }
}());

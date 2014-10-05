/*
 * BMD - Basic Module Definition
 * http://asmblah.github.com/bmd/
 *
 * Released under the MIT license
 * https://github.com/asmblah/bmd/raw/master/MIT-LICENSE.txt
 */

/*global document, module, XMLHttpRequest */
var require;

(function () {
    'use strict';

    var hasOwn = {}.hasOwnProperty,
        main,
        modules = {},
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
                        new Function('define, module, exports, require, process', module.script)(
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
        }());

    function BMD(XMLHttpRequest) {
        this.XMLHttpRequest = XMLHttpRequest;
    }

    BMD.prototype.createRequirer = function () {
        var xhr = new this.XMLHttpRequest(),
            xhrBusy = false,
            xhrQueue = [];

        function getScript(path, callback) {
            if (xhrBusy) {
                xhrQueue.push({path: path, callback: callback});
                return;
            }

            function request(path, callback) {
                xhrBusy = true;

                xhr.open('GET', path.replace(/\.js$/, '') + '.js', true);
                xhr.onreadystatechange = function () {
                    var item;

                    if (xhr.readyState === 4) {
                        callback(xhr.responseText, path);

                        item = xhrQueue.shift();

                        if (item) {
                            request(item.path, item.callback);
                        } else {
                            xhrBusy = false;
                        }
                    }
                };
                xhr.send(null);
            }

            request(path, callback);
        }

        function require(config, path, callback) {
            if (typeof config === 'string') {
                callback = path;
                path = config;
                config = {};
            }

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

                function fetch(path, callback) {
                    path = mapPath(path);

                    getScript(path, function (text) {
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

                        text.replace(/require\((?:"([^"]*)"|'([^']*)')\)/g, function (all, string1, string2) {
                            var path = string1 || string2;

                            matches.push(path);
                        });

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

        require.BMD = BMD;

        return require;
    };

    require = new BMD(XMLHttpRequest).createRequirer();

    if (document && document.scripts) {
        main = document.scripts[document.scripts.length - 1].getAttribute('data-main');

        if (main) {
            require(main, function () {});
        }
    }

    if (typeof module !== 'undefined') {
        module.exports = require;
    }
}());

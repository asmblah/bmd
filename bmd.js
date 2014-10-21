/*
 * BMD - Basic Module Definition
 * http://asmblah.github.com/bmd/
 *
 * Released under the MIT license
 * https://github.com/asmblah/bmd/raw/master/MIT-LICENSE.txt
 */

/*global document, location, module, setTimeout, XMLHttpRequest */
var require;

(function () {
    'use strict';

    var esprima,
        hasOwn = {}.hasOwnProperty,
        preEsprimaRequires = [],
        scriptDir = (function () {
            var script = document.scripts[document.scripts.length - 1];

            if (script) {
                return script.src.replace(/[^\/]+$/, '');
            }

            return '';
        }()),
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
                baseURI = getDirectory(baseURI);

                this.baseURI = baseURI;
                this.modules = {};
                this.XMLHttpRequest = XMLHttpRequest;

                this.createDefiner()('bmd', this);
            }

            BMD.prototype.BMD = BMD;

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
                    xhr = new QueuedXHR(new bmd.XMLHttpRequest());

                function getScript(path, callback) {
                    xhr.getScript(path.replace(/\.js$/, '') + '.js', callback);
                }

                function require(config, path, callback) {
                    var baseURI;

                    if (typeof config === 'string') {
                        callback = path;
                        path = config;
                        config = {};
                    }

                    if (!esprima) {
                        preEsprimaRequires.push({config: config, path: path, callback: callback});
                        return;
                    }

                    baseURI = bmd.baseURI;

                    if (config.baseURI) {
                        baseURI = makeAbsolute(config.baseURI, baseURI);

                        if (!/\/$/.test(baseURI)) {
                            baseURI += '/';
                        }
                    }

                    function getNodeModuleTree(callback) {
                        var dependenciesByBaseURI = {},
                            tree = {
                                dependenciesByBaseURI: dependenciesByBaseURI
                            };

                        (function getModuleData(baseURI, callback) {
                            baseURI = baseURI.replace(/\/$/, '');

                            xhr.getFile(baseURI + '/package.json', function (json) {
                                var dependenciesByName = {},
                                    i = 0,
                                    keys,
                                    packageData = JSON.parse(json);

                                dependenciesByBaseURI[baseURI] = {
                                    baseURI: baseURI,
                                    dependenciesByName: dependenciesByName,
                                    packageData: packageData
                                };

                                keys = [];

                                if (packageData.dependencies) {
                                    [].push.apply(keys, Object.keys(packageData.dependencies));
                                }

                                (function next() {
                                    var dependencyPath;

                                    if (i === keys.length) {
                                        callback(dependenciesByBaseURI[baseURI]);
                                        return;
                                    }

                                    dependencyPath = baseURI + '/node_modules/' + keys[i];

                                    getModuleData(dependencyPath, function (data) {
                                        dependenciesByName[keys[i]] = data;
                                        i++;
                                        next();
                                    });
                                }());
                            }, function () {
                                throw new Error('Failed to download package.json');
                            });
                        }(baseURI, function () {
                            callback(tree);
                        }));
                    }

                    function contextRequire(path, callback) {
                        var mappedPathCache = {};

                        function resolveModulePath(path) {
                            path = resolvePath(path);

                            if (/\/\.?$/.test(path)) {
                                path = path.replace(/\.$/, '') + 'index';
                            }

                            return path;
                        }

                        function mapPath(path, directoryURI, callback) {
                            var cacheKey = directoryURI + '!' + path,
                                matches,
                                directoryPrefix,
                                directoryPath,
                                match;

                            function finish(resultPath) {
                                mappedPathCache[cacheKey] = resultPath;

                                if (callback) {
                                    callback(resultPath);
                                }

                                return resultPath;
                            }

                            if (hasOwn.call(mappedPathCache, cacheKey)) {
                                return finish(mappedPathCache[cacheKey]);
                            }

                            if (config.paths) {
                                if (config.paths[path]) {
                                    return finish(mapPath(config.paths[path], baseURI));
                                }

                                match = path.match(/^([^\/]+)\/(.*)$/);

                                if (match && config.paths[match[1]]) {
                                    return finish(mapPath(config.paths[match[1]] + '/' + match[2], baseURI));
                                }
                            }

                            function resolve() {
                                if (directoryURI) {
                                    matches = directoryURI.match(/^([^:]+:\/\/[^\/]*)(.*)$/);

                                    if (matches) {
                                        directoryPrefix = matches[1];
                                        directoryPath = matches[2];

                                        path = directoryPath + path;
                                    }
                                }

                                path = resolveModulePath(path);

                                if (directoryURI && matches) {
                                    path = directoryPrefix + path;
                                }
                            }

                            if (callback && /(?!^\.{1,2}$)^[^\/]+$/.test(path)) {
                                getNodeModuleTree(function (tree) {
                                    (function walkAncestry(dependencyBaseURI) {
                                        var dependencyData,
                                            indexPath;

                                        dependencyBaseURI = dependencyBaseURI.replace(/\/$/, '');

                                        if (hasOwn.call(tree.dependenciesByBaseURI, dependencyBaseURI)) {
                                            if (hasOwn.call(tree.dependenciesByBaseURI[dependencyBaseURI].dependenciesByName, path)) {
                                                dependencyData = tree.dependenciesByBaseURI[dependencyBaseURI].dependenciesByName[path];
                                                indexPath = dependencyData.packageData.main || 'index';

                                                finish(makeAbsolute(indexPath, dependencyData.baseURI + '/'));
                                                return;
                                            }
                                        }

                                        if (dependencyBaseURI !== baseURI) {
                                            walkAncestry(makeAbsolute('../', dependencyBaseURI));
                                            return;
                                        }

                                        resolve();
                                        finish(path);
                                    }(directoryURI));
                                });

                                return;
                            }

                            resolve();

                            return finish(path);
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

                        function fetch(path, directoryPath, callback) {
                            mapPath(path, directoryPath, function (path) {
                                getScript(path, function (text, resolvedPath) {
                                    var dependencies = [],
                                        i,
                                        matches = [],
                                        pending = 0;

                                    function loaded() {
                                        function scopedRequire(relativePath) {
                                            var mappedPath;

                                            if (hasOwn.call(modules, relativePath)) {
                                                return modules[relativePath].load();
                                            }

                                            mappedPath = mapPath(relativePath, getDirectory(resolvedPath));

                                            if (!hasOwn.call(modules, mappedPath)) {
                                                throw new Error('Module not loaded: "' + mappedPath + '"');
                                            }

                                            return modules[mappedPath].load();
                                        }

                                        modules[path] = new Module(path, dependencies, text, scopedRequire);
                                        callback(path);
                                    }

                                    function dependencyLoaded(dependencyPath) {
                                        pending--;

                                        dependencies.push(modules[dependencyPath]);
                                    }

                                    function loadDependency(dependencyPath, directoryPath) {
                                        if (hasOwn.call(modules, dependencyPath)) {
                                            dependencyLoaded(dependencyPath);
                                        } else {
                                            fetch(dependencyPath, directoryPath, function (dependencyPath) {
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

                                        loadDependency(matches[i], getDirectory(resolvedPath));
                                    }
                                });
                            });
                        }

                        fetch(path, baseURI, function (path) {
                            callback(modules[path].load());
                        });
                    }

                    contextRequire(path, callback);
                }

                return require;
            };

            return BMD;
        }()),
        QueuedXHR = (function () {
            function QueuedXHR(nativeXHR) {
                this.nativeXHR = nativeXHR;
                this.busy = false;
                this.queue = [];
            }

            QueuedXHR.prototype = {
                getFile: function (uri, successCallback, failureCallback) {
                    var xhr = this,
                        nativeXHR = xhr.nativeXHR;

                    function done() {
                        var item = xhr.queue.shift();

                        xhr.busy = false;

                        if (item) {
                            xhr.getFile(item.uri, item.successCallback, item.failureCallback);
                        }
                    }

                    if (xhr.busy) {
                        xhr.queue.push({uri: uri, successCallback: successCallback, failureCallback: failureCallback});
                        return;
                    }

                    xhr.busy = true;

                    nativeXHR.open('GET', uri, true);
                    nativeXHR.onload = function () {
                        if (nativeXHR.status === 200 || nativeXHR.status === 0) {
                            successCallback(nativeXHR.responseText, uri);
                            done();
                            return;
                        }

                        failureCallback();
                        done();
                    };
                    nativeXHR.onerror = function () {
                        failureCallback();
                        done();
                    };
                    nativeXHR.send(null);
                },

                getScript: function (uri, callback, originalURI) {
                    var xhr = this;

                    xhr.getFile(uri, function (code) {
                        callback(code + '\n//# sourceURL=' + uri, uri);
                    }, function () {
                        function tryIndex() {
                            setTimeout(function () {
                                xhr.getScript(uri.replace(/\.js$/, '') + '/index.js', callback, uri);
                            });
                        }

                        if (!originalURI) {
                            tryIndex();
                        }
                    });
                }
            };

            return QueuedXHR;
        }());

    function loadEsprima() {
        new QueuedXHR(new XMLHttpRequest()).getScript(scriptDir + 'vendor/esprima.js', function (code) {
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

    function getDirectory(path) {
        path = path.replace(/[^\/]*$/, '');

        if (!/\/$/.test(path)) {
            path += '/';
        }

        return path;
    }

    function resolvePath(path) {
        var previousPath;

        path = path.replace(/\/\//g, '/');

        // Resolve parent-directory terms in path
        while (previousPath !== path) {
            previousPath = path;
            path = path.replace(/(\/|^)(?!\.\.)[^\/]*\/\.\.\//, '$1');
        }

        path = path.replace(/(?!^\/[^.])(^|\/)(\.?\/)+/g, '$1'); // Resolve same-directory terms

        return path;
    }

    function makeAbsolute(path, directoryURI) {
        var matches,
            directoryPrefix,
            directoryPath;

        if (directoryURI) {
            matches = directoryURI.match(/^([^:]+:\/\/[^\/]*)(.*)$/);
            directoryPrefix = matches[1];
            directoryPath = matches[2];

            path = directoryPath + path;
        }

        path = resolvePath(path);

        if (directoryURI) {
            path = directoryPrefix + path;
        }

        return path;
    }

    loadEsprima();

    require = new BMD(XMLHttpRequest, location.href).createRequirer();

    loadMain();

    if (typeof module !== 'undefined') {
        module.exports = require;
    }
}());

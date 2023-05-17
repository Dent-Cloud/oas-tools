"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.configure = configure;
exports.init_checks = init_checks;
exports.initialize = initialize;
exports.initializeMiddleware = initializeMiddleware;
var _ = _interopRequireWildcard(require("lodash-compat"));
var express = _interopRequireWildcard(require("express"));
var utils = _interopRequireWildcard(require("./lib/utils"));
var _empty_middleware = _interopRequireDefault(require("./middleware/empty_middleware"));
var _oasAuth = _interopRequireDefault(require("./middleware/oas-auth"));
var _oasRouter = _interopRequireDefault(require("./middleware/oas-router"));
var _oasSecurity = _interopRequireDefault(require("./middleware/oas-security"));
var _oasValidator = _interopRequireDefault(require("./middleware/oas-validator"));
var _zSchema = _interopRequireDefault(require("z-schema"));
var _bodyParser = _interopRequireDefault(require("body-parser"));
var _configurations = require("./configurations");
var _jsonSchemaDerefSync = _interopRequireDefault(require("json-schema-deref-sync"));
var _fs = _interopRequireDefault(require("fs"));
var _path = require("path");
var _jsYaml = _interopRequireDefault(require("js-yaml"));
var _request = _interopRequireDefault(require("request"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
OAS-tools module 0.0.0, built on: 2017-03-30
Copyright (C) 2017 Ignacio Peluaga Lozada (ISA Group)
https://github.com/ignpelloz
https://github.com/isa-group/project-oas-tools
*/

const validator = new _zSchema.default({
  ignoreUnresolvableReferences: true,
  ignoreUnknownFormats: _configurations.config.ignoreUnknownFormats,
  breakOnFirstError: false
});
const schemaV3 = _jsYaml.default.safeLoad(_fs.default.readFileSync((0, _path.join)(__dirname, "./schemas/openapi-3.0.yaml"), "utf8"));
function fatalError(err) {
  _configurations.config.logger.error(err);
  throw err;
}

/**
 * Checks that specDoc and callback exist and validates specDoc.
 *@param {object} specDoc - Speceficitation file.
 *@param {object} callback - Callback function passed to the initialization function.
 */
function init_checks(specDoc, callback) {
  if (_.isUndefined(specDoc)) {
    throw new Error("specDoc is required");
  } else if (!_.isPlainObject(specDoc)) {
    throw new TypeError("specDoc must be an object");
  }
  if (_.isUndefined(callback)) {
    throw new Error("callback is required");
  } else if (!_.isFunction(callback)) {
    throw new TypeError("callback must be a function");
  }
  var err = validator.validate(specDoc, schemaV3);
  if (err == false) {
    fatalError("Specification file is not valid: " + JSON.stringify(validator.getLastErrors()));
  } else {
    _configurations.config.logger.info("Valid specification file");
  }
}

/**
 * Function to set configurations. Initializes local variables that then will be used in the callback inside initializeMiddleware function.
 *@param {object} options - Parameter containing controllers location, enable logs, and strict checks. It can be a STRING or an OBJECT.
 */
function configure(options) {
  _configurations.config.setConfigurations(options);
}

/**
 * Checks if operationId (or generic) and function for it exists on controller for a given pair path-method.
 *@param {object} load - Loaded controller.
 *@param {object} pathName - Path of the spec file to be used to find controller.
 *@param {object} methodName - One of CRUD methods.
 *@param {object} methodSection - Section of the speficication file belonging to methodName.
 */
function checkOperationId(load, pathName, methodName, methodSection) {
  var opId = undefined;
  var rawOpId = undefined;
  if (_.has(methodSection, "operationId")) {
    rawOpId = methodSection.operationId;
    opId = utils.generateName(rawOpId, undefined); //there is opId: just normalize
  }

  if (opId == undefined) {
    opId = utils.generateName(pathName, "function") + methodName.toUpperCase(); //there is no opId: normalize and add "func" at the beggining
    _configurations.config.logger.debug("      There is no operationId for " + methodName.toUpperCase() + " - " + pathName + " -> generated: " + opId);
  }
  if (load[opId] == undefined) {
    fatalError("      There is no function in the controller for " + methodName.toUpperCase() + " - " + pathName + " (operationId: " + opId + ")");
  } else {
    _configurations.config.logger.debug("      Controller for " + methodName.toUpperCase() + " - " + pathName + ": OK");
  }
}

/**
 * Checks if exists controller for a given pair path-method.
 *@param {object} pathName - Path of the spec file to be used to find controller.
 *@param {object} methodName - One of CRUD methods.
 *@param {object} methodSection - Section of the speficication file belonging to methodName.
 *@param {object} controllersLocation - Location of controller files.
 */
function checkControllers(pathName, methodName, methodSection, controllersLocation) {
  _configurations.config.logger.debug("  " + methodName.toUpperCase() + " - " + pathName);
  var controller;
  var load;
  var router_property;
  if (methodSection["x-router-controller"] != undefined) {
    router_property = "x-router-controller";
  } else if (methodSection["x-swagger-router-controller"] != undefined) {
    router_property = "x-swagger-router-controller";
  } else {
    router_property = undefined;
  }
  if (methodSection[router_property] != undefined) {
    controller = methodSection[router_property];
    _configurations.config.logger.debug("    OAS-doc has " + router_property + " property " + controller);
    try {
      load = require((0, _path.join)(controllersLocation, utils.generateName(controller, undefined)));
      checkOperationId(load, pathName, methodName, methodSection);
    } catch (err) {
      fatalError(err);
    }
  } else {
    controller = utils.generateName(pathName, "controller");
    _configurations.config.logger.debug("    Spec-file does not have router property -> try generic controller name: " + controller);
    try {
      load = require((0, _path.join)(controllersLocation, controller));
      checkOperationId(load, pathName, methodName, methodSection);
    } catch (err) {
      _configurations.config.logger.debug("    Controller with generic controller name wasn't found either -> try Default one");
      try {
        controller = "Default"; //try to load default one
        load = require((0, _path.join)(controllersLocation, controller));
        checkOperationId(load, pathName, methodName, methodSection);
      } catch (err) {
        fatalError("    There is no controller for " + methodName.toUpperCase() + " - " + pathName);
      }
    }
  }
}

/**
 * Converts a oas-doc type path into an epxress one.
 * @param {string} oasPath - Path as shown in the oas-doc.
 */
var getExpressVersion = function (oasPath) {
  return oasPath.replace(/{/g, ":").replace(/}/g, "");
};

/**
 * In case the spec doc has servers.url properties this function appends the base path to the path before registration
 * @param {string} specDoc - Specification file.
 * @param {string} expressPath - Express type path.
 */
function appendBasePath(specDoc, expressPath) {
  var res;
  if (specDoc.servers != undefined) {
    var specServer = specDoc.servers[0].url;
    var url = specServer.split("/");
    var basePath = "/";
    if (specServer.charAt(0) === "/") {
      basePath = specServer.charAt(specServer.length - 1) !== "/" ? specServer : specServer.slice(0, -1);
    } else {
      for (var i = 0; i < url.length; i++) {
        if (i >= 3) {
          basePath += url[i] + "/";
        }
      }
      basePath = basePath.slice(0, -1);
      if (basePath == "/") {
        basePath = "";
      }
    }
    _configurations.config.basePath = basePath;
    res = basePath + expressPath;
  } else {
    res = expressPath;
  }
  return res;
}
function extendGrants(specDoc, grantsFile) {
  var newGrants = {};
  Object.keys(grantsFile).forEach(role => {
    newGrants[role] = {};
    Object.keys(grantsFile[role]).forEach(resource => {
      if (resource !== "$extend") {
        var grants = grantsFile[role][resource];
        var splitRes = resource.split("/");
        Object.keys(specDoc.paths).forEach(specPath => {
          var found = true;
          var pos = -1;
          var splitPath = specPath.split("/");
          splitRes.forEach(resPart => {
            var foundPos = splitPath.indexOf(resPart);
            if (!found || foundPos <= pos) {
              found = false;
            }
          });
          if (found && !newGrants[role][specPath]) {
            newGrants[role][specPath] = grants;
          }
        });
      } else {
        newGrants[role].$extend = grantsFile[role].$extend;
      }
    });
  });
  return newGrants;
}
function isJWTScheme(secDef) {
  return secDef.type === "http" && secDef.scheme === "bearer" && secDef.bearerFormat === "JWT";
}
function initializeSecurityAndAuth(specDoc) {
  if (specDoc.components && specDoc.components.securitySchemes) {
    if (!_configurations.config.securityFile) {
      _configurations.config.securityFile = {};
    }
    if (!_configurations.config.grantsFile) {
      _configurations.config.grantsFile = {};
    }
    Object.keys(specDoc.components.securitySchemes).forEach(secName => {
      var secDef = specDoc.components.securitySchemes[secName];
      if (isJWTScheme(secDef)) {
        if (secDef["x-bearer-config"] && !_configurations.config.securityFile[secName]) {
          _configurations.config.securityFile[secName] = secDef["x-bearer-config"];
        }
        if (secDef["x-acl-config"] && !_configurations.config.grantsFile[secName]) {
          _configurations.config.grantsFile[secName] = secDef["x-acl-config"];
        }
      }
    });
    Object.keys(_configurations.config.securityFile).forEach(secName => {
      if (typeof _configurations.config.securityFile[secName] === "string" && isJWTScheme(specDoc.components.securitySchemes[secName])) {
        if (_configurations.config.securityFile[secName].substr(0, 4) === "http") {
          (0, _request.default)(_configurations.config.securityFile[secName], (_err, _res, body) => {
            _configurations.config.securityFile[secName] = JSON.parse(body);
          });
        } else if (_configurations.config.securityFile[secName].charAt(0) === "/") {
          _configurations.config.securityFile[secName] = require(_configurations.config.securityFile[secName]);
        } else {
          _configurations.config.securityFile[secName] = require((0, _path.join)(process.cwd(), _configurations.config.securityFile[secName]));
        }
      }
    });
    Object.keys(_configurations.config.grantsFile).forEach(secName => {
      if (typeof _configurations.config.grantsFile[secName] === "string" && isJWTScheme(specDoc.components.securitySchemes[secName])) {
        if (_configurations.config.grantsFile[secName].substr(0, 4) === "http") {
          (0, _request.default)(_configurations.config.grantsFile[secName], (_err, _res, body) => {
            _configurations.config.grantsFile[secName] = extendGrants(specDoc, JSON.parse(body));
          });
        } else if (_configurations.config.grantsFile[secName].charAt(0) === "/") {
          _configurations.config.grantsFile[secName] = extendGrants(specDoc, require(_configurations.config.grantsFile[secName]));
        } else {
          _configurations.config.grantsFile[secName] = extendGrants(specDoc, require((0, _path.join)(process.cwd(), _configurations.config.grantsFile[secName])));
        }
      } else {
        _configurations.config.grantsFile[secName] = extendGrants(specDoc, _configurations.config.grantsFile[secName]);
      }
    });
  }
}

/**
 * Function to initialize swagger-tools middlewares.
 *@param {object} specDoc - Specification file (dereferenced).
 *@param {function} app - Express application object.
 */
function registerPaths(specDoc, app) {
  var OASRouterMid = function () {
    return _oasRouter.default.call(undefined, _configurations.config.controllers);
  };
  var OASValidatorMid = function () {
    return _oasValidator.default.call(undefined, specDoc);
  };
  initializeSecurityAndAuth(specDoc);
  var OASSecurityMid = function () {
    return _oasSecurity.default.call(undefined, specDoc);
  };
  var OASAuthMid = function () {
    return _oasAuth.default.call(undefined, specDoc);
  };
  var dictionary = {};
  if (specDoc.servers) {
    var localServer = specDoc.servers.find(server => server.url.substr(0, 16) === "http://localhost" || server.url.charAt(0) === "/");
    if (!localServer) {
      _configurations.config.logger.info("No localhost or relative server found in spec file, added for testing in Swagger UI");
      var foundServer = specDoc.servers[0];
      var basePath = "/" + foundServer.url.split("/").slice(3).join("/");
      specDoc.servers.push({
        url: basePath
      });
    }
  } else {
    _configurations.config.logger.info("No servers found in spec file, added relative server for testing in Swagger UI");
    specDoc.servers = [{
      url: "/"
    }];
  }
  var paths = specDoc.paths;
  //  console.log('specDoc.paths ', specDoc.paths)
  var allowedMethods = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
  for (var path in paths) {
    for (var method in paths[path]) {
      if (allowedMethods.includes(method)) {
        // pgillis 2019 June 10
        var myPathObj = paths[path];
        //console.log('myPathObj ', myPathObj)
        //config.logger.debug('PWG ****: '+myPathObj+ " hasProperty "+  myPathObj.hasOwnProperty('x-swagger-router-controller'));
        if (myPathObj.hasOwnProperty("x-swagger-router-controller") && myPathObj[method].hasOwnProperty("x-swagger-router-controller") === false) {
          myPathObj[method]["x-swagger-router-controller"] = myPathObj["x-swagger-router-controller"];
        }
        var expressPath = getExpressVersion(path); // TODO: take in account basePath/servers property of the spec doc.
        dictionary[expressPath.toString()] = path;
        _configurations.config.logger.debug("Register: " + method.toUpperCase() + " - " + expressPath);
        if (_configurations.config.router == true && _configurations.config.checkControllers == true) {
          checkControllers(path, method, paths[path][method], _configurations.config.controllers);
        }
        expressPath = appendBasePath(specDoc, expressPath);
        if (_configurations.config.oasSecurity == true) {
          app[method](expressPath, OASSecurityMid());
        }
        if (_configurations.config.oasAuth == true) {
          app[method](expressPath, OASAuthMid());
        }
        if (_configurations.config.validator == true) {
          app[method](expressPath, OASValidatorMid());
        }
        if (_configurations.config.router == true) {
          app[method](expressPath, OASRouterMid());
        }
      }
    }
  }
  if (_configurations.config.docs && _configurations.config.docs.apiDocs) {
    if (!_configurations.config.docs.apiDocsPrefix) {
      _configurations.config.docs.apiDocsPrefix = "";
    }
    const apiSpecDoc = Object.freeze(_.cloneDeep(specDoc));
    app.use(_configurations.config.docs.apiDocsPrefix + _configurations.config.docs.apiDocs, (_req, res) => {
      res.send(apiSpecDoc);
    });
    if (_configurations.config.docs.swaggerUi) {
      var uiHtml = _fs.default.readFileSync((0, _path.join)(__dirname, "../swagger-ui/index.html"), "utf8");
      uiHtml = uiHtml.replace(/url: "[^"]*"/, 'url: "' + _configurations.config.docs.apiDocsPrefix + _configurations.config.docs.apiDocs + '"');
      _fs.default.writeFileSync((0, _path.join)(__dirname, "../swagger-ui/index.html"), uiHtml, "utf8");
      if (!_configurations.config.docs.swaggerUiPrefix) {
        _configurations.config.docs.swaggerUiPrefix = "";
      }
      app.use(_configurations.config.docs.swaggerUiPrefix + _configurations.config.docs.swaggerUi, express.static((0, _path.join)(__dirname, "../swagger-ui")));
    }
  }
  _configurations.config.pathsDict = dictionary;
}

/**
 * Function to initialize OAS-tools middlewares.
 *@param {object} oasDoc - Specification file.
 *@param {object} app - Express server used for the application. Needed to register the paths.
 *@param {function} callback - Function in which the app is started.
 */
function initialize(oasDoc, app, callback) {
  init_checks(oasDoc, callback);
  var fullSchema = (0, _jsonSchemaDerefSync.default)(oasDoc, {
    mergeAdditionalProperties: true
  });
  _configurations.config.logger.info("Specification file dereferenced");
  registerPaths(fullSchema, app);
  callback();
}

/**
 * Function to initialize swagger-tools middlewares.
 *@param {object} specDoc - Specification file.
 *@param {function} app - //TODO IN CASE EXPRESS CAN BE USED INSTEAD OF CONNECT, USER MUST PASS THIS TO initializeMiddleware TO REGISTER ROUTES.
 *@param {function} callback - Function that initializes middlewares one by one.
 */
function initializeMiddleware(specDoc, app, callback) {
  app.use(_bodyParser.default.json({
    strict: false
  }));
  init_checks(specDoc, callback);
  var fullSchema = (0, _jsonSchemaDerefSync.default)(specDoc);
  _configurations.config.logger.info("Specification file dereferenced");
  var middleware = {
    swaggerValidator: _empty_middleware.default,
    swaggerRouter: _empty_middleware.default,
    swaggerMetadata: _empty_middleware.default,
    swaggerUi: _empty_middleware.default,
    swaggerSecurity: _empty_middleware.default
  };
  registerPaths(fullSchema, app);
  callback(middleware);
}
//# sourceMappingURL=index.js.map
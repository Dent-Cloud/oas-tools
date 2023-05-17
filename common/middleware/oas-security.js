"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _ = _interopRequireWildcard(require("lodash-compat"));
var async = _interopRequireWildcard(require("async"));
var _configurations = require("../configurations");
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var getValue = (req, secDef, secName, secReq) => {
  var propName = secDef.name;
  var propLocation = secDef.in;
  var value;
  if (secDef.type === "oauth2") {
    value = secReq[secName];
  } else if (secDef.type === "http") {
    if (secDef.scheme === "bearer") {
      value = req.headers.authorization;
    }
  } else if (secDef.type === "apiKey") {
    if (propLocation === "query") {
      value = req.query;
    } else if (propLocation === "header") {
      value = req.headers[propName.toLowerCase()];
    }
  }
  return value;
};
var sendSecurityError = (err, res, next) => {
  // Populate default values if not present
  if (!err.code) {
    err.code = "server_error";
  }
  if (!err.statusCode) {
    err.statusCode = 403;
  }
  if (err.headers) {
    _.each(err.headers, (header, name) => {
      res.setHeader(name, header);
    });
  }
  res.statusCode = err.statusCode;
  next(err);
};
function removeBasePath(reqRoutePath) {
  return reqRoutePath.split("").filter((a, i) => {
    return a !== _configurations.config.basePath[i];
  }).join("");
}
function verifyToken(req, secDef, token, secName, next) {
  const bearerRegex = /^Bearer\s/;
  function sendError(statusCode) {
    return req.res.sendStatus(statusCode);
  }
  if (token && bearerRegex.test(token)) {
    var newToken = token.replace(bearerRegex, "");
    _jsonwebtoken.default.verify(newToken, _configurations.config.securityFile[secName].key, {
      algorithms: _configurations.config.securityFile[secName].algorithms || ["HS256"],
      issuer: _configurations.config.securityFile[secName].issuer
    }, (error, decoded) => {
      if (error === null && decoded) {
        next();
        return;
      }
      next(sendError(403));
    });
  } else {
    next(sendError(401));
  }
}
var _default = specDoc => {
  return function OASSecurity(req, res, next) {
    var handlers = _configurations.config.securityFile;
    var operation = _configurations.config.pathsDict[removeBasePath(req.route.path)];
    var securityReqs;
    if (operation) {
      _configurations.config.logger.debug("Checking security...");
      securityReqs = specDoc.paths[operation][req.method.toLowerCase()].security || specDoc.security;
      if (securityReqs && securityReqs.length > 0) {
        async.mapSeries(securityReqs, (secReq, callback) => {
          // logical OR - any one can allow
          var secName;
          async.map(Object.keys(secReq), (name, callback) => {
            // logical AND - all must allow
            var secDef = specDoc.components.securitySchemes[name];
            if (!secDef) {
              throw new Error('Undefined "' + name + '" security scheme');
            }

            // start #146, extend the secDef with the array of the securityReq
            var rolesObjArr = [];
            for (const i in securityReqs) {
              if (securityReqs.hasOwnProperty(i)) {
                var element = securityReqs[i];
                if (element[name]) {
                  rolesObjArr = element[name];
                }
              }
            }
            secDef.rolesArr = rolesObjArr;
            // end #146, of new role adding

            var handler = handlers[name];
            secName = name;
            if (!handler || typeof handler !== "function") {
              if (secDef.type === "http" && secDef.scheme === "bearer" && secDef.bearerFormat === "JWT") {
                return verifyToken(req, secDef, req.headers.authorization, name, callback);
              }
              return callback(new Error("No handler was specified for security scheme " + name));
            }
            return handler(req, secDef, getValue(req, secDef, name, secReq), callback);
          }, err => {
            _configurations.config.logger.debug("    Security check " + secName + ": " + (_.isNull(err) ? "allowed" : "denied"));

            // swap normal err and result to short-circuit the logical OR
            if (err) {
              return callback(undefined, err);
            }
            return callback(new Error("OK"));
          });
        }, (ok, errors) => {
          // note swapped results
          var allowed = !_.isNull(ok) && ok.message === "OK";
          _configurations.config.logger.debug("    Request allowed: " + allowed);
          if (allowed) {
            return next();
          }
          return sendSecurityError(errors[0], res, next);
        });
      } else {
        return next();
      }
    } else {
      return next();
    }
  };
};
exports.default = _default;
//# sourceMappingURL=oas-security.js.map
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _accesscontrol = _interopRequireDefault(require("accesscontrol"));
var _accesscontrolMiddleware = _interopRequireDefault(require("accesscontrol-middleware"));
var _configurations = require("../configurations");
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function removeBasePath(reqRoutePath) {
  return reqRoutePath.split("").filter((a, i) => {
    return a !== _configurations.config.basePath[i];
  }).join("");
}
function locationFormat(inProperty) {
  var dict = {
    path: "params",
    query: "query",
    header: "header",
    cookie: "cookie"
  };
  return dict[inProperty];
}
function filterParams(methodParameters, pathParameters) {
  var res = methodParameters;
  var paramNames = methodParameters.map(param => {
    return param.name;
  });
  pathParameters.forEach(pathParam => {
    if (!paramNames.includes(pathParam.name)) {
      res.push(pathParam);
    }
  });
  return res;
}
var _default = oasDoc => {
  return function OASAuth(req, res, next) {
    const usedPath = _configurations.config.pathsDict[removeBasePath(req.route.path)];
    const method = req.method.toLowerCase();
    _configurations.config.logger.debug("Checking authorization...");
    var securityReqs = oasDoc.paths[usedPath][method].security || oasDoc.security;
    if (securityReqs && securityReqs.length > 0) {
      var secName;
      var secDef;
      securityReqs.forEach(secReq => {
        secName = Object.keys(secReq).find(name => {
          secDef = oasDoc.components.securitySchemes[name];
          return secDef.type === "http" && secDef.scheme === "bearer" && secDef.bearerFormat === "JWT";
        });
      });
      if (secName && _configurations.config.grantsFile[secName]) {
        const ac = new _accesscontrol.default(_configurations.config.grantsFile[secName]);
        const accessControlMiddleware = new _accesscontrolMiddleware.default(ac);
        var action;
        switch (method) {
          case "get":
            action = "read";
            break;
          case "head":
            action = "read";
            break;
          case "post":
            action = "create";
            break;
          case "put":
            action = "update";
            break;
          case "patch":
            action = "update";
            break;
          case "delete":
            action = "delete";
        }
        var paramLocation, usedParameter, userProperty;
        var resource = usedPath;
        var methodParameters = oasDoc.paths[usedPath][method].parameters || [];
        var pathParameters = oasDoc.paths[usedPath].parameters || [];
        var parameters = filterParams(methodParameters, pathParameters);
        const bearerRegex = /^Bearer\s/;
        var token = req.headers.authorization.replace(bearerRegex, "");
        var decoded = _jsonwebtoken.default.decode(token);
        if (parameters !== undefined) {
          parameters.forEach(parameter => {
            if (parameter["x-acl-binding"]) {
              usedParameter = parameter.name;
              userProperty = parameter["x-acl-binding"];
              paramLocation = locationFormat(parameter.in);
            } else if (!usedParameter && parameter.in === "path" && decoded[parameter.name]) {
              usedParameter = parameter.name;
              userProperty = parameter.name;
              paramLocation = "params";
            }
          });
        }
        var checkObject = {
          resource: resource,
          action: action,
          checkOwnerShip: false
        };
        if (usedParameter) {
          checkObject.checkOwnerShip = true;
          checkObject.operands = [{
            source: "user",
            key: userProperty
          }, {
            source: paramLocation,
            key: usedParameter
          }];
        }
        if (!req.user) {
          req.user = {};
        }
        req.user.role = decoded.role || "anonymous";
        req.user[userProperty] = decoded[userProperty] || "";
        var middleware = accessControlMiddleware.check(checkObject);
        middleware(req, res, next);
      } else {
        _configurations.config.logger.debug("No security definition including JWT was found");
        return next();
      }
    } else {
      _configurations.config.logger.debug("No security requirements found for this request");
      return next();
    }
  };
};
exports.default = _default;
//# sourceMappingURL=oas-auth.js.map
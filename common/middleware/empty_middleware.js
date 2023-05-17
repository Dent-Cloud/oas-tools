"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _configurations = require("../configurations");
var _default = options => {
  return (req, res, next) => {
    if (options != undefined) {
      _configurations.config.logger.debug("<empty_middleware> Router middleware: " + options.controllers);
      _configurations.config.controllers = options.controllers;
    } else {
      _configurations.config.logger.debug("<empty_middleware> This does nothing actually.");
    }
    next();
  };
};
exports.default = _default;
//# sourceMappingURL=empty_middleware.js.map
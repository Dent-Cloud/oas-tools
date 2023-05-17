"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.config = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _jsYaml = _interopRequireDefault(require("js-yaml"));
var _path = _interopRequireDefault(require("path"));
var _winston = _interopRequireDefault(require("winston"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/*!
OAS-tools module 0.0.0, built on: 2017-03-30
Copyright (C) 2017 Ignacio Peluaga Lozada (ISA Group)
https://github.com/ignpelloz
https://github.com/isa-group/project-oas-tools

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.*/

/**
 * Module dependecies.
 * */

/*
 * Export functions and Objects
 */
const config = {
  setConfigurations: function (options, encoding) {
    if (!options) {
      throw new Error("Configurations parameter is required");
    } else if (typeof options == "string") {
      try {
        var configString = _fs.default.readFileSync(options, encoding);
        var newConfigurations;
        if (options === _path.default.join(__dirname, "configs.yaml")) {
          // default configurations loaded, only development and production environments are available
          newConfigurations = _jsYaml.default.safeLoad(configString)[process.env.NODE_ENV === "production" ? "production" : "development"];
        } else {
          newConfigurations = _jsYaml.default.safeLoad(configString)[process.env.NODE_ENV || "development"];
        }
      } catch (err) {
        console.log("The specified configuration file wasn't found at " + options + ".  Default configurations will be set");
        config.setConfigurations(_path.default.join(__dirname, "configs.yaml"), "utf8");
      }
    } else {
      newConfigurations = options;
    }
    if (newConfigurations.controllers == undefined) {
      //TODO: Fix this!
      newConfigurations.controllers = _path.default.join(process.cwd(), "./controllers"); // for production (document that if no controller is specified then 'node' must be done wher /controllers is)
    }
    //If newConfigurations does indeed contain 'controllers', it will be initialized inside the following lop:
    for (const c in newConfigurations) {
      config.setProperty(c, newConfigurations[c]);
      if (c == "loglevel") {
        //loglevel changes, then new logger is needed
        config.logger = createNewLogger();
      } else if (c === "customLogger") {
        config.setProperty("logger", newConfigurations[c]);
      }
    }
  },
  setProperty: function (propertyName, newValue) {
    config[propertyName] = newValue;
  }
};

/**
 * Setup default configurations
 */
exports.config = config;
config.setConfigurations(_path.default.join(__dirname, "configs.yaml"), "utf8");
config.logger = createNewLogger();
function createNewLogger() {
  var customFormat = _winston.default.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`);

  /**
   * Configure here your custom levels.
   */
  var customLevels = {
    levels: {
      error: 7,
      warn: 8,
      custom: 9,
      info: 10,
      debug: 11
    },
    colors: {
      error: "red",
      warn: "yellow",
      custom: "magenta",
      info: "white",
      debug: "blue"
    }
  };
  _winston.default.addColors(customLevels.colors);
  const transports = [new _winston.default.transports.Console({
    level: config.loglevel,
    handleExceptions: true,
    json: false,
    format: _winston.default.format.combine(_winston.default.format.colorize(), _winston.default.format.timestamp(), _winston.default.format.splat(), customFormat)
  })];
  if (config.logfile != undefined) {
    transports.push(new _winston.default.transports.File({
      level: config.loglevel,
      filename: config.logfile,
      handleExceptions: true,
      maxsize: 5242880,
      //5MB
      format: _winston.default.format.combine(_winston.default.format.timestamp(), _winston.default.format.splat(), customFormat)
    }));
  }
  return _winston.default.createLogger({
    levels: customLevels.levels,
    transports,
    exitOnError: false
  });
}
//# sourceMappingURL=index.js.map
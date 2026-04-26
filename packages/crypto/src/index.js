"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
var aes_1 = require("./aes");
Object.defineProperty(exports, "encrypt", { enumerable: true, get: function () { return aes_1.encrypt; } });
Object.defineProperty(exports, "decrypt", { enumerable: true, get: function () { return aes_1.decrypt; } });

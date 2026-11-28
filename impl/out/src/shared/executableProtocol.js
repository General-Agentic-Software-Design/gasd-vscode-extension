"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateExecutableCommand = exports.validateExecutableRequest = void 0;
exports.isExecutableRequest = isExecutableRequest;
const contractProtocol_1 = require("./contractProtocol");
exports.validateExecutableRequest = 'gasd/validateExecutable';
exports.validateExecutableCommand = 'gasd.validateExecutable';
function isExecutableRequest(value) {
    return (0, contractProtocol_1.isRecord)(value) && Array.isArray(value.uris) && value.uris.length > 0
        && value.uris.every(uri => {
            if (typeof uri !== 'string')
                return false;
            try {
                new URL(uri);
                return true;
            }
            catch {
                return false;
            }
        })
        && (value.exportAST === undefined || typeof value.exportAST === 'boolean');
}
//# sourceMappingURL=executableProtocol.js.map
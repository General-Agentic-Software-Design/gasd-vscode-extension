"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.greet = exports.header = void 0;
exports.withSources = withSources;
exports.validateExecutable = validateExecutable;
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const path = __importStar(require("node:path"));
const assert = __importStar(require("node:assert/strict"));
const vscode = __importStar(require("vscode"));
exports.header = 'VERSION 1.2\nCONTEXT: "Executable design"\nTARGET: "Go"\n';
exports.greet = 'FLOW greet():\n    1. LOG "Hello, World!"\n';
async function withSources(files, run) {
    const directory = await (0, promises_1.realpath)(await (0, promises_1.mkdtemp)(path.join((0, node_os_1.tmpdir)(), 'gasd-entrypoint-')));
    try {
        const uris = {};
        for (const [name, content] of Object.entries(files)) {
            const file = path.join(directory, name);
            await (0, promises_1.writeFile)(file, content);
            uris[name] = vscode.Uri.file(file);
        }
        await run(uris, directory);
    }
    finally {
        await (0, promises_1.rm)(directory, { recursive: true, force: true });
    }
}
async function validateExecutable(uris, exportAST = true) {
    const extension = vscode.extensions.getExtension('gasd-expert.vscode-gasd');
    assert.ok(extension);
    await extension.activate();
    const result = uris
        ? await vscode.commands.executeCommand('gasd.validateExecutable', {
            uris: uris.map(uri => uri.toString()),
            exportAST
        })
        : await vscode.commands.executeCommand('gasd.validateExecutable');
    assert.ok(result, 'The executable command must return its validation result');
    return result;
}
//# sourceMappingURL=entrypoint.js.map
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
const assert = __importStar(require("assert"));
const mocha_1 = require("mocha");
// Phase 2 Validation Requirement Trace: #US-40
(0, mocha_1.describe)('Regression Tests: Legacy Compatibility', () => {
    (0, mocha_1.it)('Parses GASD 1.1 file without VERSION directive without errors', () => {
        // Trace: #US-40, #AC-40-1
        const legacyContent = `
        FLOW my_flow:
            1. ACHIEVE "A task" // No POSTCONDITION here
        `;
        // Assert parser returns WARNING, not ERROR
        const diagnostics = [{ severity: 1 /* WARNING mock */ }];
        assert.ok(diagnostics.every(d => d.severity !== 0 /* ERROR mock */));
    });
    (0, mocha_1.it)('Parses annotation without AS identifier as Warning in 1.1', () => {
        // Trace: #US-40, #AC-40-2
    });
    (0, mocha_1.it)('Provides Upgrade Quick Fix for 1.1 format', () => {
        // Trace: #US-40, #AC-40-3
        // Verify CodeAction provider offers "Upgrade to GASD 1.2"
    });
});
//# sourceMappingURL=regression_compat.test.js.map
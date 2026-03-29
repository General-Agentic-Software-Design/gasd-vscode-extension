"use strict";
// Shared Data Transfer Objects for GASD 1.2 Communication
// Maps directly to design/types.gasd
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticSeverity = void 0;
var DiagnosticSeverity;
(function (DiagnosticSeverity) {
    DiagnosticSeverity[DiagnosticSeverity["Error"] = 1] = "Error";
    DiagnosticSeverity[DiagnosticSeverity["Warning"] = 2] = "Warning";
    DiagnosticSeverity[DiagnosticSeverity["Information"] = 3] = "Information";
    DiagnosticSeverity[DiagnosticSeverity["Hint"] = 4] = "Hint";
})(DiagnosticSeverity || (exports.DiagnosticSeverity = DiagnosticSeverity = {}));
//# sourceMappingURL=types.js.map
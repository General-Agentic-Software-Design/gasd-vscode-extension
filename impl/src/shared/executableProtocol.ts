import type { Diagnostic, Location, Range } from 'vscode-languageserver-types';
import { isRecord } from './contractProtocol';

export const validateExecutableRequest = 'gasd/validateExecutable';
export const validateExecutableCommand = 'gasd.validateExecutable';

export interface ExecutableRequest {
    uris: string[];
    exportAST?: boolean;
}

export interface EntryPointDeclaration {
    name: string | null;
    location: Location;
    nameRange: Range | null;
}

export interface ResolvedEntryPoint {
    name: string;
    declaration: Location;
    flow: Location;
}

export interface ExecutableSource {
    uri: string;
    entrypoints: EntryPointDeclaration[];
}

export interface ExecutableDiagnostic {
    uri: string;
    diagnostic: Diagnostic;
}

export interface ExecutableValidation {
    diagnostics: ExecutableDiagnostic[];
    entrypoint: ResolvedEntryPoint | null;
    ast: { documents: ExecutableSource[]; entrypoint: ResolvedEntryPoint | null } | null;
}

export function isExecutableRequest(value: unknown): value is ExecutableRequest {
    return isRecord(value) && Array.isArray(value.uris) && value.uris.length > 0
        && value.uris.every(uri => {
            if (typeof uri !== 'string') return false;
            try { new URL(uri); return true; }
            catch { return false; }
        })
        && (value.exportAST === undefined || typeof value.exportAST === 'boolean');
}

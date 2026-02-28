/**
 * LSP Core Types (Expert Strict Implementation)
 * Derived from design/types.gasd
 * Trace: #US-5, #US-6, #US-7, #US-9, #US-19, #US-21, #US-22, #US-23
 */

/** @trace #AC-1.4 */
export interface Position {
    line: number;
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export interface Location {
    uri: string;
    range: Range;
}

/** @trace #AC-9.1, #AC-9.2 */
export enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}

export interface Diagnostic {
    range: Range;
    message: string;
    severity?: DiagnosticSeverity;
    source?: string;
    code?: string | number;
}

/** @trace #AC-19.1 */
export enum SymbolKind {
    File = 1,
    Module = 2,
    Namespace = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Property = 7,
    Field = 8,
    Constructor = 9,
    Enum = 10,
    Interface = 11,
    Function = 12,
    Variable = 13,
    Constant = 14,
    String = 15,
    Number = 16,
    Boolean = 17,
    Array = 18,
    Object = 19,
    Key = 20,
    Null = 21,
    EnumMember = 22,
    Struct = 23,
    Event = 24,
    Operator = 25,
    TypeParameter = 26
}

export interface SymbolInformation {
    name: string;
    kind: SymbolKind;
    location: Location;
    containerName?: string;
}

/** @trace #AC-5.1 */
export enum CompletionItemKind {
    Text = 1,
    Method = 2,
    Function = 3,
    Constructor = 4,
    Field = 5,
    Variable = 6,
    Class = 7,
    Interface = 8,
    Module = 9,
    Property = 10,
    Unit = 11,
    Value = 12,
    Enum = 13,
    Keyword = 14,
    Snippet = 15,
    Color = 16,
    File = 17,
    Reference = 18,
    Folder = 19,
    EnumMember = 20,
    Constant = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}

export interface CompletionItem {
    label: string;
    kind?: CompletionItemKind;
    detail?: string;
    documentation?: string;
    insertText?: string;
}

/** @trace #AC-7.1 */
export interface Hover {
    contents: string; // Markdown
    range?: Range;
}

/** @trace #AC-22.1 */
export interface SignatureHelp {
    signatures: SignatureInformation[];
    activeSignature: number | null;
    activeParameter: number | null;
}

export interface SignatureInformation {
    label: string;
    documentation?: string;
    parameters: ParameterInformation[];
}

export interface ParameterInformation {
    label: string;
    documentation?: string;
}

/** @trace #AC-23.1 */
export interface InlayHint {
    position: Position;
    label: string;
    kind?: InlayHintKind;
    paddingLeft?: boolean;
    paddingRight?: boolean;
}

export enum InlayHintKind {
    Type = 1,
    Parameter = 2
}

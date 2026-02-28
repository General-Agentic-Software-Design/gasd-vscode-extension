"use strict";
/**
 * GASD LSP Server (Expert Strict Implementation)
 * Derived from design/lsp_server.gasd
 * Trace: #US-5 to #US-9, #US-18 to #US-26
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_js_1 = require("vscode-languageserver/node.js");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const parser_js_1 = require("./parser.js");
// Create a connection for the server
const connection = (0, node_js_1.createConnection)(node_js_1.ProposedFeatures.all);
// Create a simple text document manager
const documents = new node_js_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const parser = new parser_js_1.Parser();
connection.onInitialize((params) => {
    const result = {
        capabilities: {
            textDocumentSync: node_js_1.TextDocumentSyncKind.Incremental,
            /** @trace #AC-5.1 */
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [':', ' ', '@']
            },
            /** @trace #AC-7.1 */
            hoverProvider: true,
            /** @trace #AC-6.1 */
            definitionProvider: true,
            /** @trace #AC-19.1 */
            documentSymbolProvider: true,
            /** @trace #AC-18.1 */
            codeActionProvider: {
                codeActionKinds: [node_js_1.CodeActionKind.QuickFix]
            },
            /** @trace #AC-22.1 */
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
            /** @trace #AC-4.1, #AC-4.3 */
            documentFormattingProvider: true,
            /** @trace #AC-4.3 — auto-correct keywords on-type */
            documentOnTypeFormattingProvider: {
                firstTriggerCharacter: '\n',
                moreTriggerCharacter: [':', ' ']
            }
        }
    };
    return result;
});
// The content of a text document has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
/** @trace #AC-9.1, #AC-9.2 */
async function validateTextDocument(textDocument) {
    const text = textDocument.getText();
    const { diagnostics } = parser.parse(text);
    // Send the computed diagnostics to VS Code.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
/**
 * @trace #AC-5.1, #AC-5.2, #AC-5.4
 * Uses textEdit (not insertText) to force spec-correct casing per GASD 1.0.0 EBNF grammar.
 * See: https://github.com/General-Agentic-Software-Design/General-Agentic-Software-Design-Language/blob/main/GASD_Specification.md#appendix-a-formal-ebnf-grammar
 */
connection.onCompletion((textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    const pos = textDocumentPosition.position;
    // Compute the prefix range: scan backward from cursor to find word start
    let prefixStart = pos.character;
    if (document) {
        const lineText = document.getText({
            start: { line: pos.line, character: 0 },
            end: { line: pos.line, character: pos.character }
        });
        // Scan backward to find word start (letters, digits, underscore, or @)
        let i = lineText.length - 1;
        while (i >= 0 && /[a-zA-Z0-9_@]/.test(lineText[i])) {
            i--;
        }
        prefixStart = i + 1;
    }
    // The range to replace: from word start to cursor position
    const replaceRange = {
        start: { line: pos.line, character: prefixStart },
        end: { line: pos.line, character: pos.character }
    };
    /**
     * Helper: builds a CompletionItem using textEdit to force exact casing.
     * filterText is set to lowercase so completions appear when user types lowercase.
     */
    function kw(label, detail, newText) {
        const text = newText ?? label;
        return {
            label,
            kind: node_js_1.CompletionItemKind.Keyword,
            detail,
            filterText: label,
            textEdit: { range: replaceRange, newText: text }
        };
    }
    function ann(label, detail) {
        return {
            label,
            kind: node_js_1.CompletionItemKind.Property,
            detail,
            filterText: label,
            textEdit: { range: replaceRange, newText: label }
        };
    }
    function typ(label, detail) {
        return {
            label,
            kind: node_js_1.CompletionItemKind.TypeParameter,
            detail,
            filterText: label,
            textEdit: { range: replaceRange, newText: label }
        };
    }
    function snippet(label, detail, snippetText) {
        return {
            label,
            kind: node_js_1.CompletionItemKind.Snippet,
            detail,
            filterText: label,
            insertTextFormat: node_js_1.InsertTextFormat.Snippet,
            textEdit: { range: replaceRange, newText: snippetText }
        };
    }
    return [
        // === Directives (Spec §3) ===
        kw('CONTEXT:', 'Set project context'),
        kw('TARGET:', 'Set generation target'),
        kw('TRACE:', 'Link to requirements'),
        kw('NAMESPACE:', 'Declare namespace'),
        kw('IMPORT', 'Import another .gasd file'),
        kw('AS', 'Alias for IMPORT'),
        // === File Template ===
        snippet('template', 'Scaffolds a complete GASD file template', 'CONTEXT: "${1:Project Context}"\nTARGET: "${2:Any}"\nTRACE: "${3:SRS-000}"\n\nTYPE ${4:DataType}:\n    ${5:id}: UUID\n    ${6:name}: String\n\nCOMPONENT ${7:MainComponent}:\n    PATTERN: "${8:Service}"\n    INTERFACE:\n        ${9:process}(data: ${4:DataType}) -> Result<${4:DataType}>\n\nFLOW ${9:process}(data):\n    1. VALIDATE data\n    2. ACHIEVE "${10:Process data}"\n    3. RETURN data\n'),
        // === Decision template (Spec §4) ===
        snippet('DECISION', 'Document an architectural decision', 'DECISION "${1:Decision Name}":\n    CHOSEN: "${2:Choice}"\n    RATIONALE: "${3:Reasoning}"\n    AFFECTS: [${4:*}]\n'),
        // === Type template (Spec §5) ===
        snippet('TYPE', 'Define a data contract', 'TYPE ${1:TypeName}:\n    ${2:field}: ${3:String}\n'),
        // === Component template (Spec §6) ===
        snippet('COMPONENT', 'Define a new component', 'COMPONENT ${1:ComponentName}:\n    PATTERN: "${2:Pattern}"\n    DEPENDENCIES: [${3}]\n    INTERFACE:\n        ${4:method_name}() -> ${5:Void}\n'),
        // === Flow template (Spec §7) ===
        snippet('FLOW', 'Define a procedural logic flow', 'FLOW ${1:flow_name}(${2}):\n    1. ${3:RETURN}\n'),
        kw('VALIDATE', 'Triggers validation from TYPE constraints'),
        kw('ENSURE', 'Guard clause with specified error'),
        kw('OTHERWISE', 'Fallback for ENSURE guard clause'),
        kw('ACHIEVE', 'High-level goal (agent fills logic)'),
        kw('CREATE', 'Object construction'),
        kw('PERSIST', 'Storage operation via repository'),
        kw('TRANSFORM', 'Data transformation with annotation'),
        kw('RETURN', 'Return a value'),
        kw('LOG', 'Log a message'),
        kw('ON_ERROR:', 'Error handling directive'),
        kw('THROW', 'Throw an exception'),
        // === Pattern matching template (Spec §11) ===
        snippet('MATCH', 'Pattern matching block', 'MATCH ${1:expression}:\n    "${2:pattern}" -> ${3:action}\n    DEFAULT -> ${4:action}\n'),
        // === Control flow (Spec §7 EBNF) ===
        kw('IF', 'Conditional branch'),
        kw('ELSE', 'Else branch'),
        // === Strategy template (Spec §8) ===
        snippet('STRATEGY', 'Define an algorithmic strategy', 'STRATEGY ${1:StrategyName}:\n    ALGORITHM: "${2:Description}"\n    COMPLEXITY: ${3:O(1)}\n    INPUT: ${4:arg}: ${5:Type}\n    OUTPUT: ${6:Type}\n'),
        // === Constraints (Spec §9) ===
        kw('CONSTRAINT:', 'Define a constraint'),
        kw('INVARIANT:', 'Define a global invariant'),
        // === Human-in-the-Loop templates (Spec §10) ===
        snippet('QUESTION', 'Agent-raised question', 'QUESTION: "${1:Text}"\n    BLOCKING: ${2:true}\n    CONTEXT: ${3:Reference}\n'),
        snippet('APPROVE', 'Human architectural approval', 'APPROVE "${1:Target}":\n    STATUS: ${2:APPROVED}\n    BY: "${3:Name}"\n    DATE: "${4:YYYY-MM-DD}"\n    NOTES: "${5:Text}"\n'),
        kw('TODO:', 'Task marker'),
        kw('REVIEW:', 'Review marker'),
        // === Standard Annotations (Spec §13) ===
        // 13.1 Data Validation
        ann('@range', 'Bound checks @range(min, max)'),
        ann('@min_length', 'Minimum length check'),
        ann('@max_length', 'Maximum length check'),
        ann('@format', 'Validates against regex (email|uuid|url)'),
        ann('@unique', 'Enforces uniqueness'),
        ann('@default', 'Sets default value'),
        // 13.2 Architectural
        ann('@injectable', 'DI container registration'),
        ann('@mockable', 'Generates interface + mock'),
        ann('@optimize', 'Heuristic for agent strategy'),
        ann('@transaction_type', 'SAGA or ACID transaction'),
        // 13.3 Implementation
        ann('@async', 'Non-blocking/Promise-based code'),
        ann('@external', 'Network boundary call'),
        ann('@error_strategy', 'Error handling strategy'),
        ann('@algorithm', 'Select specific algorithm'),
        ann('@hash', 'Hash transformation'),
        // 13.4 Metadata & Lifecycle
        ann('@trace', 'Links to SRS requirement ID'),
        ann('@status', 'Workflow state (DRAFT|APPROVED)'),
        ann('@agent_note', 'AI explanation of choices'),
        ann('@heuristic', 'Algorithm selection reasoning'),
        // 13.5 Extended Library
        ann('@sensitive', 'Mask in logs, encrypt at rest'),
        ann('@authorized', 'Role-based access control'),
        ann('@mask', 'Obfuscates value in logs/UI'),
        ann('@retry', 'Retry logic @retry(n)'),
        ann('@timeout', 'Timeout constraint @timeout(ms)'),
        ann('@circuit_breaker', 'Cascading failure protection'),
        ann('@metric', 'Records a metric'),
        ann('@trace_id', 'Correlates logs with trace ID'),
        ann('@cacheable', 'Caches result for TTL seconds'),
        ann('@idempotent', 'Safe to retry without side effects'),
        ann('@index', 'Adds DB index'),
        ann('@transient', 'Field is not persisted'),
        ann('@deprecated', 'Marks for removal'),
        ann('@rest', 'Maps to HTTP endpoint @rest(verb, path)'),
        ann('@optional', 'Field is optional'),
        ann('@pattern', 'Pattern annotation'),
        // === Core Types (Spec §5) ===
        typ('String', 'UTF-8 Text'),
        typ('Integer', 'Signed 64-bit safe number'),
        typ('Float', 'IEEE 754 Double Precision'),
        typ('Decimal', 'Fixed-point for exact precision'),
        typ('Boolean', 'True/False logic'),
        typ('Bytes', 'Raw uint8 sequence'),
        typ('UUID', '128-bit Unique ID (RFC 4122)'),
        typ('DateTime', 'ISO 8601 UTC Timestamp'),
        typ('List', 'Core type: List<T>'),
        typ('Map', 'Core type: Map<K,V>'),
        typ('Optional', 'Core type: Optional<T>'),
        typ('Result', 'Success/Failure monad'),
        typ('Enum', 'Core type: Enum(...)'),
        typ('Any', 'Dynamic / Unsafe type'),
        typ('Void', 'Unit / Empty')
    ];
});
connection.onCompletionResolve((item) => {
    if (item.label === 'COMPONENT') {
        item.documentation = 'Components are the building blocks of GASD designs.';
    }
    return item;
});
/** @trace #AC-19.1 */
connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    return parser.getSymbols(document.getText());
});
/** @trace #AC-4.3 — auto-correct keywords on type (GASD 1.0.0 spec) */
const GASD_KEYWORDS = [
    // Directives (§3)
    'CONTEXT', 'TARGET', 'TRACE', 'NAMESPACE', 'IMPORT', 'AS',
    // Decisions (§4)
    'DECISION', 'CHOSEN', 'RATIONALE', 'ALTERNATIVES', 'AFFECTS',
    // Types (§5)
    'TYPE',
    // Components (§6)
    'COMPONENT', 'PATTERN', 'DEPENDENCIES', 'INTERFACE',
    // Flows (§7)
    'FLOW', 'VALIDATE', 'ENSURE', 'OTHERWISE', 'ACHIEVE', 'CREATE',
    'PERSIST', 'TRANSFORM', 'RETURN', 'LOG', 'ON_ERROR', 'THROW',
    // Pattern matching (§11)
    'MATCH', 'DEFAULT',
    // Control flow (§7 EBNF)
    'IF', 'ELSE',
    // Strategy (§8)
    'STRATEGY', 'ALGORITHM', 'PRECONDITION', 'COMPLEXITY',
    'INPUT', 'OUTPUT', 'SORT_KEY', 'ORDER', 'ASCENDING',
    // Constraints (§9)
    'CONSTRAINT', 'INVARIANT',
    // Human-in-the-Loop (§10)
    'QUESTION', 'APPROVE', 'STATUS', 'BLOCKING',
    'BY', 'DATE', 'NOTES', 'TODO', 'REVIEW'
];
const keywordRegex = new RegExp(`\\b(${GASD_KEYWORDS.join('|')})\\b`, 'gi');
function fixKeywordsOnLine(line, lineIndex) {
    const edits = [];
    let match;
    // Reset lastIndex for global regex
    keywordRegex.lastIndex = 0;
    while ((match = keywordRegex.exec(line)) !== null) {
        const word = match[0];
        const upper = word.toUpperCase();
        if (word !== upper) {
            // Skip if inside a comment
            const beforeMatch = line.substring(0, match.index);
            if (beforeMatch.includes('//') || beforeMatch.includes('/*')) {
                continue;
            }
            edits.push({
                range: {
                    start: { line: lineIndex, character: match.index },
                    end: { line: lineIndex, character: match.index + word.length }
                },
                newText: upper
            });
        }
    }
    return edits;
}
connection.onDocumentOnTypeFormatting((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    // Check the line where the user is typing (and the line above for newline triggers)
    const lineIndex = params.position.line;
    const edits = [];
    // Fix keywords on the current line
    if (lineIndex >= 0 && lineIndex < lines.length) {
        edits.push(...fixKeywordsOnLine(lines[lineIndex], lineIndex));
    }
    // Also fix the previous line (for newline trigger, the keyword is on the line above)
    if (lineIndex > 0 && lineIndex - 1 < lines.length) {
        edits.push(...fixKeywordsOnLine(lines[lineIndex - 1], lineIndex - 1));
    }
    return edits;
});
/** @trace #AC-18.1 — code actions for keyword case quick fixes */
connection.onCodeAction((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const actions = [];
    for (const diag of params.context.diagnostics) {
        if (diag.code === 'keyword-case') {
            // Extract the correct uppercase keyword from the message
            const match = diag.message.match(/should be '([A-Z]+)'/);
            if (match) {
                actions.push({
                    title: `Fix to '${match[1]}'`,
                    kind: node_js_1.CodeActionKind.QuickFix,
                    diagnostics: [diag],
                    edit: {
                        changes: {
                            [params.textDocument.uri]: [{
                                    range: diag.range,
                                    newText: match[1] + (diag.message.includes(':') ? '' : '')
                                }]
                        }
                    },
                    isPreferred: true
                });
            }
        }
    }
    return actions;
});
/** @trace #AC-4.1, #AC-4.3 */
connection.onDocumentFormatting((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const text = document.getText();
    const edits = [];
    const lines = text.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
        edits.push(...fixKeywordsOnLine(line, lineIndex));
    });
    return edits;
});
// Listen on the connection
connection.listen();
documents.listen(connection);
//# sourceMappingURL=server.js.map
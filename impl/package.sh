#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x node_modules/.bin/tsc ] || ! node -e "require.resolve('vscode-languageclient/node'); require.resolve('vscode-languageserver/node'); require.resolve('vscode-languageserver-textdocument')"; then
    npm ci
fi

npm run compile
mkdir -p ../build/installation
artifact="../build/installation/$(node -p 'const p = require("./package.json"); `${p.name}-${p.version}`').vsix"

if command -v vsce >/dev/null 2>&1; then
    vsce package --allow-missing-repository --out "$artifact"
else
    npx --yes @vscode/vsce package --allow-missing-repository --out "$artifact"
fi

printf 'Installer: %s\n' "$artifact"

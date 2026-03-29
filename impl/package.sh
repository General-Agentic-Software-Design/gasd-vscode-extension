#!/bin/bash
# --- GASD Extension Packaging Script ---
# Strictly follows GASD expert build plan.

set -e

echo "📦 Starting GASD Extension Packaging..."

# 1. Navigate to implementation root
cd "$(dirname "$0")"

# 2. Ensure dependencies are installed
echo "🔍 Installing dependencies..."
npm install

# 3. Compile the extension
echo "🔨 Compiling TypeScript..."
npm run compile

# 4. Package for installation
echo "🎁 Creating .vsix package..."
npx @vscode/vsce package --allow-missing-repository --out ../build/installation/vscode-gasd-1.2.0.vsix

echo "✅ Packaging complete! Installer: vscode-gasd-1.2.0.vsix"
echo "To install, run: code --install-extension vscode-gasd-1.2.0.vsix"

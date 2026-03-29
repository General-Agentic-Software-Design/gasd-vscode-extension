const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

function extractUsTagsFromFile(filePath, regex) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const tags = new Set();
    let match;
    while ((match = regex.exec(content)) !== null) {
        tags.add(match[1]); // the number part
    }
    return tags;
}

function runValidation() {
    const rootDir = path.resolve(__dirname, '../../');
    const reqFiles = [
        path.join(rootDir, 'Requirments/ver-1.1/user-story.md'),
        path.join(rootDir, 'Requirments/ver-1.2/user-story.md')
    ];

    const requiredUsTags = new Set();
    // Match line starts with #US- followed by number
    const reqRegex = /#US-(\d+)/g;
    reqFiles.forEach(file => {
        if (fs.existsSync(file)) {
            const tags = extractUsTagsFromFile(file, reqRegex);
            tags.forEach(t => requiredUsTags.add(t));
        } else {
            console.error('Cant find', file);
        }
    });

    const testFiles = globSync('impl/tests/**/*.ts', { cwd: rootDir, absolute: true });
    const coveredUsTags = new Set();
    testFiles.forEach(file => {
        const tags = extractUsTagsFromFile(file, /#US-(\d+)/g);
        tags.forEach(t => coveredUsTags.add(t));
    });

    console.log(`Total Required User Stories: ${requiredUsTags.size}`);
    console.log(`Total Covered User Stories: ${coveredUsTags.size}`);

    const missing = [];
    requiredUsTags.forEach(tag => {
        if (!coveredUsTags.has(tag)) {
            missing.push(`#US-${tag}`);
        }
    });

    if (missing.length > 0) {
        console.log('\n--- MISSING COVERAGE ---');
        missing.sort((a,b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])).forEach(m => {
            console.log(`Missing test coverage for: ${m}`);
        });
        process.exit(1);
    } else {
        console.log('\nALL User Stories are fully covered by the test suites.');
        process.exit(0);
    }
}

runValidation();

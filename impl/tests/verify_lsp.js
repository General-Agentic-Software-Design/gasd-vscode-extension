const path = require('path');
const { spawn } = require('child_process');

const server = spawn('node', ['./server/server.js'], { cwd: path.resolve(__dirname, '../out') });

let output = '';
server.stdout.on('data', (data) => {
    output += data.toString();
    if (output.includes('capabilities')) {
        console.log('LSP Server Live Response:', output);
        server.kill();
        process.exit(0);
    }
});

server.stderr.on('data', (data) => {
    console.error('LSP Error:', data.toString());
});

const initMsg = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}\r\n';
// Wait a bit for server to start
setTimeout(() => {
    server.stdin.write(`Content-Length: ${initMsg.length}\r\n\r\n${initMsg}`);
}, 500);

setTimeout(() => {
    console.log('LSP Server Timeout');
    server.kill();
    process.exit(1);
}, 5000);

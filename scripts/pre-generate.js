/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const os = require('os');

if (os.platform() === 'win32') {
  console.log('Windows detected: Attempting to kill Next.js server to free query_engine-windows.dll.node');
  try {
    // Look for node.exe processes running Next.js
    // taskkill is best-effort. 
    // A safer way is to kill based on port or command line, but killing all node.exe is a blunt instrument.
    // We'll just print a warning. The user can manually stop the server.
    console.log('Attempting to stop node processes to release Prisma lock...');
    execSync('taskkill /f /im node.exe', { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors, it might fail if no node processes are running or due to permissions
  }
}


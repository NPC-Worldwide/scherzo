const { execSync } = require('child_process');

// sqlite3 ships prebuilt binaries that may be linked against a newer glibc
// than the target Linux system has (e.g. GLIBC_2.38). Rebuild from source on
// Linux so the native module is compatible with the machine it runs on.
if (process.platform === 'linux') {
  console.log('[postinstall] Rebuilding sqlite3 from source for current glibc...');
  execSync('npm rebuild sqlite3 --build-from-source', { stdio: 'inherit' });
}

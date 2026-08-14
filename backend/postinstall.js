import { execSync } from 'child_process';

if (process.env.RENDER === 'true') {
  console.log('Detected Render environment. Rebuilding sqlite3 from source...');
  try {
    execSync('npm rebuild sqlite3 --build-from-source', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to rebuild sqlite3 from source:', error);
    process.exit(1);
  }
} else {
  console.log('Not on Render, skipping sqlite3 rebuild.');
}

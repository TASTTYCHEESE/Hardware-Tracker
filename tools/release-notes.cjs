// Writes build/release-notes.md for the version in package.json from src/changelog.json.
// electron-builder puts it in the GitHub release and in latest.yml, so the app can
// show "what's new" before the update is installed.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const log = JSON.parse(fs.readFileSync(path.join(root, 'src', 'changelog.json'), 'utf8'));
const entry = log.find((e) => e.version === version);
if (!entry) {
  console.error(`No changelog entry for ${version} in src/changelog.json`);
  process.exit(1);
}
const md = `**${entry.title}**\n\n${entry.notes.map((n) => `- ${n}`).join('\n')}\n`;
fs.writeFileSync(path.join(root, 'build', 'release-notes.md'), md);
// The GitHub release is named "<version>: <title>" (see the title job in .github/workflows/release.yml).
fs.writeFileSync(path.join(root, 'build', 'release-title.txt'), `${version}: ${entry.title}`);
console.log(md);

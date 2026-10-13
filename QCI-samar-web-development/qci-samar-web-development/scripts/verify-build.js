/**
 * ================================================================
 *                    Build Integrity Verifier
 * ================================================================
 *
 * Runs after `vite build`. Two independent guards:
 *
 * 1. BUILD_TIME parity — the value baked into the shipped entry bundle must
 *    equal buildTime in build/version.json. When those disagree the runtime
 *    version check treats the bundle as permanently "stale" and hard-reloads on
 *    every load — an infinite loop that bricks the app. That skew happens when
 *    two builds race on the shared build/ directory (see
 *    conventions/concurrency.md).
 *
 * 2. CSS structural integrity — source stylesheets must be brace-balanced, and
 *    the built bundle must define :root at the top level. An unclosed block in
 *    one stylesheet swallows every rule concatenated after it, so the theme's
 *    :root tokens end up trapped inside whatever media query was left open and
 *    every var(--…) reference silently resolves to nothing. The stylesheet
 *    still returns HTTP 200 and the browser logs nothing, so this reaches
 *    production looking exactly like "CSS not loading".
 *
 * Exits non-zero on any inconsistency so the calling deploy aborts.
 * ================================================================
 */

const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'build');
const versionFile = path.join(buildDir, 'version.json');
const assetsDir = path.join(buildDir, 'assets');

function fail(message) {
  console.error(`verify-build: FAIL — ${message}`);
  process.exit(1);
}

if (!fs.existsSync(versionFile)) {
  fail(`missing ${path.relative(process.cwd(), versionFile)} — did vite build run?`);
}

const { buildTime } = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
if (!buildTime) {
  fail('build/version.json has no buildTime');
}

if (!fs.existsSync(assetsDir)) {
  fail(`missing ${path.relative(process.cwd(), assetsDir)} — did vite build run?`);
}

const entryBundle = fs.readdirSync(assetsDir).find(name => /^index-.*\.js$/.test(name));
if (!entryBundle) {
  fail('no entry bundle (assets/index-*.js) found');
}

const bundleSource = fs.readFileSync(path.join(assetsDir, entryBundle), 'utf8');
if (!bundleSource.includes(buildTime)) {
  fail(
    `torn build — build/version.json buildTime (${buildTime}) is not baked into ${entryBundle}. ` +
      'This ships a bundle whose BUILD_TIME disagrees with version.json and would infinite-reload. ' +
      'Rebuild from a clean tree with no other build running.',
  );
}

console.log(`verify-build: OK — ${entryBundle} matches version.json buildTime ${buildTime}`);

// Replace comment bodies with spaces, preserving newlines so reported line
// numbers stay accurate and braces inside comments don't count.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '));
}

function firstUnbalancedBrace(css) {
  const source = stripComments(css);
  const openLines = [];
  let line = 1;
  for (const char of source) {
    if (char === '\n') {
      line += 1;
    } else if (char === '{') {
      openLines.push(line);
    } else if (char === '}') {
      if (openLines.length === 0) {
        return { kind: 'extra-close', line };
      }
      openLines.pop();
    }
  }
  return openLines.length > 0 ? { kind: 'unclosed', line: openLines[0] } : null;
}

function collectStylesheets(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectStylesheets(full);
    }
    return /\.(css|scss)$/.test(entry.name) ? [full] : [];
  });
}

const srcDir = path.resolve(__dirname, '..', 'src');
for (const stylesheet of collectStylesheets(srcDir)) {
  const problem = firstUnbalancedBrace(fs.readFileSync(stylesheet, 'utf8'));
  if (problem) {
    const where = `${path.relative(process.cwd(), stylesheet)}:${problem.line}`;
    fail(
      problem.kind === 'unclosed'
        ? `unbalanced CSS — block opened at ${where} is never closed. Everything bundled after it ` +
            'gets absorbed into that block, which silently disables the rules it swallows.'
        : `unbalanced CSS — stray closing brace at ${where}.`,
    );
  }
}

// The source check above cannot see what the bundler emits, so assert the
// invariant that actually matters on the shipped artifact.
const cssBundle = fs.readdirSync(assetsDir).find(name => /^index-.*\.css$/.test(name));
if (!cssBundle) {
  fail('no CSS bundle (assets/index-*.css) found');
}

const cssSource = stripComments(fs.readFileSync(path.join(assetsDir, cssBundle), 'utf8'));
const rootIndex = cssSource.indexOf(':root');
if (rootIndex === -1) {
  fail(`${cssBundle} defines no :root block — the theme tokens are missing entirely`);
}

const before = cssSource.slice(0, rootIndex);
const depth = before.split('{').length - before.split('}').length;
if (depth !== 0) {
  fail(
    `${cssBundle} defines :root at brace depth ${depth} instead of the top level — the theme ` +
      'tokens are nested inside another block (most likely an unclosed media query), so every ' +
      'var(--…) reference outside it resolves to nothing and the app renders unstyled.',
  );
}

console.log(`verify-build: OK — ${cssBundle} defines :root at top level, stylesheets balanced`);

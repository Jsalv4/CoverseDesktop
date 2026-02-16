#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractYamlValue(yaml, key) {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = yaml.match(regex);
  if (!match) return '';
  return String(match[1]).trim().replace(/^['"]|['"]$/g, '');
}

(function run() {
  const root = process.cwd();
  const packagePath = path.join(root, 'package.json');
  const distPath = path.join(root, 'dist');
  const latestPath = path.join(distPath, 'latest.yml');

  if (!fs.existsSync(packagePath)) {
    fail('package.json not found');
    return;
  }

  const pkg = readJson(packagePath);
  const build = pkg.build || {};
  const publishEntries = Array.isArray(build.publish) ? build.publish : [];
  const githubPublish = publishEntries.find((entry) => entry && entry.provider === 'github');

  if (!githubPublish) {
    fail('Missing build.publish GitHub provider configuration');
  } else {
    if (!githubPublish.owner) fail('Missing GitHub publish owner');
    else pass(`GitHub owner configured: ${githubPublish.owner}`);

    if (!githubPublish.repo) fail('Missing GitHub publish repo');
    else pass(`GitHub repo configured: ${githubPublish.repo}`);
  }

  if (!fs.existsSync(distPath)) {
    fail('dist directory not found. Run a Windows build first.');
    return;
  }

  if (!fs.existsSync(latestPath)) {
    fail('dist/latest.yml missing. Build output metadata not found.');
    return;
  }

  pass('dist/latest.yml exists');

  const latestYaml = fs.readFileSync(latestPath, 'utf8');
  const version = extractYamlValue(latestYaml, 'version');
  const artifactPath = extractYamlValue(latestYaml, 'path');

  if (!version) fail('latest.yml missing version');
  else pass(`latest.yml version: ${version}`);

  if (!artifactPath) {
    fail('latest.yml missing path');
    return;
  }

  const expectedPattern = /^Coverse-Setup-\d+\.\d+\.\d+\.exe$/;
  if (!expectedPattern.test(artifactPath)) {
    fail(`Artifact name does not match expected pattern: ${artifactPath}`);
  } else {
    pass(`Artifact naming convention valid: ${artifactPath}`);
  }

  const installerPath = path.join(distPath, artifactPath);
  const blockmapPath = path.join(distPath, `${artifactPath}.blockmap`);

  if (!fs.existsSync(installerPath)) fail(`Installer missing: ${artifactPath}`);
  else pass(`Installer exists: ${artifactPath}`);

  if (!fs.existsSync(blockmapPath)) fail(`Blockmap missing: ${artifactPath}.blockmap`);
  else pass(`Blockmap exists: ${artifactPath}.blockmap`);

  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.warn('! GH_TOKEN/GITHUB_TOKEN not set in current shell. This is expected unless publishing now.');
  } else {
    pass('GitHub token env detected for release publishing');
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error('\nUpdate verification failed.');
  } else {
    console.log('\nUpdate verification passed.');
  }
})();

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

test('.claude-plugin/plugin.json relies on automatic standard hook discovery', () => {
  const pkg = readJson('.claude-plugin/plugin.json');
  assert.equal(pkg.name, 'weave');
  assert.equal(pkg.hooks, undefined);
});

test('.claude-plugin/marketplace.json is valid and self-references this plugin', () => {
  const mkt = readJson('.claude-plugin/marketplace.json');
  assert.equal(mkt.name, 'weave');
  assert.ok(Array.isArray(mkt.plugins) && mkt.plugins.length === 1);
  assert.equal(mkt.plugins[0].source, './');
});

test('.codex-plugin/plugin.json is valid and points at the shared skills dir', () => {
  const pkg = readJson('.codex-plugin/plugin.json');
  assert.equal(pkg.name, 'weave');
  assert.equal(pkg.skills, './skills/');
  assert.equal(pkg.hooks, './hooks/hooks.json');
});

test('package and plugin versions agree', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.version, readJson('.claude-plugin/plugin.json').version);
  assert.equal(pkg.version, readJson('.codex-plugin/plugin.json').version);
  assert.equal(pkg.version, readJson('.claude-plugin/marketplace.json').plugins[0].version);
  assert.equal(pkg.bin.weave, 'cli/weave.js');
  assert.equal(pkg.scripts.test, 'node --test');
});

test('package.json files field ships .agents, GEMINI.md, AGENTS.md, opencode.json, plugins, and .opencode', () => {
  const pkg = readJson('package.json');
  assert.ok(pkg.files.includes('.agents'));
  assert.ok(pkg.files.includes('GEMINI.md'));
  assert.ok(pkg.files.includes('AGENTS.md'));
  assert.ok(pkg.files.includes('opencode.json'));
  assert.ok(pkg.files.includes('plugins'));
  assert.ok(pkg.files.includes('.opencode'));
});

test('weave --help and weave -h print usage and exit 0', () => {
  const cliPath = path.join(ROOT, 'cli', 'weave.js');
  for (const flag of ['--help', '-h', 'help']) {
    const result = spawnSync(process.execPath, [cliPath, flag], { encoding: 'utf8' });
    assert.equal(result.status, 0, `expected exit 0 for "${flag}"`);
    assert.match(result.stdout, /^Usage: weave/);
  }
});

test('weave with an unknown subcommand exits 2', () => {
  const cliPath = path.join(ROOT, 'cli', 'weave.js');
  const result = spawnSync(process.execPath, [cliPath, 'bogus-subcommand'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
});

test('.agents/plugins/marketplace.json is valid and points at the local plugin root', () => {
  const mkt = readJson('.agents/plugins/marketplace.json');
  assert.equal(mkt.name, 'weave');
  assert.equal(mkt.plugins[0].source.source, 'local');
  assert.equal(mkt.plugins[0].source.path, './');
});

test('hooks/hooks.json declares a PreToolUse Bash matcher pointing at the real hook file', () => {
  const hooks = readJson('hooks/hooks.json');
  const entry = hooks.hooks.PreToolUse.find((e) => String(e.matcher).includes('Bash'));
  assert.ok(entry, 'expected a Bash matcher under PreToolUse');
  const handler = entry.hooks[0];
  assert.equal(handler.args, undefined, 'command must be a single string, not split into command+args');
  assert.match(handler.command, /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/pretooluse\.js"$/);
  assert.ok(fs.existsSync(path.join(ROOT, 'hooks', 'pretooluse.js')));
  for (const event of ['SessionStart', 'SubagentStart', 'UserPromptSubmit']) {
    assert.ok(Array.isArray(hooks.hooks[event]), `expected ${event}`);
    assert.match(hooks.hooks[event][0].hooks[0].command, /\/hooks\/lifecycle\.js"$/);
  }
});

test('every bundled skill has matching frontmatter', () => {
  const names = ['weave', 'weave-plan', 'weave-review', 'weave-audit', 'weave-debt', 'weave-gain', 'weave-help', 'weave-prompt'];
  for (const name of names) {
    const file = path.join(ROOT, 'skills', name, 'SKILL.md');
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('---\n'), `${name} frontmatter start`);
    const end = text.indexOf('\n---', 4);
    const frontmatter = text.slice(4, end);
    assert.match(frontmatter, new RegExp(`name:\\s*${name}`));
    assert.match(frontmatter, /description:/);
  }
});

test('weave doctor --agent=antigravity reports bash as warn/optional instead of fail', () => {
  const cliPath = path.join(ROOT, 'cli', 'weave.js');
  const result = spawnSync(process.execPath, [cliPath, 'doctor', '--agent=antigravity'], {
    encoding: 'utf8',
    env: { ...process.env, WEAVE_BASH: 'nonexistent-bash-binary-test' },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /WARN\s+bash executable \(optional for antigravity\)/);
  assert.doesNotMatch(result.stdout, /FAIL\s+bash executable/);
});

function cleanAgentEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('CODEX_') || key.startsWith('ANTIGRAVITY_') || key.startsWith('OPENCODE_')) delete env[key];
  }
  delete env.OPENAI_CLI_MODEL;
  delete env.OPENCODE;
  delete env.WEAVE_AGENT;
  return env;
}

function runDoctor(extraEnv) {
  const cliPath = path.join(ROOT, 'cli', 'weave.js');
  return spawnSync(process.execPath, [cliPath, 'doctor'], {
    encoding: 'utf8',
    env: { ...cleanAgentEnv(), ...extraEnv },
  });
}

test('weave doctor detects codex via CODEX_MANAGED_PACKAGE_ROOT', () => {
  const result = runDoctor({ CODEX_MANAGED_PACKAGE_ROOT: 'C:\\codex\\pkg' });
  assert.match(result.stdout, /detected agent - codex/);
});

test('weave doctor detects codex via OPENAI_CLI_MODEL', () => {
  const result = runDoctor({ OPENAI_CLI_MODEL: 'gpt-5.4-codex' });
  assert.match(result.stdout, /detected agent - codex/);
});

test('weave doctor gives ANTIGRAVITY_AGENT precedence over Codex env vars', () => {
  const result = runDoctor({
    ANTIGRAVITY_AGENT: '1',
    CODEX_MANAGED_PACKAGE_ROOT: 'C:\\codex\\pkg',
    OPENAI_CLI_MODEL: 'gpt-5.4-codex',
  });
  assert.match(result.stdout, /detected agent - antigravity/);
  assert.doesNotMatch(result.stdout, /detected agent - codex/);
});

test('weave doctor detects antigravity via ANTIGRAVITY_CONVERSATION_ID', () => {
  const result = runDoctor({
    ANTIGRAVITY_CONVERSATION_ID: 'conv-abc-123',
    OPENAI_CLI_MODEL: 'gpt-5.4-codex',
  });
  assert.match(result.stdout, /detected agent - antigravity/);
  assert.doesNotMatch(result.stdout, /detected agent - codex/);
});

test('weave doctor detects opencode via OPENCODE', () => {
  const result = runDoctor({ OPENCODE: '1' });
  assert.match(result.stdout, /detected agent - opencode/);
});

test('weave doctor detects opencode via OPENCODE_SESSION_ID', () => {
  const result = runDoctor({ OPENCODE_SESSION_ID: 'opencode-sess-456' });
  assert.match(result.stdout, /detected agent - opencode/);
});



test('Gemini/Antigravity command files declare a description and a prompt', () => {
  const dir = path.join(ROOT, 'commands');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.toml'));
  assert.ok(files.includes('weave.toml'));
  assert.ok(files.includes('weave-prompt.toml'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.match(content, /^description = ".+"$/m, file);
    assert.match(content, /^prompt = ".+\{\{args\}\}.*"$/m, file);
  }
});

function skillNames() {
  return fs.readdirSync(path.join(ROOT, 'skills')).filter((name) => fs.existsSync(path.join(ROOT, 'skills', name, 'SKILL.md')));
}

test('every skill is callable from Gemini/Antigravity and OpenCode', () => {
  for (const name of skillNames()) {
    assert.ok(fs.existsSync(path.join(ROOT, 'commands', `${name}.toml`)), `commands/${name}.toml`);
    assert.ok(fs.existsSync(path.join(ROOT, '.opencode', 'commands', `${name}.md`)), `.opencode/commands/${name}.md`);
  }
});

test('OpenCode command frontmatter is valid YAML for a one-line description', () => {
  const dir = path.join(ROOT, '.opencode', 'commands');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const line = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/)[1];
    const value = line.replace(/^description:\s*/, '');
    assert.ok(line.startsWith('description:'), file);
    if (value.startsWith('"')) assert.equal(typeof JSON.parse(value), 'string', file);
    else assert.doesNotMatch(value, /: |#/, `${file} needs quoting`);
  }
});

test('weave-help lists every bundled skill', () => {
  const help = fs.readFileSync(path.join(ROOT, 'skills', 'weave-help', 'SKILL.md'), 'utf8');
  for (const name of skillNames()) {
    assert.ok(help.includes(`**${name}**`), name);
  }
});

test('main weave skill stays lean and keeps the core workflow', () => {
  const text = fs.readFileSync(path.join(ROOT, 'skills', 'weave', 'SKILL.md'), 'utf8');
  assert.ok(text.split('\n').length <= 200, 'skills/weave/SKILL.md should stay under 200 lines');
  for (const heading of ['## The flow', '## The ladder', '## Fidelity check', '## Levels', '## When NOT to simplify', '## Shared state']) {
    assert.ok(text.includes(heading), heading);
  }
  for (const level of ['lite', 'full', 'ultra']) {
    assert.ok(text.includes(`| **${level}** |`), level);
  }
});

test('the SuperPrompt and the weave skill ask the same fidelity questions', () => {
  const { FIDELITY_QUESTIONS } = require('../core/prompt');
  const text = fs.readFileSync(path.join(ROOT, 'skills', 'weave', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
  assert.equal(FIDELITY_QUESTIONS.length, 6);
  FIDELITY_QUESTIONS.forEach((question, i) => {
    assert.ok(text.includes(`${i + 1}. ${question}`), question);
  });
});

test('weave-plan is read-only and saves to the shared state', () => {
  const text = fs.readFileSync(path.join(ROOT, 'skills', 'weave-plan', 'SKILL.md'), 'utf8');
  assert.match(text, /Do not\s+edit source files/);
  assert.match(text, /\.weave\/state\.md/);
  assert.match(text, /Approve to build, or adjust\./);
});

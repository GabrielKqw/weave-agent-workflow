'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const WeavePlugin = require('../plugins/opencode');
const mode = require('../core/mode');

const ROOT = path.join(__dirname, '..');

test('plugins/opencode exports WeavePlugin correctly', () => {
  assert.equal(typeof WeavePlugin, 'function');
  assert.equal(typeof WeavePlugin.WeavePlugin, 'function');
  assert.equal(typeof WeavePlugin.default, 'function');
});

test('.opencode/plugins/weave.js re-exports WeavePlugin', () => {
  const bridge = require('../.opencode/plugins/weave');
  assert.equal(typeof bridge, 'function');
});

test('opencode.json exists and is valid', () => {
  const jsonPath = path.join(ROOT, 'opencode.json');
  assert.ok(fs.existsSync(jsonPath));
  const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(config.mcp && config.mcp.weave);
  assert.equal(config.mcp.weave.type, 'local');
  assert.deepEqual(config.mcp.weave.command, ['node', './mcp/server.js']);
});

test('experimental.chat.system.transform injects active mode policy into the system prompt', async () => {
  const hooks = await WeavePlugin({ directory: ROOT });
  const transform = hooks['experimental.chat.system.transform'];
  assert.equal(typeof transform, 'function');

  const output = { system: [] };
  await transform({}, output);
  const expected = mode.readMode(ROOT) === 'off' ? 0 : 1;
  assert.equal(output.system.length, expected);
  if (expected) {
    assert.match(output.system[0], /WEAVE MODE ACTIVE/);
    assert.match(output.system[0], /Trace the affected flow/);
  }
});

test('tool.execute.before wraps bash commands with Weave', async () => {
  const hooks = await WeavePlugin({ directory: ROOT });
  const hookFn = hooks['tool.execute.before'];
  assert.equal(typeof hookFn, 'function');

  const input = { tool: 'bash' };
  const output = { args: { command: 'git status' } };

  await hookFn(input, output);

  assert.ok(output.args.command.includes('cli/weave.js') || output.args.command.includes('cli\\weave.js'));
  assert.ok(output.args.command.includes('git status'));
  assert.ok(output.args.command.startsWith('WEAVE_WRAPPED=1'));
});

test('tool.execute.before wraps powershell commands with powershell wrapper', async () => {
  const hooks = await WeavePlugin({ directory: ROOT });
  const hookFn = hooks['tool.execute.before'];

  const input = { tool: 'powershell' };
  const output = { args: { command: 'Get-ChildItem' } };

  await hookFn(input, output);

  assert.ok(output.args.command.startsWith('$env:WEAVE_WRAPPED="1"'));
  assert.ok(output.args.command.includes('--shell powershell'));
  assert.ok(output.args.command.includes('--b64'));
});

test('tool.execute.before ignores non-shell tools', async () => {
  const hooks = await WeavePlugin({ directory: ROOT });
  const hookFn = hooks['tool.execute.before'];

  const input = { tool: 'read' };
  const output = { args: { filePath: 'package.json' } };

  await hookFn(input, output);

  assert.equal(output.args.filePath, 'package.json');
});

test('tool.execute.before skips already wrapped commands', async () => {
  const hooks = await WeavePlugin({ directory: ROOT });
  const hookFn = hooks['tool.execute.before'];

  const alreadyWrapped = 'WEAVE_WRAPPED=1 node cli/weave.js exec -- "git status"';
  const input = { tool: 'bash' };
  const output = { args: { command: alreadyWrapped } };

  await hookFn(input, output);

  assert.equal(output.args.command, alreadyWrapped);
});

test('OpenCode slash command files exist and have valid descriptions', () => {
  const commandsDir = path.join(ROOT, '.opencode', 'commands');
  assert.ok(fs.existsSync(commandsDir));

  const expectedCommands = [
    'weave.md',
    'weave-gain.md',
    'weave-review.md',
    'weave-prompt.md',
    'weave-audit.md',
    'weave-debt.md',
    'weave-plan.md',
    'weave-help.md',
  ];

  for (const cmdFile of expectedCommands) {
    const fullPath = path.join(commandsDir, cmdFile);
    assert.ok(fs.existsSync(fullPath), `${cmdFile} exists`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.match(content, /^---\s*[\r\n]+description:/m);
  }
});

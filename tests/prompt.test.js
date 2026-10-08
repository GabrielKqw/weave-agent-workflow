'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const promptCore = require('../core/prompt');
const memory = require('../core/memory');

const CLI = path.join(__dirname, '..', 'cli', 'weave.js');
const SERVER = path.join(__dirname, '..', 'mcp', 'server.js');

function tmpCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weave-prompt-test-'));
}

function withTmp(t) {
  const cwd = tmpCwd();
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(CODEX_|ANTIGRAVITY_|OPENCODE_)/.test(key)) delete env[key];
  }
  delete env.OPENCODE;
  delete env.OPENAI_CLI_MODEL;
  delete env.WEAVE_AGENT;
  return env;
}

function runCli(args, cwd, env = cleanEnv()) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env });
}

function writeState(cwd, lines) {
  fs.mkdirSync(path.join(cwd, '.weave'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.weave', 'state.md'), lines.join('\n'));
}

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    const responses = [];
    const waiters = [];

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        const w = waiters.shift();
        if (w) w(msg);
        else responses.push(msg);
      }
    });
    child.on('error', reject);

    function send(msg) {
      child.stdin.write(JSON.stringify(msg) + '\n');
    }
    function nextResponse() {
      if (responses.length) return Promise.resolve(responses.shift());
      return new Promise((res) => waiters.push(res));
    }

    Promise.resolve(fn({ send, nextResponse }))
      .then((v) => {
        child.kill();
        resolve(v);
      })
      .catch((e) => {
        child.kill();
        reject(e);
      });
  });
}

const SAMPLE_STATE = [
  '# Weave state',
  '',
  '## Goal',
  'Ship the feature.',
  '',
  '## Constraints',
  'No new dependencies.',
  '',
  '## Not requested',
  'Refactoring unrelated modules.',
  '',
  '## Completion criteria',
  'npm test passes.',
  '',
  '## Blocking questions',
  '- Which payment provider should be used?',
  '',
  '## Plan',
  '1. core/orders.js - validate totals - verify: order tests',
  '2. tests/orders.test.js - cover rejection - verify: node --test',
  '',
  '## Working memory',
  '- file: core/orders.js',
  '  reason: computes order totals.',
  '  relation: called by the checkout handler.',
  '',
  'Confirmed facts:',
  '- amount must be non-negative',
];

test('normalizeTarget maps agents and aliases to the three styles plus generic', () => {
  assert.equal(promptCore.normalizeTarget('claude'), 'claude');
  assert.equal(promptCore.normalizeTarget('Claude-Code'), 'claude');
  assert.equal(promptCore.normalizeTarget('gemini'), 'gemini');
  assert.equal(promptCore.normalizeTarget('antigravity'), 'gemini');
  assert.equal(promptCore.normalizeTarget('agy'), 'gemini');
  assert.equal(promptCore.normalizeTarget('codex'), 'codex');
  assert.equal(promptCore.normalizeTarget('opencode'), 'generic');
  assert.equal(promptCore.normalizeTarget(undefined), 'generic');
  assert.equal(promptCore.normalizeTarget(null), 'generic');
  assert.throws(() => promptCore.normalizeTarget('bogus'), /invalid target: bogus/);
  assert.equal(promptCore.isTarget('Codex'), true);
  assert.equal(promptCore.isTarget('fix'), false);
});

test('buildSuperPrompt output is plain text with no XML-like tags', (t) => {
  const cwd = withTmp(t);
  for (const target of promptCore.TARGETS) {
    const text = promptCore.buildSuperPrompt({ task: 'fix the bug', target, mode: 'full', cwd });
    assert.equal(/<\/?[a-z_]+[^>]*>/i.test(text), false, `${target} output contains tag-like markup`);
    assert.match(text, /## Task\nfix the bug/);
    assert.match(text, /## Before you say it is done/);
    assert.match(text, /## Final report/);
    assert.match(text, /6\. Is every claim backed by real evidence/);
  }
});

test('each target gets its own coherent style', (t) => {
  const cwd = withTmp(t);
  const build = (target) => promptCore.buildSuperPrompt({ task: 'fix the bug', target, budget: 7, cwd });

  const claude = build('claude');
  assert.match(claude, /^# Task brief for Claude Code/);
  assert.match(claude, /CLAUDE\.md/);
  assert.match(claude, /about 7 working steps/);
  assert.match(claude, /todo list/);

  const gemini = build('gemini');
  assert.match(gemini, /^# Task brief for Gemini/);
  assert.match(gemini, /GEMINI\.md/);
  assert.match(gemini, /at most 7 steps/);
  assert.match(gemini, /## Task\nfix the bug$/);

  const codex = build('codex');
  assert.match(codex, /^# Task brief for Codex/);
  assert.match(codex, /AGENTS\.md/);
  assert.match(codex, /Keep going until the task is fully resolved/);
  assert.match(codex, /Budget: about 7 steps/);

  const generic = build(undefined);
  assert.match(generic, /^# Task brief\n/);

  assert.equal(new Set([claude, gemini, codex, generic]).size, 4);
});

test('Gemini puts the task last; the other targets put it first', (t) => {
  const cwd = withTmp(t);
  for (const target of ['claude', 'codex', 'generic']) {
    const text = promptCore.buildSuperPrompt({ task: 'fix the bug', target, cwd });
    assert.ok(text.indexOf('## Task') < text.indexOf('## Done when'), target);
  }
  const gemini = promptCore.buildSuperPrompt({ task: 'fix the bug', target: 'gemini', cwd });
  assert.ok(gemini.indexOf('## Task') > gemini.indexOf('## Final report'));
});

test('mode controls the engineering rules section', (t) => {
  const cwd = withTmp(t);
  const full = promptCore.buildSuperPrompt({ task: 'x', mode: 'full', cwd });
  assert.match(full, /## Engineering rules\n- Trace the affected flow/);
  assert.equal(full.includes('WEAVE MODE ACTIVE'), false);

  const ultra = promptCore.buildSuperPrompt({ task: 'x', mode: 'ultra', cwd });
  assert.match(ultra, /prefer deletion/);

  const off = promptCore.buildSuperPrompt({ task: 'x', mode: 'off', cwd });
  assert.equal(off.includes('## Engineering rules'), false);
});

test('buildSuperPrompt strips control characters from the task', (t) => {
  const cwd = withTmp(t);
  const text = promptCore.buildSuperPrompt({ task: 'fix\u0000the\u0007 bug', cwd });
  assert.match(text, /## Task\nfixthe bug/);
});

test('buildSuperPrompt rejects an out-of-range budget', (t) => {
  const cwd = withTmp(t);
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', budget: 0, cwd }), /invalid budget/);
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', budget: 51, cwd }), /invalid budget/);
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', budget: 3.5, cwd }), /invalid budget/);
});

test('buildSuperPrompt rejects an invalid mode and an invalid target', (t) => {
  const cwd = withTmp(t);
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', mode: 'bogus', cwd }), /invalid mode/);
  assert.throws(() => promptCore.buildSuperPrompt({ task: 'x', target: 'bogus', cwd }), /invalid target/);
});

test('buildSuperPrompt without a task or state goal explains how to fix it', (t) => {
  const cwd = withTmp(t);
  assert.throws(() => promptCore.buildSuperPrompt({ cwd }), /missing task: describe it, e\.g\. weave prompt claude/);
});

test('parseStateMarkdown extracts the contract and keeps working memory verbatim', () => {
  const parsed = promptCore.parseStateMarkdown(SAMPLE_STATE.join('\n'));
  assert.equal(parsed.goal, 'Ship the feature.');
  assert.equal(parsed.constraints, 'No new dependencies.');
  assert.equal(parsed.antiScope, 'Refactoring unrelated modules.');
  assert.equal(parsed.criteria, 'npm test passes.');
  assert.equal(parsed.questions, '- Which payment provider should be used?');
  assert.match(parsed.plan, /1\. core\/orders\.js - validate totals/);
  assert.match(parsed.memory, /- file: core\/orders\.js\n  reason: computes order totals\./);
  assert.match(parsed.memory, /Confirmed facts:\n- amount must be non-negative/);
});

test('parseMemoryMarkdown returns the Working memory section, or the whole file without one', () => {
  assert.equal(promptCore.parseMemoryMarkdown('## Working memory\n- a\n## Plan\n- b').memory, '- a');
  assert.equal(promptCore.parseMemoryMarkdown('- loose note').memory, '- loose note');
});

test('without a task, .weave/state.md drives the brief automatically', (t) => {
  const cwd = withTmp(t);
  writeState(cwd, SAMPLE_STATE);
  const text = promptCore.buildSuperPrompt({ target: 'claude', cwd });
  assert.match(text, /## Task\nShip the feature\./);
  assert.match(text, /## Done when\n- npm test passes\./);
  assert.match(text, /## Scope\n- Constraint: No new dependencies\.\n- Out of scope: Refactoring unrelated modules\./);
  assert.match(text, /## Open decisions\n- Which payment provider should be used\?/);
  assert.match(text, /## Existing plan\nCheck this plan against the current request and repository before executing it\.\n1\. core\/orders\.js/);
  assert.match(
    text,
    /## What is already known\n- file: core\/orders\.js\n  reason: computes order totals\.\n  relation: called by the checkout handler\.\n\nConfirmed facts:\n- amount must be non-negative/
  );
});

test('a task alone ignores state unless state is requested', (t) => {
  const cwd = withTmp(t);
  writeState(cwd, SAMPLE_STATE);
  const plain = promptCore.buildSuperPrompt({ task: 'Other task', cwd });
  assert.equal(plain.includes('core/orders.js'), false);
  assert.match(plain, /Derive observable acceptance criteria/);
  assert.equal(plain.includes('Which payment provider'), false);

  const merged = promptCore.buildSuperPrompt({ task: 'Other task', state: true, cwd });
  assert.match(merged, /## Task\nOther task/);
  assert.equal(merged.includes('Ship the feature.'), false);
  assert.match(merged, /core\/orders\.js/);
  assert.match(merged, /## Existing plan/);
});

test('a saved memory snapshot feeds the known facts', (t) => {
  const cwd = withTmp(t);
  writeState(cwd, ['## Goal', 'placeholder', '', '## Working memory', '- the order table key maps to order_id']);
  memory.saveMemory(cwd, 'checkpoint');
  const text = promptCore.buildSuperPrompt({ task: 'continue the migration', memory: 'checkpoint', cwd });
  assert.match(text, /## Task\ncontinue the migration/);
  assert.match(text, /## What is already known\n- the order table key maps to order_id/);
});

test('CLI: weave prompt claude "task" prints the Claude brief', (t) => {
  const cwd = withTmp(t);
  const res = runCli(['prompt', 'claude', 'fix', 'the', 'login'], cwd);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /^# Task brief for Claude Code/);
  assert.match(res.stdout, /## Task\nfix the login\n/);
});

test('CLI: the target word is only consumed in first position', (t) => {
  const cwd = withTmp(t);
  const res = runCli(['prompt', '--for=codex', 'claude', 'is', 'slow'], cwd);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /^# Task brief for Codex/);
  assert.match(res.stdout, /## Task\nclaude is slow\n/);
});

test('CLI: short and spaced options match their --name=value forms', (t) => {
  const cwd = withTmp(t);
  const a = runCli(['prompt', '-f', 'gemini', '-b', '4', '-m', 'lite', 'task'], cwd);
  const b = runCli(['prompt', '--for=gemini', '--budget=4', '--mode=lite', 'task'], cwd);
  const c = runCli(['prompt', '--target', 'gemini', '--budget', '4', '--mode', 'lite', 'task'], cwd);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout, b.stdout);
  assert.equal(a.stdout, c.stdout);
  assert.match(a.stdout, /at most 4 steps/);
});

test('CLI: aliases antigravity and agy select the Gemini style', (t) => {
  const cwd = withTmp(t);
  for (const alias of ['antigravity', 'agy']) {
    const res = runCli(['prompt', alias, 'task'], cwd);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^# Task brief for Gemini/);
  }
});

test('CLI: the detected agent picks the default style', (t) => {
  const cwd = withTmp(t);
  const codex = runCli(['prompt', 'task'], cwd, { ...cleanEnv(), CODEX_THREAD_ID: 'x' });
  assert.match(codex.stdout, /^# Task brief for Codex/);
  const gemini = runCli(['prompt', 'task'], cwd, { ...cleanEnv(), ANTIGRAVITY_AGENT: '1' });
  assert.match(gemini.stdout, /^# Task brief for Gemini/);
  const generic = runCli(['prompt', 'task'], cwd);
  assert.match(generic.stdout, /^# Task brief\n/);
  const unknown = runCli(['prompt', 'task'], cwd, { ...cleanEnv(), WEAVE_AGENT: 'something-else' });
  assert.equal(unknown.status, 0, unknown.stderr);
  assert.match(unknown.stdout, /^# Task brief\n/);
});

test('CLI: weave prompt with no task uses .weave/state.md', (t) => {
  const cwd = withTmp(t);
  writeState(cwd, SAMPLE_STATE);
  const res = runCli(['prompt', 'codex'], cwd);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /## Task\nShip the feature\./);
});

test('CLI: weave prompt with no task and no state exits 2 with a hint', (t) => {
  const cwd = withTmp(t);
  const res = runCli(['prompt', 'claude'], cwd);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /missing task/);
});

test('CLI: weave prompt rejects bad input with exit 2 and a help hint', (t) => {
  const cwd = withTmp(t);
  const cases = [
    [['prompt', '--mode=bogus', 'task'], /--mode expects/],
    [['prompt', '--budget=999', 'task'], /invalid budget: 999/],
    [['prompt', '--budget=0x10', 'task'], /expected a decimal integer/],
    [['prompt', '-b', 'ten', 'task'], /expected a decimal integer/],
    [['prompt', '--for=bogus', 'task'], /invalid target: bogus/],
    [['prompt', '--xml', 'task'], /unrecognized option "--xml"/],
    [['prompt', 'task', '--budget'], /--budget needs a value/],
    [['prompt', '--cwd=does-not-exist-dir', 'task'], /invalid --cwd/],
  ];
  for (const [args, re] of cases) {
    const res = runCli(args, cwd);
    assert.equal(res.status, 2, args.join(' '));
    assert.match(res.stderr, re);
    assert.match(res.stderr, /weave prompt --help/);
  }
});

test('CLI: "--" keeps flag-looking words in the task', (t) => {
  const cwd = withTmp(t);
  const res = runCli(['prompt', 'claude', '--', '--flag-in-task', 'fix', 'bug'], cwd);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /## Task\n--flag-in-task fix bug/);
});

test('CLI: weave prompt --help and -h print usage with examples and exit 0', (t) => {
  const cwd = withTmp(t);
  for (const flag of ['--help', '-h']) {
    const res = runCli(['prompt', flag], cwd);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage: weave prompt \[claude\|gemini\|codex\]/);
    assert.match(res.stdout, /weave prompt claude "fix the login timeout"/);
  }
});

test('mcp server: tools/list exposes prompt with a target enum and no xml flag', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    const res = await nextResponse();
    const tool = res.result.tools.find((t) => t.name === 'prompt');
    assert.ok(tool);
    assert.deepEqual(tool.inputSchema.properties.target.enum, promptCore.TARGETS);
    assert.equal(tool.inputSchema.properties.xml, undefined);
    assert.equal(tool.inputSchema.properties.raw, undefined);
  });
});

test('mcp server: tools/call prompt returns the brief for the requested target', async () => {
  await withServer(async ({ send, nextResponse }) => {
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'prompt', arguments: { task: 'mcp task', budget: 3, target: 'gemini' } },
    });
    const res = await nextResponse();
    assert.ok(res.result, `expected a result, got error: ${JSON.stringify(res.error)}`);
    const text = res.result.content[0].text;
    assert.match(text, /^# Task brief for Gemini/);
    assert.match(text, /at most 3 steps/);
    assert.match(text, /## Task\nmcp task$/);
  });
});

test('mcp server: tools/call prompt rejects invalid arguments with JSON-RPC errors', async () => {
  const cases = [
    [{ task: 'x', budget: 999 }, /invalid budget/],
    [{ load_state: 'false' }, /invalid load_state: must be a boolean/],
    [{ task: 12345 }, /invalid task: must be a string/],
    [{ task: 'x', target: 7 }, /invalid target: must be a string/],
    [{ task: 'x', target: 'bogus' }, /invalid target: bogus/],
    [null, /invalid tool arguments/],
  ];
  await withServer(async ({ send, nextResponse }) => {
    let id = 10;
    for (const [args, re] of cases) {
      send({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'prompt', arguments: args } });
      const res = await nextResponse();
      assert.ok(res.error, JSON.stringify(args));
      assert.match(res.error.message, re);
    }
  });
});

test('briefs carry the automatic plan so the receiving agent thinks before coding', (t) => {
  const cwd = withTmp(t);
  for (const target of promptCore.TARGETS) {
    const text = promptCore.buildSuperPrompt({ task: 'fix the bug', target, mode: 'full', cwd });
    assert.match(text, /## Plan before you code\n1\. Understand: /);
    assert.match(text, /stop and re-plan instead of patching around it/);
    assert.ok(text.indexOf('## Plan before you code') < text.indexOf('## Engineering rules'), target);
  }
  const off = promptCore.buildSuperPrompt({ task: 'x', mode: 'off', cwd });
  assert.equal(off.includes('## Plan before you code'), false);
});

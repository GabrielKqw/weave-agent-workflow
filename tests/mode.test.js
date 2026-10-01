'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const mode = require('../core/mode');

const HOOK = path.join(__dirname, '..', 'hooks', 'lifecycle.js');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-mode-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function runHook(input) {
  return spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: 'utf8' });
}

test('mode defaults to full and validates persisted values', (t) => {
  const dir = tempDir(t);
  assert.equal(mode.readMode(dir), 'full');
  mode.writeMode(dir, 'ultra');
  assert.equal(mode.readMode(dir), 'ultra');
  assert.throws(() => mode.writeMode(dir, 'invalid'));
});

test('mode commands are exact and do not match ordinary prompts', () => {
  assert.equal(mode.requestedMode('/weave lite'), 'lite');
  assert.equal(mode.requestedMode('weave mode full'), 'full');
  assert.equal(mode.requestedMode('stop weave'), 'off');
  assert.equal(mode.requestedMode('please improve weave full time'), null);
});

test('SessionStart injects the active mode', (t) => {
  const dir = tempDir(t);
  mode.writeMode(dir, 'lite');
  const result = runHook({ hook_event_name: 'SessionStart', cwd: dir });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /WEAVE MODE ACTIVE - level: lite/);
});

test('UserPromptSubmit switches mode and returns additional context', (t) => {
  const dir = tempDir(t);
  const result = runHook({ hook_event_name: 'UserPromptSubmit', cwd: dir, prompt: '/weave ultra' });
  assert.equal(result.status, 0);
  assert.equal(mode.readMode(dir), 'ultra');
  const output = JSON.parse(result.stdout);
  assert.match(output.hookSpecificOutput.additionalContext, /level: ultra/);
});

test('UserPromptSubmit stays silent for ordinary prompts', (t) => {
  const dir = tempDir(t);
  const result = runHook({ hook_event_name: 'UserPromptSubmit', cwd: dir, prompt: 'fix the parser' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('UserPromptSubmit diagnoses a recognized mode change that cannot be written', (t) => {
  const file = path.join(tempDir(t), 'not-a-directory');
  fs.writeFileSync(file, 'x');
  const result = runHook({ hook_event_name: 'UserPromptSubmit', cwd: file, prompt: '/weave full' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /weave: failed to change mode to full:/);
});

test('full and ultra policies plan automatically before any code', () => {
  for (const level of ['full', 'ultra']) {
    const text = mode.instructions(level);
    assert.match(text, /Plan before you code, automatically, on every coding request; do not wait for \/weave-plan\./);
    assert.match(text, /1\. Understand: /);
    assert.match(text, /2\. Contract: /);
    assert.match(text, /3\. Ladder: stop at the first rung that holds/);
    assert.match(text, /4\. Plan: /);
    assert.match(text, /stop and re-plan instead of patching around it/);
    assert.match(text, /6\. Verify with real evidence/);
    assert.ok(text.indexOf('1. Understand') < text.indexOf('Rules:'));
  }
  assert.match(mode.instructions('ultra'), /prefer deletion/);
  assert.doesNotMatch(mode.instructions('full'), /prefer deletion/);
});

test('lite keeps a one-line contract and off injects nothing to plan', () => {
  const lite = mode.instructions('lite');
  assert.match(lite, /Plan before you code/);
  assert.match(lite, /1\. Before editing, state in one line the goal and the check/);
  assert.doesNotMatch(lite, /3\. Ladder/);
  assert.equal(mode.instructions('off'), 'WEAVE MODE OFF');
  assert.deepEqual(mode.planSteps('off'), []);
  assert.deepEqual(mode.rules('off'), []);
});

test('instructions are built from planSteps and rules', () => {
  for (const level of ['lite', 'full', 'ultra']) {
    const text = mode.instructions(level);
    mode.planSteps(level).forEach((step, i) => assert.ok(text.includes(`${i + 1}. ${step}`), step));
    mode.rules(level).forEach((rule) => assert.ok(text.includes(`- ${rule}`), rule));
  }
});

test('SessionStart and SubagentStart inject the automatic plan', (t) => {
  const dir = tempDir(t);
  for (const event of ['SessionStart', 'SubagentStart']) {
    const result = runHook({ hook_event_name: event, cwd: dir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Plan before you code/);
    assert.match(result.stdout, /Ladder: stop at the first rung that holds/);
  }
});

test('generated agent rule files carry the automatic plan', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['AGENTS.md', 'GEMINI.md', '.cursor/rules/weave.mdc', '.clinerules/weave.md', '.windsurf/rules/weave.md']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(text.includes(mode.instructions('full')), file);
  }
});

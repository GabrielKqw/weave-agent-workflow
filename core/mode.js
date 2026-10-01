'use strict';

const fs = require('fs');
const path = require('path');

const MODES = new Set(['off', 'lite', 'full', 'ultra']);

function modePath(cwd) {
  return path.join(cwd || process.cwd(), '.weave', 'mode');
}

function readMode(cwd) {
  try {
    const mode = fs.readFileSync(modePath(cwd), 'utf8').trim();
    return MODES.has(mode) ? mode : 'full';
  } catch {
    return 'full';
  }
}

function writeMode(cwd, mode) {
  if (!MODES.has(mode)) throw new Error(`invalid mode: ${mode}`);
  const file = modePath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, mode + '\n');
  return mode;
}

function requestedMode(prompt) {
  const text = String(prompt || '').trim().toLowerCase();
  if (/^(stop weave|normal mode)$/.test(text)) return 'off';
  const match = /^(?:[/@$]weave|weave\s+mode)\s+(off|lite|full|ultra)$/.exec(text);
  return match ? match[1] : null;
}

const PLAN_STEPS = {
  lite: [
    'Before editing, state in one line the goal and the check that proves it is done.',
    'If something already in the repo, the standard library, or the platform covers it, use it, or name it as the smaller alternative.',
  ],
  full: [
    'Understand: read the request and the code it touches; trace the real flow from its entry point before deciding anything.',
    'Contract: state the goal and the check that proves it is done. Ask only questions whose answer changes the result; state assumptions for the rest.',
    'Ladder: stop at the first rung that holds: is it needed at all, is it already in the repo, does the standard library do it, does the platform do it natively, does an installed dependency do it, can it be fixed once at the shared point every caller uses, can code be removed instead.',
    'Plan: for work spanning several files, a public interface, or shared state, write the ordered steps (file, change, check) before the first edit. For a single-concern change, the contract is the plan.',
    'Build only what the plan says. If the plan starts to need a workaround, a hack, or code you cannot justify, stop and re-plan instead of patching around it.',
    'Verify with real evidence, then compare the result with the goal before saying it is done.',
  ],
};

const RULES = [
  'Trace the affected flow before editing; fix shared causes, not isolated symptoms.',
  'Reuse repository code, then standard-library or native features, before adding dependencies.',
  'Make the smallest correct change and verify it with real evidence.',
  'Never weaken validation, security, privacy, accessibility, or data safety to reduce code.',
  'Working memory and saved memories must be self-contained and actionable for cross-agent handoff: capture operational rationale, end-to-end flows, business invariants, defect root causes, and explicit integration contracts — never cryptic shorthand, superficial file counts, or raw incident logs that leave the next agent without execution context.',
];

const ULTRA_RULE = 'Question whether new code is needed; prefer deletion and direct one-purpose code over flexibility.';

function planSteps(mode) {
  if (mode === 'off') return [];
  return PLAN_STEPS[mode === 'lite' ? 'lite' : 'full'];
}

function rules(mode) {
  if (mode === 'off') return [];
  if (mode === 'lite') return [RULES[1], RULES[2]];
  if (mode === 'ultra') return [...RULES.slice(0, 3), ULTRA_RULE, ...RULES.slice(3)];
  return [...RULES];
}

function instructions(mode) {
  if (mode === 'off') return 'WEAVE MODE OFF';
  return [
    `WEAVE MODE ACTIVE - level: ${mode}`,
    'Plan before you code, automatically, on every coding request; do not wait for /weave-plan. Think first, then write the least code that solves it.',
    ...planSteps(mode).map((step, i) => `${i + 1}. ${step}`),
    'Rules:',
    ...rules(mode).map((rule) => `- ${rule}`),
  ].join('\n');
}

module.exports = { MODES, modePath, readMode, writeMode, requestedMode, planSteps, rules, instructions };

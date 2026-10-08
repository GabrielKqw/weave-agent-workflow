'use strict';

const fs = require('fs');
const path = require('path');
const modes = require('./mode');
const memory = require('./memory');

const TARGETS = ['claude', 'gemini', 'codex', 'generic'];

const TARGET_ALIASES = {
  claude: 'claude',
  'claude-code': 'claude',
  gemini: 'gemini',
  antigravity: 'gemini',
  agy: 'gemini',
  codex: 'codex',
  openai: 'codex',
  generic: 'generic',
  opencode: 'generic',
};

const DEFAULT_BUDGET = 10;
const MAX_BUDGET = 50;

const FIDELITY_QUESTIONS = [
  'Did I deliver what was actually asked?',
  "Did I change anything that wasn't required?",
  'Does the change address the cause, not just a symptom?',
  'Is there an equally correct, smaller change I passed over?',
  'Am I reporting activity (files opened, commands run) as a result while the completion criteria are still unmet?',
  'Is every claim backed by real evidence, such as command output or a test that actually ran?',
];

function normalizeTarget(value) {
  if (value === undefined || value === null || value === '') return 'generic';
  const target = TARGET_ALIASES[String(value).trim().toLowerCase()];
  if (!target) throw new Error(`invalid target: ${value} (expected ${TARGETS.join(', ')})`);
  return target;
}

function isTarget(value) {
  return Object.prototype.hasOwnProperty.call(TARGET_ALIASES, String(value || '').trim().toLowerCase());
}

function cleanText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function parseSections(content) {
  const sections = {};
  let current = null;
  let buf = [];
  const flush = () => {
    if (current !== null) sections[current] = buf.join('\n').trim();
  };
  for (const line of String(content || '').split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1].trim().toLowerCase();
      buf = [];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

function parseStateMarkdown(content) {
  const sections = parseSections(content);
  return {
    goal: sections['goal'] || '',
    constraints: sections['constraints'] || '',
    antiScope: sections['not requested'] || '',
    criteria: sections['completion criteria'] || '',
    questions: sections['blocking questions'] || '',
    memory: sections['working memory'] || '',
    plan: sections['plan'] || '',
  };
}

function parseMemoryMarkdown(content) {
  const sections = parseSections(content);
  return { memory: sections['working memory'] || String(content || '') };
}

function bullets(text) {
  return cleanText(text)
    .split('\n')
    .map((l) => l.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
    .map((l) => `- ${l}`);
}


function knownFacts(contract) {
  const text = cleanText(contract.memory).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  return text ? text.split('\n') : [];
}

const PROFILES = {
  claude: {
    title: 'Task brief for Claude Code',
    intro: [
      'You are Claude Code working inside this repository. Follow CLAUDE.md and any project instructions before this brief.',
      'Read the relevant files before proposing a change; never speculate about code you have not opened.',
    ],
    method: (budget) => [
      `You have about ${budget} working steps. For each step, say what you will check and why, run it, then compare the real result with what you expected.`,
      'If the evidence contradicts your plan, step back and revise the plan instead of pushing forward.',
      'If a requirement is ambiguous or two readings would lead to different code, stop and ask the user before editing.',
      'Use a todo list for multi-step work and keep it current.',
    ],
    report: [
      'A short summary of what changed and why.',
      'The files changed, each with a one-line reason.',
      'The exact verification commands you ran and their real output.',
      'Anything left unfinished or unverified, stated plainly.',
    ],
    taskLast: false,
  },
  gemini: {
    title: 'Task brief for Gemini',
    intro: [
      'You are a coding agent working inside this repository. Follow GEMINI.md and any project instructions before this brief.',
      'Use only facts you have confirmed from files or command output. Do not invent file names, APIs, or results.',
    ],
    method: (budget) => [
      `Work in at most ${budget} steps. Before each step, state the goal of the step in one sentence.`,
      'Read only the file ranges you need. Keep tool output short.',
      'After each step, check the real result. If it is not what you expected, revise the plan.',
      'If anything is unclear, ask the user one direct question and wait for the answer before changing code.',
    ],
    report: [
      'Summary: two or three sentences.',
      'Changes: one line per file.',
      'Verification: the commands you ran and their real output.',
      'Open points: anything not done or not verified.',
    ],
    taskLast: true,
  },
  codex: {
    title: 'Task brief for Codex',
    intro: [
      'You are Codex working inside this repository. Follow AGENTS.md and any project instructions before this brief.',
      'Keep going until the task is fully resolved. Only stop early to ask when a real ambiguity blocks a correct change.',
    ],
    method: (budget) => [
      `Plan briefly, then act. Budget: about ${budget} steps.`,
      'Search with rg before reading. Read a file before editing it.',
      'Make minimal, focused diffs that match the existing style.',
      'Run the relevant tests after editing and fix any failure you caused.',
    ],
    report: [
      'Keep the final answer brief: what changed, where, and why.',
      'List the verification commands and their outcome.',
      'Call out anything not done or not verified.',
    ],
    taskLast: false,
  },
  generic: {
    title: 'Task brief',
    intro: [
      'You are a coding agent working inside this repository. Follow the project instruction files (AGENTS.md or equivalent) before this brief.',
      'Base every claim on files you read or commands you ran.',
    ],
    method: (budget) => [
      `Work in about ${budget} steps. For each step, state what you expect, run it, and compare the real result.`,
      'If the evidence contradicts the plan, revise the plan.',
      'If a requirement is ambiguous, ask the user before changing code.',
    ],
    report: [
      'What changed and why.',
      'The files changed.',
      'The verification commands you ran and their real output.',
      'Anything left unfinished or unverified.',
    ],
    taskLast: false,
  },
};

function section(title, lines) {
  return lines.length ? [`## ${title}`, ...lines, ''] : [];
}

function renderPrompt({ target, contract, goal, mode, budget }) {
  const profile = PROFILES[target];
  const scope = [
    ...bullets(contract.constraints).map((l) => l.replace(/^- /, '- Constraint: ')),
    ...bullets(contract.antiScope).map((l) => l.replace(/^- /, '- Out of scope: ')),
  ];
  const criteria = bullets(contract.criteria);
  const questions = cleanText(contract.questions);
  const plan = cleanText(contract.plan);
  const taskSection = section('Task', [cleanText(goal)]);
  const lines = [
    `# ${profile.title}`,
    '',
    ...profile.intro,
    '',
    ...(profile.taskLast ? [] : taskSection),
    ...section('Done when', criteria.length ? criteria : ['- Derive observable acceptance criteria from the task and check them before finishing. If the request cannot determine them, ask one focused question.']),
    ...section('Scope', scope),
    ...section('What is already known', knownFacts(contract)),
    ...section('Open decisions', questions && !/^none\.?$/i.test(questions) ? [questions] : []),
    ...section('Existing plan', plan ? ['Check this plan against the current request and repository before executing it.', plan] : []),
    ...section('Plan before you code', modes.planSteps(mode).map((l, i) => `${i + 1}. ${l}`)),
    ...section('Engineering rules', modes.rules(mode).map((l) => `- ${l}`)),
    ...section('How to work', profile.method(budget).map((l) => `- ${l}`)),
    ...section('Before you say it is done', FIDELITY_QUESTIONS.map((q, i) => `${i + 1}. ${q}`)),
    ...section('Final report', profile.report.map((l) => `- ${l}`)),
    ...(profile.taskLast ? taskSection : []),
  ];
  return lines.join('\n').trim();
}

function buildSuperPrompt(options = {}) {
  const cwd = options.cwd || process.cwd();
  const mode = options.mode || modes.readMode(cwd);
  if (!modes.MODES.has(mode)) throw new Error(`invalid mode: ${mode}`);

  const budget = options.budget === undefined ? DEFAULT_BUDGET : options.budget;
  if (!Number.isInteger(budget) || budget < 1 || budget > MAX_BUDGET) {
    throw new Error(`invalid budget: ${options.budget} (expected an integer between 1 and ${MAX_BUDGET})`);
  }

  const target = normalizeTarget(options.target);
  const task = cleanText(options.task);
  const contract = { goal: '', constraints: '', antiScope: '', criteria: '', questions: '', memory: '', plan: '' };

  const statePath = path.join(cwd, '.weave', 'state.md');
  if ((options.state || !task) && fs.existsSync(statePath)) {
    Object.assign(contract, parseStateMarkdown(fs.readFileSync(statePath, 'utf8')));
  }
  if (options.memory) {
    Object.assign(contract, parseMemoryMarkdown(memory.showMemory(cwd, options.memory)));
  }

  const goal = task || cleanText(contract.goal);
  if (!goal) {
    throw new Error('missing task: describe it, e.g. weave prompt claude "fix the login timeout", or record a Goal in .weave/state.md');
  }

  return renderPrompt({ target, contract, goal, mode, budget });
}

module.exports = { TARGETS, DEFAULT_BUDGET, MAX_BUDGET, FIDELITY_QUESTIONS, isTarget, normalizeTarget, parseStateMarkdown, parseMemoryMarkdown, buildSuperPrompt };

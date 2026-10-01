'use strict';

const path = require('path');
const execCore = require('../core/exec');
const modeCore = require('../core/mode');

async function WeavePlugin(ctx) {
  const cwd = (ctx && (ctx.directory || ctx.worktree)) || process.cwd();
  return {
    'experimental.chat.system.transform': async (input, output) => {
      if (!output || !Array.isArray(output.system)) return;
      const activeMode = modeCore.readMode(cwd);
      if (activeMode === 'off') return;
      output.system.push(modeCore.instructions(activeMode));
    },
    'tool.execute.before': async (input, output) => {
      if (!input || !output || !output.args) return;
      const tool = String(input.tool || '').toLowerCase();
      if (
        tool === 'bash' ||
        tool === 'sh' ||
        tool === 'terminal' ||
        tool === 'powershell' ||
        tool === 'pwsh' ||
        tool === 'run_command'
      ) {
        const command = output.args.command !== undefined ? output.args.command : output.args.cmd;
        if (!command || typeof command !== 'string') return;
        if (!execCore.shouldWrap({ command })) return;

        const weaveJsPath = path.resolve(__dirname, '..', 'cli', 'weave.js');
        const isPowershell = tool === 'powershell' || tool === 'pwsh' || (process.platform === 'win32' && tool !== 'bash' && tool !== 'sh');
        const targetShell = isPowershell ? 'powershell' : 'bash';
        const wrapped = execCore.buildWrappedCommand(command, weaveJsPath, cwd, { shell: targetShell });

        if (output.args.command !== undefined) {
          output.args.command = wrapped;
        } else if (output.args.cmd !== undefined) {
          output.args.cmd = wrapped;
        }
      }
    },
  };
}

module.exports = WeavePlugin;
module.exports.WeavePlugin = WeavePlugin;
module.exports.default = WeavePlugin;

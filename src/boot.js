// boot.js - 系统启动模块
import { FileSystem } from './kernel/fs2.js';
import { ProcessManager } from './kernel/process.js';
import { OSTerminal } from './kernel/terminal.js';
import { CommandProcessor } from './kernel/command.js';
// 主入口模块
class JsOS {
  constructor(terminalId) {
    // 初始化终端
    this.terminal = new OSTerminal(terminalId);
    this.terminal.writeln('[boot] 初始化终端............');

    // 初始化文件系统
    this.terminal.writeln('[boot] 初始化文件系统............');
    this.fs = new FileSystem();
    
    // 初始化进程管理器
    this.terminal.writeln('[boot] 初始化进程管理器............');
    this.processManager = new ProcessManager(this.fs, this.terminal);
    
    // booted.
    this.terminal.writeln('[boot] os kernel ready..........');

    // stdio交由命令处理器
    this.terminal.writeln('[boot] 初始化命令处理器............');
    this.commandProcessor = new CommandProcessor(
      this.terminal,
      this.fs,
      this.processManager
    );
  }

}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 创建应用实例
  window.os = new JsOS('terminal-container');
});

// 导出JsOS类
export { JsOS };
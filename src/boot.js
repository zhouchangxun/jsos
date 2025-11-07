// boot.js - 系统启动模块
import { FileSystem } from './kernel/vfs.js';
import { OSTerminal } from './kernel/terminal.js';
import { ProcessManager } from './kernel/process.js';
import { CommandProcessor } from './kernel/command.js';
import Pipe from './kernel/pipe.js';

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
    this.proc = new ProcessManager(this.fs, this.terminal);
    
    // 初始化管道
    this.terminal.writeln('[boot] mount pipe interface............');
    this.Pipe = Pipe;

    // booted.
    this.terminal.writeln('[boot] os kernel ready..........');
  }
  boot() {
    // first process
    // stdio交由命令处理器
    this.terminal.writeln('[init] 初始化命令处理器............');
    let commandProcessor = new CommandProcessor(this);
    commandProcessor.run();
  }
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 创建OS实例
  window.os = new JsOS('terminal-container');

  window.os.boot();
});

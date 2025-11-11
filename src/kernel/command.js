// command.js: 简单的命令处理模块，只支持基本的REPL(Readline, Execute, Print, Loop-again)
// sh.js 是一个支持部分linux shell语言要素的简单解释器实现，支持if/else/for/while/case等基本编程语言语法
// 导入内置命令模块
import { builtinCommands } from '../bin/builtin.js';
import { Autocomplete } from '../utils/autocomplete.js';
// import { sh } from '../bin/sh.js';

class CommandProcessor {
  constructor(os) {
    this.terminal = os.terminal;
    this.fs = os.fs;
    this.proc = os.proc;

    this.commands = {};
    this.foregroundProcess = null; // 跟踪前台运行的进程
    this._initCommands();
    // 初始化自动补全
    this.autocomplete = new Autocomplete(this.fs, this);
    // 绑定事件处理函数
    this._bindEvents();
  }
  // REPL loop
  async run() {
    this.terminal.writeln('\nWelcome to JS OS Terminal (类Unix环境)\n');
    this.terminal.writeln('输入 "help" 查看可用命令');
    this.terminal.writeln('当前处于basic REPL模式。\n(输入 "sh" 切换到标准Shell模式。)');
    this.terminal.focus();      // 确保终端保持聚焦
    this.prompt();
    
    while (true) {
      // Read: 等待用户输入
      const input = await this.terminal.readline();

      // Execute: 执行用户输入
      let ret = await this.execute(input);

      // Print: 打印执行结果（如果有）
      if (ret) {
        this.terminal.writeln('ret:' + ret);
      }

      // Loop again
      this.prompt();
    }
  }
  // 初始化命令
  _initCommands() {
    // 从builtin.js导入所有命令并包装为同步函数
    const commandNames = Object.keys(builtinCommands);

    for (const name of commandNames) {
      // this.commands[name] = this._wrapAsyncCommand(name).bind(this);
      this.commands[name] = builtinCommands[name];
    }
    // extra cmd
    this.commands['sh'] = async (args, context={}) => {
      context.args = args;
      let stdout = await sh(context);
      this.terminal.writeln(stdout);
    };
  }
  
// 绑定事件处理函数
  _bindEvents() {
    // 命令处理事件
    this.terminal.onCommand = async (command) => await this._handleCommand(command);

    // Tab补全事件
    this.terminal.onTabComplete = (input) => this._handleTabComplete(input);
    
    // Ctrl+C事件
    this.terminal.onCtrlC = () => this._handleCtrlC();

    // this.terminal.onPrompt = () => this.onPrompt();
  }
  
  // 处理命令
  async _handleCommand(command) {
    await this.execute(command);
  }
  
  
  // 处理Node.js REPL命令
  _handleNodeReplCommand(command) {
    // 尝试将命令作为JS代码执行
    this._executeJsStatement(command);
  }
  
  // 处理Tab补全
  _handleTabComplete(input) {
    const matches = this.autocomplete.complete(input);
    this.autocomplete.formatCompletion(input, matches, this.terminal);
  }
  
  // 处理Ctrl+C
  _handleCtrlC() {
    // 终止前台进程
    if (this.foregroundProcess) {
      this.foregroundProcess.kill();
      this.foregroundProcess = null;
      this.terminal.isProcessingCommand = false;
    }
    
    // 显示提示符
    this.prompt();
  }
  
  // 显示提示符
  prompt(content = '') {
    const path = this.fs.pwd();
    const prompt = `${path} $ `;
    // 使用ANSI颜色代码 - xterm.js支持这些代码
    let PS1 = `\x1B[36m${prompt}\x1B[0m`;
    this.terminal.setPrompt(PS1, prompt.length);
    this.terminal.prompt(content);
  }
  
  // 显示变量值
  _displayValue(value) {
    if (value === null) {
      this.terminal.writeln('null');
    } else if (typeof value === 'object') {
      try {
        this.terminal.writeln(JSON.stringify(value, null, 2));
      } catch (e) {
        this.terminal.writeln(String(value));
      }
    } else {
      this.terminal.writeln(String(value));
    }
    this.terminal.prompt();
  }

  // 解析命令字符串为命令名和参数数组
  _parseCommand(command) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let escapeNext = false;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
        continue;
      }
      
      if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
        continue;
      }
      
      current += char;
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }

  // 执行命令
  async execute(command) {
    command = command.trim();
    if (!command) return;
    
    // 检查是否包含管道
    if (command.includes('|')) {
      return await this._executePipeline(command);
    }
    
    const parts = this._parseCommand(command);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    // 提供一个带有标准IO的上下文
    const context = {
      stdin: '',
      stdout: '',
      stderr: ''
    };
    
    if (this.commands[cmdName]) {
      // 执行命令
      let ret = await this.commands[cmdName](args, context);
      
      // 输出stdout
      if (context.stdout) {
        this.terminal.writeln(context.stdout);
      }
      
      // 输出stderr 
      if (context.stderr) {
        this.terminal.writeln(`\x1B[31m${context.stderr}\x1B[0m`);
      }

      return ret;
    } else {
      this.terminal.writeln(`\x1B[31mcmd: 未知命令 '${cmdName}'\x1B[0m`);
    }
  }
  
  // 执行管道命令，返回最后一个命令的退出状态（简易实现，只支持一把输出并传递到下一个命令）
  async _executePipeline(command) {
    // 分割管道命令
    const pipeline = command.split('|').map(cmd => cmd.trim());
    
    // 从第一个命令开始，将输出传递给下一个命令
    let lastOutput = '';
    
    for (let i = 0; i < pipeline.length; i++) {
      const cmd = pipeline[i];
      const parts = this._parseCommand(cmd);
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1);
      
      // 创建上下文，设置stdin为上一个命令的输出
      const context = {
        stdin: lastOutput,
        stdout: '',
        stderr: ''
      };
      
      if (this.commands[cmdName]) {
        // 执行命令
        let ret = await this.commands[cmdName](args, context);
        
        // 传递输出
        lastOutput = context.stdout;
        
        // 如果有错误，显示并中断管道
        if (context.stderr) {
          this.terminal.writeln(`\x1B[31m${context.stderr}\x1B[0m`);
          return ret;
        }
      } else {
        this.terminal.writeln(`\x1B[31msh: 未知命令 '${cmdName}'\x1B[0m`);
        return 1;
      }
    }
    
    // 输出最后一个命令的结果
    if (lastOutput) {
      this.terminal.writeln(lastOutput);
    }
  }
}

// 命令实现已移至builtin.js

// 导出CommandProcessor类
export { CommandProcessor };

// 为了向后兼容，仍然挂载到window对象
window.CommandProcessor = CommandProcessor;
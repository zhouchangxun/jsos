// command.js: 简单的命令处理模块，只支持基本的REPL(Readline, Execute, Print, Loop-again)
// sh.js 是一个支持部分linux shell语言要素的简单解释器实现，支持if/else/for/while/case等基本编程语言语法
// 导入内置命令模块
import { builtinCommands } from '../bin/builtin.js';
import { Autocomplete } from '../utils/autocomplete.js';
// import { sh } from '../bin/sh.js';

class CommandProcessor {
  constructor(terminal, fs, processManager) {
    this.terminal = terminal;
    this.fs = fs;
    this.processManager = processManager;

    this.commands = {};
    this.foregroundProcess = null; // 跟踪前台运行的进程
    this._initCommands();
    // 初始化自动补全
    this.autocomplete = new Autocomplete(this.fs, this);
    // 绑定事件处理函数
    this._bindEvents();
    this._initWelcome();
  }
  // 初始化欢迎信息
  _initWelcome() {
    // 清除终端并显示欢迎信息
    this.terminal.clear();
    this.terminal.writeln('');
    this.terminal.writeln('Welcome to JS OS Terminal (类Unix环境)');
    this.terminal.writeln('');
    this.terminal.writeln('输入 "help" 查看可用命令');
    this.terminal.writeln('当前处于basic REPL模式(基本命令执行与回显)。输入 "sh" 切换到标准Shell模式。');
    this.prompt();
    this.terminal.write(this.terminal.getPrompt());
    // 确保终端保持聚焦
    this.terminal.focus();
  }
  // 初始化命令
  _initCommands() {
    // 从builtin.js导入所有命令并包装为同步函数
    const commandNames = Object.keys(builtinCommands);

    for (const name of commandNames) {
      this.commands[name] = this._wrapAsyncCommand(name).bind(this);
    }
    // extra cmd
    this.commands['sh'] = async (args, context) => {
      let stdout = await sh(args, context);
      this.terminal.writeln(stdout);
    };
  }
  
  // 包装异步命令为同步调用
  _wrapAsyncCommand(commandName) {
    return async (args, context) => {
      // 创建命令执行上下文
      const cmdContext = {
        stdin: context?.stdin || '',
        stdout: '',
        stderr: ''
      };
      
      // 根据命令类型提供不同的依赖
      const command = builtinCommands[commandName];
      
      try {
        // 调用异步命令，根据命令需要传递不同的依赖
        if (['ls', 'cd', 'mkdir', 'touch', 'rm', 'cat'].includes(commandName)) {
          await command(args, cmdContext, this.fs);
        } else if (['ps', 'kill'].includes(commandName)) {
          await command(args, cmdContext, this.processManager);
        } else if (['js', 'clear'].includes(commandName)) {
          await command(args, cmdContext, this.terminal);
        } else if (commandName === 'edit') {
          // edit命令需要额外的openEditor函数，这里简化处理
          await command(args, cmdContext, this.terminal, this.fs);
        } else {
          // 其他命令只需要args和context
          context.stdout = await command(args, cmdContext);
        }
        
        // 将结果写入上下文
        if (context) {
          context.stdout = cmdContext.stdout;
          context.stderr = cmdContext.stderr;
        }
        
        // 输出到终端（如果有stdout或stderr）
        if (this.terminal && cmdContext.stdout) {
          if (typeof this.terminal.writeln === 'function') {
            this.terminal.writeln(cmdContext.stdout);
          } else if (typeof this.terminal.write === 'function') {
            this.terminal.write(cmdContext.stdout + '\n');
          }
        }
        
        if (this.terminal && cmdContext.stderr) {
          if (typeof this.terminal.writeln === 'function') {
            this.terminal.writeln(cmdContext.stderr);
          } else if (typeof this.terminal.write === 'function') {
            this.terminal.write(cmdContext.stderr + '\n');
          }
        }
      } catch (error) {
        const errorMsg = `执行命令 ${commandName} 时出错: ${error.message}`;
        if (context) {
          context.stderr = errorMsg;
        }
        if (this.terminal) {
          if (typeof this.terminal.writeln === 'function') {
            this.terminal.writeln(errorMsg);
          } else if (typeof this.terminal.write === 'function') {
            this.terminal.write(errorMsg + '\n');
          }
        }
      }
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
  prompt() {
    const path = this.fs.pwd();
    const prompt = `${path} $ `;
    // 使用ANSI颜色代码 - xterm.js支持这些代码
    let PS1 = `\x1B[36m${prompt}\x1B[0m`;
    this.terminal.setPrompt(PS1, prompt.length);
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
    this.prompt();
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
      this._executePipeline(command);
      return;
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
      await this.commands[cmdName](args, context);
      // 输出命令的标准输出到终端
      // if (context.stdout) {
      //   this.terminal.writeln(context.stdout);
      // }
      // 输出错误信息
      if (context.stderr) {
        this.terminal.writeln(`\x1B[31m${context.stderr}\x1B[0m`);
      }
    } else {
      this.terminal.writeln(`\x1B[31mcmd: 未知命令 '${cmdName}'\x1B[0m`);
    }
  }
  
  // 执行管道命令
  _executePipeline(command) {
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
        this.commands[cmdName](args, context);
        
        // 传递输出
        lastOutput = context.stdout;
        
        // 如果有错误，显示并中断管道
        if (context.stderr) {
          this.terminal.writeln(`\x1B[31m${context.stderr}\x1B[0m`);
          return;
        }
      } else {
        this.terminal.writeln(`\x1B[31msh: 未知命令 '${cmdName}'\x1B[0m`);
        return;
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
// 进程管理模块
class ProcessManager {
  constructor(fs, terminal) {
    this.processes = [];
    this.nextPid = 1;
    this.terminal = terminal;
    this.globalVariables = {}; // 存储全局变量
    this.lastResult = undefined;
    this.fs = fs; // 稍后会被注入
  }
  
  // 设置文件系统引用
  setFileSystem(fs) {
    this.fs = fs;
  }
  
  // 启动新进程
  startProcess(name, code, isForeground = false) {
    // 创建AbortController用于终止进程
    const controller = new AbortController();
    const signal = controller.signal;
    
    // 创建进程对象
    const process = {
      pid: this.nextPid++,
      name,
      status: 'running',
      startTime: new Date(),
      controller,
      signal
    };
    
    this.processes.push(process);
    
    // 创建一个类似Node.js REPL的安全执行环境
    const sandbox = {
      console: {
        log: (message) => {
          if (process.status === 'running') {
            // 对于直接执行的JS语句，不显示PID前缀
            if (name === '(eval)') {
              this.terminal.writeln(message);
            } else {
              this.terminal.writeln(`[${process.pid}] ${message}`);
            }
          }
        },
        error: (message) => {
          if (process.status === 'running') {
            if (name === '(eval)') {
              this.terminal.writeln(`\x1B[31mError: ${message}\x1B[0m`);
            } else {
              this.terminal.writeln(`[${process.pid}] \x1B[31mError: ${message}\x1B[0m`);
            }
          }
        },
        warn: (message) => {
          if (process.status === 'running') {
            if (name === '(eval)') {
              this.terminal.writeln(`\x1B[33mWarning: ${message}\x1B[0m`);
            } else {
              this.terminal.writeln(`[${process.pid}] \x1B[33mWarning: ${message}\x1B[0m`);
            }
          }
        },
        info: (message) => {
          if (process.status === 'running') {
            if (name === '(eval)') {
              this.terminal.writeln(`\x1B[34mInfo: ${message}\x1B[0m`);
            } else {
              this.terminal.writeln(`[${process.pid}] \x1B[34mInfo: ${message}\x1B[0m`);
            }
          }
        }
      },
      signal,
      // 添加一些常用的工具函数和对象
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      // 添加常用的Node.js风格工具函数
      require: (moduleName) => {
        throw new Error('require function is not implemented in this REPL');
      },
      module: { exports: {} },
      exports: {},
      global: {},
      // 添加一些实用函数 - 使用bind确保正确的上下文
      setTimeout: (callback, delay, ...args) => setTimeout(callback, delay, ...args),
      setInterval: (callback, delay, ...args) => setInterval(callback, delay, ...args),
      clearTimeout: (timeoutId) => clearTimeout(timeoutId),
      clearInterval: (intervalId) => clearInterval(intervalId),
      // 添加简单的文件系统访问
      fs: {
        readFileSync: (filename) => {
          const result = this.fs.cat(filename);
          if (!result.success) {
            throw new Error(result.error);
          }
          return result.content;
        },
        writeFileSync: (filename, content) => {
          if (!this.fs.exists(filename)) {
            this.fs.touch(filename);
          }
          const result = this.fs.echo(filename, content);
          if (!result.success) {
            throw new Error(result.error);
          }
          return true;
        }
      }
    };
    
    // 为REPL模式添加_last和_变量支持
    if (name === '(eval)') {
      // 存储最后一次评估的结果
      if (typeof this.lastResult !== 'undefined') {
        sandbox._last = this.lastResult;
        sandbox._ = this.lastResult;
      }
    }
    
    try {
      // 解析代码并查找run函数
      // 对于REPL模式，需要捕获变量定义
      let runFunctionCode = `${code}\nreturn run;`;
      console.log(runFunctionCode);
      const func = new Function('sandbox', `
        with (sandbox) {
          ${runFunctionCode}
        }
      `)(sandbox);
      
      if (typeof func !== 'function') {
        throw new Error('文件中必须定义run函数');
      }
      
      // 执行run函数
      func(signal).then((result) => {
        // 对于REPL模式，保存最后一次的结果和更新全局变量
        if (name === '(eval)') {
          this.lastResult = result;
          
          // 如果是REPL模式，尝试更新全局变量
          try {
            // 提取所有变量定义
            const variableMatches = code.match(/(?:^|\s)(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
            if (variableMatches) {
              variableMatches.forEach(match => {
                const varName = match.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/)[0];
                // 在沙箱中尝试获取变量值并保存
                try {
                  const varValue = new Function('sandbox', `
                    with (sandbox) {
                      return typeof ${varName} !== 'undefined' ? ${varName} : undefined;
                    }
                  `)(sandbox);
                  if (varValue !== undefined) {
                    this.globalVariables[varName] = varValue;
                  }
                } catch (e) {
                  // 忽略获取变量失败的情况
                }
              });
            }
          } catch (e) {
            // 忽略更新变量失败的情况
          }
        }
        
        // 对于非REPL模式，显示进程完成信息
        if (name !== '(eval)') {
          this.terminal.writeln(`[${process.pid}] 进程已完成`);
        }
        process.status = 'completed';
      }).catch(err => {
        if (err.name !== 'AbortError') {
          // 对于REPL模式，错误已经在_executeJsStatement中处理
          if (name !== '(eval)') {
            console.error(`[${process.pid}] 进程出错: `, err);
            this.terminal.writeln(`[${process.pid}] \x1B[31m进程出错: ${err.message}\x1B[0m`);
          }
        } else {
          this.terminal.writeln(`[${process.pid}] 进程已被用户中断`);
        }
        process.status = 'failed';
      });
      
    } catch (err) {
      // 对于REPL模式，格式化错误输出
      if (name === '(eval)') {
        this.terminal.writeln(`\x1B[31m${err.name}: ${err.message}\x1B[0m`);
      } else {
        this.terminal.writeln(`[${process.pid}] \x1B[31m启动失败: ${err.message}\x1B[0m`);
      }
      process.status = 'failed';
      return null;
    }
    
    return process;
  }
  
  // 获取变量的值
  getVariableValue(varName) {
    return new Promise((resolve) => {
      // 检查_last和_变量
      if (varName === '_last' || varName === '_') {
        resolve(this.lastResult);
        return;
      }
      
      // 检查全局变量缓存
      if (this.globalVariables.hasOwnProperty(varName)) {
        resolve(this.globalVariables[varName]);
        return;
      }
      
      // 默认返回undefined
      resolve(undefined);
    });
  }
  
  // 终止进程
  killProcess(pid) {
    const process = this.processes.find(p => p.pid === pid && p.status === 'running');
    if (!process) {
      return { success: false, error: '进程不存在或已终止' };
    }
    
    // 触发终止信号
    process.controller.abort();
    process.status = 'killed';
    return { success: true, process };
  }
  
  // 获取进程列表
  listProcesses() {
    return this.processes.filter(p => p.status === 'running');
  }
}

// 导出ProcessManager类
export { ProcessManager };

// 为了向后兼容，仍然挂载到window对象
window.ProcessManager = ProcessManager;
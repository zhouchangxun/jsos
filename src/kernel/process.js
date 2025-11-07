// 进程
class Process {
  constructor(command, mainFunction, args, parent=null) {
    this.self = this;
    this.pid = this._generatePid();
    this.parent = parent; // 父进程引用
    this.status = 'running';
    this.startTime = new Date();
    this.command = command;
    this.main = mainFunction;
    this.args = args;
    this.env = {}; // 环境变量
    this.stdin = {
        read: async (prompt) => {
          return await os.terminal.readline(prompt);
        },
        readline: async (prompt) => {
          return await os.terminal.readline(prompt);
        },
        close: () => {
          ;
        }
    };
    this.stdout = {
        write: (message) => {   
          os.terminal.write(message);
        },
        writeln: (message) => {
          os.terminal.writeln(message);
        },
        close: () => {
          ;
        }
    };
    this.controller = new AbortController();
    this.signal = this.controller.signal;
  }
  _generatePid() {
    return Date.now() % 10000 + Math.floor(Math.random() * 1000);
  }
  pipe(nextProc) {
    // 连接当前进程的stdout到下一个进程的stdin
    let pipeObj = new os.Pipe();
    this.stdout = pipeObj;
    nextProc.stdin = pipeObj;
  }
}
// 管理模块
class ProcessManager {
  constructor(fs, terminal) {
    this.processes = [];
    this.nextPid = 1;
    this.terminal = terminal;
    this.globalVariables = {}; // 存储全局变量
    this.ret = undefined;
    this.fs = fs; // 稍后会被注入
  }
  
  // 启动新进程
  create(command, mainFunction, args=[], parent=null) {
    // 创建进程对象
    const process = new Process(command, mainFunction, args, parent);
    console.log(`[proc] 创建进程 ${process.pid} ${command} ${args.join(' ')}`);

    process.run = async function() {
        console.log(`[proc] 进程 ${this.pid} 开始运行`);
        try {
          // 调用命令的main函数时传入process对象
          this.ret = await this.main(this);
        } catch (error) {
          console.error(`[proc] 进程 ${this.pid} 运行时出错: ${error.message}`);
          this.ret = 1;
        } finally {
          // 关闭所有IO流
          console.log(`[proc][atexit] 进程 ${this.pid} 关闭所有IO流`);
          this.stdin.close();
          this.stdout.close();
          // this.stderr.close();
          this.status = 'exited';
          console.log(`[proc] 进程 ${this.pid} 已退出`);
          // 从父进程中移除子进程引用
          if (this.parent) {
            this.parent.children = this.parent.children.filter(p => p.pid !== this.pid);
          }
          // todo: update this.processes
        }
        
        // 返回进程退出码
        return this.ret;
    };

    this.processes.push(process);
    return process;
  }
  
  
  // 终止进程
  kill(pid) {
    const process = this.processes.find(p => p.pid === pid && p.status === 'running');
    if (!process) {
      return { success: false, error: '进程不存在或已终止' };
    }
    
    // 触发终止信号
    process.controller.abort();
    process.status = 'killed';
    // 从父进程中移除子进程引用
    if (process.parent) {
      process.parent.children = process.parent.children.filter(p => p.pid !== process.pid);
    }
    console.log(`进程 ${process.pid} 已被终止`);
    return { success: true, process };
  }
  
  // 获取进程列表
  list() {
    return this.processes.filter(p => p.status === 'running');
  }
}

// 导出ProcessManager类
export { ProcessManager };

// 为了向后兼容，仍然挂载到window对象
window.ProcessManager = ProcessManager;
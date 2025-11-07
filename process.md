# proc.js实现规划

1.进程对象
- 进程对象属性：
    - `pid`: 进程ID
    - `ppid`: 父进程ID
    - `name`: 进程名称
    - `command`: 进程执行的命令，如/bin/sh.js
    - `args`: 进程执行的命令参数,如`["-c", "echo hello"]`
    - `env`: 进程的环境变量，至少包括USER, PWD等属性.
    - `stdin`: 进程的标准输入流
    - `stdout`: 进程的标准输出流
    - `stderr`: 进程的标准错误流
    - `status`: 进程的状态(如运行中、已退出等)

1. 进程管理接口
   - `createProcess(name, command, args, env)`: 创建新进程,返回进程对象. 
   - `getProcess(pid)`: 获取指定PID的进程信息
   - `listProcesses()`: 列出所有进程
   - `terminateProcess(pid)`: 终止指定PID的进程

2. 进程的main函数写法：
export async function main(argv){
    // 进程的main函数参数为argv，是一个数组，包含进程执行的命令参数.
    console.log('start js app. args:', argv);

    // 从this.stdin读取数据（stdin/stdout默认指向终端,如果重定向到文件,则指向文件）
    let input = await this.stdin.read();

    // this.stdout.write('your input: ', input);
    os.terminal.writeln('hello world');
    return 0;  // 0  undefined  '' null 都认为true。
}
3.管道接口：当shell命令输入为: `command1 | command2 | ...`时，创建进程间流式管道，将command1的stdout连接到command2的stdin。（进程内的代码无需处理管道，直接读写stdio即可）
   - `pipeProcesses(fromPid, toPid)`: 创建进程间管道
    - 代码原型：
    function pipeProcesses(fromProc, toProc) {
        // 实现将进程的stdout连接到另一个进程的stdin的逻辑
        // 1. 创建管道，获取文件描述符
        let pipeFd = os.fs.pipe();
        // 1. 从fromProc读取数据
        fromProc.env.stdout.write = function(data) {
            // 2. 写入pipeFd
            pipeFd.write(data);
        }
        // 3. 从pipeFd读取数据
        toProc.env.stdin.read = async function() {
            return await pipeFd.read();
        }
    }
    function pipeProcesses(...procs) {
        // 实现将多个进程的stdout连接到下一个进程的stdin的逻辑
        for(let i = 0; i < procs.length - 1; i++) {
            pipeProcesses(procs[i], procs[i + 1]);
        }
    }

3. 输出重定向：当shell命令输入为: `command > file`时，将command的stdout重定向到file文件。（进程内的代码无需处理重定向，直接读写stdio即可）
    - `redirectProcessStdout(pid, filePath)`: 重定向进程的stdout到文件
    - `redirectProcessStderr(pid, filePath)`: 重定向进程的stderr到文件
    - 代码原型：
    function redirectProcessStdout(proc, filePath) {
        // 实现将进程的stdout重定向到文件的逻辑
        // 1. 打开文件，获取文件描述符
        let fd = os.fs.open(filePath, 'w');
        // 2. 重定向进程的stdout到文件描述符
        proc.env.stdout.write = function(data) {
            fd.append(data);
        }
    }
    输入重定向：当shell命令输入为: `command < file`时，将file文件的内容重定向到command的stdin。（进程内的代码无需处理重定向，直接读写stdio即可）
    - 代码原型：
    function redirectProcessStdin(proc, filePath) {
        // 实现将进程的stdin重定向到文件的逻辑
        // 1. 打开文件，获取文件描述符
        let fd = os.fs.touch(filePath);
        // 2. 重定向进程的stdin到文件描述符
        proc.env.stdin.read = async function() {
            return await fd.read();
        }
    }

满足如下测试：
test('cmd1 | cmd2', async () => {
    const cmd1 = createProcess('cmd1', '/bin/sh.js', ['-c', 'echo hello']);
    const cmd2 = createProcess('cmd2', '/bin/sh.js', ['-c', 'cat']);
    pipeProcesses(cmd1, cmd2);
    let proc1 = cmd1.run();
    let proc2 = cmd2.run();
    await proc1.wait();
    await proc2.wait();
    expect(cmd2.env.stdout.buffer).toBe('hello');
});
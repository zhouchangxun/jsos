/**
 * 内置命令模块 - 包含所有常用命令的异步实现
 * 依赖全局的os变量
 */
// 实现编辑器功能
function openEditor(fileName, initialContent) {
  // 创建编辑器容器
  const editorContainer = document.createElement('div');
  editorContainer.id = 'file-editor';
  editorContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    max-width: 800px;
    height: 70%;
    background: #1e1e1e;
    border: 2px solid #444;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.8);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    font-family: monospace;
  `;
  
  // 创建编辑器头部
  const editorHeader = document.createElement('div');
  editorHeader.style.cssText = `
    padding: 10px 15px;
    background: #2d2d2d;
    border-bottom: 1px solid #444;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #fff;
  `;
  
  const editorTitle = document.createElement('h3');
  editorTitle.textContent = `编辑文件: ${fileName}`;
  editorTitle.style.margin = 0;
  
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';
  
  // 创建保存按钮
  const saveButton = document.createElement('button');
  saveButton.textContent = '保存';
  saveButton.style.cssText = `
    padding: 6px 12px;
    background: #0078d7;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  
  // 创建关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
    padding: 6px 12px;
    background: #666;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  
  // 添加按钮到容器
  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(closeButton);
  
  // 添加标题和按钮容器到头部
  editorHeader.appendChild(editorTitle);
  editorHeader.appendChild(buttonContainer);
  
  // 创建编辑器主体
  const editorBody = document.createElement('div');
  editorBody.style.cssText = `
    flex: 1;
    padding: 15px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;
  
  // 创建文本区域
  const textArea = document.createElement('textarea');
  textArea.value = initialContent;
  textArea.style.cssText = `
    width: 100%;
    height: 100%;
    background: #1e1e1e;
    color: #d4d4d4;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 10px;
    font-family: monospace;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    outline: none;
  `;
  
  // 添加文本区域到主体
  editorBody.appendChild(textArea);
  
  // 创建消息区域
  const messageArea = document.createElement('div');
  messageArea.id = 'editor-message';
  messageArea.style.cssText = `
    padding: 8px 15px;
    background: #252526;
    color: #d4d4d4;
    font-size: 12px;
    border-top: 1px solid #444;
  `;
  
  // 添加所有元素到容器
  editorContainer.appendChild(editorHeader);
  editorContainer.appendChild(editorBody);
  editorContainer.appendChild(messageArea);
  
  // 添加到文档
  document.body.appendChild(editorContainer);
  
  // 设置焦点到文本区域
  textArea.focus();
  
  // 保存功能
  saveButton.addEventListener('click', () => {
    const content = textArea.value;
    // 尝试使用os.fs对象保存文件
    if (typeof os.fs !== 'undefined' && os.fs.write) {
      const result = os.fs.write(fileName, content);

      messageArea.textContent = `文件 '${fileName}' 已成功保存`;
      messageArea.style.color = '#4ec9b0';
    
    } else {
      messageArea.textContent = '保存功能不可用';
      messageArea.style.color = '#f44747';
    }
  });
  
  // 关闭功能
  closeButton.addEventListener('click', () => {
    document.body.removeChild(editorContainer);
  });
  
  // ESC键关闭编辑器
  textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(editorContainer);
    }
  });
}
// 导出所有命令为异步函数
export const builtinCommands = {
  pwd: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    context.stdout = os.fs.pwd();
  },
  // 列出目录内容
  ls: async (args, context) => {
    // 如果没有提供context，使用默认值
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    const path = args[0] || '';
    const lsResult = os.fs.ls(path, true);
    
    // 格式化输出，目录和文件区分颜色
    const items = lsResult.map(item => {
      if (item.type === 'directory') {
        return `${item.name}/`;
      }
      return item.name;
    });
    
    // 简单列表格式，每个项目一行
    context.stdout = items.join('\t');
  },

  // 切换目录
  cd: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    const path = args[0] || '';
    const result = os.fs.cd(path);
    
  },

  // 创建目录
  mkdir: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (args.length === 0) {
      context.stderr = '用法: mkdir <目录名>';
      return;
    }
    
    const dirName = args[0];
    const result = os.fs.mkdir(dirName);
    
    if (!result.success) {
      context.stderr = `错误: ${result.error}`;
    } else {
      context.stdout = `目录 '${dirName}' 创建成功`;
    }
  },

  // 创建空文件
  touch: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (args.length === 0) {
      context.stderr = '用法: touch <文件名>';
      return;
    }
    
    const fileName = args[0];
    const result = os.fs.write(fileName, '');
    
    if (!result.success) {
      context.stderr = `错误: ${result.error}`;
    } else {
      context.stdout = `文件 '${fileName}' 创建成功`;
    }
  },

  // 删除文件或目录
  rm: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (args.length === 0) {
      context.stderr = '用法: rm <文件或目录>';
      return;
    }
    
    const path = args[0];
    const isRecursive = args.includes('-r') || args.includes('--recursive');
    
    // 先检查是文件还是目录
    const statResult = os.fs.stat(path);
    
    if (!statResult.success) {
      context.stderr = `错误: ${statResult.error}`;
      return;
    }
    
    let result;
    if (statResult.isDirectory) {
      if (!isRecursive) {
        context.stderr = `错误: 无法删除目录 '${path}'，使用 -r 参数递归删除`;
        return;
      }
      result = os.fs.rmdir(path, true);
    } else {
      result = os.fs.rm(path);
    }
    
    if (!result.success) {
      context.stderr = `错误: ${result.error}`;
    } else {
      context.stdout = `${statResult.isDirectory ? '目录' : '文件'} '${path}' 删除成功`;
    }
  },

  // 查看文件内容
  cat: async (args, context) => {
    console.log('cat ', args);
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (args.length === 0) {
      // 如果没有参数，从stdin读取
      context.stdout = context.stdin;
      return;
    }
    
    const fileName = args[0];
    const result = os.fs.read(fileName);

    context.stdout = result;

  },

  // 输出文本
  echo: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    console.log('echo ', args);
    os.fs.write(args[0], args.slice(1).join(' '));
  },

  // 执行JavaScript代码
  js: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    try {
      // 合并参数为一个字符串作为JavaScript代码
      const jsCode = args.join(' ');
      
      // 创建一个安全的执行环境
      const sandbox = {
        console: {
          log: (...args) => {
            context.stdout += args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ') + '\n';
          },
          error: (...args) => {
            context.stderr += args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ') + '\n';
          },
          warn: (...args) => {
            context.stdout += '警告: ' + args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ') + '\n';
          }
        },
        require: () => { throw new Error('require is not allowed'); },
        process: { env: {} },
        window: undefined,
        document: undefined
      };
      
      // 执行代码
      let result;
      if (jsCode.includes('return')) {
        // 如果代码包含return语句，使用函数包装
        result = new Function('console', 'require', 'process', 'window', 'document', jsCode)(
          sandbox.console, sandbox.require, sandbox.process, sandbox.window, sandbox.document
        );
      } else {
        // 否则直接执行表达式
        result = new Function('console', 'require', 'process', 'window', 'document', `return ${jsCode}`)(
          sandbox.console, sandbox.require, sandbox.process, sandbox.window, sandbox.document
        );
      }
      
      // 如果有返回值且没有通过console.log输出，将其添加到stdout
      if (result !== undefined && context.stdout === '') {
        context.stdout = typeof result === 'object' ? 
          JSON.stringify(result, null, 2) : String(result);
      }
    } catch (error) {
      context.stderr = `JavaScript 错误: ${error.message}`;
    }
  },

  // 列出进程
  ps: async (args, context, processManager) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    const processes = processManager.listProcesses();
    
    // 格式化进程列表
    let output = 'PID\tStatus\tCommand\n';
    output += processes.map(p => `${p.pid}\t${p.status}\t${p.command}`).join('\n');
    
    context.stdout = output;
  },

  // 杀死进程
  kill: async (args, context, processManager) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (args.length === 0) {
      context.stderr = '用法: kill <pid>';
      return;
    }
    
    const pid = parseInt(args[0]);
    if (isNaN(pid)) {
      context.stderr = `错误: 无效的PID '${args[0]}'`;
      return;
    }
    
    const result = processManager.killProcess(pid);
    
    if (!result.success) {
      context.stderr = `错误: ${result.error}`;
    } else {
      context.stdout = `进程 ${pid} 已终止`;
    }
  },

  // 清空终端
  clear: async (args, context, terminal) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (terminal && typeof terminal.clear === 'function') {
      terminal.clear();
    } else {
      context.stdout = '\x1B[2J\x1B[H'; // ANSI清屏命令
    }
  },

  // 显示帮助信息
  help: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    const helpText = `
可用命令:\n\n` +
      `  ls           列出目录内容\n` +
      `  cd           切换目录\n` +
      `  mkdir        创建目录\n` +
      `  touch        创建空文件\n` +
      `  rm           删除文件或目录（-r 递归删除）\n` +
      `  cat          查看文件内容\n` +
      `  echo         输出文本\n` +
      `  js           执行JavaScript代码\n` +
      `  ps           列出进程\n` +
      `  kill         杀死进程\n` +
      `  clear        清空终端\n` +
      `  help         显示帮助信息\n` +
      `  edit         编辑文件\n` +
      `  grep         搜索文本\n` +
      `  sort         排序文本\n` +
      `  head         显示文件头部\n` +
      `  wget         下载文件\n` +
      `  sh           启动shell解释器\n` +
      `\n使用 '<命令> --help' 获取特定命令的详细帮助。`;
    
    context.stdout = helpText.trim();
  },

  // 编辑文件
  edit: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (args.length === 0) {
      context.stderr = '用法: edit <文件名>';
      return;
    }
    
    const fileName = args[0];
    
    // 检查文件是否存在
    let initialContent = '';
    // const statResult = fs.stat(fileName);
    
    if (true || statResult.success && !statResult.isDirectory) {
      // 如果文件存在且不是目录，读取其内容
      const readResult = os.fs.read(fileName);
      initialContent = readResult;

    }
    
    // 调用外部的openEditor函数打开编辑器
    if (typeof openEditor === 'function') {
      openEditor(fileName, initialContent);
      context.stdout = `正在编辑文件 '${fileName}'`;
    } else {
      context.stderr = '错误: 编辑器功能不可用';
    }
  },
  // 搜索文本
  grep: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (args.length === 0) {
      context.stderr = '用法: grep <模式> [文件]';
      return;
    }
    
    const pattern = args[0];
    let text;
    
    if (args.length > 1) {
      // 从文件读取（这里简化处理，实际应该使用fs读取）
      context.stderr = '错误: 文件读取功能在grep命令中尚未实现';
      return;
    } else {
      // 从stdin读取
      text = context.stdin;
    }
    
    if (!text) {
      context.stderr = '错误: 没有输入数据';
      return;
    }
    
    try {
      const regex = new RegExp(pattern);
      const matchedLines = text.split('\n').filter(line => regex.test(line));
      context.stdout = matchedLines.join('\n');
    } catch (e) {
      context.stderr = `错误: 无效的正则表达式 '${pattern}'`;
    }
  },

  // 排序文本
  sort: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    const text = context.stdin;
    if (!text) {
      context.stderr = '错误: 没有输入数据';
      return;
    }
    
    const sortedLines = text.split('\n').sort();
    context.stdout = sortedLines.join('\n');
  },

  // 显示文件头部
  head: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    let lines = 10; // 默认显示10行
    let text;
    
    if (args.length > 0 && args[0].startsWith('-n')) {
      // 解析行数参数
      const nArg = args[0];
      const num = parseInt(nArg.substring(2));
      if (!isNaN(num) && num > 0) {
        lines = num;
      }
      
      if (args.length > 1) {
        // 从文件读取（这里简化处理）
        context.stderr = '错误: 文件读取功能在head命令中尚未实现';
        return;
      } else {
        text = context.stdin;
      }
    } else if (args.length > 0) {
      // 从文件读取
      context.stderr = '错误: 文件读取功能在head命令中尚未实现';
      return;
    } else {
      text = context.stdin;
    }
    
    if (!text) {
      context.stderr = '错误: 没有输入数据';
      return;
    }
    
    const headLines = text.split('\n').slice(0, lines);
    context.stdout = headLines.join('\n');
  },

  // 下载文件
  wget: async (args, context) => {
    context = context || { stdin: '', stdout: '', stderr: '' };
    
    if (args.length === 0) {
      context.stderr = '用法: wget <URL>';
      return;
    }
    
    const url = args[0];
    
    try {
      // 使用fetch API下载文件
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }
      
      const content = await response.text();
      context.stdout = content;
    } catch (error) {
      context.stderr = `下载失败: ${error.message}`;
    }
  }
};

// 导出默认模块
export default builtinCommands;
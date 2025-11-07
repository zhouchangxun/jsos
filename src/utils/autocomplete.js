// 自动补全工具模块
class Autocomplete {
  constructor(fs, commandProcessor) {
    this.fs = fs;
    this.commandProcessor = commandProcessor;
    this.availableCommands = Object.keys(commandProcessor.commands);
  }
  
  // 补全命令或文件路径
  complete(input) {
    if (!input) return [];
    
    // 如果输入包含空格，尝试补全文件路径
    if (input.includes(' ')) {
      return this._completeFilePath(input);
    }
    
    // 否则补全命令
    return this._completeCommand(input);
  }
  
  // 补全命令
  _completeCommand(input) {
    const matches = this.availableCommands.filter(cmd => 
      cmd.toLowerCase().startsWith(input.toLowerCase())
    );
    
    return matches;
  }
  
  // 补全文件路径
  _completeFilePath(input) {
    // 分割命令和参数
    const parts = input.split(' ');
    const command = parts[0];
    let pathToComplete = parts[parts.length - 1];
    if(!pathToComplete.startsWith('/') && !pathToComplete.startsWith('./')){
      pathToComplete = './' +  pathToComplete;
    }
    // 获取基础路径和要补全的部分
    const pathParts = pathToComplete.split('/');
    const filenamePart = pathParts.pop() || '';
    const basePath = pathParts.join('/') || '.';
    
    try {
      // 列出目录内容
      const result = this.fs.ls(basePath,true);
      if (!result.length) {
        return [];
      }
      
      // 过滤匹配的文件和目录
      const matches = result.filter(item => {
        return item.name.toLowerCase().startsWith(filenamePart.toLowerCase());
      }).map(item => {
        let fullPath;
        if (basePath === '.') {
          fullPath = item.name;
        } else {
          fullPath = `${basePath}/${item.name}`;
        }
        
        // 目录后面加斜杠
        if (item.type === 'directory') {
          fullPath += '/';
        }
        
        return fullPath;
      });
      
      return matches;
    } catch (e) {
      return [];
    }
  }
  
  // 格式化补全结果
  formatCompletion(input, matches, terminal) {
    if (matches.length === 0) {
      // 没有匹配项，发出提示音
      return;
    }
    
    if (matches.length === 1) {
      // 只有一个匹配项，直接替换 - 适配xterm.js实现
      const commandParts = input.split(' ');
      commandParts[commandParts.length - 1] = matches[0];
      const completedCommand = commandParts.join(' ') + ' ';
      
      // 在xterm.js中，我们需要清除当前行并重新写入
      console.log('completedCommand:', completedCommand);
      terminal.currentLine = completedCommand;
      
      // 重新定位光标到行首
      terminal.write('\r');
      // 清除从光标到行尾
      terminal.write('\x1b[K');
      // 重新写入提示符和完成的命令
      terminal.prompt(completedCommand);
    } else {
      // 多个匹配项，显示所有选项
      terminal.writeln('');
      
      // 分组显示
      const columns = 3;
      let output = '';
      matches.forEach((match, i) => {
        if (match.endsWith('/')) {
          // 目录显示为蓝色
          output += `\x1B[34m${match.padEnd(25)}\x1B[0m`;
        } else {
          output += match.padEnd(25);
        }
        
        if ((i + 1) % columns === 0) {
          output += '\n';
        }
      });
      
      terminal.write(output);
      
      // 重新显示当前命令行 - 适配xterm.js实现
      // 由于我们现在使用xterm.js，不再需要直接操作DOM元素
      // 直接显示一个换行和提示符即可，终端会自动处理当前输入
      terminal.write('\n');
      terminal.prompt(terminal.currentLine);
    }
  }
  
}

// 导出Autocomplete类
export { Autocomplete };

// 为了向后兼容，仍然挂载到window对象
window.Autocomplete = Autocomplete;
// 终端模块: 为OS提供终端接口，使用xterm.js库实现
// 主要功能:
//   - 初始化终端界面
//   - 处理用户输入和输出
//   - 提供事件接口，用于命令处理和自动补全
// 事件接口(需要外部设置):
//   - onCommand: 当用户输入完整命令时触发
//   - onTabComplete: 当用户输入Tab键时触发自动补全
//   - onCtrlC: 当用户输入Ctrl+C时触发
// 注意事项:
//   - 初始化时需要传入容器ID，该容器将用于挂载终端界面
//   - 外部需要设置onCommand、onTabComplete、onCtrlC事件处理函数
// 示例:
//   const terminal = new OSTerminal('terminal-container');
//   terminal.onCommand = (command) => {
//     console.log('用户输入命令:', command);
//   };
//   terminal.onTabComplete = (input) => {
//     return ['complete1', 'complete2'];
//   };
//   terminal.onCtrlC = () => {
//     console.log('用户按下Ctrl+C');
//   };
class OSTerminal {
  constructor(containerId) {
    // 保存容器ID
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    
    // 内部状态
    this.isProcessingCommand = false;
    this.isNodeReplMode = false;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.currentLine = '';
    this.prompt = '[prompt] > ';
    this.promptLength = this.prompt.length;
    this.tempInputBuffer = '';
    
    // 初始化xterm.js终端
    this._initTerminal();
  }
  
  // 初始化xterm.js终端
  _initTerminal() {
    console.log('初始化xterm.js终端...');
    // 检查是否已加载xterm.js
    if (typeof window.Terminal === 'undefined') {
      console.error('xterm.js 未加载，请确保正确引入xterm.js库');
      return;
    }
    
    // 创建xterm.js实例
    this.xterm = new window.Terminal({
      fontSize: 14,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selection: 'rgba(128, 128, 128, 0.3)'
      },
      cursorBlink: true,
      scrollback: 1000,
      tabStopWidth: 2,
      convertEol: true, // 启用行尾转换，确保\n正确显示为换行
      windowsMode: false // 保持UNIX模式的其他特性
    });
    
    // 打开终端到容器
    this.xterm.open(this.container);
    
    // 自动聚焦
    this.xterm.focus();
    
    // 处理终端输入
    this.xterm.onData(this._handleData.bind(this));
    
    // 处理行事件
    this.xterm.onLineFeed(() => {
      ;// 可以在这里处理换行事件
    });
    this.xterm.writeln('[info] standard i/o device ready...')
    this.xterm.write(this.getPrompt());
  }
  
  // 处理终端数据输入
  _handleData(data) {
    // 如果正在处理命令，阻止除Ctrl+C外的所有输入
    if (this.isProcessingCommand && data !== '\x03') { // \x03 是 Ctrl+C
      return;
    }
    
    // 处理特殊字符
    switch (data) {
      case '\r': // Enter
        this._handleEnter();
        break;
      case '\x1b[A': // 上箭头
        this._handleArrowUp();
        break;
      case '\x1b[B': // 下箭头
        this._handleArrowDown();
        break;
      case '\t': // Tab
        this._handleTab();
        break;
      case '\x03': // Ctrl+C
        this._handleCtrlC();
        break;
      case '\f': // Ctrl+L
        this.clear();
        break;
      case '\x7f': // Backspace
        // 防止删除提示符
        if (this.currentLine.length > 0) {
          this.currentLine = this.currentLine.slice(0, -1);
          this.xterm.write('\b \b'); // 删除字符并移动光标
        }
        break;
      default:
        // 正常字符输入
        this.currentLine += data;
        this.xterm.write(data);
        break;
    }
  }
  
  // 处理回车键
  async _handleEnter() {
    const commandText = this.currentLine.trim();
    
    // 保存到历史记录
    if (commandText) {
      this.commandHistory.push(commandText);
      this.historyIndex = -1;
    }
    
    // 换行
    this.xterm.writeln('');
    
    // 触发命令处理
    if (this.onCommand) {
      await this.onCommand(commandText);
    }else{
      this.xterm.writeln('your input: ' + commandText);
    }
    
    // 重置当前行
    this.currentLine = '';
    
    // 显示提示符
    this.xterm.write(this.getPrompt());
  }
  
  // 处理向上箭头
  _handleArrowUp() {
    if (this.commandHistory.length === 0) return;
    
    // 如果是第一次按上箭头，保存当前输入
    if (this.historyIndex === -1) {
      this.tempInputBuffer = this.currentLine;
      this.historyIndex = this.commandHistory.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    }
    
    // 显示历史命令
    this.currentLine = this.commandHistory[this.historyIndex];
    this._clearCurrentLine();
    this.xterm.write(this.getPrompt() + this.currentLine);
  }
  
  // 处理向下箭头
  _handleArrowDown() {
    if (this.historyIndex === -1) return;
    
    // 更新历史索引
    this.historyIndex++;
    
    if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = -1;
      this.currentLine = this.tempInputBuffer || '';
      this.tempInputBuffer = '';
    } else {
      this.currentLine = this.commandHistory[this.historyIndex];
    }
    
    // 显示当前输入
    this._clearCurrentLine();
    this.xterm.write(this.getPrompt() + this.currentLine);
  }
  
  // 处理Tab键（自动补全）
  _handleTab() {
    console.log('tab')
    // 调用自动补全回调
    if (this.onTabComplete) {
      return this.onTabComplete(this.currentLine);
    }
    // default: nop
  }
  
  // 处理Ctrl+C
  _handleCtrlC() {
    // 触发Ctrl+C回调
    if (this.onCtrlC) {
      return this.onCtrlC();
    }
    // default behavior
    this.xterm.writeln('^C');
    // 重置当前行
    this.currentLine = '';
    // 显示提示符
    // this.xterm.write(this.getPrompt());
  }
  
  // 清除当前行
  _clearCurrentLine() {
    // 回车
    this.xterm.write('\r');
    // 清除光标到行尾
    this.xterm.write('\x1b[0K');
  }
  
  // 获取当前提示符
  getPrompt() {
    return this.prompt;
  }
  
  // 写入文本到终端当前位置
  write(text) {
    this.xterm.write(text);
  }
  
  // 写入一行文本到终端
  writeln(text = '') {
    this.xterm.writeln(text);
  }
  
  // 清除终端
  clear() {
    this.xterm.clear();
    this.currentLine = '';
  }
  
  // 设置提示符
  setPrompt(prompt, len) {
    this.prompt = prompt;
    this.promptLength = len || prompt.length;
  }
  
  // 聚焦终端
  focus() {
    this.xterm.focus();
  }
}

// 导出模块
export { OSTerminal };

// 为了向后兼容，仍然挂载到window对象
window.OSTerminal = OSTerminal;
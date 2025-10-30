// 文件系统模块: 为OS提供文件系统接口，支持基本的文件操作
class FileSystem {
  constructor() {
    // 初始化文件系统结构
    this.root = {
      name: '/',
      type: 'directory',
      children: {}
    };
    // 初始在根目录
    this.currentPath = [''];
    this._initRootFs();
  }

  _initRootFs() {
    console.log('初始化文件系统结构............');
    this.mkdir('home');
    this.cd('home');
    this.mkdir('user');
    this.cd('user');

    // 添加示例JS文件
    this.touch('test.sh');
    this.echo('test.sh', `# test.sh
a=1;
echo set a = $a;
if $a == 1;then
  echo "a is 1";
  if $a == 2;then
    echo a==2;
  else
    echo a != 2;
  fi
else
  echo "a != 1";
fi
echo 'exit script';
`);
    
    this.touch('task2.js');
    this.echo('task2.js', `// 示例任务: 时钟
async function run(signal) {
  while (!signal.aborted) {
    const time = new Date().toLocaleTimeString();
    console.log(\`Task2: 当前时间 \${time}\`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  console.log("Task2: 已终止");
}`);
  }
  
  // 获取当前路径字符串
  getCurrentPathString() {
    return this.currentPath.join('/') || '/';
  }
  
  // 解析路径
  _resolvePath(path) {
    let parts = [];
    if (path.startsWith('/')) {
      parts = ['']; // 绝对路径
    } else {
      parts = [...this.currentPath]; // 相对路径
    }
    
    path.split('/').forEach(part => {
      if (part === '.' || part === '') return;
      if (part === '..') {
        if (parts.length > 1) parts.pop();
      } else {
        parts.push(part);
      }
    });
    
    return parts;
  }
  
  // 获取目录节点
  _getNode(pathParts) {
    let current = this.root;
    for (let i = 1; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!current.children[part]) return null;
      current = current.children[part];
      if (current.type !== 'directory') return null;
    }
    return current;
  }
  
  // 列出目录内容
  ls(path = '') {
    const pathParts = path ? this._resolvePath(path) : [...this.currentPath];
    const node = this._getNode(pathParts);
    if (!node) return { success: false, error: '路径不存在' };
    
    return {
      success: true,
      items: Object.values(node.children).map(item => ({
        name: item.name,
        type: item.type
      }))
    };
  }
  
  // 切换目录
  cd(path) {
    const pathParts = this._resolvePath(path);
    const node = this._getNode(pathParts);
    if (!node) return { success: false, error: '目录不存在' };
    
    this.currentPath = pathParts;
    return { success: true };
  }
  
  // 创建目录
  mkdir(name) {
    const node = this._getNode(this.currentPath);
    if (node.children[name]) {
      return { success: false, error: '目录已存在' };
    }
    
    node.children[name] = {
      name,
      type: 'directory',
      children: {}
    };
    
    return { success: true };
  }
  
  // 创建文件
  touch(name) {
    const node = this._getNode(this.currentPath);
    if (node.children[name]) {
      return { success: false, error: '文件已存在' };
    }
    
    node.children[name] = {
      name,
      type: 'file',
      content: ''
    };
    
    return { success: true };
  }
  
  // 删除文件或目录
  rm(name) {
    const node = this._getNode(this.currentPath);
    if (!node.children[name]) {
      return { success: false, error: '文件/目录不存在' };
    }
    
    delete node.children[name];
    return { success: true };
  }
  
  // 读取文件内容
  cat(name) {
    const node = this._getNode(this.currentPath);
    if (!node.children[name]) {
      return { success: false, error: '文件不存在' };
    }
    
    const file = node.children[name];
    if (file.type !== 'file') {
      return { success: false, error: '不是文件' };
    }
    
    return { success: true, content: file.content };
  }
  readFile(name) {
    return this.cat(name);
  }
  // 写入文件内容
  echo(name, content) {
    const node = this._getNode(this.currentPath);
    if (!node.children[name]) {
      return { success: false, error: '文件不存在' };
    }
    
    const file = node.children[name];
    if (file.type !== 'file') {
      return { success: false, error: '不是文件' };
    }
    
    file.content = content;
    return { success: true };
  }
  writeFile(name, content) {
    return this.echo(name, content);
  }
  // 检查文件是否存在
  exists(name) {
    const node = this._getNode(this.currentPath);
    return !!node.children[name];
  }
  
  // 获取文件内容
  getFileContent(name) {
    const node = this._getNode(this.currentPath);
    const file = node.children[name];
    return file && file.type === 'file' ? file.content : null;
  }
}

// 导出FileSystem类
export { FileSystem };

// 为了向后兼容，仍然挂载到window对象
window.FileSystem = FileSystem;
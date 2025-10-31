class FileSystem {
  constructor() {
    this.fs = {
        name: '/',
        type: 'directory',
        children: []
    };
    this.currentPath = ['/']; // 初始路径为根目录
    this.loadFromRamdisk();
  }

  /** 从localStorage加载文件系统数据 */
  loadFromRamdisk() {
    const saved = localStorage.getItem('ramdisk.json');
    if (saved) {
      this.fs = JSON.parse(saved);
    } else {
      // 初始化默认文件系统结构
      this.fs = {
        name: '/',
        type: 'directory',
        children: [
          { name: 'home', type: 'directory', children: [{ name: 'user', type: 'directory', children: [] }] },
          { name: 'etc', type: 'directory', children: [] },
          { name: 'tmp', type: 'directory', children: [] }
        ]
      };
      this.saveToRamdisk();
    }
  }

  /** 保存文件系统状态到localStorage */
  saveToRamdisk() {
    localStorage.setItem('ramdisk.json', JSON.stringify(this.fs));
  }

  /** 解析路径为绝对路径数组 */
  resolvePath(path) {
    let resolved = [...this.currentPath];
    if (path.startsWith('/')) resolved = ['/']; // 绝对路径重置

    const segments = path.split('/').filter(seg => seg !== '');
    for (const seg of segments) {
      if (seg === '.') continue;
      if (seg === '..') {
        if (resolved.length > 1) resolved.pop(); // 根目录上级还是根目录
        continue;
      }
      resolved.push(seg);
    }
    return resolved;
  }

  /** 根据路径数组获取节点 */
  getNode(pathArray) {
    let current = this.fs;
    for (let i = 1; i < pathArray.length; i++) {
      const seg = pathArray[i];
      const child = current.children?.find(c => c.name === seg);
      if (!child) return null;
      current = child;
    }
    return current;
  }

  /** 获取父目录节点和目标名称 */
  getParentAndName(path) {
    const resolved = this.resolvePath(path);
    const name = resolved.pop();
    const parentNode = this.getNode(resolved);
    return { parentNode, name, resolvedPath: resolved };
  }

  // ------------------------------
  // 核心命令实现
  // ------------------------------

  /** 列出目录内容（ls） */
  ls(path = '.', verbose = false) {
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (!node) return `ls: 无法访问'${path}': 没有那个文件或目录`;
    if (node.type !== 'directory') return `ls: '${path}' 不是目录`;
    if (verbose) {
      return node.children;
    }
    return node.children.map(item => item.name).join('  ');
  }

  /** 显示当前路径（pwd） */
  pwd() {
    return this.currentPath.length === 1 ? '/' : this.currentPath.join('/').slice(1);
  }

  /** 切换目录（cd） */
  cd(path = '~') {
    if (path === '~') path = '/home/user'; // 支持~简写
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (!node) return `cd: 没有那个文件或目录: ${path}`;
    if (node.type !== 'directory') return `cd: '${path}' 不是目录`;
    this.currentPath = resolved;
    return '';
  }
  /** 显示文件状态（stat） */
  stat(path) {
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (!node) {
      console.log(`stat: 无法访问'${path}': 没有那个文件或目录`);
      return null;
    }
    return {
      name: node.name,
      type: node.type,
      size: node.content?.length || 0,
      path: resolved.join('/')
    };
  }
  // 检查文件是否存在
  exists(path) {
    return this.stat(path) !== null;
  }
  /** 读取文件（read） */
  read(path) {
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (!node) return `read: 无法打开'${path}': 没有那个文件或目录`;
    if (node.type !== 'file') return `read: '${path}' 不是文件`;
    return node.content || '';
  }

  /** 写入文件（write） */
  write(path, content, append = false) {
    const { parentNode, name } = this.getParentAndName(path);
    if (!parentNode) return `write: 无法创建'${path}': 父目录不存在`;
    if (parentNode.type !== 'directory') return `write: 父路径不是目录`;

    let fileNode = parentNode.children.find(c => c.name === name);
    if (fileNode) {
      if (fileNode.type !== 'file') return `write: '${name}' 不是文件`;
      fileNode.content = append ? (fileNode.content || '') + content : content;
    } else {
      parentNode.children.push({ name, type: 'file', content });
    }
    this.saveToRamdisk();
    return '';
  }

  /** 创建目录（mkdir） */
  mkdir(path) {
    const { parentNode, name } = this.getParentAndName(path);
    if (!parentNode) return `mkdir: 无法创建目录'${path}': 父目录不存在`;
    if (parentNode.type !== 'directory') return `mkdir: 父路径不是目录`;
    if (parentNode.children.some(c => c.name === name)) return `mkdir: 目录已存在: ${name}`;

    parentNode.children.push({ name, type: 'directory', children: [] });
    this.saveToRamdisk();
    return '';
  }

  /** 删除文件/目录（rm） */
  rm(path, recursive = false) {
    const { parentNode, name } = this.getParentAndName(path);
    if (!parentNode) return `rm: 无法删除'${path}': 没有那个文件或目录`;

    const index = parentNode.children.findIndex(c => c.name === name);
    if (index === -1) return `rm: 无法删除'${path}': 不存在`;

    const node = parentNode.children[index];
    // 删除目录需确认递归
    if (node.type === 'directory' && !recursive) {
      return `rm: 无法删除'${name}': 是一个目录（使用-r参数递归删除）`;
    }

    parentNode.children.splice(index, 1); // 从父目录中移除
    this.saveToRamdisk();
    return '';
  }

  /** 复制文件/目录（cp） */
  cp(sourcePath, destPath) {
    // 获取源节点
    const sourceResolved = this.resolvePath(sourcePath);
    const sourceNode = this.getNode(sourceResolved);
    if (!sourceNode) return `cp: 无法获取'${sourcePath}': 不存在`;

    // 获取目标父目录和名称
    const { parentNode: destParent, name: destName } = this.getParentAndName(destPath);
    if (!destParent) return `cp: 无法创建'${destPath}': 目标父目录不存在`;
    if (destParent.type !== 'directory') return `cp: 目标父路径不是目录`;
    if (destParent.children.some(c => c.name === destName)) return `cp: 目标'${destName}'已存在`;

    // 深拷贝节点（处理文件和目录）
    const copyNode = JSON.parse(JSON.stringify(sourceNode));
    copyNode.name = destName; // 重命名为目标名称
    destParent.children.push(copyNode);

    this.saveToRamdisk();
    return '';
  }

  /** 移动文件/目录（mv） */
  mv(sourcePath, destPath) {
    // 先复制再删除，实现移动
    const copyResult = this.cp(sourcePath, destPath);
    if (copyResult) return copyResult; // 复制失败直接返回错误

    // 复制成功后删除源
    return this.rm(sourcePath, true);
  }
  dump(){
    return this.fs;
  }
}

// 导出单例实例
export { FileSystem };
window.fs = new FileSystem();
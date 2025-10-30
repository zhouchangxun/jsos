const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const server = http.createServer((req, res) => {
  // 获取请求的文件路径
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  // 获取文件扩展名
  const extname = path.extname(filePath);
  
  // 设置MIME类型
  let contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
    case '.gif':
      contentType = 'image/gif';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
  }
  
  // 读取文件
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在
        res.writeHead(404);
        res.end('File not found');
      } else {
        // 服务器错误
        res.writeHead(500);
        res.end('Internal server error: ' + error.code);
      }
    } else {
      // 文件存在，发送文件内容
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
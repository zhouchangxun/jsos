// 测试脚本：验证sh.js在Node.js环境中的功能
const { sh } = require('./src/bin/sh.js');

// 测试执行命令
console.log('测试执行echo命令:');
sh(['-c', 'echo Hello, Node.js Shell!']).then(result => {
    console.log('命令执行结果:', result);
    
    console.log('\n测试执行pwd命令:');
    return sh(['-c', 'pwd']);
}).then(result => {
    console.log('当前目录:', result);
    
    console.log('\n测试脚本改造完成！');
}).catch(error => {
    console.error('测试出错:', error);
});
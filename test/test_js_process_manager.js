/**
 * JS进程管理器测试脚本
 */

// 导入模块
const { JSProcessManager } = require('./src/kernel/js_process_manager');

// 模拟OS对象和终端对象
const mockOS = {
  terminal: {
    writeln: (message) => {
      console.log(`[终端输出] ${message}`);
    }
  }
};

const mockTerminal = {
  writeln: (message) => {
    console.log(`[终端输出] ${message}`);
  }
};

// 测试函数
async function runTests() {
  console.log('开始测试JS进程管理器...');
  
  // 创建进程管理器
  const manager = new JSProcessManager(mockOS, mockTerminal);
  
  try {
    // 测试1: 创建进程
    console.log('\n=== 测试1: 创建进程 ===');
    const process = await manager.createProcess('./src/bin/hello.js', ['arg1', 'arg2']);
    console.log('✅ 进程创建成功:', process.getStatus());
    
    // 测试2: 运行进程
    console.log('\n=== 测试2: 运行进程 ===');
    const exitCode = await process.run();
    console.log(`✅ 进程运行完成，退出码: ${exitCode}`);
    
    // 测试3: 进程列表管理
    console.log('\n=== 测试3: 进程列表管理 ===');
    const processes = manager.listProcesses();
    console.log(`✅ 活跃进程数量: ${processes.length}`);
    
    // 测试4: 创建并终止进程
    console.log('\n=== 测试4: 创建并终止进程 ===');
    const process2 = await manager.createProcess('./src/bin/hello.js');
    console.log('✅ 进程2创建成功');
    
    // 延迟终止，模拟异步执行
    setTimeout(() => {
      process2.kill('SIGTERM');
      console.log('✅ 进程2已终止:', process2.getStatus());
      
      // 测试5: 终止所有进程
      console.log('\n=== 测试5: 终止所有进程 ===');
      manager.killAll();
      console.log(`✅ 终止所有进程后，活跃进程数量: ${manager.listProcesses().length}`);
      
      console.log('\n🎉 所有测试完成！');
    }, 500);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 启动测试
runTests();
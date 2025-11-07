/**
 * 进程对象测试脚本
 * 测试Process类的基本功能、管道和IO重定向
 */

// 导入Process类和常量 (使用CommonJS语法)
const { default: Process, PROCESS_STATUS, IO_TYPE, REDIRECT_TYPE } = require('./src/kernel/proc.js');

// 测试基本进程功能
async function testBasicProcess() {
  console.log('=== 测试基本进程功能 ===');
  
  const proc = new Process({
    command: 'echo',
    args: ['Hello', 'World'],
    cwd: '/home'
  });
  
  console.log('进程信息:', {
    pid: proc.pid,
    command: proc.command,
    args: proc.args,
    status: proc.status,
    cwd: proc.cwd
  });
  
  const result = await proc.execute();
  console.log('执行结果:', result);
  console.log('进程最终状态:', proc.status);
  console.log('进程统计信息:', proc.getStats());
}

// 测试IO重定向
async function testRedirects() {
  console.log('\n=== 测试IO重定向 ===');
  
  const proc = new Process({
    command: 'ls',
    args: ['-la']
  });
  
  // 设置输出重定向
  proc.setStdoutRedirect('output.txt');
  proc.setStderrRedirect('error.txt');
  proc.setStdinRedirect('input.txt');
  
  console.log('重定向配置:', proc.redirects);
  
  await proc.execute();
}

// 测试管道功能
async function testPipeline() {
  console.log('\n=== 测试管道功能 ===');
  
  // 创建三个进程
  const proc1 = new Process({
    command: 'echo',
    args: ['Line 1\nLine 2\nLine 3']
  });
  
  const proc2 = new Process({
    command: 'grep',
    args: ['Line']
  });
  
  const proc3 = new Process({
    command: 'wc',
    args: ['-l']
  });
  
  // 连接管道
  proc1.pipe(proc2).pipe(proc3);
  
  // 验证管道连接
  console.log('proc1有管道输出:', proc1.hasPipeOutput());
  console.log('proc2有管道输入:', proc2.hasPipeInput());
  console.log('proc2有管道输出:', proc2.hasPipeOutput());
  console.log('proc3有管道输入:', proc3.hasPipeInput());
  
  // 执行管道
  await proc1.execute();
}

// 测试静态方法createPipeline
async function testCreatePipeline() {
  console.log('\n=== 测试静态方法createPipeline ===');
  
  const processConfigs = [
    { command: 'echo', args: ['Hello Pipeline'] },
    { command: 'cat' },
    { command: 'tee', args: ['pipeline_output.txt'] }
  ];
  
  const pipeline = Process.createPipeline(processConfigs);
  
  console.log('管道第一个进程:', pipeline.command);
  console.log('管道第二个进程:', pipeline.pipeTo.command);
  console.log('管道第三个进程:', pipeline.pipeTo.pipeTo.command);
  
  await pipeline.execute();
}

// 测试进程生命周期
async function testProcessLifecycle() {
  console.log('\n=== 测试进程生命周期 ===');
  
  const proc = new Process({
    command: 'sleep',
    args: ['1']
  });
  
  console.log('初始状态:', proc.status);
  
  // 暂停进程（这里只是模拟，实际执行时无法暂停）
  proc.pause();
  console.log('暂停后状态:', proc.status);
  
  // 恢复进程
  proc.resume();
  console.log('恢复后状态:', proc.status);
  
  // 执行并终止
  await proc.execute();
  console.log('终止后状态:', proc.status);
}

// 运行所有测试
async function runAllTests() {
  try {
    console.log('开始测试Process类...');
    
    await testBasicProcess();
    await testRedirects();
    await testPipeline();
    await testCreatePipeline();
    await testProcessLifecycle();
    
    console.log('\n所有测试完成！');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
runAllTests();
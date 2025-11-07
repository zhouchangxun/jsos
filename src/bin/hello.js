// js应用模板
// 默认已经导入os对象,并且挂在到proc.main, 所以内部可以通过this访问进程自身信息，如this.pid
// 调用时已经支持传入self参数, 所以内部可以通过self访问进程自身信息

export async function main(argv){
    console.log('start js app. args:', argv);
    console.log('self:', self);
    // let input = await this.stdin.read();

    // this.stdout.write('your input: ', input);
    os.terminal.writeln('hello world');
    return 0;  // 0  undefined  '' null 都认为true。
}
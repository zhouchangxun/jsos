/**
 * Shell解释器模块 - 可在jsos终端中通过sh命令启动，同时支持Node.js环境
 * 依赖：
 * 1. Node.js环境下需要fs模块进行真实文件操作。
 * 2. 浏览器环境下需要os.terminal对象进行输出和os.fs模块进行虚拟文件操作
 */

// 检测运行环境
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const isBrowser = typeof window !== 'undefined';
// Node.js环境下的依赖
let fs = null;
const originConsole = console;
let rl = null;
if (isNode) {
      try {
        fs = require('fs');
        // 创建日志文件写入流
        const logStream = fs.createWriteStream('sh.log', { flags: 'a' });
        console = {
            // 支持多参数输出
            log: (...args) => {
                // object类型转json字符串
                args = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg);
                logStream.write(`[${new Date().toISOString().slice(0, 19)}] ${args.join(' ')}\n`);
            },
            error: (...args) => {
                // object类型转json字符串
                args = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg);
                logStream.write(`[${new Date().toISOString().slice(0, 19)}] [ERROR] ${args.join(' ')}\n`);
                originConsole.error('\x1b[31m[error]\x1b[0m', ...args);
            },
        }
        originConsole.log('[info] redirect console to file: sh.log');
        // 创建全局 readline 接口，用于REPL
        let readline = require('readline');
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '\x1b[36m[shell@localhost] $\x1b[0m ',
            // 补全核心逻辑：接收输入前缀，返回匹配结果
            completer: (line) => {
                let commands = ['echo', 'env', 'set', 'ls', 'cd', 'pwd', 'exit', 'help'];
                const prefix = line.trim();
                const matches = commands.filter(cmd => cmd.startsWith(prefix));
                // 返回格式：[匹配结果数组, 原始输入前缀]
                return [matches.length ? matches : commands, prefix];
            }
        });
    } catch (e) {
        originConsole.error('Node.js fs module not available:', e);
    }
}

class Shell {
    constructor(ctx={}) {
        console.log('[debug] new Shell with ctx: ', ctx);
        // 设置相关属性
        this.stdout = ctx.stdout;
        this.stdin = ctx.stdin;
        // this.stdout.writeln('hello');
        // let input = this.stdin.readline();
        if(typeof window !== 'undefined'){
            this.stdout = os.terminal; 
            this.stdin = os.terminal;  
        }else{
            this.stdout = {
                writeln: (str) => {
                    process.stdout.write(str + '\n');
                },
                write: (str) => {
                    process.stdout.write(str);
                    // 确保输出立即刷新
                    if (process.stdout.flush) {
                        process.stdout.flush();
                    }
                },
            }
            
            // 使用更直接的方式实现readline，不使用rl.question
            this.stdin={
                readline: () => {
                    return new Promise((resolve) => {
                        const onLine = (line) => {
                            rl.off('line', onLine);
                            resolve(line.trim());
                        };
                        rl.once('line', onLine);
                    });
                }
            };
        }
        this.state = {
            cwd: ctx.env?.PWD || '/',
            env: ctx.env || { PWD: '/', USER: 'user', HOME: '/home/user', PATH: '/bin:/usr/bin' },
            variables: {},
            functions: {},
            history: [],
            debug: true
        };
        
        this.commands = this._createCommands();
        this.running = true;
    }
    
    _createCommands() {
        // note: => 函数的this指向=>函数定义时的对象,即Shell实例
        //       而function(){}函数的this指向function函数调用时的对象,即进程实例
        const commands = {
            sh: async (ctx) => await sh(ctx),
            help: async () => {
                return this._help();
            },
            hello: async function(proc) {
                console.log('start hello cmd, proc:', proc);
                console.log('args:', proc.args);
                console.log('this:', this);
                // 使用this访问进程相关信息
                let input = await this.stdin.read('Please input your name: ');
                this.stdout.writeln(`Hello, ${input}!`);
                return 0;
            },
            true: async () => 0,
            false: async () => 1,
            test: async (ctx) => {
                // 模拟实现test命令的主要功能
                let args = ctx.args;
                let stdout = ctx.stdout || this.stdout;
                console.log('[test] args:', args);
                let result = false;
                
                try {
                    if (args.length === 0) {
                        // test without arguments returns false
                        result = false;
                    } else if (args.length === 1) {
                        // test with one argument returns true if not empty
                        result = args[0] !== '';
                    } else if (args.length === 3) {
                        // 检查是否是二元比较（如 =, !=）
                        const operator = args[1];
                        const left = args[0];
                        const right = args[2];
                        
                        switch (operator) {
                            case '=':
                            case '==':
                            case '-eq':
                                result = left == right;  // do not use ===, we will type compare
                                break;
                            case '!=':
                            case '-ne':
                                result = left != right;  // do not use !==, we will type compare
                                break;
                            case '<':
                            case '-lt':
                                result = left < right;
                                break;
                            case '>':
                            case '-gt':
                                result = left > right;
                                break;
                            case '<=':
                            case '-le':
                                result = left <= right;
                                break;
                            case '>=':
                            case '-ge':
                                result = left >= right;
                                break;
                        }
                    } else {
                        // 处理选项
                        const option = args[0];
                        
                        switch (option) {
                            case '-f':
                                // 检查文件是否存在
                                console.log(`[debug] Testing if file exists: ${args[1]}`);
                                if (typeof os !== 'undefined' && os.fs) {
                                    let fileInfo = os.fs.stat(args[1]);
                                    result = fileInfo != null && fileInfo.type == 'file';
                                } else if (isNode && fs) {
                                    result = fs.existsSync(args[1]);
                                    console.log(`[debug] Node existsSync result: ${result}`);
                                }
                                break;
                            case '-d':
                                // 检查目录是否存在
                                if (typeof os !== 'undefined' && os.fs) {
                                    let fileInfo = os.fs.stat(args[1]);
                                    result = fileInfo != null && fileInfo.type == 'directory';
                                } else if (isNode && fs) {
                                    try {
                                        result = fs.statSync(args[1]).isDirectory();
                                    } catch (e) {
                                        result = false;
                                    }
                                }
                                break;
                            case '-e':
                                // 检查文件或目录是否存在
                                if (typeof os !== 'undefined' && os.fs) {
                                    result = os.fs.exists(args[1]);
                                } else if (isNode && fs) {
                                    result = fs.existsSync(args[1]);
                                }
                                break;
                            case '-z':
                                // 检查字符串是否为空
                                console.log(`[debug] Testing if string is empty: "${args[1]}"`);
                                result = args[1] === '';
                                break;
                            case '-n':
                                // 检查字符串是否非空
                                console.log(`[debug] Testing if string is non-empty: "${args[1]}"`);
                                result = args[1] !== '';
                                break;
                            default:
                                result = false;
                        }
                    }
                } catch (e) {
                    stdout.writeln(`[debug] Error in test command:`, e);
                    result = false;
                }
                
                // 根据用户要求：成功时返回空字符串，失败时返回非空字符串
                console.log(`[debug] test result: ${result}`);
                return result ? 0 : 1;
            },
            echo: (ctx) => {
                console.log('[debug] echo args:', ctx.args);
                if(ctx.stdout)
                    ctx.stdout.writeln(ctx.args.join(' '));
                else
                    this.stdout.writeln(ctx.args.join(' '));
            },
            env: (ctx) => {
                let stdout = ctx.stdout || this.stdout;
                stdout.writeln(Object.entries(this.state.env).map(([k, v]) => `${k}=${v}`).join('\n'));
            },
            set: (ctx) => {
                let args = ctx.args;
                let stdout = ctx.stdout || this.stdout;
                console.log('[debug] set args:', args);
                // 无参数时显示所有变量和函数定义
                if (args.length === 0) {
                    stdout.writeln(Object.entries(this.state.variables).map(([k, v]) => `${k}=${v}`).join('\n'));
                    stdout.writeln(Object.entries(this.state.functions).map(([k, v]) => `${k}()={${v}}`).join('\n'));
                    return;
                }
        
                // 有参数时设置变量args = ['a', '=', '123']
                // 检查参数格式是否正确
                if (args.length !== 3 || args[1] !== '=') {
                    return stdout.writeln('error: invalid format: set 变量名=值');
                }
                const key = args[0];
                const value = args[2];
                if (key && value) this.state.variables[key] = value;
            },
            pwd: () => this.stdout.writeln(this.state.cwd),
            ls: (ctx) => {
                let args = ctx.args;
                let stdout = ctx.stdout || this.stdout;
                try {
                    // 优先使用os.fs
                    if(typeof os !== 'undefined'){
                        if(args.length)
                            return stdout.writeln(os.fs.ls(args[0]));
                        else
                            return stdout.writeln(os.fs.ls(this.state.cwd));
                    }
                    // Node.js环境使用fs模块
                    else if (isNode) {
                        const path = args[0] || '.';
                        try {
                            const files = fs.readdirSync(path);
                            return this.stdout.writeln(files.join('  '));
                        } catch (e) {
                            return this.stdout.writeln(`ls: 无法访问 ${path}: ${e.message}`);
                        }
                    }
                    // 其他环境返回模拟数据
                    const dirs = ['docs', 'downloads', 'projects'];
                    const files = ['readme.txt', 'notes.md'];
                    return [...dirs, ...files].join('  ');
                } catch (e) {
                    return `ls: 错误: ${e.message}`;
                }
            },
            cat: async (proc) => {
                if (!proc.args[0]) return 'cat: 缺少文件名';
                const fileName = proc.args[0];
                try {
                    // 优先使用os.fs
                    if(typeof os !== 'undefined' && os.fs && os.fs.read) {
                        return proc.stdout.writeln(os.fs.read(fileName));
                    }
                    // Node.js环境使用fs模块
                    else if (isNode && fs) {
                        try {
                            return proc.stdout.writeln(fs.readFileSync(fileName, 'utf8'));
                        } catch (e) {
                            return proc.stdout.writeln(`cat: 无法读取文件 ${fileName}: ${e.message}`);
                        }
                    }
                } catch (e) {
                    return proc.stdout.writeln(`cat: 错误: ${e.message}`);
                }
                return proc.stdout.writeln(`cat: 无法读取文件 ${fileName}`);
            },
            grep: async (ctx) => {
                if (ctx.args.length < 1) {
                    ctx.stdout.writeln('Usage: grep PATTERN [FILE]');
                    return 1;
                }
                const pattern = ctx.args[0];
                const fileName = ctx.args[1];
                try {
                    if(!fileName) {
                        // 从stdin读取
                        while (true) {
                            console.log('grep: await stdin.read()');
                            const data = await ctx.stdin.readline();
                            if (data === null) {
                                console.log('grep: broken pipe.');
                                break;
                            }
                            const lines = data.split('\n');
                            const matchedLines = lines.filter(line => line.includes(pattern));
                            ctx.stdout.writeln(matchedLines.join('\n'));
                        }
                        return 0;
                    }
                    // 优先使用os.fs
                    if(typeof os !== 'undefined') {
                        const content = os.fs.read(fileName);
                        const lines = content.split('\n');
                        const matchedLines = lines.filter(line => line.includes(pattern));
                        return this.stdout.writeln(matchedLines.join('\n'));
                    }
                    // Node.js环境使用fs模块
                    else if (isNode && fs) {
                        try {
                            const content = fs.readFileSync(fileName, 'utf8');
                            const lines = content.split('\n');
                            const matchedLines = lines.filter(line => line.includes(pattern));
                            return this.stdout.writeln(matchedLines.join('\n'));
                        } catch (e) {
                            return this.stdout.writeln(`grep: 无法读取文件 ${fileName}: ${e.message}`);
                        }
                    }
                } catch (e) {
                    return this.stdout.writeln(`grep: 错误: ${e.message}`);
                }
                return this.stdout.writeln(`grep: 无法读取文件 ${fileName}`);
            },
            cd: (ctx) => {
                const args = ctx.args;
                if (!args[0]) this.state.cwd = this.state.env.HOME;
                else this.state.cwd = args[0].startsWith('/') ? args[0] : `${this.state.cwd}/${args[0]}`;
                this.state.env.PWD = this.state.cwd;
                return '';
            },
            export: (args) => {
                // note: 导出后可被子进程继承
                const [key, value] = args[0].split('=');
                if (key && value) this.state.env[key] = value;
                return '';
            },
            exit: () => {
                this.stdout.writeln('Exiting shell...');
                this.running = false;
            }
        };
        
        return commands;
    }
    
    // 词法分析器
    tokenize(input) {
        if (this.state.debug) {
            console.log('===== tokenize =====');
        }
        
        const tokens = [];
        let position = 0;
        
        const patterns = [
            { regex: /^\s+/, type: 'whitespace' },
            { regex: /^#.*$/, type: 'comment' },
            { regex: /^>\s*/, type: 'redirection', value: '>' },
            { regex: /^>>\s*/, type: 'redirection', value: '>>' },
            { regex: /^<\s*/, type: 'redirection', value: '<' },
            { regex: /^\|\s*/, type: 'pipe', value: '|' },
            { regex: /^;/, type: 'semicolon', value: ';' },
            { regex: /^;;/, type: 'double-semicolon', value: ';;' },
            { regex: /^,/, type: 'comma', value: ',' },
            { regex: /^\$([\w_]+)/, type: 'variable', extract: 1 },
            { regex: /^"([^"]*)"/, type: 'string' },
            { regex: /^'([^']*)'/, type: 'string' },
            { regex: /^`([^`]*)`/, type: 'command-substitution' },
            { regex: /^function\s+/, type: 'function-keyword', value: 'function' },
            { regex: /^\{\s*/, type: 'function-start', value: '{' },
            { regex: /^\}\s*/, type: 'function-end', value: '}' },
            { regex: /^[()]/, type: 'bracket' },
            { regex: /^([\w\-\.\/]+)=([\w\-\.\/]+|"[^"]*"|'[^']*')/, type: 'assignment', extract: [1, 2] },
            // 改进正则表达式，确保能正确匹配包含空格的算术表达式赋值
            { regex: /^([\w\-\.\/]+)=((?:\$\(\([^)]+\)\)|[^;\n])+)/, type: 'assignment', extract: [1, 2] },
            { regex: /^[\w\-\.\/]+/, type: 'identifier' },
            { regex: /^\d+/, type: 'number' },
            { regex: /^(==|!=|[<>]=?)/, type: 'operator' }
        ];
        
        // 优先识别的关键字列表
        const keywords = ['function', 'done', 'echo', 'case', 'esac', 'else', 'for', 'fi', 'if', 
                         'in', 'do', 'set', 'while', 'exit'];
        
        while (position < input.length) {
            let match = null;
            let foundToken = false;
            const remainingInput = input.slice(position);
            
            // 先检查是否是关键字
            for (const keyword of keywords) {
                const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const keywordPattern = new RegExp(`^${escapedKeyword}(?!\\w)`);
                match = keywordPattern.exec(remainingInput);
                if (match && match[0] === keyword) {
                    tokens.push({ type: 'keyword', value: match[0] });
                    position += match[0].length;
                    foundToken = true;
                    break;
                }
            }
            
            if (!foundToken) {
                // 检查其他模式
                for (const pattern of patterns) {
                    match = pattern.regex.exec(remainingInput);
                    if (match) {
                        if (pattern.type === 'whitespace' || pattern.type === 'comment') {
                            // 跳过空白和注释
                        } else if (pattern.type === 'string') {
                            tokens.push({ type: pattern.type, value: match[1] });
                        } else if (pattern.type === 'variable' && pattern.extract) {
                            const varName = match[pattern.extract];
                            tokens.push({ 
                                type: pattern.type, 
                                value: '$' + varName, 
                                name: varName 
                            });
                        } else if (pattern.type === 'number') {
                            tokens.push({ 
                                type: pattern.type, 
                                value: parseInt(match[0]) 
                            });
                        } else {
                            tokens.push({ 
                                type: pattern.type, 
                                value: pattern.value || match[0] 
                            });
                        }
                        position += match[0].length;
                        foundToken = true;
                        break;
                    }
                }
            }
            
            if (!foundToken) {
                tokens.push({ type: 'unknown', value: input[position] });
                position++;
            }
        }
        console.log('[parse] tokenize: ', tokens);
        return tokens;
    }
    
    // 语法分析器
    Parser = class Parser {
        constructor(tokens, state) {
            this.tokens = tokens;
            this.pos = 0;
            this.state = state;
        }
        
        peek() { return this.tokens[this.pos]; }
        consume() { return this.tokens[this.pos++]; }
        eof() { return this.pos >= this.tokens.length; }
        
        parse() {
            // console.log(`[debug] Parsing tokens:`, this.tokens);
            const statements = [];
            while (!this.eof()) {
                // 跳过前导的分号
                while (!this.eof() && this.peek()?.type === 'semicolon') {
                    this.consume();
                }
                
                if (!this.eof()) {
                    statements.push(this.parseStatement());
                }
            }
            let ast = { type: 'Program', body: statements };
            console.log('[parse] ast: ', ast);
            return ast;
        }
        
        parseStatement() {
            if (this.peek()?.type === 'semicolon') {
                this.consume();
            }
            
            const token = this.peek();
            
            switch (token?.value) {
                case 'function': return this.parseFunctionDefinition();
                case 'if': return this.parseIf();
                case 'for': return this.parseFor();
                case 'while': return this.parseWhile();
                case 'case': return this.parseCase();
                default:
                    // 检查是否是函数名()形式的函数定义
                    if (this.peek()?.type === 'identifier' && this.peek(1)?.type === 'bracket' && this.peek(1)?.value === '(') {
                        return this.parseFunctionDefinition();
                    }
                    
                    if (token && ['identifier', 'number', 'string', 'variable'].includes(token.type)) {
                        const startPos = this.pos;
                        
                        try {
                            const left = this.consume();
                            const operatorToken = this.peek();
                            
                            if (operatorToken && ['==', '!=', '>', '<', '>=', '<='].includes(operatorToken.value)) {
                                this.pos = startPos;
                                const expr = this.parseExpression();
                                return { type: 'ExpressionStatement', expression: expr };
                            } else {
                                this.pos = startPos;
                            }
                        } catch (e) {
                            this.pos = startPos;
                        }
                    }
                    
                    return this.parseCommand();
            }
        }
        
        parseIf() {
            this.consume();
            
            // 只支持命令作为条件
            let test;
            
            // 检查是否是 [ ] 语法
            if (this.peek()?.value === '[') {
                console.log('[debug] Parsing [] condition syntax');
                this.consume(); // 消耗 [
                
                // 收集 [ 和 ] 之间的所有参数
                const args = [];
                while (this.peek() && this.peek().value !== ']') {
                    const arg = this.consume();
                    // 忽略分号
                    if (arg.type !== 'semicolon') {
                        args.push(arg.value);
                    }
                }
                
                if (!this.peek() || this.peek().value !== ']') {
                    throw new Error('Expected "]" to close condition');
                }
                this.consume(); // 消耗 ]
                
                // 将 [ args ] 转换为 test args 命令
                test = { type: 'Command', name: 'test', args: args };
            } else {
                // 解析普通命令
                test = this.parseCommand();
            }
            
            // 处理分号（可选）
            if (this.peek()?.type === 'semicolon') {
                this.consume();
            }
            
            if (!this.peek() || this.peek().value !== 'then') {
                throw new Error('Expected "then" after condition');
            }
            this.consume();
            
            const consequent = this.parseBlockUntil('else', 'fi');
            const alternate = this.peek()?.value === 'else' ? (this.consume(), this.parseBlockUntil('fi')) : null;
            
            if (!this.peek() || this.peek().value !== 'fi') {
                throw new Error('Expected "fi" to close if statement');
            }
            this.consume();
            
            // 现在所有条件都是命令
            return { type: 'IfStatement', test, consequent, alternate, isCommand: true };
        }
        
        parseFor() {
            this.consume();
            
            if (!this.peek() || !['identifier', 'variable'].includes(this.peek().type)) {
                throw new Error('Expected variable name after for');
            }
            
            const id = this.consume().value;
            
            let foundIn = false;
            while (!this.eof() && !foundIn) {
                const token = this.peek();
                if (!token) {
                    throw new Error('Expected "in" keyword but reached end of input');
                }
                
                if (token.value === 'in') {
                    foundIn = true;
                    this.consume();
                    break;
                } else if (token.type === 'semicolon') {
                    this.consume();
                } else {
                    this.consume();
                }
            }
            
            if (!foundIn) {
                throw new Error('Expected "in" after variable name');
            }
            
            const values = [];
            while (!this.eof() && this.peek().value !== 'do') {
                const token = this.peek();
                if (!token) break;
                
                if (token.type === 'semicolon') {
                    this.consume();
                    if (this.peek() && this.peek().value === 'do') {
                        break;
                    }
                } else if (['identifier', 'number', 'string', 'variable'].includes(token.type)) {
                    values.push(this.consume().value);
                } else {
                    this.consume();
                }
            }
            
            let foundDo = false;
            while (!this.eof() && !foundDo) {
                const token = this.peek();
                if (!token) {
                    throw new Error('Expected "do" keyword but reached end of input');
                }
                
                if (token.value === 'do') {
                    foundDo = true;
                    this.consume();
                    break;
                } else if (token.type === 'semicolon') {
                    this.consume();
                } else {
                    this.consume();
                }
            }
            
            if (!foundDo) {
                throw new Error('Expected "do" after loop values');
            }
            
            const body = this.parseBlockUntil('done');
            
            if (!this.peek() || this.peek().value !== 'done') {
                throw new Error('Syntax error: Missing "done" keyword in for loop');
            }
            
            this.consume();
            return { type: 'ForStatement', id, values, body };
        }
        
        parseWhile() {
            this.consume();
            
            // 只支持命令作为条件，与if语法保持一致
            let test;
            
            // 检查是否是 [ ] 语法
            if (this.peek()?.value === '[') {
                console.log('[debug] Parsing [] condition syntax in while');
                this.consume(); // 消耗 [
                
                // 收集 [ 和 ] 之间的所有参数
                const args = [];
                while (this.peek() && this.peek().value !== ']') {
                    const arg = this.consume();
                    // 忽略分号
                    if (arg.type !== 'semicolon') {
                        args.push(arg.value);
                    }
                }
                
                if (!this.peek() || this.peek().value !== ']') {
                    throw new Error('Expected "]" to close condition');
                }
                this.consume(); // 消耗 ]
                
                // 将 [ args ] 转换为 test args 命令
                test = { type: 'Command', name: 'test', args: args };
            } else {
                // 解析普通命令
                test = this.parseCommand();
            }
            
            // 处理分号（可选）
            if (this.peek()?.type === 'semicolon') {
                this.consume();
            }
            
            if (!this.peek() || this.peek().value !== 'do') {
                throw new Error('Expected "do" keyword after while condition');
            }
            
            this.consume();
            const body = this.parseBlockUntil('done');
            this.consume();
            return { type: 'WhileStatement', test, body, isCommand: true };
        }
        
        parseCase() {
            this.consume();
            const discriminant = this.consume().value;
            this.consume();
            const cases = [];
            while (this.peek()?.value !== 'esac') {
                const test = this.consume().value;
                this.consume();
                const consequent = this.parseBlockUntil(';;');
                this.consume();
                cases.push({ test, consequent });
            }
            this.consume();
            return { type: 'CaseStatement', discriminant, cases };
        }
        
        parseCommand() {
            const tokens = [];
            while (!this.eof() && ![';', 'then', 'do', 'done', 'fi', 'esac', ';;', 'else'].includes(this.peek()?.value)) {
                const token = this.consume();
                tokens.push(token);
            }
            
            if (tokens.length === 1 && tokens[0].type === 'assignment') {
                const id = tokens[0].extract?.[0] || tokens[0].value.split('=')[0];
                const value = tokens[0].extract?.[1] || tokens[0].value.split('=', 2)[1] || '';
                const cleanValue = value.replace(/^["'](.+)["']$/, '$1');
                return { type: 'Assignment', id, value: cleanValue };
            } else if (tokens.length === 1 && tokens[0].type === 'identifier' && tokens[0].value.includes('=')) {
                const [id, value] = tokens[0].value.split('=', 2);
                return { type: 'Assignment', id, value };
            }
            
            if (tokens.length === 0) {
                return { type: 'Command', name: '', args: [] };
            }
            
            return {
                type: 'Command',
                name: tokens[0]?.value,
                args: tokens.slice(1).map(t => t.value)
            };
        }
        
        parseFunctionDefinition() {
            let functionName = '';
            
            // 处理 function 关键字 (可以是function-keyword或keyword类型)
            if (this.peek()?.type === 'function-keyword' || this.peek()?.type === 'keyword' && this.peek()?.value === 'function') {
                this.consume();
                functionName = this.consume()?.value || '';
            } else {
                // 处理 函数名() 形式
                functionName = this.consume()?.value || '';
            }
            
            // 消耗括号
            if (this.peek()?.type === 'bracket' && this.peek()?.value === '(') {
                this.consume();
                if (this.peek()?.type === 'bracket' && this.peek()?.value === ')') {
                    this.consume();
                }
            }
            
            // 收集函数体内容
            let body = '';
            if (this.peek()?.type === 'function-start') {
                this.consume();
                let nestedLevel = 1;
                
                while (!this.eof() && nestedLevel > 0) {
                    if (this.peek()?.type === 'function-start') {
                        nestedLevel++;
                        body += '{';
                        this.consume();
                    } else if (this.peek()?.type === 'function-end') {
                        nestedLevel--;
                        if (nestedLevel > 0) {
                            body += '}';
                        }
                        this.consume();
                    } else {
                        // 收集函数体内容，保留空白字符和分隔符
                        const nextToken = this.consume();
                        if (nextToken) {
                            // 如果不是第一个token，且前一个token不是特殊字符，添加空格
                            if (body.length > 0 && 
                                !['comma', 'semicolon', 'function-start'].includes(this.tokens[this.pos-2]?.type) &&
                                !['comma', 'semicolon', 'function-end'].includes(nextToken.type)) {
                                body += ' ';
                            }
                            
                            // 对于特殊字符，确保它们被正确添加到函数体中
                            if (nextToken.type === 'comma') {
                                body += ',';
                            } else if (nextToken.type === 'semicolon') {
                                body += ';';
                            } else {
                                body += nextToken.value;
                            }
                        }
                    }
                }
            }
            
            return { 
                type: 'FunctionDefinition', 
                name: functionName, 
                body: body.trim() 
            };
        }
        
        parseExpression() {
            const left = this.consume().value;
            const operator = this.consume().value;
            const right = this.consume().value;
            return { type: 'BinaryExpression', left, operator, right };
        }
        
        parseBlockUntil(...endTokens) {
            const body = [];
            let iterationCount = 0;
            const maxIterations = 100;
            
            while (!this.eof() && !endTokens.includes(this.peek()?.value) && iterationCount < maxIterations) {
                const currentToken = this.peek();
                
                if (!currentToken) {
                    break;
                }
                
                if (currentToken.type === 'semicolon') {
                    this.consume();
                    iterationCount++;
                    continue;
                }
                
                try {
                    body.push(this.parseStatement());
                } catch (e) {
                    throw e;
                }
                iterationCount++;
            }
            
            if (iterationCount >= maxIterations) {
                throw new Error('Syntax error: Possible infinite loop detected in block parsing');
            }
            return body;
        }
    }
    
    // 执行器
    Executor = class Executor {
        constructor(shell) {
            this.shell = shell;
            this.state = shell.state;
            this.commands = shell.commands;
        }
        // 异步执行AST,嵌套调用时必须指定await保证shell脚本顺序执行
        async execute(ast) {
            if (ast.type === 'Program') {
                const results = [];
                for (const stmt of ast.body) {
                    const result = await this.execute(stmt);
                    if (result && result !== '\n') {
                        results.push(result);
                    }
                }
                return results.join('\n');
            }
            console.log('[exec] Run:', ast);
            // 处理函数定义
            if (ast.type === 'FunctionDefinition') {
                this.state.functions[ast.name] = ast.body;
                return '';
            }
            
            // 处理函数调用
            if (ast.type === 'FunctionCall') {
                console.log(`[exe] Function call: ${ast.name} with args:`, ast.args);
                const funcBody = this.state.functions[ast.name];
                if (!funcBody) {
                    return `function not found: ${ast.name}`;
                }
                
                // 复制并保存当前变量状态（用于局部变量）
                const savedVariables = { ...this.state.variables };
                
                try {
                    // 设置函数参数$#, $1, $2, ...
                    for (let i = 0; i < ast.args.length; i++) {
                        this.state.variables[`$${i+1}`] = ast.args[i];
                    }
                    this.state.variables['$#'] = ast.args.length.toString();
                    
                    // 执行函数体
                    console.log(`[debug] Function body: ${funcBody}`);
                    const tokens = this.shell.tokenize(funcBody);
                    // Parser类是Shell类的内部类，需要正确访问
                    // 创建一个新的Parser实例
                    const parser = new this.shell.Parser(tokens, this.state);
                    const funcAst = parser.parse();
                    console.log(`[debug] Function AST:`, funcAst);
                    
                    // 确保执行结果能够正确返回
                    const result = await this.execute(funcAst);
                    console.log(`[debug] Function ${ast.name} execution result:`, result);
                    return result || '';
                } catch (e){
                    this.stdout.writeln(`[exec] Error in function ${ast.name}: ${e.message}`);
                }
                finally {
                    // 恢复变量状态
                    this.state.variables = savedVariables;
                }
            }
            
            switch (ast.type) {
                case 'ExpressionStatement': return this.executeExpression(ast);
                case 'IfStatement': return this.executeIf(ast);
                case 'ForStatement': return this.executeFor(ast);
                case 'WhileStatement': return this.executeWhile(ast);
                case 'CaseStatement': return this.executeCase(ast);
                case 'Command': 
                    // 检查命令参数中中是否包含管道符
                    if (ast.args.includes('|')) {
                        return await this.executePipeline(ast);
                    }
                    // 检查是否是函数调用(命令和函数调用的形式完全一样，根据是否在functions中定义来判断)
                    if (this.state.functions[ast.name]) {
                        console.log(`[exec] Function call: ${ast.name} with args:`, ast.args);
                        return await this.execute({ type: 'FunctionCall', name: ast.name, args: ast.args });
                    }
                    return await this.executeCommand(ast);
                case 'Assignment': 
                    let finalValue = ast.value;
                    if (finalValue.startsWith('$((') && finalValue.endsWith('))')) {
                        try {
                            const expr = finalValue.slice(3, -2).trim();
                            // 改进正则表达式，确保能正确匹配变量名，即使周围有空格
                            let exprWithValues = expr.replace(/[a-zA-Z_]\w*/g, (match) => {
                                return this.state.variables[match] || 0;
                            });
                            const result = eval(exprWithValues);
                            finalValue = String(result);
                        } catch (e) {
                            // 计算失败，保留原始值
                        }
                    } else if (finalValue.includes('$(((') && finalValue.includes(')))')) {
                        finalValue = finalValue.replace(/\$\(\(([^)]+)\)\)/g, (match, expr) => {
                            try {
                                let exprWithValues = expr.replace(/\b[a-zA-Z_]\w*\b/g, (varMatch) => {
                                    return this.state.variables[varMatch] || 0;
                                });
                                const result = eval(exprWithValues);
                                return String(result);
                            } catch (e) {
                                return match;
                            }
                        });
                    }
                    this.state.variables[ast.id] = finalValue;
                    return '';
                default: return `Unknown statement type: ${ast.type}`;
            }
        }
        // 依赖os.proc和os.pipe
        async executePipeline(ast) {
            console.log(`[pipeline] executePipeline with commands:`, ast.args);
            // ast.name like "cmd1"
            // ast.args like: ['arg1', 'arg2', '|', 'cmd2', '|', 'arg3', 'arg4']
            // { type: 'Command', name: cmd, args: [] }
            let processList = [];
            let cmdArgs = [ast.name, ...ast.args];
            while (cmdArgs.length > 0) {
                let cmd = cmdArgs.shift();
                let args = [];
                // 提取当前命令的参数，直到遇到下一个管道符或结束
                let idx = cmdArgs.indexOf('|');
                if (idx > 0) {
                    args = cmdArgs.slice(0, idx);
                    cmdArgs = cmdArgs.slice(idx+1);
                }else{
                    args = cmdArgs; // last command's args
                    cmdArgs = [];
                }
                
                // 加载当前命令
                let proc = await this.loadCommand({type: 'Command', name: cmd, args: args});
                processList.push(proc);
            }
            console.log(`[pipeline] processList:`, processList);
            
            // 连接进程的stdout到下一个进程的stdin
            for (let i = 0; i < processList.length - 1; i++) {
                processList[i].pipe(processList[i+1]);
            }
            
            // 并发启动所有进程, 等待所有进程完成
            await Promise.all(processList.map(proc => proc.run()));
            let ret = processList[processList.length - 1].ret;
            console.log(`[pipeline] done, last process exit code:`, ret);
            return ret;
        }
        async executeIf(ast) {
            console.log(`[debug] executeIf with command condition: ${ast.test.name}`, ast.test.args);
            let condition = false;
            
            // 只处理命令作为条件
            if (ast.test.type === 'Command') {
                try {
                    // 执行命令并获取返回码
                    const retcode = await this.executeCommand(ast.test);
                    
                    // 根据用户要求：返回码为空表示true，非空表示false
                    condition = retcode === '' || retcode === undefined || retcode === null || retcode === 0;
                    console.log(`[debug] Command returned: ${retcode}, condition: ${condition}`);
                } catch (e) {
                    console.error(`[debug] Error executing command as condition:`, e);
                    condition = false;
                }
            }
            
            console.log(`[debug] If condition result:`, condition);
            
            if (condition) {
                return await this.execute({ type: 'Program', body: ast.consequent });
            } else if (ast.alternate) {
                return await this.execute({ type: 'Program', body: ast.alternate });
            }
            return '';
        }
        
        async executeFor(ast) {
            const results = [];
            let iterationCount = 0;
            const maxIterations = 100;
            
            for (const value of ast.values) {
                iterationCount++;
                
                if (iterationCount > maxIterations) {
                    results.push('Error: Maximum iteration limit reached');
                    break;
                }
                
                let cleanVarName = ast.id;
                if (cleanVarName.startsWith('$')) {
                    cleanVarName = cleanVarName.slice(1);
                }
                
                this.state.variables[cleanVarName] = value;
                
                try {
                    const result = await this.execute({ type: 'Program', body: ast.body });
                    if (result && result !== '\n') {
                        results.push(result);
                    }
                } catch (e) {
                    results.push(`Error in loop body: ${e.message}`);
                }
            }
            
            return results.filter(Boolean).join('\n');
        }
        
        async executeWhile(ast) {
            const output = [];
            let count = 0;
            
            while (count < 100) {
                let condition = false;
                
                // 只处理命令作为条件，与if语法保持一致
                if (ast.test.type === 'Command') {
                    try {
                        // 执行命令并获取返回码
                        const retcode = await this.executeCommand(ast.test);
                        
                        // 根据用户要求：返回码为空、undefined、null或0表示true，非空且非0表示false
                        condition = retcode === '' || retcode === undefined || retcode === null || retcode === 0;
                        console.log(`[debug] Command returned: ${retcode}, condition: ${condition}`);
                    } catch (e) {
                        console.error(`[debug] Error executing command as condition:`, e);
                        condition = false;
                    }
                }
                
                console.log(`[debug] While condition result:`, condition);
                
                if (!condition) {
                    break;
                }
                
                try {
                    const result = await this.execute({ type: 'Program', body: ast.body });
                    if (result && result !== '\n') {
                        output.push(result);
                    }
                } catch (e) {
                    output.push(`Error in loop body: ${e.message}`);
                }
                
                count++;
            }
            
            return output.filter(Boolean).join('\n');
        }
        
        async executeCase(ast) {
            const value = this.state.variables[ast.discriminant] || ast.discriminant;
            for (const caseBlock of ast.cases) {
                if (caseBlock.test === value) {
                    return await this.execute({ type: 'Program', body: caseBlock.consequent });
                }
            }
            return '';
        }

       async loadCommand(ast) {
            // 1. 从builtin中查找命令函数
            let commandFunc = undefined;
            if (this.commands[ast.name]) {
                commandFunc = this.commands[ast.name];
                ast.cmdType = 'builtin';
            //     cmdPath = searchCmdPath(ast.name);
            //     commandFunc = os.loadModule(cmdPath);
            //     ast.cmdType = 'external';
            } else {
                console.error(`sh: command not found: ${ast.name}`);
                throw new Error(`sh: command not found: ${ast.name}`);
            }

            // 2. 命令参数解析。包括变量引用、子shell执行、参数展开等。
            try {
                const processedArgs = ast.args.map(arg => {
                    // 首先检查是否是包含变量引用的字符串
                    if (typeof arg === 'string' && arg.includes('$') && !arg.startsWith('$')) {
                        // 处理字符串中的变量引用，如"a is $a"
                        return arg.replace(/\$(\w+)/g, (match, varName) => {
                            return this.state.variables[varName] || match;
                        });
                    } else if (arg.startsWith('$')) {
                        // 只处理以$开头的变量引用
                        if (arg.startsWith('$((') && arg.endsWith('))')) {
                            // 处理如：b=$((a + 1))
                            try {
                                const expr = arg.slice(3, -2).trim();
                                // 改进正则表达式，确保能正确匹配变量名，即使周围有空格
                                let exprWithValues = expr.replace(/[a-zA-Z_]\w*/g, (match) => {
                                    return this.state.variables[match] || 0;
                                });
                                const result = eval(exprWithValues);
                                return String(result);
                            } catch (e) {
                                return '';
                            }
                        }else if (arg.startsWith('$(') && arg.endsWith(')')) {
                            // 处理如：b=$(echo $a)
                            // todo: 实现子shell执行
                            return arg;
                        }
                        // 处理$变量引用
                        const varName = arg.substring(1);
                        return this.state.variables[varName] || this.state.variables[arg] || arg;
                    }
                    // 对于普通字符串参数，直接返回，不进行变量替换
                    return arg;
                });
                console.log(`[exec] loadCommand ${ast.name} args:`, processedArgs);

                // 3. 执行命令函数。如果是builtin，直接调用；如果是external，通过Process执行。
                const Fn = this.commands[ast.name];
                if(isNode){
                    // node环境不支持管道，也不依赖其他文件，可以基于sh.js单文件运行，方便测试sh语法。
                    return {
                        run: async () => {
                            return await Fn({args: processedArgs});
                        } 
                    };
                }
                // 为了支持管道处理(退出时自动关闭所有管道和文件)，所有命令包装成进程执行
                let process = os.proc.create(ast.name, Fn, processedArgs);
                return process;
            } catch (e) {
                this.stdout.writeln(`error: ${e.message}`);
                return 1;
            }
        }

        async executeCommand(ast) {
            console.log(`[exec] Command ${ast.name} args:`, ast.args);
            try {
                let process = await this.loadCommand(ast);
                let retcode = '';

                retcode = await process.run();

                console.log(`[exec] Command ${ast.name} ret: ${retcode}`);
                return retcode ? 1: 0;
            } catch (e) {
                this.shell.stdout.writeln(`error: ${e.message}`);
                return 1;
            }
        }
        
        executeExpression(ast) {
            const expr = ast.expression;
            const result = this.evaluate(expr);
            
            const leftValue = this.state.variables[expr.left] || expr.left;
            const rightValue = this.state.variables[expr.right] || expr.right;
            
            const formatValue = (value) => {
                return typeof value === 'string' ? `"${value}"` : String(value);
            };
            
            const formattedLeft = formatValue(leftValue);
            const formattedRight = formatValue(rightValue);
            
            if (result) {
                return `true: ${formattedLeft} ${expr.operator} ${formattedRight}`;
            } else {
                let inequalityOperator = expr.operator === '==' ? '!=' : expr.operator;
                return `false: ${formattedLeft} ${inequalityOperator} ${formattedRight}`;
            }
        }
        
        evaluate(expr) {
            debugger;
            let left = expr.left;
            let right = expr.right;

            if(left.startsWith('$')){
                // 如果是$+字母开头，去掉$
                let varName = left;
                if(/^[a-zA-Z_]\w*$/.test(left.substring(1))){
                    varName = left.substring(1);
                }
                left = this.state.variables[varName];
            }
            if(right.startsWith('$')){
                let varName = right;
                if(/^[a-zA-Z_]\w*$/.test(right.substring(1))){
                    varName = right.substring(1);
                }
                right = this.state.variables[varName];
            }
            
            // use js built-in comparison operators
            switch (expr.operator) {
                case '==': return left == right;
                case '!=': return left != right;
                case '>': return left > right;
                case '<': return left < right;
                case '>=': return left >= right;
                case '<=': return left <= right;
                default: return false;
            }
        }
    }
    
    // 处理命令执行
    async executeCommand(input) {
        if (!input.trim()) return '';
        
        try {
            // step 1: tokenize
            const tokens = this.tokenize(input);

            // step 2: parse AST
            const parser = new this.Parser(tokens, this.state);
            const ast = parser.parse();
            
            // step 3: execute AST
            const executor = new this.Executor(this);
            return await executor.execute(ast);
        } catch (e) {
            this.stdout.writeln(`error: ${e.message}`);
            return 1;
        }
    }
    // 执行脚本文件内容
    async executeScript(scriptContent) {
        console.log('[debug] executing script content');
        const lines = scriptContent.split('\n');
        let lastResult = { success: true };
        
        // 语句块的开始和结束标记对
        const blockMarkers = {
            'if': { start: /if\s+.*?;\s*then/i, end: /fi\s*$/i },
            'for': { start: /for\s+.*?;\s*do/i, end: /done\s*$/i },
            'while': { start: /while\s+.*?;\s*do/i, end: /done\s*$/i },
            'case': { start: /case\s+.*?;\s*in/i, end: /esac\s*$/i },
            'function': { start: /function\s+[\w-]+\s*\(\s*\)/i, end: /^\s*}\s*$/i }
        };
        
        let i = 0;
        while (i < lines.length) {
            // 去除行首尾空格和换行符
            let line = lines[i].trim();
            i++;
            
            // 跳过空行和注释行（以#开头）
            if (line === '' || line.startsWith('#')) {
                continue;
            }
            
            // 检查是否是语句块的开始
            let isBlockStart = false;
            let blockType = null;
            
            for (const [type, markers] of Object.entries(blockMarkers)) {
                if (markers.start.test(line)) {
                    isBlockStart = true;
                    blockType = type;
                    console.log(`[readFile] found block start: ${type}`);
                    break;
                }
            }
            
            // 如果是语句块，收集整个语句块
            if (isBlockStart && blockType) {
                const fullBlock = [line];
                let nestedLevel = 1; // 嵌套级别
                
                // 继续收集直到找到匹配的结束标记
                while (i < lines.length && nestedLevel > 0) {
                    const blockLine = lines[i].trim();
                    i++;
                    // console.log(`[debug][block] continue line: ${blockLine}`);
                    // 跳过空行和注释行
                    if (blockLine === '' || blockLine.startsWith('#')) {
                        continue;
                    }
                    
                    // 检查是否有新的相同类型的开始标记（嵌套）
                    if (blockMarkers[blockType].start.test(blockLine)) {
                        nestedLevel++;
                    }
                    // 检查是否有结束标记
                    if (blockMarkers[blockType].end.test(blockLine)) {
                        nestedLevel--;
                    }
                    
                    fullBlock.push(blockLine);
                }
                
                // 将整个语句块组合成一个命令字符串,如果语句之间需要增加分号;请调整
                // 例如：for i in 1 2 3; do\n echo $i\n echo "hi"\n done
                // 会被组合成：for i in 1 2 3; do echo $i; echo "hi"; done
                // 即do / then / { 结尾时与下一行开头之间不需要增加分号，而命令之间需要增加分号
                console.log('[read-block] raw: ', fullBlock);
                let blockCommand = ''; // fullBlock.join('\n').replaceAll('\n', ' ');
                for(let j = 0; j < fullBlock.length; j++) {
                    if(fullBlock[j].endsWith(';')) {
                        blockCommand += fullBlock[j];
                        continue;
                    }
                    if(fullBlock[j].endsWith('{') 
                        || fullBlock[j].endsWith('then')
                        || fullBlock[j].endsWith('do')) {
                        blockCommand += fullBlock[j] + ' ';
                    }else{
                        blockCommand += fullBlock[j] + ';';
                    }
                }

                console.log(`[read-block] oneline: ${blockCommand}`);
                
                try {
                    const result = await this.executeCommand(blockCommand);
                    if (result && result.success === false) {
                        lastResult = result;
                    }
                } catch (error) {
                    console.error(`Error executing block starting at line ${i - fullBlock.length}:`, error);
                    if (this.stdout) {
                        this.stdout.writeln(`sh: 语句块执行错误: ${error.message}`);
                    }
                    lastResult = { success: false, error: error.message };
                }
            } else {
                // 单行命令直接执行
                try {
                    console.log(`[debug] executing line: ${line}`);
                    const result = await this.executeCommand(line);
                    if (result && result.success === false) {
                        lastResult = result;
                    }
                } catch (error) {
                    this.stdout.writeln(`Error executing line ${i}: ${line}`, error);
                    if (this.stdout) {
                        this.stdout.writeln(`sh: Error executing line ${i}: ${line} ${error.message}`);
                    }
                    lastResult = { success: false, error: error.message };
                }
            }
        }
        
        return lastResult.success ? 0 : 1;
    }
    _help() {
        this.stdout.writeln('简易Shell解释器（支持 assign / if / for / while / case / function）');
        this.stdout.writeln('输入命令或输入 exit 退出');
        this.stdout.writeln('示例命令：');
        this.stdout.writeln('  name="shell language"; echo "hello, $name"');
        this.stdout.writeln('  a=10; if [ $a -eq 10 ]; then echo "a is 10"; else echo "no"; fi');
        this.stdout.writeln('  for i in 1 2 3; do echo $i; done');
        this.stdout.writeln('  i=0;while [ $i -lt 3 ];do echo $i;i=$((i+1));done');
        this.stdout.writeln('  function greet(){ echo "hi, $1 !"}; greet "shell-script" ');
    }
    prompt(content = ''){
        const path = this.state.cwd;
        let promptContent = '\x1b[36m' + `[shell@localhost] ${path} $ ` + '\x1b[0m';
        if(isBrowser){
            this.stdout.setPrompt(promptContent);
            this.stdout.write(promptContent + content);
        }else{
            rl.prompt();
        }
    }
    async startREPL() {
        this.running = true;
        this._help();
        this.prompt();
        while (this.running) {
            // 然后等待用户输入
            const input = await this.stdin.readline();

            // Execute: 执行用户输入
            let ret = await this.executeCommand(input);

            // Print: 打印执行结果（如果有）
            if (ret) {
                this.stdout.writeln('ret:' + ret);
            }

            // Loop again
            this.prompt();
        }
        this.stdout.writeln('sh: bye.');
        return 0;
    }
}

// 暴露到全局作用域
async function sh(ctx={}) {
    let args = ctx.args || {};
    // 处理参数
    if (isNode && !Array.isArray(args)) {
        args = process.argv.slice(2); // Node.js环境下获取命令行参数
    }
    console.log('[debug] sh args:', args);
    const shell = new Shell(ctx);
    if(isNode){
        if(args.includes('-d')){
            // node环境默认关闭调试模式
            shell.stdout.writeln('[debug] sh: debug mode.');
            //删除args中的-d
            args = args.filter(arg => arg !== '-d');
            ctx.args = args;
        }else{
            console.log = () => {}; // 非调试模式下，屏蔽console.log
        }
    }
    // 处理不同的执行模式
    if (args.length === 0) {
        // 情况1: 无参数 - 启动交互式REPL
        return await shell.startREPL();
    } else if (args[0] === '-c' && args.length > 1) {
        // 情况2: sh -c 'command' - 执行指定的命令字符串
        const commandString = args.slice(1).join(' ');
        console.log(`[debug] sh -c [${commandString}]`);
        return await shell.executeCommand(commandString);
    } else {
        // 情况3: sh script.sh - 读取并执行脚本文件
        const scriptPath = args[0];
        shell.stdout.writeln(`[info] sh: executing script: ${scriptPath}`);
        
        try {
            // 尝试从文件系统读取脚本文件
            let fileContent = null;
            
            // 优先使用os.fs
            if (typeof os !== 'undefined' && os.fs && os.fs.read) {
                fileContent = os.fs.read(scriptPath);
            }
            // Node.js环境使用fs模块
            else if (isNode && fs) {
                try {
                    fileContent = fs.readFileSync(scriptPath, 'utf8');
                } catch (e) {
                    shell.stdout.writeln(`sh: 无法读取文件 ${scriptPath}: ${e.message}`);
                    return 1;
                }
            }
            
            if (fileContent) {
                // 读取成功，执行脚本内容
                return await shell.executeScript(fileContent);
            } else {
                shell.stdout.writeln('sh: 无法访问文件系统');
                return 2;
            }
        } catch (error) {
            // 捕获其他异常
            shell.stdout.writeln(`sh: 执行脚本时出错: ${error.message}`);
            return 3;
        }
    }
}

// 兼容不同模块系统
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS 模块系统 (Node.js)
    module.exports = { Shell, sh };
    // 如果直接通过node执行此脚本
    if (require.main === module) {
        (async () => {
            console.log('[node] start sh.js ...');
            let ret = await sh(process.argv.slice(2));
            originConsole.log(`sh: exited with ${ret? 'error' : 'success'}`);
            process.exit(0);
        })();
    }
}

if (isBrowser && typeof window !== 'undefined') {
    // 浏览器环境
    window.Shell = Shell;
    window.sh = sh;
}

/**
 * Shell解释器模块 - 可在jsos终端中通过sh命令启动，同时支持Node.js环境
 * 依赖：
 * 1. Node.js环境下需要fs模块进行文件操作
 * 2. 浏览器环境下需要os.terminal对象进行输出和os.fs模块进行文件操作
 */

// 检测运行环境
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const isBrowser = typeof window !== 'undefined';
let stdout = '';
// Node.js环境下的依赖
let fs = null;
if (isNode) {
    try {
        fs = require('fs');
    } catch (e) {
        console.warn('Node.js fs module not available');
    }
}

let log = {
    debug: (msg) => console.debug('[debug]', msg),
    // 黄色输出
    info: (msg) => console.info('\x1b[33m[info]\x1b[0m', msg),
    // 红色输出
    error: (msg) => console.error('\x1b[31m[error]\x1b[0m', msg),
}
if(isBrowser){
    log = {
        // 蓝色输出
        debug: (msg) => os.terminal.writeln(`\x1b[34m[debug]\x1b[0m ${msg}`),
        // 绿色输出
        info: (msg) => os.terminal.writeln(`\x1b[32m[info]\x1b[0m ${msg}`),
        // 红色输出
        error: (msg) => os.terminal.writeln(`\x1b[31m[error]\x1b[0m ${msg}`),
    }
}

class Shell {
    constructor(debug=false) {
        console.log('[debug] new Shell(debug=%s)', debug);
            // 设置terminal
        if(typeof window !== 'undefined'){
            this.terminal = os.terminal;
        }else{
            this.terminal = {};
            this.terminal.writeln = (str) => {
                stdout += str + '\n';
            };
        }
        this.state = {
            cwd: '/home/user',
            env: { USER: 'user', HOME: '/home/user', PATH: '/bin:/usr/bin' },
            variables: {},
            functions: {},
            history: [],
            debug: debug
        };
        
        this.commands = this._createCommands();
        this.running = false;
    }
    
    _createCommands() {
        const commands = {
            sh: async (args) => await sh(args),
            help: async (args) => {
                return this._help(args);
            },
            true: async (args) => 0,
            false: async (args) => 1,
            test: (args) => {
                // 模拟实现test命令的主要功能
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
                    console.log(`[debug] Error in test command:`, e);
                    result = false;
                }
                
                // 根据用户要求：成功时返回空字符串，失败时返回非空字符串
                console.log(`[debug] test result: ${result}`);
                return result ? '' : 'false';
            },
            echo: (args) => {
                console.log('[debug] echo args:', args);
                this.terminal.writeln(args.join(' '));
            },
            env: () => {
                this.terminal.writeln(Object.entries(this.state.env).map(([k, v]) => `${k}=${v}`).join('\n'));
            },
            set: (args) => {
                console.log('[debug] set args:', args);
                // 无参数时显示所有变量和函数定义
                if (args.length === 0) {
                    this.terminal.writeln(Object.entries(this.state.variables).map(([k, v]) => `${k}=${v}`).join('\n'));
                    this.terminal.writeln(Object.entries(this.state.functions).map(([k, v]) => `${k}()={${v}}`).join('\n'));
                    return;
                }
        
                // 有参数时设置变量args = ['a', '=', '123']
                // 检查参数格式是否正确
                if (args.length !== 3 || args[1] !== '=') {
                    return log.error('set: 错误的参数格式，正确格式为: set 变量名=值');
                }
                const key = args[0];
                const value = args[2];
                if (key && value) this.state.variables[key] = value;
            },
            pwd: () => this.terminal.writeln(this.state.cwd),
            ls: (args) => {
                try {
                    // 优先使用os.fs
                    if(typeof os !== 'undefined'){
                        if(args.length)
                            return this.terminal.writeln(os.fs.ls(args[0]));
                        else
                            return this.terminal.writeln(os.fs.ls(this.state.cwd));
                    }
                    // Node.js环境使用fs模块
                    else if (isNode && fs) {
                        const path = args[0] || this.state.cwd;
                        try {
                            const files = fs.readdirSync(path);
                            return this.terminal.writeln(files.join('  '));
                        } catch (e) {
                            return this.terminal.writeln(`ls: 无法访问 ${path}: ${e.message}`);
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
            cat: (args) => {
                if (!args[0]) return 'cat: 缺少文件名';
                const fileName = args[0];
                try {
                    // 优先使用os.fs
                    if(typeof os !== 'undefined' && os.fs && os.fs.read) {
                        return this.terminal.writeln(os.fs.read(fileName));
                    }
                    // Node.js环境使用fs模块
                    else if (isNode && fs) {
                        try {
                            return this.terminal.writeln(fs.readFileSync(fileName, 'utf8'));
                        } catch (e) {
                            return this.terminal.writeln(`cat: 无法读取文件 ${fileName}: ${e.message}`);
                        }
                    }
                } catch (e) {
                    return this.terminal.writeln(`cat: 错误: ${e.message}`);
                }
                return this.terminal.writeln(`cat: 无法读取文件 ${fileName}`);
            },
            cd: (args) => {
                if (!args[0]) return this.state.env.HOME;
                this.state.cwd = args[0].startsWith('/') ? args[0] : `${this.state.cwd}/${args[0]}`;
                return '';
            },
            export: (args) => {
                const [key, value] = args[0].split('=');
                if (key && value) this.state.env[key] = value;
                return '';
            },
            exit: () => {
                this.running = false;
                return 'Exiting shell...';
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
            { regex: /^([\w\-\.\/]+)=(.*?)(?=\s|;|$)/, type: 'assignment', extract: [1, 2] },
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
        constructor(state, commands) {
            this.state = state;
            this.commands = commands;
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
                    const shell = this.state.variables._shell;
                    if (!shell) {
                        return `error: shell instance not available`;
                    }
                    
                    console.log(`[debug] Function body: ${funcBody}`);
                    const tokens = shell.tokenize(funcBody);
                    // Parser类是Shell类的内部类，需要正确访问
                    // 创建一个新的Parser实例
                    const parser = new shell.Parser(tokens, this.state);
                    const funcAst = parser.parse();
                    console.log(`[debug] Function AST:`, funcAst);
                    
                    // 确保执行结果能够正确返回
                    const result = await this.execute(funcAst);
                    console.debug(`[debug] Function ${ast.name} execution result:`, result);
                    return result || '';
                } catch (e){
                    log.error(`[exec] Error in function ${ast.name}: ${e.message}`);
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
                            let exprWithValues = expr.replace(/\b[a-zA-Z_]\w*\b/g, (match) => {
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
        
        // 执行test命令并返回布尔值结果
        async executeTestCommand(args) {
            console.log('[debug] executeTestCommand args:', args);
            
            // 模拟实现test命令的主要功能
            // 现在不需要这个方法了，因为我们直接使用内置的test命令
            // 但保留它以保持兼容性
            return false;
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
        
        executeCase(ast) {
            const value = this.state.variables[ast.discriminant] || ast.discriminant;
            for (const caseBlock of ast.cases) {
                if (caseBlock.test === value) {
                    return this.execute({ type: 'Program', body: caseBlock.consequent });
                }
            }
            return '';
        }
        
        async executeCommand(ast) {
            // todo: 处理变量赋值, 如: var=10, 或 var=$(echo 10)
            if (ast.name.startsWith('$')) {
                if (ast.name.includes('=')) {
                    const [varRef, value] = ast.name.split('=', 2);
                    const varName = varRef.substring(1);
                    this.state.variables[varName] = value;
                    return '';
                }
            }
            
            if (!ast.name || !this.commands[ast.name]) {
                log.error(`sh: command not found: ${ast.name}`);
                return !ast.name ? 'error: Empty command' : `error: command not found: ${ast.name}`;
            }
            
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
                            try {
                                const expr = arg.slice(3, -2).trim();
                                let exprWithValues = expr.replace(/\b[a-zA-Z_]\w*\b/g, (match) => {
                                    return this.state.variables[match] || 0;
                                });
                                const result = eval(exprWithValues);
                                return String(result);
                            } catch (e) {
                                return '';
                            }
                        }
                        // 处理$变量引用
                        const varName = arg.substring(1);
                        return this.state.variables[varName] || this.state.variables[arg] || arg;
                    }
                    // 对于普通字符串参数，直接返回，不进行变量替换
                    return arg;
                });
                
                let retcode = await this.commands[ast.name](processedArgs);
                console.log(`[exec] Command ${ast.name} retcode: ${retcode}`);
                return retcode;
            } catch (e) {
                return `error: ${e.message}`;
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
            const ParserClass = Function('return this.Parser;').call(this);
            const parser = new ParserClass(tokens, this.state);
            const ast = parser.parse();
            
            // step 3: execute AST
            const ExecutorClass = Function('return this.Executor;').call(this);
            // 将shell实例传递给executor，以便在函数中访问tokenize方法
            this.state.variables._shell = this;
            const executor = new ExecutorClass(this.state, this.commands);
            let ret = await executor.execute(ast);
            // console.log(input, 'ret: ', ret);
            return ret || '';
        } catch (e) {
            return `error: ${e.message}`;
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
                    if (this.terminal) {
                        this.terminal.writeln(`sh: 语句块执行错误: ${error.message}`);
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
                    console.error(`Error executing line ${i}: ${line}`, error);
                    if (this.terminal) {
                        this.terminal.writeln(`sh: 第${i}行出错: ${error.message}`);
                    }
                    lastResult = { success: false, error: error.message };
                }
            }
        }
        
        return lastResult;
    }
    _help() {
        this.terminal.writeln('简易Shell解释器（支持 assign / if / for / while / case / function）');
        this.terminal.writeln('输入命令或输入 exit 退出');
        this.terminal.writeln('示例命令：');
        this.terminal.writeln('  name="shell language"; echo "hello, $name"');
        this.terminal.writeln('  a=10; if [ $a -eq 10 ]; then echo "a is 10"; else echo "no"; fi');
        this.terminal.writeln('  for i in 1 2 3; do echo $i; done');
        this.terminal.writeln('  i=0;while [ $i -lt 3 ];do echo $i;i=$((i+1));done');
        this.terminal.writeln('  function greet(){ echo "hi, $1 !"}; greet "shell-script" ');
    }
    // 启动REPL
    async startREPL() {
        // this.xterm.onData函数用来重新设置keyboardInputHandler
        this.running = true;
        this._help();
        const shell = this;
        if (this.running) {
            // 检查getPrompt方法是否存在
            const originalPrompt = this.terminal.getPrompt();
            const originalOnCommand = this.terminal.onCommand;
            // 检查并设置shell提示符
            if (this.terminal && typeof this.terminal.setPrompt === 'function') {
                this.terminal.setPrompt('shell > ');
            }
            // 事件驱动的函数回调
            this.terminal.onCommand = async function(command) {
                if (command.trim() === 'exit') {
                    shell.running = false;
                    shell.terminal.setPrompt(originalPrompt);
                    shell.terminal.onCommand = originalOnCommand;
                    return 'exit';
                }
                return await shell.executeCommand(command);
            };

        }
    }
}

// 暴露到全局作用域
async function sh(args, terminal) {
    console.log('[debug] sh args:', args);
    // 处理参数
    if (isNode && !Array.isArray(args)) {
        args = process.argv.slice(2); // Node.js环境下获取命令行参数
    }
    
    const shell = new Shell();
    
    // 处理不同的执行模式
    if (args.length === 0) {
        // 情况1: 无参数 - 启动交互式REPL
        return await shell.startREPL();
    } else if (args[0] === '-c' && args.length > 1) {
        // 情况2: sh -c 'command' - 执行指定的命令字符串
        // 连接从第2个参数开始的所有参数作为命令字符串
        const commandString = args.slice(1).join(' ');
        console.log(`[debug] sh -c: executing command: ${commandString}`);
        return await shell.executeCommand(commandString);
    } else {
        // 情况3: sh script.sh - 读取并执行脚本文件
        const scriptPath = args[0];
        console.log(`[debug] sh: executing script: ${scriptPath}`);
        
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
                    if (terminal && typeof terminal.writeln === 'function') {
                        terminal.writeln(`sh: 无法读取文件 ${scriptPath}: ${e.message}`);
                    } else {
                        console.error(`sh: 无法读取文件 ${scriptPath}: ${e.message}`);
                    }
                    return { success: false, error: e.message };
                }
            }
            
            if (fileContent) {
                // 读取成功，执行脚本内容
                return await shell.executeScript(fileContent);
            } else {
                if (terminal) {
                    terminal.writeln('sh: 无法访问文件系统');
                }
                return { success: false, error: 'File system not available' };
            }
        } catch (error) {
            // 捕获其他异常
            if (terminal) {
                terminal.writeln(`sh: 执行脚本时出错: ${error.message}`);
            }
            return { success: false, error: error.message };
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
            await sh(process.argv.slice(2));
            console.log(stdout);
        })();
    }
}

if (isBrowser && typeof window !== 'undefined') {
    // 浏览器环境
    window.Shell = Shell;
    window.sh = sh;
}

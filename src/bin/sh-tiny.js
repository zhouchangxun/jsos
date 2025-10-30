/**
 * Shell解释器模块 - 可在jsos终端中通过sh命令启动
 */

class Shell {
    constructor(terminal, debug=false) {
        console.log('[debug] new Shell instance. stdout:', terminal || 'console');
        this.terminal = terminal;
        this.state = {
            cwd: '/home/user',
            env: { USER: 'user', HOME: '/home/user', PATH: '/bin:/usr/bin' },
            variables: {},
            history: [],
            debug: debug
        };
        
        this.commands = this._createCommands();
        this.running = false;
    }
    
    _createCommands() {
        const commands = {
            echo: (args) => {
                this.terminal.writeln(args.join(' '));
            },
            env: () => Object.entries(this.state.env).map(([k, v]) => `${k}=${v}`).join('\n'),
            set: (args) => {
                if (args.length === 0) {
                    return Object.entries(this.state.variables).map(([k, v]) => `${k}=${v}`).join('\n');
                }
                const [key, value] = args[0].split('=');
                if (key && value) this.state.variables[key] = value;
                return '';
            },
            pwd: () => this.state.cwd,
            ls: (args) => {
                if(os){
                    return os.fs.ls(this.state.cwd);
                }
                const dirs = ['docs', 'downloads', 'projects'];
                const files = ['readme.txt', 'notes.md'];
                return [...dirs, ...files].join('  ');
            },
            cat: (args) => {
                if (!args[0]) return 'cat: 缺少文件名';
                const fileName = args[0];
                if (os) {
                    return os.fs.cat(fileName).content;
                }
                return `cat: 无法读取文件 ${fileName}`;
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
            { regex: /^\$([\w_]+)/, type: 'variable', extract: 1 },
            { regex: /^([\w\-\.\/]+)=([\w\-\.\/]+|"[^"]*"|'[^']*')/, type: 'assignment', extract: [1, 2] },
            { regex: /^([\w\-\.\/]+)=(.*?)(?=\s|;|$)/, type: 'assignment', extract: [1, 2] },
            { regex: /^[\w\-\.\/]+/, type: 'identifier' },
            { regex: /^"([^"]*)"/, type: 'string' },
            { regex: /^'([^']*)'/, type: 'string' },
            { regex: /^`([^`]*)`/, type: 'command-substitution' },
            { regex: /^[<>]=?|==|!=/, type: 'operator' },
            { regex: /^\d+/, type: 'number' },
            { regex: /^[{}()]/, type: 'bracket' }
        ];
        
        const keywords = ['done', 'echo', 'case', 'esac', 'else', 'for', 'fi', 'if', 
                         'in', 'ls', 'pwd', 'cd', 'do', 'set', 'while', 'exit'];
        
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
            const statements = [];
            while (!this.eof()) {
                statements.push(this.parseStatement());
                
                while (!this.eof() && this.peek()?.type === 'semicolon') {
                    this.consume();
                    if (!this.eof()) {
                        statements.push(this.parseStatement());
                    }
                }
            }
            return { type: 'Program', body: statements };
        }
        
        parseStatement() {
            if (this.peek()?.type === 'semicolon') {
                this.consume();
            }
            
            const token = this.peek();
            
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
            
            switch (token?.value) {
                case 'if': return this.parseIf();
                case 'for': return this.parseFor();
                case 'while': return this.parseWhile();
                case 'case': return this.parseCase();
                default: return this.parseCommand();
            }
        }
        
        parseIf() {
            this.consume();
            const test = this.parseExpression();
            
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
            return { type: 'IfStatement', test, consequent, alternate };
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
            const test = this.parseExpression();
            
            while (!this.eof() && this.peek()?.type === 'semicolon') {
                this.consume();
            }
            
            if (!this.peek() || this.peek().value !== 'do') {
                throw new Error('Expected "do" keyword after while condition');
            }
            
            this.consume();
            const body = this.parseBlockUntil('done');
            this.consume();
            return { type: 'WhileStatement', test, body };
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
        
        execute(ast) {
            if (ast.type === 'Program') {
                console.log('Program body:', ast.body);
                return ast.body.map(stmt => this.execute(stmt)).filter(Boolean).join('\n');
            }
            switch (ast.type) {
                case 'ExpressionStatement': return this.executeExpression(ast);
                case 'IfStatement': return this.executeIf(ast);
                case 'ForStatement': return this.executeFor(ast);
                case 'WhileStatement': return this.executeWhile(ast);
                case 'CaseStatement': return this.executeCase(ast);
                case 'Command': return this.executeCommand(ast);
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
        
        executeIf(ast) {
            console.log('[debug] executeIf ast:', ast);
            const condition = this.evaluate(ast.test);
            if (condition) {
                return this.execute({ type: 'Program', body: ast.consequent });
            } else if (ast.alternate) {
                return this.execute({ type: 'Program', body: ast.alternate });
            }
            return '';
        }
        
        executeFor(ast) {
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
                    const result = this.execute({ type: 'Program', body: ast.body });
                    if (result && result !== '\n') {
                        results.push(result);
                    }
                } catch (e) {
                    results.push(`Error in loop body: ${e.message}`);
                }
            }
            
            return results.filter(Boolean).join('\n');
        }
        
        executeWhile(ast) {
            const output = [];
            let count = 0;
            while (this.evaluate(ast.test) && count < 100) {
                output.push(this.execute({ type: 'Program', body: ast.body }));
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
        
        executeCommand(ast) {
            if (ast.name.startsWith('$')) {
                if (ast.name.includes('=')) {
                    const [varRef, value] = ast.name.split('=', 2);
                    const varName = varRef.substring(1);
                    this.state.variables[varName] = value;
                    return '';
                }
            }
            
            if (!ast.name || !this.commands[ast.name]) {
                return !ast.name ? 'error: Empty command' : `error: command not found: ${ast.name}`;
            }
            
            try {
                const processedArgs = ast.args.map(arg => {
                    if (arg.startsWith('$')) {
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
                        const varName = arg.slice(1);
                        return this.state.variables[varName] || this.state.env[varName] || '';
                    }
                    return this.state.variables[arg] || this.state.env[arg] || arg;
                });
                
                return this.commands[ast.name](processedArgs);
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
            // debugger;
            let left = expr.left;
            let right = expr.right;
            if(expr.left.startsWith('$')){
                left = this.state.variables[expr.left.slice(1)];
            }
            if(expr.right.startsWith('$')){
                right = this.state.variables[expr.right.slice(1)];
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
            const tokens = this.tokenize(input);

            const ParserClass = Function('return this.Parser;').call(this);
            const parser = new ParserClass(tokens, this.state);
            const ast = parser.parse();
            
            const ExecutorClass = Function('return this.Executor;').call(this);
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
            'case': { start: /case\s+.*?;\s*in/i, end: /esac\s*$/i }
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
                
                // 将整个语句块组合成一个命令字符串
                const blockCommand = fullBlock.join('\n').replaceAll('\n', ' ');
                console.log(`[debug] executing block: ${blockCommand}`);
                
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
        this.terminal.writeln('简易Shell解释器（支持 if/for/while/case）');
        this.terminal.writeln('输入命令或输入 exit 退出');
        this.terminal.writeln('示例命令：');
        this.terminal.writeln('  name="shell lang"; echo "hello，$name"');
        this.terminal.writeln('  a=10; if a == 10; then echo "a is 10"; else echo "no"; fi');
        this.terminal.writeln('  for i in 1 2 3; do echo $i; done');
        this.terminal.writeln('  i=0; while i < 3; do echo $i; i=$((i+1)); done');
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
    if(os){
        terminal = os.terminal;
    }
    const shell = new Shell(terminal, true);
    
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
            let fs = null;
            if (os && os.fs) {
                fs = os.fs;
            } else {
                // 如果没有全局os对象，尝试从shell对象获取
                fs = shell.fs;
            }
            
            if (fs) {
                const result = fs.cat(scriptPath);
                
                if (result.success) {
                    // 读取成功，执行脚本内容
                    return await shell.executeScript(result.content);
                } else {
                    // 文件读取失败，输出错误信息
                    if (terminal) {
                        terminal.writeln(`sh: 无法读取文件 ${scriptPath}: ${result.error}`);
                    }
                    return { success: false, error: result.error };
                }
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

export { Shell, sh };
window.sh = sh;
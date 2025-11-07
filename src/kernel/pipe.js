class Pipe {
    constructor() {
        this.buffer = [];
        this.readResolve = null;
        this.isClosed = false;
    }
    async write(data) {
        if (this.isClosed) {
          console.log('broken pipe.')
          throw new Error('Pipe is closed');
        }
        console.log('write to pipe:', data);
        this.buffer.push(data);
        this.readResolve && (this.readResolve(this.buffer.shift()), this.readResolve = null);
    }
    async writeln(data) {
        return this.write(data);
    }
    async read() {
        if (this.isClosed && !this.buffer.length) return null;
        return this.buffer.length ? this.buffer.shift() : new Promise(resolve => this.readResolve = resolve);
    }
    async readline() {
        return await this.read();
    }
    close() {
      console.log('close pipe');
      this.isClosed = true;
      this.readResolve && (this.readResolve(null), this.readResolve = null);
    }
}


export default Pipe;
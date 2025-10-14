
import net from 'net';
import fs from 'fs';

// Protocol reference:
// https://github.com/dschanoeh/socketcand/blob/master/doc/protocol.md

const FRAME_LENGTH = 8; // bytes

class Parser {
    constructor(lexicon_file, debug = false) {
        this.lexicon = JSON.parse(fs.readFileSync(lexicon_file, 'utf8'));
        this.frameIds = this.lexicon.messages.map(m => m.id);
        this.debug = debug;
    }

    getFrameIds({messages = [], signals = []}) {
        if (messages.length > 0) {
            return this.frameIds.filter(id => {
                const decoder = this.lexicon.messages.find(m => m.id === id);
                return decoder && messages.includes(decoder.name);
            });
        }
        if (signals.length > 0) {
            return this.frameIds.filter(id => {
                const decoder = this.lexicon.messages.find(m => m.id === id);
                return decoder && decoder.signals && decoder.signals.some(s => signals.includes(s.name));
            });
        } else return this.frameIds;
    }

    parseFrame(frame) {
        // frame is a string like "frame [frame_id(x16)] [time] 00 1A F8 00 00 00 00 00"
        const words = frame.split(' ');

        if (words.length < 3 + FRAME_LENGTH || words[0] !== 'frame')
            throw new Error('Invalid frame format');

        const id = parseInt(words[1], 16);

        if (!this.frameIds.includes(id)) return null;

        const time = parseFloat(words[2]);
        const data = words.slice(3, 3 + FRAME_LENGTH).map(b => parseInt(b, 16));
        const decoder = this.lexicon.messages.find(m => m.id === id);

        if (this.debug)
            console.log(`Frame ${id}: ${data.map(b => b.toString(2).padStart(8, '0')).join(' ')}`);

        const result = { id: id, name: decoder.name, time: time, data: {} };
        if (decoder && decoder.signals) {
            for (const signal of decoder.signals) {

                if(!signal.is_big_endian)
                    throw new Error('Little-endian signals not yet supported');

                if(signal.signed)
                    throw new Error('Signed signals not yet supported');
                
                const start = 8*Math.floor(signal.start_bit / 8) + (7 - signal.start_bit % 8);
                const value = data.map(b  => b.toString(2).padStart(8, '0')).join('').slice(start, start + signal.bit_length);

                if (this.debug)
                    console.log(`${signal.name.padStart(20)}: ${value} ${parseInt(value, 2)}`);

                result.data[signal.name] = parseInt(value, 2) * signal.factor + signal.offset;
            }
        }
        return result;
    }
}

class Connection {
    constructor({
        host = 'localhost',
        port = 29536,
        channel = 'can0',
        frameIds = [],
        signals = [],
        messages = [],
        parser = null,
        debug = true
    } = {}) {
        this.host = host;
        this.port = port;
        this.channel = channel;
        this.frameIds = frameIds;
        this.debug = debug;

        if(parser && parser instanceof Parser) this.parser = parser;
        else if (typeof parser === 'string') this.parser = new Parser(parser, this.debug);
        else this.parser = null;

        if (this.parser && this.frameIds.length === 0)
            this.frameIds = this.parser.getFrameIds({ signals: signals, messages: messages });

        this.client = net.createConnection({ host: this.host, port: this.port }, () => {
            console.log('Connected to socketcand server');
            this.handshake();
        });

        this.client.on('data', (data) => {
            if (!this.client._msgBuffer) this.client._msgBuffer = '';
            this.client._msgBuffer += data.toString('utf8');

            let startIdx = 0;
            while (true) {
                let openIdx = this.client._msgBuffer.indexOf('<', startIdx);
                let closeIdx = this.client._msgBuffer.indexOf('>', openIdx + 1);
                if (openIdx !== -1 && closeIdx !== -1) {
                    let msg = this.client._msgBuffer.substring(openIdx + 1, closeIdx).trim();
                    this.client.emit('message', msg);
                    startIdx = closeIdx + 1;
                } else break;
            }
            // Keep any incomplete message in buffer
            this.client._msgBuffer = this.client._msgBuffer.slice(startIdx);
        });

        this.client.on('message', (msg) => {
            if (this.debug) console.log('SERVER:', msg);
            if (msg.startsWith('frame')) {
                this.client.emit('frame', msg);
                if (this.parser) {
                    const parsed = this.parser.parseFrame(msg);
                    if (parsed) this.client.emit('parsedFrame', parsed);
                }
            }
        });

        this.client.on('end', () => {
            console.log('Disconnected from socketcand server');
        });
    }

    sendMessage(msg) {
        if (this.debug) console.log('CLIENT:', msg);
        this.client.write(`< ${msg} >`);
    }

    sendMessageWithAck(msg, ackMsg, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const onMessage = (response) => {
                if (response === ackMsg) {
                    clearTimeout(timer);
                    this.client.removeListener('message', onMessage);
                    resolve(true);
                }
            };
            this.client.on('message', onMessage);
            this.sendMessage(msg);
            const timer = setTimeout(() => {
                this.client.removeListener('message', onMessage);
                reject(new Error('Timeout waiting for ack'));
            }, timeout);
        });
    }

    async handshake() {
        await this.sendMessageWithAck(`open ${this.channel}`, `ok`);
        console.log('CAN channel opened');

        for (const frameId of this.frameIds)
            this.sendMessage(`subscribe 0 0 ${frameId.toString(16)}`);
    }

    onParsedFrame(callback) {
        this.client.on('parsedFrame', callback);
    }

    onFrame(callback) {
        this.client.on('frame', callback);
    }

    close() {
        this.sendMessageWithAck(`close ${this.channel}`, `ok`).then(() => {
            console.log('CAN channel closed');
            this.client.end();
        });
    }

}

export { Connection, Parser };

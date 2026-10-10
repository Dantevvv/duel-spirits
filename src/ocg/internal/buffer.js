// Portado de ocgcore-wasm (MIT, Simone Miraglia)
export class BufferReader {
    view;
    off;
    static from(b) {
        return new BufferReader(new DataView(b, 0, b.byteLength));
    }
    constructor(view, off){
        this.view = view;
        this.off = off ?? 0;
    }
    get avail() {
        return this.view.byteLength - this.off;
    }
    reset() {
        this.off = 0;
    }
    sub(length) {
        if (this.avail < length) {
            throw new Error("eof");
        }
        const b = new BufferReader(new DataView(this.view.buffer, this.view.byteOffset + this.off, length), 0);
        this.off += length;
        return b;
    }
    bytes(length) {
        if (this.avail < length) {
            throw new Error("eof");
        }
        const bytes = this.view.buffer.slice(this.view.byteOffset + this.off, this.view.byteOffset + this.off + length);
        return new Uint8Array(bytes);
    }
    u8() {
        if (this.avail < 1) {
            throw new Error("eof");
        }
        const value = this.view.getUint8(this.off);
        this.off += 1;
        return value;
    }
    i8() {
        if (this.avail < 1) {
            throw new Error("eof");
        }
        const value = this.view.getInt8(this.off);
        this.off += 1;
        return value;
    }
    u16() {
        if (this.avail < 2) {
            throw new Error("eof");
        }
        const value = this.view.getUint16(this.off, true);
        this.off += 2;
        return value;
    }
    i16() {
        if (this.avail < 2) {
            throw new Error("eof");
        }
        const value = this.view.getInt16(this.off, true);
        this.off += 2;
        return value;
    }
    u32() {
        if (this.avail < 4) {
            throw new Error("eof");
        }
        const value = this.view.getUint32(this.off, true);
        this.off += 4;
        return value;
    }
    i32() {
        if (this.avail < 4) {
            throw new Error("eof");
        }
        const value = this.view.getInt32(this.off, true);
        this.off += 4;
        return value;
    }
    u64() {
        if (this.avail < 8) {
            throw new Error("eof");
        }
        const value = this.view.getBigUint64(this.off, true);
        this.off += 8;
        return value;
    }
    i64() {
        if (this.avail < 8) {
            throw new Error("eof");
        }
        const value = this.view.getBigInt64(this.off, true);
        this.off += 8;
        return value;
    }
}
export class BufferWriter {
    buffer;
    view;
    off;
    aligned;
    constructor(length = 64, aligned = false){
        this.buffer = new Uint8Array(length);
        this.view = new DataView(this.buffer.buffer);
        this.off = 0;
        this.aligned = aligned;
    }
    get(alignment = 0) {
        if (alignment > 0) this.align(alignment);
        return this.buffer.slice(0, this.off);
    }
    align(size) {
        const amount = (size - this.off % size) % size;
        this.grow(amount);
        this.off += amount;
    }
    grow(toAdd) {
        if (this.off + toAdd <= this.buffer.byteLength) {
            return;
        }
        const newBuffer = new Uint8Array(this.buffer.byteLength * 2);
        newBuffer.set(this.buffer, 0);
        this.buffer = newBuffer;
        this.view = new DataView(this.buffer.buffer);
    }
    bytes(bytes) {
        if (bytes instanceof ArrayBuffer) {
            this.grow(bytes.byteLength);
            this.buffer.set(new Uint8Array(bytes), this.off);
            this.off += bytes.byteLength;
        } else {
            this.grow(bytes.length);
            this.buffer.set(bytes, this.off);
            this.off += bytes.length;
        }
    }
    u8(value) {
        this.grow(1);
        this.view.setUint8(this.off, value);
        this.off += 1;
        return this;
    }
    i8(value) {
        this.grow(1);
        this.view.setInt8(this.off, value);
        this.off += 1;
        return this;
    }
    u16(value) {
        if (this.aligned) this.align(2);
        this.grow(2);
        this.view.setUint16(this.off, value, true);
        this.off += 2;
        return this;
    }
    i16(value) {
        if (this.aligned) this.align(2);
        this.grow(2);
        this.view.setInt16(this.off, value, true);
        this.off += 2;
        return this;
    }
    u32(value) {
        if (this.aligned) this.align(4);
        this.grow(4);
        this.view.setUint32(this.off, value, true);
        this.off += 4;
        return this;
    }
    i32(value) {
        if (this.aligned) this.align(4);
        this.grow(4);
        this.view.setInt32(this.off, value, true);
        this.off += 4;
        return this;
    }
    u64(value) {
        if (this.aligned) this.align(8);
        this.grow(8);
        this.view.setBigUint64(this.off, value, true);
        this.off += 8;
        return this;
    }
    i64(value) {
        if (this.aligned) this.align(8);
        this.grow(8);
        this.view.setBigInt64(this.off, value, true);
        this.off += 8;
        return this;
    }
}

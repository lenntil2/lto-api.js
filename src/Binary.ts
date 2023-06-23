import { Encoding, decode, encode } from './utils/encoder';
import { IBinary } from '../interfaces';
import { sha256 } from '@noble/hashes/sha256';
import { int16ToBytes, int32ToBytes } from './utils/bytes';

export default class Binary extends Uint8Array implements IBinary {
  constructor(value?: string | ArrayLike<number> | number) {
    if (typeof value === 'number') {
      super(value);
    } else {
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value || [];
      super(bytes);
    }
  }

  get base58(): string {
    return encode(this, Encoding.base58);
  }

  get base64(): string {
    return encode(this, Encoding.base64);
  }

  get hex(): string {
    return encode(this, Encoding.hex);
  }

  /** Create a SHA256 hash */
  hash(): Binary {
    return new Binary(sha256(new Uint8Array(this)));
  }

  toString(): string {
    return new TextDecoder().decode(this);
  }

  slice(start?: number, end?: number): Binary {
    return new Binary(super.slice(start, end));
  }

  reverse(): Binary {
    return new Binary(super.reverse());
  }

  static from(arrayLike: ArrayLike<number> | Iterable<number> | string): Binary;
  static from<T>(arrayLike: ArrayLike<T> | string, mapfn?: (v: T, k: number) => number, thisArg?: any): Binary {
    return new Binary(typeof arrayLike === 'string' ? arrayLike : super.from(arrayLike, mapfn, thisArg));
  }

  static fromBase58(value: string): Binary {
    return new Binary(decode(value, Encoding.base58));
  }

  static fromBase64(value: string): Binary {
    return new Binary(decode(value, Encoding.base64));
  }

  static fromHex(value: string): Binary {
    return new Binary(decode(value, Encoding.hex));
  }

  // Big Endian
  static fromInt16(value: number): Binary {
    return new Binary(int16ToBytes(value));
  }

  // Big Endian
  static fromInt32(value: number): Binary {
    return new Binary(int32ToBytes(value));
  }

  static concat(...items: Array<ArrayLike<number>>): Binary {
    const length = items.reduce((sum, item) => sum + item.length, 0);
    const merged = new Binary(length);

    let pos = 0;
    for (const item of items) {
      merged.set(item, pos);
      pos += item.length;
    }

    return merged;
  }
}

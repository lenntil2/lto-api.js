import { IBinary, IMessageJSON, TKeyType } from '../../interfaces';
import Binary from '../Binary';
import { Account, cypher } from '../accounts';
import { concatBytes } from '@noble/hashes/utils';
import { keyTypeFromId, keyTypeId } from '../utils/crypto';
import { base58 } from '@scure/base';
import {
  byteArrayToLong,
  byteArrayWithSizeToBytes,
  bytesToByteArrayWithSize,
  longToByteArray,
  stringToByteArrayWithSize,
} from '../utils/convert';

export default class Message {
  /** Type of the message */
  type?: string;

  /** Meta type of the data */
  mediaType?: string;

  /** Data of the message */
  data?: IBinary;

  /** Time when the message was signed */
  timestamp?: Date;

  /** Key and its type used to sign the event */
  sender?: { keyType: TKeyType; publicKey: IBinary };

  /** Signature of the message */
  signature?: IBinary;

  /** Address of the recipient */
  recipient?: string;

  /** Hash (see dynamic property) */
  private _hash?: IBinary;

  /** Encrypted data */
  private encryptedData?: IBinary;

  constructor(data: any, mediaType?: string, type = 'message') {
    this.type = type;

    if (typeof data === 'string') {
      this.mediaType = mediaType ?? 'text/plain';
      this.data = new Binary(data);
    } else if (data instanceof Binary) {
      this.mediaType = mediaType ?? 'application/octet-stream';
      this.data = data;
    } else {
      if (mediaType && mediaType !== 'application/json') throw new Error(`Unable to encode data as ${mediaType}`);

      this.mediaType = mediaType ?? 'application/json';
      this.data = new Binary(JSON.stringify(data));
    }
  }

  get hash(): Binary {
    return this._hash ?? new Binary(this.toBinary(false)).hash();
  }

  to(recipient: string | Account): Message {
    if (this.signature) throw new Error('Message is already signed');

    this.recipient = typeof recipient === 'string' ? recipient : recipient.address;
    return this;
  }

  encryptFor(recipient: Account): Message {
    if (this.signature) throw new Error('Message is already signed');

    this.recipient = recipient.address;
    this.encryptedData = recipient.encrypt(concatBytes(stringToByteArrayWithSize(this.mediaType), this.data));

    return this;
  }

  decryptWith(account: Account): Message {
    if (!this.encryptedData) throw new Error('Message is not encrypted');

    const content = account.decrypt(this.encryptedData);

    const mediaTypeLength = (content[0] << 8) | content[1];
    this.mediaType = content.slice(2, mediaTypeLength + 2).toString();
    this.data = content.slice(mediaTypeLength + 2);

    return this;
  }

  isEncrypted(): boolean {
    return !!this.encryptedData;
  }

  signWith(sender: Account): Message {
    this.timestamp ??= new Date();
    this.sender = { keyType: sender.keyType, publicKey: sender.signKey.publicKey };
    this.signature = sender.sign(this.toBinary(false));

    this._hash = this.hash;

    return this;
  }

  verifySignature(): boolean {
    if (!this.signature || !this.sender) throw new Error('Message is not signed');

    return cypher(this.sender).verifySignature(this.toBinary(false), this.signature);
  }

  verifyHash(): boolean {
    return this._hash === undefined || this._hash.hex === new Binary(this.toBinary(false)).hash().hex;
  }

  toBinary(withSignature = true): Uint8Array {
    if (!this.recipient) throw new Error('Recipient not set');
    if (!this.sender || !this.timestamp || (withSignature && !this.signature)) throw new Error('Message not signed');

    const data = this.encryptedData
      ? bytesToByteArrayWithSize(this.encryptedData)
      : concatBytes(stringToByteArrayWithSize(this.mediaType), bytesToByteArrayWithSize(this.data));

    return concatBytes(
      stringToByteArrayWithSize(this.type),
      Uint8Array.from([keyTypeId(this.sender.keyType)]),
      this.sender.publicKey,
      base58.decode(this.recipient),
      longToByteArray(this.timestamp.getTime()),
      Uint8Array.from([this.encryptedData ? 1 : 0]),
      data,
      withSignature ? this.signature : new Uint8Array(0),
    );
  }

  toJSON(): IMessageJSON {
    const base = {
      type: this.type,
      sender: this.sender ? { keyType: this.sender.keyType, publicKey: this.sender.publicKey.base58 } : undefined,
      recipient: this.recipient,
      timestamp: this.timestamp,
      signature: this.signature?.base58,
      hash: this.hash.base58,
    };

    return this.encryptedData
      ? { ...base, encryptedData: this.encryptedData?.base64 }
      : { ...base, mediaType: this.mediaType, data: this.data?.base64 };
  }

  static from(data: IMessageJSON | Uint8Array): Message {
    return data instanceof Uint8Array ? this.fromBinary(data) : this.fromJSON(data);
  }

  private static fromJSON(json: IMessageJSON): Message {
    const message: Message = Object.create(Message.prototype);

    message.type = json.type;
    message.sender = {
      keyType: json.sender.keyType,
      publicKey: Binary.fromBase58(json.sender.publicKey),
    };
    message.recipient = json.recipient;
    message.timestamp = json.timestamp instanceof Date ? json.timestamp : new Date(json.timestamp);
    message.signature = Binary.fromBase58(json.signature);
    message._hash = Binary.fromBase58(json.hash);

    if ('encryptedData' in json) {
      message.encryptedData = Binary.fromBase64(json.encryptedData);
    } else {
      message.mediaType = json.mediaType;
      message.data = Binary.fromBase64(json.data);
    }

    return message;
  }

  private static fromBinary(data: Uint8Array): Message {
    const message: Message = Object.create(Message.prototype);
    let offset = 0;

    const typeBytes = byteArrayWithSizeToBytes(data.slice(offset));
    message.type = new Binary(typeBytes).toString();
    offset += typeBytes.length + 2;

    const senderKeyType = data[offset++];
    const senderPublicKey = data.slice(offset, offset + 32);
    message.sender = { keyType: keyTypeFromId(senderKeyType), publicKey: new Binary(senderPublicKey) };
    offset += 32;

    message.recipient = base58.encode(data.slice(offset, offset + 26));
    offset += 26;

    message.timestamp = new Date(byteArrayToLong(data.slice(offset, offset + 8)));
    offset += 8;

    const encrypted = data[offset++] === 1;

    if (encrypted) {
      message.encryptedData = new Binary(byteArrayWithSizeToBytes(data.slice(offset)));
      offset += message.encryptedData.length + 2;
    } else {
      const mediaTypeBytes = byteArrayWithSizeToBytes(data.slice(offset));
      message.mediaType = new Binary(mediaTypeBytes).toString();
      offset += mediaTypeBytes.length + 2;

      message.data = new Binary(byteArrayWithSizeToBytes(data.slice(offset)));
      offset += message.data.length + 2;
    }

    const signature = data.slice(offset);
    if (signature.length > 0) message.signature = new Binary(signature);

    return message;
  }
}

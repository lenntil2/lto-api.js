import { base58 } from '@scure/base';
import { PublicNode } from '../node/';
import { ISigner, ITxJSON, TKeyType } from '../../interfaces';
import { getNetwork } from '../utils/crypto';

export default abstract class Transaction {
  public id?: string;
  public readonly type: number;
  public version: number;
  public fee: number;
  public timestamp?: number;
  public proofs: Array<string> = [];
  public sender?: string;
  public senderKeyType: TKeyType = 'ed25519';
  public senderPublicKey?: string;
  public sponsor?: string;
  public sponsorKeyType?: string;
  public sponsorPublicKey?: string;
  public height?: number;

  protected constructor(type: number, version: number, fee = 0) {
    this.type = type;
    this.version = version;
    this.fee = fee;
  }

  abstract toBinary(): Uint8Array;

  abstract toJSON(): ITxJSON;

  public isSigned(): boolean {
    return this.proofs.length != 0;
  }

  public signWith(account: ISigner): this {
    if (!this.timestamp) this.timestamp = Date.now();

    if (!this.sender) {
      this.sender = account.address;
      this.senderKeyType = account.keyType;
      this.senderPublicKey = account.publicKey;
    }

    const signature = account.sign(this.toBinary()).base58;

    if (!this.proofs.includes(signature)) this.proofs.push(signature);

    if (typeof (account as any).parent !== 'undefined' && !this.sponsor) {
      this.sponsorWith((account as any).parent);
    }

    return this;
  }

  public get chainId(): string {
    if (!this.sender) throw new Error('Chain id unknown');
    return getNetwork(this.sender);
  }

  public broadcastTo(node: PublicNode): Promise<this> {
    return node.broadcast(this);
  }

  public sponsorWith(sponsorAccount: ISigner): this {
    if (!this.isSigned()) throw new Error('Transaction must be signed first');

    if (this.sponsor) this.proofs.pop(); // The sponsor is replaced. The last proof is from the old sponsor.

    const signature = sponsorAccount.sign(this.toBinary());

    this.sponsor = sponsorAccount.address;
    this.sponsorPublicKey = sponsorAccount.publicKey;
    this.sponsorKeyType = sponsorAccount.keyType;
    this.proofs.push(base58.encode(signature));

    return this;
  }

  protected initFrom(data: ITxJSON): this {
    this.version = data.version;
    this.id = data.id;
    this.timestamp = data.timestamp;
    this.fee = data.fee;
    this.sender = data.sender;
    this.senderKeyType = data.senderKeyType ?? 'ed25519';
    this.senderPublicKey = data.senderPublicKey;

    if (data.sponsor) {
      this.sponsor = data.sponsor;
      this.sponsorKeyType = data.sponsorKeyType ?? 'ed25519';
      this.sponsorPublicKey = data.sponsorPublicKey;
    }

    this.proofs = data.proofs ?? [];
    this.height = data.height;

    return this;
  }
}

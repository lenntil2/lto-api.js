import { Transaction } from '../Transaction';
import { concatUint8Arrays } from '../../utils/concat';
import base58 from '../../libs/base58';
import convert from '../../utils/convert';
import crypto from "../../utils/crypto";


export { MassTransfer }

const TYPE: number = 11;
const DEFAULT_FEE: number = 100000000
const DEFAULT_VERSION: number = 3

class MassTransfer extends Transaction {

    transfers: any;
    attachment: string;
    type: number;
    baseFee: number;
    txFee: number;
    version: number;
    id: string;
    height: string;
    transferData: any;

    constructor(transfers: any, attachment: string = '') {
        super();
        this.transfers = transfers;
        this.attachment = attachment;
        this.type = TYPE
        this.baseFee = DEFAULT_FEE
        this.txFee = this.baseFee + Math.round(this.transfers.length * this.baseFee / 10)
        this.version = DEFAULT_VERSION

        this.transferData = new Uint8Array();
        for (let i = 0; i < transfers.length; i++) {
            this.transferData = concatUint8Arrays(this.transferData,
                base58.decode(transfers[i].recipient),
                Uint8Array.from(convert.longToByteArray(transfers[i].amount))
            )
        }


    }

    toBinaryV1() {
        return concatUint8Arrays(
            Uint8Array.from([this.type]),
            Uint8Array.from([this.version]),
            base58.decode(this.senderPublicKey),
            Uint8Array.from(convert.shortToByteArray(this.transfers.length)),
            this.transferData,
            Uint8Array.from(convert.longToByteArray(this.timestamp)),
            Uint8Array.from(convert.longToByteArray(this.txFee)),
            Uint8Array.from(convert.shortToByteArray(this.attachment.length)),
            Uint8Array.from(convert.stringToByteArray(this.attachment))
        )
    }
    toBinaryV3() {
        return concatUint8Arrays(
            Uint8Array.from([this.type]),
            Uint8Array.from([this.version]),
            Uint8Array.from(crypto.strToBytes(this.chainId)),
            Uint8Array.from(convert.longToByteArray(this.timestamp)),
            Uint8Array.from([1]),
            base58.decode(this.senderPublicKey),
            Uint8Array.from(convert.longToByteArray(this.txFee)),
            Uint8Array.from(convert.shortToByteArray(this.transfers.length)),
            this.transferData,
            Uint8Array.from(convert.shortToByteArray(this.attachment.length)),
            Uint8Array.from(convert.stringToByteArray(this.attachment))
        )
    }
    toBinary() {
        switch (this.version) {
            case 1:
                return this.toBinaryV1();
            case 3:
                return this.toBinaryV3();
            default:
                console.error("Incorrect version")
        }
    }
    toJson() {
        return (Object.assign({},
            {
                "type": this.type,
                "version": this.version,
                "sender": this.sender,
                "senderKeyType": this.senderKeyType,
                "senderPublicKey": this.senderPublicKey,
                "fee": this.txFee,
                "timestamp": this.timestamp,
                "proofs": this.proofs,
                "attachment": base58.encode(crypto.strToBytes(this.attachment)),
                "transfers": this.transfers
            }, this.sponsorJson()));
    }

    fromData(data) {
        var tx = new MassTransfer('');
        tx.type = data.type;
        tx.id = data.id ?? "";
        tx.version = data.version;
        tx.sender = data['sender'] ?? "";
        'senderKeyType' in data ? (tx.senderKeyType = data['senderKeyType']) : (tx.senderKeyType = "ed25519");
        tx.senderPublicKey = data['senderPublicKey'];
        data['fee'] ? (tx.txFee = data['fee']) : (tx.txFee = data['txFee']);
        tx.timestamp = data['timestamp'];
        tx.attachment = data['attachment'] ?? "";
        'proofs' in data ? (tx.proofs = data['proofs']) : (tx.proofs = []);
        tx.height = data['height'] ?? "";
        tx.transfers = data['transfers']
        if ('sponsorPublicKey' in data) {
            tx.sponsor = data['sponsor']
            tx.sponsorPublicKey = data['sponsorPublicKey']
        }
        return tx;
    }

}




import { expect } from 'chai';
//import { LTO } from '../dist/lto-api.min';
import { LTO } from '../src/LTO';
import base58 from "../src/libs/base58";

let lto;

describe('LTO', () => {

  beforeEach(() => {
    lto = new LTO();
  });

  describe('#createSeed', () => {
    it('should create a seed with ed keys', () => {
      const seed = lto.createSeed();

      expect(seed.phrase.split(' ')).have.length(15);
      expect(seed.keyPair.privateKey).have.length.gte(86);
      expect(seed.keyPair.publicKey).have.length.gte(43);
    });
  });

  describe('#seedFromExistingPhrase', () => {
    it('should create a keypair from a seed', () => {
      const phrase = 'satisfy sustain shiver skill betray mother appear pupil coconut weasel firm top puzzle monkey seek';

      const seed = lto.seedFromExistingPhrase(phrase);
      expect(seed.keyPair.privateKey).to.eq('4hPpf5Lbf5zTszcGLgHWwHdMgMAPAyteFQZt8cYCRqg4KC4byPYXRBzETvxECYGjrewzrUG1eKrfFdZAB3RZRvFw');
      expect(seed.keyPair.publicKey).to.eq('GuCK3Vaemyc3fUH94WUZ8tdQUZuG6YQmQBh93mu8E67F');
    });
  });

  describe('#encryptSeedPhrase / #decryptSeedPhrase', () => {
    it('should encrypt and decrypt phrase', () => {
      const phrase = 'satisfy sustain shiver skill betray mother appear pupil coconut weasel firm top puzzle monkey seek';
      const password = 'secretpassword';

      const encryptedPhrase = lto.encryptSeedPhrase(phrase, password);

      const decryptedPhrase = lto.decryptSeedPhrase(encryptedPhrase, password);
      expect(decryptedPhrase).to.eq(phrase);
    });
  });



  describe('#signEvent', () => {

    it('should sign an object and verify it', () => {
      const phrase = 'satisfy sustain shiver skill betray mother appear pupil coconut weasel firm top puzzle monkey seek';
      const seed = lto.seedFromExistingPhrase(phrase);

      const event = {
        body: 'somebody',
        timestamp: new Date(1520000000).toISOString(),
        previous: 'fake_hash',
        signkey: seed.keyPair.publicKey
      };

      const signature = lto.signEvent(event, seed.keyPair.privateKey);
      expect(signature).to.be.eq('4uw1LLMb9KLHGuzzKVpPUAHKLbVNM9VsXS9n971CusHPHZnxT9xzKEPPaFz2QpJRXkHipWrCtrfgAkz43Qmzx938');
    });
  });

  describe('#verifyEvent', () => {
    it('should return true if signature matches the object', () => {
      const phrase = 'satisfy sustain shiver skill betray mother appear pupil coconut weasel firm top puzzle monkey seek';
      const seed = lto.seedFromExistingPhrase(phrase);
      const event  = {
        body: 'somebody',
        timestamp: new Date(1520000000).toISOString(),
        previous: 'fake_hash',
        signkey: seed.keyPair.publicKey
      };

      const signature = '4uw1LLMb9KLHGuzzKVpPUAHKLbVNM9VsXS9n971CusHPHZnxT9xzKEPPaFz2QpJRXkHipWrCtrfgAkz43Qmzx938';

      const res = lto.verifyEvent(event, signature, seed.keyPair.publicKey);
      expect(res).to.be.true;
    });

    it('should return true if signature matches the object with random bytes', () => {
      const phrase = 'satisfy sustain shiver skill betray mother appear pupil coconut weasel firm top puzzle monkey seek';
      const seed = lto.seedFromExistingPhrase(phrase);
      const event  = {
        body: 'somebody',
        timestamp: new Date(1520000000).toISOString(),
        previous: 'fake_hash',
        signkey: seed.keyPair.publicKey
      };

      const signature = lto.signEvent(event, seed.keyPair.privateKey, true);

      const res = lto.verifyEvent(event, signature, seed.keyPair.publicKey);
      expect(res).to.be.true;
    });

    it('should return false if signature doesn\'t match the object', () => {
      const phrase = 'satisfy sustain shiver skill betray mother appear pupil coconut weasel firm top puzzle monkey seek';
      const seed = lto.seedFromExistingPhrase(phrase);
      const event = {
        body: 'somebody',
        timestamp: new Date(1520000000).toISOString(),
        previous: 'fake_hash',
        signkey: seed.keyPair.publicKey
      };

      const signature = 'RVxWjySPSgrvLJrAkaszbQHh5wmy89Uf9HKNeNCumQaiANiBtmDhZuj9WjSQPzJDVhGyyvvM1myCqdeuxQKQWcr';

      const res = lto.verifyEvent(event, signature, seed.keyPair.publicKey);
      expect(res).to.be.false;
    });

    it('should return false if signature doesn\'t match the object', () => {
      const phrase = 'satisfy sustain shiver skill betray mother appear pupil coconut weasel firm top puzzle monkey seek';
      const seed = lto.seedFromExistingPhrase(phrase);
      const event = {
        body: 'somebody',
        timestamp: new Date(1520000000).toISOString(),
        previous: 'fake_hash',
        signkey: seed.keyPair.publicKey
      };

      const signature = lto.signEvent(event, seed.keyPair.privateKey, true);

      const otherEvent = {
        body: 'otherbody',
        timestamp: new Date(1520000000).toISOString(),
        previous: 'fake_hash',
        signkey: seed.keyPair.publicKey
      };

      const res = lto.verifyEvent(otherEvent, signature, seed.keyPair.publicKey);
      expect(res).to.be.false;
    });
  });

  describe('#createEventId', () => {
    it('should create a valid transaction id', () => {

      const publicKey = 'GuCK3Vaemyc3fUH94WUZ8tdQUZuG6YQmQBh93mu8E67F';

      const transactionId = lto.createEventId(publicKey);

      expect(lto.verifyEventId(transactionId, publicKey)).to.be.true;
    })
  });

  describe('#hashEvent', () => {
    it('should generate a correct hash', () => {
      const event = {
        body: 'somebody',
        timestamp: new Date(1520000000).toISOString(),
        previous: 'fake_hash',
        signkey: 'GuCK3Vaemyc3fUH94WUZ8tdQUZuG6YQmQBh93mu8E67F'
      };

      expect(lto.hashEvent(event)).to.eq('FDTDMvFEQA7adTxF82N74dAJ3JKhJq8YdCHN4ip8p6jb');
    });
  })

  describe('#hashEventId', () => {
    it('should generate a correct hash', () => {
      const eventId = 'FDTDMvFEQA7adTxF82N74dAJ3JKhJq8YdCHN4ip8p6jb';

      expect(lto.hashEventId(eventId)).to.eq('25vni1Pwvoe8g1q881GaRvrAGwALDjGqqfh81SuVAhEk');
    });
  })
});
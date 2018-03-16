const privateKeys = require('./privateKeys.json');

const secp256k1 = require('secp256k1');
const createKeccakHash = require('keccak')

const sha3 = function (msg) {
  return createKeccakHash('keccak256').update(msg).digest()
}

const accountToBuffer = function (account) {
  return Buffer.from(account.secretKey.data);
}

const privateToPublic = function (privateKey) {
  return `0x04${secp256k1.publicKeyCreate(privateKey, false).slice(1).toString('hex')}`;
}

const publicToAddress = function (publicKey) {
  const publicKeyBuf = Buffer.from(publicKey.slice(2), 'hex');
  return `0x${sha3(publicKeyBuf.slice(1)).slice(-20).toString('hex')}`;
}

const publicToRepublic = function (publicKey) {
  const publicKeyBuf = Buffer.from(publicKey.slice(2), 'hex');
  // Prepend 0x04, hash, take first 32 bytes
  return `0x${sha3(publicKeyBuf).slice(0, 20).toString('hex')}`;
}

const ethaddrRegex = /[0-9A-Fa-f]{64}/g; // Finds all 64 character hex strings (ethereum private keys)
const accounts = (accounts) => {
  const priv = Object.keys(accounts).map(account => accountToBuffer(accounts[account]));
  const pubs = priv.map(key => privateToPublic(key));
  const addresses = pubs.map(pub => publicToAddress(pub));
  const repIds = pubs.map(pub => publicToRepublic(pub));

  const indexMap = {};

  const ret = [];
  for (let i = 0; i < priv.length; i++) {
    ret.push({
      private: priv[i],
      public: pubs[i],
      address: addresses[i],
      republic: repIds[i],
    })
    indexMap[repIds[i]] = i;
  }

  return {
    accounts: ret,
    indexMap: indexMap,
  };
}

module.exports = accounts(privateKeys.addresses);

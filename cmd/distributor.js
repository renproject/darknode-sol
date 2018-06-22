const Tx = require('ethereumjs-tx')
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("https://kovan.infura.io"));
const secretAccount = require('./secrets.json');
const deployer = require('./deployment.json');

distribute(process.argv[2]);

function distribute(value) {
    nonce = web3.eth.getTransactionCount(secretAccount.account);
    for (i = 0; i < deployer.configs.length; i++) {
        var tx = {
            gasPrice: web3.toHex(10 * web3.eth.gasPrice),
            gasLimit: web3.toHex(3000000),
            data: "0x",
            value: web3.toHex(value),
            nonce: web3.toHex(nonce + i),
            to: deployer.configs[i].config.keystore.ecdsa.address,
            from: secretAccount.account
        };
        var tx = new Tx(tx);
        tx.sign(Buffer.from(secretAccount.key, 'hex'));
        var stx = tx.serialize();

        web3.eth.sendRawTransaction('0x' + stx.toString('hex'), (err, hash) => {
            if (err) { console.log(err); return; }
        });
        console.log(`Transferred ${value} to ${deployer.configs[i].config.keystore.ecdsa.address}`);
    }
}
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("https://kovan.infura.io"));
const deployer = require('./deployment.json');

distribute(arguments[2]);

function getAccounts() {
    accounts = []
    for (config in deployer.configs) {
        accounts.push(config.keystore.ecdsa.address);
    }
    return accounts;
}

function distribute(value) {
    accounts = getAccounts();
    for (i = 0; i < accounts.lenth; i++) {
        web3.eth.sendTransaction({ to: accounts[i], value: value })
    }
}

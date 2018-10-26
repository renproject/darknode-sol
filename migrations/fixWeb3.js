module.exports = function fixWeb3(web3, artifacts) {
    global.web3 = web3;
    if (typeof global.web3.currentProvider.sendAsync !== "function") {
        global.web3.currentProvider.sendAsync = function () {
            return global.web3.currentProvider.send.apply(
                global.web3.currentProvider, arguments
            );
        };
    }

    global.web3.eth.contract = (contractABI) => {
        return {
            new: {
                getData: (...args) => {
                    const encoded = (new web3.eth.Contract(contractABI)).deploy({
                        data: args[args.length - 1].data,
                        arguments: args.slice(0, args.length - 1)
                    }).encodeABI();
                    return encoded;
                }
            }
        }
    }

    String.prototype.getNode = (callback) => callback(null, "TestRPC");

    global.artifacts = artifacts || {};
    global.artifacts.options = global.artifacts.options || {};
    global.artifacts.options.gasPrice = global.artifacts.options.gasPrice || 1;
}
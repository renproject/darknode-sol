const encodeCallData = (web3, functioName, parameterTypes, parameters) => {
    return web3.eth.abi.encodeFunctionSignature(`${functioName}(${parameterTypes.join(",")})`) +
        web3.eth.abi.encodeParameters(parameterTypes, parameters).slice(2);
};

module.exports = {
    encodeCallData,
};

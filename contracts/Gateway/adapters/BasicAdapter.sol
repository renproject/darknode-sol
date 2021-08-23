pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/GSN/GSNRecipient.sol";

import "../interfaces/IGateway.sol";
import "../interfaces/IGatewayRegistry.sol";

contract BasicAdapter is GSNRecipient {
    IGatewayRegistry registry;

    constructor(IGatewayRegistry _registry) public {
        GSNRecipient.initialize();
        registry = _registry;
    }

    function mint(
        // Payload
        string calldata _symbol,
        address _recipient,
        // Required
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(_symbol, _recipient));
        uint256 amount =
            registry.getGatewayBySymbol(_symbol).mint(
                payloadHash,
                _amount,
                _nHash,
                _sig
            );
        registry.getTokenBySymbol(_symbol).transfer(_recipient, amount);
    }

    function burn(
        string calldata _symbol,
        bytes calldata _to,
        uint256 _amount
    ) external {
        require(
            registry.getTokenBySymbol(_symbol).transferFrom(
                _msgSender(),
                address(this),
                _amount
            ),
            "token transfer failed"
        );
        registry.getGatewayBySymbol(_symbol).burn(_to, _amount);
    }

    // GSN functions

    function acceptRelayedCall(
        address relay,
        address from,
        bytes calldata encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    ) external view returns (uint256, bytes memory) {
        return _approveRelayedCall();
    }

    // We won't do any pre or post processing, so leave _preRelayedCall and _postRelayedCall empty
    function _preRelayedCall(bytes memory context) internal returns (bytes32) {}

    function _postRelayedCall(
        bytes memory context,
        bool,
        uint256 actualCharge,
        bytes32
    ) internal {}
}

pragma solidity 0.5.16;

import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

import "../IShifter.sol";
import "../IShifterRegistry.sol";

contract BasicAdapter is GSNRecipient {
    IShifterRegistry registry;

    constructor(IShifterRegistry _registry) public {
        registry = _registry;
    }

    function shiftIn(
        // Payload
        string calldata _symbol,
        address _recipient,
        // Required
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(_symbol, _recipient));
        uint256 amount = registry.getShifterBySymbol(_symbol).shiftIn(
            payloadHash,
            _amount,
            _nHash,
            _sig
        );
        registry.getTokenBySymbol(_symbol).transfer(_recipient, amount);
    }

    function shiftOut(
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
        registry.getShifterBySymbol(_symbol).shiftOut(_to, _amount);
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

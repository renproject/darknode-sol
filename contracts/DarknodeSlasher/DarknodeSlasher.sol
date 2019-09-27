pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../DarknodeRegistry/DarknodeRegistry.sol";

/// @notice DarknodeSlasher will become a voting system for darknodes to
/// deregister other misbehaving darknodes.
/// Right now, it is a placeholder.
contract DarknodeSlasher is Ownable {

    DarknodeRegistry public darknodeRegistry;

    // Malicious Darknodes can be slashed for each height and round
    // mapping of height -> round -> guilty address -> slashed
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public slashed;

    constructor(DarknodeRegistry _darknodeRegistry) public {
        darknodeRegistry = _darknodeRegistry;
    }

    function slash(address _guilty, address _challenger, uint256 _percentage)
        external
        onlyOwner
    {
        darknodeRegistry.slash(_guilty, _challenger, _percentage);
    }

    function blacklist(address _guilty) external onlyOwner {
        darknodeRegistry.slash(_guilty, owner(), 0);
    }

    function slashDuplicatePropose(
        uint256 _height,
        uint256 _round,
        bytes calldata _blockhash1,
        uint256 _validRound1,
        bytes calldata _signature1,
        bytes calldata _blockhash2,
        uint256 _validRound2,
        bytes calldata _signature2
    ) external {
        address signer = validateDuplicatePropose(
            _height,
            _round,
            _blockhash1,
            _validRound1,
            _signature1,
            _blockhash2,
            _validRound2,
            _signature2
        );
        require(!slashed[_height][_round][signer], "already slashed");
        darknodeRegistry.slash(signer, msg.sender, 50);
        slashed[_height][_round][signer] = true;
    }

    function validateDuplicatePropose(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash1,
        uint256 _validRound1,
        bytes memory _signature1,
        bytes memory _blockhash2,
        uint256 _validRound2,
        bytes memory _signature2
    ) public pure returns (address) {
        require(_validRound1 != _validRound2, "same valid round");
        address signer1 = recoverPropose(_height, _round, _blockhash1, _validRound1, _signature1);
        address signer2 = recoverPropose(_height, _round, _blockhash2, _validRound2, _signature2);
        require(signer1 == signer2, "different signer");
        return signer1;
    }

    function recoverPropose(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        uint256 _validRound,
        bytes memory _signature
    ) public pure returns (address) {
        return recover(sha256(proposeMessage(_height, _round, _blockhash, _validRound)), _signature);
    }

    function proposeMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        uint256 _validRound
    ) public pure returns (bytes memory) {
        return abi.encodePacked(
            "Propose(Height=", _uint2str(_height),
            ",Round=", _uint2str(_round),
            ",BlockHash=", string(_blockhash),
            ",ValidRound=", _uint2str(_validRound),
            ")"
        );
    }

    function _uint2str(uint _i) internal pure returns (string memory _uintAsString) { /* solium-disable-line security/no-assign-params */
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }


    /**
    * @dev Recover signer address from a message by using their signature
    * @param _hash bytes32 message, the hash is the signed message. What is recovered is the signer address.
    * @param _signature bytes signature, the signature is generated using web3.eth.sign()
    */
    function recover(bytes32 _hash, bytes memory _signature) public pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        // Check the signature length
        require(_signature.length == 65, "invalid sig length");

        // Divide the signature in r, s and v variables with inline assembly.
        assembly { /* solium-disable-line security/no-inline-assembly */
            r := mload(add(_signature, 0x20))
            s := mload(add(_signature, 0x40))
            v := byte(0, mload(add(_signature, 0x60)))
        }

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }

        // If the version is correct return the signer address
        require(v == 27 || v == 28, "incorrect sig version");

        // solium-disable-next-line arg-overflow
        return ecrecover(_hash, v, r, s);
    }

}

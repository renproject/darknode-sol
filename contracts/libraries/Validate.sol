pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../libraries/String.sol";

/// @notice Validate is a library for validating malicious darknode behaviour.
library Validate {

    /// @notice Recovers two propose messages and checks if they were signed by the same
    ///         darknode. If they were different but the height and round were the same,
    ///         then the darknode was behaving maliciously.
    /// @return The address of the signer if and only if propose messages were different
    function duplicatePropose(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash1,
        uint256 _validRound1,
        bytes memory _signature1,
        bytes memory _blockhash2,
        uint256 _validRound2,
        bytes memory _signature2
    ) internal pure returns (address) {
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
    ) internal pure returns (address) {
        return ECDSA.recover(sha256(proposeMessage(_height, _round, _blockhash, _validRound)), _signature);
    }

    function proposeMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        uint256 _validRound
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            "Propose(Height=", String.fromUint(_height),
            ",Round=", String.fromUint(_round),
            ",BlockHash=", string(_blockhash),
            ",ValidRound=", String.fromUint(_validRound),
            ")"
        );
    }

    function prevoteMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            "Prevote(Height=", String.fromUint(_height),
            ",Round=", String.fromUint(_round),
            ",BlockHash=", string(_blockhash),
            ")"
        );
    }

    function precommitMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            "Precommit(Height=", String.fromUint(_height),
            ",Round=", String.fromUint(_round),
            ",BlockHash=", string(_blockhash),
            ")"
        );
    }
}

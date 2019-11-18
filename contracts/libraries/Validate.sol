pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../libraries/String.sol";
import "../libraries/Compare.sol";

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
        require(!Compare.bytesEqual(_signature1, _signature2), "Validate: same signature");
        address signer1 = recoverPropose(_height, _round, _blockhash1, _validRound1, _signature1);
        address signer2 = recoverPropose(_height, _round, _blockhash2, _validRound2, _signature2);
        require(signer1 == signer2, "Validate: different signer");
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

    /// @notice Recovers two prevote messages and checks if they were signed by the same
    ///         darknode. If they were different but the height and round were the same,
    ///         then the darknode was behaving maliciously.
    /// @return The address of the signer if and only if prevote messages were different
    function duplicatePrevote(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash1,
        bytes memory _signature1,
        bytes memory _blockhash2,
        bytes memory _signature2
    ) internal pure returns (address) {
        require(!Compare.bytesEqual(_signature1, _signature2), "Validate: same signature");
        address signer1 = recoverPrevote(_height, _round, _blockhash1, _signature1);
        address signer2 = recoverPrevote(_height, _round, _blockhash2, _signature2);
        require(signer1 == signer2, "Validate: different signer");
        return signer1;
    }

    function recoverPrevote(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        bytes memory _signature
    ) internal pure returns (address) {
        return ECDSA.recover(sha256(prevoteMessage(_height, _round, _blockhash)), _signature);
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

    /// @notice Recovers two precommit messages and checks if they were signed by the same
    ///         darknode. If they were different but the height and round were the same,
    ///         then the darknode was behaving maliciously.
    /// @return The address of the signer if and only if precommit messages were different
    function duplicatePrecommit(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash1,
        bytes memory _signature1,
        bytes memory _blockhash2,
        bytes memory _signature2
    ) internal pure returns (address) {
        require(!Compare.bytesEqual(_signature1, _signature2), "Validate: same signature");
        address signer1 = recoverPrecommit(_height, _round, _blockhash1, _signature1);
        address signer2 = recoverPrecommit(_height, _round, _blockhash2, _signature2);
        require(signer1 == signer2, "Validate: different signer");
        return signer1;
    }

    function recoverPrecommit(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        bytes memory _signature
    ) internal pure returns (address) {
        return ECDSA.recover(sha256(precommitMessage(_height, _round, _blockhash)), _signature);
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

    function recoverSecret(
        uint256 _a,
        uint256 _b,
        uint256 _c,
        uint256 _d,
        uint256 _e,
        uint256 _f,
        bytes memory _signature
    ) internal pure returns (address) {
        return ECDSA.recover(sha256(secretMessage(_a, _b, _c, _d, _e, _f)), _signature);
    }

    function secretMessage(
        uint256 _a,
        uint256 _b,
        uint256 _c,
        uint256 _d,
        uint256 _e,
        uint256 _f
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            "Secret(",
            "ShamirShare(",
            String.fromUint(_a),
            ",", String.fromUint(_b),
            ",S256N(", String.fromUint(_c),
            "),",
            "S256PrivKey(",
            "S256N(", String.fromUint(_d),
            "),",
            "S256P(", String.fromUint(_e),
            "),",
            "S256P(", String.fromUint(_f),
            ")",
            ")",
            ")",
            ")"
        );
    }
}

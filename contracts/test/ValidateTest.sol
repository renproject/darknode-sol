pragma solidity 0.5.12;

import "../libraries/Validate.sol";

/// @notice Validate is a library for validating malicious darknode behaviour.
contract ValidateTest {

    function duplicatePropose(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash1,
        uint256 _validRound1,
        bytes memory _signature1,
        bytes memory _blockhash2,
        uint256 _validRound2,
        bytes memory _signature2
    ) public pure returns (address) {
        return Validate.duplicatePropose(
            _height,
            _round,
            _blockhash1,
            _validRound1,
            _signature1,
            _blockhash2,
            _validRound2,
            _signature2
        );
    }

    function recoverPropose(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        uint256 _validRound,
        bytes memory _signature
    ) public pure returns (address) {
        return Validate.recoverPropose(
            _height,
            _round,
            _blockhash,
            _validRound,
            _signature
        );
    }

    function duplicatePrevote(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash1,
        bytes memory _signature1,
        bytes memory _blockhash2,
        bytes memory _signature2
    ) public pure returns (address) {
        return Validate.duplicatePrevote(
            _height,
            _round,
            _blockhash1,
            _signature1,
            _blockhash2,
            _signature2
        );
    }

    function recoverPrevote(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        bytes memory _signature
    ) public pure returns (address) {
        return Validate.recoverPrevote(
            _height,
            _round,
            _blockhash,
            _signature
        );
    }

    function duplicatePrecommit(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash1,
        bytes memory _signature1,
        bytes memory _blockhash2,
        bytes memory _signature2
    ) public pure returns (address) {
        return Validate.duplicatePrecommit(
            _height,
            _round,
            _blockhash1,
            _signature1,
            _blockhash2,
            _signature2
        );
    }

    function recoverPrecommit(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        bytes memory _signature
    ) public pure returns (address) {
        return Validate.recoverPrecommit(
            _height,
            _round,
            _blockhash,
            _signature
        );
    }

    function proposeMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        uint256 _validRound
    ) public pure returns (bytes memory) {
        return Validate.proposeMessage(
            _height,
            _round,
            _blockhash,
            _validRound
        );
    }

    function prevoteMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash
    ) public pure returns (bytes memory) {
        return Validate.prevoteMessage(
            _height,
            _round,
            _blockhash
        );
    }

    function precommitMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash
    ) public pure returns (bytes memory) {
        return Validate.precommitMessage(
            _height,
            _round,
            _blockhash
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
    ) public pure returns (address) {
        return Validate.recoverSecret(
            _a,
            _b,
            _c,
            _d,
            _e,
            _f,
            _signature
        );
    }

    function secretMessage(
        uint256 _a,
        uint256 _b,
        uint256 _c,
        uint256 _d,
        uint256 _e,
        uint256 _f
    ) public pure returns (bytes memory) {
        return Validate.secretMessage(
            _a,
            _b,
            _c,
            _d,
            _e,
            _f
        );
    }
}

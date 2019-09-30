pragma solidity ^0.5.8;

import "../libraries/Validate.sol";

/// @notice Validate is a library for validating malicious darknode behaviour.
contract ValidateTest {

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
}

pragma solidity 0.5.16;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../IShifter.sol";
import "../IShifterRegistry.sol";
import "./ComposableShifter.sol";

/// @notice ConfirmationlessShifter is a wrapper around Shifter which allows
/// anyone to provide shifted tokens for a contract call to speed up an asset
/// being shifted in to Ethereum, in exchange for a fee.
/// If no RenVM mint signature is provided, then the tokens are taken from the
/// msg.sender. When the signature is eventually ready, the tokens are refunded
/// to the original msg.sender.
/// If the confirmationless provider lies about the amount or the fee, then they
/// forfeit being refunded once the signature is available.
/// In order to be compatible with the ConfirmationlessShifter, an adapter
/// just needs to:
///   1. accept a `IInShifter _shifter` as the first parameter to its
/// shift-in function.
///   2. be able to handle the same nHash twice (in case a malicious provider
///      submits the wrong amount)
///   3. Not validate the signature or the original `_amount` parameter
///      - the amount should instead be returned from calling `shiftIn` on the
///      shifter.
contract ConfirmationlessShifter is ComposableShifter {
    using SafeMath for uint256;

    constructor(IShifterRegistry _shifterRegistry, string memory _tokenSymbol)
        public
        ComposableShifter(_shifterRegistry, _tokenSymbol)
    {}

    event LogShiftInConfirmationless(
        address indexed _targetContract,
        bytes32 indexed _nHash,
        uint256 _confirmationFee,
        uint256 _amount,
        bool withSignature
    );

    uint256 constant BIPS_DENOMINATOR = 10000;

    mapping(bytes32 => address) public provider;

    function nonceIdentifier(
        uint256 _confirmationFee,
        uint256 _amount,
        bytes32 _nHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(_confirmationFee, _amount, _nHash));
    }

    function composeShiftIn(
        uint256 _confirmationFee,
        address _targetContract,
        bytes memory _targetCallBeforeNHash,
        bytes memory _targetCallAfterNHash,
        // Shifter parameters
        uint256 _amount,
        bytes32 _nHash,
        bytes memory _sig
    ) public {
        // Refund confirmationless provider
        if (
            provider[nonceIdentifier(_confirmationFee, _amount, _nHash)] !=
            address(0x0)
        ) {
            bytes32 payloadHash = keccak256(
                abi.encode(
                    _confirmationFee,
                    _targetContract,
                    _targetCallBeforeNHash,
                    _targetCallAfterNHash
                )
            );

            uint256 amount = shifterRegistry
                .getShifterBySymbol(tokenSymbol)
                .shiftIn(payloadHash, _amount, _nHash, _sig);

            shifterRegistry.getTokenBySymbol(tokenSymbol).transfer(
                provider[nonceIdentifier(_confirmationFee, _amount, _nHash)],
                amount
            );
        } else {
            uint256 amount;

            if (nHashShifted[_nHash]) {
                // TODO: Generate new nHash.
            }

            if (_sig.length == 0) {
                // Call contract using confirmationless provider's allowance

                uint256 shiftFee = shifterRegistry
                    .getShifterBySymbol(tokenSymbol)
                    .shiftInFee();

                uint256 absoluteFee = _amount.mul(shiftFee).div(
                    BIPS_DENOMINATOR
                );

                amount = _amount.sub(_confirmationFee).sub(absoluteFee);
                shifterRegistry.getTokenBySymbol(tokenSymbol).transferFrom(
                    msg.sender,
                    _targetContract,
                    amount
                );
                provider[nonceIdentifier(
                    _confirmationFee,
                    _amount,
                    _nHash
                )] = msg.sender;
            } else {
                // Shift in directly - no providers where involved.

                bytes32 payloadHash = keccak256(
                    abi.encode(
                        _confirmationFee,
                        _targetContract,
                        _targetCallBeforeNHash,
                        _targetCallAfterNHash
                    )
                );

                amount = shifterRegistry
                    .getShifterBySymbol(tokenSymbol)
                    .shiftIn(payloadHash, _amount, _nHash, _sig);

                shifterRegistry.getTokenBySymbol(tokenSymbol).transfer(
                    _targetContract,
                    amount
                );
            }

            emit LogShiftInConfirmationless(
                _targetContract,
                _nHash,
                _confirmationFee,
                _amount,
                _sig.length > 0
            );

            nHashShifted[_nHash] = true;
            nHashAmount[_nHash] = amount;

            bytes memory _targetCall = abi.encodePacked(
                _targetCallBeforeNHash,
                _nHash,
                _targetCallAfterNHash
            );

            return forwardCallAndReturn(_targetContract, _targetCall);
        }
    }
}

/// @dev Used to track deployments in Truffle.
contract BTCConfirmationlessShifter is ConfirmationlessShifter {
    constructor(IShifterRegistry _shifterRegistry)
        public
        ConfirmationlessShifter(_shifterRegistry, "zBTC")
    {}
}

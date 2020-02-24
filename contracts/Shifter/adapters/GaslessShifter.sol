pragma solidity 0.5.16;

import "../IShifter.sol";
import "../IShifterRegistry.sol";
import "./ComposableShifter.sol";

contract GaslessShifter is ComposableShifter {
    constructor(IShifterRegistry _shifterRegistry, string memory _tokenSymbol)
        public
        ComposableShifter(_shifterRegistry, _tokenSymbol)
    {}

    function composeShiftIn(
        address _targetContract,
        bytes memory _targetCall,
        // Shifter parameters
        uint256 _amount,
        bytes32 _nHash,
        bytes memory _sig
    ) public {
        bytes32 payloadHash = keccak256(
            abi.encode(_targetContract, _targetCall)
        );

        uint256 amount = shifterRegistry
            .getShifterBySymbol(tokenSymbol)
            .shiftIn(payloadHash, _amount, _nHash, _sig);

        nHashShifted[_nHash] = true;
        nHashAmount[_nHash] = amount;

        shifterRegistry.getTokenBySymbol(tokenSymbol).transfer(
            _targetContract,
            amount
        );

        return forwardCallAndReturn(_targetContract, _targetCall);
    }
}

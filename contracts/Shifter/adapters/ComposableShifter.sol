pragma solidity 0.5.16;

import "../IShifter.sol";
import "../IShifterRegistry.sol";

contract ComposableShifter is IInShifter {
    IShifterRegistry public shifterRegistry;
    string public tokenSymbol;

    mapping(bytes32 => bool) public nHashShifted;
    mapping(bytes32 => uint256) public nHashAmount;

    /// @notice The contract constructor.
    /// @param _shifterRegistry The Shifter registry contract address.
    constructor(IShifterRegistry _shifterRegistry, string memory _tokenSymbol)
        public
    {
        shifterRegistry = _shifterRegistry;
        tokenSymbol = _tokenSymbol;
    }

    function shiftIn(
        bytes32, /*_pHash*/
        uint256, /*_amount*/
        bytes32 _nHash,
        bytes memory /*_sig*/
    ) public returns (uint256) {
        require(nHashShifted[_nHash], "shift hasn't been submitted");
        return nHashAmount[_nHash];
    }

    function shiftInFee() public view returns (uint256) {
        return shifterRegistry.getShifterBySymbol(tokenSymbol).shiftInFee();
    }

    function forwardCallAndReturn(
        address _targetContract,
        bytes memory _targetCall
    ) internal {
        (bool success, bytes memory result) = _targetContract.call(_targetCall);
        if (success) {
            return;
        } else {
            revert(string(result));
            // // uint256 errorLength = result.length;
            // /* solium-disable-next-line security/no-inline-assembly */
            // assembly {
            //     let ptr := mload(0x0)

            //     // put function sig at memory spot
            //     mstore(ptr, result)

            //     revert(ptr, 10)
            // }
        }

        // assembly {
        //     // Copy msg.data. We take full control of memory in this inline assembly
        //     // block because it will not return to Solidity code. We overwrite the
        //     // Solidity scratch pad at memory position 0.
        //     let ptr := mload(0x0)

        //     // put function sig at memory spot
        //     mstore(ptr, _targetFunction)

        //     // append argument after function sig
        //     mstore(add(ptr, 0x04), _payloadBytes)

        //     // Call the implementation.
        //     // out and outsize are 0 because we don't know the size yet.
        //     let result := call(gas, implementation, 0, calldatasize, 0, 0)

        //     // Copy the returned data.
        //     returndatacopy(0, 0, returndatasize)

        //     switch result
        //         // delegatecall returns 0 on error.
        //         case 0 {
        //             revert(0, returndatasize)
        //         }
        //         default {
        //             return(0, returndatasize)
        //         }
        // }

    }
}

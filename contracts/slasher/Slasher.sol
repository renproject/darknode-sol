pragma solidity 0.5.17;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";
import "./IRenVMSignatureVerifier.sol";

/// @notice Slasher is responsible for the slashing of darknode bonds if certain
/// darknodes misbehave.
/// @dev This contract is intentionally written to be simple, key params not updatable
/// (like DNR, bond, and signer) and not upgradeable. As if we need to change any logic
/// we should be deploying a new slasher and updating the slasher on the DNR, and not
/// updating the logic here.
contract Slasher {
    using ECDSA for bytes32;

    // See IERC1271
    bytes4 constant CORRECT_SIGNATURE_RETURN_VALUE = 0x1626ba7e;

    DarknodeRegistryLogicV3 dnr;
    IRenVMSignatureVerifier renVMSignatureVerifier;
    uint256 challengeBond;

    mapping(bytes32 => mapping(uint8 => address)) challenged;
    mapping(bytes32 => mapping(address => address)) slashed;

    event Challenged(address _challenger, bytes32 _epochHash, uint32 _subnetID);

    constructor(
        DarknodeRegistryLogicV3 _dnr,
        IRenVMSignatureVerifier _renVMSignatureVerifier,
        uint256 _challengeBond
    ) public {
        dnr = _dnr;
        renVMSignatureVerifier = _renVMSignatureVerifier;
        challengeBond = _challengeBond;
    }

    /// @notice Allows any user to challenge the correctness of one of the RenVM subnets.
    /// @param _subnetID The subnet the user wants to challenge.
    /// @param _epochHash The epoch the user wants to challenge.
    function challenge(uint8 _subnetID, bytes32 _epochHash) public {
        require(
            challenged[_epochHash][_subnetID] == address(0x0),
            "Slasher: this epoch has already been challenged"
        );
        dnr.ren().transferFrom(msg.sender, address(this), challengeBond);
        challenged[_epochHash][_subnetID] = msg.sender;
        emit Challenged(msg.sender, _epochHash, _subnetID);
    }

    /// @notice Allows RenVM to slash misbehaving darknodes, by submitting a signature.
    ///         It rewards the challenger with half of the amount being slashed
    /// @param _darknodes the list of darknodes that need to be slashed.
    /// @param _percentages the list of percentages of bonds that need to be slashed.
    /// @param _challenger the address of the challenger.
    /// @param _subnetID The subnet the user wants to challenge.
    /// @param _epochHash The epoch the user wants to challenge.
    /// @param _signature The signature produced by RenVM.
    function slash(
        address[] calldata _darknodes,
        uint256[] calldata _percentages,
        address _challenger,
        uint8 _subnetID,
        bytes32 _epochHash,
        bytes calldata _signature
    ) external {
        require(
            renVMSignatureVerifier.isValidSignature(
                keccak256(
                    abi.encode(
                        _darknodes,
                        _percentages,
                        _challenger,
                        _epochHash
                    )
                ),
                _signature
            ) == CORRECT_SIGNATURE_RETURN_VALUE,
            "Slasher: invalid signature"
        );
        require(
            _darknodes.length == _percentages.length,
            "Slasher: invalid slash params"
        );
        for (uint256 i = 0; i < _darknodes.length; i++) {
            address darknode = _darknodes[i];
            require(
                slashed[_epochHash][darknode] == address(0x0),
                "Slasher: this epoch has already been slashed"
            );
            dnr.slash(_subnetID, darknode, _challenger, _percentages[i]);
            slashed[_epochHash][darknode] = _challenger;
        }
        dnr.ren().transfer(_challenger, challengeBond);
    }
}

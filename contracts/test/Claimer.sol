pragma solidity 0.5.16;

import "../Governance/Claimable.sol";

contract Claimer {
    Claimable child;

    constructor(Claimable _child) public {
        child = _child;
    }

    function transferStoreOwnership(address _newOwner) external {
        child.transferOwnership(_newOwner);
    }

    function claimStoreOwnership() external {
        child.claimOwnership();
    }

    function claimTokenOwnership() public {
        child.claimOwnership();
    }

    function transferTokenOwnership(address _newOwner) public {
        child.transferOwnership(address(_newOwner));
    }
}

pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title Claimable
 * @dev Extension for the Ownable contract, where the ownership needs to be claimed.
 * This allows the new owner to accept the transfer.
 */
contract Claimable is Ownable {

    address public pendingOwner;

    modifier onlyPendingOwner() {
        require(_msgSender() == pendingOwner, "Claimable: caller is not the pending owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != owner() && newOwner != pendingOwner, "Claimable: invalid new owner");
        pendingOwner = newOwner;
    }

    function claimOwnership() public onlyPendingOwner {
        _transferOwnership(pendingOwner);
        delete pendingOwner;
    }
}

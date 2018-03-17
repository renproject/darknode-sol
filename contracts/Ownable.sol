pragma solidity 0.4.18;

contract Ownable {

  address public owner;

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  /**
   * @notice The Ownable constructor sets the original owner of the contract to
   * the sender account.
   */
  function Ownable() public {
    owner = msg.sender;
  }

  /**
   * @notice Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @notice Allows the current owner to transfer control of the contract to a
   * new owner.
   *
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0));
    OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }
}
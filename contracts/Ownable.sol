pragma solidity ^0.4.21;

contract Ownable {

  address public owner;

  event OwnershipTransferred(address indexed _previousOwner, address indexed _newOwner);

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
   * @param _newOwner The address to transfer ownership to.
   */
  function transferOwnership(address _newOwner) public onlyOwner {
    require(_newOwner != address(0));
    owner = _newOwner;
    OwnershipTransferred(owner, _newOwner);
  }
}
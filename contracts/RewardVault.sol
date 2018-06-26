pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";

contract RewardVault is Ownable {
    using SafeMath for uint256;

    /**
      * @notice The special address for Ether.
      */
    address constant public ETHEREUM = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    DarknodeRegistry public darknodeRegistry;

    mapping(address => mapping(address => uint256)) public darknodeBalances;

    event DarknodeRegistryUpdated(DarknodeRegistry previousDarknodeRegistry, DarknodeRegistry nextDarknodeRegistry);    

    /**
      * @notice The constructor.
      *
      * @param _darknodeRegistry The DarknodeRegistry contract that is used by
      *                          the vault to lookup Darknode owners.
      */
    constructor(DarknodeRegistry _darknodeRegistry) public {
        darknodeRegistry = _darknodeRegistry;
    }

    function updateDarknodeRegistry(DarknodeRegistry _newDarknodeRegistry) public onlyOwner {
        emit DarknodeRegistryUpdated(darknodeRegistry, _newDarknodeRegistry);
        darknodeRegistry = _newDarknodeRegistry;
    }

    /**
      * @notice Deposit fees into the vault for a Darknode. The Darknode
      * registration is not checked (to reduce gas fees); the caller must be
      * careful not to call this function for a Darknode that is not registered
      * otherwise any fees deposited to that Darknode can be withdrawn by a
      * malicious adversary (by registering the Darknode before the honest
      * party and claiming ownership).
      *
      * @param _darknode The address of the Darknode that will receive the
      *                  fees.
      * @param _token The address of the ERC20 token being used to pay the fee.
      *               A special address is used for Ether.
      * @param _value The amount of fees in the smallest unit of the token.
      */
    function deposit(address _darknode, ERC20 _token, uint256 _value) public payable {
        if (address(_token) == ETHEREUM) {
            require(msg.value == _value);
        } else {
            require(_token.transferFrom(msg.sender, address(this), _value));
        }
        darknodeBalances[_darknode][_token] = darknodeBalances[_darknode][_token].add(_value);
    }

    /**
      * @notice Withdraw fees earned by a Darknode. The fees will be sent to
      * the owner of the Darknode. If a Darknode is not registered the fees
      * cannot be withdrawn.
      *
      * @param _darknode The address of the Darknode whose fees are being
      *                  withdrawn. The owner of this Darknode will receive the
      *                  fees.
      * @param _token The address of the ERC20 token to withdraw.
      */
    function withdraw(address _darknode, ERC20 _token) public {
        address darknodeOwner = darknodeRegistry.getDarknodeOwner(bytes20(_darknode));
        require(darknodeOwner != 0x0);

        uint256 value = darknodeBalances[_darknode][_token];
        darknodeBalances[_darknode][_token] = 0;

        if (address(_token) == ETHEREUM) {
            darknodeOwner.transfer(value);
        } else {
            require(_token.transfer(darknodeOwner, value));
        }
    }

}
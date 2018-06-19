pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";

contract RewardVault {
    using SafeMath for uint256;

    // Constant address for ethereum
    address constant public ETHEREUM = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    DarknodeRegistry darknodeRegistry;

    mapping(address => mapping(address => uint256)) public darknodeBalances;

    constructor(DarknodeRegistry _darknodeRegistry) public {
        darknodeRegistry = _darknodeRegistry;
    }

    /** 
    * @notice The traders deposit fees into the reward vault.
    *
    * @param _token the address of the ERC20 token
    * @param _value the amount of fees in the smallest unit of the token
    */
    function deposit(address _darknode, ERC20 _token, uint256 _value) public payable {
        if (address(_token) == ETHEREUM) {
            require(msg.value == _value);
        } else {
            require(_token.transferFrom(msg.sender, address(this), _value));
        }

        // TODO: Use safe math
        darknodeBalances[_darknode][_token] = darknodeBalances[_darknode][_token].add(_value);
    }

    /** 
    * @notice The darknodes withdraw rewards from the reward vault.
    *
    * @param _token the address of the ERC20 token
    */
    function withdraw(address _darknode, ERC20 _token) public {
        address darknodeOwner = darknodeRegistry.getOwner(bytes20(_darknode));

        uint256 value = darknodeBalances[_darknode][_token];
        darknodeBalances[_darknode][_token] = 0;

        if (address(_token) == ETHEREUM) {
            darknodeOwner.transfer(value);
        } else {
            require(_token.transfer(darknodeOwner, value));
        }
    }
 
}
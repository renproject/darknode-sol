pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";
import "./CompatibleERC20.sol";

/// @notice The DarknodeRewardVault contract is responsible for holding fees
/// for darknodes for settling orders. Fees can be withdrawn to the address of
/// the darknode's operator. Fees can be in ETH or in ERC20 tokens.
/// Docs: https://github.com/republicprotocol/republic-sol/blob/master/docs/02-darknode-reward-vault.md
contract DarknodeRewardVault is Ownable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    string public VERSION; // Passed in as a constructor parameter.

    /// @notice The special address for Ether.
    address constant public ETHEREUM = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    DarknodeRegistry public darknodeRegistry;

    mapping(address => mapping(address => uint256)) public darknodeBalances;

    event LogDarknodeRegistryUpdated(DarknodeRegistry previousDarknodeRegistry, DarknodeRegistry nextDarknodeRegistry);

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _darknodeRegistry The DarknodeRegistry contract that is used by
    ///        the vault to lookup Darknode owners.
    constructor(string _VERSION, DarknodeRegistry _darknodeRegistry) public {
        VERSION = _VERSION;
        darknodeRegistry = _darknodeRegistry;
    }

    function updateDarknodeRegistry(DarknodeRegistry _newDarknodeRegistry) public onlyOwner {
        // Basic validation knowing that DarknodeRegistry exposes VERSION
        require(bytes(_newDarknodeRegistry.VERSION()).length > 0, "invalid darknode registry contract");

        emit LogDarknodeRegistryUpdated(darknodeRegistry, _newDarknodeRegistry);
        darknodeRegistry = _newDarknodeRegistry;
    }

    /// @notice Deposit fees into the vault for a Darknode. The Darknode
    /// registration is not checked (to reduce gas fees); the caller must be
    /// careful not to call this function for a Darknode that is not registered
    /// otherwise any fees deposited to that Darknode can be withdrawn by a
    /// malicious adversary (by registering the Darknode before the honest
    /// party and claiming ownership).
    ///
    /// @param _darknode The address of the Darknode that will receive the
    ///        fees.
    /// @param _token The address of the ERC20 token being used to pay the fee.
    ///        A special address is used for Ether.
    /// @param _value The amount of fees in the smallest unit of the token.
    function deposit(address _darknode, ERC20 _token, uint256 _value) public payable {
        uint256 receivedValue = _value;
        if (_token == ETHEREUM) {
            require(msg.value == _value, "mismatched ether value");
        } else {
            require(msg.value == 0, "unexpected ether value");
            receivedValue = CompatibleERC20(_token).safeTransferFromWithFees(msg.sender, this, _value);
        }
        darknodeBalances[_darknode][_token] = darknodeBalances[_darknode][_token].add(receivedValue);
    }

    /// @notice Withdraw fees earned by a Darknode. The fees will be sent to
    /// the owner of the Darknode. If a Darknode is not registered the fees
    /// cannot be withdrawn.
    ///
    /// @param _darknode The address of the Darknode whose fees are being
    ///        withdrawn. The owner of this Darknode will receive the fees.
    /// @param _token The address of the ERC20 token to withdraw.
    function withdraw(address _darknode, ERC20 _token) public {
        address darknodeOwner = darknodeRegistry.getDarknodeOwner(_darknode);

        require(darknodeOwner != 0x0, "invalid darknode owner");

        uint256 value = darknodeBalances[_darknode][_token];
        darknodeBalances[_darknode][_token] = 0;

        if (_token == ETHEREUM) {
            darknodeOwner.transfer(value);
        } else {
            CompatibleERC20(_token).safeTransfer(darknodeOwner, value);
        }
    }

}
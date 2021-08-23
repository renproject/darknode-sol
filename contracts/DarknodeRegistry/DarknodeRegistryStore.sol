pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

import "../Governance/Claimable.sol";
import "../libraries/LinkedList.sol";
import "../RenToken/RenToken.sol";
import "../libraries/CanReclaimTokens.sol";

/// @notice This contract stores data and funds for the DarknodeRegistry
/// contract. The data / fund logic and storage have been separated to improve
/// upgradability.
contract DarknodeRegistryStore is Claimable, CanReclaimTokens {
    using SafeMath for uint256;

    string public VERSION; // Passed in as a constructor parameter.

    /// @notice Darknodes are stored in the darknode struct. The owner is the
    /// address that registered the darknode, the bond is the amount of REN that
    /// was transferred during registration, and the public key is the
    /// encryption key that should be used when sending sensitive information to
    /// the darknode.
    struct Darknode {
        // The owner of a Darknode is the address that called the register
        // function. The owner is the only address that is allowed to
        // deregister the Darknode, unless the Darknode is slashed for
        // malicious behavior.
        address payable owner;
        // The bond is the amount of REN submitted as a bond by the Darknode.
        // This amount is reduced when the Darknode is slashed for malicious
        // behavior.
        uint256 bond;
        // The block number at which the Darknode is considered registered.
        uint256 registeredAt;
        // The block number at which the Darknode is considered deregistered.
        uint256 deregisteredAt;
        // The public key used by this Darknode for encrypting sensitive data
        // off chain. It is assumed that the Darknode has access to the
        // respective private key, and that there is an agreement on the format
        // of the public key.
        bytes publicKey;
    }

    /// Registry data.
    mapping(address => Darknode) private darknodeRegistry;
    LinkedList.List private darknodes;

    // RenToken.
    RenToken public ren;

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _ren The address of the RenToken contract.
    constructor(string memory _VERSION, RenToken _ren) public {
        Claimable.initialize(msg.sender);
        CanReclaimTokens.initialize(msg.sender);
        VERSION = _VERSION;
        ren = _ren;
        blacklistRecoverableToken(address(ren));
    }

    /// @notice Instantiates a darknode and appends it to the darknodes
    /// linked-list.
    ///
    /// @param _darknodeID The darknode's ID.
    /// @param _darknodeOperator The darknode's owner's address.
    /// @param _bond The darknode's bond value.
    /// @param _publicKey The darknode's public key.
    /// @param _registeredAt The time stamp when the darknode is registered.
    /// @param _deregisteredAt The time stamp when the darknode is deregistered.
    function appendDarknode(
        address _darknodeID,
        address payable _darknodeOperator,
        uint256 _bond,
        bytes calldata _publicKey,
        uint256 _registeredAt,
        uint256 _deregisteredAt
    ) external onlyOwner {
        Darknode memory darknode =
            Darknode({
                owner: _darknodeOperator,
                bond: _bond,
                publicKey: _publicKey,
                registeredAt: _registeredAt,
                deregisteredAt: _deregisteredAt
            });
        darknodeRegistry[_darknodeID] = darknode;
        LinkedList.append(darknodes, _darknodeID);
    }

    /// @notice Returns the address of the first darknode in the store.
    function begin() external view onlyOwner returns (address) {
        return LinkedList.begin(darknodes);
    }

    /// @notice Returns the address of the next darknode in the store after the
    /// given address.
    function next(address darknodeID)
        external
        view
        onlyOwner
        returns (address)
    {
        return LinkedList.next(darknodes, darknodeID);
    }

    /// @notice Removes a darknode from the store and transfers its bond to the
    /// owner of this contract.
    function removeDarknode(address darknodeID) external onlyOwner {
        uint256 bond = darknodeRegistry[darknodeID].bond;
        delete darknodeRegistry[darknodeID];
        LinkedList.remove(darknodes, darknodeID);
        require(
            ren.transfer(owner(), bond),
            "DarknodeRegistryStore: bond transfer failed"
        );
    }

    /// @notice Updates the bond of a darknode. The new bond must be smaller
    /// than the previous bond of the darknode.
    function updateDarknodeBond(address darknodeID, uint256 decreasedBond)
        external
        onlyOwner
    {
        uint256 previousBond = darknodeRegistry[darknodeID].bond;
        require(
            decreasedBond < previousBond,
            "DarknodeRegistryStore: bond not decreased"
        );
        darknodeRegistry[darknodeID].bond = decreasedBond;
        require(
            ren.transfer(owner(), previousBond.sub(decreasedBond)),
            "DarknodeRegistryStore: bond transfer failed"
        );
    }

    /// @notice Updates the deregistration timestamp of a darknode.
    function updateDarknodeDeregisteredAt(
        address darknodeID,
        uint256 deregisteredAt
    ) external onlyOwner {
        darknodeRegistry[darknodeID].deregisteredAt = deregisteredAt;
    }

    /// @notice Returns the owner of a given darknode.
    function darknodeOperator(address darknodeID)
        external
        view
        onlyOwner
        returns (address payable)
    {
        return darknodeRegistry[darknodeID].owner;
    }

    /// @notice Returns the bond of a given darknode.
    function darknodeBond(address darknodeID)
        external
        view
        onlyOwner
        returns (uint256)
    {
        return darknodeRegistry[darknodeID].bond;
    }

    /// @notice Returns the registration time of a given darknode.
    function darknodeRegisteredAt(address darknodeID)
        external
        view
        onlyOwner
        returns (uint256)
    {
        return darknodeRegistry[darknodeID].registeredAt;
    }

    /// @notice Returns the deregistration time of a given darknode.
    function darknodeDeregisteredAt(address darknodeID)
        external
        view
        onlyOwner
        returns (uint256)
    {
        return darknodeRegistry[darknodeID].deregisteredAt;
    }

    /// @notice Returns the encryption public key of a given darknode.
    function darknodePublicKey(address darknodeID)
        external
        view
        onlyOwner
        returns (bytes memory)
    {
        return darknodeRegistry[darknodeID].publicKey;
    }
}

pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./libraries/LinkedList.sol";
import "./RepublicToken.sol";

contract DarknodeRegistryStore is Ownable {

    /**
    * @notice Darknodes are stored in the darknode struct. The owner is the
    * address that registered the darknode, the bond is the amount of REN that
    * was transferred during registration, and the public key is the encryption
    * key that should be used when sending sensitive information to the darknode.
    */
    struct Darknode {
        // The owner of a Darknode is the address that called the register
        // function. The owner is the only address that is allowed to
        // deregister the Darknode, unless the Darknode is slashed for
        // malicious behaviour.
        address owner;

        // The bond is the amount of REN submitted as a bond by the Darknode.
        // This amount is reduced when the Darknode is slashed for malicious
        // behaviour.
        uint256 bond;

        // The block numer at which the Darknode is considered registered.
        uint256 registeredAt;

        // The block numer at which the Darknode is considered deregistered.
        uint256 deregisteredAt;

        // The public key used by this Darknode for encrypting sensitive data
        // off chain. It is assumed that the Darknode has access to the
        // respective private key, and that there is an agreement on the format
        // of the public key.
        bytes publicKey;
    }

    // Registry data.
    mapping(address => Darknode) private darknodeRegistry;
    LinkedList.List private darknodes;

    // RepublicToken.
    RepublicToken private ren;

    /**
    * @notice The DarknodeRegistryStore constructor.
    *
    * @param _ren The address of the RepublicToken contract.
    */
    constructor(RepublicToken _ren) public {
        ren = _ren;
    }

    /**
    * @notice Instantiates a darknode and appends it to the darknodes linkedlist.
    * 
    * @param _darknodeID The darknode's ID.
    * @param _darknodeOwner The darknode's owner's address
    * @param _bond The darknode's bond value
    * @param _publicKey The darknode's public key
    * @param _registeredAt The time stamp when the darknode is registered.
    * @param _deregisteredAt The time stamp when the darknode is deregistered.
    */
    function appendDarknode(address _darknodeID, address _darknodeOwner, uint256 _bond, bytes _publicKey, uint256 _registeredAt, uint256 _deregisteredAt) external onlyOwner {
        Darknode memory darknode = Darknode({
            owner: _darknodeOwner,
            bond: _bond,
            publicKey: _publicKey,
            registeredAt: _registeredAt,
            deregisteredAt: _deregisteredAt
        });
        darknodeRegistry[_darknodeID] = darknode;
        LinkedList.append(darknodes, _darknodeID);
    }

    function begin() external view onlyOwner returns(address) {
        return LinkedList.begin(darknodes);
    }

    function next(address darknodeID) external view onlyOwner returns(address) {
        return LinkedList.next(darknodes, darknodeID);
    } 

    function removeDarknode(address darknodeID) external onlyOwner {
        uint256 bond = darknodeRegistry[darknodeID].bond;
        delete darknodeRegistry[darknodeID];
        LinkedList.remove(darknodes, darknodeID);
        require(ren.transfer(owner, bond), "bond transfer failed");
    }

    function updateDarknodeBond(address darknodeID, uint256 bond) external onlyOwner {
        uint256 previousBond = darknodeRegistry[darknodeID].bond;
        darknodeRegistry[darknodeID].bond = bond;
        if (previousBond > bond) {
            require(ren.transfer(owner, previousBond - bond));
        }
    }

    function updateDarknodeDeregisteredAt(address darknodeID, uint256 deregisteredAt) external onlyOwner {
        darknodeRegistry[darknodeID].deregisteredAt = deregisteredAt;
    }

    function darknodeOwner(address darknodeID) external view onlyOwner returns (address) {
        return darknodeRegistry[darknodeID].owner;
    }

    function darknodeBond(address darknodeID) external view onlyOwner returns (uint256) {
        return darknodeRegistry[darknodeID].bond;
    }

    function darknodeRegisteredAt(address darknodeID) external view onlyOwner returns (uint256) {
        return darknodeRegistry[darknodeID].registeredAt;
    }

    function darknodeDeregisteredAt(address darknodeID) external view onlyOwner returns (uint256) {
        return darknodeRegistry[darknodeID].deregisteredAt;
    }

    function darknodePublicKey(address darknodeID) external view onlyOwner returns (bytes) {
        return darknodeRegistry[darknodeID].publicKey;
    }
}
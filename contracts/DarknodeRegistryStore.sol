pragma solidity 0.4.24;

import "./libraries/LinkedList.sol";
import "./RepublicToken.sol";

contract DarknodeRegistryStore {

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

    mapping(bytes20 => Darknode) private darknodeRegistry;

    // Registry data.
    LinkedList.List private darknodes;

    RepublicToken private ren;


    constructor(RepublicToken _ren) public {
        ren = _ren;
        owner = msg.sender;
    }

    function updateOwner(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function appendDarknode(bytes20 darknodeID, address darknodeOwner, uint256 bond, bytes pubKey, uint256 registeredAt, uint256 deregisteredAt) external onlyOwner {
        Darknode memory darknode = Darknode({
            owner: darknodeOwner,
            bond: bond,
            registeredAt: registeredAt,
            deregisteredAt: deregisteredAt,
            publicKey: pubKey
        });
        darknodeRegistry[darknodeID] = darknode;
        LinkedList.append(darknodes, darknodeID);
    }

    function begin() external view returns(bytes20) {
        return LinkedList.begin(darknodes);
    }

    function next(bytes20 darknodeID) external view returns(bytes20) {
        return LinkedList.next(darknodes, darknodeID);
    } 

    function removeDarknode(bytes20 darknodeID) external onlyOwner {
        uint256 bond = darknodeRegistry[darknodeID].bond;
        darknodeRegistry[darknodeID] = Darknode({
            owner: 0x0,
            bond: 0,
            registeredAt: 0,
            deregisteredAt: 0,
            publicKey: ""
        });
        LinkedList.remove(darknodes, darknodeID);
        require(ren.transfer(owner, bond), "transfer from vault failed");
    }

    function updateDarknodeBond(bytes20 darknodeID, uint256 bond) external onlyOwner {
        darknodeRegistry[darknodeID].bond = bond;
    }

    function updateDarknodeDeregisteredAt(bytes20 darknodeID, uint256 deregisteredAt) external onlyOwner {
        darknodeRegistry[darknodeID].deregisteredAt = deregisteredAt;
    }

    function darknodeOwner(bytes20 darknodeID) external view returns (address) {
        return darknodeRegistry[darknodeID].owner;
    }

    function darknodeBond(bytes20 darknodeID) external view returns (uint256) {
        return darknodeRegistry[darknodeID].bond;
    }

    function darknodeRegisteredAt(bytes20 darknodeID) external view returns (uint256) {
        return darknodeRegistry[darknodeID].registeredAt;
    }

    function darknodeDeregisteredAt(bytes20 darknodeID) external view returns (uint256) {
        return darknodeRegistry[darknodeID].deregisteredAt;
    }

    function darknodePublicKey(bytes20 darknodeID) external view returns (bytes) {
        return darknodeRegistry[darknodeID].publicKey;
    }
}
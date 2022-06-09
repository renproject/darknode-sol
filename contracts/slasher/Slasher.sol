pragma solidity 0.5.17;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";

contract Slasher {
    using ECDSA for bytes32;

    DarknodeRegistryLogicV2 dnr;
    uint256 challengeBond;
    address validSigner;

    mapping (bytes32=>address) challenged;
    mapping (bytes32=>mapping (address=>address)) slashed;

    event Challenged(address _challenger, bytes32 _epochHash);

    function challenge(bytes32 _epochHash) public {
        require(challenged[_epochHash] == address(0x0), "Slasher: this epoch has already been challenged");
        dnr.ren().transferFrom(msg.sender, address(this), challengeBond);
        challenged[_epochHash] = msg.sender;
        emit Challenged(msg.sender, _epochHash);
    }

    function slash(address[] calldata _darknodes, uint256[] calldata _percentages, address _challenger, bytes32 _epochHash, bytes calldata _signature) external {
        address signer = keccak256(abi.encode(_darknodes, _percentages, _challenger, _epochHash)).toEthSignedMessageHash().recover(_signature);
        require(validSigner == signer, "Slasher: invalid signer");
        require(_darknodes.length == _percentages.length, "Slasher: invalid slash params");
        for (uint256 i = 0; i < _darknodes.length; i++) {
            address darknode = _darknodes[i];
            require(slashed[_epochHash][darknode] == address(0x0), "Slasher: this epoch has already been slashed");
            dnr.slash(darknode, _challenger, _percentages[i]);
        }
        dnr.ren().transfer(msg.sender, challengeBond);
    }
}
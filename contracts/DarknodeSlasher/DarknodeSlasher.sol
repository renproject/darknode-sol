pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../DarknodeRegistry/DarknodeRegistry.sol";

/// @notice DarknodeSlasher will become a voting system for darknodes to
/// deregister other misbehaving darknodes.
/// Right now, it is a placeholder.
contract DarknodeSlasher is Ownable {

    DarknodeRegistry public darknodeRegistry;

    constructor(DarknodeRegistry _darknodeRegistry) public {
        darknodeRegistry = _darknodeRegistry;
    }

    function slash(address _guilty, address _challenger, uint8 _percentage)
        external
        onlyOwner
    {
        darknodeRegistry.slash(_guilty, _challenger, _percentage);
    }

    function blacklist(address _guilty) external onlyOwner {
        darknodeRegistry.slash(_guilty, owner(), 0);
    }

    function proposeMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        uint256 _validRound
    ) public pure returns (bytes memory) {
        return abi.encodePacked(
            "Propose(Height=", _uint2str(_height),
            ",Round=", _uint2str(_round),
            ",BlockHash=", string(_blockhash),
            ",ValidRound=", _uint2str(_validRound),
            ")"
        );
    }

    function _uint2str(uint _i) internal pure returns (string memory _uintAsString) { /* solium-disable-line security/no-assign-params */
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }

}

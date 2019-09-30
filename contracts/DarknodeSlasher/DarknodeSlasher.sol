pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../libraries/String.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";

/// @notice DarknodeSlasher will become a voting system for darknodes to
/// deregister other misbehaving darknodes.
/// Right now, it is a placeholder.
contract DarknodeSlasher is Ownable {

    DarknodeRegistry public darknodeRegistry;

    uint256 public blacklistSlashPercent;
    uint256 public maliciousSlashPercent;

    // Malicious Darknodes can be slashed for each height and round
    // mapping of height -> round -> guilty address -> slashed
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public slashed;

    // mapping of address to whether the darknode has been blacklisted
    mapping(address => bool) public blacklisted;

    /// @notice Restrict a function to have a valid percentage
    modifier validPercent(uint256 _percent) {
        require(_percent <= 100, "invalid percentage");
        _;
    }

    constructor(
        DarknodeRegistry _darknodeRegistry,
        uint256 _blacklistSlashPercent,
        uint256 _maliciousSlashPercent
    ) public {
        darknodeRegistry = _darknodeRegistry;
        setBlacklistSlashPercent(_blacklistSlashPercent);
        setMaliciousSlashPercent(_maliciousSlashPercent);
    }

    function setBlacklistSlashPercent(uint256 _percentage) public validPercent(_percentage) onlyOwner {
        blacklistSlashPercent = _percentage;
    }

    function setMaliciousSlashPercent(uint256 _percentage) public validPercent(_percentage) onlyOwner {
        maliciousSlashPercent = _percentage;
    }

    function slash(address _guilty, address _challenger, uint256 _percentage)
        external
        onlyOwner
    {
        darknodeRegistry.slash(_guilty, _challenger, _percentage);
    }

    function blacklist(address _guilty) external onlyOwner {
        require(!blacklisted[_guilty], "already blacklisted");
        blacklisted[_guilty] = true;
        darknodeRegistry.slash(_guilty, owner(), blacklistSlashPercent);
    }

    function slashDuplicatePropose(
        uint256 _height,
        uint256 _round,
        bytes calldata _blockhash1,
        uint256 _validRound1,
        bytes calldata _signature1,
        bytes calldata _blockhash2,
        uint256 _validRound2,
        bytes calldata _signature2
    ) external {
        address signer = validateDuplicatePropose(
            _height,
            _round,
            _blockhash1,
            _validRound1,
            _signature1,
            _blockhash2,
            _validRound2,
            _signature2
        );
        require(!slashed[_height][_round][signer], "already slashed");
        slashed[_height][_round][signer] = true;
        darknodeRegistry.slash(signer, msg.sender, maliciousSlashPercent);
    }

    function validateDuplicatePropose(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash1,
        uint256 _validRound1,
        bytes memory _signature1,
        bytes memory _blockhash2,
        uint256 _validRound2,
        bytes memory _signature2
    ) public pure returns (address) {
        require(_validRound1 != _validRound2, "same valid round");
        address signer1 = recoverPropose(_height, _round, _blockhash1, _validRound1, _signature1);
        address signer2 = recoverPropose(_height, _round, _blockhash2, _validRound2, _signature2);
        require(signer1 == signer2, "different signer");
        return signer1;
    }

    function recoverPropose(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        uint256 _validRound,
        bytes memory _signature
    ) public pure returns (address) {
        return ECDSA.recover(sha256(proposeMessage(_height, _round, _blockhash, _validRound)), _signature);
    }

    function proposeMessage(
        uint256 _height,
        uint256 _round,
        bytes memory _blockhash,
        uint256 _validRound
    ) public pure returns (bytes memory) {
        return abi.encodePacked(
            "Propose(Height=", String.fromUint(_height),
            ",Round=", String.fromUint(_round),
            ",BlockHash=", string(_blockhash),
            ",ValidRound=", String.fromUint(_validRound),
            ")"
        );
    }
}

pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../libraries/Validate.sol";
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
        DarknodeRegistry _darknodeRegistry
    ) public {
        darknodeRegistry = _darknodeRegistry;
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
        address signer = Validate.duplicatePropose(
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

    function slashDuplicatePrevote(
        uint256 _height,
        uint256 _round,
        bytes calldata _blockhash1,
        bytes calldata _signature1,
        bytes calldata _blockhash2,
        bytes calldata _signature2
    ) external {
        address signer = Validate.duplicatePrevote(
            _height,
            _round,
            _blockhash1,
            _signature1,
            _blockhash2,
            _signature2
        );
        require(!slashed[_height][_round][signer], "already slashed");
        slashed[_height][_round][signer] = true;
        darknodeRegistry.slash(signer, msg.sender, maliciousSlashPercent);
    }

    function slashDuplicatePrecommit(
        uint256 _height,
        uint256 _round,
        bytes calldata _blockhash1,
        bytes calldata _signature1,
        bytes calldata _blockhash2,
        bytes calldata _signature2
    ) external {
        address signer = Validate.duplicatePrecommit(
            _height,
            _round,
            _blockhash1,
            _signature1,
            _blockhash2,
            _signature2
        );
        require(!slashed[_height][_round][signer], "already slashed");
        slashed[_height][_round][signer] = true;
        darknodeRegistry.slash(signer, msg.sender, maliciousSlashPercent);
    }
}

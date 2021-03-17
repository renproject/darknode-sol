pragma solidity 0.5.17;

import "../Governance/Claimable.sol";
import "../libraries/Validate.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";

/// @notice DarknodeSlasher will become a voting system for darknodes to
/// deregister other misbehaving darknodes.
/// Right now, it is a placeholder.
contract DarknodeSlasher is Claimable {
    DarknodeRegistryLogicV1 public darknodeRegistry;

    uint256 public blacklistSlashPercent;
    uint256 public maliciousSlashPercent;
    uint256 public secretRevealSlashPercent;

    // Malicious Darknodes can be slashed for each height and round
    // mapping of height -> round -> guilty address -> slashed
    mapping(uint256 => mapping(uint256 => mapping(address => bool)))
        public slashed;

    // mapping of darknodes which have revealed their secret
    mapping(address => bool) public secretRevealed;

    // mapping of address to whether the darknode has been blacklisted
    mapping(address => bool) public blacklisted;

    /// @notice Emitted when the DarknodeRegistry is updated.
    /// @param _previousDarknodeRegistry The address of the old registry.
    /// @param _nextDarknodeRegistry The address of the new registry.
    event LogDarknodeRegistryUpdated(
        DarknodeRegistryLogicV1 indexed _previousDarknodeRegistry,
        DarknodeRegistryLogicV1 indexed _nextDarknodeRegistry
    );

    /// @notice Restrict a function to have a valid percentage.
    modifier validPercent(uint256 _percent) {
        require(_percent <= 100, "DarknodeSlasher: invalid percentage");
        _;
    }

    constructor(DarknodeRegistryLogicV1 _darknodeRegistry) public {
        Claimable.initialize(msg.sender);
        darknodeRegistry = _darknodeRegistry;
    }

    /// @notice Allows the contract owner to update the address of the
    /// darknode registry contract.
    /// @param _darknodeRegistry The address of the Darknode Registry
    /// contract.
    function updateDarknodeRegistry(DarknodeRegistryLogicV1 _darknodeRegistry)
        external
        onlyOwner
    {
        require(
            address(_darknodeRegistry) != address(0x0),
            "DarknodeSlasher: invalid Darknode Registry address"
        );
        DarknodeRegistryLogicV1 previousDarknodeRegistry = darknodeRegistry;
        darknodeRegistry = _darknodeRegistry;
        emit LogDarknodeRegistryUpdated(
            previousDarknodeRegistry,
            darknodeRegistry
        );
    }

    function setBlacklistSlashPercent(uint256 _percentage)
        public
        validPercent(_percentage)
        onlyOwner
    {
        blacklistSlashPercent = _percentage;
    }

    function setMaliciousSlashPercent(uint256 _percentage)
        public
        validPercent(_percentage)
        onlyOwner
    {
        maliciousSlashPercent = _percentage;
    }

    function setSecretRevealSlashPercent(uint256 _percentage)
        public
        validPercent(_percentage)
        onlyOwner
    {
        secretRevealSlashPercent = _percentage;
    }

    function slash(
        address _guilty,
        address _challenger,
        uint256 _percentage
    ) external onlyOwner {
        darknodeRegistry.slash(_guilty, _challenger, _percentage);
    }

    function blacklist(address _guilty) external onlyOwner {
        require(!blacklisted[_guilty], "DarknodeSlasher: already blacklisted");
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
        address signer =
            Validate.duplicatePropose(
                _height,
                _round,
                _blockhash1,
                _validRound1,
                _signature1,
                _blockhash2,
                _validRound2,
                _signature2
            );
        require(
            !slashed[_height][_round][signer],
            "DarknodeSlasher: already slashed"
        );
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
        address signer =
            Validate.duplicatePrevote(
                _height,
                _round,
                _blockhash1,
                _signature1,
                _blockhash2,
                _signature2
            );
        require(
            !slashed[_height][_round][signer],
            "DarknodeSlasher: already slashed"
        );
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
        address signer =
            Validate.duplicatePrecommit(
                _height,
                _round,
                _blockhash1,
                _signature1,
                _blockhash2,
                _signature2
            );
        require(
            !slashed[_height][_round][signer],
            "DarknodeSlasher: already slashed"
        );
        slashed[_height][_round][signer] = true;
        darknodeRegistry.slash(signer, msg.sender, maliciousSlashPercent);
    }

    function slashSecretReveal(
        uint256 _a,
        uint256 _b,
        uint256 _c,
        uint256 _d,
        uint256 _e,
        uint256 _f,
        bytes calldata _signature
    ) external {
        address signer =
            Validate.recoverSecret(_a, _b, _c, _d, _e, _f, _signature);
        require(!secretRevealed[signer], "DarknodeSlasher: already slashed");
        secretRevealed[signer] = true;
        darknodeRegistry.slash(signer, msg.sender, secretRevealSlashPercent);
    }
}

pragma solidity 0.5.16;

import "../GatewayRegistry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";

contract Vesting is Ownable {
    using SafeMath for uint256;

    GatewayRegistry public registry;

    uint256 private constant SECONDS_PER_MONTH = 365 days / 12;

    /// @notice Defines the fields required for a vesting schedule.
    struct VestingSchedule {
        // The start time (in seconds since Unix epoch) at which the vesting
        // period should begin.
        uint256 startTime;
        // The number of months for the vesting period.
        uint16 duration;
        // The total amount of Bitcoin apart of the vesting schedule.
        uint256 amount;
        // The number of months claimed by the user.
        uint256 monthsClaimed;
        // The total amount of Bitcoin claimed by the user.
        uint256 amountClaimed;
    }

    /// @notice Mapping of a beneficiary address to a vesting schedule. Each
    //          beneficiary can have a maximum of 1 vesting schedule.
    mapping(address => VestingSchedule) public schedules;

    /// @notice The contract constructor.
    /// @param _registry The GatewayRegistry contract address.
    constructor(GatewayRegistry _registry) public {
        Ownable.initialize(msg.sender);
        registry = _registry;
    }

    /// @notice Allows the contract owner to add a vesting schedule for a
    ///         beneficiary.
    /// @param _amount The amount of Bitcoin provided to the Darknodes in Sats.
    /// @param _nHash The hash of the nonce returned by the Darknodes.
    /// @param _sig The signature returned by the Darknodes.
    /// @param _beneficiary The address of the recipient entitled to claim the vested tokens.
    /// @param _startTime The start time (in seconds since Unix epoch) at which the vesting
    ///                   period should begin.
    /// @param _duration The number of months for the vesting period.
    function addVestingSchedule(
        // Payload
        address _beneficiary,
        uint256 _startTime,
        uint16 _duration,
        // Required
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external onlyOwner {
        require(
            schedules[_beneficiary].startTime == 0,
            "vesting schedule already exists"
        );
        require(_amount > 0, "amount must be greater than 0");
        require(_duration > 0, "duration must be at least 1 month");

        // Construct the payload hash and mint new tokens using the Gateway
        // contract. This will verify the signature to ensure the Darknodes have
        // received the Bitcoin.
        bytes32 pHash = keccak256(
            abi.encode(_beneficiary, _startTime, _duration)
        );
        uint256 finalAmountScaled = registry.getGatewayBySymbol("BTC").mint(
            pHash,
            _amount,
            _nHash,
            _sig
        );

        // Construct a vesting schedule and assign it to the beneficiary.
        VestingSchedule memory schedule = VestingSchedule({
            startTime: _startTime == 0 ? now : _startTime,
            duration: _duration,
            amount: finalAmountScaled,
            monthsClaimed: 0,
            amountClaimed: 0
        });

        schedules[_beneficiary] = schedule;
    }

    /// @notice Allows a beneficiary to withdraw their vested Bitcoin.
    /// @param _to The Bitcoin address to which the beneficiary will receive
    ///            their Bitcoin.
    function claim(bytes calldata _to) external {
        // Calculate the claimable amount for the caller of the function.
        uint256 monthsClaimable;
        uint256 amountClaimable;
        (monthsClaimable, amountClaimable) = calculateClaimable(msg.sender);

        require(amountClaimable > 0, "no amount claimable");

        // Update the claimed details in the vesting schedule.
        VestingSchedule storage schedule = schedules[msg.sender];
        schedule.monthsClaimed = schedule.monthsClaimed.add(monthsClaimable);
        schedule.amountClaimed = schedule.amountClaimed.add(amountClaimable);

        // Burn the tokens using the Gateway contract. This will burn the
        // tokens after taking a fee. The Darknodes will watch for this event to
        // transfer the user the Bitcoin.
        registry.getGatewayBySymbol("BTC").burn(_to, amountClaimable);
    }

    /// @notice Retrieves the claimable amount for a given beneficiary.
    /// @param _to The Ethereum address of the beneficiary.
    function calculateClaimable(address _to)
        public
        view
        returns (uint256, uint256)
    {
        VestingSchedule storage schedule = schedules[_to];

        // Return if the vesting schedule does not exist or has not yet started.
        if (schedule.amount == 0 || now < schedule.startTime) {
            return (0, 0);
        }

        // Calculate the months elapsed since the start of the vesting period.
        uint256 elapsedTime = now.sub(schedule.startTime);
        uint256 elapsedMonths = elapsedTime.div(SECONDS_PER_MONTH);

        // Calculate the months elapsed and amount claimable since the last
        // claim attempt.
        uint256 monthsClaimable = Math
            .min(schedule.duration, elapsedMonths)
            .sub(schedule.monthsClaimed);
        uint256 amountClaimable = schedule.amount.mul(monthsClaimable).div(
            schedule.duration
        );

        return (monthsClaimable, amountClaimable);
    }
}

pragma solidity ^0.4.23;

import "./libraries/LibArc.sol";
import "./RewardGateway.sol";

contract Arc {

    // For using a similar interface for ether and erc20 tokens. We are using a constant for ethereum address.
    address constant internal ETHEREUM = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    // An atomic swap object, this contains all the data relevant to this atomic swap.
    LibArc.Swap private swap;

    // The reward vault object for the given token address.
    RewardVault private vault;

    // The reward gateway object, contains the reward vault addresses for all token address.
    RewardGateway private gateway;

    /**
    *   @notice constructor.
    */
    function Arc(bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _feeRate, uint256 _validity, address _receiver, bytes _order, address _rewardGatewayAddress) public {
        swap.tokenAddress = _tokenAddress;
        swap.order = _order;
        swap.secretLock = _secretLock;
        swap.value = _value;
        swap.fee = calculateFee(_value, _feeRate);
        swap.sender = msg.sender;
        swap.receiver = _receiver;
        swap.expiry = _validity;
        swap.status = LibArc.Status.initiated;
        gateway = RewardGateway(_rewardGatewayAddress);
        vault = RewardVault(gateway.rewardVaults(_tokenAddress));
    }

    /**
    *   @notice Accepts ether transfers.
    */
    function () public payable {

    }

    /**
    *   @notice Redeems the atomic swap using the secret.
    */
    function redeem(bytes _secret) public {
        require(LibArc.redeem(swap, _secret));
        require(LibArc.verify(swap.tokenAddress, swap.value, msg.sender));
        withdraw(swap.tokenAddress, swap.value, swap.receiver);
        payFee();
    }

    /**
    *  @notice Audits the contract, 
    *   1. checks if the contract has enough balance to fulfill
    *       the atomic swap, and pay fees.
    *   2. returns the values of the atomic swap.
    */
    function audit() public view returns (bytes32, address, address, uint256, uint256) {
        require(LibArc.verify(swap.tokenAddress, swap.value + swap.fee, msg.sender));
        return LibArc.audit(swap);
    }

    /**
    * @notice Audits the the secret used to redeem the swap.
    */
    function auditSecret() public view returns (bytes) {
        return LibArc.auditSecret(swap);
    }

    /**
    * @notice Refunds the locked up funds to the current swap initiator, 
    *       after the expiry period.
    */
    function refund(address _tokenAddress, uint256 _value) public {
        require(LibArc.refund(swap));
        require(msg.sender == swap.sender);
        require(LibArc.verify(_tokenAddress, _value, msg.sender));
        withdraw(_tokenAddress, _value, msg.sender);
    }

    /**
    * @notice Withdraws ether/erc20 tokens from the arc contract.
    */
    function withdraw(address _tokenAddress, uint256 _value, address _receiver) internal {
        require(LibArc.verify(_tokenAddress, _value, address(this)));
        if (_tokenAddress == ETHEREUM) {
            _receiver.transfer(_value);
        } else {
            Token t = Token(_tokenAddress);
            t.transfer(_receiver, _value);
        }
    }

    /**
    * @notice Pays fee to the Reward Vault Contract.
    */
    function payFee() internal {
        require(LibArc.verify(swap.tokenAddress, swap.fee, address(this)));
        if (swap.tokenAddress != ETHEREUM) {
            Token t = Token(swap.tokenAddress);
            t.approve(address(vault), swap.fee);
            vault.deposit(swap.order, swap.fee);
            return;
        } 
        vault.deposit.value(swap.fee)(swap.order, swap.fee);
        return;
    }

    /** 
    * @notice Calculates fee, for a given value and fee rate.
    */
    function calculateFee(uint256 _value, uint256 _rate) internal pure returns (uint256) {
        // solidity gets the floor of the result of a division, 
        // and we want the fee to be the ceiling so we add 1
        return ((_rate * _value)/(1000 - _rate) + 1);
    }
}
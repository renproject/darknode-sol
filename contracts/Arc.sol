pragma solidity ^0.4.23;

import "./RewardGateway.sol";
import "./RewardVault.sol";

contract Arc {

    enum Status {
      pending, initiated, redeemed, refunded
    }

    struct Swap {
        address caller;
        address sender;
        address receiver;
        address tokenAddress;
        uint256 value;

        uint256 fee;
        bytes order;
        address vaultAddress;
        RewardVault vault;

        bytes32 secret;
        bytes32 secretLock;

        uint256 expiry;
        Status status;
    }

    // For using a similar interface for ether and erc20 tokens. We are using a constant for ethereum address.
    // The capitalization helps solidity to validate the address (Checksum).
    address constant internal ETHEREUM = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    // The reward gateway object, contains the reward vault addresses for all token address.
    RewardGateway private gateway;

    // Map of all the atomicswaps.
    // An atomic swap object, this contains all the data relevant to this atomic swap.
    mapping (bytes32=>Swap) swaps;

    /**
    *   @notice constructor.
    */
    constructor(address _rewardGatewayAddress) public {
        gateway = RewardGateway(_rewardGatewayAddress);
    }

    /**
    *   @notice Initiate an atomicswap.
    */
    function initiate(bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _feeRate, uint256 _validity, address _receiver, bytes _order) public payable {
        bytes32 orderID = keccak256(_order);
        require(swaps[orderID].status == Status.pending);
        require(validateDeposit(_tokenAddress, _value));
        swaps[orderID].tokenAddress = _tokenAddress;
        swaps[orderID].order = _order;
        swaps[orderID].secretLock = _secretLock;
        swaps[orderID].fee = calculateFee(_value, _feeRate);
        swaps[orderID].value = _value - swaps[orderID].fee;
        swaps[orderID].sender = msg.sender;
        swaps[orderID].receiver = _receiver;
        swaps[orderID].expiry = _validity;
        swaps[orderID].status = Status.initiated;
        swaps[orderID].vault = RewardVault(gateway.rewardVaults(_tokenAddress));
    }

    /**
    *   @notice Redeems the atomic swap using the secret.
    */
    function redeem(bytes32 _orderID, bytes32 _secret) public {
        require(swaps[_orderID].status == Status.initiated);
        require(swaps[_orderID].receiver == msg.sender);
        require(swaps[_orderID].secretLock == sha256(_secret));
        swaps[_orderID].secret = _secret;
        swaps[_orderID].status = Status.redeemed;
        withdraw(swaps[_orderID].tokenAddress, swaps[_orderID].value, swaps[_orderID].receiver);
        payFee(_orderID);
    }

    function testSha256(bytes32 secret) public pure returns(bytes32) {
        return(sha256(secret));    
    }

    /**
    *  @notice Audits the contract, returns the relevant values of the atomic swap.
    */
    function audit(bytes32 _orderID) public view returns (bytes32, address, address, uint256, uint256) {
        require(swaps[_orderID].status == Status.initiated);
        return (swaps[_orderID].secretLock, swaps[_orderID].tokenAddress, swaps[_orderID].receiver, swaps[_orderID].value, swaps[_orderID].expiry);
    }

    /**
    * @notice Audits the the secret used to redeem the swap.
    */
    function auditSecret(bytes32 _orderID) public view returns (bytes32) {
        require(swaps[_orderID].status == Status.redeemed);
        return swaps[_orderID].secret;
    }

    /**
    * @notice Refunds the locked up funds to the current swap initiator, 
    *       after the expiry period.
    */
    function refund(bytes32 _orderID, address _tokenAddress, uint256 _value) public {
        require(swaps[_orderID].status == Status.initiated);
        require(block.timestamp >= swaps[_orderID].expiry);
        require(msg.sender == swaps[_orderID].sender);
        swaps[_orderID].status = Status.refunded;
        withdraw(_tokenAddress, _value, msg.sender);
    }

    /**
    * @notice Withdraws ether/erc20 tokens from the arc contract.
    */
    function withdraw(address _tokenAddress, uint256 _value, address _receiver) internal {
        if (_tokenAddress == ETHEREUM) {
            _receiver.transfer(_value);
        } else {
            ERC20 t = ERC20(_tokenAddress);
            t.transfer(_receiver, _value);
        }
    }

    /**
    * @notice Pays fee to the Reward Vault Contract.
    */
    function payFee(bytes32 _orderID) internal {
        if (swaps[_orderID].tokenAddress != ETHEREUM) {
            ERC20 t = ERC20(swaps[_orderID].tokenAddress);
            t.approve(address(swaps[_orderID].vault), swaps[_orderID].fee);
            swaps[_orderID].vault.deposit(swaps[_orderID].order, swaps[_orderID].fee);
            return;
        } 
        swaps[_orderID].vault.deposit.value(swaps[_orderID].fee)(swaps[_orderID].order, swaps[_orderID].fee);
    }

    /**
    * @notice validates the deposit.
    */
    function validateDeposit(address _tokenAddress, uint256 _value) internal returns (bool) {
        if (_tokenAddress == ETHEREUM) {
            return(msg.value == _value);
        }
        ERC20 t = ERC20(_tokenAddress);
        if (t.allowance(msg.sender, address(this)) < _value) {
            return false;
        }
        return (t.transferFrom(msg.sender, address(this), _value));
    }   

    /** 
    * @notice Calculates fee, for a given value and fee rate.
    */
    function calculateFee(uint256 _value, uint256 _rate) internal pure returns (uint256) {
        // solidity gets the floor of the result of a division, 
        // and we want the fee to be the ceiling so we add 1
        
        // Here _value is the amount of tokens the trader is willing to trade,
        // not the amount transfered to the contract. 
        // This equation is ubtained from solving the equations.
        
        /** 
        
        amount + fee = value
        fee = rate * amount (where rate is percentage)
        fee = (rate * amount)/1000 (as solidity only supports uint division, 
                                        and we want rate to be in the range 0.X%)
        */
        if ((_value/1000) * 1000 == _value) { // if the value is divisable by 1000, return the exact fee 
            return ((_rate * _value)/1000);
        }
        return ((_rate * _value)/1000 + 1); // otherwise return the ceiling.
    }
}
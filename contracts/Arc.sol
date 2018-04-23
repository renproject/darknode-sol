pragma solidity ^0.4.18;

import "./libraries/LibArc.sol";
import "./RewardGateway.sol";

contract Arc {

    LibArc.Swap private swap;
    RewardVault vault;
    RewardGateway gateway;

    function Arc(bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _validity, address _receiver, bytes _order, address _rewardGatewayAddress) public {
        swap.tokenAddress = _tokenAddress;
        swap.order = _order;
        swap.vault = vault;
        swap.secretLock = _secretLock;
        swap.value = (998 * _value)/1000;
        swap.fee = (2 * _value)/1000;
        swap.sender = msg.sender;
        swap.receiver = _receiver;
        swap.expiry = block.timestamp + _validity;
        swap.status = LibArc.Status.initiated;

        gateway = RewardGateway(_rewardGatewayAddress);
        vault = RewardVault(gateway.rewardVaults(_tokenAddress));
    }

    function () public payable {

    }

    function redeem(bytes _secret) public {
        require(LibArc.redeem(swap, _secret));
        require(LibArc.verify(swap.tokenAddress, swap.value, msg.sender));
        withdraw(swap.tokenAddress, swap.value, swap.receiver);
    }

    function audit() public view returns (bytes32, address, address, uint256, uint256) {
        require(LibArc.verify(swap.tokenAddress, swap.value, msg.sender));
        return LibArc.audit(swap);
    }

    function auditSecret() public view returns (bytes) {
        return LibArc.auditSecret(swap);
    }

    function refund(address _tokenAddress, uint256 _value) public {
        require(LibArc.refund(swap, _tokenAddress, _value));
        require(LibArc.verify(swap.tokenAddress, swap.value, msg.sender));
        withdraw(swap.tokenAddress, swap.value, swap.receiver);
    }

    function withdraw(address _tokenAddress, uint256 _value, address _receiver) internal {
        require(LibArc.verify(_tokenAddress, _value, address(this)));
        if (_tokenAddress == ETHEREUM) {
            _receiver.transfer(_value);
        } else {
            Token t = Token(_tokenAddress);
            t.transfer(_receiver, _value);
        }
    }

    function payFee() internal {
        require(LibArc.verify(_tokenAddress, _fee, address(this)));
        if (swap.tokenAddress != LibArc.ETHEREUM) {
            Token t = Token(swap.tokenAddress);
            t.approve(swap.receiver, swap.value);
        } 
        vault.deposit(swap.order, swap.fee);
    }
}


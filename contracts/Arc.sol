pragma solidity ^0.4.18;

import "./libraries/LibArc.sol";
import "./RewardGateway.sol";

contract Arc {

    address constant internal ETHEREUM = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    LibArc.Swap private swap;
    RewardVault vault;
    RewardGateway gateway;

    function Arc(bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _validity, address _receiver, bytes _order, address _rewardGatewayAddress) public {
        swap.tokenAddress = _tokenAddress;
        swap.order = _order;
        swap.vault = vault;
        swap.secretLock = _secretLock;
        // 
        swap.value = (998 * _value)/1000; 
        swap.fee = _value - swap.value;
        swap.sender = msg.sender;
        swap.receiver = _receiver;
        swap.expiry = _validity;
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
        payFee();
    }

    function audit() public view returns (bytes32, address, address, uint256, uint256) {
        require(LibArc.verify(swap.tokenAddress, swap.value, msg.sender));
        return LibArc.audit(swap);
    }

    function auditSecret() public view returns (bytes) {
        return LibArc.auditSecret(swap);
    }

    function refund(address _tokenAddress, uint256 _value) public {
        require(LibArc.refund(swap));
        require(msg.sender == swap.sender);
        require(LibArc.verify(_tokenAddress, _value, msg.sender));
        withdraw(_tokenAddress, _value, msg.sender);
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
}


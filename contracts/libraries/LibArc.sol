pragma solidity ^0.4.18;

import "../RewardVault.sol";

contract Token {
    function transfer(address, uint256) public returns (bool);
    function balanceOf(address) public view returns (uint256);
    function transferFrom(address, address, uint256) public returns (bool);
    function allowance(address, address) public view returns (uint256);
    function approve(address, uint256) public returns (bool);
}

library LibArc {
    address constant internal ETHEREUM = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

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

        bytes secret;
        bytes32 secretLock;

        uint256 expiry;
        Status status;
    }

    function audit(Swap storage self) internal view returns (bytes32, address, address, uint256, uint256) {
        require(self.status == Status.initiated);
        return (self.secretLock, self.tokenAddress, self.receiver, self.value, self.expiry);
    }

    function redeem(Swap storage self, bytes _secret) internal returns (bool) {
        require(self.status == Status.initiated);
        require(self.secretLock == sha256(_secret));
        self.secret = _secret;
        self.status = Status.redeemed;
        return true;
    }

    function refund(Swap storage self) internal returns (bool) {
        require(self.status == Status.initiated);
        require(block.timestamp >= self.expiry);
        self.status = Status.refunded;
        return true;
    }

    function auditSecret(Swap storage self) internal constant returns (bytes) {
        require(self.status == Status.redeemed);
        return self.secret;
    }

    function verify(address _tokenAddress, uint256 _value, address _spender) internal view returns (bool) {
        if (_tokenAddress == ETHEREUM) {
            return(_spender.balance >= _value);
        } else {
            Token t = Token(_tokenAddress);
            return(t.balanceOf(_spender) >= _value);
        }
    }
}
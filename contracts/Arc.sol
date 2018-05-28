pragma solidity ^0.4.24;

import "./libraries/LibArc.sol";

contract Arc {
    LibArc.Swap private swap;

    function Arc(bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _validity, address _receiver) public {
        LibArc.initiate(swap, _secretLock, _tokenAddress, _value, _validity, msg.sender, _receiver);
    }

    function () public payable {

    }

    function redeem(bytes32 _secret) public {
        LibArc.redeem(swap, _secret);
    }

    function audit() public view returns (bytes32, address, address, uint256, uint256) {
        return LibArc.audit(swap);
    }

    function auditSecret() public view returns (bytes32) {
        return LibArc.auditSecret(swap);
    }

    function refund(address _tokenAddress, uint256 _value) public {
        LibArc.refund(swap, _tokenAddress, _value);
    }
}


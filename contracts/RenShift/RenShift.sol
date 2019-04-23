pragma solidity 0.5.6;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract RenShift is ERC20, ERC20Detailed {   
    address public owner;

    mapping (bytes32=>bool) public spent;

    event LogMint(address _to, uint256 _amount);
    event LogBurn(bytes _to, uint256 _amount);

    constructor(address _owner, string memory _name, string memory _symbol, uint8 _decimals) public ERC20Detailed(_name, _symbol, _decimals) {
        owner = _owner;
    }

    function mint(address _to, uint256 _amount, bytes32 _hash, bytes32 _r, bytes32 _s, uint8 _v) public {
        require(verifySig(_to, _amount, _hash, _r, _s, _v));
        spent[_hash] = true;
        ERC20._mint(_to, _amount);
        emit LogMint(_to, _amount);
    }

    function burn(bytes memory _to, uint256 _amount) public {
        ERC20._burn(msg.sender, _amount);
        emit LogBurn(_to, _amount);
    }

    function verifySig(address _to, uint256 _amount, bytes32 _hash, bytes32 _r, bytes32 _s, uint8 _v) public view returns (bool) {
        return !spent[_hash] && owner == ecrecover(commitment(_to, _amount, _hash), 27+_v, _r, _s);
    }

    function commitment(address _to, uint256 _amount, bytes32 _hash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_to, _amount, _hash));
    }
}
pragma solidity 0.5.6;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract RenShift is ERC20, ERC20Detailed {   
    using SafeMath for uint256;

    address public owner;

    mapping (bytes32=>bool) public spent;

    address payable private rewardVault;
    uint256 private feeInBips;

    event LogMint(address _to, uint256 _amount);
    event LogBurn(bytes _to, uint256 _amount);

    constructor(
        address _owner,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _feeInBips,
        address payable _rewardVault
    ) public ERC20Detailed(_name, _symbol, _decimals) {
        owner = _owner;
        rewardVault = _rewardVault;
        feeInBips = _feeInBips;
    }

    function mint(address _to, uint256 _amount, bytes32 _hash, bytes32 _r, bytes32 _s, uint8 _v) public {
        require(verifySig(_to, _amount, _hash, _r, _s, _v));
        spent[_hash] = true;

        uint256 amountPostFees;
        if (feeInBips > 0) {
            uint256 fees = _amount.div(10000).mul(feeInBips);
            ERC20._mint(rewardVault, fees);
            amountPostFees = _amount.sub(fees);
        } else {
            amountPostFees = _amount;
        }

        ERC20._mint(_to, amountPostFees);
        emit LogMint(_to, amountPostFees);
    }

    function burn(bytes memory _to, uint256 _amount) public {
        uint256 amountPostFees;
        if (feeInBips > 0) {
            uint256 fees = _amount.div(10000).mul(feeInBips);
            ERC20._transfer(msg.sender, rewardVault, fees);
            amountPostFees = _amount.sub(fees);
        } else {
            amountPostFees = _amount;
        }

        ERC20._burn(msg.sender, amountPostFees);
        emit LogBurn(_to, amountPostFees);
    }

    function verifySig(address _to, uint256 _amount, bytes32 _hash, bytes32 _r, bytes32 _s, uint8 _v) public view returns (bool) {
        return !spent[_hash] && owner == ecrecover(commitment(_to, _amount, _hash), 27+_v, _r, _s);
    }

    function commitment(address _to, uint256 _amount, bytes32 _hash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_to, _amount, _hash));
    }
}

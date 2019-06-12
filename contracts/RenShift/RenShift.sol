pragma solidity ^0.5.8;

import "./ERC20Shifted.sol";

contract RenShift {
    address public owner;
    address public vault;
    uint16 public fee; // InBips

    mapping (bytes32=>bool) public spent;
    mapping (string=>ERC20Shifted) public shiftedTokens;
    mapping (address=>bool) public isShiftedToken;

    event LogShiftIn(string _token, address _to, uint256 _amount);
    event LogShiftOut(string _token, bytes _to, uint256 _amount);

    constructor(address _owner, address _vault, uint16 _fee) public {
        owner = _owner;
        vault = _vault;
        fee = _fee;
    }

    enum ShiftResult { New, Spent }

    function newShiftedToken(string calldata _name, string calldata _symbol, uint8 _decimals) external {
        ERC20Shifted shifted = new ERC20Shifted(_name, _symbol, _decimals);
        isShiftedToken[address(shifted)] = true;
        shiftedTokens[_symbol] = shifted;
    }

    function shiftStatus(bytes32 _hash) public returns (ShiftResult) {
        if (spent[_hash]) {
            return ShiftResult.Spent;
        } else {
            return ShiftResult.New;
        }
    }

    function shiftIn(
        ERC20Shifted _token,
        address _to,
        uint256 _amount,
        bytes32 _hash, bytes32 _commitment,
        bytes memory _sig)
    public returns (uint256) {
        require(shiftStatus(_hash) == ShiftResult.New, "hash already spent");
        require(verifySig(_token, _to, _amount, _hash, _commitment, _sig), "invalid signature");
        uint256 absoluteFee = (_amount * fee)/10000;
        spent[_hash] = true;
        _token.mint(_to, _amount-absoluteFee);
        emit LogShiftIn(_token.symbol(), _to, _amount);
        return _amount-absoluteFee;
    }

    function shiftOut(ERC20Shifted _token, bytes memory _to, uint256 _amount) public returns (uint256) {
        uint256 absoluteFee = (_amount * fee)/10000;
        // transfer burn fees to the vault
        _token.burn(msg.sender, _amount-absoluteFee);
        emit LogShiftOut(_token.symbol(), _to, _amount-absoluteFee);
        return _amount-absoluteFee;
    }

    function verifySig(ERC20Shifted _token, address _to, uint256 _amount, bytes32 _hash, bytes32 _commitment, bytes memory _sig) public view returns (bool) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        /* solium-disable-next-line */ /* solhint-disable-next-line */
        assembly {
            r := mload(add(_sig, 0x20))
            s := mload(add(_sig, 0x40))
            v := byte(0, mload(add(_sig, 0x60)))
        }

        return owner == ecrecover(sigHash(_token, _to, _amount, _hash, _commitment), v, r, s);
    }

    function sigHash(ERC20Shifted _token, address _to, uint256 _amount, bytes32 _hash, bytes32 _commitment) public pure returns (bytes32) {
        return keccak256(abi.encode(address(_token), _to, _amount, _hash, _commitment));
    }

    function withdrawFees(ERC20Shifted _token) public {
        _token.transfer(vault, _token.balanceOf(address(this)));
    }
}
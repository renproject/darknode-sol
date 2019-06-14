pragma solidity ^0.5.8;

import "./ERC20Shifted.sol";

contract Shifter {
    /// @notice Shifter can be upgraded by setting a `nextShifter`. The
    /// forwarding address is only set after a delay has passed.
    /// This upgradability pattern is not as sophisticated as a DelegateProxy,
    /// but is less error prone. It's downsides are higher gas fees when using
    /// the old address, and every function needing to forward the call,
    /// including storage getters.
    address public previousShifter;
    address public nextShifter;
    address public pendingNextShifter;
    uint256 public shifterUpgradeTime;
    uint256 constant shifterUpgradeDelay = 1 days;

    /// @notice Each Shifter token is tied to a specific shifted token.
    ERC20Shifted public token;

    /// @notice The mintAuthority is an address that can sign mint requests.
    address public mintAuthority;

    /// @notice When tokens a burnt, a portion of the tokens are forwarded to
    /// a fee recipient.
    address public feeRecipient;

    /// @notice The burning fee in bips.
    uint16 public fee;

    /// @notice Each commitment-hash can only be seen once.
    enum ShiftResult { New, Spent }
    mapping (bytes32=>mapping (bytes32=>ShiftResult)) public status;

    event LogShiftIn(address indexed _to, uint256 _amount);
    event LogShiftOut(bytes indexed _to, uint256 _amount, uint256 _fee);

    constructor(address _previousShifter, ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _fee) public {
        previousShifter = _previousShifter;
        token = _token;
        mintAuthority = _mintAuthority;
        fee = _fee;
        feeRecipient = _feeRecipient;
    }

    /// @notice Claims ownership of the token passed in to the constructor.
    ///         `transferStoreOwnership` must have previously been called.
    ///         Anyone can call this function.
    function claimTokenOwnership() public {
        token.claimOwnership();
    }

    /// @notice Allow the mint authority to update the fee recipient.
    /// @param _nextFeeRecipient The address to start paying fees to.
    function updateFeeRecipient(address _nextFeeRecipient) public {
        require(msg.sender == mintAuthority, "not authorized");

        feeRecipient = _nextFeeRecipient;
    }

    /// @notice Allows the mint authority to initiate an ownership transfer of
    ///         the token.
    /// @param _nextShifter The address to transfer the ownership to, or 0x0.
    function upgradeShifter(address _nextShifter) public {
        require(msg.sender == mintAuthority, "not authorized");

        /* solium-disable-next-line security/no-block-members */
        if (_nextShifter == pendingNextShifter && block.timestamp >= shifterUpgradeTime) {
            // If the delay has passed and the next shifter isn't been changed,
            // transfer the token to the next shifter and start pointing to it.

            nextShifter = pendingNextShifter;

            if (_nextShifter == address(0x0)) {
                require(token.owner() == address(this), "must be owner of token to reset upgrade");
            } else {
                token.transferOwnership(address(nextShifter));
                Shifter(nextShifter).claimTokenOwnership();
            }
        } else {
            // Start a timer so allow the shifter to be upgraded.

            /* solium-disable-next-line security/no-block-members */
            shifterUpgradeTime = block.timestamp + shifterUpgradeDelay;
            pendingNextShifter = _nextShifter;
        }
    }

    /// @notice shiftIn mints new tokens after verifying the signature and
    /// transfers the tokens to `_to`.
    function shiftIn(
        address _to,
        uint256 _amount,
        bytes32 _nonce,
        bytes32 _commitment,
        bytes memory _sig
    ) public returns (uint256) {
        if (nextShifter != address(0x0)) {return Shifter(nextShifter).shiftIn(_to, _amount, _nonce, _commitment, _sig);}

        require(status[_commitment][_nonce] == ShiftResult.New, "commitment already spent");
        require(verifySig(_to, _amount, _nonce, _commitment, _sig), "invalid signature");
        uint256 absoluteFee = (_amount * fee)/10000;
        status[_commitment][_nonce] = ShiftResult.Spent;
        token.mint(_to, _amount-absoluteFee);
        token.mint(feeRecipient, absoluteFee);
        emit LogShiftIn(_to, _amount);
        return _amount-absoluteFee;
    }

    /// @notice shiftOut burns tokens after taking a fee for the `_feeRecipient`.
    function shiftOut(bytes memory _to, uint256 _amount) public returns (uint256) {
        return _shiftOut(msg.sender, _to, _amount);
    }

    /// @notice Callable by the previous Shifter if it has been upgraded.
    function forwardShiftOut(address _from, bytes memory _to, uint256 _amount) public returns (uint256) {
        require(msg.sender == address(previousShifter), "must be previous Shifter contract");
        return _shiftOut(_from, _to, _amount);
    }

    function _shiftOut(address _from, bytes memory _to, uint256 _amount) internal returns (uint256) {
        if (nextShifter != address(0x0)) {return Shifter(nextShifter).forwardShiftOut(_from, _to, _amount);}

        uint256 absoluteFee = (_amount * fee)/10000;

        // Burn full amount and mint fee
        token.burn(_from, _amount);
        token.mint(feeRecipient, absoluteFee);

        emit LogShiftOut(_to, _amount-absoluteFee, absoluteFee);
        return _amount-absoluteFee;
    }

    /// @notice verifySig checks the the provided signature matches the provided
    /// parameters.
    function verifySig(address _to, uint256 _amount, bytes32 _nonce, bytes32 _commitment, bytes memory _sig) public view returns (bool) {
        if (nextShifter != address(0x0)) {return Shifter(nextShifter).verifySig(_to, _amount, _nonce, _commitment, _sig);}

        bytes32 r;
        bytes32 s;
        uint8 v;
        /* solium-disable-next-line */ /* solhint-disable-next-line */
        assembly {
            r := mload(add(_sig, 0x20))
            s := mload(add(_sig, 0x40))
            v := byte(0, mload(add(_sig, 0x60)))
        }

        return mintAuthority == ecrecover(sigHash(_to, _amount, _nonce, _commitment), v, r, s);
    }

    /// @notice sigHash hashes the parameters so that they can be signed.
    function sigHash(address _to, uint256 _amount, bytes32 _nonce, bytes32 _commitment) public view returns (bytes32) {
        if (nextShifter != address(0x0)) {return Shifter(nextShifter).sigHash(_to, _amount, _nonce, _commitment);}
        return keccak256(abi.encode(address(token), _to, _amount, _nonce, _commitment));
    }
}

/* solium-disable no-empty-blocks */
contract BTCShifter is Shifter {
    constructor(address _previousShifter, ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _fee)
        Shifter(_previousShifter, _token, _feeRecipient, _mintAuthority, _fee) public {
    }
}

contract ZECShifter is Shifter {
    constructor(address _previousShifter, ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _fee)
        Shifter(_previousShifter, _token, _feeRecipient, _mintAuthority, _fee) public {
    }
}
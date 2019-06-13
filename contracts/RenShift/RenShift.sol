pragma solidity ^0.5.8;

import "./ERC20Shifted.sol";

contract Shifter {
    /// @notice Each Shifter token is tied to a specific shifted token
    ERC20Shifted public token;

    /// @notice The mintAuthority is an address that can sign mint requests
    address public mintAuthority;

    /// @notice When tokens a burnt, a portion of the tokens are forwarded to
    /// a fee recipient.
    address public feeRecipient;

    /// @notice The burning fee in bips
    uint16 public fee;

    /// @notice The ownership of the token can be transferred with a delay
    uint256 public tokenTransferBlock;
    address public tokenTransferRecipient;
    uint256 constant tokenTransferDelay = 6000;

    /// @notice Each commitment-hash can only be seen once
    enum ShiftResult { New, Spent }
    mapping (bytes32=>ShiftResult) public status;

    event LogShiftIn(address indexed _to, uint256 _amount);
    event LogShiftOut(bytes indexed _to, uint256 _amount, uint256 _fee);

    constructor(ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _fee) public {
        token = _token;
        mintAuthority = _mintAuthority;
        fee = _fee;
        feeRecipient = _feeRecipient;

        /// Claims ownership of the store passed in to the constructor.
        /// `transferStoreOwnership` must have previously been called when
        /// transferring from another DarknodePaymentStore.
        token.claimOwnership();
    }


    /// @notice Allows the contract owner to initiate an ownership transfer of
    ///         the token.
    /// @param _newOwner The address to transfer the ownership to.
    function transferStoreOwnership(address _newOwner) external {
        require(msg.sender == mintAuthority, "Not authorized");

        if (tokenTransferBlock > block.number) {
            token.transferOwnership(tokenTransferRecipient);
        } else {
            tokenTransferBlock = block.number + tokenTransferDelay;
            tokenTransferRecipient = _newOwner;
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
        require(status[_commitment] == ShiftResult.New, "hash already spent");
        require(verifySig(_to, _amount, _commitment, _nonce, _sig), "invalid signature");
        uint256 absoluteFee = (_amount * fee)/10000;
        status[_commitment] = ShiftResult.Spent;
        token.mint(_to, _amount-absoluteFee);
        emit LogShiftIn(_to, _amount);
        return _amount-absoluteFee;
    }

    /// @notice shiftOut burns tokens after taking a fee for the `_feeRecipient`
    function shiftOut(bytes memory _to, uint256 _amount) public returns (uint256) {
        uint256 absoluteFee = (_amount * fee)/10000;

        // Burn full amount and mint fee
        token.burn(msg.sender, _amount);
        token.mint(feeRecipient, absoluteFee);

        emit LogShiftOut(_to, _amount-absoluteFee, absoluteFee);
        return _amount-absoluteFee;
    }

    /// @notice verifySig checks the the provided signature matches the provided
    /// parameters
    function verifySig(address _to, uint256 _amount, bytes32 _nonce, bytes32 _commitment, bytes memory _sig) public view returns (bool) {
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

    /// @notice sigHash hashes the parameters so that they can be signed
    function sigHash(address _to, uint256 _amount, bytes32 _nonce, bytes32 _commitment) public view returns (bytes32) {
        return keccak256(abi.encode(address(token), _to, _amount, _nonce, _commitment));
    }
}
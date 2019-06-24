pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "./ERC20Shifted.sol";

/// @notice Shifter handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract Shifter is Ownable {
    using SafeMath for uint256;

    /// @notice Shifter can be upgraded by setting a `nextShifter`.
    /// This upgradability pattern is not as sophisticated as a DelegateProxy,
    /// but is less error prone. It's downsides are higher gas fees when using
    /// the old address, and every function needing to forward the call,
    /// including storage getters.
    address public nextShifter;

    uint256 constant bipsDenominator = 10000;

    /// @notice A set of contracts that can call burn on behalf of a user
    mapping (address=>bool) public authorizedWrapper;

    /// @notice Each Shifter token is tied to a specific shifted token.
    ERC20Shifted public token;

    /// @notice The mintAuthority is an address that can sign mint requests.
    address public mintAuthority;

    /// @notice When tokens a burnt, a portion of the tokens are forwarded to
    /// a fee recipient.
    address public feeRecipient;

    /// @notice The burning fee in bips.
    uint16 public fee;

    /// @notice Each nHash can only be seen once.
    mapping (bytes32=>bool) public status;

    // LogShiftIn and LogShiftOut contain a unique `shiftID` that identifies
    // the mint or burn event.
    uint256 public nextShiftID = 0;
    event LogShiftIn(address indexed _to, uint256 _amount, uint256 indexed _shiftID);
    event LogShiftOut(bytes indexed _to, uint256 _amount, uint256 indexed _shiftID);

    /// @param _previousShifter An optional contract that can burn and mint on
    ///        behalf of users. This is required for the contract's
    ///        upgradability.
    /// @param _token The ERC20Shifted this Shifter is responsible for.
    /// @param _feeRecipient The recipient of burning and minting fees.
    /// @param _mintAuthority The address of the key that can sign mint
    ///        requests.
    /// @param _fee The amount subtracted each burn and mint request and
    ///        forwarded to the feeRecipient. In BIPS.
    constructor(address _previousShifter, ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _fee) public {
        authorizedWrapper[_previousShifter] = true;
        token = _token;
        mintAuthority = _mintAuthority;
        fee = _fee;
        feeRecipient = _feeRecipient;
    }

    // Public functions ////////////////////////////////////////////////////////

    /// @notice Claims ownership of the token passed in to the constructor.
    ///         `transferStoreOwnership` must have previously been called.
    ///         Anyone can call this function.
    function claimTokenOwnership() public {
        token.claimOwnership();
    }

    /// @notice Allow the mint authority to update the fee recipient.
    ///
    /// @param _nextMintAuthority The address to start paying fees to.
    function updateMintAuthority(address _nextMintAuthority) public onlyOwner {
        mintAuthority = _nextMintAuthority;
    }

    /// @notice Allow the mint authority to update the fee recipient.
    ///
    /// @param _nextFeeRecipient The address to start paying fees to.
    function updateFeeRecipient(address _nextFeeRecipient) public onlyOwner {
        feeRecipient = _nextFeeRecipient;
    }

    /// @notice Allows the mint authority to initiate an ownership transfer of
    ///         the token.
    ///
    /// @param _nextShifter The address to transfer the ownership to, or 0x0.
    function upgradeShifter(address _nextShifter) public onlyOwner {
        nextShifter = _nextShifter;

        if (_nextShifter == address(0x0)) {
            require(token.owner() == address(this), "caller is not the owner of token to reset upgrade");
        } else {
            token.transferOwnership(address(nextShifter));
            Shifter(nextShifter).claimTokenOwnership();
        }
    }

    /// @notice shiftIn mints tokens after taking a fee for the `_feeRecipient`.
    ///
    /// @param _amount The amount of the token being shifted int, in its
    ///        smallest value. (e.g. satoshis for BTC)
    /// @param _nHash (nonce hash) The hash of the nonce, amount and pHash.
    /// @param _pHash (payload hash) The hash of the payload associated with the
    ///        shift.
    /// @param _sig The signature of the hash of the following values:
    ///        (msg.sender, amount, nHash, pHash), signed by the mintAuthority.
    function shiftIn(uint256 _amount, bytes32 _nHash, bytes memory _sig, bytes32 _pHash) public returns (uint256) {
        return _shiftIn(msg.sender, _amount, _nHash, _sig, _pHash);
    }

    /// @notice Callable by the previous Shifter if it has been upgraded.
    function forwardShiftIn(address _to, uint256 _amount, bytes32 _nHash, bytes memory _sig, bytes32 _pHash) public returns (uint256) {
        require(authorizedWrapper[msg.sender], "not authorized to mint on behalf of user");
        return _shiftIn(_to, _amount, _nHash, _sig, _pHash);
    }

    /// @notice shiftOut burns tokens after taking a fee for the `_feeRecipient`.
    ///
    /// @param _to The address to receive the unshifted digital asset. The
    ///        format of this address should be of the destination chain.
    ///        For example, when shifting out to Bitcoin, _to should be a
    ///        Bitcoin address.
    /// @param _amount The amount of the token being shifted out, in its
    ///        smallest value. (e.g. satoshis for BTC)
    function shiftOut(bytes memory _to, uint256 _amount) public returns (uint256) {
        return _shiftOut(msg.sender, _to, _amount);
    }

    /// @notice Callable by the previous Shifter if it has been upgraded.
    function forwardShiftOut(address _from, bytes memory _to, uint256 _amount) public returns (uint256) {
        require(authorizedWrapper[msg.sender], "not authorized to burn on behalf of user");
        return _shiftOut(_from, _to, _amount);
    }

    /// @notice verifySignature checks the the provided signature matches the provided
    /// parameters.
    function verifySignature(bytes32 _signedMessageHash, bytes memory _sig) public view returns (bool) {
        return mintAuthority == ECDSA.recover(_signedMessageHash, _sig);
    }

    /// @notice hashForSignature hashes the parameters so that they can be signed.
    function hashForSignature(address _to, uint256 _amount, bytes32 _nHash, bytes32 _pHash) public view returns (bytes32) {
        // Check if the contract has been upgraded and forward the call
        if (nextShifter != address(0x0)) {
            return Shifter(nextShifter).hashForSignature(_to, _amount, _nHash, _pHash);
        }

        return keccak256(abi.encode(address(token), _to, _amount, _nHash, _pHash));
    }

    // Internal functions //////////////////////////////////////////////////////

    /// @notice shiftIn mints new tokens after verifying the signature and
    /// transfers the tokens to `_to`.
    function _shiftIn(address _to, uint256 _amount, bytes32 _nHash, bytes memory _sig, bytes32 _pHash) internal returns (uint256) {
        // Check if the contract has been upgraded and forward the call
        if (nextShifter != address(0x0)) {
            return Shifter(nextShifter).forwardShiftIn(_to, _amount, _nHash, _sig, _pHash);
        }

        // Verify signature
        bytes32 signedMessageHash = hashForSignature(_to, _amount, _nHash, _pHash);
        require(status[signedMessageHash] == false, "nonce hash already spent");
        require(verifySignature(signedMessageHash, _sig), "invalid signature");
        status[signedMessageHash] = true;

        // Mint `amount - fee` for the recipient and mint `fee` for the minter
        uint256 absoluteFee = (_amount.mul(fee)).div(bipsDenominator);
        uint256 receivedAmount = _amount.sub(absoluteFee);
        token.mint(_to, receivedAmount);
        token.mint(feeRecipient, absoluteFee);

        // Emit a log with a unique shift ID
        emit LogShiftIn(_to, receivedAmount, nextShiftID);
        nextShiftID += 1;

        return receivedAmount;
    }

    function _shiftOut(address _from, bytes memory _to, uint256 _amount) internal returns (uint256) {
        // Check if the contract has been upgraded and forward the call
        if (nextShifter != address(0x0)) {
            return Shifter(nextShifter).forwardShiftOut(_from, _to, _amount);
        }

        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(_to.length != 0, "to address is empty");

        // Burn full amount and mint fee
        uint256 absoluteFee = (_amount.mul(fee)).div(bipsDenominator);
        token.burn(_from, _amount);
        token.mint(feeRecipient, absoluteFee);

        // Emit a log with a unique shift ID
        uint256 receivedValue = _amount.sub(absoluteFee);
        emit LogShiftOut(_to, receivedValue, nextShiftID);
        nextShiftID += 1;

        return receivedValue;
    }
}

/// @dev The following are not necessary for deploying BTCShifter or ZECShifter
/// contracts, but are used to track deployments.

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
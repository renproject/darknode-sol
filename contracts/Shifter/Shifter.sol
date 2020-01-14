pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

import "../libraries/Claimable.sol";
import "../libraries/String.sol";
import "./ERC20Shifted.sol";
import "./IShifter.sol";
import "../libraries/CanReclaimTokens.sol";

/// @notice Shifter handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract Shifter is IShifter, Claimable, CanReclaimTokens {
    using SafeMath for uint256;

    uint8 public version = 2;

    uint256 constant BIPS_DENOMINATOR = 10000;
    uint256 public minShiftAmount;

    /// @notice Each Shifter token is tied to a specific shifted token.
    ERC20Shifted public token;

    /// @notice The mintAuthority is an address that can sign mint requests.
    address public mintAuthority;

    /// @dev feeRecipient is assumed to be an address (or a contract) that can
    /// accept erc20 payments it cannot be 0x0.
    /// @notice When tokens are mint or burnt, a portion of the tokens are
    /// forwarded to a fee recipient.
    address public feeRecipient;

    /// @notice The shiftIn fee in bips.
    uint16 public shiftInFee;

    /// @notice The shiftOut fee in bips.
    uint16 public shiftOutFee;

    /// @notice Each nHash can only be seen once.
    mapping (bytes32=>bool) public status;

    // LogShiftIn and LogShiftOut contain a unique `shiftID` that identifies
    // the mint or burn event.
    uint256 public nextShiftID = 0;

    event LogShiftIn(
        address indexed _to,
        uint256 _amount,
        uint256 indexed _shiftID,
        bytes32 indexed _signedMessageHash
    );
    event LogShiftOut(
        bytes _to,
        uint256 _amount,
        uint256 indexed _shiftID,
        bytes indexed _indexedTo
    );

    /// @param _token The ERC20Shifted this Shifter is responsible for.
    /// @param _feeRecipient The recipient of burning and minting fees.
    /// @param _mintAuthority The address of the key that can sign mint
    ///        requests.
    /// @param _shiftInFee The amount subtracted each shiftIn request and
    ///        forwarded to the feeRecipient. In BIPS.
    /// @param _shiftOutFee The amount subtracted each shiftOut request and
    ///        forwarded to the feeRecipient. In BIPS.
    constructor(ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _shiftInFee, uint16 _shiftOutFee, uint256 _minShiftOutAmount) public {
        minShiftAmount = _minShiftOutAmount;
        token = _token;
        shiftInFee = _shiftInFee;
        shiftOutFee = _shiftOutFee;
        updateMintAuthority(_mintAuthority);
        updateFeeRecipient(_feeRecipient);
    }

    // Public functions ////////////////////////////////////////////////////////

    /// @notice Claims ownership of the token passed in to the constructor.
    /// `transferStoreOwnership` must have previously been called.
    /// Anyone can call this function.
    function claimTokenOwnership() public {
        token.claimOwnership();
    }

    /// @notice Allow the owner to update the owner of the ERC20Shifted token.
    function transferTokenOwnership(Shifter _nextTokenOwner) public onlyOwner {
        token.transferOwnership(address(_nextTokenOwner));
        _nextTokenOwner.claimTokenOwnership();
    }

    /// @notice Allow the owner to update the fee recipient.
    ///
    /// @param _nextMintAuthority The address to start paying fees to.
    function updateMintAuthority(address _nextMintAuthority) public onlyOwner {
        require(_nextMintAuthority != address(0), "Shifter: mintAuthority cannot be set to address zero");
        mintAuthority = _nextMintAuthority;
    }

    /// @notice Allow the owner to update the minimum shiftOut amount.
    ///
    /// @param _minShiftOutAmount The new min shiftOut amount.
    function updateMinimumShiftOutAmount(uint256 _minShiftOutAmount) public onlyOwner {
        minShiftAmount = _minShiftOutAmount;
    }

    /// @notice Allow the owner to update the fee recipient.
    ///
    /// @param _nextFeeRecipient The address to start paying fees to.
    function updateFeeRecipient(address _nextFeeRecipient) public onlyOwner {
        // ShiftIn and ShiftOut will fail if the feeRecipient is 0x0
        require(_nextFeeRecipient != address(0x0), "Shifter: fee recipient cannot be 0x0");

        feeRecipient = _nextFeeRecipient;
    }

    /// @notice Allow the owner to update the shiftIn fee.
    ///
    /// @param _nextFee The new fee for minting and burning.
    function updateShiftInFee(uint16 _nextFee) public onlyOwner {
        shiftInFee = _nextFee;
    }

    /// @notice Allow the owner to update the shiftOut fee.
    ///
    /// @param _nextFee The new fee for minting and burning.
    function updateShiftOutFee(uint16 _nextFee) public onlyOwner {
        shiftOutFee = _nextFee;
    }

    /// @notice shiftIn mints tokens after taking a fee for the `_feeRecipient`.
    ///
    /// @param _pHash (payload hash) The hash of the payload associated with the
    ///        shift.
    /// @param _amount The amount of the token being shifted int, in its
    ///        smallest value. (e.g. satoshis for BTC)
    /// @param _nHash (nonce hash) The hash of the nonce, amount and pHash.
    /// @param _sig The signature of the hash of the following values:
    ///        (pHash, amount, msg.sender, nHash), signed by the mintAuthority.
    function shiftIn(bytes32 _pHash, uint256 _amount, bytes32 _nHash, bytes memory _sig) public returns (uint256) {
        // Verify signature
        bytes32 signedMessageHash = hashForSignature(_pHash, _amount, msg.sender, _nHash);
        require(status[signedMessageHash] == false, "Shifter: nonce hash already spent");
        if (!verifySignature(signedMessageHash, _sig)) {
            // Return a detailed string containing the hash and recovered
            // signer. This is somewhat costly but is only run in the revert
            // branch.
            revert(
                String.add4(
                    "Shifter: invalid signature - hash: ",
                    String.fromBytes32(signedMessageHash),
                    ", signer: ",
                    String.fromAddress(ECDSA.recover(signedMessageHash, _sig))
                )
            );
        }
        status[signedMessageHash] = true;

        // Mint `amount - fee` for the recipient and mint `fee` for the minter
        uint256 absoluteFee = _amount.mul(shiftInFee).div(BIPS_DENOMINATOR);
        uint256 receivedAmount = _amount.sub(absoluteFee);
        token.mint(msg.sender, receivedAmount);
        token.mint(feeRecipient, absoluteFee);

        // Emit a log with a unique shift ID
        emit LogShiftIn(msg.sender, receivedAmount, nextShiftID, signedMessageHash);
        nextShiftID += 1;

        return receivedAmount;
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
        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(_to.length != 0, "Shifter: to address is empty");
        require(_amount >= minShiftAmount, "Shifter: amount is less than the minimum shiftOut amount");

        // Burn full amount and mint fee
        uint256 absoluteFee = _amount.mul(shiftOutFee).div(BIPS_DENOMINATOR);
        token.burn(msg.sender, _amount);
        token.mint(feeRecipient, absoluteFee);

        // Emit a log with a unique shift ID
        uint256 receivedValue = _amount.sub(absoluteFee);
        emit LogShiftOut(_to, receivedValue, nextShiftID, _to);
        nextShiftID += 1;

        return receivedValue;
    }

    /// @notice verifySignature checks the the provided signature matches the provided
    /// parameters.
    function verifySignature(bytes32 _signedMessageHash, bytes memory _sig) public view returns (bool) {
        return mintAuthority == ECDSA.recover(_signedMessageHash, _sig);
    }

    /// @notice hashForSignature hashes the parameters so that they can be signed.
    function hashForSignature(bytes32 _pHash, uint256 _amount, address _to, bytes32 _nHash) public view returns (bytes32) {
        return keccak256(abi.encode(_pHash, _amount, address(token), _to, _nHash));
    }
}

/// @dev The following are not necessary for deploying BTCShifter or ZECShifter
/// contracts, but are used to track deployments.
contract BTCShifter is Shifter {
    constructor(ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _shiftInFee, uint16 _shiftOutFee, uint256 _minShiftOutAmount)
        Shifter(_token, _feeRecipient, _mintAuthority, _shiftInFee, _shiftOutFee, _minShiftOutAmount) public {
        }
}

contract ZECShifter is Shifter {
    constructor(ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _shiftInFee, uint16 _shiftOutFee, uint256 _minShiftOutAmount)
        Shifter(_token, _feeRecipient, _mintAuthority, _shiftInFee, _shiftOutFee, _minShiftOutAmount) public {
        }
}

contract BCHShifter is Shifter {
    constructor(ERC20Shifted _token, address _feeRecipient, address _mintAuthority, uint16 _shiftInFee, uint16 _shiftOutFee, uint256 _minShiftOutAmount)
        Shifter(_token, _feeRecipient, _mintAuthority, _shiftInFee, _shiftOutFee, _minShiftOutAmount) public {
        }
}
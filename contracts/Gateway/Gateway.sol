pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/cryptography/ECDSA.sol";

import "../libraries/Claimable.sol";
import "../libraries/String.sol";
import "./RenERC20.sol";
import "./interfaces/IGateway.sol";
import "../libraries/CanReclaimTokens.sol";

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract Gateway is IGateway, Claimable, CanReclaimTokens {
    using SafeMath for uint256;

    uint8 public version = 2;

    uint256 constant BIPS_DENOMINATOR = 10000;
    uint256 public minimumBurnAmount;

    /// @notice Each Gateway is tied to a specific RenERC20 token.
    RenERC20 public token;

    /// @notice The mintAuthority is an address that can sign mint requests.
    address public mintAuthority;

    /// @dev feeRecipient is assumed to be an address (or a contract) that can
    /// accept erc20 payments it cannot be 0x0.
    /// @notice When tokens are mint or burnt, a portion of the tokens are
    /// forwarded to a fee recipient.
    address public feeRecipient;

    /// @notice The mint fee in bips.
    uint16 public mintFee;

    /// @notice The burn fee in bips.
    uint16 public burnFee;

    /// @notice Each signature can only be seen once.
    mapping(bytes32 => bool) public status;

    // LogMint and LogBurn contain a unique `n` that identifies
    // the mint or burn event.
    uint256 public nextN = 0;

    event LogMint(
        address indexed _to,
        uint256 _amount,
        uint256 indexed _n,
        bytes32 indexed _signedMessageHash
    );
    event LogBurn(
        bytes _to,
        uint256 _amount,
        uint256 indexed _n,
        bytes indexed _indexedTo
    );

    /// @param _token The RenERC20 this Gateway is responsible for.
    /// @param _feeRecipient The recipient of burning and minting fees.
    /// @param _mintAuthority The address of the key that can sign mint
    ///        requests.
    /// @param _mintFee The amount subtracted each mint request and
    ///        forwarded to the feeRecipient. In BIPS.
    /// @param _burnFee The amount subtracted each burn request and
    ///        forwarded to the feeRecipient. In BIPS.
    constructor(
        RenERC20 _token,
        address _feeRecipient,
        address _mintAuthority,
        uint16 _mintFee,
        uint16 _burnFee,
        uint256 _minimumBurnAmount
    ) public {
        Claimable.initialize(msg.sender);
        CanReclaimTokens.initialize(msg.sender);
        minimumBurnAmount = _minimumBurnAmount;
        token = _token;
        mintFee = _mintFee;
        burnFee = _burnFee;
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

    /// @notice Allow the owner to update the owner of the RenERC20 token.
    function transferTokenOwnership(Gateway _nextTokenOwner) public onlyOwner {
        token.transferOwnership(address(_nextTokenOwner));
        _nextTokenOwner.claimTokenOwnership();
    }

    /// @notice Allow the owner to update the fee recipient.
    ///
    /// @param _nextMintAuthority The address to start paying fees to.
    function updateMintAuthority(address _nextMintAuthority) public onlyOwner {
        require(
            _nextMintAuthority != address(0),
            "Gateway: mintAuthority cannot be set to address zero"
        );
        mintAuthority = _nextMintAuthority;
    }

    /// @notice Allow the owner to update the minimum burn amount.
    ///
    /// @param _minimumBurnAmount The new min burn amount.
    function updateMinimumBurnAmount(uint256 _minimumBurnAmount)
        public
        onlyOwner
    {
        minimumBurnAmount = _minimumBurnAmount;
    }

    /// @notice Allow the owner to update the fee recipient.
    ///
    /// @param _nextFeeRecipient The address to start paying fees to.
    function updateFeeRecipient(address _nextFeeRecipient) public onlyOwner {
        // 'mint' and 'burn' will fail if the feeRecipient is 0x0
        require(
            _nextFeeRecipient != address(0x0),
            "Gateway: fee recipient cannot be 0x0"
        );

        feeRecipient = _nextFeeRecipient;
    }

    /// @notice Allow the owner to update the 'mint' fee.
    ///
    /// @param _nextMintFee The new fee for minting and burning.
    function updateMintFee(uint16 _nextMintFee) public onlyOwner {
        mintFee = _nextMintFee;
    }

    /// @notice Allow the owner to update the burn fee.
    ///
    /// @param _nextBurnFee The new fee for minting and burning.
    function updateBurnFee(uint16 _nextBurnFee) public onlyOwner {
        burnFee = _nextBurnFee;
    }

    /// @notice mint verifies a mint approval signature from RenVM and creates
    ///         tokens after taking a fee for the `_feeRecipient`.
    ///
    /// @param _pHash (payload hash) The hash of the payload associated with the
    ///        mint.
    /// @param _amount The amount of the token being minted, in its smallest
    ///        value. (e.g. satoshis for BTC).
    /// @param _nHash (nonce hash) The hash of the nonce, amount and pHash.
    /// @param _sig The signature of the hash of the following values:
    ///        (pHash, amount, msg.sender, nHash), signed by the mintAuthority.
    function mint(
        bytes32 _pHash,
        uint256 _amount,
        bytes32 _nHash,
        bytes memory _sig
    ) public returns (uint256) {
        // Verify signature
        bytes32 signedMessageHash = hashForSignature(
            _pHash,
            _amount,
            msg.sender,
            _nHash
        );
        require(
            status[signedMessageHash] == false,
            "Gateway: nonce hash already spent"
        );
        if (!verifySignature(signedMessageHash, _sig)) {
            // Return a detailed string containing the hash and recovered
            // signer. This is somewhat costly but is only run in the revert
            // branch.
            revert(
                String.add8(
                    "Gateway: invalid signature. pHash: ",
                    String.fromBytes32(_pHash),
                    ", amount: ",
                    String.fromUint(_amount),
                    ", msg.sender: ",
                    String.fromAddress(msg.sender),
                    ", _nHash: ",
                    String.fromBytes32(_nHash)
                )
            );
        }
        status[signedMessageHash] = true;

        uint256 amountScaled = token.fromUnderlying(_amount);

        // Mint `amount - fee` for the recipient and mint `fee` for the minter
        uint256 absoluteFeeScaled = amountScaled.mul(mintFee).div(
            BIPS_DENOMINATOR
        );
        uint256 receivedAmountScaled = amountScaled.sub(
            absoluteFeeScaled,
            "Gateway: fee exceeds amount"
        );
        token.mint(msg.sender, receivedAmountScaled);
        token.mint(feeRecipient, absoluteFeeScaled);

        // Emit a log with a unique identifier 'n'.
        // Use underlying amount, not scaled by rate.
        uint256 receivedAmount = token.toUnderlying(receivedAmountScaled);
        emit LogMint(msg.sender, receivedAmount, nextN, signedMessageHash);
        nextN += 1;

        return receivedAmountScaled;
    }

    function burn(bytes memory _to, uint256 _amountScaled)
        public
        returns (uint256)
    {
        return burn(_to, token.toUnderlying(_amountScaled));
    }

    /// @notice burn destroys tokens after taking a fee for the `_feeRecipient`,
    ///         allowing the associated assets to be released on their native
    ///         chain.
    ///
    /// @param _to The address to receive the un-bridged asset. The format of
    ///        this address should be of the destination chain.
    ///        For example, when burning to Bitcoin, _to should be a
    ///        Bitcoin address.
    /// @param _amount The amount of the token being burnt, in its
    ///        smallest value. (e.g. satoshis for BTC)
    function burnUnderlying(bytes memory _to, uint256 _amount)
        public
        returns (uint256)
    {
        // The recipient must not be empty. Better validation is possible,
        // but would need to be customized for each destination ledger.
        require(_to.length != 0, "Gateway: to address is empty");

        // Burn full amount and mint fee
        uint256 absoluteFee = _amount.mul(burnFee).div(BIPS_DENOMINATOR);
        uint256 amountScaled = token.fromUnderlying(_amount);
        uint256 receivedScaled = token.fromUnderlying(
            _amount.sub(absoluteFee, "Gateway: fee exceeds amount")
        );
        uint256 receivedValue = token.toUnderlying(receivedScaled);
        uint256 amountDifference = amountScaled.sub(receivedScaled);
        token.burn(msg.sender, amountScaled);
        token.mint(feeRecipient, amountDifference);

        require(
            // Must be strictly greater, to that the release transaction is of
            // at least one unit.
            receivedValue > minimumBurnAmount,
            "Gateway: amount is less than the minimum burn amount"
        );

        emit LogBurn(_to, receivedValue, nextN, _to);
        nextN += 1;

        return receivedScaled;
    }

    /// @notice verifySignature checks the the provided signature matches the provided
    /// parameters.
    function verifySignature(bytes32 _signedMessageHash, bytes memory _sig)
        public
        view
        returns (bool)
    {
        return mintAuthority == ECDSA.recover(_signedMessageHash, _sig);
    }

    /// @notice hashForSignature hashes the parameters so that they can be signed.
    function hashForSignature(
        bytes32 _pHash,
        uint256 _amount,
        address _to,
        bytes32 _nHash
    ) public view returns (bytes32) {
        return
            keccak256(abi.encode(_pHash, _amount, address(token), _to, _nHash));
    }
}

/// @dev The following are not necessary for deploying BTCGateway or ZECGateway
/// contracts, but are used to track deployments.
contract BTCGateway is Gateway {
    constructor(
        RenERC20 _token,
        address _feeRecipient,
        address _mintAuthority,
        uint16 _mintFee,
        uint16 _burnFee,
        uint256 _minimumBurnAmount
    )
        public
        Gateway(
            _token,
            _feeRecipient,
            _mintAuthority,
            _mintFee,
            _burnFee,
            _minimumBurnAmount
        )
    {}
}

contract ZECGateway is Gateway {
    constructor(
        RenERC20 _token,
        address _feeRecipient,
        address _mintAuthority,
        uint16 _mintFee,
        uint16 _burnFee,
        uint256 _minimumBurnAmount
    )
        public
        Gateway(
            _token,
            _feeRecipient,
            _mintAuthority,
            _mintFee,
            _burnFee,
            _minimumBurnAmount
        )
    {}
}

contract BCHGateway is Gateway {
    constructor(
        RenERC20 _token,
        address _feeRecipient,
        address _mintAuthority,
        uint16 _mintFee,
        uint16 _burnFee,
        uint256 _minimumBurnAmount
    )
        public
        Gateway(
            _token,
            _feeRecipient,
            _mintAuthority,
            _mintFee,
            _burnFee,
            _minimumBurnAmount
        )
    {}
}

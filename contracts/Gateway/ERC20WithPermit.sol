pragma solidity 0.5.17;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

/// @notice Taken from the DAI token.
contract ERC20WithPermit is Initializable, ERC20, ERC20Detailed {
    using SafeMath for uint256;

    mapping(address => uint256) public nonces;

    // If the token is redeployed, the version is increased to prevent a permit
    // signature being used on both token instances.
    string public version;

    // --- EIP712 niceties ---
    bytes32 public DOMAIN_SEPARATOR;
    // PERMIT_TYPEHASH is the value returned from
    // keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)")
    bytes32 public constant PERMIT_TYPEHASH =
        0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;

    function initialize(
        uint256 _chainId,
        string memory _version,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public initializer {
        ERC20Detailed.initialize(_name, _symbol, _decimals);
        version = _version;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name())),
                keccak256(bytes(version)),
                _chainId,
                address(this)
            )
        );
    }

    // --- Approve by signature ---
    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            holder,
                            spender,
                            nonce,
                            expiry,
                            allowed
                        )
                    )
                )
            );

        require(holder != address(0), "ERC20WithRate: address must not be 0x0");
        require(
            holder == ecrecover(digest, v, r, s),
            "ERC20WithRate: invalid signature"
        );
        require(
            expiry == 0 || now <= expiry,
            "ERC20WithRate: permit has expired"
        );
        require(nonce == nonces[holder]++, "ERC20WithRate: invalid nonce");
        uint256 amount = allowed ? uint256(-1) : 0;
        _approve(holder, spender, amount);
    }
}

//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ownership/Claimable.sol";
import "./BondNFT.sol";

contract BondingGovernance is Claimable {
    uint256 constant MIN_REDEEM_DELAY = 0 days;
    uint256 constant MAX_REDEEM_DELAY = 365 days;

    /**
     * The delay between being able to call `exit` and `redeem`. It can be updated
     * by the owner of the contract.
     */
    uint256 public redeemDelay;

    /**
     * `setRedeemDelay` can be called by the owner of the contract to update the
     * redeem delay, up to a maximum of 365 days.
     */
    function setRedeemDelay(uint256 _redeemDelay) public onlyOwner {
        require(_redeemDelay >= MIN_REDEEM_DELAY, "Bonding: redeemDelay smaller than minimum delay");
        require(_redeemDelay <= MAX_REDEEM_DELAY, "Bonding: redeemDelay larger than maximum delay");
        redeemDelay = _redeemDelay;
    }
}

/**
 * The Bonding contract allows users to bond a fixed amount of the bonding
 * token, returning an NFT that represents ownership of the bond.
 *
 * The owner of a minted NFT can call `exit` and, after a delay, call
 * `redeem` to burn the NFT in exchange for the bond. Ownership must be claimed
 * by the receiving address when being transferred.
 *
 * The contract tracks the role of an `owner` address which can update the
 * redeem delay, up to a maximum of 365 days.
 */
contract Bonding is BondingGovernance {
    /**
    * The ERC20 token used for bonding.
    */
    ERC20 public token;

    /**
     * The NFT contract.
     */
    BondNFT public nft;

    /**
     * A mapping from an NFT to a timestamp indicating if and when `exited` was
     * called. `0` indicates that `exited` has not been called or the NFT doesn't
     * exist.
     */
    mapping(uint256 => uint256) public exitedAt;

    /**
     * The amount of the bonding token required to call `enter`.
     */
    uint256 public bondAmount;

    event Entered(uint256 indexed _nftId, address indexed _bonder);
    event Exited(uint256 indexed _nftId, address indexed _bonder);
    event Redeemed(uint256 indexed _nftId, address indexed _bonder);

    /**
     * `onlyNFTOwner` restricts a method to only be callable by the owner of the
     * NFT passed in.
     */
    modifier onlyNFTOwner(uint256 _nftId) {
        require(nft.ownerOf(_nftId) == msg.sender, "Bonding: only callable by NFT owner");
        _;
    }

    constructor(ERC20 _token, uint256 _bondAmount, uint256 _redeemDelay, string memory _nftName, string memory _nftSymbol) Claimable() {
        token = _token;
        bondAmount = _bondAmount;
        BondingGovernance.setRedeemDelay(_redeemDelay);
        nft = new BondNFT(address(this), _nftName, _nftSymbol);
    }

    /**
     * `enter` allows a user to bond the required amount of tokens and receive an
     * NFT representing their bonded tokens.
     */
    function enter() public returns (uint256) {
        token.transferFrom(msg.sender, address(this), bondAmount);
        uint256 nftId = nft.mint(msg.sender);

        emit Entered(nftId, msg.sender);

        return nftId;
    }

    /**
     * `exit` allows the owner of one of the minted NFTs to indicate their intent
     * to disbond, starting the timer for the minimum redeem delay to pass.
     */
    function exit(uint256 _nftId) public onlyNFTOwner(_nftId) {
        require(exitedAt[_nftId] == 0, "Bonding: already exited");
        // solium-disable security/no-block-members
        exitedAt[_nftId] = block.timestamp;

        emit Exited(_nftId, msg.sender);
    }

    /**
     * `redeem` allows a user who has already called `exit` and waited the
     * sufficient time to burn their NFT in exchange for the bonded tokens.
     */
    function redeem(uint256 _nftId) public onlyNFTOwner(_nftId) {
        require(exitedAt[_nftId] > 0, "Bonding: must exit first");
        require(exitedAt[_nftId] <= (block.timestamp + BondingGovernance.redeemDelay), "Bonding: must wait redeem delay after exiting");
        delete exitedAt[_nftId];
        nft.burn(_nftId);
        token.transfer(msg.sender, bondAmount);

        emit Redeemed(_nftId, msg.sender);
    }
}

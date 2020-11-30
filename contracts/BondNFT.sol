//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * The BondNFT contract js a standard ERC721 contract with `mint` and `burn`
 * methods that can be called by the owner of the contract.
 *
 * NFT IDs start from 0, increasing by 1 each successive mint event.
 */
contract BondNFT is ERC721, Ownable {
    address public nftMinter;
    uint256 public nextNftId = 0;

    constructor(address _nftMinter, string memory _name, string memory _symbol) ERC721(_name, _symbol) Ownable() {
        nftMinter = _nftMinter;
    }

    function mint(address _to) public onlyOwner returns (uint256) {
        uint256 nftId = nextNftId;
        ERC721._safeMint(_to, nftId);
        nextNftId = nftId + 1;
        return nftId;
    }

    function burn(uint256 _nftId) public onlyOwner {
        ERC721._burn(_nftId);
    }
}

//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "./BondNFT.sol";

contract Claiming {
    /**
     * The NFT contract.
     */
    BondNFT public nft;

    event Claim(
        uint256 indexed _nftId,
        string _token,
        string _address,
        string indexed _tokenIndexed,
        string indexed _addressIndexed
    );

    /**
     * `onlyNFTOwner` restricts a method to only be callable by the owner of the
     * NFT passed in.
     */
    modifier onlyNFTOwner(uint256 _nftId) {
        require(
            nft.ownerOf(_nftId) == msg.sender,
            "Claiming: only callable by NFT owner"
        );
        _;
    }

    constructor(BondNFT _nft) {
        nft = _nft;
    }

    function claim(
        uint256 _nftId,
        string memory _token,
        string memory _address
    ) public onlyNFTOwner(_nftId) {
        emit Claim(_nftId, _token, _address, _token, _address);
    }
}

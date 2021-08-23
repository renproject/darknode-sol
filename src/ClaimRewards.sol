// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import {ValidString} from "./ValidString.sol";

contract ClaimRewardsV1 {
    uint256 public constant BPS_DENOMINATOR = 10000;

    event LogClaimRewards(
        address indexed operatorAddress_,
        string assetSymbol_,
        string recipientAddress_,
        string recipientChain_,
        bytes recipientPayload_,
        uint256 fractionInBps_,
        // Repeated values for indexing.
        string indexed assetSymbolIndexed_,
        string indexed recipientAddressIndexed_
    );

    modifier validFractionInBps(uint256 fraction_) {
        require(fraction_ <= BPS_DENOMINATOR, "ClaimRewards: invalid fractionInBps");
        _;
    }

    /**
     * claimRewardsToChain allows darknode operators to withdraw darknode
     * earnings, as an on-chain alternative to the JSON-RPC claim method.
     *
     * It will the operators total sum of rewards, for all of their nodes.
     *
     * @param assetSymbol_ The token symbol.
     *        E.g. "BTC", "DOGE" or "FIL".
     * @param recipientAddress_ An address on the asset's native chain, for
     *        receiving the withdrawn rewards. This should be a string as
     *        provided by the user - no encoding or decoding required.
     *        E.g.: "miMi2VET41YV1j6SDNTeZoPBbmH8B4nEx6" for BTC.
     * @param recipientChain_ A string indicating which chain the rewards should
     *        be withdrawn to. It should be the name of the chain as expected by
     *        RenVM (e.g. "Ethereum" or "Solana"). Support for different chains
     *        will be rolled out after this contract is deployed, starting with
     *        "Ethereum", then other host chains (e.g. "Polygon" or "Solana")
     *        and then lock chains (e.g. "Bitcoin" for "BTC"), also represented
     *        by an empty string "".
     * @param recipientPayload_ An associated payload that can be provided along
     *        with the recipient chain and address. Should be empty if not
     *        required.
     * @param fractionInBps_ A value between 0 and 10000 (inclusive) that
     *        indicates the percent to withdraw from each of the operator's
     *        darknodes. The value should be in BPS, meaning 10000 represents
     *        100%, 5000 represents 50%, etc.
     */
    function claimRewardsToChain(
        string memory assetSymbol_,
        string memory recipientAddress_,
        string memory recipientChain_,
        bytes memory recipientPayload_,
        uint256 fractionInBps_
    ) public validFractionInBps(fractionInBps_) {
        // Validate asset symbol.
        require(ValidString.isNotEmpty(assetSymbol_), "ClaimRewards: invalid empty asset");
        require(ValidString.isAlphanumeric(assetSymbol_), "ClaimRewards: invalid asset");

        // Validate recipient address.
        require(ValidString.isNotEmpty(recipientAddress_), "ClaimRewards: invalid empty recipient address");
        require(ValidString.isAlphanumeric(recipientAddress_), "ClaimRewards: invalid recipient address");

        // Validate recipient chain.
        // Note that the chain can be empty - which is planned to represent the
        // asset's native lock chain.
        require(ValidString.isAlphanumeric(recipientChain_), "ClaimRewards: invalid recipient chain");

        address operatorAddress = msg.sender;

        // Emit event.
        emit LogClaimRewards(
            operatorAddress,
            assetSymbol_,
            recipientAddress_,
            recipientChain_,
            recipientPayload_,
            fractionInBps_,
            // Indexed
            assetSymbol_,
            recipientAddress_
        );
    }

    /**
     * `claimRewardsToEthereum` calls `claimRewardsToChain` internally
     */
    function claimRewardsToEthereum(
        string memory assetSymbol_,
        address recipientAddress_,
        uint256 fractionInBps_
    ) public {
        return claimRewardsToChain(assetSymbol_, addressToString(recipientAddress_), "Ethereum", "", fractionInBps_);
    }

    // From https://ethereum.stackexchange.com/questions/8346/convert-address-to-string
    function addressToString(address address_) public pure returns (string memory) {
        bytes memory data = abi.encodePacked(address_);

        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}

contract ClaimRewardsProxy is TransparentUpgradeableProxy {
    constructor(
        address _logic,
        address admin_,
        bytes memory _data
    ) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}

// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.7;

import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/** The Protocol contract is used to look-up other Ren contracts. */
contract Protocol is Initializable, AccessControlEnumerableUpgradeable {
    event LogContractUpdated(string contractName, address indexed contractAddress, string indexed contractNameIndexed);

    mapping(string => address) internal contractMap;

    bytes32 public constant CAN_ADD_CONTRACTS = keccak256("CAN_ADD_CONTRACTS");
    bytes32 public constant CAN_UPDATE_CONTRACTS = keccak256("CAN_UPDATE_CONTRACTS");

    function __Protocol_init(address adminAddress_) public initializer {
        __AccessControlEnumerable_init();
        _setupRole(AccessControlUpgradeable.DEFAULT_ADMIN_ROLE, adminAddress_);
        _setupRole(CAN_ADD_CONTRACTS, adminAddress_);
        _setupRole(CAN_UPDATE_CONTRACTS, adminAddress_);
    }

    function addContract(string memory contractName, address contractAddress) public onlyRole(CAN_ADD_CONTRACTS) {
        require(contractMap[contractName] == address(0x0), "Protocol: contract entry already exists");
        contractMap[contractName] = contractAddress;

        emit LogContractUpdated(contractName, contractAddress, contractName);
    }

    function updateContract(string memory contractName, address contractAddress) public onlyRole(CAN_UPDATE_CONTRACTS) {
        contractMap[contractName] = contractAddress;

        emit LogContractUpdated(contractName, contractAddress, contractName);
    }

    function getContract(string memory contractName) public view returns (address) {
        return contractMap[contractName];
    }
}

pragma solidity 0.5.17;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../Governance/Claimable.sol";

/** The Protocol contract is used to look-up other Ren contracts. */
contract Protocol is Initializable, Claimable {
    event LogContractUpdated(
        string contractName,
        address indexed contractAddress,
        string indexed contractNameIndexed
    );

    mapping(string => address) internal contractMap;

    function __Protocol_init(address adminAddress_) public initializer {
        Claimable.initialize(adminAddress_);
    }

    function addContract(string memory contractName, address contractAddress)
        public
        onlyOwner
    {
        require(
            contractMap[contractName] == address(0x0),
            "Protocol: contract entry already exists"
        );
        contractMap[contractName] = contractAddress;

        emit LogContractUpdated(contractName, contractAddress, contractName);
    }

    function updateContract(string memory contractName, address contractAddress)
        public
        onlyOwner
    {
        contractMap[contractName] = contractAddress;

        emit LogContractUpdated(contractName, contractAddress, contractName);
    }

    function getContract(string memory contractName)
        public
        view
        returns (address)
    {
        return contractMap[contractName];
    }
}

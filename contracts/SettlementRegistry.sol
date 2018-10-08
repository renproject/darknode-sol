pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./BrokerVerifier.sol";
import "./Settlement.sol";

/// @notice SettlementRegistry allows a Settlement layer to register the
/// contracts used for match settlement and for broker signature verification.
contract SettlementRegistry is Ownable {
    string public VERSION; // Passed in as a constructor parameter.

    struct SettlementDetails {
        bool registered;
        Settlement settlementContract;
        BrokerVerifier brokerVerifierContract;
    }

    // Settlement IDs are 64-bit unsigned numbers
    mapping(uint64 => SettlementDetails) public settlementDetails;

    // Events
    event LogSettlementRegistered(uint64 settlementID, Settlement settlementContract, BrokerVerifier brokerVerifierContract);
    event LogSettlementUpdated(uint64 settlementID, Settlement settlementContract, BrokerVerifier brokerVerifierContract);
    event LogSettlementDeregistered(uint64 settlementID);

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    constructor(string _VERSION) public {
        VERSION = _VERSION;
    }

    /// @notice Returns the settlement contract of a settlement layer.
    function settlementRegistration(uint64 _settlementID) external view returns (bool) {
        return settlementDetails[_settlementID].registered;
    }

    /// @notice Returns the settlement contract of a settlement layer.
    function settlementContract(uint64 _settlementID) external view returns (Settlement) {
        return settlementDetails[_settlementID].settlementContract;
    }

    /// @notice Returns the broker verifier contract of a settlement layer.
    function brokerVerifierContract(uint64 _settlementID) external view returns (BrokerVerifier) {
        return settlementDetails[_settlementID].brokerVerifierContract;
    }

    /// @param _settlementID A unique 64-bit settlement identifier.
    /// @param _settlementContract The address to use for settling matches.
    /// @param _brokerVerifierContract The decimals to use for verifying
    ///        broker signatures.
    function registerSettlement(uint64 _settlementID, Settlement _settlementContract, BrokerVerifier _brokerVerifierContract) public onlyOwner {
        bool alreadyRegistered = settlementDetails[_settlementID].registered;
        
        settlementDetails[_settlementID] = SettlementDetails({
            registered: true,
            settlementContract: _settlementContract,
            brokerVerifierContract: _brokerVerifierContract
        });

        if (alreadyRegistered) {
            emit LogSettlementUpdated(_settlementID, _settlementContract, _brokerVerifierContract);
        } else {
            emit LogSettlementRegistered(_settlementID, _settlementContract, _brokerVerifierContract);
        }
    }

    /// @notice Deregisteres a settlement layer, clearing the details.
    /// @param _settlementID The unique 64-bit settlement identifier.
    function deregisterSettlement(uint64 _settlementID) external onlyOwner {
        require(settlementDetails[_settlementID].registered, "not registered");

        delete settlementDetails[_settlementID];

        emit LogSettlementDeregistered(_settlementID);
    }
}
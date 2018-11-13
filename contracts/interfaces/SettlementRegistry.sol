pragma solidity ^0.4.24;

import "./BrokerVerifier.sol";
import "./Settlement.sol";

interface SettlementRegistry {
    function settlementRegistration(uint64 _settlementID) external view returns (bool);

    function settlementContract(uint64 _settlementID) external view returns (Settlement) ;

    function brokerVerifierContract(uint64 _settlementID) external view returns (BrokerVerifier);

    function registerSettlement(uint64 _settlementID, Settlement _settlementContract, BrokerVerifier _brokerVerifierContract) public;

    function deregisterSettlement(uint64 _settlementID) external;

}

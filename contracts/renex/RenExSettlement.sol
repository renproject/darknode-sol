pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../Orderbook.sol";
import "./RenExBalances.sol";
import "./RenExTokens.sol";
import "../Settlement.sol";
import "../SettlementUtils.sol";

/**
@title The contract responsible for settling matched RenEx orders
@author Republic Protocol
*/
contract RenExSettlement is Ownable, Settlement {
    using SafeMath for uint256;

    /**
      * @notice Fees are in RenEx are 0.2% and to represent this in integers it
      * is broken into a numerator and denominator.
      */
    uint256 constant public DARKNODE_FEE_NUMERATOR = 2;
    uint256 constant public DARKNODE_FEE_DENOMINATOR = 1000;

    /**
      * @notice This is a Republic Protocol settlement identifier for the
      * RenExSettlement contract. It is used in orders to specify which
      * settlement layer is being used.
      */
    uint32 constant public SETTLEMENT_IDENTIFIER = 1;

    Orderbook public orderbookContract;
    RenExTokens public renExTokensContract;
    RenExBalances public renExBalancesContract;

    uint256 public submissionGasPriceLimit;

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}
    enum OrderStatus {None, Submitted, Matched}


    struct ExecutionDetails {
        uint256 lowTokenVolume;
        uint256 highTokenVolume;
        uint256 lowTokenFee;
        uint256 highTokenFee;
    }

    // Events
    event Transfer(address from, address to, uint32 token, uint256 value);
    event OrderbookUpdates(Orderbook previousOrderbook, Orderbook nextOrderbook);
    event RenExBalancesUpdates(RenExBalances previousRenExBalances, RenExBalances nextRenExBalances);
    event SubmissionGasPriceLimitUpdates(uint256 previousSubmissionGasPriceLimit, uint256 nextSubmissionGasPriceLimit);

    // Order storage
    mapping(bytes32 => SettlementUtils.OrderDetails) public orderDetails;
    mapping(bytes32 => OrderStatus) public orderStatus;
    mapping(bytes32 => address) public orderTrader;
    mapping(bytes32 => address) public orderSubmitter;
    // Match storage
    mapping(bytes32 => ExecutionDetails) matchExecutionDetails;


    /**
      * @notice constructor
      *
      * @param _orderbookContract The address of the Orderbook contract.
      * @param _renExBalancesContract The address of the RenExBalances
      *                               contract.
      * @param _renExTokensContract The address of the RenExTokens contract.
      */
    constructor(
        Orderbook _orderbookContract,
        RenExTokens _renExTokensContract,
        RenExBalances _renExBalancesContract,
        uint256 _submissionGasPriceLimit
    ) public {
        orderbookContract = _orderbookContract;
        renExTokensContract = _renExTokensContract;
        renExBalancesContract = _renExBalancesContract;
        submissionGasPriceLimit = _submissionGasPriceLimit;
    }

    /********** UPDATER FUNCTIONS *********************************************/

    function updateOrderbook(Orderbook _newOrderbookContract) public onlyOwner {
        emit OrderbookUpdates(orderbookContract, _newOrderbookContract);
        orderbookContract = _newOrderbookContract;
    }

    function updateRenExBalances(RenExBalances _newRenExBalancesContract) public onlyOwner {
        emit RenExBalancesUpdates(renExBalancesContract, _newRenExBalancesContract);
        renExBalancesContract = _newRenExBalancesContract;
    }

    function updateSubmissionGasPriceLimit(uint256 _newSubmissionGasPriceLimit) public onlyOwner {
        emit SubmissionGasPriceLimitUpdates(submissionGasPriceLimit, _newSubmissionGasPriceLimit);
        submissionGasPriceLimit = _newSubmissionGasPriceLimit;
    }

    /********** MODIFIERS *****************************************************/

    modifier withGasPriceLimit(uint256 gasPriceLimit) {
        require(tx.gasprice <= gasPriceLimit);
        _;
    }

    /********** WITHDRAWAL FUNCTIONS ******************************************/

    function traderCanWithdraw(address _trader, address _token, uint256 amount) public returns (bool) {
        // In the future, this will return false (i.e. invalid withdrawal) if the
        // trader has open orders for that token
        return true;
    }

    /********** SETTLEMENT FUNCTIONS ******************************************/

    /**
     * @notice (private) Calls the RenExBalances contract to update the balances
     */
    function settleFunds(
        bytes32 _buyID, bytes32 _sellID,
        address highTokenAddress, address lowTokenAddress,
        ExecutionDetails details
    ) private {
        // Subtract values
        renExBalancesContract.decrementBalanceWithFee(
            orderTrader[_buyID], lowTokenAddress, details.lowTokenVolume, details.lowTokenFee, orderSubmitter[_buyID]
        );
        renExBalancesContract.decrementBalanceWithFee(
            orderTrader[_sellID], highTokenAddress, details.highTokenVolume, details.highTokenFee, orderSubmitter[_sellID]
        );

        // Add values
        renExBalancesContract.incrementBalance(orderTrader[_sellID], lowTokenAddress, details.lowTokenVolume);
        renExBalancesContract.incrementBalance(orderTrader[_buyID], highTokenAddress, details.highTokenVolume);
    }

    function subtractDarknodeFee(uint256 value) internal pure returns (uint256, uint256) {
        uint256 newValue = (value * (DARKNODE_FEE_DENOMINATOR - DARKNODE_FEE_NUMERATOR)) / DARKNODE_FEE_DENOMINATOR;
        return (newValue, value - newValue);
    }

    /**
      * @notice Stores the details of an order
      * @param _orderType one of Midpoint or Limit
      * @param _parity one of Buy or Sell
      * @param _expiry the expiry date of the order in seconds since Unix epoch
      * @param _tokens two 32-bit token codes concatenated (with the lowest first)
      * @param _priceC the constant in the price tuple
      * @param _priceQ the exponent in the price tuple
      * @param _volumeC the constant in the volume tuple
      * @param _volumeQ the exponent in the volume tuple
      * @param _minimumVolumeC the constant in the minimum-volume tuple
      * @param _minimumVolumeQ the exponent in the minimum-volume tuple
      * @param _nonceHash the keccak256 hash of a random 32 byte value
      */
    function submitOrder(
        uint8 _orderType,
        uint8 _parity,
        uint64 _expiry,
        uint64 _tokens,
        uint16 _priceC, uint16 _priceQ,
        uint16 _volumeC, uint16 _volumeQ,
        uint16 _minimumVolumeC, uint16 _minimumVolumeQ,
        uint256 _nonceHash
    ) public withGasPriceLimit(submissionGasPriceLimit) {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            orderType: _orderType,
            parity: _parity,
            expiry: _expiry,
            tokens: _tokens,
            priceC: _priceC, priceQ: _priceQ,
            volumeC: _volumeC, volumeQ: _volumeQ,
            minimumVolumeC: _minimumVolumeC, minimumVolumeQ: _minimumVolumeQ,
            nonceHash: _nonceHash
        });

        bytes32 orderID = SettlementUtils.hashOrder(order, SETTLEMENT_IDENTIFIER);

        orderSubmitter[orderID] = msg.sender;

        require(orderStatus[orderID] == OrderStatus.None);
        orderStatus[orderID] = OrderStatus.Submitted;

        require(orderbookContract.orderState(orderID) == 2);

        orderTrader[orderID] = orderbookContract.orderTrader(orderID);

        // Trader should not be 0x0
        // assert(order.trader != 0x0);

        orderDetails[orderID] = order;
    }


    /**
      * @notice Settles two orders that are matched. `submitOrder` must have been
      * called for each order before this function is called.
      *
      * @param _buyID the 32 byte ID of the buy order
      * @param _sellID the 32 byte ID of the sell order
      */
    function submitMatch(bytes32 _buyID, bytes32 _sellID) public {
        require(orderStatus[_buyID] == OrderStatus.Submitted);
        require(orderStatus[_sellID] == OrderStatus.Submitted);

        // Verify details
        SettlementUtils.verifyOrder(orderDetails[_buyID]);
        SettlementUtils.verifyOrder(orderDetails[_sellID]);
        SettlementUtils.verifyMatch(orderDetails[_buyID], orderDetails[_sellID]);

        require(orderbookContract.orderMatch(_buyID)[0] == _sellID);

        uint32 buyToken = uint32(orderDetails[_sellID].tokens);
        uint32 sellToken = uint32(orderDetails[_sellID].tokens >> 32);

        require(renExTokensContract.tokenIsRegistered(buyToken));
        require(renExTokensContract.tokenIsRegistered(sellToken));

        (uint256 lowTokenValue, uint256 highTokenValue) = SettlementUtils.settlementDetails(
            orderDetails[_buyID],
            orderDetails[_sellID],
            renExTokensContract.tokenDecimals(buyToken),
            renExTokensContract.tokenDecimals(sellToken)
        );

        (uint256 lowTokenFinal, uint256 lowTokenFee) = subtractDarknodeFee(lowTokenValue);
        (uint256 highTokenFinal, uint256 highTokenFee) = subtractDarknodeFee(highTokenValue);

        address highTokenAddress = renExTokensContract.tokenAddresses(buyToken);
        address lowTokenAddress = renExTokensContract.tokenAddresses(sellToken);

        bytes32 matchID = keccak256(abi.encodePacked(_buyID, _sellID));
        matchExecutionDetails[matchID] = ExecutionDetails({
            lowTokenVolume: lowTokenFinal,
            highTokenVolume: highTokenFinal,
            lowTokenFee: lowTokenFee,
            highTokenFee: highTokenFee
        });

        settleFunds(_buyID, _sellID, highTokenAddress, lowTokenAddress, matchExecutionDetails[matchID]);

        orderStatus[_buyID] = OrderStatus.Matched;
        orderStatus[_sellID] = OrderStatus.Matched;
    }

    /**
     * @notice (read-only) Returns the volumes transferred between traders and
     * the respective fees
     */
    function getSettlementDetails(bytes32 _buyID, bytes32 _sellID)
    external view returns (uint256, uint256, uint256, uint256) {
        bytes32 matchID = keccak256(abi.encodePacked(_buyID, _sellID));
        return (
            matchExecutionDetails[matchID].lowTokenVolume,
            matchExecutionDetails[matchID].highTokenVolume,
            matchExecutionDetails[matchID].lowTokenFee,
            matchExecutionDetails[matchID].highTokenFee
        );
    }
}
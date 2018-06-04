pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

import "./RenLedger.sol";

contract TraderAccounts is Ownable {
    using SafeMath for uint256;

    RenLedger ledger;

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}

    // TODO: Use same constant instance across all contracts 
    address ETH = 0x0;

    struct Order {
        uint8 parity;
        uint8 orderType;
        uint64 expiry;
        uint64 tokens;        
        uint256 priceC; uint256 priceQ;
        uint256 volumeC; uint256 volumeQ;
        uint256 minimumVolumeC; uint256 minimumVolumeQ;
        uint256 nonceHash;
    }

    // Events
    event Deposit(address trader, uint32 token, uint256 value);
    event Withdraw(address trader, uint32 token, uint256 value);
    event Transfer(address from, address to, uint32 token, uint256 value);
    event Debug256(uint256 num);
    event Debugi256(int256 num);
    event Debug(string msg);


    // Storage
    mapping(bytes32 => Order) private orders;

    mapping(address => uint32[]) private traderTokens;
    mapping(address => mapping(uint32 => bool)) private activeTraderToken;
    mapping(address => mapping(uint32 => uint256)) private balances;

    mapping(uint32 => ERC20) public tokenAddresses;
    mapping(uint32 => uint8) public tokenDecimals;
    mapping(uint32 => bool) public tokenEnabled;
    

    /**
    @notice constructor
    @param _ledger the address for the Ren Ledger
    */
    constructor(RenLedger _ledger) public {
        ledger = _ledger;
    }



    // Contract Registry - TODO: Move to its own contract?

    /**
    @notice Modifier to require tokens to be registered in the token registry
    */
    modifier onlyEnabledToken(uint32 _tokenCode) {
        require(tokenEnabled[_tokenCode]);
        _;
    }

    /**
    @notice Sets a token as being registered and stores its details (only-owner)
    @param _tokenCode a unique 32-bit token identifier
    @param _tokenAddress the address of the ERC20-compatible token
    @param _tokenDecimals the decimals to use for the token
    */
    function registerToken(uint32 _tokenCode, ERC20 _tokenAddress, uint8 _tokenDecimals) public onlyOwner {
        // TODO: Check if contract has a .decimals() call
        tokenAddresses[_tokenCode] = _tokenAddress;
        tokenDecimals[_tokenCode] = _tokenDecimals;
        tokenEnabled[_tokenCode] = true;
    }

    /**
    @notice Sets a token as being deregistered
    @param _tokenCode the unique 32-bit token identifier
    */
    function deregisterToken(uint32 _tokenCode) public onlyOwner {
        tokenEnabled[_tokenCode] = false;
    }



    // PRIVATE functions //
    
    function incrementBalance(address _trader, uint32 _tokenCode, uint256 _value) private {
        // Check if it's the first time the trader
        if (!activeTraderToken[_trader][_tokenCode]) {
            activeTraderToken[_trader][_tokenCode] = true;
            traderTokens[_trader].push(_tokenCode);
            emit Debug256(_tokenCode);
        }

        balances[_trader][_tokenCode] = balances[_trader][_tokenCode].add(_value);
    }

    function decrementBalance(address _trader, uint32 _tokenCode, uint256 _value) private {
        balances[_trader][_tokenCode] = balances[_trader][_tokenCode].sub(_value);
    }




    // Trader functions //

    /**
    @notice Deposits ETH or an ERC20 token into the contract
    @param _tokenCode the token's identifier (must be a registered token)
    @param _value the amount to deposit in the token's smallest unit
    */
    function deposit(uint32 _tokenCode, uint256 _value) payable public onlyEnabledToken(_tokenCode) {
        address trader = msg.sender;

        ERC20 token = tokenAddresses[_tokenCode];

        if (address(token) == ETH) {
            require(msg.value == _value);
        } else {
            require(token.transferFrom(trader, this, _value));
        }
        incrementBalance(trader, _tokenCode, _value);

        emit Deposit(trader, _tokenCode, _value);
    }

    /**
    @notice Withdraws ETH or an ERC20 token from the contract
    @notice TODO: Check if the account has any open orders first
    @param _tokenCode the token's identifier (doesn't have to be registered)
    @param _value the amount to withdraw in the token's smallest unit
    */
    function withdraw(uint32 _tokenCode, uint256 _value) public {
        address trader = msg.sender;

        ERC20 token = tokenAddresses[_tokenCode];

        decrementBalance(trader, _tokenCode, _value);
        if (address(token) == ETH) {
            trader.transfer(_value);
        } else {
            require(token.transfer(trader, _value));
        }

        emit Withdraw(trader, _tokenCode, _value);
    }

    /**
    @notice Retrieves a trader's balance for a token
    @param _trader the address of the trader to retrieve the balance of
    @param _tokenCode the token's identifier (doesn't have to be registered)
    @return the trader's balance in the token's smallest unit
    */
    function getBalance(address _trader, uint32 _tokenCode) public view returns (uint256) {    
        return balances[_trader][_tokenCode];
    }

    /**
    @notice Retrieves the list of token addresses that the trader has previously
    deposited
    @param _trader the address of the trader
    @return an array of addresses of the tokens
    */
    function getTokens(address _trader) public view returns (uint32[]) {
        return traderTokens[_trader];
    }

    /**
    @notice Retrieves the list of token addresses that the trader has previosly
    deposited and a list of the corresponding token balances
    @param _trader the address of the trader
    @return [
        "the array of token addresses",
        "the array of token balances in tokens' smallest units"
    ]
    */
    function getBalances(address _trader) public view returns (uint32[], uint256[]) {
        uint32[] memory tokens = getTokens(_trader);
        uint256[] memory traderBalances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            traderBalances[i] = getBalance(_trader, tokens[i]);
        }

        return (tokens, traderBalances);
    }



    // Price/volume calculation functions

    function priceMidPoint(bytes32 buyID, bytes32 sellID) private view returns (uint256, uint256) {
        // Normalize to same exponent before finding mid-point (mean)
        uint256 norm = orders[sellID].priceC * 10 ** (orders[sellID].priceQ - orders[buyID].priceQ);
        return ((orders[buyID].priceC + norm) / 2, orders[buyID].priceQ);
    }

    function minimumVolume(bytes32 buyID, bytes32 sellID, uint256 priceC, uint256 priceQ) private view returns (uint256, int256) {        
        uint256 buyV = tupleToVolume(orders[buyID].volumeC, int256(orders[buyID].volumeQ), 12);
        uint256 sellV = tupleToScaledVolume(orders[sellID].volumeC, int256(orders[sellID].volumeQ), priceC, priceQ, 12);

        if (buyV < sellV) {
            // TODO: Optimize this process, divide above
            return (orders[buyID].volumeC * 200 / priceC, int256(orders[buyID].volumeQ + 26 + 12) - int256(priceQ));
        } else {
            return (orders[sellID].volumeC, int256(orders[sellID].volumeQ));
        }
    }

    function tupleToScaledVolume(uint256 volC, int256 volQ, uint256 priceC, uint256 priceQ, uint256 decimals)
    private pure returns (uint256) {
        // 0.2 turns into 2 * 10**-1 (-1 moved to exponent)
        // 0.005 turns into 5 * 10**-3 (-3 moved to exponent)
        uint256 c = volC * 5 * priceC * 2;

        // Positive and negative components of exponent
        uint256 ep = priceQ + decimals;
        uint256 en = 26 + 12 + 3 + 12 + 1;
        // Add volQ to positive or negative component based on its sign
        if (volQ < 0) {
            en += uint256(-volQ);
        } else {
            ep += uint256(volQ);
        }

        // If (ep-en) is negative, divide instead of multiplying
        uint256 value;
        if (ep >= en) {
            value = c * 10 ** (ep - en);
        } else {
            value = c / 10 ** (en - ep);            
        }

        return value;
    }


    function tupleToVolume(uint256 volC, int256 volQ, uint256 decimals) private pure returns (uint256) {
        // 0.2 turns into 2 * 10**-1 (-1 moved to exponent)
        uint256 c = 2 * volC;

        // Positive and negative components of exponent                
        uint256 ep = decimals;
        uint256 en = 12 + 1;
        // Add volQ to positive or negative component based on its sign        
        if (volQ < 0) {
            en += uint256(-volQ);
        } else {
            ep += uint256(volQ);
        }

        // If (ep-en) is negative, divide instead of multiplying                
        if (ep >= en) {
            return c * 10 ** (ep - en);
        } else {
            return c / 10 ** (en - ep);
        }
    }

    // Ensure this remains private
    function finalizeMatch(
        address buyer, address seller,
        uint32 buyToken, uint32 sellToken,
        uint256 lowTokenValue, uint256 highTokenValue
    ) private {
        // Subtract values
        decrementBalance(buyer, sellToken, lowTokenValue);
        decrementBalance(seller, buyToken, highTokenValue);

        // Add values
        incrementBalance(seller, sellToken, lowTokenValue);
        incrementBalance(buyer, buyToken, highTokenValue);

        emit Transfer(buyer, seller, sellToken, lowTokenValue);
        emit Transfer(seller, buyer, buyToken, highTokenValue);
    }



    // // TODO: Implemnet
    // function hashOrder(Order order) private pure returns (bytes32) {
    //     return keccak256(
    //         abi.encodePacked(
    //             order.orderType,
    //             order.parity,
    //             order.expiry,
    //             order.tokens,
    //             order.priceC, order.priceQ,
    //             order.volumeC, order.volumeQ,
    //             order.minimumVolumeC, order.minimumVolumeQ,
    //             order.nonceHash
    //         )
    //     );
    // }




    /**
    @notice Stores the details of an order
    @param _id (TODO: calculate based on other parameters)
    @param _orderType one of Midpoint or Limit
    @param _parity one of Buy or Sell
    @param _expiry the expiry date of the order in seconds since Unix epoch
    @param _tokens two 32-bit token codes concatenated (with the lowest first)
    @param _priceC the constant in the price tuple
    @param _priceQ the exponent in the price tuple
    @param _volumeC the constant in the volume tuple
    @param _volumeQ the exponent in the volume tuple
    @param _minimumVolumeC the constant in the minimum-volume tuple
    @param _minimumVolumeQ the exponent in the minimum-volume tuple
    @param _nonceHash the keccak256 hash of a random 32 byte value
    */
    function submitOrder(
        bytes32 _id,
        uint8 _orderType,
        uint8 _parity,
        uint64 _expiry,
        uint64 _tokens,
        uint16 _priceC, uint16 _priceQ,
        uint16 _volumeC, uint16 _volumeQ,
        uint16 _minimumVolumeC, uint16 _minimumVolumeQ,
        uint256 _nonceHash
    ) public {

        Order memory order = Order({
            orderType: _orderType,
            parity: _parity,
            expiry: _expiry,
            tokens: _tokens,
            priceC: _priceC, priceQ: _priceQ,
            volumeC: _volumeC, volumeQ: _volumeQ,
            minimumVolumeC: _minimumVolumeC, minimumVolumeQ: _minimumVolumeQ,
            nonceHash: _nonceHash
        });

        // FIXME: Implement order hashing
        // bytes32 id = hashOrder(order);

        orders[_id] = order;
    }

    /**
    @notice Settles two orders that are matched. `submitOrder` must have been
    called for each order before this function is called
    @param _buyID the 32 byte ID of the buy order
    @param _sellID the 32 byte ID of the sell order
    */
    function submitMatch(bytes32 _buyID, bytes32 _sellID) public {
        // TODO: Verify order match

        // Require that the orders are confirmed to one another
        require(orders[_buyID].parity == uint8(OrderParity.Buy));
        require(orders[_sellID].parity == uint8(OrderParity.Sell));
        require(ledger.orderState(_buyID) == 2);
        require(ledger.orderState(_sellID) == 2);
        
        // TODO: Loop through and check at all indices
        require(ledger.orderMatch(_buyID)[0] == _sellID);

        address buyer = ledger.orderTrader(_buyID);
        address seller = ledger.orderTrader(_sellID);

        uint32 buyToken = uint32(orders[_sellID].tokens);
        uint32 sellToken = uint32(orders[_sellID].tokens >> 32);

        // Price midpoint
        (uint256 midPriceC, uint256 midPriceQ) = priceMidPoint(_buyID, _sellID);
        
        (uint256 minVolC, int256 minVolQ) = minimumVolume(_buyID, _sellID, midPriceC, midPriceQ);

        uint256 lowTokenValue = tupleToScaledVolume(minVolC, minVolQ, midPriceC, midPriceQ, tokenDecimals[sellToken]);

        uint256 highTokenValue = tupleToVolume(minVolC, minVolQ, tokenDecimals[buyToken]);

        finalizeMatch(buyer, seller, buyToken, sellToken, lowTokenValue, highTokenValue);
    }

}
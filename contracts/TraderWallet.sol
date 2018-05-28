pragma solidity ^0.4.23;

// pragma experimental ABIEncoderV2;

import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TraderWallet {
    using SafeMath for uint256;

    // TODO: Use same constant instance across all contracts 
    address ETH = 0x0;

    struct Order {
        uint256 priceC;
        uint256 priceQ;
        uint256 volumeC;
        uint256 volumeQ;
        uint256 minimumVolumeC;
        uint256 minimumVolumeQ;
        address trader;
        DetailedERC20 wantToken;
        bytes32 nonceHash;
    }

    event Deposit(address trader, address token, uint256 value);
    event Withdraw(address trader, address token, uint256 value);
    event Transfer(address from, address to, address token, uint256 value);
    event Debug256(uint256 num);

    mapping(uint256 => Order) private orders;

    mapping(address => DetailedERC20[]) private traderTokens;
    mapping(address => mapping(address => bool)) private activeTraderToken;
    mapping(address => mapping(address => uint256)) private balances;

    
    // CONSTRUCTOR //

    constructor() public {}


    
    // PRIVATE functions //
    
    function incrementBalance(address _trader, DetailedERC20 _token, uint256 _value) private {
        // Check if it's the first time the trader
        if (!activeTraderToken[_trader][_token]) {
            activeTraderToken[_trader][_token] = true;
            traderTokens[_trader].push(_token);
        }

        balances[_trader][_token] = balances[_trader][_token].add(_value);
    }

    function decrementBalance(address _trader, DetailedERC20 _token, uint256 _value) private {
        balances[_trader][_token] = balances[_trader][_token].sub(_value);
    }




    // Trader functions //

    function deposit(DetailedERC20 _token, uint256 _value) payable public {
        address trader = msg.sender;

        if (address(_token) == ETH) {
            require(msg.value == _value);
        } else {
            require(_token.transferFrom(trader, this, _value));
        }
        incrementBalance(trader, _token, _value);

        emit Deposit(trader, _token, _value);
    }

    function withdraw(DetailedERC20 _token, uint256 _value) public {
        address trader = msg.sender;

        decrementBalance(trader, _token, _value);
        if (address(_token) == ETH) {
            trader.transfer(_value);
        } else {
            require(_token.transfer(trader, _value));
        }

        emit Withdraw(trader, _token, _value);
    }

    function getBalance(address _trader, DetailedERC20 _token) public view returns (uint256) {
        return balances[_trader][_token];
    }

    function getTokens(address _trader) public view returns (DetailedERC20[]) {
        return traderTokens[_trader];
    }

    function getBalances(address _trader) public view returns (DetailedERC20[], uint256[]) {
        DetailedERC20[] memory tokens = getTokens(_trader);
        uint256[] memory traderBalances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            traderBalances[i] = getBalance(_trader, tokens[i]);
        }

        return (tokens, traderBalances);
    }







// const LOW_DECIMALS = 18;
// const HIGH_DECIMALS = 8;


// const tupleGTE = (left: Tuple, right: Tuple): boolean => {
//     if (left.q < right.q) {
//         const norm = right.c * 10 ** (right.q - left.q);
//         return left.c >= norm;
//     } else {
//         const norm = left.c * 10 ** (left.q - right.q);
//         return norm >= right.c;
//     }
// }


// const main = (buy: Order, sell: Order) => {
//     // Check that buy.price >= sell.price
//     if (!tupleGTE(buy.price, sell.price)) { return new AssertionError({ message: "buy price is less than sell price" }); }
//     // // Check that buy.volume >= sell.minimumVolume
//     // if (!tupleGTE(buy.volume, sell.minimumVolume)) { return new AssertionError({ message: "buy volume is less than sell minimum volume" }); }
//     // // Check that sell.volume >= buy.minimumVolume
//     // if (!tupleGTE(sell.volume, buy.minimumVolume)) { return new AssertionError({ message: "sell volume is less than buy minimum volume" }); }

//     const midPrice = priceMidPoint(buy.price, sell.price);

//     const minVolume = minimumVolume(sell.volume, midPrice, buy.volume);
//     const ratio = tupleToVolume(minVolume) / tupleToPrice(midPrice);
//     const lowValue = ratio * 10 ** LOW_DECIMALS;
//     const highValue = tupleToVolume(minVolume) * 10 ** HIGH_DECIMALS;

//     return `Bought ${lowValue} △ for ${highValue} ○`; // /* * 10 ** (-8) */ };
// }








    // function priceMidPoint(uint256 buyID, uint256 sellID) public view returns (uint256, uint256) {
    //     uint256 norm = orders[sellID].priceC * 10 ** (orders[sellID].priceQ - orders[buyID].priceC);
    //     return ((orders[buyID].priceC + norm) / 2, orders[buyID].priceQ);
    // }


    // function minimumVolume(uint256 buyID, uint256 sellID)
    //     public view returns (uint256, uint256)
    //     {
        
    //     uint256 normC = orders[buyID].priceC * orders[buyID].volumeC * 5;
    //     // TODO: Will overflow!
    //     uint256 normQ = orders[buyID].volumeQ + 26 - orders[buyID].priceQ - 3;
    //     emit Debug256(normQ);


    //     uint256 norm;
    //     if (normQ < orders[sellID].priceQ) {
    //         norm = orders[sellID].volumeC * 10 ** (orders[sellID].volumeQ - normQ);
    //         return (norm < normC) ? (orders[sellID].volumeC, orders[sellID].volumeQ) : (normC, normQ);
    //     } else {
    //         norm = normC * 10 ** (normQ - orders[sellID].volumeQ);
    //         return (norm < orders[sellID].volumeQ) ? (normC, normQ) : (orders[sellID].volumeC, orders[sellID].volumeQ);
    //     }
    // }



    // function tupleLessThan(uint256 c1, uint256 q1, uint256 c2, uint256 q2, uint256 step) public pure returns (bool) {
    //     uint256 norm = step * c2 * 10 ** (q2 - q1);
    //     return norm < c1;
    // }
 
    // // Verifier functions //

    // function submitOrder(
    //     uint256 id,
    //     uint256 priceC, uint256 priceQ, uint256 volumeC, uint256 volumeQ, uint256 minimumVolumeC, uint256 minimumVolumeQ, address trader, DetailedERC20 wantToken, bytes32 nonceHash
    // ) public {
    //     orders[id] = Order({
    //         priceC: priceC,
    //         priceQ: priceQ,
    //         volumeC: volumeC,
    //         volumeQ: volumeQ,
    //         minimumVolumeC: minimumVolumeC,
    //         minimumVolumeQ: minimumVolumeQ,
    //         trader: trader,
    //         wantToken: wantToken,
    //         nonceHash: nonceHash
    //     });
    // }

    // function verifyMatch(uint256 buyID, uint256 sellID) public {
    //     require(
    //         tupleLessThan(
    //             orders[sellID].priceC,
    //             orders[sellID].priceQ,
    //             orders[buyID].priceC,
    //             orders[buyID].priceQ,
    //             1
    //         )
    //     );

    //     require(
    //         tupleLessThan(
    //             orders[sellID].priceC,
    //             orders[sellID].priceQ,
    //             orders[buyID].priceC,
    //             orders[buyID].priceQ,
    //             1
    //         )
    //     );
    // }

    // function submitMatch(uint256 buyID, uint256 sellID) public {
    //     // TODO: Verify order match

    //     // uint8 highDecimals = orders[buyID].wantToken.decimals();
    //     // uint8 lowDecimals = orders[sellID].wantToken.decimals();

    //     // uint256 volumeC = orders[sellID].volumeC;
    //     // uint256 volumeQ = orders[sellID].volumeQ;

    //     uint256 midC;
    //     uint256 midQ;
    //     uint256 minC;
    //     uint256 minQ;
    //     // (midC, midQ) = midPoint(orders[buyID].priceC, orders[buyID].priceQ, orders[sellID].priceC, orders[sellID].priceQ);

    //     // // TODO: Check for overflows / negatives / decimals
    //     // uint256 e1 = volumeQ + orders[sellID].wantToken.decimals() - 12 - 1;
    //     // uint256 lowValue = volumeC * 2 * 10**e1;
    //     // uint256 e2 = volumeQ + 25 + orders[buyID].wantToken.decimals() - midQ - 12 - 1 - 1;
    //     // uint256 highValue = (volumeC * 2 * midC * 1) * 10**e2;

    //     // uint256 (midPriceC, midPriceQ) = priceMidPoint(buy.price, sell.price);
    //     (midC, midQ) = priceMidPoint(buyID, sellID);
        
    //     (minC, minQ) = minimumVolume(buyID, sellID);

    //     uint256 e0 = minQ + 26 + 1 - midQ;
    //     uint256 ratio = (4 * minC * 10 ** e0) / (midC);
    //     uint256 lowValue = ratio * 10 ** orders[buyID].wantToken.decimals();
    //     Debug256(orders[sellID].wantToken.decimals());
    //     Debug256(minQ);
    //     uint256 e2 = (orders[sellID].wantToken.decimals() + minQ - 12 - 1);
    //     uint256 highValue = 2 * minC * 10 ** e2;

    //     Debug256(e0);
    //     Debug256(ratio);

    //     // Subtract values
    //     decrementBalance(orders[buyID].trader, orders[sellID].wantToken, highValue);
    //     decrementBalance(orders[sellID].trader, orders[buyID].wantToken, lowValue);

    //     // // Add values
    //     incrementBalance(orders[sellID].trader, orders[sellID].wantToken, highValue);
    //     incrementBalance(orders[buyID].trader, orders[buyID].wantToken, lowValue);

    //     emit Transfer(orders[buyID].trader, orders[sellID].trader, orders[sellID].wantToken, highValue);
    //     emit Transfer(orders[sellID].trader, orders[buyID].trader, orders[buyID].wantToken, lowValue);
    // }
 
}
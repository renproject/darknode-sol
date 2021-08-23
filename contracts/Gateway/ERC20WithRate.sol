pragma solidity 0.5.17;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

import "../Governance/Claimable.sol";

/// @notice ERC20WithRate allows for a more dynamic fee model by storing a rate
/// that tracks the number of the underlying asset's unit represented by a
/// single ERC20 token.
contract ERC20WithRate is Initializable, Ownable, ERC20 {
    using SafeMath for uint256;

    uint256 public constant _rateScale = 1e18;
    uint256 internal _rate;

    event LogRateChanged(uint256 indexed _rate);

    /* solium-disable-next-line no-empty-blocks */
    function initialize(address _nextOwner, uint256 _initialRate)
        public
        initializer
    {
        Ownable.initialize(_nextOwner);
        _setRate(_initialRate);
    }

    function setExchangeRate(uint256 _nextRate) public onlyOwner {
        _setRate(_nextRate);
    }

    function exchangeRateCurrent() public view returns (uint256) {
        require(_rate != 0, "ERC20WithRate: rate has not been initialized");
        return _rate;
    }

    function _setRate(uint256 _nextRate) internal {
        require(_nextRate > 0, "ERC20WithRate: rate must be greater than zero");
        _rate = _nextRate;
    }

    function balanceOfUnderlying(address _account)
        public
        view
        returns (uint256)
    {
        return toUnderlying(balanceOf(_account));
    }

    function toUnderlying(uint256 _amount) public view returns (uint256) {
        return _amount.mul(_rate).div(_rateScale);
    }

    function fromUnderlying(uint256 _amountUnderlying)
        public
        view
        returns (uint256)
    {
        return _amountUnderlying.mul(_rateScale).div(_rate);
    }
}

pragma solidity 0.5.16;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

/// @notice RenERC20 represents a digital asset that has been bridged on to
/// the Ethereum ledger. It exposes mint and burn functions that can only be
/// called by it's associated Gateway contract.
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
        return multiplyByRate(balanceOf(_account));
    }

    function multiplyByRate(uint256 _value) public view returns (uint256) {
        return _value.mul(_rate).div(_rateScale);
    }

    function divideByRate(uint256 _value) public view returns (uint256) {
        return _value.mul(_rateScale).div(_rate);
    }
}

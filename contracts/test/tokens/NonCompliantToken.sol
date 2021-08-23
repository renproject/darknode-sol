pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract NCT_ERC20Basic {
    uint256 public totalSupply;

    function balanceOf(address who) public view returns (uint256);

    function transfer(address to, uint256 value) public;

    event Transfer(address indexed from, address indexed to, uint256 value);
}

contract NCT_BasicToken is NCT_ERC20Basic {
    using SafeMath for uint256;

    mapping(address => uint256) balances;

    modifier onlyPayloadSize(uint256 size) {
        if (msg.data.length < size + 4) {
            revert();
        }
        _;
    }

    function transfer(address _to, uint256 _value)
        public
        onlyPayloadSize(2 * 32)
    {
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
    }

    function balanceOf(address _owner) public view returns (uint256 balance) {
        return balances[_owner];
    }
}

contract NCT_ERC20 is NCT_ERC20Basic {
    function allowance(address owner, address spender)
        public
        view
        returns (uint256);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public;

    function approve(address spender, uint256 value) public;

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

contract NCT_StandardToken is NCT_BasicToken, NCT_ERC20 {
    mapping(address => mapping(address => uint256)) allowed;

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public onlyPayloadSize(3 * 32) {
        uint256 _allowance = allowed[_from][msg.sender];

        balances[_to] = balances[_to].add(_value);
        balances[_from] = balances[_from].sub(_value);
        allowed[_from][msg.sender] = _allowance.sub(_value);
        emit Transfer(_from, _to, _value);
    }

    function approve(address _spender, uint256 _value) public {
        if ((_value != 0) && (allowed[msg.sender][_spender] != 0)) revert();

        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
    }

    function allowance(address _owner, address _spender)
        public
        view
        returns (uint256 remaining)
    {
        return allowed[_owner][_spender];
    }
}

contract NonCompliantToken is NCT_StandardToken {
    string public constant name = "Non Compliant Token";
    string public constant symbol = "NCT";
    uint8 public constant decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**uint256(decimals);

    constructor() public {
        totalSupply = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
    }
}

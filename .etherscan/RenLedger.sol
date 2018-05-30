pragma solidity ^0.4.24;

/**
 * @notice LinkedList is a library for a circular double linked list.
 */
library LinkedList {

    /*
    * @notice A permanent NULL node (0x0) in the circular double linked list.
    * NULL.next is the head, and NULL.previous is the tail.
    */
    bytes20 public constant NULL = 0x0;

    /**
    * @notice A node points to the node before it, and the node after it. If
    * node.previous = NULL, then the node is the head of the list. If
    * node.next = NULL, then the node is the tail of the list.
    */
    struct Node {
        bool inList;
        bytes20 previous;
        bytes20 next;
    }
    
    /**
    * @notice LinkedList uses a mapping from bytes20s to nodes. Each bytes20
    * uniquely identifies a node, and in this way they are used like pointers.
    */
    struct List {
        mapping (bytes20 => Node) list;
    }

    function isInList(List storage self, bytes20 node) internal view returns (bool) {
        return self.list[node].inList;
    }

    /**
    * @notice Get the node at the beginning of a double linked list.
    *
    * @param self The list being used.
    *
    * @return A bytes20 identifying the node at the beginning of the double
    * linked list.
    */
    function begin(List storage self) internal view returns (bytes20) {
        return self.list[NULL].next;
    }

    /**
    * @notice Get the node at the end of a double linked list.
    *
    * @param self The list being used.
    *
    * @return A bytes20 identifying the node at the end of the double linked
    * list.
    */
    function end(List storage self) internal view returns (bytes20) {
        return self.list[NULL].previous;
    }

    function next(List storage self, bytes20 node) internal view returns (bytes20) {
        require(isInList(self, node));
        return self.list[node].next;
    }

    function previous(List storage self, bytes20 node) internal view returns (bytes20) {
        require(isInList(self, node));
        return self.list[node].previous;
    }

    /**
    * @notice Insert a new node before an existing node.
    *
    * @param self The list being used.
    * @param target The existing node in the list.
    * @param newNode The next node to insert before the target.
    */
    function insertBefore(List storage self, bytes20 target, bytes20 newNode) internal {
        require(!isInList(self, newNode));
        require(isInList(self, target) || target == NULL);

        // It is expected that this value is sometimes NULL.
        bytes20 prev = self.list[target].previous;

        self.list[newNode].next = target;
        self.list[newNode].previous = prev;
        self.list[target].previous = newNode;
        self.list[prev].next = newNode;

        self.list[newNode].inList = true;
    }

    /**
    * @notice Insert a new node after an existing node.
    *
    * @param self The list being used.
    * @param target The existing node in the list.
    * @param newNode The next node to insert after the target.
    */
    function insertAfter(List storage self, bytes20 target, bytes20 newNode) internal {
        require(!isInList(self, newNode));
        require(isInList(self, target) || target == NULL);

        // It is expected that this value is sometimes NULL.
        bytes20 n = self.list[target].next;

        self.list[newNode].previous = target;
        self.list[newNode].next = n;
        self.list[target].next = newNode;
        self.list[n].previous = newNode;

        self.list[newNode].inList = true;
    }
    
    /**
    * @notice Remove a node from the list, and fix the previous and next
    * pointers that are pointing to the removed node. Removing anode that is not
    * in the list will do nothing.
    *
    * @param self The list being using.
    * @param node The node in the list to be removed.
    */
    function remove(List storage self, bytes20 node) internal {
        require(isInList(self, node));
        if (node == NULL) {
            return;
        }
        bytes20 p = self.list[node].previous;
        bytes20 n = self.list[node].next;

        self.list[p].next = n;
        self.list[n].previous = p;

        // Deleting the node should set this value to false, but we set it here for
        // explicitness.
        self.list[node].inList = false;
        delete self.list[node];
    }

    /**
    * @notice Insert a node at the beginning of the list.
    *
    * @param self The list being used.
    * @param node The node to insert at the beginning of the list.
    */
    function prepend(List storage self, bytes20 node) internal {
        require(!isInList(self, node));
        insertBefore(self, begin(self), node);
    }

    /**
    * @notice Insert a node at the end of the list.
    *
    * @param self The list being used.
    * @param node The node to insert at the end of the list.
    */
    function append(List storage self, bytes20 node) internal {
        require(!isInList(self, node));
        insertAfter(self, end(self), node);
    }

    function swap(List storage self, bytes20 left, bytes20 right) internal {
        require(isInList(self, left));
        require(isInList(self, right));
        bytes20 previousRight = self.list[right].previous;
        remove(self, right);
        insertAfter(self, left, right);
        remove(self, left);
        insertAfter(self, previousRight, left);
    }
}

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
  function totalSupply() public view returns (uint256);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }
    uint256 c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}

/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract BasicToken is ERC20Basic {
  using SafeMath for uint256;

  mapping(address => uint256) balances;

  uint256 totalSupply_;

  /**
  * @dev total number of tokens in existence
  */
  function totalSupply() public view returns (uint256) {
    return totalSupply_;
  }

  /**
  * @dev transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(address _to, uint256 _value) public returns (bool) {
    require(_to != address(0));
    require(_value <= balances[msg.sender]);

    // SafeMath.sub will throw if there is not enough balance.
    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);
    Transfer(msg.sender, _to, _value);
    return true;
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param _owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address _owner) public view returns (uint256 balance) {
    return balances[_owner];
  }

}

/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
  function allowance(address owner, address spender) public view returns (uint256);
  function transferFrom(address from, address to, uint256 value) public returns (bool);
  function approve(address spender, uint256 value) public returns (bool);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic standard token.
 * @dev https://github.com/ethereum/EIPs/issues/20
 * @dev Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract StandardToken is ERC20, BasicToken {

  mapping (address => mapping (address => uint256)) internal allowed;


  /**
   * @dev Transfer tokens from one address to another
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amount of tokens to be transferred
   */
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
    require(_to != address(0));
    require(_value <= balances[_from]);
    require(_value <= allowed[_from][msg.sender]);

    balances[_from] = balances[_from].sub(_value);
    balances[_to] = balances[_to].add(_value);
    allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
    Transfer(_from, _to, _value);
    return true;
  }

  /**
   * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
   *
   * Beware that changing an allowance with this method brings the risk that someone may use both the old
   * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
   * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
   * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens to be spent.
   */
  function approve(address _spender, uint256 _value) public returns (bool) {
    allowed[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
    return true;
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param _owner address The address which owns the funds.
   * @param _spender address The address which will spend the funds.
   * @return A uint256 specifying the amount of tokens still available for the spender.
   */
  function allowance(address _owner, address _spender) public view returns (uint256) {
    return allowed[_owner][_spender];
  }

  /**
   * @dev Increase the amount of tokens that an owner allowed to a spender.
   *
   * approve should be called when allowed[_spender] == 0. To increment
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _addedValue The amount of tokens to increase the allowance by.
   */
  function increaseApproval(address _spender, uint _addedValue) public returns (bool) {
    allowed[msg.sender][_spender] = allowed[msg.sender][_spender].add(_addedValue);
    Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    return true;
  }

  /**
   * @dev Decrease the amount of tokens that an owner allowed to a spender.
   *
   * approve should be called when allowed[_spender] == 0. To decrement
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * @param _spender The address which will spend the funds.
   * @param _subtractedValue The amount of tokens to decrease the allowance by.
   */
  function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool) {
    uint oldValue = allowed[msg.sender][_spender];
    if (_subtractedValue > oldValue) {
      allowed[msg.sender][_spender] = 0;
    } else {
      allowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
    }
    Approval(msg.sender, _spender, allowed[msg.sender][_spender]);
    return true;
  }

}

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  function Ownable() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0));
    OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

}

/**
 * @title Pausable
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 */
contract Pausable is Ownable {
  event Pause();
  event Unpause();

  bool public paused = false;


  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPaused() {
    require(!paused);
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   */
  modifier whenPaused() {
    require(paused);
    _;
  }

  /**
   * @dev called by the owner to pause, triggers stopped state
   */
  function pause() onlyOwner whenNotPaused public {
    paused = true;
    Pause();
  }

  /**
   * @dev called by the owner to unpause, returns to normal state
   */
  function unpause() onlyOwner whenPaused public {
    paused = false;
    Unpause();
  }
}

/**
 * @title Pausable token
 * @dev StandardToken modified with pausable transfers.
 **/
contract PausableToken is StandardToken, Pausable {

  function transfer(address _to, uint256 _value) public whenNotPaused returns (bool) {
    return super.transfer(_to, _value);
  }

  function transferFrom(address _from, address _to, uint256 _value) public whenNotPaused returns (bool) {
    return super.transferFrom(_from, _to, _value);
  }

  function approve(address _spender, uint256 _value) public whenNotPaused returns (bool) {
    return super.approve(_spender, _value);
  }

  function increaseApproval(address _spender, uint _addedValue) public whenNotPaused returns (bool success) {
    return super.increaseApproval(_spender, _addedValue);
  }

  function decreaseApproval(address _spender, uint _subtractedValue) public whenNotPaused returns (bool success) {
    return super.decreaseApproval(_spender, _subtractedValue);
  }
}

/**
 * @title Burnable Token
 * @dev Token that can be irreversibly burned (destroyed).
 */
contract BurnableToken is BasicToken {

  event Burn(address indexed burner, uint256 value);

  /**
   * @dev Burns a specific amount of tokens.
   * @param _value The amount of token to be burned.
   */
  function burn(uint256 _value) public {
    require(_value <= balances[msg.sender]);
    // no need to require value <= totalSupply, since that would imply the
    // sender's balance is greater than the totalSupply, which *should* be an assertion failure

    address burner = msg.sender;
    balances[burner] = balances[burner].sub(_value);
    totalSupply_ = totalSupply_.sub(_value);
    Burn(burner, _value);
    Transfer(burner, address(0), _value);
  }
}

contract RepublicToken is PausableToken, BurnableToken {

    string public constant name = "Republic Token";
    string public constant symbol = "REN";
    uint8 public constant decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**uint256(decimals);
    uint256 public totalSupply;
    
    /**
      * @notice The RepublicToken Constructor.
      */
    constructor() public {
        totalSupply = INITIAL_SUPPLY;   
        balances[msg.sender] = INITIAL_SUPPLY;
    }

    function transferTokens(address beneficiary, uint256 amount) public onlyOwner returns (bool) {
        require(amount > 0);

        balances[owner] = balances[owner].sub(amount);
        balances[beneficiary] = balances[beneficiary].add(amount);
        emit Transfer(owner, beneficiary, amount);

        return true;
    }

    function transfer(address _to, uint256 _value) public whenNotPaused returns (bool) {
        // Do not allow sending REN to this contract
        require(_to != address(this));
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) public whenNotPaused returns (bool) {
        // Do not allow sending REN to this contract
        require(_to != address(this));
        return super.transferFrom(_from, _to, _value);
    }
}

/**
 * @notice DarknodeRegistry is responsible for the registration and
 * deregistration of dark nodes.
 */
contract DarknodeRegistry {

    struct Epoch {
        uint256 epochhash;
        uint256 timestamp;
    }

    /**
    * @notice Darknodes are stored in the darknodes. The owner is the address that
    * registered the darknode, the bond is the amount of REN that was transferred
    * during registration, and the public key is the encryption key that should
    * be used when sending sensitive information to the darknode. The commitment
    * and the 
    */
    struct Darknode {
        address owner;
        uint256 bond;
        uint256 registeredAt;
        uint256 deregisteredAt;
        bytes publicKey;
    }

    // Republic ERC20 token contract used to transfer bonds.
    RepublicToken ren;

    // Registry data.
    mapping(bytes20 => Darknode) private darknodeRegistry;
    LinkedList.List private darknodes;
    uint256 public numDarknodes;
    uint256 public numDarknodesNextEpoch;

    // Constants used to parameterize behavior.
    uint256 public minimumBond;
    uint256 public minimumDarkPoolSize;
    uint256 public minimumEpochInterval;

    // The current epoch and the minimum time interval until the next epoch.
    Epoch public currentEpoch;

    /**
    * @notice Emitted when a darknode is registered.
    * 
    * @param _darknodeID The darknode ID that was registered.
    * @param _bond The amount of REN that was transferred as bond.
    */
    event DarknodeRegistered(bytes20 _darknodeID, uint256 _bond);

    /**
    * @notice Emitted when a darknode is deregistered.
    * 
    * @param _darknodeID The darknode ID that was deregistered.
    */
    event DarknodeDeregistered(bytes20 _darknodeID);

    /**
    * @notice Emitted when a refund has been made.
    *
    * @param _owner The address that was refunded.
    * @param _amount The amount of REN that was refunded.
    */
    event OwnerRefunded(address _owner, uint256 _amount);

    /**
    * @notice Emitted when a new epoch has begun
    */
    event NewEpoch();

    /**
    * @notice Only allow the owner that registered the darknode to pass.
    */
    modifier onlyOwner(bytes20 _darknodeID) {
        require(darknodeRegistry[_darknodeID].owner == msg.sender);
        _;
    }

    /**
    * @notice Only allow unregistered dark nodes.
    */
    modifier onlyUnregistered(bytes20 _darknodeID) {
        require(isUnregistered(_darknodeID));
        _;
    }

    /**
    * @notice Only allow registered dark nodes.
    */
    modifier onlyRegistered(bytes20 _darknodeID) {
        require(isRegistered(_darknodeID));
        _;
    }

    /**
    * @notice Only allow deregistered dark nodes.
    */
    modifier onlyDeregistered(bytes20 _darknodeID) {
        require(isDeregistered(_darknodeID));
        _;
    }

    /** 
    * @notice The DarknodeRegistry constructor.
    *
    * @param _token The address of the RepublicToken contract.
    * @param _minimumBond The minimum bond amount that can be submitted by a
    *                     darknode.
    * @param _minimumDarkPoolSize The minimum size of a dark pool.
    * @param _minimumEpochInterval The minimum amount of time between epochs.
    */
    constructor(address _token, uint256 _minimumBond, uint256 _minimumDarkPoolSize, uint256 _minimumEpochInterval) public {
        ren = RepublicToken(_token);
        minimumBond = _minimumBond;
        minimumDarkPoolSize = _minimumDarkPoolSize;
        minimumEpochInterval = _minimumEpochInterval;
        currentEpoch = Epoch({
            epochhash: uint256(blockhash(block.number - 1)),
            timestamp: block.timestamp
        });
        numDarknodes = 0;
        numDarknodesNextEpoch = 0;
    }

    /**
    * @notice Progress the epoch if it is possible and necessary to do so. This
    * captures the current timestamp and current blockhash and overrides the
    * current epoch.
    */
    function epoch() public {
        require(block.timestamp > currentEpoch.timestamp + minimumEpochInterval);

        uint256 epochhash = uint256(blockhash(block.number - 1));

        // Update the epoch hash and timestamp
        currentEpoch = Epoch({
            epochhash: epochhash,
            timestamp: currentEpoch.timestamp + minimumEpochInterval
        });
        
        // Update the registry information
        numDarknodes = numDarknodesNextEpoch;

        // Emit an event
        emit NewEpoch();
    }

    /** 
    * @notice Register a dark node and transfer the bond to this contract. The
    * caller must provide a public encryption key for the dark node as well as a
    * bond in REN. The bond must be provided as an ERC20 allowance. The dark
    * node will remain pending registration until the next epoch. Only after
    * this period can the dark node be deregistered. The caller of this method
    * will be stored as the owner of the dark node.
    *
    * @param _darknodeID The dark node ID that will be registered.
    * @param _publicKey The public key of the dark node. It is stored to allow
    *                   other dark nodes and traders to encrypt messages to the
    *                   trader.
    * @param _bond The bond that will be paid. It must be greater than, or equal
    *              to, the minimum bond.
    */
    function register(bytes20 _darknodeID, bytes _publicKey, uint256 _bond) public onlyUnregistered(_darknodeID) {
        // REN allowance
        require(_bond >= minimumBond);
        require(ren.allowance(msg.sender, address(this)) >= _bond);
        require(ren.transferFrom(msg.sender, address(this), _bond));

        // Flag this dark node for registration
        darknodeRegistry[_darknodeID] = Darknode({
            owner: msg.sender,
            bond: _bond,
            publicKey: _publicKey,
            registeredAt: currentEpoch.timestamp + minimumEpochInterval,
            deregisteredAt: 0
        });
        LinkedList.append(darknodes, _darknodeID);
        numDarknodesNextEpoch++;

        // Emit an event.
        emit DarknodeRegistered(_darknodeID, _bond);
    }

    /** 
    * @notice Deregister a dark node. The dark node will not be deregisterd
    * until the end of the epoch. At this time, the bond can be refunded by
    * calling the refund method.
    *
    * @param _darknodeID The dark node ID that will be deregistered. The caller
    *                    of this method must be the owner of this dark node.
    */
    function deregister(bytes20 _darknodeID) public onlyRegistered(_darknodeID) onlyOwner(_darknodeID) {
        // Flag the dark node for deregistration
        darknodeRegistry[_darknodeID].deregisteredAt = currentEpoch.timestamp + minimumEpochInterval;
        numDarknodesNextEpoch--;

        // Emit an event
        emit DarknodeDeregistered(_darknodeID);
    }

    /** 
    * @notice Refund the bond of a deregistered dark node. This will make the
    * dark node available for registration again.
    *
    * @param _darknodeID The dark node ID that will be refunded. The caller
    *                    of this method must be the owner of this dark node.
    */
    function refund(bytes20 _darknodeID) public onlyOwner(_darknodeID) onlyDeregistered(_darknodeID) {
        // Remember the bond amount
        uint256 amount = darknodeRegistry[_darknodeID].bond;
        require(amount > 0);

        // Erase the dark node from the registry
        LinkedList.remove(darknodes, _darknodeID);
        darknodeRegistry[_darknodeID] = Darknode({
            owner: 0x0,
            bond: 0,
            publicKey: "",
            registeredAt: 0,
            deregisteredAt: 0
        });

        // Refund the owner by transferring REN
        require(ren.transfer(msg.sender, amount));

        // Emit an event.
        emit OwnerRefunded(msg.sender, amount);
    }

    function getOwner(bytes20 _darknodeID) public view returns (address) {
        return darknodeRegistry[_darknodeID].owner;
    }

    function getBond(bytes20 _darknodeID) public view returns (uint256) {
        return darknodeRegistry[_darknodeID].bond;
    }
    
    function getPublicKey(bytes20 _darknodeID) public view returns (bytes) {
        return darknodeRegistry[_darknodeID].publicKey;
    }

    function getDarknodes() public view returns (bytes20[]) {
        bytes20[] memory nodes = new bytes20[](numDarknodes);

        // Begin with the first node in the list
        uint256 n = 0;
        bytes20 next = LinkedList.begin(darknodes);

        // Iterate until all registered dark nodes have been collected
        while (n < numDarknodes) {
        // Only include registered dark nodes
            if (!isRegistered(next)) {
                next = LinkedList.next(darknodes, next);
                continue;
            }
            nodes[n] = next;
            next = LinkedList.next(darknodes, next);
            n++;
        }

        return nodes;
    }

    /**
    * An unregistered dark node is not registered, deregistered, pending
    * registration, or pending deregistration. The only dark nodes that are
    * unregistered are ones that have never been registered, or have been
    * refunded.
    */
    function isUnregistered(bytes20 _darknodeID) public view returns (bool) {
        return (darknodeRegistry[_darknodeID].registeredAt == 0);
    }

    /**
    * A registered dark node has been registered, and it is no longer pending
    * registration. It might be pending deregistration, but it has not been
    * refunded.
    */
    function isRegistered(bytes20 _darknodeID) public view returns (bool) {
        return darknodeRegistry[_darknodeID].registeredAt != 0 
        && darknodeRegistry[_darknodeID].registeredAt <= currentEpoch.timestamp
        && !isDeregistered(_darknodeID);
    }

    /**
    * A deregistered dark node has been deregistered, and it is no longer
    * pending deregistration, but has not been refunded.
    */
    function isDeregistered(bytes20 _darknodeID) public view returns (bool) {
        return darknodeRegistry[_darknodeID].deregisteredAt != 0
        && darknodeRegistry[_darknodeID].deregisteredAt <= currentEpoch.timestamp;
    }

}

library Utils {

    function toBytes32(bytes data, uint pos) internal pure returns (bytes32) {
        uint256 subdata = 0;
        for (uint256 i = 0; i < 32; i++) {
            subdata += uint256(data[31 + pos - i]) << 8*i;
        }
        return bytes32(subdata);
    }

    // /**
    // * @notice Create a new bytes array containing the last n bytes of the input.
    // *
    // * @param _bs The input bytes.
    // * @param _n The number of bytes that will be taken from the end of the input
    // *        bytes.
    // *
    // * @return The last n bytes of the input bytes.
    // */
    // function lastNBytes(bytes _bs, uint _n) internal pure returns (bytes out) {
    //     assert(_bs.length >= _n);
    //     out = new bytes(_n);
    //     uint offset = _bs.length - _n;
    //     for (uint i = 0; i < _n; i++) {
    //         out[i] = _bs[offset + i];
    //     }
    //     return out;
    // }

    // /**
    // * @notice Generate an Ethereum address from an ECDSA public key. An Ethereum
    // * public key is 65 bytes (1 byte 0x04, 32 bytes x value, 32 bytes y value).
    // * The address is taken from only the last 64 bytes.
    // *
    // * @param _publicKey The public key.
    // *
    // * @return An Ethereum address.
    // */
    // function ethereumAddressFromPublicKey(bytes _publicKey) public pure returns (address) {
    //     return address(keccak256(lastNBytes(_publicKey, 64)));
    // }

    // /**
    // * @notice Generate a Republic ID from an ECDSA public key. It is generated
    // * by taking the first 20 bytes of the keccak256 hash of the public key.
    // *
    // * @param _publicKey The public key.
    // *
    // * @return A Republic ID.
    // */
    // function republicIDFromPublicKey(bytes _publicKey) public pure returns (bytes20) {
    //     return bytes20(uint(keccak256(_publicKey)) >> (8 * 12));
    // }

}

library ECDSA {

    // function addr(uint8 v, bytes32 r, bytes32 s, bytes32 _hash) internal pure returns (address) {
    //     bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    //     bytes32 prefixedHash = keccak256(prefix, _hash);
    //     return ecrecover(prefixedHash, v, r, s);
    // }

    // function verify(uint8 v, bytes32 r, bytes32 s, bytes32 _hash, address _signer) internal pure returns (bool) {
    //     return (addr(v, r, s, _hash) == _signer);
    // }
  
    function addr(bytes32 _hash, bytes _signature) internal pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, _hash));
        return ecrecover(prefixedHash, uint8(_signature[64]) + 27, Utils.toBytes32(_signature, 0), Utils.toBytes32(_signature, 32));
    }

    // function verify(bytes _signature, bytes32 _hash, address _signer) internal pure returns (bool) {
    //     return (addr(_hash, _signature) == _signer);
    // }

}

/**
 * @notice RenLedger is responsible for storing the orders and their priorities.
 * It's used as an consensus of which order should be executed.
 */
contract RenLedger {

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}
    enum OrderState {Undefined, Open, Confirmed, Canceled}

    /**
    * @notice Order stores the relevant data of an order.
    */
    struct Order {
        OrderParity parity;
        OrderState state;
        address trader;
        address broker;
        address confirmer;
        uint256 priority;
        uint256 blockNumber;
        bytes32[] matches;
    }

    // buyOrders/sellOrders store all the buy/sell orders in a list .
    bytes32[] public buyOrders;
    bytes32[] public sellOrders;
    bytes32[] orderbook;

    mapping(bytes32 => Order) private orders;

    uint256 public fee;
    // Republic ERC20 token contract is used to transfer bonds.
    RepublicToken private ren;
    // DarknodeRegistry is used to check registration of the order confirmer.
    DarknodeRegistry private darknodeRegistry;

    /**
    * @notice Only allow registered dark nodes.
    */
    modifier onlyDarknode(address _sender) {
        require(darknodeRegistry.isRegistered(bytes20(_sender)));
        _;
    }

    /**
     * @notice The RenLedger constructor.
     *
     * @param _fee The fee rate of opening an order.
     * @param _token The address of the RepublicToken contract.
     * @param _registry The address of the darknodeRegistry contract.
     */
    constructor(uint256 _fee, address _token, address _registry) public {
        fee = _fee;
        ren = RepublicToken(_token);
        darknodeRegistry = DarknodeRegistry(_registry);
    }

    /**
     * @notice openBuyOrder opens a new buy order in the ledger. The order must not be opened.
     *         It requires certain allowance of REN as opening fee. It will recover and store
     *         the the trader address from the signature.
     *
     * @param _signature  Signature of the message "Republic Protocol: open: {orderId}"
     * @param _orderId Order id or the buy order.
     */
    function openBuyOrder(bytes _signature, bytes32 _orderId) public {
        openOrder(_signature, _orderId);
        buyOrders.push(_orderId);
        orders[_orderId].priority = buyOrders.length;
    }

    /**
     * @notice openSellOrder opens a new sell order in the ledger. The order must not be opened.
     *         It requires certain allowance of REN as opening fee. It will recover and store
     *         the the trader address from the signature.
     *
     * @param _signature  Signature of the message "Republic Protocol: open: {orderId}"
     * @param _orderId Order id or the buy order.
     */
    function openSellOrder(bytes _signature, bytes32 _orderId) public {
        openOrder(_signature, _orderId);
        sellOrders.push(_orderId);
        orders[_orderId].priority = buyOrders.length;
    }

    function openOrder(bytes _signature, bytes32 _orderId) private {
        require(ren.allowance(msg.sender, this) >= fee);
        require(ren.transferFrom(msg.sender, this, fee));
        require(orders[_orderId].state == OrderState.Undefined);

        // recover trader address from the signature
        bytes32 data = keccak256(abi.encodePacked("Republic Protocol: open: ", _orderId));
        address trader = ECDSA.addr(data, _signature);
        orders[_orderId].state = OrderState.Open;
        orders[_orderId].trader = trader;
        orders[_orderId].broker = msg.sender;
        orders[_orderId].blockNumber = block.number;
        orderbook.push(_orderId);
    }

    /**
     * @notice confirmOrder confirms a match is found between one order and a list of orders.
     *         It requires the  sender address to be registered in the darknodeRegistry,
     *
     * @param _orderId Order ID .
     * @param _orderMatches A list of matched order
     */
    function confirmOrder(bytes32 _orderId, bytes32[] _orderMatches) public onlyDarknode(msg.sender) {
        require(orders[_orderId].state == OrderState.Open);
        for (uint256 i = 0; i < _orderMatches.length; i++) {
            require(orders[_orderMatches[i]].state == OrderState.Open);
        }

        for (i = 0; i < _orderMatches.length; i++) {
            orders[_orderMatches[i]].state = OrderState.Confirmed;
            orders[_orderMatches[i]].matches = [_orderId];
        }
        orders[_orderId].state = OrderState.Confirmed;
        orders[_orderId].confirmer = msg.sender;
        orders[_orderId].matches = _orderMatches;
    }

    /**
     * @notice cancelOrder cancels a opened order in the ledger. It will recover and store the the
               trader address from the signature.
     *
     * @param _signature  Signature of the message "Republic Protocol: cancel: {orderId}"
     * @param _orderId Order id.
     */
    function cancelOrder(bytes _signature, bytes32 _orderId) public {
        require(orders[_orderId].state == OrderState.Open);

        // recover trader address from the signature
        bytes32 data = keccak256(abi.encodePacked("Republic Protocol: cancel: ", _orderId));
        address trader = ECDSA.addr(data, _signature);
        require(orders[_orderId].trader == trader);
        orders[_orderId].state = OrderState.Canceled;
    }

    /**
    * buyOrder will return orderId of the given index in buy order list and true if exists.
    * Otherwise it will return empty bytes and false.
    */
    function buyOrder(uint256 index) public view returns (bytes32, bool){
        if (index >= buyOrders.length) {
            return ("", false);
        }

        return (buyOrders[index], true);
    }

    /**
    * sellOrder will return orderId of the given index in sell order list and true if exists.
    * Otherwise it will return empty bytes and false.
    */
    function sellOrder(uint256 index) public view returns (bytes32, bool){
        if (index >= sellOrders.length) {
            return ("", false);
        }

        return (sellOrders[index], true);
    }

    /**
    * orderState will return status of the given orderID.
    */
    function orderState(bytes32 _orderId) public view returns (uint8){
        return uint8(orders[_orderId].state);
    }

    /**
    * orderMatch will return a list of matched orders to the given orderID.
    */
    function orderMatch(bytes32 _orderId) public view returns (bytes32[]){
        return orders[_orderId].matches;
    }

    /**
    * orderPriority will return the priority of the given orderID.
    * The priority is the index of the order in the orderbook.
    */
    function orderPriority(bytes32 _orderId) public view returns (uint256){
        return orders[_orderId].priority;
    }

    /**
    * orderTrader will return the trader of the given orderID.
    * Trader is the one who signs the message and does the actual trading.
    */
    function orderTrader(bytes32 _orderId) public view returns (address){
        return orders[_orderId].trader;
    }

    /**
    * orderBroker will return the broker of the given orderID.
    * Broker is the one who represent the trader to send the tx.
    */
    function orderBroker(bytes32 _orderId) public view returns (address){
        return orders[_orderId].broker;
    }

    /**
    * orderConfirmer will return the darknode address which confirms the given orderID.
    */
    function orderConfirmer(bytes32 _orderId) public view returns (address){
        return orders[_orderId].confirmer;
    }

    /**
    * orderDepth will return the block depth of the orderId
    */
    function orderDepth(bytes32 _orderId) public view returns (uint256) {
        if (orders[_orderId].blockNumber == 0) {
            return 0;
        }
        return (block.number - orders[_orderId].blockNumber);
    }

    /**
    * getOrdersCount will return the number of orders in the orderbook
    */
    function getOrdersCount() public view returns (uint256){
        return buyOrders.length + sellOrders.length;
    }

    /**
    * getOrder will return orderId of the given index in the orderbook list and true if exists.
    * Otherwise it will return empty bytes and false.
    */
    function getOrder(uint256 index) public view returns (bytes32, bool){
        if (index >= orderbook.length) {
            return ("", false);
        }

        return (orderbook[index], true);
    }
}
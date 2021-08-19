pragma solidity 0.5.17;

import "./DarknodeRegistry.sol";

contract GetOperatorDarknodes {
    DarknodeRegistryLogicV1 public darknodeRegistry;

    constructor(DarknodeRegistryLogicV1 _darknodeRegistry) public {
        darknodeRegistry = _darknodeRegistry;
    }

    function getOperatorDarknodes(address _operator)
        public
        view
        returns (address[] memory)
    {
        uint256 numDarknodes = darknodeRegistry.numDarknodes();
        address[] memory nodesPadded = new address[](numDarknodes);

        address[] memory allNodes = darknodeRegistry.getDarknodes(
            address(0),
            0
        );

        uint256 j = 0;
        for (uint256 i = 0; i < allNodes.length; i++) {
            if (
                darknodeRegistry.getDarknodeOperator(allNodes[i]) == _operator
            ) {
                nodesPadded[j] = (allNodes[i]);
                j++;
            }
        }

        address[] memory nodes = new address[](j);
        for (uint256 i = 0; i < j; i++) {
            nodes[i] = nodesPadded[i];
        }

        return nodes;
    }
}

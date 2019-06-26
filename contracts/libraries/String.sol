pragma solidity ^0.5.2;

library String {
    function fromBytes32(bytes32 _addr) internal pure returns(string memory) {
        bytes32 value = bytes32(uint256(_addr));
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(32 * 2 + 2);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 32; i++) {
            str[2+i*2] = alphabet[uint(uint8(value[i] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(value[i] & 0x0f))];
        }
        return string(str);
    }


    function fromAddress(address _addr) internal pure returns(string memory) {
        bytes32 value = bytes32(uint256(_addr));
        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(20 * 2 + 2);
        str[0] = '0';
        str[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint(uint8(value[i + 12] >> 4))];
            str[3+i*2] = alphabet[uint(uint8(value[i + 12] & 0x0f))];
        }
        return string(str);
    }

    // function add2(string memory a, string memory b) internal pure returns (string memory) {
    //     return string(abi.encodePacked(a, b));
    // }

    // function add3(string memory a, string memory b, string memory c) internal pure returns (string memory) {
    //     return string(abi.encodePacked(a, b, c));
    // }

    function add4(string memory a, string memory b, string memory c, string memory d) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b, c, d));
    }

    // function add5(string memory a, string memory b, string memory c, string memory d, string memory e) internal pure returns (string memory) {
    //     return string(abi.encodePacked(a, b, c, d, e));
    // }
}

pragma solidity 0.5.16;

interface IInShifter {
    function shiftIn(
        bytes32 _pHash,
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external returns (uint256);
    function shiftInFee() external view returns (uint256);
}

interface IOutShifter {
    function shiftOut(bytes calldata _to, uint256 _amount)
        external
        returns (uint256);
    function shiftOutFee() external view returns (uint256);
}

// TODO: In ^0.6.0, should be `interface IShifter is IInShifter,IOutShifter {}`
interface IShifter {
    // is IInShifter
    function shiftIn(
        bytes32 _pHash,
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external returns (uint256);
    function shiftInFee() external view returns (uint256);
    // is IOutShifter
    function shiftOut(bytes calldata _to, uint256 _amount)
        external
        returns (uint256);
    function shiftOutFee() external view returns (uint256);
}

pragma solidity ^0.4.17;

library Utils {

  /**
   * @notice Create a new bytes array containing the last n bytes of the input.
   *
   * @param _bs The input bytes.
   * @param _n The number of bytes that will be taken from the end of the input
   *        bytes.
   *
   * @return The last n bytes of the input bytes.
   */
  function lastNBytes(bytes _bs, uint _n) public pure returns (bytes out) {
    assert(_bs.length <= _n);
    out = new bytes(_n);
    uint offset = _bs.length - _n;
    for (uint i = 0; i < _n; i++) {
      out[i] = _bs[offset + i];
    }
    return out;
  }

  /**
   * @notice Generate an Ethereum address from an ECDSA public key. An Ethereum
   * public key is 65 bytes (1 byte 0x04, 32 bytes x value, 32 bytes y value).
   * The address is taken from only the last 64 bytes.
   *
   * @param _publicKey The public key.
   *
   * @return An Ethereum address.
   */
  function ethereumAddressFromPublicKey(bytes _publicKey) public pure returns (address) {
    return address(keccak256(lastNBytes(_publicKey, 64)));
  }

  /**
   * @notice Generate a Republic ID from an ECDSA public key. It is generated
   * by taking the first 20 bytes of the keccak256 hash of the public key.
   *
   * @param _publicKey The public key.
   *
   * @return A Republic ID.
   */
  function republicIDFromPublicKey(bytes _publicKey) public pure returns (bytes20) {
    return bytes20(uint(keccak256(_publicKey)) >> (8 * 12));
  }

  /**
   * @notice The logarithm function, base 2. Posted by Tjaden Hess
   * https://ethereum.stackexchange.com/a/30168.
   * 
   * @param _x The input to the logarithm function.
   *
   * @return The output of the logarithm function.
   */
  function logtwo(uint _x) public pure returns (uint y) {
    assembly {
      let arg := _x
      _x := sub(_x,1)
      _x := or(_x, div(_x, 0x02))
      _x := or(_x, div(_x, 0x04))
      _x := or(_x, div(_x, 0x10))
      _x := or(_x, div(_x, 0x100))
      _x := or(_x, div(_x, 0x10000))
      _x := or(_x, div(_x, 0x100000000))
      _x := or(_x, div(_x, 0x10000000000000000))
      _x := or(_x, div(_x, 0x100000000000000000000000000000000))
      _x := add(_x, 1)
      let m := mload(0x40)
      mstore(m,           0xf8f9cbfae6cc78fbefe7cdc3a1793dfcf4f0e8bbd8cec470b6a28a7a5a3e1efd)
      mstore(add(m,0x20), 0xf5ecf1b3e9debc68e1d9cfabc5997135bfb7a7a3938b7b606b5b4b3f2f1f0ffe)
      mstore(add(m,0x40), 0xf6e4ed9ff2d6b458eadcdf97bd91692de2d4da8fd2d0ac50c6ae9a8272523616)
      mstore(add(m,0x60), 0xc8c0b887b0a8a4489c948c7f847c6125746c645c544c444038302820181008ff)
      mstore(add(m,0x80), 0xf7cae577eec2a03cf3bad76fb589591debb2dd67e0aa9834bea6925f6a4a2e0e)
      mstore(add(m,0xa0), 0xe39ed557db96902cd38ed14fad815115c786af479b7e83247363534337271707)
      mstore(add(m,0xc0), 0xc976c13bb96e881cb166a933a55e490d9d56952b8d4e801485467d2362422606)
      mstore(add(m,0xe0), 0x753a6d1b65325d0c552a4d1345224105391a310b29122104190a110309020100)
      mstore(0x40, add(m, 0x100))
      let magic := 0x818283848586878898a8b8c8d8e8f929395969799a9b9d9e9faaeb6bedeeff
      let shift := 0x100000000000000000000000000000000000000000000000000000000000000
      let a := div(mul(_x, magic), shift)
      y := div(mload(add(m,sub(255,a))), shift)
      y := add(y, mul(256, gt(arg, 0x8000000000000000000000000000000000000000000000000000000000000000)))
    }
    if (y == 0) {
      y = 1;
    }
  }
}
pragma solidity 0.5.17;

interface IMintGateway {
    function mint(
        bytes32 _pHash,
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external returns (uint256);

    function mintFee() external view returns (uint256);
}

interface IBurnGateway {
    function burn(bytes calldata _to, uint256 _amountScaled)
        external
        returns (uint256);

    function burnFee() external view returns (uint256);
}

// TODO: In ^0.6.0, should be `interface IGateway is IMintGateway,IBurnGateway {}`
interface IGateway {
    // is IMintGateway
    function mint(
        bytes32 _pHash,
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external returns (uint256);

    function mintFee() external view returns (uint256);

    // is IBurnGateway
    function burn(bytes calldata _to, uint256 _amountScaled)
        external
        returns (uint256);

    function burnFee() external view returns (uint256);
}

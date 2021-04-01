// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../lib/FixedPoint.sol";

interface IndexedFinanceUniswapV2OracleInterface {
    function computeAverageTokenPrice(
        address token, uint256 minTimeElapsed, uint256 maxTimeElapsed
    ) external view returns (FixedPoint.uq112x112 memory);

    function computeAverageEthPrice(
        address token, uint256 minTimeElapsed, uint256 maxTimeElapsed
    ) external view returns (FixedPoint.uq112x112 memory);

    function updatePrice(address token) external returns (bool);

    function canUpdatePrice(address token) external returns (bool);
}

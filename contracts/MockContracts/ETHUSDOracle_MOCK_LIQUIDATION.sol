// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @author Conjure Finance Team
/// @title ETHUSDOracle_MOCK
/// @notice Mock test contract
contract ETHUSDOracle_MOCK_LIQUIDATION {

    // 0 normal, 1 increase, 2 decrease
    uint256 public state;

    function setState(uint256 newState) public {
        state =newState;
    }

    function latestAnswer()
    public
    view
    returns (int256 answer)
    {
        if (state == 0) {
            answer = 150000000000;
        }
        if (state == 1) {
            answer = 200000000000;
        }
        if (state == 2) {
            answer = 100000000000;
        }
        if (state == 3) {
            answer = 300000000000;
        }
        if (state == 4) {
            answer = 170000000000;
        }
        if (state == 5) {
            answer = 180000000000;
        }
    }
}

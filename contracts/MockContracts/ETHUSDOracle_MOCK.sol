// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

/// @author Conjure Finance Team
/// @title ETHUSDOracle_MOCK
/// @notice Mock test contract
/// @notice uses different prices to test pricing and liquidations
contract ETHUSDOracle_MOCK {
    uint256 public counter;

    constructor() {
        counter = 0;
    }

    function latestAnswer()
    public
    returns (int256 answer)
    {
        if (counter > 4)
        {
            // set this 10-15% higher than the current eth price
            answer = 210000000000;
        } else {
            answer = 150000000000;
        }
        counter++;
    }
}

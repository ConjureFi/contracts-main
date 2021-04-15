// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @author Conjure Finance Team
/// @title ETHUSDOracle_MOCK
/// @notice Mock test contract
/// @notice uses different prices to test pricing and liquidations
contract PriceTestOracle_MOCK {
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
            answer = 0;
        } else if (counter == 4) {
            answer = 400000000000;
        } else {
            answer = 150000000000;
        }
        counter++;
    }
}
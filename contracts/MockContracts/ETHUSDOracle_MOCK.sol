// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

/// @author Conjure Finance Team
/// @title ETHUSDOracle_MOCK
/// @notice Mock test contract
/// @notice uses different prices to test pricing and liquidations
contract ETHUSDOracle_MOCK {
    uint256 public counter;

    constructor() public {
        counter = 0;
    }

    function latestAnswer()
    public
    returns (int256 answer)
    {
        if (counter > 4)
        {
            answer = 188458383000;
        } else {
            answer = 156845838300;
        }
        counter++;
    }
}

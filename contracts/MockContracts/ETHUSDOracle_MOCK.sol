// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @author Conjure Finance Team
/// @title ETHUSDOracle_MOCK
/// @notice Mock test contract
/// @notice uses different prices to test pricing
contract ETHUSDOracle_MOCK {

    function latestAnswer()
    public
    pure
    returns (int256 answer)
    {
        answer = 150000000000;
    }

    function testwrongcall()
    public
    pure
    returns (int256 answer)
    {
        // always reverts for testing
        require(true == false);
        answer = 150000000000;
    }

    function latestRoundData()
    public
    pure
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    )
    {
        roundId = 1;
        answer = 150000000000;
        startedAt = 1;
        updatedAt = 1;
        answeredInRound = 1;
    }

    function getFeed(uint256 feedID)
    public
    pure
    returns (
        uint256 price,
        uint256 time,
        uint256 decimals
    )
    {
        price = 1500000000000000000000;
        time = 1;
        decimals = 18;
    }
}

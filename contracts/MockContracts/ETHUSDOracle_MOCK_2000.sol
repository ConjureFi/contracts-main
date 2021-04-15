// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

/// @author Conjure Finance Team
/// @title ETHUSDOracle_MOCK
/// @notice Mock test contract
/// @notice uses different prices to test pricing and liquidations
contract ETHUSDOracle_MOCK_2000 {

    function latestAnswer()
    public
    pure
    returns (int256 answer)
    {
        answer = 200000000000;
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
        answer = 200000000000;
        startedAt = 1;
        updatedAt = 1;
        answeredInRound = 1;
    }
}

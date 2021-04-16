// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../lib/FixedPoint.sol";

/// @author Conjure Finance Team
/// @title NDX_UNISWAP_ORACLE
/// @notice Mock test contract for the ndx uniswap oracle returns a fixed point nomination
contract NDX_UNISWAP_ORACLE {
    using FixedPoint for FixedPoint.uq112x112;
    using FixedPoint for FixedPoint.uq144x112;

    uint256 public state;

    function setState(uint256 newState) public {
        state =newState;
    }

    function computeAverageTokenPrice(
        address token,
        uint256 minTimeElapsed,
        uint256 maxTimeElapsed
    )
    external
    view
    returns (FixedPoint.uq112x112 memory)
    {
        FixedPoint.uq112x112 memory priceAverage;

        if (state == 0) {
            //use 32.0$ as link price (32 * 2**112 / 1500) = 110768999648742989408650588356695
            priceAverage = FixedPoint.uq112x112(
                uint224(110768999648742989408650588356695)
            );

            return priceAverage;
        }

        //use 1$ as link price (32 * 2**112 / 1500) = 110768999648742989408650588356695
        priceAverage = FixedPoint.uq112x112(
            uint224(692306247804643683804066177229346)
        );

        return priceAverage;
    }
}

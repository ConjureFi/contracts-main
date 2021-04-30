// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;


/// @author Conjure Finance Team
/// @title ERC20_SUPPLY_MOCK
/// @notice Mock test for the erc20 total supply getting
contract ERC20_SUPPLY_MOCK {

    uint256 public state;

    function setState(uint256 newState) public {
        state =newState;
    }

    function totalSupply()
    external
    view
    returns (uint256)
    {
        if (state == 0) {
            return 1000000 * 10 **18;
        }
        if (state == 1) {
            return 1000000 * 10 **17;
        }

        return 0;
    }

    function decimals()
    external
    view
    returns (uint256)
    {
        if (state == 0) {
            return 18;
        }
        if (state == 1) {
            return 17;
        }
        if (state == 2) {
            return 19;
        }

        return 0;
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

/// @author Conjure Finance Team
/// @title IConjureFactory
/// @notice Interface for interacting with the ConjureFactory Contract
interface IConjureFactory {

    /**
     * @dev gets the current factory owner
     *
     * @return the current factory owner
    */
    function getFactoryOwner() external returns (address payable);
}

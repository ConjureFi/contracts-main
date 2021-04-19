// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "../lib/CloneLibrary.sol";

/// @author Conjure Finance Team
/// @title ConjureFactoryMock
/// @notice ConjureFactoryMock to get clone contracts
contract ConjureFactoryMock {
    using CloneLibrary for address;

    address public conjureImplementation;
    address public etherCollateralImplementation;

    event NewConjure(address conjure, address etherCollateral);

    constructor(
        address _conjureImplementation,
        address _etherCollateralImplementation
    )
    {
        conjureImplementation = _conjureImplementation;
        etherCollateralImplementation = _etherCollateralImplementation;
    }

    function getClones()
    public
    returns(address conjure, address etherCollateral)
    {
        conjure = conjureImplementation.createClone();
        etherCollateral = etherCollateralImplementation.createClone();

        emit NewConjure(conjure, etherCollateral);
    }
}

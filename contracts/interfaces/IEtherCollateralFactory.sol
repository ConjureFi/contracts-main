// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

/// @author Conjure Finance Team
/// @title IEtherCollateralFactory
/// @notice Interface for interacting with the EtherCollateralFactory Contract
interface IEtherCollateralFactory {

    /**
     * @dev lets anyone mint a new EtherCollateral contract
     *
     * @param asset_ the synthetic assets address
     * @param owner_ the owner of the contract
     * @param factoryaddress_ the address of the factory implementation for fee distribution
     * @param mintingfeerate_ the minting fee
     * @param ratio_ the C-Ratio to be used in the contract
     * @return The address of the newly minted EtherCollateral contract
    */
    function EtherCollateralMint(
        address payable asset_,
        address owner_,
        address factoryaddress_,
        uint256 mintingfeerate_,
        uint256 ratio_
    )
        external
        returns (address);
}

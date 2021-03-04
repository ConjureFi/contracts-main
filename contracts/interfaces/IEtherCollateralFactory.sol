// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface IEtherCollateralFactory {
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

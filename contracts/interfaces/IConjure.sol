// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface IConjure {
    function burn(address account, uint amount) external;
    function mint(address account, uint amount) external;
    function getLatestETHUSDPrice() external view returns (int);
    function getPrice() external returns (uint);
    function getLatestPrice() external view returns (uint);
}

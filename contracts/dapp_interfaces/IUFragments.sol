// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.10;

/// @title IUFragments
/// @notice Interface to the UFragments contract.
interface IUFragments {
    function totalSupply() external view returns (uint256);
}

interface IUFragmentsPolicy {
    function epoch() external view returns (uint256);
}
// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.10;

contract MockUFragments {

    uint256 public _totalSupply;
    uint256 public _expectedRate;

    constructor() public {
        _totalSupply = 1 ether;
        _expectedRate = 1 ether;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function setTotalSupply(uint256 _newSupply) public {
        _totalSupply = _newSupply;
    }

    // Kyber getExpectedRate Mock
    function getExpectedRate(address, address, uint256)
        public
        view
        returns(uint256 expectedRate, uint256)
    {
        return (_expectedRate, 0);
    }

    // Uniswap v2 getAmountsOut(_sellAmount, tokenPath)
    function getAmountsOut(uint, address[] memory)
        public
        view
        returns (uint[] memory rates)
    {
        rates = new uint256[](2);
        rates[1] = _expectedRate;
        return rates;
    }

    function setExpectedRate(uint256 _newExpectedRate)
        public
    {
        _expectedRate = _newExpectedRate;
    }

}
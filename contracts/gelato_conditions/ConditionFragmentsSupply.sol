// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.10;

import {GelatoConditionsStandard} from "@gelatonetwork/core/contracts/conditions/GelatoStatefulConditionsStandard.sol";
import {SafeMath} from "@gelatonetwork/core/contracts/external/SafeMath.sol";
import {IGelatoCore} from "@gelatonetwork/core/contracts/gelato_core/interfaces/IGelatoCore.sol";
import {IERC20} from "@gelatonetwork/core/contracts/external/IERC20.sol";
import {IUFragments} from "../dapp_interfaces/IUFragments.sol";

contract ConditionFragmentsSupply is GelatoConditionsStandard {

    using SafeMath for uint256;

    IUFragments public immutable frag;

    // userProxy => epoch => refSupply
    mapping(address => uint256) public refSupply;

    constructor(address _frag) public {
        frag = IUFragments(_frag);
    }

    /// @dev use this function to encode the data off-chain for the condition data field
    function getConditionData(address _userProxy, bool _supplyWillIncrease)
        public
        pure
        virtual
        returns(bytes memory)
    {
        return abi.encodeWithSelector(this.checkRefSupply.selector, _userProxy, _supplyWillIncrease);
    }

    // STANDARD interface
    /// @param _conditionData The encoded data from getConditionData()
    function ok(uint256, bytes calldata _conditionData, uint256)
        public
        view
        virtual
        override
        returns(string memory)
    {
        (address userProxy, bool supplyWillIncrease) = abi.decode(_conditionData[4:], (address,bool));
        return checkRefSupply(userProxy, supplyWillIncrease);
    }

    // Specific Implementation
    /// @dev Abi encode these parameter inputs. Use a placeholder for _taskReceiptId.
    function checkRefSupply(address _userProxy, bool _supplyWillIncrease)
        public
        view
        virtual
        returns(string memory)
    {

        uint256 _refSupply = refSupply[_userProxy];

        if (frag.totalSupply() > _refSupply) {
            if (_supplyWillIncrease)
                return OK;
            else
                return "UFragment Supply increased";
        }
        if (frag.totalSupply() < _refSupply) {
            if (_supplyWillIncrease)
                return "UFragment Supply decreased";
            else
                return OK;
        }
        return "UFramgent Supply unchanged";
    }

    /// @dev We store the current supply in state in order to compare it to the new supply after the next rebase / new epoch
    function setRefSupply() external {
        refSupply[msg.sender] = frag.totalSupply();
    }
}

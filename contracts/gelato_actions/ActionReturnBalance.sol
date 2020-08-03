// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import {GelatoActionsStandard} from "@gelatonetwork/core/contracts/actions/GelatoActionsStandard.sol";
import {IERC20} from "@gelatonetwork/core/contracts/external/IERC20.sol";
import {GelatoBytes} from "@gelatonetwork/core/contracts/libraries/GelatoBytes.sol";
import {SafeMath} from "@gelatonetwork/core/contracts/external/SafeMath.sol";
import {DataFlow} from "@gelatonetwork/core/contracts/gelato_core/interfaces/IGelatoCore.sol";

/// @dev This action is for user proxies that store funds.
contract ActionReturnBalance is GelatoActionsStandard {
    using SafeMath for uint256;

    // ======= DEV HELPERS =========
    /// @dev use this function to encode the data off-chain for the action data field
    function getActionData(address _sendToken, uint256 _numerator)
        public
        pure
        virtual
        returns(bytes memory)
    {
        return abi.encodeWithSelector(
            this.action.selector,
            _sendToken,
            _numerator
        );
    }


    /// @dev Used by GelatoActionPipeline.isValid()
    function DATA_FLOW_OUT_TYPE() public pure virtual returns (bytes32) {
        return keccak256("TOKEN,UINT256");
    }

    // ======= ACTION IMPLEMENTATION DETAILS =========
    /// @dev Always use this function for encoding _actionData off-chain
    ///  Will be called by GelatoActionPipeline if Action.dataFlow.None
    function action(address _sendToken, uint256 _numerator)
        public
        view
        virtual
        delegatecallOnly("ActionReturnBalance.action")
        returns(uint256 amount)
    {
        if (_sendToken == ETH_ADDRESS)
            amount = address(this).balance;
        else
            amount = IERC20(_sendToken).balanceOf(address(this));

        amount = amount.mul(_numerator).div(100);
    }

    /// @dev Will be called by GelatoActionPipeline if Action.dataFlow.Out
    //  => do not use for _actionData encoding
    function execWithDataFlowOut(bytes calldata _actionData)
        external
        payable
        virtual
        returns (bytes memory)
    {
        (address sendToken, uint256 numerator) = abi.decode(
            _actionData[4:],
            (address,uint256)
        );
        uint256 amount = action(sendToken, numerator);
        return abi.encode(sendToken, amount);
    }


    // ===== ACTION TERMS CHECK ========
    // Overriding and extending GelatoActionsStandard's function (optional)
    function termsOk(
        uint256,  // taskReceipId
        address,
        bytes calldata _actionData,
        DataFlow,
        uint256,  // value
        uint256  // cycleId
    )
        public
        view
        virtual
        override
        returns(string memory)
    {
        if (this.action.selector != GelatoBytes.calldataSliceSelector(_actionData))
            return "ActionReturnBalance: invalid action selector";

        (uint256 numerator) = abi.decode(
            _actionData[36:],
            (uint256)
        );

       if (numerator > 100) return "Numerator can only be max 100";

        // STANDARD return string to signal actionConditions Ok
        return OK;
    }
}

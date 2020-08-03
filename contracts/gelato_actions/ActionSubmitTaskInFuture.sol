// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import {GelatoActionsStandardFull} from "@gelatonetwork/core/contracts/actions/GelatoActionsStandardFull.sol";
import {IERC20} from "@gelatonetwork/core/contracts/external/IERC20.sol";
import {Address} from "@gelatonetwork/core/contracts/external/Address.sol";
import {GelatoBytes} from "@gelatonetwork/core/contracts/libraries/GelatoBytes.sol";
import {SafeERC20} from "@gelatonetwork/core/contracts/external/SafeERC20.sol";
import {Provider, Task, IGelatoCore} from "@gelatonetwork/core/contracts/gelato_core/interfaces/IGelatoCore.sol";

/// @dev This action is for user proxies that store funds.
contract ActionSubmitTaskInFuture {
    using Address for address payable;

    IGelatoCore public immutable gelatoCore;

    constructor(address _gelatoCore) public {
        gelatoCore = IGelatoCore(_gelatoCore);
    }


    // ======= DEV HELPERS =========
    /// @dev use this function to encode the data off-chain for the action data field
    function getActionData(Provider memory _provider, Task memory _task, uint256 _expiryDateDelta)
        public
        pure
        virtual
        returns(bytes memory)
    {
        return abi.encodeWithSelector(
            this.action.selector,
            _provider,
            _task,
            _expiryDateDelta
        );
    }

    // ======= ACTION IMPLEMENTATION DETAILS =========
    /// @dev Always use this function for encoding _actionData off-chain
    /// @dev Only delegate call into here
    function action(Provider memory _provider, Task memory _task, uint256 _expiryDateDelta)
        public
        virtual
    {
        uint256 expiryDate = block.timestamp + _expiryDateDelta;
        gelatoCore.submitTask(_provider, _task, expiryDate);
    }

}

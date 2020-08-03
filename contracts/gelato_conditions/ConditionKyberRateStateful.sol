// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import {GelatoStatefulConditionsStandard} from "@gelatonetwork/core/contracts/conditions/GelatoStatefulConditionsStandard.sol";
import {IKyberNetworkProxy} from "../dapp_interfaces/IKyberNetworkProxy.sol";
import {SafeMath} from "@gelatonetwork/core/contracts/external/SafeMath.sol";
import {IGelatoCore} from "@gelatonetwork/core/contracts/gelato_core/interfaces/IGelatoCore.sol";
import {IERC20} from "@gelatonetwork/core/contracts/external/IERC20.sol";


contract ConditionKyberRateStateful is GelatoStatefulConditionsStandard {
    using SafeMath for uint256;

    IKyberNetworkProxy public immutable KYBER;

    // userProxy => taskReceipt.id => refPrice
    mapping(address => mapping(uint256 => uint256)) public refRate;

    constructor(IKyberNetworkProxy _kyberNetworkProxy, IGelatoCore _gelatoCore)
        public
        GelatoStatefulConditionsStandard(_gelatoCore)
    {
        KYBER = _kyberNetworkProxy;
    }

    /// @dev use this function to encode the data off-chain for the condition data field
    function getConditionData(
        address _userProxy,
        address _sendToken,
        uint256 _sendAmount,
        address _receiveToken,
        bool _greaterElseSmaller
    )
        public
        pure
        virtual
        returns(bytes memory)
    {
        return abi.encodeWithSelector(
            this.checkRefKyberRate.selector,
            uint256(0),  // taskReceiptId placeholder
            _userProxy,
            _sendToken,
            _sendAmount,
            _receiveToken,
            _greaterElseSmaller
        );
    }

    // STANDARD Interface
    /// @param _conditionData The encoded data from getConditionData()
    function ok(uint256 _taskReceiptId, bytes calldata _conditionData, uint256)
        public
        view
        virtual
        override
        returns(string memory)
    {
        (address userProxy,
         address sendToken,
         uint256 sendAmount,
         address receiveToken,
         bool greaterElseSmaller
        ) = abi.decode(
             _conditionData[36:],  // slice out selector & taskReceiptId
             (address,address,uint256,address,bool)
         );
        return checkRefKyberRate(
            _taskReceiptId, userProxy, sendToken, sendAmount, receiveToken, greaterElseSmaller
        );
    }

    // Specific Implementation
    function checkRefKyberRate(
        uint256 _taskReceiptId,
        address _userProxy,
        address _sendToken,
        uint256 _sendAmount,
        address _receiveToken,
        bool _greaterElseSmaller
    )
        public
        view
        virtual
        returns(string memory)
    {
        uint256 currentRefRate = refRate[_userProxy][_taskReceiptId];
        try KYBER.getExpectedRate(_sendToken, _receiveToken, _sendAmount)
            returns(uint256 expectedRate, uint256)
        {
            if (_greaterElseSmaller) {  // greaterThan
                if (expectedRate >= currentRefRate) return OK;
                return "ExpectedRateIsNotGreaterThanRefRate";
            } else {  // smallerThan
                if (expectedRate <= currentRefRate) return OK;
                return "ExpectedRateIsNotSmallerThanRefRate";
            }
        } catch {
            return "KyberGetExpectedRateError";
        }
    }

    /// @dev This function should be called via the userProxy of a Gelato Task as part
    ///  of the Task.actions, if the Condition state should be updated after the task.
    /// @param _rateDeltaAbsolute The change in price after which this condition should return for a given taskId
    /// @param _idDelta Default to 0. If you submit multiple tasks in one action, this can help
    // customize which taskId the state should be allocated to
    function setRefRateAbsolute(
        address _sendToken,
        uint256 _sendAmount,
        address _receiveToken,
        bool _greaterElseSmaller,
        uint256 _rateDeltaAbsolute,
        uint256 _idDelta
    )
        external
    {
        uint256 taskReceiptId = _getIdOfNextTaskInCycle() + _idDelta;
        uint256 expectedRate = getKyberRate(_sendToken, _sendAmount, _receiveToken);
        if (_greaterElseSmaller) {
            refRate[msg.sender][taskReceiptId] = expectedRate.add(_rateDeltaAbsolute);
        } else {
            refRate[msg.sender][taskReceiptId] = expectedRate.sub(
                _rateDeltaAbsolute,
                "ConditionKyberRateStateful.setRefRate: Underflow"
            );
        }

    }

    /// @dev This function should be called via the userProxy of a Gelato Task as part
    ///  of the Task.actions, if the Condition state should be updated after the task.
    /// @param _rateDeltaNominator The nominator defining the % change, e.g. 50 for 50%
    /// @param _idDelta Default to 0. If you submit multiple tasks in one action, this can help
    // customize which taskId the state should be allocated to
    function setRefRateRelative(
        address _sendToken,
        uint256 _sendAmount,
        address _receiveToken,
        bool _greaterElseSmaller,
        uint256 _rateDeltaNominator,
        uint256 _idDelta
    )
        external
    {
        uint256 taskReceiptId = _getIdOfNextTaskInCycle() + _idDelta;
        uint256 expectedRate = getKyberRate(_sendToken, _sendAmount, _receiveToken);
        uint256 absoluteDelta = expectedRate.mul(_rateDeltaNominator).div(100);
        if (_greaterElseSmaller) {
            refRate[msg.sender][taskReceiptId] = expectedRate.add(absoluteDelta);
        } else {
            refRate[msg.sender][taskReceiptId] = expectedRate.sub(
                absoluteDelta,
                "ConditionKyberRateStateful.setRefRate: Underflow"
            );
        }

    }

    function getKyberRate(address _sendToken, uint256 _sendAmount, address _receiveToken)
        public
        view
        returns(uint256)
    {
        try KYBER.getExpectedRate(_sendToken, _receiveToken, _sendAmount)
            returns(uint256 expectedRate, uint256)
        {
            return expectedRate;
        } catch {
            revert("ConditionKyberRateStateful.setRefRate: KyberGetExpectedRateError");
        }
    }
}
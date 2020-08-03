// running `npx buidler test` automatically makes use of buidler-waffle plugin
// => only dependency we need is "chai"
import { expect } from "chai";

import bre from "@nomiclabs/buidler";
import { Provider } from "ethers/providers";

describe("Gelato-Kyber Demo Part 1: Step 3", function () {
  // No timeout for Mocha due to Rinkeby mining latency
  this.timeout(0);

  const CREATE_2_SALT = 123456789; // for create2 and address prediction
  const gelatoUserProxyFactorAddress =
    bre.network.config.deployments.GelatoUserProxyFactory;

  const AMPL = bre.network.config.addressBook.erc20.AMPL;
  const ETH = bre.network.config.addressBook.kyber.ETH;
  const initalEthInvestment = ethers.utils.parseEther("0");
  const initalAmplInvestment = ethers.utils.parseUnits("0", 9);
  console.log(`Initial ETH investment: ${initalEthInvestment}`);
  console.log(`Initial AMPL investment: ${initalAmplInvestment}`);
  const CYCLES = 10;

  const gelatoCoreAddress = bre.network.config.deployments.GelatoCore;

  // Conditions
  const conditionFragmentSupplyAddress =
    bre.network.config.deployments.ConditionFragmentsSupply;

  const conditionUniswapV2RateAddress =
    bre.network.config.deployments.ConditionUniswapV2RateStateful;

  // Actions

  const actionUniswapTradeAddress =
    bre.network.config.deployments.ActionUniswapV2Trade;

  const actionReturnBalanceAddress =
    bre.network.config.deployments.ActionReturnBalance;

  const actionSubmitTaskInFutureAddress =
    bre.network.config.deployments.ActionSubmitTaskInFuture;

  const defaultExecutor = bre.network.config.addressBook.gelatoExecutor.default;

  // Change to 23 hours on mainnet
  const LIMIT_ORDER_LIFETIME = 180;

  const estimatedGasPerExecution = ethers.utils.bigNumberify("500000"); // Limits the required balance of the User on Gelato to be 500.000 * GelatoGasPrice for every execution and not the default 8M

  // We use our User Wallet. Per our config this wallet is at the accounts index 0
  // and hence will be used by default for all transactions we send.
  let myUserAddress;

  // 1) We use the already deployed instance of GelatoUserProxyFactory
  let gelatoUserProxyFactory;

  let myGelatoProvider;

  // 2) We will deploy a GelatoUserProxy using the Factory, or if we already deployed
  //  one, we will use that one.
  let proxyIsDeployedAlready;
  let myUserProxyAddress;
  let myUserProxy;

  // All these variables and constants will be used to create our Gelato Task object:
  let taskSupplyDown;
  let taskSupplyUp;

  // Current Gelato Gas Price
  let currentGelatoGasPrice;

  // Action that we also need to execute before submitting tasks
  let actionSetConditionFragmentsSupply;
  let actionSubmitTaskSupplyDown;
  let actionSubmitTaskSupplyUp;

  // --> Step 3: Submit your Task to Gelato via your GelatoUserProxy
  before(async function () {
    // We get our User Wallet from the Buidler Runtime Env
    const myUserWallet = await bre.getUserWallet();
    myUserAddress = await myUserWallet.getAddress();

    // --> Step 1: Deploy your GelatoUserProxy
    gelatoUserProxyFactory = await ethers.getContractAt(
      "IGelatoUserProxyFactory",
      gelatoUserProxyFactorAddress
    );

    currentGelatoGasPrice = await bre.run("fetchGelatoGasPrice");

    // 2) We expect our Proxy to have been created using the Factory's create2 method,
    //  in Demo Part 2 Step 1, which allows us to already predict
    //  the myUserProxyAddress now, by using the same SALT.
    //  Make sure we have created the Proxy already.
    myUserProxyAddress = await gelatoUserProxyFactory.predictProxyAddress(
      myUserAddress,
      CREATE_2_SALT
    );

    console.log(`UserProxy Address: ${myUserProxyAddress}`);

    // To submit Tasks to  Gelato we need to instantiate a GelatoProvider object
    myGelatoProvider = new GelatoProvider({
      addr: myUserProxyAddress, // As the user is paying for the gelato transactions himself, the provider address will equal the users proxy address
      module: network.config.deployments.ProviderModuleGelatoUserProxy,
    });

    proxyIsDeployedAlready = await gelatoUserProxyFactory.isGelatoUserProxy(
      myUserProxyAddress
    );
    if (proxyIsDeployedAlready) {
      myUserProxy = await ethers.getContractAt(
        "GelatoUserProxy",
        myUserProxyAddress
      );
    } else {
      console.log(
        "❌ No GelatoUserProxy deployed. Complete Part2 Step 1 first by running `yarn create-userproxy`\n"
      );
      process.exit(1);
    }
  });

  // ############################### Task 1 ###############################
  // Export Task which tracks if supply is decreasing
  before(async function () {
    // --> Step 2: Create Task Objects
    /*
    Condition: Supply On UFragments
    Actions:
    - Sell AMPL for ETH on Kyber
    - Set Kyber Rate based on taskReceipt1 + 1
    - Submit Task 2
    */
    const conditionFragmentSupply = new Condition({
      inst: conditionFragmentSupplyAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ConditionFragmentsSupply",
        functionname: "checkRefSupply",
        inputs: [
          myUserProxyAddress,
          false /* return "OK" if supply decreases */,
        ],
      }),
    });

    const actionReturnEthlBalance = new Action({
      addr: actionReturnBalanceAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionReturnBalance",
        functionname: "action",
        inputs: [ETH, 50 /* 50% of user proxies AMPL balance should be sold */],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.Out, // The return value from this action will overwrite the sell amount in the following action
      termsOkCheck: false, //
      value: 0,
    });

    const actionSellEthForAmplOnUniswap = new Action({
      addr: actionUniswapTradeAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionUniswapV2Trade",
        functionname: "action",
        inputs: [
          ETH, // sendToken
          0, // will be overwritten by the previous action
          AMPL, // receiveToken
          myUserProxyAddress, // receiver
          myUserProxyAddress, // origin
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.In, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: true, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    const actionSetKyberRate = new Action({
      addr: conditionUniswapV2RateAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ConditionUniswapV2RateStateful",
        functionname: "setRefRateRelative",
        inputs: [
          ETH, // sendToken
          utils.parseUnits("10", 18), // Get exchange rate for 10 ETH
          AMPL, // receiveToken
          false, // We want to store a lower rate than the current market rate
          10, // We are wating for a 10% drop
          0, // We want to store the rate for the next taskReceiptId which will be submitted after this action
        ],
      }),
      operation: Operation.Call, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.None, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: false, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    actionSetConditionFragmentsSupply = new Action({
      addr: conditionFragmentSupplyAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ConditionFragmentsSupply",
        functionname: "setRefSupply",
        inputs: [],
      }),
      operation: Operation.Call, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.None, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: false, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    // #########   Task 2, which we will need to encode into Task 1

    /*
    uint256 _taskReceiptId,
    address _userProxy,
    address _sendToken,
    uint256 _sendAmount,
    address _receiveToken,
    bool _greaterElseSmaller
  */
    const conditionKyberRateStateful = new Condition({
      inst: conditionUniswapV2RateAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ConditionUniswapV2RateStateful",
        functionname: "checkRefRateUniswap",
        inputs: [
          0, // will be overwritten by gelato core
          myUserProxyAddress,
          ETH, // sendToken
          utils.parseUnits("10", 18), // Get exchange rate for 100 AMPL
          AMPL, // receiveToken
          false, // We want to check if the rate is lower than the current rate
        ],
      }),
    });

    const actionReturnAmplBalance = new Action({
      addr: actionReturnBalanceAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionReturnBalance",
        functionname: "action",
        inputs: [
          AMPL,
          100 /* 50% of user proxies AMPL balance should be sold */,
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.Out, // The return value from this action will overwrite the sell amount in the following action
      termsOkCheck: false, //
      value: 0,
    });

    const actionSellAmplForEthOnUniswap = new Action({
      addr: actionUniswapTradeAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionUniswapV2Trade",
        functionname: "action",
        inputs: [
          AMPL, // sendToken
          0, // will be overwritten by the previous action
          ETH, // receiveToken
          myUserProxyAddress, // receiver
          myUserProxyAddress, // origin
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.In, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: true, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    // This is all the info we need to submit this task to Gelato
    const task2 = new Task({
      // All the conditions have to be met
      conditions: [conditionKyberRateStateful],
      // These Actions have to be executed in the same TX all-or-nothing
      actions: [actionReturnAmplBalance, actionSellAmplForEthOnUniswap],
      selfProviderGasLimit: 3000000, // Limiting the required gas to 3M
      selfProviderGasPrice: 0, // We want to execute this transaction no matter the current gasPrice
    });

    // ############### Continue Task 1
    const provider = new GelatoProvider({
      addr: myUserProxyAddress, // As the user is paying for the gelato transactions himself, the provider address will equal the users proxy address
      module: network.config.deployments.ProviderModuleGelatoUserProxy,
    });

    const actionSubmitTaskInFuture = new Action({
      addr: actionSubmitTaskInFutureAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionSubmitTaskInFuture",
        functionname: "action",
        inputs: [
          provider,
          task2,
          LIMIT_ORDER_LIFETIME, // 23 hours in seconds => Time for this Task to be live, after that it will expire
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.None, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: false, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    taskSupplyDown = new Task({
      // All the conditions have to be met
      conditions: [conditionFragmentSupply],
      // These Actions have to be executed in the same TX all-or-nothing
      actions: [
        actionReturnEthlBalance,
        actionSellEthForAmplOnUniswap,
        actionSetKyberRate,
        actionSubmitTaskInFuture,
        actionSetConditionFragmentsSupply,
      ],
      selfProviderGasLimit: 1000000, // Limiting the required gas to 4M
      selfProviderGasPrice: 0, // We want to execute this transaction no matter the current gasPrice
    });

    actionSubmitTaskSupplyDown = new Action({
      addr: gelatoCoreAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "IGelatoCore",
        functionname: "submitTaskCycle",
        inputs: [
          myGelatoProvider,
          [taskSupplyDown],
          0, // 23 hours in seconds => Time for this Task to be live, after that it will expire
          CYCLES,
        ],
      }),
      operation: Operation.Call, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.None, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: false, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });
  });

  // ############################### Task 2 ###############################
  // Export Task which tracks if supply is increasing
  before(async function () {
    // --> Step 2: Create Task Objects
    /*
    Condition: Supply On UFragments
    Actions:
    - Sell AMPL for ETH on Kyber
    - Set Kyber Rate based on taskReceipt1 + 1
    - Submit Task 2
    */
    const conditionFragmentSupply = new Condition({
      inst: conditionFragmentSupplyAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ConditionFragmentsSupply",
        functionname: "checkRefSupply",
        inputs: [
          myUserProxyAddress,
          true /* return "OK" if supply increases */,
        ],
      }),
    });

    const actionReturnAmplBalance = new Action({
      addr: actionReturnBalanceAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionReturnBalance",
        functionname: "action",
        inputs: [
          AMPL,
          50 /* 50% of user proxies AMPL balance should be sold */,
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.Out, // The return value from this action will overwrite the sell amount in the following action
      termsOkCheck: false, //
      value: 0,
    });

    const actionSellAmplForEthOnUniswap = new Action({
      addr: actionUniswapTradeAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionUniswapV2Trade",
        functionname: "action",
        inputs: [
          AMPL, // sendToken
          0, // will be overwritten by the previous action
          ETH, // receiveToken
          myUserProxyAddress, // receiver
          myUserProxyAddress, // origin
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.In, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: true, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    const actionSetKyberRate = new Action({
      addr: conditionUniswapV2RateAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ConditionUniswapV2RateStateful",
        functionname: "setRefRateRelative",
        inputs: [
          AMPL, // sendToken
          utils.parseUnits("100", 9), // Get exchange rate for 100 AMPL
          ETH, // receiveToken
          false, // We want to store a lower rate than the current market rate
          10, // We are wating for a 10% drop
          0, // We want to store the rate for the next taskReceiptId which will be submitted after this action
        ],
      }),
      operation: Operation.Call, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.None, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: false, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    actionSetConditionFragmentsSupply = new Action({
      addr: conditionFragmentSupplyAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ConditionFragmentsSupply",
        functionname: "setRefSupply",
        inputs: [],
      }),
      operation: Operation.Call, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.None, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: false, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    // #########   Task 2, which we will need to encode into Task 1

    /*
    uint256 _taskReceiptId,
    address _userProxy,
    address _sendToken,
    uint256 _sendAmount,
    address _receiveToken,
    bool _greaterElseSmaller
  */
    const conditionKyberRateStateful = new Condition({
      inst: conditionUniswapV2RateAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ConditionUniswapV2RateStateful",
        functionname: "checkRefRateUniswap",
        inputs: [
          0, // will be overwritten by gelato core
          myUserProxyAddress,
          AMPL, // sendToken
          utils.parseUnits("100", 9), // Get exchange rate for 100 AMPL
          ETH, // receiveToken
          false, // We want to check if the rate is lower than the current rate
        ],
      }),
    });

    const actionReturnEthBalance = new Action({
      addr: actionReturnBalanceAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionReturnBalance",
        functionname: "action",
        inputs: [
          ETH,
          100 /* 50% of user proxies AMPL balance should be sold */,
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.Out, // The return value from this action will overwrite the sell amount in the following action
      termsOkCheck: false, //
      value: 0,
    });

    const actionSellEthForAmplOnUniswap = new Action({
      addr: actionUniswapTradeAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionUniswapV2Trade",
        functionname: "action",
        inputs: [
          ETH, // sendToken
          0, // will be overwritten by the previous action
          AMPL, // receiveToken
          myUserProxyAddress, // receiver
          myUserProxyAddress, // origin
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.In, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: true, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    // This is all the info we need to submit this task to Gelato
    const task2 = new Task({
      // All the conditions have to be met
      conditions: [conditionKyberRateStateful],
      // These Actions have to be executed in the same TX all-or-nothing
      actions: [actionReturnEthBalance, actionSellEthForAmplOnUniswap],
      selfProviderGasLimit: 3000000, // Limiting the required gas to 3M
      selfProviderGasPrice: 0, // We want to execute this transaction no matter the current gasPrice
    });

    // ############### Continue Task 1
    const provider = new GelatoProvider({
      addr: myUserProxyAddress, // As the user is paying for the gelato transactions himself, the provider address will equal the users proxy address
      module: network.config.deployments.ProviderModuleGelatoUserProxy,
    });

    const actionSubmitTaskInFuture = new Action({
      addr: actionSubmitTaskInFutureAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "ActionSubmitTaskInFuture",
        functionname: "action",
        inputs: [
          provider,
          task2,
          LIMIT_ORDER_LIFETIME, // 23 hours in seconds => Time for this Task to be live, after that it will expire
        ],
      }),
      operation: Operation.Delegatecall, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.None, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: false, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });

    taskSupplyUp = new Task({
      // All the conditions have to be met
      conditions: [conditionFragmentSupply],
      // These Actions have to be executed in the same TX all-or-nothing
      actions: [
        actionReturnAmplBalance,
        actionSellAmplForEthOnUniswap,
        actionSetKyberRate,
        actionSubmitTaskInFuture,
        actionSetConditionFragmentsSupply,
      ],
      selfProviderGasLimit: 1000000, // Limiting the required gas to 4M
      selfProviderGasPrice: 0, // We want to execute this transaction no matter the current gasPrice
    });

    actionSubmitTaskSupplyUp = new Action({
      addr: gelatoCoreAddress,
      data: await bre.run("abi-encode-withselector", {
        contractname: "IGelatoCore",
        functionname: "submitTaskCycle",
        inputs: [
          myGelatoProvider,
          [taskSupplyUp],
          0, // 23 hours in seconds => Time for this Task to be live, after that it will expire
          CYCLES,
        ],
      }),
      operation: Operation.Call, // This Action must be executed via the UserProxy
      dataFlow: DataFlow.None, // Overwrite sendToken and sendAmount with data from previous action
      termsOkCheck: false, // Some sanity checks have to pass before Execution is granted
      value: 0,
    });
  });

  // --> Step 2: Submit your Task to Gelato via your GelatoUserProxy
  it("Transaction submitting your Task via your GelatoUserProxy", async function () {
    // First we want to make sure that the Task we want to submit actually has
    // a valid Provider, so we need to ask GelatoCore some questions about the Provider.

    // Instantiate GelatoCore contract instance for sanity checks
    const gelatoCore = await ethers.getContractAt(
      "GelatoCore", // fetches the contract ABI from artifacts/
      gelatoCoreAddress // the Rinkeby Address of the deployed GelatoCore
    );

    // For our Task to be executable, our Provider must have sufficient funds on Gelato
    const providerIsLiquid = await gelatoCore.isProviderLiquid(
      myUserProxyAddress,
      estimatedGasPerExecution.mul(ethers.utils.bigNumberify("3")), // we need roughtly estimatedGasPerExecution * 3 executions as balance on gelato
      currentGelatoGasPrice
    );
    if (!providerIsLiquid) {
      console.log(
        "\n ❌  Ooops! Your Provider needs to provide more funds to Gelato \n"
      );
      console.log("DEMO: run this command: `yarn provide` first");
      process.exit(1);
    }

    // For the Demo, make sure the Provider has the Gelato default Executor assigned
    const assignedExecutor = await gelatoCore.executorByProvider(
      myUserProxyAddress
    );
    if (assignedExecutor !== defaultExecutor) {
      console.log(
        "\n ❌  Ooops! Your Provider needs to assign the gelato default Executor \n"
      );
      console.log("DEMO: run this command: `yarn provide` first");
      process.exit(1);
    }

    // For the Demo, our Provider must use the deployed ProviderModuleGelatoUserProxy
    const userProxyModuleIsProvided = await gelatoCore.isModuleProvided(
      myUserProxyAddress,
      network.config.deployments.ProviderModuleGelatoUserProxy
    );
    if (!userProxyModuleIsProvided) {
      console.log(
        "\n ❌  Ooops! Your Provider still needs to add ProviderModuleGelatoUserProxy \n"
      );
      console.log("DEMO: run this command: `yarn provide` first");
      process.exit(1);
    }

    // The single Transaction that deploys your GelatoUserProxy and submits your Task Cycle
    if (
      providerIsLiquid &&
      assignedExecutor === defaultExecutor &&
      userProxyModuleIsProvided
    ) {
      // We also want to keep track of token balances in our UserWallet
      const myUserWalletDAIBalance = await bre.run("erc20-balance", {
        erc20name: "AMPL",
        owner: myUserAddress,
      });

      // Since our Proxy will move a total of 3 AMPL from our UserWallet to
      // trade them for KNC and pay the Provider fee, we need to make sure the we
      // have the AMPL balance
      if (!myUserWalletDAIBalance.gte(3)) {
        console.log(
          "\n ❌ Ooops! You need at least 3 AMPL in your UserWallet \n"
        );
        process.exit(1);
      }

      // ###### 1st TX => SEND AMPL TO USER

      try {
        console.log("\n Sending Transaction to transfer UserProxy for AMPL.");
        console.log("\n Waiting for AMPL Transfer Tx to be mined....");
        await bre.run("erc20-transfer", {
          erc20name: "AMPL",
          amount: initalAmplInvestment.toString(),
          spender: myUserProxyAddress,
        });
        console.log(
          "\n Gelato User Proxy now has your Transfer to move 3 AMPL  ✅ \n"
        );
      } catch (error) {
        console.error("\n UserProxy AMPL Transfer failed ❌  \n", error);
        process.exit(1);
      }

      const expiryDate = 0; // infinte

      // ###### 2nd TX => Submit Task to gelato

      // We Submit our Task as a "Task Cycle" with 3 cycles to limit the number
      // of total Task executions to three.
      let taskSubmissionTx;
      try {
        console.log(
          "\n Sending Transaction to submit taskSupplyDown & taskSupplyUp Task!"
        );
        taskSubmissionTx = await myUserProxy.multiExecActions(
          [
            actionSetConditionFragmentsSupply,
            actionSubmitTaskSupplyDown,
            actionSubmitTaskSupplyUp,
          ],
          {
            gasLimit: 3000000,
            gasPrice: utils.parseUnits("10", "gwei"),
            value: initalEthInvestment,
          }
        );
      } catch (error) {
        console.error("\n PRE taskSubmissionTx error ❌  \n", error);
        process.exit(1);
      }
      try {
        console.log("\n Waiting for taskSubmissionTx to get mined...");
        console.log(`\n Tx Hash: ${taskSubmissionTx.hash}`);
        await taskSubmissionTx.wait();
        console.log("Task Submitted ✅ \n");
        console.log("Task will be executed a total of 3 times \n");
      } catch (error) {
        console.error("\n POST taskSubmissionTx error ❌ ", error);
        process.exit(1);
      }
    }
  });
});

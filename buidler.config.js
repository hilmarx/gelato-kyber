// ES6 module imports via require
require("@babel/register");

// Libraries
const assert = require("assert");
const { constants, errors, utils } = require("ethers");

// Disable ethers v4 warnings e.g. for solidity overloaded fns
errors.setLogLevel("error");

// Process Env Variables
require("dotenv").config();
const INFURA_ID = process.env.DEMO_INFURA_ID;
const USER_PK = process.env.DEMO_USER_PK;
const PROVIDER_PK = process.env.DEMO_PROVIDER_PK;
assert.ok(INFURA_ID, "no Infura ID in process.env");
assert.ok(USER_PK, "no User private key (USER_PK) found in .env");
assert.ok(PROVIDER_PK, "no Provider private key (Provider_PK) found in .env");

// ================================= CONFIG =========================================
module.exports = {
  defaultNetwork: "rinkeby",
  networks: {
    rinkeby: {
      // Standard
      accounts: [USER_PK, PROVIDER_PK],
      chainId: 4,
      // gas: 4000000,  // 4 million
      gasPrice: parseInt(utils.parseUnits("8", "gwei")),
      url: `https://rinkeby.infura.io/v3/${INFURA_ID}`,
      // Custom
      // Rinkeby: addressBook
      addressBook: {
        // Rinkeby: erc20s
        erc20: {
          DAI: "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa",
          "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa": "DAI",
          AMPL: "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa", // WE take KNC balance for now
          "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa": "AMPL",
          KNC: "0x6fa355a7b6bd2d6bd8b927c489221bfbb6f1d7b2",
          "0x6fa355a7b6bd2d6bd8b927c489221bfbb6f1d7b2": "KNC",
          WETH: "0xc778417e063141139fce010982780140aa0cd5ab",
          "0xc778417e063141139fce010982780140aa0cd5ab": "WETH",
        },

        // Rinkeby: Gelato
        gelatoExecutor: {
          default: "0xa5A98a6AD379C7B578bD85E35A3eC28AD72A336b", // PermissionedExecutors
        },

        uniswapV2: {
          router02: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
          factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        },

        // Rinkeby: Kyber
        kyber: {
          ETH: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          networkProxy: "0xF77eC7Ed5f5B9a5aee4cfa6FFCaC6A4C315BaC76",
        },
      },

      // Rinkeby: Contracts
      contracts: [
        // === Actions ===
        // Kyber
        "ActionKyberTrade",
        // Return balance
        "ActionReturnBalance",
        // Gelato
        "ActionSubmitTaskInFuture",
        // Uniswap
        "ActionUniswapV2Trade",
        // Provider
        // === Conditions ===
        "ConditionFragmentsSupply",
        "ConditionKyberRateStateful",
        "ConditionUniswapV2RateStateful",
        // === GelatoCore ===
        "GelatoCore",
        // === ProviderModules ===
        "ProviderModuleGelatoUserProxy",
        // === Mocks ===
        "MockUFragments",
      ],

      // Rinkeby: Deployments
      deployments: {
        // ==== Actions ====
        // Kyber
        ActionKyberTrade: "0xe2B2f27D674F49fB3d67D6D21F5d85EFe2B95635",
        // Return Balance
        ActionReturnBalance: "0x1Ce2299d2191d83E0d948767ef5a3E9Daf645539",
        // Transfer
        ActionTransfer: "0x783bD05d52B02811dECC8960aBF38A56c9Fb5F9B",
        // GelatoCore
        ActionSubmitTaskInFuture: "0xa1c10b6D366577FEdbfC6d9C37CCE279c9F4cf34",
        // Uniswap v2 action
        ActionUniswapV2Trade: "0xB7f8f5C419B0033EfEf40A1F9D74918f0ddeEF1B",

        // ==== Conditions ====
        ConditionFragmentsSupply: "0x1FfE1F8ef11cc966FEFD4A3195C3109307E2c58d",
        ConditionKyberRateStateful:
          "0x6eAa5330979cD3f838D317a275eF82bF15C61837",
        ConditionUniswapV2RateStateful:
          "0x7e4CAeA126f9F7b22D3D42Ecf3Cb23cB730D6FAD",

        // ===== Gelato Core ====
        GelatoCore: "0x733aDEf4f8346FD96107d8d6605eA9ab5645d632",
        // === GelatoUserProxies ===
        GelatoUserProxyFactory: "0x0309EC714C7E7c4C5B94bed97439940aED4F0624",
        // ===== Provider Modules ====
        ProviderModuleGelatoUserProxy:
          "0x66a35534126B4B0845A2aa03825b95dFaaE88B0C",
        // === Mocks ===
        MockUFragments: "0x5a52a707747B6B902a82a0D77f06117d54933716",
      },

      // Rinkeby: Filters
      filters: {
        defaultFromBlock: 6699941,
        defaultToBlock: "latest",
      },
    },
  },
  solc: {
    version: "0.6.10",
    optimizer: { enabled: true },
  },
};

// Classes
const Action = require("./src/classes/gelato/Action").default;
const Condition = require("./src/classes/gelato/Condition").default;
const GelatoProvider = require("./src/classes/gelato/GelatoProvider").default;
const Task = require("./src/classes/gelato/Task").default;
const TaskSpec = require("./src/classes/gelato/TaskSpec").default;
const TaskReceipt = require("./src/classes/gelato/TaskReceipt").default;
// Objects/Enums
const Operation = require("./src/enums/gelato/Operation").default;
const DataFlow = require("./src/enums/gelato/DataFlow").default;

// Helpers
// Async
const sleep = require("./src/helpers/async/sleep").default;
// Gelato
const convertTaskReceiptArrayToObj = require("./src/helpers/gelato/convertTaskReceiptArrayToObj")
  .default;
const convertTaskReceiptObjToArray = require("./src/helpers/gelato/convertTaskReceiptObjToArray")
  .default;
// Nested Arrays
const nestedArraysAreEqual = require("./src/helpers/nestedArrays/nestedArraysAreEqual")
  .default;
// Nested Objects
const checkNestedObj = require("./src/helpers/nestedObjects/checkNestedObj")
  .default;
const getNestedObj = require("./src/helpers/nestedObjects/getNestedObj")
  .default;

// ================================= BRE extension ==================================
extendEnvironment((bre) => {
  // DEMO
  bre.userAddress = bre.network.config.addressBook.user;
  bre.providerAddress = bre.network.config.addressBook.provider;
  bre.userProxyAddress = bre.network.config.addressBook.userProxy;
  bre.getUserWallet = async () => {
    const [userWallet] = await bre.ethers.getSigners();
    return userWallet;
  };
  bre.getProviderWallet = async () => {
    const [_, providerWallet] = await bre.ethers.getSigners();
    return providerWallet;
  };
  // Classes
  bre.Action = Action;
  bre.Condition = Condition;
  bre.GelatoProvider = GelatoProvider;
  bre.Task = Task;
  bre.TaskSpec = TaskSpec;
  bre.TaskReceipt = TaskReceipt;
  // Objects/Enums
  bre.Operation = Operation;
  bre.DataFlow = DataFlow;
  // Functions
  // Async
  bre.sleep = sleep;
  // Gelato
  bre.convertTaskReceiptArrayToObj = convertTaskReceiptArrayToObj;
  bre.convertTaskReceiptObjToArray = convertTaskReceiptObjToArray;
  // Nested Arrays
  bre.nestedArraysAreEqual = nestedArraysAreEqual;
  // Nested Objects
  bre.checkNestedObj = checkNestedObj;
  bre.getNestedObj = getNestedObj;
  // Libraries
  bre.constants = constants;
  bre.utils = utils;
});

// ================================= PLUGINS =========================================
usePlugin("@nomiclabs/buidler-ethers");
usePlugin("@nomiclabs/buidler-waffle");

// ================================= TASKS =========================================
// task action function receives the Buidler Runtime Environment as second argument

// ============== ABI
require("./buidler/tasks/abi/collection.tasks.abi");

// ============== BRE
// BRE, BRE-CONFIG(:networks), BRE-NETWORK
require("./buidler/tasks/bre/collection.tasks.bre");

// ======================== DEMO ======================================
// require("./demo/Part-1_Gelato_Providers/step1.1-deploy-fee-contract");
// require("./demo/Part-1_Gelato_Providers/step1.2-whitelist-fee-token");

// ============== DEPLOY
require("./buidler/tasks/deploy/collection.tasks.deploy");

// ============== ERC20
require("./buidler/tasks/erc20/collection.tasks.erc20");

// ============= GELATO
// CORE
// TaskReceipts ...
require("./buidler/tasks/gelato/core/collection.tasks.gelato-core");

// ======================== INTERNAL HELPER TASKS ======================================
// encoding, naming ....
require("./buidler/tasks/internal/collection.internalTasks");

// Mocks
require("./buidler/tasks/mocks/collection.tasks.mocks.js");

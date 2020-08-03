// running `npx buidler test` automatically makes use of buidler-waffle plugin
// => only dependency we need is "chai"
import { expect } from "chai";

// We require the Buidler Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `buidler run <script>` you'll find the Buidler
// Runtime Environment's members available in the global scope.
import bre from "@nomiclabs/buidler";

describe("Change getExpectedRate of Mock fragments", function () {
  // No timeout for Mocha due to Rinkeby mining latency
  this.timeout(0);

  let myUserWallet;
  let myUserAddress;

  const mockUFragmentsAddress = bre.network.config.deployments.MockUFragments;

  let mockUFragments;
  let currentPrice;
  let newPrice;

  before(async function () {
    // We get our User Wallet from the Buidler Runtime Env
    myUserWallet = await bre.getUserWallet();
    myUserAddress = await myUserWallet.getAddress();

    // --> Step 1: Deploy your GelatoUserProxy
    mockUFragments = await ethers.getContractAt(
      "MockUFragments",
      mockUFragmentsAddress
    );

    const currentPrices = await mockUFragments.getExpectedRate(
      constants.AddressZero,
      constants.AddressZero,
      constants.Zero
    );

    currentPrice = currentPrices[0];

    newPrice = currentPrice.mul(90).div(100);
  });

  it("Change Mock Fragments Get expected rate", async function () {
    // Transaction to deploy your GelatoUserProxy a
    // If we have not deployed our GelatoUserProxy yet, we deploy it and submit our
    // TaskCycle via the GelatoUserProxyFactory
    let setGetExpectedRateTx;
    console.log(`Old Price: ${currentPrice.toString()}`);
    console.log(`New Price: ${newPrice.toString()}`);
    try {
      console.log("\n Sending Transaction to MockFragments contract!");
      setGetExpectedRateTx = await mockUFragments.setExpectedRate(newPrice, {
        gasLimit: 4000000,
        gasPrice: utils.parseUnits("30", "gwei"),
      });
    } catch (error) {
      console.error("\n PRE setGetExpectedRateTx error ❌  \n", error);
      process.exit(1);
    }
    try {
      console.log("\n Waiting for setGetExpectedRateTx to get mined...");
      await setGetExpectedRateTx.wait();
      console.log("UserProxy deployed ✅ \n");
    } catch (error) {
      console.error("\n POST setGetExpectedRateTx error ❌ ", error);
      process.exit(1);
    }
  });
});

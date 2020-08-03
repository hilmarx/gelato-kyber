// running `npx buidler test` automatically makes use of buidler-waffle plugin
// => only dependency we need is "chai"
import { expect } from "chai";

// We require the Buidler Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `buidler run <script>` you'll find the Buidler
// Runtime Environment's members available in the global scope.
import bre from "@nomiclabs/buidler";

describe("Change supply of Mock fragments", function () {
  // No timeout for Mocha due to Rinkeby mining latency
  this.timeout(0);

  let myUserWallet;
  let myUserAddress;

  const mockUFragmentsAddress = bre.network.config.deployments.MockUFragments;

  let mockUFragments;
  let currentSupply;
  let newSupply;

  before(async function () {
    // We get our User Wallet from the Buidler Runtime Env
    myUserWallet = await bre.getUserWallet();
    myUserAddress = await myUserWallet.getAddress();

    // --> Step 1: Deploy your GelatoUserProxy
    mockUFragments = await ethers.getContractAt(
      "MockUFragments",
      mockUFragmentsAddress
    );

    currentSupply = await mockUFragments.totalSupply();
    newSupply = currentSupply.add(currentSupply.mul(10).div(100));
    console.log(`Current Supply: ${currentSupply}`);
    console.log(`New Supply: ${newSupply}`);
  });

  it("Change Mock Fragments Supply", async function () {
    // Transaction to deploy your GelatoUserProxy a
    // If we have not deployed our GelatoUserProxy yet, we deploy it and submit our
    // TaskCycle via the GelatoUserProxyFactory
    let setSupplyTx;
    try {
      console.log("\n Sending Transaction to MockFragments contract!");
      setSupplyTx = await mockUFragments.setTotalSupply(newSupply, {
        gasLimit: 4000000,
        gasPrice: utils.parseUnits("30", "gwei"),
      });
    } catch (error) {
      console.error("\n PRE setSupplyTx error ❌  \n", error);
      process.exit(1);
    }
    try {
      console.log("\n Waiting for setSupplyTx to get mined...");
      await setSupplyTx.wait();
      console.log("UserProxy deployed ✅ \n");
    } catch (error) {
      console.error("\n POST setSupplyTx error ❌ ", error);
      process.exit(1);
    }
  });
});

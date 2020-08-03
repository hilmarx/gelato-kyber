import { task } from "@nomiclabs/buidler/config";

export default task(
  "change-mock-rate",
  `Changes token rate of Mock Uniswap on Rinkeby`
)
  .addPositionalParam("percentagechange", "The amount to change the supply")
  .addPositionalParam(
    "increment",
    "Should the current balance be incremented?",
    true,
    types.boolean
  )
  .addFlag("log", "Logs return values to stdout")
  .setAction(async ({ percentagechange, increment }) => {
    try {
      const myUserWallet = await getUserWallet();

      // --> Step 1: Deploy your GelatoUserProxy
      const mockUFragments = await ethers.getContractAt(
        "MockUFragments",
        network.config.deployments.MockUFragments
      );

      const currentRate = await mockUFragments._expectedRate();
      let newRate;
      if (increment)
        newRate = currentRate.add(currentRate.mul(percentagechange).div(100));
      else
        newRate = currentRate.sub(currentRate.mul(percentagechange).div(100));
      console.log(`Current Rate: ${currentRate}`);
      console.log(`New Rate: ${newRate}`);

      let setRateTx;
      try {
        console.log("\n Sending Transaction to MockFragments contract!");
        setRateTx = await mockUFragments.setExpectedRate(newRate, {
          gasLimit: 4000000,
        });
      } catch (error) {
        console.error("\n PRE setRateTx error ❌  \n", error);
        process.exit(1);
      }
      try {
        console.log("\n Waiting for setRateTx to get mined...");
        await setRateTx.wait();
        console.log("setRateTx mined ✅ \n");
      } catch (error) {
        console.error("\n POST setRateTx error ❌ ", error);
        process.exit(1);
      }
    } catch (error) {
      console.error(error, "\n");
      console.log(`❌ Tx failed`);
      process.exit(1);
    }
  });

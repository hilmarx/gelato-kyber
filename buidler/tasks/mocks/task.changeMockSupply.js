import { task } from "@nomiclabs/buidler/config";

export default task(
  "change-mock-supply",
  `Changes token supply of Mock UFragments on Rinkeby`
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

      const currentSupply = await mockUFragments.totalSupply();
      let newSupply;
      if (increment)
        newSupply = currentSupply.add(
          currentSupply.mul(percentagechange).div(100)
        );
      else
        newSupply = currentSupply.sub(
          currentSupply.mul(percentagechange).div(100)
        );
      console.log(`Current Supply: ${currentSupply}`);
      console.log(`New Supply: ${newSupply}`);

      let setSupplyTx;
      try {
        console.log("\n Sending Transaction to MockFragments contract!");
        setSupplyTx = await mockUFragments.setTotalSupply(newSupply, {
          gasLimit: 4000000,
        });
      } catch (error) {
        console.error("\n PRE setSupplyTx error ❌  \n", error);
        process.exit(1);
      }
      try {
        console.log("\n Waiting for setSupplyTx to get mined...");
        await setSupplyTx.wait();
        console.log("setSupplyTx mined ✅ \n");
      } catch (error) {
        console.error("\n POST setSupplyTx error ❌ ", error);
        process.exit(1);
      }
    } catch (error) {
      console.error(error, "\n");
      console.log(`❌ Tx failed`);
      process.exit(1);
    }
  });

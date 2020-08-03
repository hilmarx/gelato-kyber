import { task } from "@nomiclabs/buidler/config";

export default task(
  "gelato-providefunds",
  `Sends tx to GelatoCore.provideFunds(<) on Rinkeby`
)
  .addPositionalParam(
    "ethamount",
    "The amount of eth to add to the gelatoprovider's balance"
  )
  .addOptionalPositionalParam(
    "gelatoprovider",
    "The gelatoprovider to add balance to."
  )
  .addOptionalPositionalParam(
    "gelatocoreaddress",
    "The gelatoprovider to add balance to."
  )
  .addFlag("log", "Logs return values to stdout")
  .setAction(async ({ ethamount, gelatoprovider, log, gelatocoreaddress }) => {
    try {
      const CREATE_2_SALT = 123456789;

      const myUserWallet = await getUserWallet();
      const myUserAddress = await myUserWallet.getAddress();

      const gelatoUserProxyFactory = await ethers.getContractAt(
        "IGelatoUserProxyFactory",
        network.config.deployments.GelatoUserProxyFactory
      );

      const myUserProxyAddress = await gelatoUserProxyFactory.predictProxyAddress(
        myUserAddress,
        CREATE_2_SALT
      );

      const depositAmount = utils.parseEther(ethamount);
      if (!gelatoprovider) gelatoprovider = providerAddress;

      if (log) {
        console.log(`
          \n Funder:                          ${myUserAddress}\
          \n Funding Provider with Address:   ${myUserProxyAddress}\n
          \n Amount:                          ${ethamount} ETH\n
        `);
      }

      const gelatoCore = await ethers.getContractAt(
        "IGelatoProviders",
        network.config.deployments.GelatoCore
      );

      const tx = await gelatoCore.provideFunds(myUserProxyAddress, {
        value: depositAmount,
      });

      console.log(`Tx hash: ${tx.hash}`);

      await tx.wait();
      console.log(`✅ Tx mined`);
      return `✅ Tx mined`;
    } catch (error) {
      console.error(error, "\n");
      console.log(`❌ Tx failed`);
      process.exit(1);
    }
  });

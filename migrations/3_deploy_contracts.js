const AidDistribution = artifacts.require("AidDistribution");
const BeneficiaryRegistry = artifacts.require("BeneficiaryRegistry");

module.exports = async function(deployer, network, accounts) {
  console.log(`\n🚀 Deploying AidChain contracts to ${network.toUpperCase()} network`);
  console.log(`📍 Network: ${network}`);
  console.log(`👤 Deployer: ${accounts[0]}\n`);

  try {
    // Deploy BeneficiaryRegistry first
    console.log("📋 Deploying BeneficiaryRegistry...");
    const registry = await deployer.deploy(BeneficiaryRegistry);
    console.log(`✅ BeneficiaryRegistry deployed at: ${registry.address}`);

    // Deploy AidDistribution with registry address
    console.log("💰 Deploying AidDistribution...");
    const aid = await deployer.deploy(AidDistribution, registry.address);
    console.log(`✅ AidDistribution deployed at: ${aid.address}`);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("📝 Contract Addresses:");
    console.log(`   BeneficiaryRegistry: ${registry.address}`);
    console.log(`   AidDistribution: ${aid.address}`);

    // Save addresses for easy reference
    const fs = require('fs');
    const addresses = {
      network: network,
      registry: registry.address,
      aid: aid.address,
      deployedAt: new Date().toISOString()
    };

    const filename = `deployed-addresses-${network}.json`;
    fs.writeFileSync(filename, JSON.stringify(addresses, null, 2));
    console.log(`💾 Addresses saved to: ${filename}`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
};
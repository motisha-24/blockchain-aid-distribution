const BeneficiaryRegistry = artifacts.require("BeneficiaryRegistry");
const AidDistribution      = artifacts.require("AidDistribution");

module.exports = async function (deployer) {

  // Step 1 — Deploy BeneficiaryRegistry first
  await deployer.deploy(BeneficiaryRegistry);
  const registry = await BeneficiaryRegistry.deployed();
  console.log("BeneficiaryRegistry deployed at:", registry.address);

  // Step 2 — Deploy AidDistribution, passing registry address
  await deployer.deploy(AidDistribution, registry.address);
  const aid = await AidDistribution.deployed();
  console.log("AidDistribution deployed at:", aid.address);

};
const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules')

module.exports = buildModule('NFTMarketplaceModule', (m) => {
  // Define parameters with default values
  const serviceFee = m.getParameter('serviceFee', 250)

  // Deploy NFTMarketplace contract first
  const marketplace = m.contract('NFTMarketplace', [serviceFee])

  // Deploy LazyMintNFT contract with marketplace address as constructor argument
  const lazyMintNFT = m.contract('LazyMintNFT', [marketplace])

  // Return both contract instances
  return {
    marketplace,
    lazyMintNFT,
  }
})

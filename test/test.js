// const { expect } = require('chai')
// const { ethers } = require('hardhat')

// describe('NFT Marketplace - listItem Function', function () {
//   let Marketplace, marketplace, nft, owner, seller, buyer
//   const price = ethers.parseEther('1') // Set price for the listed item

//   before(async () => {
//     [owner, seller, buyer, address1] = await ethers.getSigners()
//     recipients = [address1.address]

//     // Deploy Marketplace contract
//     Marketplace = await ethers.getContractFactory('NFTMarketplace')
//     marketplace = await Marketplace.deploy(500)
//     await marketplace.waitForDeployment()

//     // Deploy NFT contract
//     const NFT = await ethers.getContractFactory('LazyMintNFT')
//     nft = await NFT.deploy(await marketplace.getAddress())
//     await nft.waitForDeployment()
//   })

//   it('Should allow a seller to list an item', async function () {
//     const tokenId = 1
//     const basePrice = ethers.parseEther('0.1') // Set base price for listing
//     const reservePrice = ethers.parseEther('0.05')
//     const saleKind = 0 // Sale type enum or constant

//     const listData = {
//       tokenId: tokenId,
//       basePrice: basePrice,
//       itemsAvailable: 1,
//       listingTime: Math.floor(Date.now() / 1000), // Current time in seconds
//       expirationTime: Math.floor(Date.now() / 1000) + 86400, // +1 day
//       reservePrice: reservePrice,
//       nftAddress: await nft.getAddress(),
//       seller: seller.address, // Set seller address
//       lazyMint: true,
//       saleKind: saleKind,
//     }

//     await expect(
//       marketplace.connect(seller).listItem(10, listData, [250], recipients)
//     )
//       .to.emit(marketplace, 'List')
//       .withArgs(
//         seller.address, // _msgSender()
//         await nft.getAddress(), // nftAddress
//         1, // itemId (assuming 1 for this test case)
//         tokenId, // tokenId
//         basePrice, // basePrice
//         listData.itemsAvailable, // itemsAvailable
//         listData.listingTime, // listingTime
//         listData.expirationTime, // expirationTime
//         saleKind // saleKind
//       )

//     const listedItem = await marketplace.marketItems(1) // Assuming itemId is 1 for this test

//     expect(listedItem.seller).to.exist

//     // Now perform the assertions
//     expect(listedItem.basePrice).to.equal(basePrice)
//     expect(listedItem.seller).to.equal(seller.address)
//     //expect(listedItem.isActive).to.be.true;
//   })

//   it('Should revert if the price is zero', async function () {
//     listData = {
//       tokenId: 1,
//       basePrice: ethers.parseEther('0.1'),
//       itemsAvailable: 1,
//       listingTime: Math.floor(Date.now() / 1000),
//       expirationTime: Math.floor(Date.now() / 1000) + 86400, // +1 day
//       reservePrice: ethers.parseEther('0.05'),
//       nftAddress: await nft.getAddress(),
//       seller: seller.address,
//       lazyMint: true,
//       saleKind: 0, // Sale type enum or constant
//     }
//     const zeroPriceListData = {
//       ...listData,
//       basePrice: ethers.parseEther('0'),
//       tokenId: 3,
//     }

//     await expect(
//       marketplace
//         .connect(seller)
//         .listItem(
//           zeroPriceListData.itemsAvailable,
//           zeroPriceListData,
//           [250],
//           recipients
//         )
//     ).to.be.revertedWith('listItem: Price cannot be zero')
//   })
//   it('should revert if nft address is zero', async function () {
//     const itemData = {
//       tokenId: 1,
//       basePrice: ethers.parseEther('10'),
//       itemsAvailable: 1,
//       listingTime: Math.floor(Date.now() / 1000),
//       expirationTime: Math.floor(Date.now() / 1000) + 86400, // +1 day
//       reservePrice: ethers.parseEther('50'),
//       nftAddress: '0x0000000000000000000000000000000000000000', // Zero address
//       seller: seller.address,
//       lazyMint: true,
//       saleKind: 0, // Assuming FixedPrice
//     }

//     await expect(
//       marketplace
//         .connect(seller)
//         .listItem(5, itemData, [1000], [address1.address])
//     ).to.be.revertedWith('listItem: nft address is zero')
//   })
//   it('should revert if nft amount is zero', async function () {
//     const itemData = {
//       nftAddress: await nft.getAddress(),
//       tokenId: 1,
//       basePrice: ethers.parseEther('0.1'),
//       itemsAvailable: 0, // Zero amount to trigger the revert
//       listingTime: Math.floor(Date.now() / 1000),
//       expirationTime: Math.floor(Date.now() / 1000) + 86400, // +1 day
//       reservePrice: ethers.parseEther('0.05'), // Example reserve price
//       seller: seller.address,
//       lazyMint: false,
//       saleKind: 0, // Assuming FixedPrice
//     }

//     await expect(
//       marketplace
//         .connect(seller)
//         .listItem(5, itemData, [1000], [address1.address])
//     ).to.be.revertedWith('listItem: nft amount is zero')
//   })
//   it('should revert if expiration date is invalid', async function () {
//     const currentTime = Math.floor(Date.now() / 1000)

//     const itemData = {
//       nftAddress: await nft.getAddress(),
//       tokenId: 1,
//       basePrice: ethers.parseEther('0.1'),
//       itemsAvailable: 5,
//       listingTime: currentTime,
//       expirationTime: currentTime, // Invalid as it's the same as listingTime
//       reservePrice: ethers.parseEther('0.05'), // Example reserve price
//       seller: seller.address,
//       lazyMint: false,
//       saleKind: 0, // Assuming SaleKind.Fixed is correctly imported or defined
//     }

//     await expect(
//       marketplace
//         .connect(seller)
//         .listItem(5, itemData, [1000], [address1.address])
//     ).to.be.revertedWith('listItem: Expiration date invalid')
//   })
//   it('should revert if listing time is invalid', async function () {
//     const itemData = {
//       nftAddress: await nft.getAddress(),
//       tokenId: 1,
//       basePrice: ethers.parseEther('0.1'),
//       itemsAvailable: 5,
//       listingTime: Math.floor(Date.now() / 1000) - 400,
//       expirationTime: Math.floor(Date.now() / 1000) + 86400,
//       reservePrice: ethers.parseEther('0.05'), // Example reserve price
//       seller: seller.address,
//       saleKind: 0,
//       lazyMint: false,
//     }

//     await expect(
//       marketplace.listItem(5, itemData, [1000], [address1.address])
//     ).to.be.revertedWith('listItem: listing time invalid')
//   })
// })
// describe('NFTMarketplace - cancelListing', function () {
//   let marketplace, nft, owner, admin, user
//   let itemId = 1
//   let tokenId = 1
//   let amount = 5

//   beforeEach(async function () {
//     ;[admin, seller, address1] = await ethers.getSigners()
//     const Marketplace = await ethers.getContractFactory('NFTMarketplace')
//     marketplace = await Marketplace.deploy(500)
//     await marketplace.waitForDeployment()

//     // Deploy mock NFT (IERC1155) and Marketplace contractsḥ
//     const NFT = await ethers.getContractFactory('LazyMintNFT')
//     nft = await NFT.deploy(await marketplace.getAddress())
//     await nft.waitForDeployment()

//     const itemData = {
//       tokenId: 1,
//       basePrice: ethers.parseEther('10'),
//       itemsAvailable: amount,
//       listingTime: Math.floor(Date.now() / 1000),
//       expirationTime: Math.floor(Date.now() / 1000) + 86400, // +1 day
//       reservePrice: ethers.parseEther('50'),
//       nftAddress: await nft.getAddress(), // Zero address
//       seller: seller.address,
//       lazyMint: true,
//       saleKind: 0, // Assuming FixedPrice
//     }
//     await marketplace
//       .connect(seller)
//       .listItem(5, itemData, [1000], [address1.address])
//   })

//   it('Should cancel listing successfully by admin', async function () {
//     await expect(marketplace.connect(admin).cancelListing(1))
//       .to.emit(marketplace, 'Cancel')
//       .withArgs(admin.address, await nft.getAddress(), itemId, tokenId, amount)

//     const item = await marketplace.marketItems(itemId)
//     expect(item.nftAddress).to.equal(
//       '0x0000000000000000000000000000000000000000'
//     )
//   })

//   it('Should revert when called by non-admin', async function () {
//     await expect(
//       marketplace.connect(address1).cancelListing(itemId)
//     ).to.be.revertedWith('cancelListing: Unauthorized access')
//   })
// })

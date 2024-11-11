// const { expect } = require('chai')
// const { ethers } = require('hardhat')
// const  SignWallet  = require('../ignition/modules/signature')

// describe('NFTMarketplace - claimOffer function', function () {
//   let marketplace, nft, admin, seller, buyer
//   let itemId = 1
//   let nftAmount = 1
//   let voucher, signature

//   beforeEach(async function () {
//     // Get signers
//     [admin, seller, buyer, address1] = await ethers.getSigners()

//     // Deploy marketplace contract
//     const Marketplace = await ethers.getContractFactory('NFTMarketplace')
//     marketplace = await Marketplace.deploy(500) // 5% service fee
//     await marketplace.waitForDeployment()

//     // Deploy NFT contract
//     const NFT = await ethers.getContractFactory('LazyMintNFT')
//     nft = await NFT.deploy(await marketplace.getAddress())
//     await nft.waitForDeployment()

//     // Create listing data
//     const itemData = {
//       tokenId: 1,
//       basePrice: ethers.parseEther('10'),
//       itemsAvailable: 5,
//       listingTime: Math.floor(Date.now() / 1000),
//       expirationTime: Math.floor(Date.now() / 1000) + 86400, // +1 day
//       reservePrice: ethers.parseEther('5'),
//       nftAddress: await nft.getAddress(),
//       seller: seller.address,
//       lazyMint: true,
//       saleKind: 0, // FixedPrice
//     }

//     // List the item
//     await marketplace.connect(seller).listItem(
//       5, // maxCopies
//       itemData,
//       [1000], // royalties array
//       [address1.address] // recipients array
//     )

//     // Create voucher for lazy minting
//     voucher = {
//       tokenId: 1,
//       nftAmount: 1,
//       price: ethers.parseEther('10'),
//       startDate: Math.floor(Date.now() / 1000),
//       endDate: Math.floor(Date.now() / 1000) + 86400,
//       maker: seller.address,
//       nftAddress: await nft.getAddress(),
//       tokenURI: 'test-uri',
//     }

//     // Create signature using the seller's signer
//     const signWallet = new SignWallet(await nft.getAddress(), seller)
//     signature = await signWallet.getSignature(voucher)
//   })

//   it('Should successfully claim offer when called by admin', async function () {
//     await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true)

//     await expect(
//       marketplace
//         .connect(admin)
//         .claimOffer(itemId, buyer.address, nftAmount, voucher, signature)
//     )
//       .to.emit(marketplace, 'Sold')
//       .withArgs(
//         itemId,
//         seller.address,
//         buyer.address,
//         await nft.getAddress(),
//         voucher.tokenId,
//         ethers.parseEther('10'),
//         1
//       )
//   })

//   it('Should revert if called by unauthorized user', async function () {
//     await expect(
//       marketplace
//         .connect(address1)
//         .claimOffer(itemId, buyer.address, nftAmount, voucher, signature)
//     ).to.be.revertedWith('Only admin can perform this action')
//   })

//   it('Should revert if trying to buy more than available amount', async function () {
//     const excessAmount = 10 // More than listed amount
//     await expect(
//       marketplace
//         .connect(admin)
//         .claimOffer(itemId, buyer.address, excessAmount, voucher, signature)
//     ).to.be.revertedWith('claimOffer: Not enough tokens on sale')
//   })

//   it('Should revert if sale kind is not FixedPrice', async function () {
//     // First create a new auction listing
//     const auctionItemData = {
//       tokenId: 2,
//       basePrice: ethers.parseEther('10'),
//       itemsAvailable: 1,
//       listingTime: Math.floor(Date.now() / 1000),
//       expirationTime: Math.floor(Date.now() / 1000) + 86400,
//       reservePrice: ethers.parseEther('15'),
//       nftAddress: await nft.getAddress(),
//       seller: seller.address,
//       lazyMint: true,
//       saleKind: 1, // Auction
//     }

//     await marketplace
//       .connect(seller)
//       .listItem(1, auctionItemData, [1000], [address1.address])
//       await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true)

//     await expect(
//       marketplace.connect(admin).claimOffer(
//         2, // new itemId
//         buyer.address,
//         nftAmount,
//         voucher,
//         signature
//       )
//     ).to.be.revertedWith('accetedOffer: not valid for auction sale')
//   })

//   it('Should verify signature matches seller', async function () {
//     // Create invalid signature using buyer instead of seller
//     const invalidSignWallet = new SignWallet(await nft.getAddress(), buyer)
//     const invalidSignature = await invalidSignWallet.getSignature(voucher)

//     await expect(
//       marketplace
//         .connect(admin)
//         .claimOffer(itemId, buyer.address, nftAmount, voucher, invalidSignature)
//     ).to.be.revertedWith('claimOffer: unauthorized signer')
//   })
// })

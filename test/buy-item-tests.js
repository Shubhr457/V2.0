// const { expect } = require('chai');
// const { ethers } = require('hardhat');
// const SignWallet = require('../ignition/modules/signature');
// const { time } = require('@nomicfoundation/hardhat-network-helpers');

// describe('NFTMarketplace - buyItem function', function () {
//   let marketplace, nft, admin, seller, buyer;
//   let itemId = 1;
//   let nftAmount = 1;
//   let voucher, signature;

//   beforeEach(async function () {
//     // Get signers
//     [admin, seller, buyer, address1] = await ethers.getSigners();

//     // Deploy marketplace contract
//     const Marketplace = await ethers.getContractFactory('NFTMarketplace');
//     marketplace = await Marketplace.deploy(500); // 5% service fee
//     await marketplace.waitForDeployment();

//     // Deploy NFT contract
//     const NFT = await ethers.getContractFactory('LazyMintNFT');
//     nft = await NFT.deploy(await marketplace.getAddress());
//     await nft.waitForDeployment();

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
//     };

//     // List the item
//     await marketplace.connect(seller).listItem(
//       5, // maxCopies
//       itemData,
//       [1000], // royalties array
//       [address1.address] // recipients array
//     );

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
//     };

//     // Create signature using the seller's signer
//     const signWallet = new SignWallet(await nft.getAddress(), seller);
//     signature = await signWallet.getSignature(voucher);
//   });

//   it('Should successfully buy item when called by admin', async function () {
//     await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    
//     await expect(
//       marketplace
//         .connect(admin)
//         .buyItem(itemId, nftAmount, voucher, signature, buyer.address)
//     )
//       .to.emit(marketplace, 'Sold')
//       .withArgs(
//         itemId,
//         seller.address,
//         buyer.address,
//         await nft.getAddress(),
//         voucher.tokenId,
//         0, // Price is 0 for fiat purchases
//         1
//       )
//       .to.emit(marketplace, 'NFTTransferred')
//       .withArgs(
//         itemId,
//         seller.address,
//         buyer.address,
//         await nft.getAddress(),
//         voucher.tokenId,
//         nftAmount
//       );
//   });
  

//   it('Should revert if called by unauthorized user', async function () {
//     await expect(
//       marketplace
//         .connect(address1)
//         .buyItem(itemId, nftAmount, voucher, signature, buyer.address)
//     ).to.be.revertedWith('Only admin can perform this action');
//   });

//   it('Should revert if trying to buy more than available amount', async function () {
//     const excessAmount = 10; // More than listed amount
//     await expect(
//       marketplace
//         .connect(admin)
//         .buyItem(itemId, excessAmount, voucher, signature, buyer.address)
//     ).to.be.revertedWith('buyItem: Not enough tokens on sale');
//   });

//   it('Should revert if sale kind is not FixedPrice', async function () {
//     // Create a new auction listing
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
//     };

//     await marketplace
//       .connect(seller)
//       .listItem(1, auctionItemData, [1000], [address1.address]);

//     await expect(
//       marketplace
//         .connect(admin)
//         .buyItem(2, nftAmount, voucher, signature, buyer.address)
//     ).to.be.revertedWith('buyItem: Not on fixed price sale');
//   });

//   // it('Should revert if sale has expired', async function () {

//   //   // Create a listing with expired time
//   //   const expiredItemData = {
//   //     tokenId: 2,
//   //     basePrice: ethers.parseEther('10'),
//   //     itemsAvailable: 1,
//   //     listingTime: Math.floor(Date.now() / 1000) , // 2 days ago
//   //     expirationTime: Math.floor(Date.now() / 1000) + 86400, // 1 day ago
//   //     reservePrice: ethers.parseEther('5'),
//   //     nftAddress: await nft.getAddress(),
//   //     seller: seller.address,
//   //     lazyMint: true,
//   //     saleKind: 0,
//   //   };

//   //   await marketplace
//   //     .connect(seller)
//   //     .listItem(1, expiredItemData, [1000], [address1.address]);

//   //     await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true)

    
//   //   await expect(
//   //     marketplace
//   //       .connect(admin)
//   //       .buyItem(2, nftAmount, voucher, signature, buyer.address)
//   //   ).to.be.revertedWith('buyItem: Sale expired');
//   // });

//   it('Should revert if sale has expired', async function () {
//     const currentBlockTime = await time.latest();
    
//     // Create a listing with valid listing time but quick expiration
//     const expiredItemData = {
//       tokenId: 2,
//       basePrice: ethers.parseEther('10'),
//       itemsAvailable: 1,
//       listingTime: currentBlockTime, // Current block timestamp
//       expirationTime: currentBlockTime + 60, // Expire after 60 seconds
//       reservePrice: ethers.parseEther('5'),
//       nftAddress: await nft.getAddress(),
//       seller: seller.address,
//       lazyMint: true,
//       saleKind: 0,
//     };

//     // List the item
//     await marketplace
//       .connect(seller)
//       .listItem(1, expiredItemData, [1000], [address1.address]);

//     // Set approval
//     await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

//     // Advance time past the expiration
//     await time.increase(120); // Increase by 2 minutes to ensure expiration

//     // Try to buy - should fail because sale expired
//     await expect(
//       marketplace
//         .connect(admin)
//         .buyItem(2, nftAmount, voucher, signature, buyer.address)
//     ).to.be.revertedWith('buyItem: Sale expired');
//   });


//   it('Should revert if sale has not started', async function () {
//     // Create a listing with future start time
//     const futureItemData = {
//       tokenId: 2,
//       basePrice: ethers.parseEther('10'),
//       itemsAvailable: 1,
//       listingTime: Math.floor(Date.now() / 1000) + 86400, // Starts in 1 day
//       expirationTime: Math.floor(Date.now() / 1000) + 172800, // Ends in 2 days
//       reservePrice: ethers.parseEther('5'),
//       nftAddress: await nft.getAddress(),
//       seller: seller.address,
//       lazyMint: true,
//       saleKind: 0,
//     };

//     await marketplace
//       .connect(seller)
//       .listItem(1, futureItemData, [1000], [address1.address]);

//     await expect(
//       marketplace
//         .connect(admin)
//         .buyItem(2, nftAmount, voucher, signature, buyer.address)
//     ).to.be.revertedWith('buyItem: Sale not started');
//   });

//   it('Should revert if buyer is the seller', async function () {
//     await expect(
//       marketplace
//         .connect(admin)
//         .buyItem(itemId, nftAmount, voucher, signature, seller.address)
//     ).to.be.revertedWith('buyItem: seller itself cannot buy');
//   });

//   it('Should update item availability after successful purchase', async function () {
//     await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    
//     // Buy 2 tokens
//     const purchaseAmount = 2;
//     await marketplace
//       .connect(admin)
//       .buyItem(itemId, purchaseAmount, voucher, signature, buyer.address);

//     // Check remaining amount (should be 3 as we started with 5)
//     const item = await marketplace.marketItems(itemId);
//     expect(item.itemsAvailable).to.equal(3);
//   });

//   it('Should delete listing when all tokens are purchased', async function () {
//     await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
    
//     // Buy all available tokens
//     await marketplace
//       .connect(admin)
//       .buyItem(itemId, 5, voucher, signature, buyer.address);

//     // Check if listing is deleted
//     const item = await marketplace.marketItems(itemId);
//     expect(item.itemsAvailable).to.equal(0);
//    });
// });

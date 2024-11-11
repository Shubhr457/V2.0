// const { expect } = require('chai');
// const { ethers } = require('hardhat');
// const SignWallet = require('../ignition/modules/signature');

// describe('NFTMarketplace - claimNFT function', function () {
//     let marketplace, nft, admin, seller, buyer;
//     let itemId = 1;
//     let voucher, signature;
  
//     beforeEach(async function () {
//       [admin, seller, buyer] = await ethers.getSigners();
  
//       // Deploy marketplace contract
//       const Marketplace = await ethers.getContractFactory('NFTMarketplace');
//       marketplace = await Marketplace.deploy(500); // 5% service fee
//       await marketplace.waitForDeployment();
  
//       // Deploy NFT contract
//       const NFT = await ethers.getContractFactory('LazyMintNFT');
//       nft = await NFT.deploy(await marketplace.getAddress());
//       await nft.waitForDeployment();
  
//       // Get current block timestamp
//       const currentBlock = await ethers.provider.getBlock('latest');
//       const currentTime = currentBlock.timestamp;
  
//       // Set up auction listing data with valid timestamps
    //   const itemData = {
    //     tokenId: 1,
    //     basePrice: ethers.parseEther('5'),
    //     itemsAvailable: 1,
    //     listingTime: currentTime, // Use current block timestamp
    //     expirationTime: currentTime + 86400, // +1 day from current time
    //     reservePrice: ethers.parseEther('5'),
    //     nftAddress: await nft.getAddress(),
    //     seller: seller.address,
    //     lazyMint: true,
    //     saleKind: 1, // Auction
    //   };
  
    //   // List item
    //   await marketplace.connect(seller).listItem(
    //     1, // maxCopies
    //     itemData,
    //     [1000], // royalties array
    //     [buyer.address] // recipients array
    //   );
  
//       // Create voucher with matching timestamps
//       voucher = {
//         tokenId: 1,
//         nftAmount: 1,
//         price: ethers.parseEther('5'),
//         startDate: currentTime,
//         endDate: currentTime + 86400,
//         maker: seller.address,
//         nftAddress: await nft.getAddress(),
//         tokenURI: 'test-uri',
//       };
  
//       const signWallet = new SignWallet(await nft.getAddress(), seller);
//       signature = await signWallet.getSignature(voucher);
//     });
  
//     it('Should successfully claim NFT after auction ends', async function () {
//       // Fast-forward time to after auction end
//       await network.provider.send('evm_increaseTime', [86401]); // 1 day + 1 second
//       await network.provider.send('evm_mine');
  
//       // Ensure seller has approved marketplace
//       await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);
  
//       // Get initial market item state
//       const initialMarketItem = await marketplace.marketItems(itemId);
//       expect(initialMarketItem.itemsAvailable).to.equal(1);
  
//       // Claim NFT
//       const claimTx = await marketplace
//         .connect(admin)
//         .claimNFT(itemId, buyer.address, voucher, signature);
  
//       // Wait for transaction
//       await claimTx.wait();
  
//       // Verify market item is deleted or itemsAvailable is 0
//       const finalMarketItem = await marketplace.marketItems(itemId);
//       expect(finalMarketItem.itemsAvailable).to.equal(0);

//     });
  
//     it('Should revert if claimNFT is called before auction ends', async function () {
//       await expect(
//         marketplace
//           .connect(admin)
//           .claimNFT(itemId, buyer.address, voucher, signature)
//       ).to.be.revertedWith('claimNFT: Auction has not ended yet');
//     });

//     it('Should revert if buyer address is zero', async function () {
//         await network.provider.send('evm_increaseTime', [86401])
//         await network.provider.send('evm_mine')
    
//         await expect(
//           marketplace
//             .connect(admin)
//             .claimNFT(
//               itemId,
//               '0x0000000000000000000000000000000000000000',
//               voucher,
//               signature
//             )
//         ).to.be.revertedWith('claimNFT: Invalid buyer address')
//       })
    
  
//     // ... rest of the test cases ...
//     it('Should revert if sale kind is not Auction', async function () {
//         const currentBlock = await ethers.provider.getBlock('latest');
//         const currentTime = currentBlock.timestamp;
//         const fixedPriceItemData = {
//           tokenId: 2,
//           basePrice: ethers.parseEther('5'),
//           itemsAvailable: 1,
//           listingTime: currentTime,
//           expirationTime: currentTime + 86400,
//           reservePrice: ethers.parseEther('5'),
//           nftAddress: await nft.getAddress(),
//           seller: seller.address,
//           lazyMint: true,
//           saleKind: 0, // FixedPrice
//         };
    
//         await marketplace.connect(seller).listItem(1, fixedPriceItemData, [1000], [buyer.address]);
    
//         await expect(
//           marketplace.connect(admin).claimNFT(
//             2, // itemId of fixed-price listing
//             buyer.address,
//             voucher,
//             signature
//           )
//         ).to.be.revertedWith('claimNFT: Not an auction listing');
//       });
    
//       it('Should revert if trying to list multiple copies in an auction', async function () {
//         const currentBlock = await ethers.provider.getBlock('latest');
//         const currentTime = currentBlock.timestamp;
    
//         // Set itemsAvailable to more than 1 to test for the revert condition in listing
//         const multiItemData = {
//           tokenId: 1,
//           basePrice: ethers.parseEther('5'),
//           itemsAvailable: 2, // Invalid amount for an auction
//           listingTime: currentTime,
//           expirationTime: currentTime + 86400,
//           reservePrice: ethers.parseEther('5'),
//           nftAddress: await nft.getAddress(),
//           seller: seller.address,
//           lazyMint: true,
//           saleKind: 1, // Auction
//         };
    
//         // Attempt to list an auction with multiple items available, expecting it to revert
//         await expect(
//           marketplace.connect(seller).listItem(4, multiItemData, [1000], [buyer.address])
//         ).to.be.revertedWith('listItem: invalid nft amount');
//     });
    

//       it('Should verify signature matches seller', async function () {
//         await network.provider.send('evm_increaseTime', [86401])
//         await network.provider.send('evm_mine')
    
//         // Create signature with different signer
//         const invalidSignWallet = new SignWallet(await nft.getAddress(), buyer)
//         const invalidSignature = await invalidSignWallet.getSignature(voucher)
    
//         await expect(
//           marketplace
//             .connect(admin)
//             .claimNFT(itemId, buyer.address, voucher, invalidSignature)
//         ).to.be.revertedWith('redeem: unauthorized signer')
//       })

//       it('Should revert if called by unauthorized user', async function () {
//         await network.provider.send('evm_increaseTime', [86401])
//         await network.provider.send('evm_mine')
    
//         await expect(
//           marketplace
//             .connect(buyer) // Non-admin user
//             .claimNFT(itemId, buyer.address, voucher, signature)
//         ).to.be.revertedWith('Only admin can perform this action')
//       })
//   });
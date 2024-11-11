const { expect } = require('chai')
const { ethers } = require('hardhat')
const SignWallet = require('../ignition/modules/signature')
const { time } = require('@nomicfoundation/hardhat-network-helpers')

describe('NFT Marketplace', function () {
  let Marketplace, marketplace, nft, owner, admin, seller, buyer, address1
  let recipients
  const price = ethers.parseEther('1')

  beforeEach(async () => {
    ;[admin, seller, buyer, address1] = await ethers.getSigners()
    recipients = [address1.address]

    // Deploy Marketplace contract
    Marketplace = await ethers.getContractFactory('NFTMarketplace')
    marketplace = await Marketplace.deploy(500) // 5% service fee
    await marketplace.waitForDeployment()

    // Deploy NFT contract
    const NFT = await ethers.getContractFactory('LazyMintNFT')
    nft = await NFT.deploy(await marketplace.getAddress())
    await nft.waitForDeployment()
  })

  describe('listItem Function', function () {
    it('Should allow a seller to list an item', async function () {
      const tokenId = 1
      const basePrice = ethers.parseEther('0.1')
      const reservePrice = ethers.parseEther('0.05')
      const saleKind = 0

      const listData = {
        tokenId: tokenId,
        basePrice: basePrice,
        itemsAvailable: 1,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: reservePrice,
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: saleKind,
      }

      await expect(
        marketplace.connect(seller).listItem(10, listData, [250], recipients)
      )
        .to.emit(marketplace, 'List')
        .withArgs(
          seller.address,
          await nft.getAddress(),
          1,
          tokenId,
          basePrice,
          listData.itemsAvailable,
          listData.listingTime,
          listData.expirationTime,
          saleKind
        )

      const listedItem = await marketplace.marketItems(1)

      expect(listedItem.seller).to.exist
      expect(listedItem.basePrice).to.equal(basePrice)
      expect(listedItem.seller).to.equal(seller.address)
    })

    it('Should revert if the price is zero', async function () {
      const listData = {
        tokenId: 3,
        basePrice: ethers.parseEther('0'),
        itemsAvailable: 1,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: ethers.parseEther('0.05'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 0,
      }

      await expect(
        marketplace
          .connect(seller)
          .listItem(listData.itemsAvailable, listData, [250], recipients)
      ).to.be.revertedWith('listItem: Price cannot be zero')
    })

    it('should revert if nft address is zero', async function () {
      const itemData = {
        tokenId: 1,
        basePrice: ethers.parseEther('10'),
        itemsAvailable: 1,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: ethers.parseEther('50'),
        nftAddress: '0x0000000000000000000000000000000000000000',
        seller: seller.address,
        lazyMint: true,
        saleKind: 0,
      }

      await expect(
        marketplace
          .connect(seller)
          .listItem(5, itemData, [1000], [address1.address])
      ).to.be.revertedWith('listItem: nft address is zero')
    })

    it('should revert if nft amount is zero', async function () {
      const itemData = {
        nftAddress: await nft.getAddress(),
        tokenId: 1,
        basePrice: ethers.parseEther('0.1'),
        itemsAvailable: 0,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: ethers.parseEther('0.05'),
        seller: seller.address,
        lazyMint: false,
        saleKind: 0,
      }

      await expect(
        marketplace
          .connect(seller)
          .listItem(5, itemData, [1000], [address1.address])
      ).to.be.revertedWith('listItem: nft amount is zero')
    })

    it('should revert if expiration date is invalid', async function () {
      const currentTime = Math.floor(Date.now() / 1000)

      const itemData = {
        nftAddress: await nft.getAddress(),
        tokenId: 1,
        basePrice: ethers.parseEther('0.1'),
        itemsAvailable: 5,
        listingTime: currentTime,
        expirationTime: currentTime,
        reservePrice: ethers.parseEther('0.05'),
        seller: seller.address,
        lazyMint: false,
        saleKind: 0,
      }

      await expect(
        marketplace
          .connect(seller)
          .listItem(5, itemData, [1000], [address1.address])
      ).to.be.revertedWith('listItem: Expiration date invalid')
    })

    it('should revert if listing time is invalid', async function () {
      const itemData = {
        nftAddress: await nft.getAddress(),
        tokenId: 1,
        basePrice: ethers.parseEther('0.1'),
        itemsAvailable: 5,
        listingTime: Math.floor(Date.now() / 1000) - 400,
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: ethers.parseEther('0.05'),
        seller: seller.address,
        saleKind: 0,
        lazyMint: false,
      }

      await expect(
        marketplace.listItem(5, itemData, [1000], [address1.address])
      ).to.be.revertedWith('listItem: listing time invalid')
    })
  })

  describe('cancelListing', function () {
    let itemId = 1
    let tokenId = 1
    let amount = 5

    beforeEach(async function () {
      const itemData = {
        tokenId: 1,
        basePrice: ethers.parseEther('10'),
        itemsAvailable: amount,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: ethers.parseEther('50'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 0,
      }
      await marketplace
        .connect(seller)
        .listItem(5, itemData, [1000], [address1.address])
    })

    it('Should cancel listing successfully by admin', async function () {
      await expect(marketplace.connect(admin).cancelListing(1))
        .to.emit(marketplace, 'Cancel')
        .withArgs(
          admin.address,
          await nft.getAddress(),
          itemId,
          tokenId,
          amount
        )

      const item = await marketplace.marketItems(itemId)
      expect(item.nftAddress).to.equal(
        '0x0000000000000000000000000000000000000000'
      )
    })

    it('Should revert when called by non-admin', async function () {
      await expect(
        marketplace.connect(address1).cancelListing(itemId)
      ).to.be.revertedWith('cancelListing: Unauthorized access')
    })
  })

  describe('buyItem function', function () {
    let itemId = 1
    let nftAmount = 1
    let voucher, signature

    beforeEach(async function () {
      // Create listing data
      const itemData = {
        tokenId: 1,
        basePrice: ethers.parseEther('10'),
        itemsAvailable: 5,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: ethers.parseEther('5'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 0,
      }

      // List the item
      await marketplace
        .connect(seller)
        .listItem(5, itemData, [1000], [address1.address])

      // Create voucher for lazy minting
      voucher = {
        tokenId: 1,
        nftAmount: 1,
        price: ethers.parseEther('10'),
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 86400,
        maker: seller.address,
        nftAddress: await nft.getAddress(),
        tokenURI: 'test-uri',
      }

      // Create signature using the seller's signer
      const signWallet = new SignWallet(await nft.getAddress(), seller)
      signature = await signWallet.getSignature(voucher)
    })

    it('Should successfully buy item when called by admin', async function () {
      await nft
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true)

      await expect(
        marketplace
          .connect(admin)
          .buyItem(itemId, nftAmount, voucher, signature, buyer.address)
      )
        .to.emit(marketplace, 'Sold')
        .withArgs(
          itemId,
          seller.address,
          buyer.address,
          await nft.getAddress(),
          voucher.tokenId,
          0,
          1
        )
        .to.emit(marketplace, 'NFTTransferred')
        .withArgs(
          itemId,
          seller.address,
          buyer.address,
          await nft.getAddress(),
          voucher.tokenId,
          nftAmount
        )
    })

    it('Should revert if called by unauthorized user', async function () {
      await expect(
        marketplace
          .connect(address1)
          .buyItem(itemId, nftAmount, voucher, signature, buyer.address)
      ).to.be.revertedWith('Only admin can perform this action')
    })

    it('Should revert if trying to buy more than available amount', async function () {
      const excessAmount = 10
      await expect(
        marketplace
          .connect(admin)
          .buyItem(itemId, excessAmount, voucher, signature, buyer.address)
      ).to.be.revertedWith('buyItem: Not enough tokens on sale')
    })

    it('Should revert if sale kind is not FixedPrice', async function () {
      const auctionItemData = {
        tokenId: 2,
        basePrice: ethers.parseEther('10'),
        itemsAvailable: 1,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: ethers.parseEther('15'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 1,
      }

      await marketplace
        .connect(seller)
        .listItem(1, auctionItemData, [1000], [address1.address])

      await expect(
        marketplace
          .connect(admin)
          .buyItem(2, nftAmount, voucher, signature, buyer.address)
      ).to.be.revertedWith('buyItem: Not on fixed price sale')
    })

    it('Should revert if sale has expired', async function () {
      const currentBlockTime = await time.latest()

      const expiredItemData = {
        tokenId: 2,
        basePrice: ethers.parseEther('10'),
        itemsAvailable: 1,
        listingTime: currentBlockTime,
        expirationTime: currentBlockTime + 60,
        reservePrice: ethers.parseEther('5'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 0,
      }

      await marketplace
        .connect(seller)
        .listItem(1, expiredItemData, [1000], [address1.address])

      await nft
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true)

      await time.increase(120)

      await expect(
        marketplace
          .connect(admin)
          .buyItem(2, nftAmount, voucher, signature, buyer.address)
      ).to.be.revertedWith('buyItem: Sale expired')
    })

    it('Should revert if sale has not started', async function () {
      const futureItemData = {
        tokenId: 2,
        basePrice: ethers.parseEther('10'),
        itemsAvailable: 1,
        listingTime: Math.floor(Date.now() / 1000) + 86400,
        expirationTime: Math.floor(Date.now() / 1000) + 172800,
        reservePrice: ethers.parseEther('5'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 0,
      }

      await marketplace
        .connect(seller)
        .listItem(1, futureItemData, [1000], [address1.address])

      await expect(
        marketplace
          .connect(admin)
          .buyItem(2, nftAmount, voucher, signature, buyer.address)
      ).to.be.revertedWith('buyItem: Sale not started')
    })

    it('Should revert if buyer is the seller', async function () {
      await expect(
        marketplace
          .connect(admin)
          .buyItem(itemId, nftAmount, voucher, signature, seller.address)
      ).to.be.revertedWith('buyItem: seller itself cannot buy')
    })

    it('Should update item availability after successful purchase', async function () {
      await nft
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true)

      const purchaseAmount = 2
      await marketplace
        .connect(admin)
        .buyItem(itemId, purchaseAmount, voucher, signature, buyer.address)

      const item = await marketplace.marketItems(itemId)
      expect(item.itemsAvailable).to.equal(3)
    })

    it('Should delete listing when all tokens are purchased', async function () {
      await nft
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true)

      // Buy all available tokens
      await marketplace
        .connect(admin)
        .buyItem(itemId, 5, voucher, signature, buyer.address)

      // Check if listing is deleted
      const item = await marketplace.marketItems(itemId)
      expect(item.itemsAvailable).to.equal(0)
    })
  })

  describe('NFTMarketplace - claimOffer function', function () {
    let marketplace, nft, admin, seller, buyer
    let itemId = 1
    let nftAmount = 1
    let voucher, signature

    beforeEach(async function () {
      // Get signers
      ;[admin, seller, buyer, address1] = await ethers.getSigners()

      // Deploy marketplace contract
      const Marketplace = await ethers.getContractFactory('NFTMarketplace')
      marketplace = await Marketplace.deploy(500) // 5% service fee
      await marketplace.waitForDeployment()

      // Deploy NFT contract
      const NFT = await ethers.getContractFactory('LazyMintNFT')
      nft = await NFT.deploy(await marketplace.getAddress())
      await nft.waitForDeployment()

      // Create listing data
      const itemData = {
        tokenId: 1,
        basePrice: ethers.parseEther('10'),
        itemsAvailable: 5,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400, // +1 day
        reservePrice: ethers.parseEther('5'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 0, // FixedPrice
      }

      // List the item
      await marketplace.connect(seller).listItem(
        5, // maxCopies
        itemData,
        [1000], // royalties array
        [address1.address] // recipients array
      )

      // Create voucher for lazy minting
      voucher = {
        tokenId: 1,
        nftAmount: 1,
        price: ethers.parseEther('10'),
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 86400,
        maker: seller.address,
        nftAddress: await nft.getAddress(),
        tokenURI: 'test-uri',
      }

      // Create signature using the seller's signer
      const signWallet = new SignWallet(await nft.getAddress(), seller)
      signature = await signWallet.getSignature(voucher)
    })

    it('Should successfully claim offer when called by admin', async function () {
      await nft
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true)

      await expect(
        marketplace
          .connect(admin)
          .claimOffer(itemId, buyer.address, nftAmount, voucher, signature)
      )
        .to.emit(marketplace, 'Sold')
        .withArgs(
          itemId,
          seller.address,
          buyer.address,
          await nft.getAddress(),
          voucher.tokenId,
          ethers.parseEther('10'),
          1
        )
    })

    it('Should revert if called by unauthorized user', async function () {
      await expect(
        marketplace
          .connect(address1)
          .claimOffer(itemId, buyer.address, nftAmount, voucher, signature)
      ).to.be.revertedWith('Only admin can perform this action')
    })

    it('Should revert if trying to buy more than available amount', async function () {
      const excessAmount = 10 // More than listed amount
      await expect(
        marketplace
          .connect(admin)
          .claimOffer(itemId, buyer.address, excessAmount, voucher, signature)
      ).to.be.revertedWith('claimOffer: Not enough tokens on sale')
    })

    it('Should revert if sale kind is not FixedPrice', async function () {
      // First create a new auction listing
      const auctionItemData = {
        tokenId: 2,
        basePrice: ethers.parseEther('10'),
        itemsAvailable: 1,
        listingTime: Math.floor(Date.now() / 1000),
        expirationTime: Math.floor(Date.now() / 1000) + 86400,
        reservePrice: ethers.parseEther('15'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 1, // Auction
      }

      await marketplace
        .connect(seller)
        .listItem(1, auctionItemData, [1000], [address1.address])
      await nft
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true)

      await expect(
        marketplace.connect(admin).claimOffer(
          2, // new itemId
          buyer.address,
          nftAmount,
          voucher,
          signature
        )
      ).to.be.revertedWith('accetedOffer: not valid for auction sale')
    })

    it('Should verify signature matches seller', async function () {
      // Create invalid signature using buyer instead of seller
      const invalidSignWallet = new SignWallet(await nft.getAddress(), buyer)
      const invalidSignature = await invalidSignWallet.getSignature(voucher)

      await expect(
        marketplace
          .connect(admin)
          .claimOffer(
            itemId,
            buyer.address,
            nftAmount,
            voucher,
            invalidSignature
          )
      ).to.be.revertedWith('claimOffer: unauthorized signer')
    })
  })
  describe('NFTMarketplace - claimNFT function', function () {
    let marketplace, nft, admin, seller, buyer
    let itemId = 1
    let voucher, signature

    beforeEach(async function () {
      ;[admin, seller, buyer] = await ethers.getSigners()

      // Deploy marketplace contract
      const Marketplace = await ethers.getContractFactory('NFTMarketplace')
      marketplace = await Marketplace.deploy(500) // 5% service fee
      await marketplace.waitForDeployment()

      // Deploy NFT contract
      const NFT = await ethers.getContractFactory('LazyMintNFT')
      nft = await NFT.deploy(await marketplace.getAddress())
      await nft.waitForDeployment()

      // Get current block timestamp
      const currentBlock = await ethers.provider.getBlock('latest')
      const currentTime = currentBlock.timestamp

      // Set up auction listing data with valid timestamps
      const itemData = {
        tokenId: 1,
        basePrice: ethers.parseEther('5'),
        itemsAvailable: 1,
        listingTime: currentTime, // Use current block timestamp
        expirationTime: currentTime + 86400, // +1 day from current time
        reservePrice: ethers.parseEther('5'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 1, // Auction
      }

      // List item
      await marketplace.connect(seller).listItem(
        1, // maxCopies
        itemData,
        [1000], // royalties array
        [buyer.address] // recipients array
      )

      // Create voucher with matching timestamps
      voucher = {
        tokenId: 1,
        nftAmount: 1,
        price: ethers.parseEther('5'),
        startDate: currentTime,
        endDate: currentTime + 86400,
        maker: seller.address,
        nftAddress: await nft.getAddress(),
        tokenURI: 'test-uri',
      }

      const signWallet = new SignWallet(await nft.getAddress(), seller)
      signature = await signWallet.getSignature(voucher)
    })

    it('Should successfully claim NFT after auction ends', async function () {
      // Fast-forward time to after auction end
      await network.provider.send('evm_increaseTime', [86401]) // 1 day + 1 second
      await network.provider.send('evm_mine')

      // Ensure seller has approved marketplace
      await nft
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true)

      // Get initial market item state
      const initialMarketItem = await marketplace.marketItems(itemId)
      expect(initialMarketItem.itemsAvailable).to.equal(1)

      // Claim NFT
      const claimTx = await marketplace
        .connect(admin)
        .claimNFT(itemId, buyer.address, voucher, signature)

      // Wait for transaction
      await claimTx.wait()

      // Verify market item is deleted or itemsAvailable is 0
      const finalMarketItem = await marketplace.marketItems(itemId)
      expect(finalMarketItem.itemsAvailable).to.equal(0)

      // If your NFT contract has a balanceOf function, we can verify the buyer received the NFT
      // const buyerBalance = await nft.balanceOf(buyer.address);
      // expect(buyerBalance).to.equal(1);
    })

    it('Should revert if claimNFT is called before auction ends', async function () {
      await expect(
        marketplace
          .connect(admin)
          .claimNFT(itemId, buyer.address, voucher, signature)
      ).to.be.revertedWith('claimNFT: Auction has not ended yet')
    })

    it('Should revert if buyer address is zero', async function () {
      await network.provider.send('evm_increaseTime', [86401])
      await network.provider.send('evm_mine')

      await expect(
        marketplace
          .connect(admin)
          .claimNFT(
            itemId,
            '0x0000000000000000000000000000000000000000',
            voucher,
            signature
          )
      ).to.be.revertedWith('claimNFT: Invalid buyer address')
    })

    // ... rest of the test cases ...
    it('Should revert if sale kind is not Auction', async function () {
      const currentBlock = await ethers.provider.getBlock('latest')
      const currentTime = currentBlock.timestamp
      const fixedPriceItemData = {
        tokenId: 2,
        basePrice: ethers.parseEther('5'),
        itemsAvailable: 1,
        listingTime: currentTime,
        expirationTime: currentTime + 86400,
        reservePrice: ethers.parseEther('5'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 0, // FixedPrice
      }

      await marketplace
        .connect(seller)
        .listItem(1, fixedPriceItemData, [1000], [buyer.address])

      await expect(
        marketplace.connect(admin).claimNFT(
          2, // itemId of fixed-price listing
          buyer.address,
          voucher,
          signature
        )
      ).to.be.revertedWith('claimNFT: Not an auction listing')
    })

    it('Should revert if trying to list multiple copies in an auction', async function () {
      const currentBlock = await ethers.provider.getBlock('latest')
      const currentTime = currentBlock.timestamp

      // Set itemsAvailable to more than 1 to test for the revert condition in listing
      const multiItemData = {
        tokenId: 1,
        basePrice: ethers.parseEther('5'),
        itemsAvailable: 2, // Invalid amount for an auction
        listingTime: currentTime,
        expirationTime: currentTime + 86400,
        reservePrice: ethers.parseEther('5'),
        nftAddress: await nft.getAddress(),
        seller: seller.address,
        lazyMint: true,
        saleKind: 1, // Auction
      }

      // Attempt to list an auction with multiple items available, expecting it to revert
      await expect(
        marketplace
          .connect(seller)
          .listItem(4, multiItemData, [1000], [buyer.address])
      ).to.be.revertedWith('listItem: invalid nft amount')
    })

    it('Should verify signature matches seller', async function () {
      await network.provider.send('evm_increaseTime', [86401])
      await network.provider.send('evm_mine')

      // Create signature with different signer
      const invalidSignWallet = new SignWallet(await nft.getAddress(), buyer)
      const invalidSignature = await invalidSignWallet.getSignature(voucher)

      await expect(
        marketplace
          .connect(admin)
          .claimNFT(itemId, buyer.address, voucher, invalidSignature)
      ).to.be.revertedWith('redeem: unauthorized signer')
    })

    it('Should revert if called by unauthorized user', async function () {
      await network.provider.send('evm_increaseTime', [86401])
      await network.provider.send('evm_mine')

      await expect(
        marketplace
          .connect(buyer) // Non-admin user
          .claimNFT(itemId, buyer.address, voucher, signature)
      ).to.be.revertedWith('Only admin can perform this action')
    })
  })
  describe('NFTMarketplace - Constructor, getItemCount, getServiceFeeRate, setServiceFee, getRoyalty ', function () {
    let Marketplace,
      marketplace,
      NFT,
      nft,
      owner,
      seller,
      buyer,
      addr1,
      addr2,
      royaltyRecipient1,
      royaltyRecipient2

    const TOKEN_ID = 1
    const SALE_AMOUNT = ethers.parseEther('1') // 1 ETH
    const serviceFee = 250 // 2.5% in basis points

    beforeEach(async function () {
      // Get signers
      ;[
        owner,
        seller,
        buyer,
        royaltyRecipient1,
        royaltyRecipient2,
        addr1,
        addr2,
      ] = await ethers.getSigners()

      // Deploy the contract
      Marketplace = await ethers.getContractFactory('NFTMarketplace')
      marketplace = await Marketplace.deploy(serviceFee)
      await marketplace.waitForDeployment()

      NFT = await ethers.getContractFactory('LazyMintNFT')
      nft = await NFT.deploy(await marketplace.getAddress())
      await nft.waitForDeployment()
    })

    describe('Constructor', function () {
      it('Should set the correct service fee', async function () {
        const fee = await marketplace.getServiceFeeRate()
        expect(fee).to.equal(serviceFee)
      })

      it('Should set the correct admin address', async function () {
        const admin = await marketplace.admin()
        expect(admin).to.equal(owner.address)
      })
    })

    describe('getItemCount', function () {
      it('Should return 0 when no items are listed', async function () {
        const itemCount = await marketplace.getItemCount()
        expect(itemCount).to.equal(0)
      })

        it('Should return correct count after items are listed', async function () {
          const currentBlock = await ethers.provider.getBlock('latest')
          const currentTime = currentBlock.timestamp
          // Structure the listing data
          const listingData = {
            tokenId: 1,
            basePrice: ethers.parseEther('0.1'),
            itemsAvailable: 1,
            listingTime: currentTime + 60, // Set 1 minute in the future
            expirationTime: currentTime + 86400,
            reservePrice: ethers.parseEther('0.1'),
            nftAddress: await marketplace.getAddress(),
            seller: await owner.getAddress(),
            lazyMint: false,
            saleKind: 1,
          }

          // Simple number array for royalty amounts
          const royaltyAmounts = [500, 300]

          // Get recipient addresses
          const recipient1Address = await royaltyRecipient1.getAddress()
          const recipient2Address = await royaltyRecipient2.getAddress()

          // List the item
          await marketplace.listItem(
            1, // nftMaxCopies
            listingData,
            [200],
            [addr1.address]
          )

          // Verify the item count
          const itemCount = await marketplace.getItemCount()
          expect(itemCount).to.equal(1)
        })
    })

    describe('getServiceFeeRate', function () {
      it('Should return the initial service fee rate', async function () {
        const serviceFee = await marketplace.getServiceFeeRate()
        expect(serviceFee).to.equal(serviceFee)
      })

      it('Should return updated service fee rate after changes', async function () {
        const newFee = 300 // 3%
        await marketplace.setServiceFee(newFee)
        const updatedFee = await marketplace.getServiceFeeRate()
        expect(updatedFee).to.equal(newFee)
      })
    })

    describe('setServiceFee', function () {
      it('Should allow owner to update service fee', async function () {
        const newFee = 300 // 3%
        await expect(marketplace.setServiceFee(newFee))
          .to.emit(marketplace, 'ServiceFeeUpdated')
          .withArgs(owner.address, serviceFee, newFee)

        const updatedFee = await marketplace.getServiceFeeRate()
        expect(updatedFee).to.equal(newFee)
      })

      it('Should not allow non-owner to update service fee', async function () {
        const newFee = 300 // 3%
        await expect(
          marketplace.connect(addr1).setServiceFee(newFee)
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('Should emit ServiceFeeUpdated event with correct parameters', async function () {
        const newFee = 300 // 3%
        const tx = await marketplace.setServiceFee(newFee)
        const receipt = await tx.wait()

        // Find the ServiceFeeUpdated event
        const event = receipt.logs.find(
          (log) => log.fragment && log.fragment.name === 'ServiceFeeUpdated'
        )

        expect(event).to.not.be.undefined
        expect(event.args[0]).to.equal(owner.address) // msg.sender
        expect(event.args[1]).to.equal(serviceFee) // old fee
        expect(event.args[2]).to.equal(newFee) // new fee
      })

      it('Should allow setting fee to zero', async function () {
        const newFee = 0
        await marketplace.setServiceFee(newFee)
        const updatedFee = await marketplace.getServiceFeeRate()
        expect(updatedFee).to.equal(newFee)
      })

      it('Should allow multiple fee updates', async function () {
        const fees = [300, 400, 500, 200]

        for (let i = 0; i < fees.length; i++) {
          await marketplace.setServiceFee(fees[i])
          const updatedFee = await marketplace.getServiceFeeRate()
          expect(updatedFee).to.equal(fees[i])
        }
      })

      it('Should handle maximum possible fee value', async function () {
        const maxFee = ethers.MaxUint256
        await marketplace.setServiceFee(maxFee)
        const updatedFee = await marketplace.getServiceFeeRate()
        expect(updatedFee).to.equal(maxFee)
      })
    })
  })
  describe('getRoyalty', function () {
    const TOKEN_ID = 1
    const SALE_AMOUNT = ethers.parseEther('1') // Example sale amount
    let royaltyRecipient1, royaltyRecipient2

    beforeEach(async function () {
      ;[royaltyRecipient1, royaltyRecipient2, owner, buyer, seller] =
        await ethers.getSigners()
    })

    it('should return correct royalties when set', async function () {
      const royaltyRecipients = [
        royaltyRecipient1.address,
        royaltyRecipient2.address,
      ]
      const royaltyAmounts = [500, 300] // Representing 5% and 3%

      const currentBlock = await ethers.provider.getBlock('latest')
      const currentTime = currentBlock.timestamp

      const listingData = {
        tokenId: TOKEN_ID,
        basePrice: SALE_AMOUNT,
        itemsAvailable: 1,
        listingTime: currentTime + 60, // Set 1 minute in the future
        expirationTime: currentTime + 86400,
        reservePrice: SALE_AMOUNT,
        nftAddress: await nft.getAddress(),
        seller: await seller.getAddress(),
        lazyMint: true,
        saleKind: 0,
      }

      await marketplace.connect(seller).listItem(
        1, // maxCopies
        listingData,
        royaltyAmounts,
        royaltyRecipients
      )

      // Get royalty information
      const [recipients, amounts, totalRoyalty] = await marketplace.getRoyalty(
        await nft.getAddress(),
        TOKEN_ID,
        SALE_AMOUNT
      )

      // Expected royalty amounts based on 5% and 3%
      const expectedRoyalty1 = (SALE_AMOUNT * BigInt(500)) / BigInt(10000)
      const expectedRoyalty2 = (SALE_AMOUNT * BigInt(300)) / BigInt(10000)

      // Assertions
      expect(recipients).to.deep.equal(royaltyRecipients)
      expect(amounts[0]).to.equal(expectedRoyalty1)
      expect(amounts[1]).to.equal(expectedRoyalty2)
      expect(totalRoyalty).to.equal(expectedRoyalty1 + expectedRoyalty2)
    })

    it('should fail when NFT contract address is invalid', async function () {
      const ZERO_ADDRESS = ethers.ZeroAddress
      await expect(marketplace.getRoyalty(ZERO_ADDRESS, TOKEN_ID, SALE_AMOUNT))
        .to.be.reverted
    })

    it('should handle multiple royalty recipients up to maximum allowed', async function () {
      const currentBlock = await ethers.provider.getBlock('latest')
      const currentTime = currentBlock.timestamp

      const lazyMintNFTAddress = await nft.getAddress()
      const sellerAddress = await seller.getAddress()

      // Create 5 recipients with 2% royalty each
      const royaltyAmounts = [200n, 200n, 200n, 200n, 200n]
      const royaltyRecipients = [
        await royaltyRecipient1.getAddress(),
        await royaltyRecipient2.getAddress(),
        await owner.getAddress(),
        await buyer.getAddress(),
        await seller.getAddress(),
      ]

      // Create listing data
      const listingData = {
        tokenId: BigInt(TOKEN_ID),
        basePrice: SALE_AMOUNT,
        itemsAvailable: 1n,
        listingTime: currentTime + 60, // Set 1 minute in the future
        expirationTime: currentTime + 86400,
        reservePrice: SALE_AMOUNT,
        nftAddress: lazyMintNFTAddress,
        seller: sellerAddress,
        lazyMint: true,
        saleKind: 0n,
      }

      // List the item
      await marketplace
        .connect(seller)
        .listItem(1n, listingData, royaltyAmounts, royaltyRecipients)

      // Wait for the listing to be confirmed
      await ethers.provider.send('evm_mine', [])

      // Get royalty information
      const royaltyInfo = await marketplace.getRoyalty(
        lazyMintNFTAddress,
        BigInt(TOKEN_ID),
        SALE_AMOUNT
      )

      // Verify recipients array length
      expect(royaltyInfo[0].length).to.equal(5, 'Should have 5 recipients')
      expect(royaltyInfo[1].length).to.equal(5, 'Should have 5 royalty values')

      // Verify each recipient and their royalty amount
      for (let i = 0; i < 5; i++) {
        expect(royaltyInfo[0][i]).to.equal(
          royaltyRecipients[i],
          `Recipient ${i} doesn't match`
        )
        const expectedValue = (SALE_AMOUNT * 200n) / 10000n // 2% each
        expect(royaltyInfo[1][i]).to.equal(
          expectedValue,
          `Royalty value ${i} doesn't match`
        )
      }

      // Verify total royalty (should be 10% = sum of all 2% royalties)
      const expectedTotal = (SALE_AMOUNT * 1000n) / 10000n // 10%
      expect(royaltyInfo[2]).to.equal(
        expectedTotal,
        "Total royalty doesn't match expected value"
      )
    })

    it('should verify royalty amounts are calculated correctly for different sale amounts', async function () {
      const currentBlock = await ethers.provider.getBlock('latest')
      const currentTime = currentBlock.timestamp

      const royaltyAmount = 500 // 5%
      const saleAmounts = [
        ethers.parseEther('0.1'),
        ethers.parseEther('1'),
        ethers.parseEther('10'),
        ethers.parseEther('100'),
      ]

      await marketplace.connect(owner).listItem(
        1,
        {
          tokenId: TOKEN_ID,
          basePrice: SALE_AMOUNT,
          itemsAvailable: 1,
          listingTime: currentTime + 60, // Set 1 minute in the future
          expirationTime: currentTime + 86400,
          reservePrice: SALE_AMOUNT,
          nftAddress: await nft.getAddress(),
          seller: await seller.getAddress(),
          lazyMint: true,
          saleKind: 0,
        },
        [royaltyAmount],
        [royaltyRecipient1.address]
      )

      for (const amount of saleAmounts) {
        const royaltyInfo = await marketplace.getRoyalty(
          await nft.getAddress(),
          TOKEN_ID,
          amount
        )

        expect(royaltyInfo.total).to.equal(
          (amount * BigInt(royaltyAmount)) / 10000n
        )
      }
    })
  })
})
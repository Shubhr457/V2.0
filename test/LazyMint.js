const { expect } = require('chai')
const { ethers } = require('hardhat')

let count = 0

describe('LazyMintNFT Contract', function () {
  let lazyMintNFT, owner, marketplace, addr1, addr2, signer

  function counter() {
    count = count + 1
    return count
  }

  beforeEach(async function () {
    ;[owner, marketplace, addr1, addr2] = await ethers.getSigners()

    const LazyMintNFT = await ethers.getContractFactory('LazyMintNFT')
    lazyMintNFT = await LazyMintNFT.deploy(marketplace.getAddress())
    await lazyMintNFT.waitForDeployment()
    lazyMintNFT = lazyMintNFT.connect(marketplace)
  })

  describe('totalSupply', function () {
    it('should return zero for non-existent token ID', async function () {
      expect(await lazyMintNFT.totalSupply(2)).to.equal(0)
    })
  })

  describe('getRoyaltyInfo', function () {
    it('should return correct royalty info after deployment', async function () {
      const count = counter()
      const royalty = await lazyMintNFT.getRoyaltyInfo(1)
      // Fixed: Using lazyMintNFT instead of nft
      expect(royalty[0][0]).to.equal(
        '0x0000000000000000000000000000000000000000'
      ) // Default receiver
      expect(royalty[1][0]).to.equal(250n) // Default royalty 2.5%
    })
  })

  describe('royaltyInfo', function () {
    it('should calculate correct royalty for given sale price', async function () {
      // Create arrays for multiple recipients and values
      const recipients = [addr1.address]
      const values = [500] // 5% in basis points

      // Set the royalty using the correct function signature
      await lazyMintNFT.setTokenRoyalty(1, values, recipients)

      // Get the royalty info for verification
      const salePrice = ethers.parseEther('1')
      const [receivers, royaltyAmounts, totalAmount] =
        await lazyMintNFT.royaltyInfo(1, salePrice)

      // Verify the results
      expect(receivers[0]).to.equal(addr1.address)
      expect(royaltyAmounts[0]).to.equal(ethers.parseEther('0.05')) // 5% of 1 ETH
      expect(totalAmount).to.equal(ethers.parseEther('0.05'))
    })

    it('should return default royalty of 2.5% when no custom royalty is set', async function () {
      // First set a creator for the token
      const tokenId = 1
      await lazyMintNFT.setCreator(tokenId, addr1.address)

      // Get royalty info for a sale price of 1 ETH
      const salePrice = ethers.parseEther('1')
      const [receivers, royaltyAmounts, totalAmount] =
        await lazyMintNFT.royaltyInfo(tokenId, salePrice)

      // Verify default royalty (2.5% = 250 basis points)
      expect(receivers[0]).to.equal(addr1.address)
      expect(royaltyAmounts[0]).to.equal(ethers.parseEther('0.025')) // 2.5% of 1 ETH
      expect(totalAmount).to.equal(ethers.parseEther('0.025'))
    })

    it('should enforce maximum royalty cap of 10%', async function () {
      const recipients = [addr1.address]
      const values = [1100] // 11% in basis points, should fail

      // This should fail as it exceeds the 10% cap
      await expect(
        lazyMintNFT.setTokenRoyalty(1, values, recipients)
      ).to.be.revertedWith('setTokenRoyalty: royalty more than 10 percent')
    })

    it('should handle multiple royalty recipients', async function () {
      const recipients = [addr1.address, addr2.address]
      const values = [300, 200] // 3% and 2%

      await lazyMintNFT.setTokenRoyalty(1, values, recipients)

      const salePrice = ethers.parseEther('1')
      const [receivers, royaltyAmounts, totalAmount] =
        await lazyMintNFT.royaltyInfo(1, salePrice)

      expect(receivers.length).to.equal(2)
      expect(receivers[0]).to.equal(addr1.address)
      expect(receivers[1]).to.equal(addr2.address)
      expect(royaltyAmounts[0]).to.equal(ethers.parseEther('0.03')) // 3%
      expect(royaltyAmounts[1]).to.equal(ethers.parseEther('0.02')) // 2%
      expect(totalAmount).to.equal(ethers.parseEther('0.05')) // 5% total
    })
  })

  describe('getCreator', function () {
    it('should return the creator address for a given token ID', async () => {
      const tokenId = 1

      // Set creator using the marketplace
      await lazyMintNFT.setCreator(tokenId, addr1.address)

      // Call getCreator to retrieve the creator address
      const result = await lazyMintNFT.getCreator(tokenId)
      expect(result).to.equal(addr1.address)
    })

    it('should return the zero address for a token ID that has not been set', async () => {
      const tokenId = 2

      // Call getCreator for a token ID that has not been set
      const result = await lazyMintNFT.getCreator(tokenId)
      expect(result).to.equal('0x0000000000000000000000000000000000000000') // Assuming it defaults to zero address
    })
  })

  describe('getMaxTokens', function () {
    it('should return the maximum tokens for a given token ID', async () => {
      const tokenId = 1
      const maxTokens = 10

      // Set maximum tokens using the marketplace
      await lazyMintNFT.setMaxTokens(tokenId, maxTokens)

      // Call getMaxTokens to retrieve the value
      const result = await lazyMintNFT.getMaxTokens(tokenId)
      expect(result).to.equal(maxTokens)
    })

    it('should return 0 for a token ID that has not been set', async () => {
      const tokenId = 2

      // Call getMaxTokens for a token ID that has not been set
      const result = await lazyMintNFT.getMaxTokens(tokenId)
      expect(result).to.equal(0) // Assuming it defaults to 0
    })
  })

  describe('setTokenRoyalty', function () {
    it('should only allow marketplace to set royalties', async function () {
      const recipients = [addr1.address, addr2.address]
      const values = [250, 250] // 2.5% each

      await expect(
        lazyMintNFT.connect(addr1).setTokenRoyalty(1, values, recipients)
      ).to.be.revertedWith('setTokenRoyalty: unauthorised access')
    })

    it('should successfully set royalties when called by marketplace', async function () {
      const recipients = [addr1.address, addr2.address]
      const values = [250, 250] // 2.5% each
      const tokenId = 1

      await lazyMintNFT
        .connect(marketplace)
        .setTokenRoyalty(tokenId, values, recipients)

      const [resultRecipients, resultValues] = await lazyMintNFT.getRoyaltyInfo(
        tokenId
      )
      expect(resultRecipients).to.deep.equal(recipients)
      expect(resultValues).to.deep.equal(values)
    })

    it('should revert if royalty exceeds 10%', async function () {
      const recipients = [addr1.address]
      const values = [1001] // 10.01%

      await expect(
        lazyMintNFT.connect(marketplace).setTokenRoyalty(1, values, recipients)
      ).to.be.revertedWith('setTokenRoyalty: royalty more than 10 percent')
    })

    it('should revert if arrays length mismatch', async function () {
      const recipients = [addr1.address, addr2.address]
      const values = [250] // Only one value for two recipients

      await expect(
        lazyMintNFT.connect(marketplace).setTokenRoyalty(1, values, recipients)
      ).to.be.revertedWith('setTokenRoyalty: array length mismatch')
    })
  })

  describe('setCreator', function () {
    it('should only allow marketplace to set creator', async function () {
      await expect(
        lazyMintNFT.connect(addr1).setCreator(1, addr2.address)
      ).to.be.revertedWith('setCreator: unauthorised access')
    })

    it('should successfully set creator when called by marketplace', async function () {
      const tokenId = 1
      await lazyMintNFT.connect(marketplace).setCreator(tokenId, addr1.address)
      expect(await lazyMintNFT.getCreator(tokenId)).to.equal(addr1.address)
    })
  })

  describe('uri', function () {
    it('should return correct URI for token', async function () {
      const tokenId = 1
      const tokenURI = 'ipfs://QmTest'
      // Give `marketplace` approval to manage `addr1`'s tokens, if required by the contract logic
      await lazyMintNFT
        .connect(addr1)
        .setApprovalForAll(marketplace.address, true)

      // First set the creator
      await lazyMintNFT.connect(marketplace).setCreator(tokenId, addr1.address)
      await lazyMintNFT.connect(marketplace).setMaxTokens(tokenId, 100)

      // Create NFTVoucher for minting
      const voucher = {
        tokenId: tokenId,
        nftAmount: 1,
        price: ethers.parseEther('0.1'),
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 3600,
        maker: addr1.address,
        nftAddress: await lazyMintNFT.getAddress(),
        tokenURI: tokenURI,
      }

      // Get signature for voucher
      const domain = {
        name: 'SOLULAB',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await lazyMintNFT.getAddress(),
      }

      const types = {
        NFTVoucher: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'nftAmount', type: 'uint256' },
          { name: 'price', type: 'uint256' },
          { name: 'startDate', type: 'uint256' },
          { name: 'endDate', type: 'uint256' },
          { name: 'maker', type: 'address' },
          { name: 'nftAddress', type: 'address' },
          { name: 'tokenURI', type: 'string' },
        ],
      }

      const signature = await addr1.signTypedData(domain, types, voucher)

      // Mint the token
      await lazyMintNFT
        .connect(marketplace)
        .redeem(addr2.address, voucher, 1, signature)

      // Check URI
      expect(await lazyMintNFT.uri(tokenId)).to.equal(tokenURI)
    })
  })

  describe('setMaxTokens', function () {
    it('should only allow marketplace to set max tokens', async function () {
      await expect(
        lazyMintNFT.connect(addr1).setMaxTokens(1, 100)
      ).to.be.revertedWith('setCreator: unauthorised access')
    })

    it('should successfully set max tokens when called by marketplace', async function () {
      const tokenId = 1
      const maxAmount = 100

      await lazyMintNFT.connect(marketplace).setMaxTokens(tokenId, maxAmount)
      expect(await lazyMintNFT.getMaxTokens(tokenId)).to.equal(maxAmount)
    })
  })

  describe('_verify', function () {
    it('should correctly verify valid signature', async function () {
      const tokenId = 1
      const voucher = {
        tokenId: tokenId,
        nftAmount: 1,
        price: ethers.parseEther('1'),
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 3600,
        maker: addr1.address,
        nftAddress: await lazyMintNFT.getAddress(),
        tokenURI: 'ipfs://QmTest',
      }

      const domain = {
        name: 'SOLULAB',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await lazyMintNFT.getAddress(),
      }

      const types = {
        NFTVoucher: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'nftAmount', type: 'uint256' },
          { name: 'price', type: 'uint256' },
          { name: 'startDate', type: 'uint256' },
          { name: 'endDate', type: 'uint256' },
          { name: 'maker', type: 'address' },
          { name: 'nftAddress', type: 'address' },
          { name: 'tokenURI', type: 'string' },
        ],
      }

      const signature = await addr1.signTypedData(domain, types, voucher)

      const recoveredSigner = await lazyMintNFT.check(voucher, signature)
      expect(recoveredSigner).to.equal(addr1.address)
    })

    it('should detect invalid signature when signed by wrong address', async function () {
      const tokenId = 1
      const addr1Address = await addr1.getAddress()
      const addr2Address = await addr2.getAddress()
      const nftAddress = await lazyMintNFT.getAddress()

      await lazyMintNFT.connect(marketplace).setCreator(tokenId, addr1Address)
      await lazyMintNFT.connect(marketplace).setMaxTokens(tokenId, 100)

      // Create voucher with addr1 as maker
      const voucher = {
        tokenId: tokenId,
        nftAmount: 1,
        price: ethers.parseEther('0.1'),
        startDate: Math.floor(Date.now() / 1000),
        endDate: Math.floor(Date.now() / 1000) + 3600,
        maker: addr1Address, // Claiming addr1 as maker
        nftAddress: nftAddress,
        tokenURI: 'ipfs://QmTest',
      }

      const domain = {
        name: 'SOLULAB',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: nftAddress,
      }

      const types = {
        NFTVoucher: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'nftAmount', type: 'uint256' },
          { name: 'price', type: 'uint256' },
          { name: 'startDate', type: 'uint256' },
          { name: 'endDate', type: 'uint256' },
          { name: 'maker', type: 'address' },
          { name: 'nftAddress', type: 'address' },
          { name: 'tokenURI', type: 'string' },
        ],
      }

      // Create invalid signature by signing with wrong address (addr2)
      const signature = await addr2.signTypedData(domain, types, voucher)

      // Try to redeem with invalid signature
      await expect(
        lazyMintNFT
          .connect(marketplace)
          .redeem(addr2Address, voucher, 1, signature)
      ).to.be.revertedWith('redeem: unauthorized signer')
    })
  })
})

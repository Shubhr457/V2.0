const { ethers } = require('hardhat')

const SIGNING_DOMAIN_NAME = 'SOLULAB'
const SIGNING_DOMAIN_VERSION = '1'

class SignWallet {
  constructor(contractAddress, signer) {
    this.contractAddress = contractAddress
    this.signer = signer

    this.types = {
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
  }

  async getDomain() {
    const { chainId } = await this.signer.provider.getNetwork();
    const domain = {
      name: SIGNING_DOMAIN_NAME,
      version: SIGNING_DOMAIN_VERSION,
      chainId: chainId,
      verifyingContract: this.contractAddress,
    }

    return domain
  }

  async getSignature(NFTVoucher) {
    const domain = await this.getDomain()
    const typedData = {
      types: this.types,
      primaryType: 'NFTVoucher',
      domain: domain,
      message: NFTVoucher,
    }

    const signature = await this.signer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    )
    return signature
  }
}

module.exports = SignWallet 

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
    const domain = {
      name: SIGNING_DOMAIN_NAME,
      version: SIGNING_DOMAIN_VERSION,
      chainId: 1, // for testing in rinkeby change it to 4
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

async function main() {
  const contractAddress = '0xcF037f9f75F35362Fc21e4CA879C8281AB53C39A'
  const privateKey =
    '503f38a9c967ed597e47fe25643985f032b072db8075426a92110f82df48dfcb'

  // Get the signer using hardhat's ethers
  const provider = ethers.provider
  const signer = new ethers.Wallet(privateKey, provider)
  const signWallet = new SignWallet(contractAddress, signer)

  const NFTVoucher = {
    tokenId: 1,
    nftAmount: 2,
    price: ethers.parseUnits('10', 0),
    startDate: 1730204065,
    endDate: 1730204665,
    maker: await signer.getAddress(),
    nftAddress: contractAddress,
    tokenURI: 'kk',
  }

  try {
    const signature = await signWallet.getSignature(NFTVoucher)
    console.log('Signature:', signature)

    console.log(
      `NFT Voucher Details: [${NFTVoucher.tokenId}, ${NFTVoucher.nftAmount}, ${NFTVoucher.price}, ${NFTVoucher.startDate}, ${NFTVoucher.endDate}, "${NFTVoucher.maker}", "${NFTVoucher.nftAddress}", "${NFTVoucher.tokenURI}"]`
    )
  } catch (error) {
    console.error('Error:', error)
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = { SignWallet }

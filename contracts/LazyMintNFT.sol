// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/ILazyMinting.sol";
import "./interfaces/ITokenRoyalties.sol";

/**
 * @title LazyMintNFT
 * @dev Implementation of a lazy minting ERC1155 NFT contract with royalty support
 *
 * This contract allows for:
 * - Lazy minting of NFTs using signed vouchers
 * - Multiple token types in a single contract (ERC1155)
 * - Configurable royalties with multiple recipients
 * - Maximum supply limits per token ID
 */
contract LazyMintNFT is ILazyMinting, ITokenRoyalties, ERC1155Supply, EIP712 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Maximum royalty percentage allowed (10% = 1000 basis points)
    uint256 private maxRoyaltyCap = 1000;

    // EIP712 domain parameters for signature verification
    string private constant SIGNING_DOMAIN = "SOLULAB";
    string private constant SIGNATURE_VERSION = "1";

    // Address of the marketplace contract that's authorized to mint tokens
    address private immutable marketplace;

    using ECDSA for bytes32;

    // Address of the signer for voucher verification
    address signer;

    // Mappings to store token-specific data
    mapping(uint256 => RoyaltyInfo) private royalties; // Token royalties configuration
    mapping(uint256 => address) public creator; // Original creator of each token
    mapping(uint256 => string) private _tokenURIs; // Metadata URI for each token
    mapping(uint256 => uint256) public maxTokens; // Maximum supply for each token ID

    /**
     * @dev Struct to store royalty information for a token
     * @param recipient Array of addresses that receive royalties
     * @param amount Array of royalty percentages (in basis points) for each recipient
     */
    struct RoyaltyInfo {
        address[] recipient;
        uint256[] amount;
    }

    // Events
    event Mint(address indexed creator, uint256 tokenId, uint256 amount);
    event RoyaltySet(
        uint256 indexed tokenId,
        uint256[] value,
        address[] recipient
    );

    /**
     * @dev Constructor initializes the contract with the marketplace address
     * @param _marketplace Address of the authorized marketplace contract
     */
    constructor(
        address _marketplace
    ) ERC1155("") EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {
        marketplace = _marketplace;
    }

    /**
     * @dev Returns the metadata URI for a given token ID
     * @param id Token ID to query
     * @return URI string for the token metadata
     */
    function uri(
        uint256 id
    ) public view virtual override returns (string memory) {
        return _tokenURIs[id];
    }

    /**
     * @dev Returns the maximum supply limit for a given token ID
     */
    function getMaxTokens(uint256 id) external view override returns (uint256) {
        return maxTokens[id];
    }

    /**
     * @dev Returns the creator address for a given token ID
     */
    function getCreator(uint256 id) external view override returns (address) {
        return creator[id];
    }

    /**
     * @dev Sets the creator for a token ID (only callable by marketplace)
     * @param id Token ID
     * @param _creator Address of the creator
     */
    function setCreator(uint256 id, address _creator) external override {
        require(_msgSender() == marketplace, "setCreator: unauthorised access");
        creator[id] = _creator;
    }

    /**
     * @dev Sets the maximum supply for a token ID (only callable by marketplace)
     */
    function setMaxTokens(uint256 tokenId, uint256 amount) external override {
        require(_msgSender() == marketplace, "setCreator: unauthorised access");
        maxTokens[tokenId] = amount;
    }

    /**
     * @dev Configures royalties for a token ID
     * @param id Token ID
     * @param value Array of royalty percentages in basis points (100 = 1%)
     * @param recipient Array of recipient addresses
     * Requirements:
     * - Only callable by marketplace
     * - Maximum 5 recipients
     * - Total royalty cannot exceed maxRoyaltyCap (10%)
     */
    function setTokenRoyalty(
        uint256 id,
        uint256[] memory value,
        address[] memory recipient
    ) external override {
        require(
            _msgSender() == marketplace,
            "setTokenRoyalty: unauthorised access"
        );

        uint256 _len = recipient.length;
        uint256 totalRoyalty;

        require(value.length == _len, "setTokenRoyalty: array length mismatch");
        if (_len != 0) {
            require(_len <= 5, "setTokenRoyalty: more than 5 recipients");
            for (uint8 i = 0; i < _len; i += 1) {
                totalRoyalty += value[i];
            }
            require(
                totalRoyalty <= maxRoyaltyCap,
                "setTokenRoyalty: royalty more than 10 percent"
            );
            royalties[id] = RoyaltyInfo(recipient, value);
            emit RoyaltySet(id, value, recipient);
        }
    }

    /**
     * @dev Returns the current total supply of a token ID
     */
    function totalSupply(
        uint256 id
    ) public view override(ERC1155Supply, ILazyMinting) returns (uint256) {
        return super.totalSupply(id);
    }

    /**
     * @dev Returns royalty configuration for a token ID
     * @notice If no custom royalties are set, returns default 2.5% to creator
     */
    function getRoyaltyInfo(
        uint256 id
    ) external view returns (address[] memory, uint256[] memory) {
        RoyaltyInfo memory royalties_ = royalties[id];
        if (royalties_.amount.length == 0) {
            address[] memory recipient = new address[](1);
            uint256[] memory amount = new uint256[](1);
            recipient[0] = creator[id];
            amount[0] = 250; // 2.5% default royalty
            return (recipient, amount);
        }
        return (royalties_.recipient, royalties_.amount);
    }

    /**
     * @dev Returns the latest token ID that has been created
     */
    function getlatestTokenId() external view returns (uint256) {
        return _tokenIds.current();
    }

    /**
     * @dev Calculates royalty amounts for a given token sale
     * @param id Token ID
     * @param value Sale amount in wei
     * @return receiver Array of royalty recipient addresses
     * @return royaltyAmounts Array of royalty amounts in wei
     * @return totalAmount Total royalty amount in wei
     */
    function royaltyInfo(
        uint256 id,
        uint256 value
    )
        external
        view
        override
        returns (
            address[] memory receiver,
            uint256[] memory royaltyAmounts,
            uint256 totalAmount
        )
    {
        RoyaltyInfo memory royalties_ = royalties[id];
        uint256 len = (royalties_.recipient).length;

        if (len == 0) {
            totalAmount = (value * 250) / 10000; // 2.5% default royalty
            receiver = new address[](1);
            royaltyAmounts = new uint256[](1);
            receiver[0] = creator[id];
            royaltyAmounts[0] = totalAmount;
        } else {
            receiver = new address[](len);
            receiver = royalties_.recipient;
            royaltyAmounts = new uint256[](len);

            uint256[] memory royalty = new uint256[](len);
            royalty = royalties_.amount;
            uint256 _royaltyAmount;
            for (uint256 i = 0; i < len; i++) {
                _royaltyAmount = (value * royalty[i]) / 10000;
                royaltyAmounts[i] = _royaltyAmount;
                totalAmount += _royaltyAmount;
            }
        }
    }

    /**
     * @dev Internal function to mint new tokens
     * @param id_ Token ID to mint
     * @param amount_ Number of tokens to mint
     * @param to_ Recipient address
     * @param tokenURI Metadata URI for the token
     */
    function mint(
        uint256 id_,
        uint256 amount_,
        address to_,
        string memory tokenURI
    ) internal {
        _beforeTokenMint(id_, amount_, to_);
        _setURI(id_, tokenURI);

        emit Mint(to_, id_, amount_);
        _mint(to_, id_, amount_, "");
    }

    /**
     * @dev Redeems a signed voucher to mint new tokens
     * @param minter Address that will receive the newly minted tokens
     * @param voucher NFTVoucher containing minting parameters
     * @param amountToMint Number of tokens to mint
     * @param signature EIP712 signature of the voucher
     * Requirements:
     * - Only callable by marketplace
     * - Valid signature from authorized signer
     * - Signer must be the maker of the voucher
     * - Signer cannot be the minter
     */
    function redeem(
        address minter,
        NFTVoucher memory voucher,
        uint256 amountToMint,
        bytes memory signature
    ) external override {
        require(msg.sender == marketplace, "redeem: Unauthorized access");

        signer = _verify(voucher, signature);

        require(signer == voucher.maker, "redeem: unauthorized signer");
        require(signer != minter, "redeem: signer == buyer");

        mint(voucher.tokenId, amountToMint, voucher.maker, voucher.tokenURI);

        safeTransferFrom(signer, minter, voucher.tokenId, amountToMint, "");
    }

    /**
     * @dev Verifies the signature of an NFT voucher
     * @return Address of the signer
     */
    function check(
        NFTVoucher memory voucher,
        bytes memory signature
    ) public view returns (address) {
        return _verify(voucher, signature);
    }

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155) returns (bool) {
        return ERC1155.supportsInterface(interfaceId);
    }

    /**
     * @dev Verifies an EIP712 signature for an NFT voucher
     * @return Address of the signer
     */
    function _verify(
        NFTVoucher memory voucher,
        bytes memory _signature
    ) public view override returns (address) {
        bytes32 digest = _hash(voucher);
        address _signer = digest.recover(_signature);
        return _signer;
    }

    /**
     * @dev Creates an EIP712 hash of the voucher data
     */
    function _hash(NFTVoucher memory voucher) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "NFTVoucher(uint256 tokenId,uint256 nftAmount,uint256 price,uint256 startDate,uint256 endDate,address maker,address nftAddress,string tokenURI)"
                        ),
                        voucher.tokenId,
                        voucher.nftAmount,
                        voucher.price,
                        voucher.startDate,
                        voucher.endDate,
                        voucher.maker,
                        voucher.nftAddress,
                        keccak256(bytes(voucher.tokenURI))
                    )
                )
            );
    }

    /**
     * @dev Internal function to validate minting parameters
     * Requirements:
     * - Total supply after minting cannot exceed maxTokens
     * - Only the creator can mint tokens
     * - Amount must be positive
     */
    function _beforeTokenMint(
        uint256 id,
        uint256 amount,
        address to_
    ) internal view {
        require(
            amount + totalSupply(id) <= maxTokens[id],
            "_beforeTokenMint: exceeding max limit of tokens set to mint"
        );
        require(
            creator[id] == to_,
            "_beforeTokenMint: unauthorized attempt to mint"
        );
        require(amount != 0, "_beforeTokenMint: amount should be positive");
    }

    /**
     * @dev Internal function to set the token URI
     * @notice URI can only be set once per token ID
     */
    function _setURI(uint256 id, string memory _uri) internal {
        if (bytes(_tokenURIs[id]).length == bytes("").length) {
            require(bytes(_uri).length != 0, "_setURI: tokenURI should be set");
            _tokenURIs[id] = _uri;
        }
    }
}

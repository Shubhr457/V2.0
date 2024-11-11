//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./interfaces/ITokenRoyalties.sol";
import "./interfaces/ILazyMinting.sol";

/**
 * @title NFT Marketplace
 * @dev A marketplace contract for trading ERC1155 tokens with support for lazy minting,
 * fixed price sales, auctions, and royalties
 *
 * Security features:
 * - ReentrancyGuard for all external functions that modify state
 * - ERC1155Holder for receiving NFTs
 * - Ownable for privileged operations
 */
contract NFTMarketplace is ERC1155Holder, ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    // Admin address for privileged operations
    address public admin;

    // Enum to distinguish between fixed price sales and auctions
    enum SaleKind {
        FixedPrice,
        Auction
    }

    // Platform service fee in basis points
    uint256 private _serviceFee;
    SaleKind public saleKind;

    // Counter for marketplace items
    Counters.Counter private _itemIds;

    /**
     * @dev Emitted when an item is listed for sale
     * @param seller Address of the seller
     * @param nftAddress Contract address of the NFT
     * @param itemId Unique identifier for the listing
     * @param tokenId Token ID of the NFT
     * @param basePrice Starting price for the item
     * @param amount Number of tokens being sold
     * @param listingDate Start time of the sale
     * @param expirationDate End time of the sale
     * @param saleKind Type of sale (Fixed price or Auction)
     */
    event List(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 basePrice,
        uint256 amount,
        uint256 listingDate,
        uint256 expirationDate,
        SaleKind saleKind
    );

    /**
     * @dev Emitted when a listing is cancelled
     */
    event Cancel(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 amount
    );

    /**
     * @dev Emitted when an item is sold
     */
    event Sold(
        uint256 indexed itemId,
        address indexed seller,
        address indexed buyer,
        address nftAddress,
        uint256 tokenId,
        uint256 amount,
        uint256 nftNumber
    );

    /**
     * @dev Emitted when service fee is updated
     */
    event ServiceFeeUpdated(
        address indexed owner,
        uint256 oldFee,
        uint256 newFee
    );

    /**
     * @dev Emitted when an offer is claimed
     */
    event OfferClaimed(
        uint256 indexed itemId,
        address indexed seller,
        address indexed buyer,
        address nftAddress,
        uint256 tokenId,
        uint256 nftAmount
    );

    /**
     * @dev Emitted when NFT is transferred
     */
    event NFTTransferred(
        uint256 indexed itemId,
        address indexed seller,
        address indexed buyer,
        address nftAddress,
        uint256 tokenId,
        uint256 nftAmount
    );

    /**
     * @dev Modifier to restrict function access to admin only
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    /**
     * @dev Modifier to check if item exists and is listed
     */
    modifier itemExists(uint256 _id) {
        require(_id <= _itemIds.current(), "itemExists:Item Id out of bounds");
        require(marketItems[_id].basePrice > 0, "itemExists: Item not listed");
        _;
    }

    /**
     * @dev Structure to store item listing details
     */
    struct Item {
        uint256 tokenId; // Token ID of the NFT
        uint256 basePrice; // Starting price
        uint256 itemsAvailable; // Number of tokens available
        uint256 listingTime; // Sale start time
        uint256 expirationTime; // Sale end time
        uint256 reservePrice; // Minimum price for auction
        address nftAddress; // NFT contract address
        address seller; // Seller's address
        bool lazyMint; // Whether the token uses lazy minting
        SaleKind saleKind; // Type of sale
    }

    // Mapping from itemId to Item details
    mapping(uint256 => Item) public marketItems;

    // Mapping to track lazy minted tokens
    mapping(uint256 => uint256) private lazyListings;

    /**
     * @dev Constructor sets initial service fee and admin
     * @param serviceFee_ Initial service fee in basis points
     */
    constructor(uint256 serviceFee_) {
        _serviceFee = serviceFee_;
        admin = _msgSender();
    }

    /**
     * @dev Returns total number of items listed
     */
    function getItemCount() external view returns (uint256) {
        return _itemIds.current();
    }

    /**
     * @dev Returns current service fee rate
     */
    function getServiceFeeRate() external view returns (uint256) {
        return _serviceFee;
    }

    /**
     * @dev Updates service fee
     * @param _newFee New fee rate in basis points
     */
    function setServiceFee(uint256 _newFee) external onlyOwner {
        uint256 _oldFee = _serviceFee;
        _serviceFee = _newFee;
        emit ServiceFeeUpdated(_msgSender(), _oldFee, _newFee);
    }

    /**
     * @dev Internal function to validate and setup lazy minting
     * @param _tokenId Token ID to be minted
     * @param _nftAddress NFT contract address
     * @param _nftMaxCopies Maximum number of copies allowed
     * @param _nftAmount Number of tokens to mint
     * @param royalties Array of royalty percentages
     * @param recipients Array of royalty recipients
     */
    function _check(
        uint256 _tokenId,
        address _nftAddress,
        uint256 _nftMaxCopies,
        uint256 _nftAmount,
        uint256[] memory royalties,
        address[] memory recipients
    ) internal {
        if (ILazyMinting(_nftAddress).getMaxTokens(_tokenId) == 0) {
            // New token setup
            require(
                _nftMaxCopies >= _nftAmount,
                "listItem: invalid nft amount"
            );
            lazyListings[_tokenId] = _nftAmount;
            ILazyMinting(_nftAddress).setMaxTokens(_tokenId, _nftMaxCopies);
            ILazyMinting(_nftAddress).setCreator(_tokenId, _msgSender());
            ILazyMinting(_nftAddress).setTokenRoyalty(
                _tokenId,
                royalties,
                recipients
            );
        } else {
            // Existing token validation
            require(
                lazyListings[_tokenId] +
                    _nftAmount +
                    ILazyMinting(_nftAddress).totalSupply(_tokenId) <=
                    ILazyMinting(_nftAddress).getMaxTokens(_tokenId),
                "listItem: invalid nft amount"
            );
            require(
                ILazyMinting(_nftAddress).getCreator(_tokenId) == _msgSender(),
                "listItem: unauthorised attempt of listing"
            );
            lazyListings[_tokenId] += _nftAmount;
        }
    }

    /**
     * @dev Lists an item for sale
     * @param _nftMaxCopies Maximum number of copies for lazy minting
     * @param listData Listing details
     * @param royalties Array of royalty percentages
     * @param recipients Array of royalty recipients
     */
    function listItem(
        uint256 _nftMaxCopies,
        Item calldata listData,
        uint256[] memory royalties,
        address[] calldata recipients
    ) external nonReentrant {
        _itemIds.increment();
        uint256 itemId = _itemIds.current();

        Item memory item = listData;

        require(item.nftAddress != address(0), "listItem: nft address is zero");
        require(item.itemsAvailable != 0, "listItem: nft amount is zero");

        // Handle lazy minting setup if needed
        if (item.lazyMint) {
            _check(
                item.tokenId,
                item.nftAddress,
                _nftMaxCopies,
                item.itemsAvailable,
                royalties,
                recipients
            );
        }

        // Validate listing parameters
        require(
            item.expirationTime > item.listingTime,
            "listItem: Expiration date invalid"
        );
        require(
            item.listingTime >= block.timestamp - 300,
            "listItem: listing time invalid"
        );
        require(item.basePrice != 0, "listItem: Price cannot be zero");
        require(
            item.itemsAvailable != 0,
            "listItem: cannot list zero number of items"
        );

        // Additional validation for auctions
        if (item.saleKind == SaleKind.Auction) {
            require(
                item.reservePrice >= item.basePrice,
                "listItem: Reserve price is lower than base price"
            );
            require(
                item.itemsAvailable == 1,
                "listItem: more than one copy for auction"
            );
        }

        marketItems[itemId] = listData;

        emit List(
            _msgSender(),
            item.nftAddress,
            itemId,
            item.tokenId,
            item.basePrice,
            item.itemsAvailable,
            item.listingTime,
            item.expirationTime,
            item.saleKind
        );

        // Transfer NFT to marketplace if not lazy minting
        if (!item.lazyMint) {
            IERC1155(item.nftAddress).safeTransferFrom(
                _msgSender(),
                address(this),
                item.tokenId,
                item.itemsAvailable,
                ""
            );
        }
    }

    /**
     * @notice Cancels an existing NFT listing and handles token return
     * @param _itemId ID of the listing to cancel
     * @dev Only admin can cancel listings
     *      For regular listings, NFTs are transferred back to the caller
     *      For lazy minted listings, only the listing count is decremented
     *      Emits Cancel event before token transfer for better transaction tracking
     */
    function cancelListing(uint256 _itemId) external itemExists(_itemId) {
        // Load item data into memory for gas optimization and cleanup
        Item memory item_ = marketItems[_itemId];
        IERC1155 nft = IERC1155(item_.nftAddress);

        // Only admin can cancel listings
        require(admin == _msgSender(), "cancelListing: Unauthorized access");

        // Cache values before deleting the listing
        uint256 id = item_.tokenId;
        uint256 amount = item_.itemsAvailable;
        bool isLazyMint = item_.lazyMint;

        // Remove the listing from storage
        delete (marketItems[_itemId]);

        // Emit cancellation event
        emit Cancel(_msgSender(), item_.nftAddress, _itemId, id, amount);

        // Handle token cleanup based on minting status
        if (isLazyMint) {
            // For lazy minted tokens, decrease the listing counter
            lazyListings[item_.tokenId] -= amount;
        } else {
            // For regular listings, return NFTs to the caller
            nft.safeTransferFrom(address(this), _msgSender(), id, amount, "");
        }
    }

    /**
     * @notice Allows claiming of an accepted offer for an NFT purchase
     * @param _itemId The ID of the item being purchased through offer
     * @param _buyer Address of the buyer who made the offer
     * @param nftAmount Number of NFT tokens to purchase
     * @param voucher Lazy minting voucher containing price and NFT details
     * @param signature Cryptographic signature from seller accepting the offer
     * @dev Only admin can execute this function to ensure off-chain offer verification
     *      The function verifies seller's signature and handles both lazy-minted and pre-minted NFTs
     */
    function claimOffer(
        uint256 _itemId,
        address _buyer,
        uint256 nftAmount,
        ILazyMinting.NFTVoucher calldata voucher,
        bytes memory signature
    ) external itemExists(_itemId) onlyAdmin {
        Item memory item_ = marketItems[_itemId];

        // Check if enough tokens are available for purchase
        require(
            item_.itemsAvailable >= nftAmount,
            "claimOffer: Not enough tokens on sale"
        );

        // Verify that caller is either the buyer or admin
        require(
            _msgSender() == _buyer || _msgSender() == admin,
            "claimOffer: Unauthorized access"
        );

        // Verify the signature comes from the seller through the NFT contract
        address signer = ILazyMinting(item_.nftAddress)._verify(
            voucher,
            signature
        );

        // Ensure the listing is a fixed price sale
        require(
            item_.saleKind == SaleKind.FixedPrice,
            "accetedOffer: not valid for auction sale"
        );

        // Verify the signer is the actual seller of the item
        require(signer == item_.seller, "claimOffer: unauthorized signer");

        // Calculate total price based on voucher price and NFT amount
        uint256 _totalPrice = voucher.price * nftAmount;

        // Emit sale event with offer details
        emit Sold(
            _itemId,
            item_.seller,
            _buyer,
            item_.nftAddress,
            item_.tokenId,
            _totalPrice,
            nftAmount
        );

        // Handle purchase based on whether NFT is lazy minted or not
        if (item_.lazyMint) {
            _purchaseWithLazyMinting(
                _itemId,
                nftAmount,
                _buyer,
                voucher,
                signature
            );
        } else {
            _purchase(_itemId, nftAmount, _buyer);
        }
    }

    /**
     * @notice Allows purchase of fixed-price NFTs with fiat payment handled off-chain
     * @param _itemId The ID of the item being purchased
     * @param _nftAmount Number of NFT tokens to purchase
     * @param voucher Lazy minting voucher data if the NFT hasn't been minted yet
     * @param signature Cryptographic signature for lazy minting verification
     * @param buyer Address of the NFT purchaser
     * @dev Only admin can call this function as fiat payments are verified off-chain
     */
    function buyItem(
        uint256 _itemId,
        uint256 _nftAmount,
        ILazyMinting.NFTVoucher calldata voucher,
        bytes memory signature,
        address buyer
    ) external itemExists(_itemId) nonReentrant onlyAdmin {
        Item memory item_ = marketItems[_itemId];

        // Basic validation checks
        require(buyer != item_.seller, "buyItem: seller itself cannot buy");
        require(
            item_.saleKind == SaleKind.FixedPrice,
            "buyItem: Not on fixed price sale"
        );

        // Time-based validations
        require(
            item_.expirationTime > block.timestamp,
            "buyItem: Sale expired"
        );
        require(
            block.timestamp >= item_.listingTime,
            "buyItem: Sale not started"
        );

        // Availability check
        require(
            item_.itemsAvailable >= _nftAmount,
            "buyItem: Not enough tokens on sale"
        );

        // Emit sale event with price 0 since payment is handled via fiat
        emit Sold(
            _itemId,
            item_.seller,
            buyer,
            item_.nftAddress,
            item_.tokenId,
            0,
            _nftAmount
        );

        // Handle purchase based on minting status
        if (!item_.lazyMint) {
            _purchase(_itemId, _nftAmount, buyer);
        } else {
            _purchaseWithLazyMinting(
                _itemId,
                _nftAmount,
                buyer,
                voucher,
                signature
            );
        }

        // Emit transfer event
        emit NFTTransferred(
            _itemId,
            item_.seller,
            buyer,
            item_.nftAddress,
            item_.tokenId,
            _nftAmount
        );

        // Update available items
        item_.itemsAvailable -= _nftAmount;
        marketItems[_itemId] = item_;
    }

    /**
     * @notice Allows claiming of auctioned NFTs after auction end
     * @param _itemId The ID of the auctioned item
     * @param buyer Address of the winning bidder
     * @param voucher Lazy minting voucher if NFT hasn't been minted
     * @param signature Cryptographic signature for lazy minting verification
     * @dev Only admin can call this function as auction winner is determined off-chain
     */
    function claimNFT(
        uint256 _itemId,
        address buyer,
        ILazyMinting.NFTVoucher calldata voucher,
        bytes memory signature
    ) external itemExists(_itemId) onlyAdmin {
        Item memory item_ = marketItems[_itemId];

        // Validate auction-specific conditions
        require(
            item_.saleKind == SaleKind.Auction,
            "claimNFT: Not an auction listing"
        );

        uint256 _nftAmount = item_.itemsAvailable;

        require(
            block.timestamp > item_.expirationTime,
            "claimNFT: Auction has not ended yet"
        );

        require(buyer != address(0), "claimNFT: Invalid buyer address");

        // Auctions only support single NFT sales
        require(_nftAmount == 1, "claimNFT: Invalid auction NFT amount");

        // Handle NFT transfer based on minting status
        if (item_.lazyMint) {
            _purchaseWithLazyMinting(
                _itemId,
                _nftAmount,
                buyer,
                voucher,
                signature
            );
        } else {
            _purchase(_itemId, _nftAmount, buyer);
        }
    }

    /**
     * @notice Internal function to handle lazy minting purchases
     * @param _itemId ID of the item being purchased
     * @param _nftAmount Number of NFTs to purchase
     * @param _buyer Address of the buyer
     * @param voucher Lazy minting voucher data
     * @param signature Cryptographic signature for verification
     * @dev Updates listing state and mints NFTs directly to buyer
     */
    function _purchaseWithLazyMinting(
        uint256 _itemId,
        uint256 _nftAmount,
        address _buyer,
        ILazyMinting.NFTVoucher calldata voucher,
        bytes memory signature
    ) internal {
        Item storage item_ = marketItems[_itemId];

        // Update available quantities
        item_.itemsAvailable -= _nftAmount;
        lazyListings[item_.tokenId] -= _nftAmount;

        // Mint NFT directly to buyer
        ILazyMinting(item_.nftAddress).redeem(
            _buyer,
            voucher,
            _nftAmount,
            signature
        );

        // Clean up if no items left
        if (item_.itemsAvailable == 0) {
            delete (marketItems[_itemId]);
        }
    }

    /**
     * @notice Internal function to handle regular NFT purchases
     * @param _itemId ID of the item being purchased
     * @param _nftAmount Number of NFTs to purchase
     * @param _buyer Address of the buyer
     * @dev Transfers existing NFTs from contract to buyer
     */
    function _purchase(
        uint256 _itemId,
        uint256 _nftAmount,
        address _buyer
    ) internal {
        Item storage item_ = marketItems[_itemId];
        item_.itemsAvailable -= _nftAmount;

        // Transfer NFTs to buyer
        IERC1155(item_.nftAddress).safeTransferFrom(
            address(this),
            _buyer,
            item_.tokenId,
            _nftAmount,
            ""
        );

        // Clean up if no items left
        if (item_.itemsAvailable == 0) {
            delete (marketItems[_itemId]);
        }
    }

    /**
     * @notice Queries royalty information for an NFT
     * @param _nftAddress Address of the NFT contract
     * @param _tokenId Token ID to check royalties for
     * @param _amount Sale amount to calculate royalties from
     * @return recipients Array of addresses to receive royalties
     * @return values Array of royalty amounts for each recipient
     * @return total Total royalty amount
     */
    function getRoyalty(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _amount
    )
        external
        view
        returns (
            address[] memory recipients,
            uint256[] memory values,
            uint256 total
        )
    {
        return ITokenRoyalties(_nftAddress).royaltyInfo(_tokenId, _amount);
    }
    fallback() external payable {
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

interface ILazyMinting {
    //@dev don't change the structure as it is being inherited in other contracts
    struct NFTVoucher {
        uint256 tokenId;
        uint256 nftAmount;
        uint256 price;
        uint256 startDate;
        uint256 endDate;
        address maker;
        address nftAddress;
        string tokenURI;
    }

    function redeem(
        address minter,
        NFTVoucher calldata voucher,
        uint256 nftAmount,
        bytes memory signture
    ) external;

    function setCreator(uint256 id, address _creator) external;

    function setMaxTokens(uint256 tokenId, uint256 amount) external;

    function setTokenRoyalty(
        uint256 id,
        uint256[] memory value,
        address[] memory recipient
    ) external;

    function _verify(NFTVoucher memory voucher, bytes memory _signature)
        external
        view
        returns (address);

    function totalSupply(uint256 tokenId) external view returns (uint256);

    function getCreator(uint256 tokenId) external view returns (address);

    function getMaxTokens(uint256 tokenId) external view returns (uint256);
}

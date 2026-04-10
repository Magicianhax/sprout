const DEFILLAMA_ICON_BASE = "https://icons.llamao.fi/icons/protocols";
const LIFI_CHAIN_ICON_BASE = "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains";

const CHAIN_ICON_SLUGS: Record<number, string> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
};

export function getProtocolLogoUrl(protocolName: string): string {
  return `${DEFILLAMA_ICON_BASE}/${protocolName}`;
}

export function getChainLogoUrl(chainId: number): string {
  const slug = CHAIN_ICON_SLUGS[chainId];
  if (!slug) return "/fallback-protocol.svg";
  return `${LIFI_CHAIN_ICON_BASE}/${slug}.svg`;
}

export function getTokenLogoUrl(symbol: string): string {
  const tokenLogos: Record<string, string> = {
    USDC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
    USDT: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
    ETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    WBTC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png",
    DAI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
  };
  return tokenLogos[symbol.toUpperCase()] || "/fallback-protocol.svg";
}

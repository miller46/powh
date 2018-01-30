var config = {
    "isTestnet": false,
    "siteUrl": "http://localhost:8000",
    "contractFileNameBase": "../contract/powh",
    "contractAddress": "0xA7CA36F7273D4d38fc2aEC5A454C497F86728a7A",
    "etherscanApiKey": "JEEFXW352DSRW9JX9J549YQ91I5Y29SNHK",
    "defaultWeb3Provider": "https://mainnet.infura.io/ciBBPCkyQfaUNJHDiCMJ",
    "userCookie": "powh-cookie",
};

try {
    global.config = config;
    module.exports = config;
} catch (err) {
}
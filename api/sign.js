import { ethers } from 'ethers';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { score, userAddress } = req.body;

        // 1. BASIC VALIDATION
        // In a real app, you might track start_time in a database 
        // and check if enough time has passed to achieve this score.
        if (!score || !userAddress) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        if (score > 1000000) { // Example: Hard cap for impossible scores
            return res.status(400).json({ error: 'Score exceeds physical limits' });
        }

        // 2. SIGNING THE SCORE
        // This Private Key MUST be kept secret! 
        // In Vercel, store this in an Environment Variable (Settings > Environment Variables)
        const privateKey = process.env.ARCADE_SIGNER_KEY;

        if (!privateKey) {
            console.error("ARCADE_SIGNER_KEY not configured");
            return res.status(500).json({ error: 'Signer not configured on server' });
        }

        const wallet = new ethers.Wallet(privateKey);

        // We hash the address and the score exactly like the contract verifies it
        // keccak256(abi.encodePacked(userAddress, score))
        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "uint256"],
            [userAddress, score]
        );

        // ethers.Wallet.signMessage automatically prepends "\x19Ethereum Signed Message:\n32"
        const signature = await wallet.signMessage(ethers.toBeArray(messageHash));

        return res.status(200).json({
            score,
            userAddress,
            signature
        });

    } catch (error) {
        console.error("Signing error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

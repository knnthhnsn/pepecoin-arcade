import express from 'express';
import { ethers } from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: Set this on your server: export ARCADE_SIGNER_KEY=0x...
const PRIVATE_KEY = process.env.ARCADE_SIGNER_KEY;

app.use(express.json());
app.use(express.static(path.join(__dirname, './'))); // Serve static files

// The Signing Endpoint
app.post('/api/sign', async (req, res) => {
    try {
        const { score, userAddress } = req.body;

        if (!score || !userAddress || !PRIVATE_KEY) {
            return res.status(400).json({ error: 'Incomplete data or server not configured' });
        }

        const wallet = new ethers.Wallet(PRIVATE_KEY);
        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "uint256"],
            [userAddress, score]
        );
        const signature = await wallet.signMessage(ethers.toBeArray(messageHash));

        res.json({ score, userAddress, signature });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Signing failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Arcade server running on port ${PORT}`);
});

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PepecoinArcade {
    address public owner;
    address public pepecoinAddress = 0xA9E8aCf069C58aEc8825542845Fd754e41a9489A;
    
    uint256 public constant ENTRY_FEE = 1 * 10**18; // Assuming 18 decimals
    uint256 public constant CYCLE_SIZE = 60;
    uint256 public constant WINNER_PAYOUT = 50 * 10**18;
    uint256 public constant OWNER_PAYOUT = 10 * 10**18;

    struct Player {
        address addr;
        uint256 score;
        string name;
    }

    Player public topPlayer;
    uint256 public gameCount;

    event GamePlayed(address indexed player, uint256 totalGames);
    event PayoutTriggered(address indexed winner, uint256 score, uint256 amount);
    event NewHighScore(address indexed player, uint256 score);

    constructor() {
        owner = 0xAfBDfCDfa5454E45aa9AeE833DF87cC3Ec511d1b;
    }

    // Function to play a game - user must have approved the contract to spend 1 PEPECOIN
    function playGame() external {
        require(IERC20(pepecoinAddress).transferFrom(msg.sender, address(this), ENTRY_FEE), "Transfer failed");
        
        gameCount++;
        emit GamePlayed(msg.sender, gameCount);

        if (gameCount >= CYCLE_SIZE) {
            _triggerPayout();
        }
    }

    // Simple submission - In a production app, this should be signed by an authorized server
    // to prevent fake score submissions.
    function submitScore(uint256 score, string memory name) external {
        if (score > topPlayer.score) {
            topPlayer = Player(msg.sender, score, name);
            emit NewHighScore(msg.sender, score);
        }
    }

    function _triggerPayout() internal {
        address winner = topPlayer.addr;
        uint256 score = topPlayer.score;

        // If no games were played with submitted scores, owner gets it all as fallback or it stays in contract
        // In this logic, if topPlayer is address(0), we payout to owner.
        if (winner == address(0)) {
            winner = owner;
        }

        // Payout to winner
        IERC20(pepecoinAddress).transfer(winner, WINNER_PAYOUT);
        
        // Payout to owner
        IERC20(pepecoinAddress).transfer(owner, OWNER_PAYOUT);

        emit PayoutTriggered(winner, score, WINNER_PAYOUT);

        // Reset cycle
        gameCount = 0;
        topPlayer = Player(address(0), 0, "");
    }

    // Allow owner to withdraw accidentally sent tokens or stuck funds
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Not owner");
        uint256 balance = IERC20(pepecoinAddress).balanceOf(address(this));
        IERC20(pepecoinAddress).transfer(owner, balance);
    }
}

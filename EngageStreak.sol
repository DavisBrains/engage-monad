// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title EngageStreak
/// @notice Tracks a per-wallet daily engagement streak on Monad.
/// Call logEngagement() once per day to keep your streak alive.
contract EngageStreak {

    struct UserStats {
        uint256 currentStreak;   // consecutive days engaged
        uint256 longestStreak;   // best streak ever hit
        uint256 totalUses;       // lifetime uses
        uint256 lastTimestamp;   // last time logEngagement was called
    }

    mapping(address => UserStats) public stats;

    // Streak stays alive if you log again within this window of your last log.
    uint256 public constant STREAK_WINDOW = 2 days;
    // Minimum gap enforced so you can't spam the same "day" repeatedly.
    uint256 public constant MIN_GAP = 12 hours;

    event EngagementLogged(
        address indexed user,
        uint256 newStreak,
        uint256 totalUses,
        uint256 timestamp
    );

    error TooSoon(uint256 secondsUntilNextLog);

    /// @notice Call this each time you use the tool to log an engagement
    /// session and update your streak.
    function logEngagement() external {
        UserStats storage user = stats[msg.sender];

        if (user.lastTimestamp != 0) {
            uint256 sinceLast = block.timestamp - user.lastTimestamp;

            if (sinceLast < MIN_GAP) {
                revert TooSoon(MIN_GAP - sinceLast);
            }

            if (sinceLast <= STREAK_WINDOW) {
                // logged again in time -> streak continues
                user.currentStreak += 1;
            } else {
                // too much time passed -> streak resets
                user.currentStreak = 1;
            }
        } else {
            // first ever log
            user.currentStreak = 1;
        }

        if (user.currentStreak > user.longestStreak) {
            user.longestStreak = user.currentStreak;
        }

        user.totalUses += 1;
        user.lastTimestamp = block.timestamp;

        emit EngagementLogged(
            msg.sender,
            user.currentStreak,
            user.totalUses,
            block.timestamp
        );
    }

    /// @notice Read a user's full stats in one call (handy for the frontend).
    function getStats(address _user)
        external
        view
        returns (
            uint256 currentStreak,
            uint256 longestStreak,
            uint256 totalUses,
            uint256 lastTimestamp
        )
    {
        UserStats memory user = stats[_user];
        return (
            user.currentStreak,
            user.longestStreak,
            user.totalUses,
            user.lastTimestamp
        );
    }
}

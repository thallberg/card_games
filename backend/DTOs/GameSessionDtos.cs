namespace Backend.DTOs;

public record CreateGameSessionRequest(GameTypeDto GameType, int? MaxPlayers);

public record UpdateGameSessionRequest(GameTypeDto? GameType);

public record InviteToSessionRequest(Guid UserId);

public record GameSessionDto(
    Guid Id,
    Guid LeaderId,
    string LeaderDisplayName,
    string GameType,
    string Status,
    int MaxPlayers,
    int CurrentPlayerCount,
    DateTime CreatedAt,
    List<GameSessionPlayerDto> Players
);

public record GameSessionPlayerDto(Guid UserId, string DisplayName, int SeatOrder, DateTime JoinedAt);

public enum GameTypeDto
{
    Poker = 0,
    Blackjack = 1,
    FiveHundred = 2,
    Chicago = 3,
    TexasHoldem = 4,
}

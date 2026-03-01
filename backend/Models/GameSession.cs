namespace Backend.Models;

public class GameSession
{
    public Guid Id { get; set; }
    public Guid LeaderId { get; set; }
    public GameType GameType { get; set; }
    public GameSessionStatus Status { get; set; } = GameSessionStatus.Waiting;
    public int MaxPlayers { get; set; } = 6;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }

    public User Leader { get; set; } = null!;
    public ICollection<GameSessionPlayer> Players { get; set; } = new List<GameSessionPlayer>();
}

public enum GameSessionStatus
{
    Waiting,   // Lobby öppen, väntar på spelare
    InProgress,
    Finished
}

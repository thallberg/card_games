namespace Backend.Models;

public class GameSessionPlayer
{
    public Guid GameSessionId { get; set; }
    public Guid UserId { get; set; }
    public int SeatOrder { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public GameSession GameSession { get; set; } = null!;
    public User User { get; set; } = null!;
}

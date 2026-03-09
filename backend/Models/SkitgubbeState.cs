namespace Backend.Models;

/// <summary>
/// Lagrad spelstate för Skitgubbe (GameSession med GameType.Skitgubbe).
/// StateJson = full state (samma struktur som frontend GameState). PlayerOrderJson = [userId1, userId2, ...] där index 0 = p1, 1 = p2.
/// </summary>
public class SkitgubbeState
{
    public Guid GameSessionId { get; set; }
    public string StateJson { get; set; } = string.Empty;
    public string PlayerOrderJson { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public GameSession GameSession { get; set; } = null!;
}

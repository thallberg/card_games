namespace Backend.Models;

/// <summary>
/// Lagrad spelstate för Texas Hold'em (GameSession med GameType.TexasHoldem).
/// StateJson = full state (samma struktur som frontend). Server döljer andras hole cards vid GetState.
/// </summary>
public class TexasHoldemState
{
    public Guid GameSessionId { get; set; }
    public string StateJson { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public GameSession GameSession { get; set; } = null!;
}

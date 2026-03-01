namespace Backend.Models;

/// <summary>
/// Lagrad spelstate för ett 500-spel (GameSession med GameType.FiveHundred).
/// StateJson = JSON-serialiserad 500-state. PlayerOrderJson = JSON-array av UserId, index 0 = p1, 1 = p2.
/// </summary>
public class FiveHundredState
{
    public Guid GameSessionId { get; set; }
    public string StateJson { get; set; } = string.Empty;
    public string PlayerOrderJson { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public GameSession GameSession { get; set; } = null!;
}

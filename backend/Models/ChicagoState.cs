namespace Backend.Models;

/// <summary>
/// Lagrad spelstate för Chicago (GameSession med GameType.Chicago).
/// StateJson = full state. PlayerOrderJson = [userId1, userId2] där index 0 = p1, 1 = p2.
/// </summary>
public class ChicagoState
{
    public Guid GameSessionId { get; set; }
    public string StateJson { get; set; } = string.Empty;
    public string PlayerOrderJson { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public GameSession GameSession { get; set; } = null!;
}

namespace Backend.Models;

/// <summary>
/// Lagrad spelstate för Finns i sjön (GameSession med GameType.Finnsisjon).
/// StateJson = full state (samma struktur som frontend). PlayerOrderJson = [userId1, userId2, ...] där index 0 = p1, 1 = p2.
/// </summary>
public class FinnsisjonState
{
    public Guid GameSessionId { get; set; }
    public string StateJson { get; set; } = string.Empty;
    public string PlayerOrderJson { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public GameSession GameSession { get; set; } = null!;
}

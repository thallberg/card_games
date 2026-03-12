namespace Backend.Models;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    /// <summary>Vald avatar-emoji (en av de tillåtna), eller null.</summary>
    public string? AvatarEmoji { get; set; }
    /// <summary>Avatar-bild som data-URL (base64), eller null. Vid borttag återgår visning till första bokstaven i visningsnamn.</summary>
    public string? AvatarImageData { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<FriendRequest> SentFriendRequests { get; set; } = new List<FriendRequest>();
    public ICollection<FriendRequest> ReceivedFriendRequests { get; set; } = new List<FriendRequest>();
    public ICollection<UserFriend> FriendsAsUser { get; set; } = new List<UserFriend>();
    public ICollection<UserFriend> FriendsAsFriend { get; set; } = new List<UserFriend>();
    public ICollection<GameSessionPlayer> GameSessionPlayers { get; set; } = new List<GameSessionPlayer>();
    public ICollection<GameSession> LedGameSessions { get; set; } = new List<GameSession>();
}

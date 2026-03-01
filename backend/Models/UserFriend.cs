namespace Backend.Models;

public class UserFriend
{
    public Guid UserId { get; set; }
    public Guid FriendId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public User Friend { get; set; } = null!;
}

namespace Backend.Models;

public class FriendRequest
{
    public Guid Id { get; set; }
    public Guid FromUserId { get; set; }
    public Guid ToUserId { get; set; }
    public FriendRequestStatus Status { get; set; } = FriendRequestStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }

    public User FromUser { get; set; } = null!;
    public User ToUser { get; set; } = null!;
}

public enum FriendRequestStatus
{
    Pending,
    Accepted,
    Declined
}

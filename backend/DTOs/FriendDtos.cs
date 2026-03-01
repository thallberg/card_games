namespace Backend.DTOs;

public record SendFriendRequestRequest(Guid ToUserId);

public record FriendRequestDto(
    Guid Id,
    Guid FromUserId,
    string FromUserDisplayName,
    Guid ToUserId,
    string ToUserDisplayName,
    string Status,
    DateTime CreatedAt
);

public record FriendDto(Guid Id, string DisplayName, string Email, DateTime FriendsSince);

namespace Backend.DTOs;

public record RegisterRequest(string Email, string Password, string DisplayName);

public record LoginRequest(string Email, string Password);

public record LoginResponse(string Token, UserDto User);

public record UserDto(Guid Id, string Email, string DisplayName, DateTime CreatedAt, string? AvatarEmoji = null, string? AvatarImageData = null);

public record UpdateDisplayNameRequest(string DisplayName);

public record UpdateAvatarRequest(string? Emoji);

public record UpdateAvatarImageRequest(string? AvatarImageData);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

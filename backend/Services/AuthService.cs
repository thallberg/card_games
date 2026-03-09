using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Backend.Services;

public class AuthService
{
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(ApplicationDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<(bool Ok, string? Error, User? User)> RegisterAsync(string email, string password, string displayName)
    {
        email = email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(displayName))
            return (false, "Email, lösenord och visningsnamn krävs.", null);
        if (password.Length < 6)
            return (false, "Lösenordet måste vara minst 6 tecken.", null);

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return (false, "E-postadressen används redan.", null);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            DisplayName = displayName.Trim(),
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return (true, null, user);
    }

    public async Task<(bool Ok, string? Error, User? User)> LoginAsync(string email, string password)
    {
        email = email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return (false, "Ogiltig e-post eller lösenord.", null);
        return (true, null, user);
    }

    public async Task<(bool Ok, string? Error)> UpdateDisplayNameAsync(Guid userId, string newDisplayName)
    {
        newDisplayName = (newDisplayName ?? "").Trim();
        if (string.IsNullOrWhiteSpace(newDisplayName))
            return (false, "Visningsnamn får inte vara tomt.");
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return (false, "Användaren hittades inte.");
        user.DisplayName = newDisplayName;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public static readonly IReadOnlyList<string> AllowedAvatarEmojis = new[] { "😀", "😎", "🎮", "👑", "🌟", "🎯", "🃏", "🍀", "⚡", "🏆" };

    public async Task<(bool Ok, string? Error)> UpdateAvatarEmojiAsync(Guid userId, string? emoji)
    {
        if (emoji != null && !AllowedAvatarEmojis.Contains(emoji))
            return (false, "Ogiltig emoji. Välj en av de tillåtna.");
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return (false, "Användaren hittades inte.");
        user.AvatarEmoji = string.IsNullOrWhiteSpace(emoji) ? null : emoji.Trim();
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            return (false, "Nytt lösenord måste vara minst 6 tecken.");
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return (false, "Användaren hittades inte.");
        if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
            return (false, "Nuvarande lösenord är fel.");
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key saknas i konfiguration.")));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.DisplayName),
        };
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class FriendService
{
    private readonly ApplicationDbContext _db;

    public FriendService(ApplicationDbContext db) => _db = db;

    public async Task<(bool Ok, string? Error)> SendRequestAsync(Guid fromUserId, Guid toUserId)
    {
        if (fromUserId == toUserId)
            return (false, "Du kan inte skicka vänförfrågan till dig själv.");

        var toUser = await _db.Users.FindAsync(toUserId);
        if (toUser == null)
            return (false, "Användaren hittades inte.");

        var alreadyFriends = await _db.UserFriends.AnyAsync(uf =>
            (uf.UserId == fromUserId && uf.FriendId == toUserId) || (uf.UserId == toUserId && uf.FriendId == fromUserId));
        if (alreadyFriends)
            return (false, "Ni är redan vänner.");

        var pending = await _db.FriendRequests.AnyAsync(f =>
            f.FromUserId == fromUserId && f.ToUserId == toUserId && f.Status == FriendRequestStatus.Pending);
        if (pending)
            return (false, "Du har redan skickat en vänförfrågan till denna användare.");

        _db.FriendRequests.Add(new FriendRequest
        {
            Id = Guid.NewGuid(),
            FromUserId = fromUserId,
            ToUserId = toUserId,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> RespondToRequestAsync(Guid requestId, Guid respondingUserId, bool accept)
    {
        var req = await _db.FriendRequests
            .Include(f => f.FromUser)
            .Include(f => f.ToUser)
            .FirstOrDefaultAsync(f => f.Id == requestId);
        if (req == null || req.ToUserId != respondingUserId)
            return (false, "Förfrågan hittades inte.");
        if (req.Status != FriendRequestStatus.Pending)
            return (false, "Förfrågan är redan besvarad.");

        req.Status = accept ? FriendRequestStatus.Accepted : FriendRequestStatus.Declined;
        req.RespondedAt = DateTime.UtcNow;

        if (accept)
        {
            _db.UserFriends.Add(new UserFriend { UserId = req.FromUserId, FriendId = req.ToUserId });
            _db.UserFriends.Add(new UserFriend { UserId = req.ToUserId, FriendId = req.FromUserId });
        }
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<List<FriendRequestDto>> GetReceivedRequestsAsync(Guid userId)
    {
        var list = await _db.FriendRequests
            .Where(f => f.ToUserId == userId && f.Status == FriendRequestStatus.Pending)
            .Include(f => f.FromUser)
            .Include(f => f.ToUser)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FriendRequestDto(
                f.Id,
                f.FromUserId,
                f.FromUser.DisplayName,
                f.ToUserId,
                f.ToUser.DisplayName,
                f.Status.ToString(),
                f.CreatedAt
            ))
            .ToListAsync();
        return list;
    }

    public async Task<List<FriendRequestDto>> GetSentRequestsAsync(Guid userId)
    {
        return await _db.FriendRequests
            .Where(f => f.FromUserId == userId && f.Status == FriendRequestStatus.Pending)
            .Include(f => f.FromUser)
            .Include(f => f.ToUser)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FriendRequestDto(
                f.Id,
                f.FromUserId,
                f.FromUser.DisplayName,
                f.ToUserId,
                f.ToUser.DisplayName,
                f.Status.ToString(),
                f.CreatedAt
            ))
            .ToListAsync();
    }

    public async Task<List<FriendDto>> GetFriendsAsync(Guid userId)
    {
        var friends = await _db.UserFriends
            .Where(uf => uf.UserId == userId)
            .Include(uf => uf.Friend)
            .OrderBy(uf => uf.Friend.DisplayName)
            .Select(uf => new FriendDto(uf.Friend.Id, uf.Friend.DisplayName, uf.Friend.Email, uf.CreatedAt))
            .ToListAsync();
        return friends;
    }
}

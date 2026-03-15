using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class GameSessionService
{
    private readonly ApplicationDbContext _db;

    public GameSessionService(ApplicationDbContext db) => _db = db;

    private static GameType ModelGameType(GameTypeDto dto) => dto switch
    {
        GameTypeDto.Poker => GameType.Poker,
        GameTypeDto.Blackjack => GameType.Blackjack,
        GameTypeDto.FiveHundred => GameType.FiveHundred,
        GameTypeDto.Chicago => GameType.Chicago,
        GameTypeDto.TexasHoldem => GameType.TexasHoldem,
        GameTypeDto.Skitgubbe => GameType.Skitgubbe,
        GameTypeDto.Finnsisjon => GameType.Finnsisjon,
        _ => GameType.Poker,
    };

    private static string GameTypeString(GameType g) => g.ToString();

    public async Task<(bool Ok, string? Error, GameSessionDto? Session)> CreateAsync(Guid leaderId, GameTypeDto gameType, int maxPlayers = 6)
    {
        maxPlayers = Math.Clamp(maxPlayers, 2, 10);
        var session = new GameSession
        {
            Id = Guid.NewGuid(),
            LeaderId = leaderId,
            GameType = ModelGameType(gameType),
            MaxPlayers = maxPlayers,
        };
        _db.GameSessions.Add(session);
        _db.GameSessionPlayers.Add(new GameSessionPlayer
        {
            GameSessionId = session.Id,
            UserId = leaderId,
            SeatOrder = 0,
        });
        await _db.SaveChangesAsync();
        return (true, null, await GetByIdAsync(session.Id, leaderId));
    }

    public async Task<GameSessionDto?> GetByIdAsync(Guid sessionId, Guid? userId = null)
    {
        var s = await _db.GameSessions
            .Include(g => g.Leader)
            .Include(g => g.Players).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(g => g.Id == sessionId);
        if (s == null) return null;

        var players = s.Players.OrderBy(p => p.SeatOrder)
            .Select(p => new GameSessionPlayerDto(p.UserId, p.User.DisplayName, p.SeatOrder, p.JoinedAt, p.User.AvatarEmoji))
            .ToList();
        return new GameSessionDto(
            s.Id,
            s.LeaderId,
            s.Leader.DisplayName,
            GameTypeString(s.GameType),
            s.Status.ToString(),
            s.MaxPlayers,
            s.Players.Count,
            s.CreatedAt,
            players
        );
    }

    public async Task<List<GameSessionDto>> GetMySessionsAsync(Guid userId)
    {
        var ids = await _db.GameSessionPlayers.Where(p => p.UserId == userId).Select(p => p.GameSessionId).ToListAsync();
        var list = new List<GameSessionDto>();
        foreach (var id in ids)
        {
            var dto = await GetByIdAsync(id, userId);
            if (dto != null) list.Add(dto);
        }
        return list.OrderByDescending(x => x.CreatedAt).ToList();
    }

    public async Task<(bool Ok, string? Error)> UpdateAsync(Guid sessionId, Guid userId, GameTypeDto? gameType)
    {
        var s = await _db.GameSessions.FindAsync(sessionId);
        if (s == null) return (false, "Sessionen hittades inte.");
        if (s.LeaderId != userId) return (false, "Endast partyleader kan ändra sessionen.");
        if (s.Status != GameSessionStatus.Waiting) return (false, "Sessionen har redan startats.");

        if (gameType.HasValue)
            s.GameType = ModelGameType(gameType.Value);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> InviteAsync(Guid sessionId, Guid leaderId, Guid inviteUserId)
    {
        var s = await _db.GameSessions.Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == sessionId);
        if (s == null) return (false, "Sessionen hittades inte.");
        if (s.LeaderId != leaderId) return (false, "Endast partyleader kan bjuda in.");
        if (s.Status != GameSessionStatus.Waiting) return (false, "Spelet har redan startat.");
        if (s.Players.Count >= s.MaxPlayers) return (false, "Lobbyn är full.");

        if (s.Players.Any(p => p.UserId == inviteUserId))
            return (false, "Spelaren är redan i lobbyn.");

        var user = await _db.Users.FindAsync(inviteUserId);
        if (user == null) return (false, "Användaren hittades inte.");

        var nextSeat = s.Players.Any() ? s.Players.Max(p => p.SeatOrder) + 1 : 1;
        _db.GameSessionPlayers.Add(new GameSessionPlayer
        {
            GameSessionId = sessionId,
            UserId = inviteUserId,
            SeatOrder = nextSeat,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> JoinAsync(Guid sessionId, Guid userId)
    {
        var s = await _db.GameSessions.Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == sessionId);
        if (s == null) return (false, "Sessionen hittades inte.");
        if (s.Status != GameSessionStatus.Waiting) return (false, "Spelet har redan startat.");
        if (s.Players.Count >= s.MaxPlayers) return (false, "Lobbyn är full.");
        if (s.Players.Any(p => p.UserId == userId)) return (false, "Du är redan i lobbyn.");

        var nextSeat = s.Players.Any() ? s.Players.Max(p => p.SeatOrder) + 1 : 0;
        _db.GameSessionPlayers.Add(new GameSessionPlayer { GameSessionId = sessionId, UserId = userId, SeatOrder = nextSeat });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> LeaveAsync(Guid sessionId, Guid userId)
    {
        var s = await _db.GameSessions.Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == sessionId);
        if (s == null) return (false, "Sessionen hittades inte.");
        var player = s.Players.FirstOrDefault(p => p.UserId == userId);
        if (player == null) return (false, "Du är inte i denna session.");

        if (s.Status == GameSessionStatus.Waiting)
        {
            if (s.LeaderId == userId)
            {
                if (s.Players.Count == 1)
                    _db.GameSessions.Remove(s);
                else
                {
                    var nextLeader = s.Players.First(p => p.UserId != userId);
                    s.LeaderId = nextLeader.UserId;
                    s.Players.Remove(player);
                }
            }
            else
                s.Players.Remove(player);
        }
        else if (s.Status == GameSessionStatus.InProgress)
        {
            s.Players.Remove(player);
            if (s.Players.Count == 0)
                _db.GameSessions.Remove(s);
            else if (s.LeaderId == userId)
                s.LeaderId = s.Players.First().UserId;
        }
        else
            return (false, "Sessionen kan inte lämnas.");

        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> StartGameAsync(Guid sessionId, Guid userId)
    {
        var s = await _db.GameSessions.Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == sessionId);
        if (s == null) return (false, "Sessionen hittades inte.");
        if (s.LeaderId != userId) return (false, "Endast partyleader kan starta spelet.");
        if (s.Status != GameSessionStatus.Waiting) return (false, "Spelet har redan startats.");
        if (s.Players.Count < 2) return (false, "Minst 2 spelare krävs för att starta.");

        s.Status = GameSessionStatus.InProgress;
        s.StartedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }
}

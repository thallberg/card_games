using System.Text.Json;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class FinnsisjonService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private static readonly string[] Suits = { "hearts", "diamonds", "clubs", "spades" };
    private static readonly string[] Ranks = { "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king", "ace" };
    private const int InitialHandSize = 7;
    private const int MinPlayers = 2;
    private const int MaxPlayers = 6;

    private readonly ApplicationDbContext _db;

    public FinnsisjonService(ApplicationDbContext db) => _db = db;

    public async Task<(bool Ok, string? Error)> CreateInitialStateAsync(Guid sessionId)
    {
        var session = await _db.GameSessions
            .Include(g => g.Players)
            .FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (false, "Sessionen hittades inte.");
        if (session.GameType != GameType.Finnsisjon) return (false, "Inte ett Finns i sjön-spel.");
        if (session.Players.Count < MinPlayers) return (false, "Minst 2 spelare krävs.");
        if (session.Players.Count > MaxPlayers) return (false, "Finns i sjön stöder max 6 spelare.");

        var numPlayers = Math.Clamp(session.Players.Count, MinPlayers, MaxPlayers);
        var ordered = session.Players.OrderBy(p => p.SeatOrder).Select(p => p.UserId).Take(numPlayers).ToList();
        var playerIds = Enumerable.Range(1, numPlayers).Select(i => $"p{i}").ToArray();

        var deck = CreateAndShuffleDeck();
        var playerHands = new Dictionary<string, List<CardDto>>();
        var idx = 0;
        var handSize = Math.Min(InitialHandSize, deck.Count / numPlayers);
        foreach (var pid in playerIds)
        {
            var hand = deck.Skip(idx).Take(handSize).Select(c => new CardDto { Suit = c.Suit, Rank = c.Rank }).ToList();
            playerHands[pid] = hand;
            idx += handSize;
        }
        var sjön = deck.Skip(idx).Select(c => new CardDto { Suit = c.Suit, Rank = c.Rank }).ToList();
        var quartetsWon = playerIds.ToDictionary(p => p, _ => 0);

        var state = new
        {
            phase = "play",
            numPlayers,
            playerIds,
            tableau = Array.Empty<object[]>(),
            sjön,
            playerHands,
            quartetsWon,
            currentPlayerId = "p1",
            lastAsk = (object?)null,
            lastWasFinnsISjon = false,
            winnerId = (string?)null,
        };

        var stateJson = JsonSerializer.Serialize(state, JsonOptions);
        var playerOrderJson = JsonSerializer.Serialize(ordered.Select(g => g.ToString()).ToList());

        _db.FinnsisjonStates.Add(new FinnsisjonState
        {
            GameSessionId = sessionId,
            StateJson = stateJson,
            PlayerOrderJson = playerOrderJson,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private static List<(string Suit, string Rank)> CreateAndShuffleDeck()
    {
        var deck = new List<(string Suit, string Rank)>();
        foreach (var suit in Suits)
            foreach (var rank in Ranks)
                deck.Add((suit, rank));
        var rnd = new Random();
        for (int i = deck.Count - 1; i > 0; i--)
        {
            int j = rnd.Next(i + 1);
            (deck[i], deck[j]) = (deck[j], deck[i]);
        }
        return deck;
    }

    public async Task<(string? StateJson, string? MyPlayerId)> GetStateForUserAsync(Guid sessionId, Guid userId)
    {
        var row = await _db.FinnsisjonStates.FirstOrDefaultAsync(s => s.GameSessionId == sessionId);
        if (row == null) return (null, null);
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < MinPlayers) return (null, null);

        string? myPlayerId = null;
        for (int i = 0; i < Math.Min(playerOrder.Count, MaxPlayers); i++)
        {
            if (Guid.TryParse(playerOrder[i], out var g) && userId == g)
            {
                myPlayerId = $"p{i + 1}";
                break;
            }
        }
        if (myPlayerId == null) return (null, null);

        using var doc = JsonDocument.Parse(row.StateJson);
        var masked = MaskOtherHands(doc.RootElement, myPlayerId);
        return (masked, myPlayerId);
    }

    private static string MaskOtherHands(JsonElement root, string myPlayerId)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
        {
            writer.WriteStartObject();
            foreach (var prop in root.EnumerateObject())
            {
                if (prop.Name == "playerHands" && prop.Value.ValueKind == JsonValueKind.Object)
                {
                    writer.WritePropertyName("playerHands");
                    writer.WriteStartObject();
                    foreach (var hand in prop.Value.EnumerateObject())
                    {
                        writer.WritePropertyName(hand.Name);
                        if (hand.Name != myPlayerId && hand.Value.ValueKind == JsonValueKind.Array)
                        {
                            var len = hand.Value.GetArrayLength();
                            writer.WriteStartArray();
                            for (int i = 0; i < len; i++)
                            {
                                writer.WriteStartObject();
                                writer.WriteString("suit", "?");
                                writer.WriteString("rank", "?");
                                writer.WriteEndObject();
                            }
                            writer.WriteEndArray();
                        }
                        else
                            hand.Value.WriteTo(writer);
                    }
                    writer.WriteEndObject();
                }
                else
                    prop.WriteTo(writer);
            }
            writer.WriteEndObject();
        }
        stream.Position = 0;
        return new StreamReader(stream).ReadToEnd();
    }

    public async Task<(bool Ok, string? Error)> ApplyActionAsync(Guid sessionId, Guid userId, FinnsisjonActionRequest request)
    {
        var row = await _db.FinnsisjonStates.FirstOrDefaultAsync(s => s.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet hittades inte.");
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < MinPlayers) return (false, "Ogiltig spelarordning.");

        string? myPlayerId = null;
        for (int i = 0; i < Math.Min(playerOrder.Count, MaxPlayers); i++)
        {
            if (Guid.TryParse(playerOrder[i], out var g) && userId == g)
            {
                myPlayerId = $"p{i + 1}";
                break;
            }
        }
        if (myPlayerId == null) return (false, "Du är inte med i detta spel.");

        var newStateJson = request.NewStateJson;
        if (string.IsNullOrWhiteSpace(newStateJson)) return (false, "NewStateJson saknas.");

        using var clientDoc = JsonDocument.Parse(newStateJson);
        using var dbDoc = JsonDocument.Parse(row.StateJson);
        var otherIds = new List<string>();
        for (int i = 0; i < Math.Min(playerOrder.Count, MaxPlayers); i++)
        {
            var pid = $"p{i + 1}";
            if (pid != myPlayerId) otherIds.Add(pid);
        }
        var merged = MergeState(clientDoc.RootElement, dbDoc.RootElement, myPlayerId, otherIds);
        row.StateJson = merged;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private static string MergeState(JsonElement client, JsonElement db, string myId, List<string> otherIds)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
        {
            writer.WriteStartObject();
            foreach (var prop in client.EnumerateObject())
            {
                if (prop.Name == "playerHands" && prop.Value.ValueKind == JsonValueKind.Object)
                {
                    writer.WritePropertyName("playerHands");
                    writer.WriteStartObject();
                    foreach (var hand in prop.Value.EnumerateObject())
                    {
                        writer.WritePropertyName(hand.Name);
                        if (otherIds.Contains(hand.Name) && db.TryGetProperty("playerHands", out var dbHands) && dbHands.TryGetProperty(hand.Name, out var otherHand))
                            otherHand.WriteTo(writer);
                        else
                            hand.Value.WriteTo(writer);
                    }
                    writer.WriteEndObject();
                }
                else
                    prop.WriteTo(writer);
            }
            writer.WriteEndObject();
        }
        stream.Position = 0;
        return new StreamReader(stream).ReadToEnd();
    }
}

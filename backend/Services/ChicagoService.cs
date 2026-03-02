using System.Text.Json;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class ChicagoService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private const string P1 = "p1";
    private const string P2 = "p2";
    private const int HandSize = 5;

    private readonly ApplicationDbContext _db;

    public ChicagoService(ApplicationDbContext db) => _db = db;

    public async Task<(bool Ok, string? Error)> CreateInitialStateAsync(Guid sessionId)
    {
        var session = await _db.GameSessions
            .Include(g => g.Players)
            .FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (false, "Sessionen hittades inte.");
        if (session.GameType != GameType.Chicago) return (false, "Inte ett Chicago-spel.");
        if (session.Players.Count < 2) return (false, "Minst 2 spelare krävs.");

        var ordered = session.Players.OrderBy(p => p.SeatOrder).Select(p => p.UserId).Take(2).ToList();
        if (ordered.Count < 2) return (false, "Behöver exakt 2 spelare.");

        var deck = CreateAndShuffleDeck();
        var hand1 = deck.Take(HandSize).ToList();
        var hand2 = deck.Skip(HandSize).Take(HandSize).ToList();
        SortHand(hand1);
        SortHand(hand2);
        var deckRemaining = deck.Skip(HandSize * 2).ToList();

        var state = new Dictionary<string, object?>
        {
            ["phase"] = "draw",
            ["deck"] = deckRemaining.Select(c => new { suit = c.Suit, rank = c.Rank }).ToList(),
            ["playerHands"] = new Dictionary<string, object>
            {
                [P1] = hand1.Select(c => new { suit = c.Suit, rank = c.Rank }).ToList(),
                [P2] = hand2.Select(c => new { suit = c.Suit, rank = c.Rank }).ToList(),
            },
            ["drawRound"] = 0,
            ["drawPick"] = (object?)null,
            ["freeSwapUsedCount"] = 0,
            ["currentPlayerId"] = P1,
            ["trickNumber"] = 0,
            ["trickLeader"] = P2,
            ["trickCards"] = (object?)null,
            ["completedTricks"] = new List<object>(),
            ["playerScores"] = new Dictionary<string, int> { [P1] = 0, [P2] = 0 },
            ["roundUtspeletWinner"] = (object?)null,
            ["roundHandPoints"] = new Dictionary<string, int> { [P1] = 0, [P2] = 0 },
            ["playPhaseHands"] = new Dictionary<string, object> { [P1] = new List<object>(), [P2] = new List<object>() },
            ["rondNumber"] = 1,
        };

        var stateJson = JsonSerializer.Serialize(state, JsonOptions);
        var playerOrderJson = JsonSerializer.Serialize(ordered.Select(g => g.ToString()).ToList());

        _db.ChicagoStates.Add(new ChicagoState
        {
            GameSessionId = sessionId,
            StateJson = stateJson,
            PlayerOrderJson = playerOrderJson,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(string? StateJson, string? MyPlayerId)> GetStateForUserAsync(Guid sessionId, Guid userId)
    {
        var row = await _db.ChicagoStates.FirstOrDefaultAsync(c => c.GameSessionId == sessionId);
        if (row == null) return (null, null);
        using var doc = JsonDocument.Parse(row.StateJson);
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < 2) return (null, null);
        var myPlayerId = userId.ToString() == playerOrder[0] ? P1 : (userId.ToString() == playerOrder[1] ? P2 : null);
        if (myPlayerId == null) return (null, null);

        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
        {
            writer.WriteStartObject();
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Name == "playerHands" && prop.Value.ValueKind == JsonValueKind.Object)
                {
                    writer.WritePropertyName("playerHands");
                    writer.WriteStartObject();
                    foreach (var hand in prop.Value.EnumerateObject())
                    {
                        writer.WritePropertyName(hand.Name);
                        if (hand.Name == myPlayerId)
                            hand.Value.WriteTo(writer);
                        else
                        {
                            var count = hand.Value.GetArrayLength();
                            writer.WriteStartArray();
                            for (int i = 0; i < count; i++)
                                writer.WriteRawValue("{\"suit\":\"?\",\"rank\":\"?\"}");
                            writer.WriteEndArray();
                        }
                    }
                    writer.WriteEndObject();
                }
                else
                    prop.WriteTo(writer);
            }
            writer.WriteEndObject();
        }
        stream.Position = 0;
        using var reader = new StreamReader(stream);
        var stateJson = await reader.ReadToEndAsync();
        return (stateJson, myPlayerId);
    }

    /// <summary>Applicerar klientens state men behåller motspelarens hand från DB (klienten har bara maskad data).</summary>
    public async Task<(bool Ok, string? Error)> ApplyActionAsync(Guid sessionId, Guid userId, ChicagoActionRequest request)
    {
        var row = await _db.ChicagoStates.FirstOrDefaultAsync(c => c.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet hittades inte.");
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < 2) return (false, "Ogiltig spelarordning.");
        var myPlayerId = userId.ToString() == playerOrder[0] ? P1 : (userId.ToString() == playerOrder[1] ? P2 : null);
        if (myPlayerId == null) return (false, "Du är inte med i detta spel.");

        var newStateJson = request.NewStateJson;
        if (string.IsNullOrWhiteSpace(newStateJson)) return (false, "NewStateJson saknas.");

        var otherId = myPlayerId == P1 ? P2 : P1;
        using var clientDoc = JsonDocument.Parse(newStateJson);
        using var dbDoc = JsonDocument.Parse(row.StateJson);
        var merged = MergeState(clientDoc.RootElement, dbDoc.RootElement, myPlayerId, otherId);
        row.StateJson = merged;
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private static string MergeState(JsonElement client, JsonElement db, string myId, string otherId)
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
                        if (hand.Name == otherId && db.TryGetProperty("playerHands", out var dbHands) && dbHands.TryGetProperty(otherId, out var otherHand))
                            otherHand.WriteTo(writer);
                        else
                            hand.Value.WriteTo(writer);
                    }
                    writer.WriteEndObject();
                }
                else if (prop.Name == "playPhaseHands" && prop.Value.ValueKind == JsonValueKind.Object)
                {
                    writer.WritePropertyName("playPhaseHands");
                    writer.WriteStartObject();
                    foreach (var hand in prop.Value.EnumerateObject())
                    {
                        writer.WritePropertyName(hand.Name);
                        if (hand.Name == otherId && db.TryGetProperty("playPhaseHands", out var dbPhase) && dbPhase.TryGetProperty(otherId, out var otherPhase))
                            otherPhase.WriteTo(writer);
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

    public async Task<(bool Ok, string? Error)> StartNewRoundAsync(Guid sessionId)
    {
        var row = await _db.ChicagoStates.FirstOrDefaultAsync(c => c.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet hittades inte.");
        var state = JsonSerializer.Deserialize<JsonElement>(row.StateJson);
        if (state.ValueKind != JsonValueKind.Object) return (false, "Ogiltig state.");
        if (state.GetProperty("phase").GetString() != "roundEnd") return (false, "Runden är inte avslutad.");

        var deck = CreateAndShuffleDeck();
        var hand1 = deck.Take(HandSize).ToList();
        var hand2 = deck.Skip(HandSize).Take(HandSize).ToList();
        SortHand(hand1);
        SortHand(hand2);
        var deckRemaining = deck.Skip(HandSize * 2).ToList();

        var rondNumber = 1;
        if (state.TryGetProperty("rondNumber", out var rn))
            rondNumber = rn.GetInt32() + 1;

        var playerScores = new Dictionary<string, int>();
        if (state.TryGetProperty("playerScores", out var ps) && ps.ValueKind == JsonValueKind.Object)
            foreach (var p in ps.EnumerateObject())
                playerScores[p.Name] = p.Value.GetInt32();

        var newState = new Dictionary<string, object?>
        {
            ["phase"] = "draw",
            ["deck"] = deckRemaining.Select(c => new { suit = c.Suit, rank = c.Rank }).ToList(),
            ["playerHands"] = new Dictionary<string, object>
            {
                [P1] = hand1.Select(c => new { suit = c.Suit, rank = c.Rank }).ToList(),
                [P2] = hand2.Select(c => new { suit = c.Suit, rank = c.Rank }).ToList(),
            },
            ["drawRound"] = 0,
            ["drawPick"] = (object?)null,
            ["freeSwapUsedCount"] = 0,
            ["currentPlayerId"] = P1,
            ["trickNumber"] = 0,
            ["trickLeader"] = P2,
            ["trickCards"] = (object?)null,
            ["completedTricks"] = new List<object>(),
            ["playerScores"] = playerScores,
            ["roundUtspeletWinner"] = (object?)null,
            ["roundHandPoints"] = new Dictionary<string, int> { [P1] = 0, [P2] = 0 },
            ["playPhaseHands"] = new Dictionary<string, object> { [P1] = new List<object>(), [P2] = new List<object>() },
            ["rondNumber"] = rondNumber,
        };

        row.StateJson = JsonSerializer.Serialize(newState, JsonOptions);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private static List<CardDto> CreateAndShuffleDeck()
    {
        var suits = new[] { "hearts", "diamonds", "clubs", "spades" };
        var ranks = new[] { "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king", "ace" };
        var deck = new List<CardDto>();
        foreach (var suit in suits)
            foreach (var rank in ranks)
                deck.Add(new CardDto { Suit = suit, Rank = rank });
        var rnd = new Random();
        for (int i = deck.Count - 1; i > 0; i--)
        {
            int j = rnd.Next(i + 1);
            (deck[i], deck[j]) = (deck[j], deck[i]);
        }
        return deck;
    }

    private static void SortHand(List<CardDto> hand)
    {
        var suitOrder = new Dictionary<string, int> { ["hearts"] = 0, ["clubs"] = 1, ["diamonds"] = 2, ["spades"] = 3 };
        var rankOrder = new Dictionary<string, int> {
            ["2"] = 0, ["3"] = 1, ["4"] = 2, ["5"] = 3, ["6"] = 4, ["7"] = 5, ["8"] = 6, ["9"] = 7,
            ["10"] = 8, ["jack"] = 9, ["queen"] = 10, ["king"] = 11, ["ace"] = 12
        };
        hand.Sort((a, b) =>
        {
            var so = suitOrder.GetValueOrDefault(a.Suit, 0).CompareTo(suitOrder.GetValueOrDefault(b.Suit, 0));
            if (so != 0) return so;
            return rankOrder.GetValueOrDefault(a.Rank, 0).CompareTo(rankOrder.GetValueOrDefault(b.Rank, 0));
        });
    }
}

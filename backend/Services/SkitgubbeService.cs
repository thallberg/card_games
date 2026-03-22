using System.Text.Json;
using System.Text.Json.Nodes;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class SkitgubbeService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private const int HandSizePhase1 = 3;
    private static readonly string[] Suits = { "hearts", "diamonds", "clubs", "spades" };
    private static readonly string[] Ranks = { "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king", "ace" };

    private readonly ApplicationDbContext _db;

    public SkitgubbeService(ApplicationDbContext db) => _db = db;

    public async Task<(bool Ok, string? Error)> CreateInitialStateAsync(Guid sessionId)
    {
        try
        {
            return await CreateInitialStateCoreAsync(sessionId);
        }
        catch (Exception ex)
        {
            var msg = ex.Message;
            var inner = ex.InnerException;
            while (inner != null) { msg += " | " + inner.Message; inner = inner.InnerException; }
            return (false, msg);
        }
    }

    private async Task<(bool Ok, string? Error)> CreateInitialStateCoreAsync(Guid sessionId)
    {
        var session = await _db.GameSessions
            .Include(g => g.Players)
            .FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (false, "Sessionen hittades inte.");
        if (session.GameType != GameType.Skitgubbe) return (false, "Inte ett Skitgubbe-spel.");
        if (session.Players.Count < 2) return (false, "Minst 2 spelare krävs.");
        if (session.Players.Count > 6) return (false, "Skitgubbe stöder max 6 spelare.");

        var numPlayers = Math.Clamp(session.Players.Count, 2, 6);
        var ordered = session.Players.OrderBy(p => p.SeatOrder).Select(p => p.UserId).Take(numPlayers).ToList();
        var playerIds = Enumerable.Range(1, numPlayers).Select(i => $"p{i}").ToArray();

        var deck = CreateAndShuffleDeck();
        var playerHands = new Dictionary<string, List<CardDto>>();
        var idx = 0;
        foreach (var pid in playerIds)
        {
            var hand = deck.Skip(idx).Take(HandSizePhase1).Select(c => new CardDto { Suit = c.Suit, Rank = c.Rank }).ToList();
            playerHands[pid] = hand;
            idx += HandSizePhase1;
        }
        var stock = deck.Skip(HandSizePhase1 * numPlayers).Select(c => new CardDto { Suit = c.Suit, Rank = c.Rank }).ToList();
        var sticksWon = playerIds.ToDictionary(p => p, _ => 0);
        var wonCards = playerIds.ToDictionary(p => p, _ => new List<CardDto>());

        var state = new SkitgubbeStateDto
        {
            Phase = "sticks",
            NumPlayers = numPlayers,
            PlayerIds = playerIds,
            Stock = stock,
            PlayerHands = playerHands,
            CurrentPlayerId = "p1",
            SticksWon = sticksWon,
            WonCards = wonCards,
        };

        var stateJson = JsonSerializer.Serialize(state, JsonOptions);
        var playerOrderJson = JsonSerializer.Serialize(ordered.Select(g => g.ToString()).ToList());

        _db.SkitgubbeStates.Add(new SkitgubbeState
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
        var row = await _db.SkitgubbeStates.FirstOrDefaultAsync(s => s.GameSessionId == sessionId);
        if (row == null) return (null, null);
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < 2) return (null, null);

        string? myPlayerId = null;
        for (int i = 0; i < Math.Min(playerOrder.Count, 6); i++)
        {
            if (Guid.TryParse(playerOrder[i], out var g) && userId == g)
            {
                myPlayerId = i < 6 ? $"p{i + 1}" : $"p{i + 1}";
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
                else if (prop.Name == "wonCards" && prop.Value.ValueKind == JsonValueKind.Object)
                {
                    writer.WritePropertyName("wonCards");
                    writer.WriteStartObject();
                    foreach (var w in prop.Value.EnumerateObject())
                    {
                        writer.WritePropertyName(w.Name);
                        if (w.Name != myPlayerId && w.Value.ValueKind == JsonValueKind.Array)
                        {
                            var len = w.Value.GetArrayLength();
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
                            w.Value.WriteTo(writer);
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

    public async Task<(bool Ok, string? Error)> ApplyActionAsync(Guid sessionId, Guid userId, SkitgubbeActionRequest request)
    {
        var row = await _db.SkitgubbeStates.FirstOrDefaultAsync(s => s.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet hittades inte.");
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < 2) return (false, "Ogiltig spelarordning.");

        string? myPlayerId = null;
        for (int i = 0; i < Math.Min(playerOrder.Count, 6); i++)
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
        for (int i = 0; i < Math.Min(playerOrder.Count, 6); i++)
        {
            var pid = $"p{i + 1}";
            if (pid != myPlayerId) otherIds.Add(pid);
        }
        var merged = MergeState(clientDoc.RootElement, dbDoc.RootElement, myPlayerId, otherIds);
        row.StateJson = RepairStickTurnFromAuthoritativeHands(merged);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>
    /// Efter merge har alla händer korrekta kort, men currentPlayerId/playersMustPlay kan ha beräknats
    /// på klienten med maskerade motståndarhänder. Justera stick-fasen så nästa spelare stämmer.
    /// </summary>
    private static string RepairStickTurnFromAuthoritativeHands(string mergedJson)
    {
        JsonNode? root;
        try
        {
            root = JsonNode.Parse(mergedJson);
        }
        catch
        {
            return mergedJson;
        }

        if (root is not JsonObject o)
            return mergedJson;
        if (!string.Equals(o["phase"]?.GetValue<string>(), "sticks", StringComparison.OrdinalIgnoreCase))
            return mergedJson;

        var show = o["stickShowingWinner"]?.GetValue<string>();
        if (!string.IsNullOrEmpty(show))
            return mergedJson;

        var fighters = o["stickFighters"] as JsonArray;
        if (fighters != null && fighters.Count > 0)
            return mergedJson;

        var table = o["tableStick"] as JsonArray;
        if (table == null || table.Count == 0)
            return mergedJson;

        var hands = o["playerHands"] as JsonObject;
        var playerIds = o["playerIds"] as JsonArray;
        if (hands == null || playerIds == null)
            return mergedJson;

        var ledRank = o["stickLedRank"]?.GetValue<string>();
        if (string.IsNullOrEmpty(ledRank))
        {
            var first = table[0]?["card"]?["rank"]?.GetValue<string>();
            if (string.IsNullOrEmpty(first))
                return mergedJson;
            ledRank = first;
        }

        bool HandHasRank(string pid, string rank) =>
            hands[pid] is JsonArray ha && ha.Any(c => string.Equals(c?["rank"]?.GetValue<string>(), rank, StringComparison.Ordinal));

        var played = new HashSet<string>();
        foreach (var entry in table)
        {
            var pid = entry?["playerId"]?.GetValue<string>();
            if (!string.IsNullOrEmpty(pid))
                played.Add(pid);
        }

        var orderedPids = playerIds.Select(n => n!.GetValue<string>()).ToList();

        string? next = null;
        foreach (var pid in orderedPids)
        {
            if (played.Contains(pid)) continue;
            if (HandHasRank(pid, ledRank))
            {
                next = pid;
                break;
            }
        }

        if (next == null)
        {
            var leader = table[0]?["playerId"]?.GetValue<string>();
            if (string.IsNullOrEmpty(leader))
                return mergedJson;
            var li = orderedPids.IndexOf(leader);
            if (li < 0)
                return mergedJson;
            for (var step = 1; step <= orderedPids.Count; step++)
            {
                var cand = orderedPids[(li + step) % orderedPids.Count];
                if (!played.Contains(cand))
                {
                    next = cand;
                    break;
                }
            }
        }

        if (next == null)
            return mergedJson;

        o["currentPlayerId"] = next;

        var must = new JsonArray();
        foreach (var pid in orderedPids)
        {
            if (played.Contains(pid)) continue;
            if (HandHasRank(pid, ledRank))
                must.Add(pid);
        }
        o["playersMustPlay"] = must;

        return JsonSerializer.Serialize(o, JsonOptions);
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
                else if (prop.Name == "wonCards" && prop.Value.ValueKind == JsonValueKind.Object)
                {
                    writer.WritePropertyName("wonCards");
                    writer.WriteStartObject();
                    foreach (var w in prop.Value.EnumerateObject())
                    {
                        writer.WritePropertyName(w.Name);
                        if (otherIds.Contains(w.Name) && db.TryGetProperty("wonCards", out var dbWon) && dbWon.TryGetProperty(w.Name, out var otherWon))
                            otherWon.WriteTo(writer);
                        else
                            w.Value.WriteTo(writer);
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

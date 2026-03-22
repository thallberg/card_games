using System.Text.Json;
using System.Text.Json.Nodes;
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
    private const int CardsPerQuartet = 4;

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

        var action = request.Action?.Trim().ToLowerInvariant();
        if (action == "ask")
        {
            if (string.IsNullOrEmpty(request.AskTo) || string.IsNullOrEmpty(request.AskRank))
                return (false, "askTo och askRank krävs.");
            var (ok, err, json) = TryApplyAsk(row.StateJson, myPlayerId, request.AskTo, request.AskRank);
            if (!ok || json == null) return (false, err);
            row.StateJson = json;
            row.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return (true, null);
        }

        if (action == "draw")
        {
            if (request.DrawCardIndex is not int idx)
                return (false, "drawCardIndex krävs.");
            var (ok, err, json) = TryApplyDrawFromSjon(row.StateJson, myPlayerId, idx);
            if (!ok || json == null) return (false, err);
            row.StateJson = json;
            row.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return (true, null);
        }

        return (false, "Ange action \"ask\" eller \"draw\" (klienten ska inte skicka hela state).");
    }

    private static (bool Ok, string? Error, string? NewJson) TryApplyAsk(string stateJson, string fromId, string toId, string rank)
    {
        JsonNode? root;
        try
        {
            root = JsonNode.Parse(stateJson);
        }
        catch
        {
            return (false, "Ogiltig state.", null);
        }

        if (root is not JsonObject o)
            return (false, "Ogiltig state.", null);

        if (o["phase"]?.GetValue<string>() != "play")
            return (false, "Fel fas.", null);
        if (o["currentPlayerId"]?.GetValue<string>() != fromId)
            return (false, "Inte din tur.", null);

        var fromHand = o["playerHands"]?[fromId] as JsonArray;
        if (fromHand == null)
            return (false, "Saknar hand.", null);

        var fromHasRank = fromHand.Any(c => string.Equals(c?["rank"]?.GetValue<string>(), rank, StringComparison.Ordinal));
        if (!fromHasRank)
            return (false, "Du har inte den valören.", null);

        var toHand = o["playerHands"]?[toId] as JsonArray;
        if (toHand == null)
            return (false, "Motspelaren saknas.", null);

        var keepTo = new JsonArray();
        var matching = new List<JsonNode>();
        foreach (var item in toHand)
        {
            if (string.Equals(item?["rank"]?.GetValue<string>(), rank, StringComparison.Ordinal))
                matching.Add(item!);
            else
                keepTo.Add(item!);
        }

        o["playerHands"]![toId] = keepTo;

        o["lastAsk"] = new JsonObject
        {
            ["from"] = fromId,
            ["to"] = toId,
            ["rank"] = rank,
        };

        if (matching.Count > 0)
        {
            foreach (var m in matching)
                fromHand.Add(m.DeepClone());
            SortFinnsisjonHand(fromHand);
            PullQuartetsFromHand(o, fromId);
            o["lastWasFinnsISjon"] = false;
        }
        else
            o["lastWasFinnsISjon"] = true;

        ApplyGameOverIfNeeded(o);
        return (true, null, JsonSerializer.Serialize(o, JsonOptions));
    }

    private static (bool Ok, string? Error, string? NewJson) TryApplyDrawFromSjon(string stateJson, string playerId, int cardIndex)
    {
        JsonNode? root;
        try
        {
            root = JsonNode.Parse(stateJson);
        }
        catch
        {
            return (false, "Ogiltig state.", null);
        }

        if (root is not JsonObject o)
            return (false, "Ogiltig state.", null);

        if (o["phase"]?.GetValue<string>() != "play")
            return (false, "Fel fas.", null);
        if (o["currentPlayerId"]?.GetValue<string>() != playerId)
            return (false, "Inte din tur.", null);
        if (o["lastWasFinnsISjon"]?.GetValue<bool>() != true)
            return (false, "Du ska inte dra från sjön.", null);

        var sjön = o["sjön"] as JsonArray;
        if (sjön == null || cardIndex < 0 || cardIndex >= sjön.Count)
            return (false, "Ogiltigt kortindex.", null);

        var drawn = sjön[cardIndex]!.DeepClone();
        sjön.RemoveAt(cardIndex);

        var hand = o["playerHands"]?[playerId] as JsonArray;
        if (hand == null)
            return (false, "Saknar hand.", null);
        hand.Add(drawn);
        SortFinnsisjonHand(hand);
        PullQuartetsFromHand(o, playerId);

        var pids = o["playerIds"] as JsonArray;
        if (pids == null)
            return (false, "Saknar playerIds.", null);
        o["currentPlayerId"] = GetNextPlayerId(pids, playerId);
        o["lastWasFinnsISjon"] = false;

        ApplyGameOverIfNeeded(o);
        return (true, null, JsonSerializer.Serialize(o, JsonOptions));
    }

    private static string GetNextPlayerId(JsonArray playerIds, string current)
    {
        var list = playerIds.Select(n => n!.GetValue<string>()).ToList();
        var i = list.IndexOf(current);
        if (i < 0) return current;
        return list[(i + 1) % list.Count];
    }

    private static void SortFinnsisjonHand(JsonArray hand)
    {
        var suitOrder = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["hearts"] = 0, ["clubs"] = 1, ["diamonds"] = 2, ["spades"] = 3,
        };
        var rankOrder = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["2"] = 0, ["3"] = 1, ["4"] = 2, ["5"] = 3, ["6"] = 4, ["7"] = 5, ["8"] = 6, ["9"] = 7,
            ["10"] = 8, ["jack"] = 9, ["queen"] = 10, ["king"] = 11, ["ace"] = 12,
        };
        var items = hand.ToList();
        hand.Clear();
        foreach (var c in items.OrderBy(x => suitOrder.GetValueOrDefault(x?["suit"]?.GetValue<string>() ?? "", 99))
                     .ThenBy(x => rankOrder.GetValueOrDefault(x?["rank"]?.GetValue<string>() ?? "", 99)))
            hand.Add(c);
    }

    private static void PullQuartetsFromHand(JsonObject state, string playerId)
    {
        var hand = state["playerHands"]?[playerId] as JsonArray;
        if (hand == null) return;

        var byRank = new Dictionary<string, List<JsonNode>>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in hand.ToList())
        {
            var r = c?["rank"]?.GetValue<string>() ?? "";
            if (!byRank.ContainsKey(r))
                byRank[r] = [];
            byRank[r].Add(c!);
        }

        var newQuartets = 0;
        var newHand = new JsonArray();
        foreach (var (_, cards) in byRank)
        {
            if (cards.Count == CardsPerQuartet)
                newQuartets++;
            else
            {
                foreach (var c in cards)
                    newHand.Add(c);
            }
        }

        state["playerHands"]![playerId] = newHand;
        SortFinnsisjonHand(newHand);

        var qw = state["quartetsWon"] as JsonObject;
        if (qw != null)
        {
            var cur = qw[playerId]?.GetValue<int>() ?? 0;
            qw[playerId] = cur + newQuartets;
        }
    }

    private static void ApplyGameOverIfNeeded(JsonObject o)
    {
        var sjön = o["sjön"] as JsonArray;
        if (sjön == null || sjön.Count > 0) return;

        var ph = o["playerHands"] as JsonObject;
        if (ph == null) return;
        foreach (var prop in ph)
        {
            if (prop.Value is JsonArray h && h.Count > 0)
                return;
        }

        var qw = o["quartetsWon"] as JsonObject;
        if (qw == null)
        {
            o["phase"] = "gameOver";
            o["winnerId"] = null;
            return;
        }

        var scores = qw.Select(p => (p.Key, p.Value?.GetValue<int>() ?? 0)).ToList();
        var max = scores.Max(s => s.Item2);
        var winners = scores.Where(s => s.Item2 == max).Select(s => s.Key).ToList();
        o["phase"] = "gameOver";
        o["winnerId"] = winners.Count == 1 ? winners[0] : null;
    }
}

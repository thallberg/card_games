using System.Text.Json;
using System.Text.Json.Nodes;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class TexasHoldemService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private const int DefaultBuyIn = 2000;
    private const int DefaultBigBlind = 20;

    private readonly ApplicationDbContext _db;

    public TexasHoldemService(ApplicationDbContext db) => _db = db;

    public async Task<(bool Ok, string? Error)> CreateInitialStateAsync(Guid sessionId, int? buyIn = null, int? bigBlind = null)
    {
        var session = await _db.GameSessions
            .Include(g => g.Players).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (false, "Sessionen hittades inte.");
        if (session.GameType != GameType.TexasHoldem) return (false, "Inte ett Texas Hold'em-spel.");
        if (session.Players.Count < 2) return (false, "Minst 2 spelare krävs.");

        var ordered = session.Players.OrderBy(p => p.SeatOrder).Take(6).ToList();
        var numPlayers = ordered.Count;
        var actualBuyIn = buyIn ?? DefaultBuyIn;
        var actualBigBlind = bigBlind ?? DefaultBigBlind;
        var smallBlind = actualBigBlind / 2;
        var deck = CreateAndShuffleDeck();
        int sbIndex = numPlayers == 2 ? 0 : 1;
        int bbIndex = numPlayers == 2 ? 1 : 2;
        // Match frontend: blinds sit in betThisHand; pot stays 0 until betting round advances (getTotalPot).
        int pot = 0;

        var holeCardsArray = new JsonArray();
        for (int i = 0; i < numPlayers; i++)
        {
            var c1 = deck[deck.Count - 1]; deck.RemoveAt(deck.Count - 1);
            var c2 = deck[deck.Count - 1]; deck.RemoveAt(deck.Count - 1);
            holeCardsArray.Add(new JsonArray
            {
                new JsonObject { ["suit"] = c1.Suit, ["rank"] = c1.Rank },
                new JsonObject { ["suit"] = c2.Suit, ["rank"] = c2.Rank },
            });
        }

        var seatsArray = new JsonArray();
        for (int i = 0; i < numPlayers; i++)
        {
            var seatPlayer = ordered[i];
            var displayName = string.IsNullOrWhiteSpace(seatPlayer.User?.DisplayName)
                ? $"Spelare {i + 1}"
                : seatPlayer.User!.DisplayName.Trim();
            int stack = actualBuyIn;
            int betThisHand = 0;
            bool actedThisRound = false;
            if (i == sbIndex) { var post = Math.Min(smallBlind, stack); stack -= post; betThisHand = post; actedThisRound = true; }
            else if (i == bbIndex) { var post = Math.Min(actualBigBlind, stack); stack -= post; betThisHand = post; actedThisRound = true; }
            seatsArray.Add(new JsonObject
            {
                ["id"] = $"p{i + 1}",
                ["name"] = displayName,
                ["stack"] = stack,
                ["betThisHand"] = betThisHand,
                ["actedThisRound"] = actedThisRound,
                ["folded"] = false,
                ["isAllIn"] = stack <= 0,
                ["seatIndex"] = i,
            });
        }

        int currentActorIndex = numPlayers == 2 ? 0 : 2;
        var activeInHandArray = new JsonArray();
        for (int i = 0; i < numPlayers; i++) activeInHandArray.Add(i);

        var deckArray = new JsonArray();
        foreach (var c in deck)
            deckArray.Add(new JsonObject { ["suit"] = c.Suit, ["rank"] = c.Rank });

        var state = new JsonObject
        {
            ["phase"] = "playing",
            ["seats"] = seatsArray,
            ["numPlayers"] = numPlayers,
            ["buyIn"] = actualBuyIn,
            ["bigBlind"] = actualBigBlind,
            ["smallBlind"] = smallBlind,
            ["dealerIndex"] = 0,
            ["currentActorIndex"] = currentActorIndex,
            ["bettingPhase"] = "preflop",
            ["board"] = new JsonArray(),
            ["holeCards"] = holeCardsArray,
            ["deck"] = deckArray,
            ["pot"] = pot,
            ["currentBet"] = actualBigBlind,
            ["minRaise"] = actualBigBlind,
            ["lastHandWinnerIndex"] = null,
            ["activeInHand"] = activeInHandArray,
        };

        var stateJson = JsonSerializer.Serialize(state, JsonOptions);
        _db.TexasHoldemStates.Add(new TexasHoldemState
        {
            GameSessionId = sessionId,
            StateJson = stateJson,
            UpdatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(string? StateJson, int? MySeatIndex)> GetStateForUserAsync(Guid sessionId, Guid userId)
    {
        var session = await _db.GameSessions.Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (null, null);
        var ordered = session.Players.OrderBy(p => p.SeatOrder).ToList();
        var mySeatIndex = ordered.FindIndex(p => p.UserId == userId);
        if (mySeatIndex < 0) return (null, null);

        var row = await _db.TexasHoldemStates.FirstOrDefaultAsync(t => t.GameSessionId == sessionId);
        if (row == null) return (null, null);

        using var doc = JsonDocument.Parse(row.StateJson);
        var root = doc.RootElement;
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
        {
            writer.WriteStartObject();
            foreach (var prop in root.EnumerateObject())
            {
                writer.WritePropertyName(prop.Name);
                if (prop.Name == "holeCards" && prop.Value.ValueKind == JsonValueKind.Array)
                {
                    writer.WriteStartArray();
                    for (int i = 0; i < prop.Value.GetArrayLength(); i++)
                    {
                        if (i == mySeatIndex)
                            prop.Value[i].WriteTo(writer);
                        else
                        {
                            writer.WriteStartArray();
                            writer.WriteEndArray();
                        }
                    }
                    writer.WriteEndArray();
                }
                else
                    prop.Value.WriteTo(writer);
            }
            writer.WriteEndObject();
            await writer.FlushAsync();
        }
        stream.Position = 0;
        var stateJson = await new StreamReader(stream).ReadToEndAsync();
        return (stateJson, mySeatIndex);
    }

    /// <summary>Apply action: client sends updated state. Server merges with existing state so other players' hole cards are preserved. Runs server-side showdown when phase=handOver. Returns corrected state JSON.</summary>
    public async Task<(bool Ok, string? Error, string? StateJson)> ApplyActionAsync(Guid sessionId, Guid userId, TexasHoldemActionRequest request)
    {
        var session = await _db.GameSessions.Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (false, "Sessionen hittades inte.", null);
        if (session.Players.All(p => p.UserId != userId)) return (false, "Du är inte med i spelet.", null);

        var row = await _db.TexasHoldemStates.FirstOrDefaultAsync(t => t.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet har inte startat.", null);

        if (request.Action == "saveState" && request.StateJson != null)
        {
            var ordered = session.Players.OrderBy(p => p.SeatOrder).ToList();
            var mySeatIndex = ordered.FindIndex(p => p.UserId == userId);
            if (mySeatIndex < 0) return (false, "Du är inte med i spelet.", null);

            using var serverDoc = JsonDocument.Parse(row.StateJson);
            var serverRoot = serverDoc.RootElement;
            using var clientDoc = JsonDocument.Parse(request.StateJson);
            var clientRoot = clientDoc.RootElement;

            using var outStream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(outStream, new JsonWriterOptions { Indented = false }))
            {
                writer.WriteStartObject();
                foreach (var prop in clientRoot.EnumerateObject())
                {
                    writer.WritePropertyName(prop.Name);
                    if (prop.Name == "holeCards" && prop.Value.ValueKind == JsonValueKind.Array && serverRoot.TryGetProperty("holeCards", out var serverHoleCards))
                    {
                        writer.WriteStartArray();
                        for (int i = 0; i < prop.Value.GetArrayLength(); i++)
                        {
                            var clientArr = prop.Value[i];
                            var useClient = i == mySeatIndex;
                            if (useClient)
                                clientArr.WriteTo(writer);
                            else if (i < serverHoleCards.GetArrayLength())
                                serverHoleCards[i].WriteTo(writer);
                            else
                                writer.WriteStartArray();
                            if (!useClient && i >= serverHoleCards.GetArrayLength())
                                writer.WriteEndArray();
                        }
                        writer.WriteEndArray();
                    }
                    else
                        prop.Value.WriteTo(writer);
                }
                writer.WriteEndObject();
                await writer.FlushAsync();
            }
            outStream.Position = 0;
            var mergedJson = await new StreamReader(outStream).ReadToEndAsync();

            var merged = JsonNode.Parse(mergedJson);
            if (merged != null && merged["phase"]?.GetValue<string>() == "handOver")
            {
                var winner = ResolveShowdown(merged);
                if (winner != null)
                    merged["lastHandWinnerIndex"] = winner.Value;
            }

            row.StateJson = merged?.ToJsonString() ?? mergedJson;
            row.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            // Vid handOver visas alla kort (showdown). Annars maskera andra spelares hole cards.
            var stateToReturn = merged?["phase"]?.GetValue<string>() == "handOver"
                ? row.StateJson
                : MaskStateForUser(row.StateJson, mySeatIndex);
            return (true, null, stateToReturn);
        }
        return (false, "Ogiltig action.", null);
    }

    private static string? MaskStateForUser(string stateJson, int mySeatIndex)
    {
        try
        {
            using var doc = JsonDocument.Parse(stateJson);
            var root = doc.RootElement;
            using var stream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
            {
                writer.WriteStartObject();
                foreach (var prop in root.EnumerateObject())
                {
                    writer.WritePropertyName(prop.Name);
                    if (prop.Name == "holeCards" && prop.Value.ValueKind == JsonValueKind.Array)
                    {
                        writer.WriteStartArray();
                        for (int i = 0; i < prop.Value.GetArrayLength(); i++)
                        {
                            if (i == mySeatIndex)
                                prop.Value[i].WriteTo(writer);
                            else
                            {
                                writer.WriteStartArray();
                                writer.WriteEndArray();
                            }
                        }
                        writer.WriteEndArray();
                    }
                    else
                        prop.Value.WriteTo(writer);
                }
                writer.WriteEndObject();
                writer.Flush();
            }
            stream.Position = 0;
            return new StreamReader(stream).ReadToEnd();
        }
        catch { return stateJson; }
    }

    /// <summary>Runs showdown with full hole cards (server has them) and returns correct winner seat index.</summary>
    private static int? ResolveShowdown(JsonNode state)
    {
        var holeCards = state["holeCards"] as JsonArray;
        var board = state["board"] as JsonArray;
        var seats = state["seats"] as JsonArray;
        var activeInHand = state["activeInHand"] as JsonArray;
        if (holeCards == null || board == null || seats == null || activeInHand == null) return null;
        if (board.Count < 5) return null;

        var boardEl = JsonDocument.Parse(board.ToJsonString()).RootElement;
        var folded = new HashSet<int>();
        for (int i = 0; i < seats.Count; i++)
        {
            var s = seats[i] as JsonObject;
            if (s?["folded"]?.GetValue<bool>() == true) folded.Add(i);
        }

        var active = activeInHand.Select(e => e?.GetValue<int>() ?? -1).Where(i => i >= 0 && !folded.Contains(i)).ToList();
        if (active.Count == 0) return null;
        if (active.Count == 1) return active[0];

        int? bestIndex = null;
        string? bestRank = null;
        List<int>? bestValues = null;

        foreach (var seatIdx in active)
        {
            if (seatIdx >= holeCards.Count) continue;
            var hc = holeCards[seatIdx];
            if (hc == null) continue;
            var hcEl = hc as JsonArray;
            JsonElement hcDoc;
            try
            {
                hcDoc = JsonDocument.Parse(hc?.ToJsonString() ?? "[]").RootElement;
            }
            catch { continue; }
            if (hcDoc.ValueKind != JsonValueKind.Array || hcDoc.GetArrayLength() < 2) continue;

            var (rank, values) = TexasHoldemHandRanking.BestHand(hcDoc, boardEl);
            if (bestIndex == null || TexasHoldemHandRanking.CompareHands(rank, values, bestRank!, bestValues!) > 0)
            {
                bestIndex = seatIdx;
                bestRank = rank;
                bestValues = values;
            }
        }
        return bestIndex;
    }

    private static List<CardModel> CreateAndShuffleDeck()
    {
        var suits = new[] { "hearts", "diamonds", "clubs", "spades" };
        var ranks = new[] { "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king", "ace" };
        var deck = new List<CardModel>();
        foreach (var s in suits)
            foreach (var r in ranks)
                deck.Add(new CardModel(s, r));
        var rnd = new Random();
        for (int i = deck.Count - 1; i > 0; i--)
        {
            int j = rnd.Next(i + 1);
            (deck[i], deck[j]) = (deck[j], deck[i]);
        }
        return deck;
    }

    private record CardModel(string Suit, string Rank);
}

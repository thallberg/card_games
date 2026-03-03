using System.Text.Json;
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

    public async Task<(bool Ok, string? Error)> CreateInitialStateAsync(Guid sessionId)
    {
        var session = await _db.GameSessions
            .Include(g => g.Players).ThenInclude(p => p.User)
            .FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (false, "Sessionen hittades inte.");
        if (session.GameType != GameType.TexasHoldem) return (false, "Inte ett Texas Hold'em-spel.");
        if (session.Players.Count < 2) return (false, "Minst 2 spelare krävs.");

        var ordered = session.Players.OrderBy(p => p.SeatOrder).Take(6).ToList();
        var numPlayers = ordered.Count;
        var smallBlind = DefaultBigBlind / 2;
        var deck = CreateAndShuffleDeck();
        var holeCards = new List<List<object>>();
        for (int i = 0; i < numPlayers; i++)
        {
            var c1 = deck[deck.Count - 1]; deck.RemoveAt(deck.Count - 1);
            var c2 = deck[deck.Count - 1]; deck.RemoveAt(deck.Count - 1);
            holeCards.Add(new List<object> { new { suit = c1.Suit, rank = c1.Rank }, new { suit = c2.Suit, rank = c2.Rank } });
        }
        var seats = new List<object>();
        int sbIndex = numPlayers == 2 ? 0 : 1;
        int bbIndex = numPlayers == 2 ? 1 : 2;
        int pot = 0;
        for (int i = 0; i < numPlayers; i++)
        {
            var displayName = ordered[i].User?.DisplayName ?? $"Spelare {i + 1}";
            int stack = DefaultBuyIn;
            int betThisHand = 0;
            bool actedThisRound = false;
            if (i == sbIndex) { var post = Math.Min(smallBlind, stack); stack -= post; betThisHand = post; actedThisRound = true; pot += post; }
            else if (i == bbIndex) { var post = Math.Min(DefaultBigBlind, stack); stack -= post; betThisHand = post; actedThisRound = true; pot += post; }
            seats.Add(new
            {
                id = $"p{i + 1}",
                name = displayName,
                stack,
                betThisHand,
                actedThisRound,
                folded = false,
                isAllIn = stack <= 0,
                seatIndex = i,
            });
        }
        int currentActorIndex = numPlayers == 2 ? 0 : 2;
        var activeInHand = Enumerable.Range(0, numPlayers).ToList();
        var board = new List<object>();
        var deckJson = deck.Select(c => new { suit = c.Suit, rank = c.Rank }).ToList();

        var state = new Dictionary<string, object?>
        {
            ["phase"] = "playing",
            ["seats"] = seats,
            ["numPlayers"] = numPlayers,
            ["buyIn"] = DefaultBuyIn,
            ["bigBlind"] = DefaultBigBlind,
            ["smallBlind"] = smallBlind,
            ["dealerIndex"] = 0,
            ["currentActorIndex"] = currentActorIndex,
            ["bettingPhase"] = "preflop",
            ["board"] = board,
            ["holeCards"] = holeCards,
            ["deck"] = deckJson,
            ["pot"] = pot,
            ["currentBet"] = DefaultBigBlind,
            ["minRaise"] = DefaultBigBlind,
            ["lastHandWinnerIndex"] = null,
            ["activeInHand"] = activeInHand,
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

    /// <summary>Apply action: client sends updated state. Server merges with existing state so other players' hole cards are preserved.</summary>
    public async Task<(bool Ok, string? Error)> ApplyActionAsync(Guid sessionId, Guid userId, TexasHoldemActionRequest request)
    {
        var session = await _db.GameSessions.Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (false, "Sessionen hittades inte.");
        if (session.Players.All(p => p.UserId != userId)) return (false, "Du är inte med i spelet.");

        var row = await _db.TexasHoldemStates.FirstOrDefaultAsync(t => t.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet har inte startat.");

        if (request.Action == "saveState" && request.StateJson != null)
        {
            var ordered = session.Players.OrderBy(p => p.SeatOrder).ToList();
            var mySeatIndex = ordered.FindIndex(p => p.UserId == userId);
            if (mySeatIndex < 0) return (false, "Du är inte med i spelet.");

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
            row.StateJson = await new StreamReader(outStream).ReadToEndAsync();
            row.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return (true, null);
        }
        return (false, "Ogiltig action.");
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

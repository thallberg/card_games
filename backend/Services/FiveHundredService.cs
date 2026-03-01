using System.Text.Json;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class FiveHundredService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private const int HandSize = 7;
    private const string P1 = "p1";
    private const string P2 = "p2";
    private static readonly string[] PlayerIds = { P1, P2 };

    private readonly ApplicationDbContext _db;

    public FiveHundredService(ApplicationDbContext db) => _db = db;

    /// <summary>Skapar initial 500-state när spelet startas. Anropas från GameSessionService eller endpoint.</summary>
    public async Task<(bool Ok, string? Error)> CreateInitialStateAsync(Guid sessionId)
    {
        var session = await _db.GameSessions
            .Include(g => g.Players)
            .FirstOrDefaultAsync(g => g.Id == sessionId);
        if (session == null) return (false, "Sessionen hittades inte.");
        if (session.GameType != GameType.FiveHundred) return (false, "Inte ett 500-spel.");
        if (session.Players.Count < 2) return (false, "Minst 2 spelare krävs.");

        var ordered = session.Players.OrderBy(p => p.SeatOrder).Select(p => p.UserId).Take(2).ToList();
        if (ordered.Count < 2) return (false, "Behöver exakt 2 spelare för 500.");

        var deck = CreateAndShuffleDeck();
        var hands = new Dictionary<string, List<CardDto>>
        {
            [P1] = deck.Take(HandSize).ToList(),
            [P2] = deck.Skip(HandSize).Take(HandSize).ToList(),
        };
        var stock = deck.Skip(HandSize * 2).ToList();
        var discard = stock.Count > 0 ? new List<CardDto> { stock[^1] } : new List<CardDto>();
        if (stock.Count > 0) stock.RemoveAt(stock.Count - 1);

        var state = new FiveHundredStateDto
        {
            Stock = stock,
            Discard = discard,
            Melds = new List<MeldDto>(),
            CurrentPlayerId = P1,
            PlayerHands = hands,
            PlayerScores = new Dictionary<string, int> { [P1] = 0, [P2] = 0 },
            Phase = "draw",
            LastDraw = null,
            RoundNumber = 1,
            WinnerId = null,
        };

        var stateJson = JsonSerializer.Serialize(state, JsonOptions);
        var playerOrderJson = JsonSerializer.Serialize(ordered.Select(g => g.ToString()).ToList());
        _db.FiveHundredStates.Add(new FiveHundredState
        {
            GameSessionId = sessionId,
            StateJson = stateJson,
            PlayerOrderJson = playerOrderJson,
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>Startar nästa rond när phase är roundEnd. Ny kortlek, ny giv, behåller poäng.</summary>
    public async Task<(bool Ok, string? Error)> StartNewRoundAsync(Guid sessionId)
    {
        var row = await _db.FiveHundredStates.FirstOrDefaultAsync(f => f.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet hittades inte.");
        var state = JsonSerializer.Deserialize<FiveHundredStateDto>(row.StateJson, JsonOptions);
        if (state == null) return (false, "Ogiltig state.");
        if (state.Phase != "roundEnd") return (false, "Runden är inte avslutad.");

        var deck = CreateAndShuffleDeck();
        var hands = new Dictionary<string, List<CardDto>>
        {
            [P1] = deck.Take(HandSize).ToList(),
            [P2] = deck.Skip(HandSize).Take(HandSize).ToList(),
        };
        var stock = deck.Skip(HandSize * 2).ToList();
        var discard = stock.Count > 0 ? new List<CardDto> { stock[^1] } : new List<CardDto>();
        if (stock.Count > 0) stock.RemoveAt(stock.Count - 1);

        state.Stock = stock;
        state.Discard = discard;
        state.Melds = new List<MeldDto>();
        state.CurrentPlayerId = P1;
        state.PlayerHands = hands;
        state.Phase = "draw";
        state.LastDraw = null;
        state.WinnerId = null;
        state.RoundNumber = state.RoundNumber + 1;

        row.StateJson = JsonSerializer.Serialize(state, JsonOptions);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>Returns state with other players' hands masked. Response includes _myPlayerId for frontend.</summary>
    public async Task<(FiveHundredStateDto? State, string? MyPlayerId)> GetStateForUserAsync(Guid sessionId, Guid userId)
    {
        var row = await _db.FiveHundredStates.FirstOrDefaultAsync(f => f.GameSessionId == sessionId);
        if (row == null) return (null, null);
        var state = JsonSerializer.Deserialize<FiveHundredStateDto>(row.StateJson, JsonOptions);
        if (state == null) return (null, null);
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < 2) return (null, null);
        var myPlayerId = userId.ToString() == playerOrder[0] ? P1 : (userId.ToString() == playerOrder[1] ? P2 : null);
        if (myPlayerId == null) return (null, null);
        var masked = new Dictionary<string, List<CardDto>>();
        foreach (var kv in state.PlayerHands)
        {
            masked[kv.Key] = kv.Key == myPlayerId ? kv.Value : kv.Value.Select(_ => new CardDto { Suit = "?", Rank = "?" }).ToList();
        }
        state.PlayerHands = masked;
        return (state, myPlayerId);
    }

    public async Task<(bool Ok, string? Error, FiveHundredStateDto? NewState)> ApplyActionAsync(Guid sessionId, Guid userId, FiveHundredActionRequest action)
    {
        var row = await _db.FiveHundredStates.FirstOrDefaultAsync(f => f.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet hittades inte.", null);
        var state = JsonSerializer.Deserialize<FiveHundredStateDto>(row.StateJson, JsonOptions);
        if (state == null) return (false, "Ogiltig state.", null);
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < 2) return (false, "Ogiltig spelarordning.", null);
        var myPlayerId = userId.ToString() == playerOrder[0] ? P1 : (userId.ToString() == playerOrder[1] ? P2 : null);
        if (myPlayerId == null) return (false, "Du är inte med i detta spel.", null);
        if (state.CurrentPlayerId != myPlayerId) return (false, "Det är inte din tur.", null);

        var err = ApplyAction(state, myPlayerId, action);
        if (err != null) return (false, err, null);

        row.StateJson = JsonSerializer.Serialize(state, JsonOptions);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        var (masked, _) = await GetStateForUserAsync(sessionId, userId);
        return (true, null, masked);
    }

    private static string? ApplyAction(FiveHundredStateDto s, string playerId, FiveHundredActionRequest a)
    {
        switch (a.Action?.ToLowerInvariant())
        {
            case "skipdraw":
                if (s.Phase != "draw" || s.Stock.Count != 0) return "Ogiltigt drag.";
                s.Phase = "meldOrDiscard";
                s.LastDraw = null;
                return null;
            case "drawfromstock":
                if (s.Phase != "draw" || s.Stock.Count == 0) return "Ogiltigt drag.";
                var card = s.Stock[^1];
                s.Stock.RemoveAt(s.Stock.Count - 1);
                s.PlayerHands[playerId].Add(card);
                s.Phase = "meldOrDiscard";
                s.LastDraw = "stock";
                return null;
            case "takediscard":
                if (s.Phase != "draw" || s.Discard.Count == 0) return "Ogiltigt drag.";
                s.PlayerHands[playerId].AddRange(s.Discard);
                s.Discard.Clear();
                s.Phase = "meldOrDiscard";
                s.LastDraw = "discard";
                return null;
            case "discard":
                if (s.Phase != "meldOrDiscard" || a.CardIndex == null) return "Ogiltigt drag.";
                var discardHand = s.PlayerHands[playerId];
                if (a.CardIndex.Value < 0 || a.CardIndex.Value >= discardHand.Count) return "Ogiltigt kortindex.";
                var toDiscard = discardHand[a.CardIndex.Value];
                discardHand.RemoveAt(a.CardIndex.Value);
                s.Discard.Insert(0, toDiscard);
                if (discardHand.Count == 0)
                    EndRound(s, playerId);
                else
                    AdvanceTurn(s);
                return null;
            case "pass":
                if (s.Phase != "meldOrDiscard") return "Ogiltigt drag.";
                AdvanceTurn(s);
                return null;
            case "addmeld":
                if (s.Phase != "meldOrDiscard" || a.CardIndices == null || a.CardIndices.Count < 3) return "Ogiltigt drag.";
                var addMeldHand = s.PlayerHands[playerId];
                var indices = a.CardIndices.OrderBy(x => x).Where(i => i >= 0 && i < addMeldHand.Count).Distinct().Take(7).ToList();
                if (indices.Count < 3) return "Minst 3 kort krävs.";
                var cards = indices.Select(i => addMeldHand[i]).ToList();
                foreach (var i in indices.OrderByDescending(x => x)) addMeldHand.RemoveAt(i);
                s.Melds.Add(new MeldDto { Id = Guid.NewGuid().ToString(), Cards = cards, Type = "set" });
                return null;
            case "addcardtomeld":
                if (s.Phase != "meldOrDiscard" || string.IsNullOrEmpty(a.MeldId) || a.CardIndex == null) return "Ogiltigt drag.";
                var addToMeldHand = s.PlayerHands[playerId];
                if (a.CardIndex.Value < 0 || a.CardIndex.Value >= addToMeldHand.Count) return "Ogiltigt kortindex.";
                var meld = s.Melds.FirstOrDefault(m => m.Id == a.MeldId);
                if (meld == null) return "Meld hittades inte.";
                var addCard = addToMeldHand[a.CardIndex.Value];
                addToMeldHand.RemoveAt(a.CardIndex.Value);
                meld.Cards.Add(addCard);
                return null;
            default:
                return "Okänd åtgärd.";
        }
    }

    private static void AdvanceTurn(FiveHundredStateDto s)
    {
        s.CurrentPlayerId = s.CurrentPlayerId == P1 ? P2 : P1;
        s.Phase = "draw";
        s.LastDraw = null;
    }

    private static int GetCardPoints(string rank)
    {
        return rank switch
        {
            "ace" => 15,
            "2" => 25,
            "3" or "4" or "5" or "6" or "7" or "8" or "9" => 5,
            "10" or "jack" or "queen" or "king" => 10,
            _ => 0
        };
    }

    private const int PointsToWin = 500;

    private static void EndRound(FiveHundredStateDto s, string winnerId)
    {
        var winnerScore = s.PlayerScores.TryGetValue(winnerId, out var ws) ? ws : 0;
        foreach (var pid in PlayerIds)
        {
            if (pid == winnerId) continue;
            var oppHand = s.PlayerHands.TryGetValue(pid, out var oh) ? oh : new List<CardDto>();
            winnerScore += oppHand.Sum(c => GetCardPoints(c.Rank));
        }
        s.PlayerScores[winnerId] = winnerScore;
        s.WinnerId = winnerId;
        s.Phase = winnerScore >= PointsToWin ? "gameOver" : "roundEnd";
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
}

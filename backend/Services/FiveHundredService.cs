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
        SortHand(hands[P1]);
        SortHand(hands[P2]);
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
        SortHand(hands[P1]);
        SortHand(hands[P2]);
        var stock = deck.Skip(HandSize * 2).ToList();
        var discard = stock.Count > 0 ? new List<CardDto> { stock[^1] } : new List<CardDto>();
        if (stock.Count > 0) stock.RemoveAt(stock.Count - 1);

        state.Stock = stock;
        state.Discard = discard;
        state.Melds = new List<MeldDto>();
        state.RoundNumber = state.RoundNumber + 1;
        state.CurrentPlayerId = state.RoundNumber % 2 == 1 ? P1 : P2;
        state.PlayerHands = hands;
        state.Phase = "draw";
        state.LastDraw = null;
        state.WinnerId = null;

        row.StateJson = JsonSerializer.Serialize(state, JsonOptions);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (true, null);
    }

    /// <summary>Startar nytt spel när phase är gameOver. Samma spelare följer med – nollställda poäng, rond 1.</summary>
    public async Task<(bool Ok, string? Error)> ResetGameAsync(Guid sessionId)
    {
        var row = await _db.FiveHundredStates.FirstOrDefaultAsync(f => f.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet hittades inte.");
        var state = JsonSerializer.Deserialize<FiveHundredStateDto>(row.StateJson, JsonOptions);
        if (state == null) return (false, "Ogiltig state.");
        if (state.Phase != "gameOver") return (false, "Spelet är inte över.");

        var deck = CreateAndShuffleDeck();
        var hands = new Dictionary<string, List<CardDto>>
        {
            [P1] = deck.Take(HandSize).ToList(),
            [P2] = deck.Skip(HandSize).Take(HandSize).ToList(),
        };
        SortHand(hands[P1]);
        SortHand(hands[P2]);
        var stock = deck.Skip(HandSize * 2).ToList();
        var discard = stock.Count > 0 ? new List<CardDto> { stock[^1] } : new List<CardDto>();
        if (stock.Count > 0) stock.RemoveAt(stock.Count - 1);

        state.Stock = stock;
        state.Discard = discard;
        state.Melds = new List<MeldDto>();
        state.RoundNumber = 1;
        state.CurrentPlayerId = P1;
        state.PlayerHands = hands;
        state.PlayerScores = new Dictionary<string, int> { [P1] = 0, [P2] = 0 };
        state.Phase = "draw";
        state.LastDraw = null;
        state.WinnerId = null;

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
        var p0 = Guid.TryParse(playerOrder[0], out var g0) ? g0 : (Guid?)null;
        var p1 = Guid.TryParse(playerOrder[1], out var g1) ? g1 : (Guid?)null;
        var myPlayerId = userId == p0 ? P1 : (userId == p1 ? P2 : null);
        if (myPlayerId == null) return (null, null);
        foreach (var key in state.PlayerHands.Keys.ToList())
        {
            var list = state.PlayerHands[key];
            SortHand(list);
        }
        var masked = new Dictionary<string, List<CardDto>>();
        foreach (var kv in state.PlayerHands)
        {
            masked[kv.Key] = kv.Key == myPlayerId ? kv.Value : kv.Value.Select(_ => new CardDto { Suit = "?", Rank = "?" }).ToList();
        }
        state.PlayerHands = masked;
        return (state, myPlayerId);
    }

    public async Task<(bool Ok, string? Error, FiveHundredStateDto? NewState, CardDto? LastDrawnCard)> ApplyActionAsync(Guid sessionId, Guid userId, FiveHundredActionRequest action)
    {
        var row = await _db.FiveHundredStates.FirstOrDefaultAsync(f => f.GameSessionId == sessionId);
        if (row == null) return (false, "Spelet hittades inte.", null, null);
        var state = JsonSerializer.Deserialize<FiveHundredStateDto>(row.StateJson, JsonOptions);
        if (state == null) return (false, "Ogiltig state.", null, null);
        var playerOrder = JsonSerializer.Deserialize<List<string>>(row.PlayerOrderJson);
        if (playerOrder == null || playerOrder.Count < 2) return (false, "Ogiltig spelarordning.", null, null);
        var p0 = Guid.TryParse(playerOrder[0], out var g0) ? g0 : (Guid?)null;
        var p1 = Guid.TryParse(playerOrder[1], out var g1) ? g1 : (Guid?)null;
        var myPlayerId = userId == p0 ? P1 : (userId == p1 ? P2 : null);
        if (myPlayerId == null) return (false, "Du är inte med i detta spel.", null, null);
        if (state.CurrentPlayerId != myPlayerId) return (false, "Det är inte din tur.", null, null);

        var (err, lastDrawn) = ApplyAction(state, myPlayerId, action);
        if (err != null) return (false, err, null, null);

        row.StateJson = JsonSerializer.Serialize(state, JsonOptions);
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        var (masked, _) = await GetStateForUserAsync(sessionId, userId);
        return (true, null, masked, lastDrawn);
    }

    private static (string? Err, CardDto? LastDrawn) ApplyAction(FiveHundredStateDto s, string playerId, FiveHundredActionRequest a)
    {
        switch (a.Action?.ToLowerInvariant())
        {
            case "skipdraw":
                if (s.Phase != "draw" || s.Stock.Count != 0) return ("Ogiltigt drag.", null);
                s.Phase = "meldOrDiscard";
                s.LastDraw = null;
                return (null, null);
            case "drawfromstock":
                if (s.Phase != "draw" || s.Stock.Count == 0) return ("Ogiltigt drag.", null);
                var card = s.Stock[^1];
                s.Stock.RemoveAt(s.Stock.Count - 1);
                s.PlayerHands[playerId].Add(card);
                SortHand(s.PlayerHands[playerId]);
                s.Phase = "meldOrDiscard";
                s.LastDraw = "stock";
                return (null, card);
            case "takediscard":
                if (s.Phase != "draw" || s.Discard.Count == 0) return ("Ogiltigt drag.", null);
                var topDiscard = s.Discard[0];
                s.PlayerHands[playerId].AddRange(s.Discard);
                s.Discard.Clear();
                SortHand(s.PlayerHands[playerId]);
                s.Phase = "meldOrDiscard";
                s.LastDraw = "discard";
                return (null, topDiscard);
            case "discard":
                if (s.Phase != "meldOrDiscard" || a.CardIndex == null) return ("Ogiltigt drag.", null);
                var discardHand = s.PlayerHands[playerId];
                if (a.CardIndex.Value < 0 || a.CardIndex.Value >= discardHand.Count) return ("Ogiltigt kortindex.", null);
                var toDiscard = discardHand[a.CardIndex.Value];
                discardHand.RemoveAt(a.CardIndex.Value);
                s.Discard.Insert(0, toDiscard);
                if (s.LastDraw == "discard" && s.CardsLaidThisTurn < 3)
                    s.PlayerScores[playerId] = (s.PlayerScores.TryGetValue(playerId, out var ds) ? ds : 0) - PickupPenalty;
                if (discardHand.Count == 0)
                    EndRound(s, playerId);
                else
                    AdvanceTurn(s);
                return (null, null);
            case "pass":
                if (s.Phase != "meldOrDiscard") return ("Ogiltigt drag.", null);
                if (s.Stock != null && s.Stock.Count == 0)
                    return ("När talongen är tom måste du kasta ett kort.", null);
                if (s.LastDraw == "discard" && s.CardsLaidThisTurn < 3)
                    s.PlayerScores[playerId] = (s.PlayerScores.TryGetValue(playerId, out var ps) ? ps : 0) - PickupPenalty;
                AdvanceTurn(s);
                return (null, null);
            case "addmeld":
                if (s.Phase != "meldOrDiscard" || a.CardIndices == null || a.CardIndices.Count < 3) return ("Ogiltigt drag.", null);
                var addMeldHand = s.PlayerHands[playerId];
                var indices = a.CardIndices.OrderBy(x => x).Where(i => i >= 0 && i < addMeldHand.Count).Distinct().Take(7).ToList();
                if (indices.Count < 3) return ("Minst 3 kort krävs.", null);
                var cards = indices.Select(i => addMeldHand[i]).ToList();
                foreach (var i in indices.OrderByDescending(x => x)) addMeldHand.RemoveAt(i);
                SortHand(addMeldHand);
                var newMeld = new MeldDto { Id = Guid.NewGuid().ToString(), Cards = cards, Type = "set", OwnerId = playerId };
                if (a.WildRepresents != null && a.WildRepresents.Count > 0)
                    newMeld.WildRepresents = new Dictionary<int, CardDto>(a.WildRepresents);
                var effective = GetEffectiveMeldCards(newMeld);
                newMeld.Type = IsEffectiveRun(effective) ? "run" : "set";
                s.Melds.Add(newMeld);
                s.CardsLaidThisTurn += cards.Count;
                s.LastLaidMeldIds = new List<string> { newMeld.Id };
                if (addMeldHand.Count == 0)
                    EndRound(s, playerId);
                return (null, null);
            case "addcardtomeld":
                if (s.Phase != "meldOrDiscard" || string.IsNullOrEmpty(a.MeldId) || a.CardIndex == null) return ("Ogiltigt drag.", null);
                var addToMeldHand = s.PlayerHands[playerId];
                if (a.CardIndex.Value < 0 || a.CardIndex.Value >= addToMeldHand.Count) return ("Ogiltigt kortindex.", null);
                var meld = s.Melds.FirstOrDefault(m => m.Id == a.MeldId);
                if (meld == null) return ("Meld hittades inte.", null);
                var addCard = addToMeldHand[a.CardIndex.Value];
                addToMeldHand.RemoveAt(a.CardIndex.Value);
                meld.Cards.Add(addCard);
                var newIdx = meld.Cards.Count - 1;
                meld.CardContributors ??= new Dictionary<int, string>();
                meld.CardContributors[newIdx] = playerId;
                if (addCard.Rank == "2" && a.WildAs != null)
                {
                    meld.WildRepresents ??= new Dictionary<int, CardDto>();
                    meld.WildRepresents[newIdx] = a.WildAs;
                }
                SortHand(addToMeldHand);
                s.CardsLaidThisTurn += 1;
                s.LastLaidMeldIds = new List<string> { a.MeldId };
                if (addToMeldHand.Count == 0)
                    EndRound(s, playerId);
                return (null, null);
            default:
                return ("Okänd åtgärd.", null);
        }
    }

    private const int PickupPenalty = 50;

    private static void AdvanceTurn(FiveHundredStateDto s)
    {
        var whoJustPlayed = s.CurrentPlayerId;
        if (s.LastLaidMeldIds != null && s.LastLaidMeldIds.Count > 0)
        {
            var ownerOfLaid = s.Melds.FirstOrDefault(m => s.LastLaidMeldIds.Contains(m.Id))?.OwnerId;
            if (ownerOfLaid == whoJustPlayed)
                s.LastLaidMeldIds = new List<string>();
        }
        s.CurrentPlayerId = whoJustPlayed == P1 ? P2 : P1;
        s.Phase = "draw";
        s.LastDraw = null;
        s.CardsLaidThisTurn = 0;
    }

    /// <summary>2:or = 25 poäng (wild/valfritt kort men räknas alltid som 25).</summary>
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

    private static readonly Dictionary<string, int> RankOrder = new()
    {
        ["2"] = 0, ["3"] = 1, ["4"] = 2, ["5"] = 3, ["6"] = 4, ["7"] = 5, ["8"] = 6, ["9"] = 7,
        ["10"] = 8, ["jack"] = 9, ["queen"] = 10, ["king"] = 11, ["ace"] = 12
    };

    /// <summary>Ess som 1 (låg stege: ess–2–3).</summary>
    private static readonly Dictionary<string, int> RankOrderLow = new()
    {
        ["ace"] = 0, ["2"] = 1, ["3"] = 2, ["4"] = 3, ["5"] = 4, ["6"] = 5, ["7"] = 6, ["8"] = 7,
        ["9"] = 8, ["10"] = 9, ["jack"] = 10, ["queen"] = 11, ["king"] = 12
    };

    /// <summary>2:or ersatta med WildRepresents – används för att avgöra run/set och bygga vidare.</summary>
    private static List<CardDto> GetEffectiveMeldCards(MeldDto meld)
    {
        if (meld.WildRepresents == null || meld.WildRepresents.Count == 0)
            return meld.Cards.ToList();
        return meld.Cards.Select((c, i) =>
            (c.Rank == "2" && meld.WildRepresents.TryGetValue(i, out var rep)) ? rep : c
        ).ToList();
    }

    private static bool IsEffectiveRun(List<CardDto> effective)
    {
        if (effective.Count < 3) return false;
        var suit = effective[0].Suit;
        if (effective.Any(c => c.Suit != suit)) return false;
        var hasAce = effective.Any(c => c.Rank == "ace");
        var has2 = effective.Any(c => c.Rank == "2");
        if (hasAce && has2) return TryRunWithOrder(effective, RankOrderLow);
        if (hasAce) return TryRunWithOrder(effective, RankOrder) || TryRunWithOrder(effective, RankOrderLow);
        return TryRunWithOrder(effective, RankOrder);
    }

    private static bool TryRunWithOrder(List<CardDto> effective, Dictionary<string, int> order)
    {
        var values = effective.Select(c => order.GetValueOrDefault(c.Rank, -1)).Where(v => v >= 0).OrderBy(x => x).ToList();
        if (values.Count != effective.Count) return false;
        var seen = new HashSet<int>();
        foreach (var v in values) { if (!seen.Add(v)) return false; }
        for (int i = 1; i < values.Count; i++)
            if (values[i] - values[i - 1] != 1) return false;
        return true;
    }

    private const int PointsToWin = 500;

    /// <summary>Vilken spelare får poäng för kort i meld – den som lade till kortet (CardContributors) eller meld-ägaren (OwnerId).</summary>
    private static string GetCardPointOwner(MeldDto m, int cardIndex)
    {
        if (m.CardContributors != null && m.CardContributors.TryGetValue(cardIndex, out var contrib))
            return contrib;
        return m.OwnerId ?? "";
    }

    private static void EndRound(FiveHundredStateDto s, string winnerId)
    {
        var meldPointsByPlayer = new Dictionary<string, int>();
        foreach (var pid in PlayerIds) meldPointsByPlayer[pid] = 0;
        foreach (var m in s.Melds)
        {
            for (int i = 0; i < m.Cards.Count; i++)
            {
                var owner = GetCardPointOwner(m, i);
                if (string.IsNullOrEmpty(owner) || !meldPointsByPlayer.ContainsKey(owner)) continue;
                var pts = GetCardPoints(m.Cards[i].Rank);
                meldPointsByPlayer[owner] += pts;
            }
        }
        var winnerScore = (s.PlayerScores.TryGetValue(winnerId, out var ws) ? ws : 0) + meldPointsByPlayer[winnerId];
        s.PlayerScores[winnerId] = winnerScore;
        foreach (var pid in PlayerIds)
        {
            if (pid == winnerId) continue;
            var oppHand = s.PlayerHands.TryGetValue(pid, out var oh) ? oh : new List<CardDto>();
            var handPenalty = oppHand.Sum(c => GetCardPoints(c.Rank));
            var oppScore = s.PlayerScores.TryGetValue(pid, out var os) ? os : 0;
            s.PlayerScores[pid] = oppScore + meldPointsByPlayer[pid] - handPenalty;
        }
        s.WinnerId = winnerId;
        s.Phase = winnerScore >= PointsToWin ? "gameOver" : "roundEnd";
    }

    /// <summary>Sorterar hand samma ordning som frontend: färg (hearts, clubs, diamonds, spades), sedan valör (2..ace).</summary>
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

using System.Text.Json.Serialization;

namespace Backend.DTOs;

/// <summary>
/// 500 state som serialiseras till/från JSON. Måste matcha frontend GameState.
/// </summary>
public class FiveHundredStateDto
{
    public List<CardDto> Stock { get; set; } = new();
    public List<CardDto> Discard { get; set; } = new();
    public List<MeldDto> Melds { get; set; } = new();
    public string? CurrentPlayerId { get; set; }
    public Dictionary<string, List<CardDto>> PlayerHands { get; set; } = new();
    public Dictionary<string, int> PlayerScores { get; set; } = new();
    public string Phase { get; set; } = "draw";
    public string? LastDraw { get; set; }
    /// <summary>Antal kort nuvarande spelare lagt ut denna tur (tog kast högen → minst 3, annars -50).</summary>
    public int CardsLaidThisTurn { get; set; }
    /// <summary>Ids för nyligen utlagda melds – visas med grön ram tills spelaren som lade avslutar tur.</summary>
    public List<string>? LastLaidMeldIds { get; set; }
    public int RoundNumber { get; set; } = 1;
    public string? WinnerId { get; set; }
}

public class CardDto
{
    public string Suit { get; set; } = "";
    public string Rank { get; set; } = "";
}

public class MeldDto
{
    public string Id { get; set; } = "";
    public List<CardDto> Cards { get; set; } = new();
    public string Type { get; set; } = "set";
    /// <summary>Index i Cards -> vilket kort en 2:a (wild) ska räknas som.</summary>
    public Dictionary<int, CardDto>? WildRepresents { get; set; }
    /// <summary>Spelare som lade ut denna meld (för poängberäkning vid rundavslut).</summary>
    public string? OwnerId { get; set; }
    /// <summary>Index i Cards -> spelare som lade till det kortet (addcardtomeld). Om saknas, räknas kortet till OwnerId.</summary>
    public Dictionary<int, string>? CardContributors { get; set; }
}

public class FiveHundredActionRequest
{
    [JsonPropertyName("action")]
    public string Action { get; set; } = "";

    [JsonPropertyName("cardIndex")]
    public int? CardIndex { get; set; }

    [JsonPropertyName("cardIndices")]
    public List<int>? CardIndices { get; set; }

    [JsonPropertyName("meldId")]
    public string? MeldId { get; set; }

    [JsonPropertyName("wildRepresents")]
    public Dictionary<int, CardDto>? WildRepresents { get; set; }

    [JsonPropertyName("wildAs")]
    public CardDto? WildAs { get; set; }
}

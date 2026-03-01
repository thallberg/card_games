using System.Security.Claims;
using System.Text;
using Backend.Data;
using Backend.DTOs;
using Backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Development.Local.json", optional: true);

builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<FriendService>();
builder.Services.AddScoped<GameSessionService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var corsOrigins = builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty;
        var allowedOrigins = corsOrigins
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .ToArray();
        if (allowedOrigins.Length == 0)
            allowedOrigins = new[] { "http://localhost:3000", "http://localhost:5173" };

        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .SetPreflightMaxAge(TimeSpan.FromHours(1));
    });
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key saknas.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer saknas.");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new InvalidOperationException("Jwt:Audience saknas.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseCors("AllowFrontend");
app.UseRouting();

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    if (app.Environment.IsProduction() && context.Request.IsHttps)
        context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    await next();
});

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

// ---- Hjälp: aktuell användare från JWT
static Guid? GetUserId(ClaimsPrincipal? user)
{
    var id = user?.FindFirstValue(ClaimTypes.NameIdentifier);
    return Guid.TryParse(id, out var g) ? g : null;
}

// ---- Auth (öppna)
app.MapPost("/api/auth/register", async (RegisterRequest req, AuthService auth, ILoggerFactory loggerFactory) =>
{
    try
    {
        var (ok, err, u) = await auth.RegisterAsync(req.Email, req.Password, req.DisplayName);
        if (!ok) return Results.BadRequest(new { error = err });
        var token = auth.GenerateJwt(u!);
        return Results.Ok(new LoginResponse(token, new UserDto(u!.Id, u.Email, u.DisplayName, u.CreatedAt)));
    }
    catch (Exception ex)
    {
        loggerFactory.CreateLogger("Auth").LogError(ex, "Registrering misslyckades");
        return Results.Json(new { error = "Serverfel. Kontrollera att databasen är konfigurerad (ConnectionStrings:DefaultConnection i appsettings) och att migreringar är körda: dotnet ef database update." }, statusCode: 503);
    }
});

app.MapPost("/api/auth/login", async (LoginRequest req, AuthService auth, ILoggerFactory loggerFactory) =>
{
    try
    {
        var (ok, err, u) = await auth.LoginAsync(req.Email, req.Password);
        if (!ok) return Results.BadRequest(new { error = err });
        var token = auth.GenerateJwt(u!);
        return Results.Ok(new LoginResponse(token, new UserDto(u!.Id, u.Email, u.DisplayName, u.CreatedAt)));
    }
    catch (Exception ex)
    {
        loggerFactory.CreateLogger("Auth").LogError(ex, "Inloggning misslyckades");
        return Results.Json(new { error = "Serverfel. Kontrollera databaskonfiguration." }, statusCode: 503);
    }
});

// ---- Vänner (kräver inloggning)
app.MapPost("/api/friends/request", async (SendFriendRequestRequest req, HttpContext ctx, FriendService friendService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err) = await friendService.SendRequestAsync(userId.Value, req.ToUserId);
    if (!ok) return Results.BadRequest(new { error = err });
    return Results.Ok();
}).RequireAuthorization();

app.MapGet("/api/friends/requests/received", async (HttpContext ctx, FriendService friendService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var list = await friendService.GetReceivedRequestsAsync(userId.Value);
    return Results.Ok(list);
}).RequireAuthorization();

app.MapGet("/api/friends/requests/sent", async (HttpContext ctx, FriendService friendService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var list = await friendService.GetSentRequestsAsync(userId.Value);
    return Results.Ok(list);
}).RequireAuthorization();

app.MapPost("/api/friends/requests/{id:guid}/accept", async (Guid id, HttpContext ctx, FriendService friendService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err) = await friendService.RespondToRequestAsync(id, userId.Value, accept: true);
    if (!ok) return Results.BadRequest(new { error = err });
    return Results.Ok();
}).RequireAuthorization();

app.MapPost("/api/friends/requests/{id:guid}/decline", async (Guid id, HttpContext ctx, FriendService friendService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err) = await friendService.RespondToRequestAsync(id, userId.Value, accept: false);
    if (!ok) return Results.BadRequest(new { error = err });
    return Results.Ok();
}).RequireAuthorization();

app.MapGet("/api/friends", async (HttpContext ctx, FriendService friendService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var list = await friendService.GetFriendsAsync(userId.Value);
    return Results.Ok(list);
}).RequireAuthorization();

// Sök användare (för att skicka vänförfrågan)
app.MapGet("/api/users/search", async (string? q, HttpContext ctx, ApplicationDbContext db) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var query = (q ?? "").Trim().ToLowerInvariant();
    if (query.Length < 2) return Results.Ok(Array.Empty<UserDto>());
    var users = await db.Users
        .Where(u => u.Id != userId && (u.DisplayName.ToLower().Contains(query) || u.Email.ToLower().Contains(query)))
        .Take(20)
        .Select(u => new UserDto(u.Id, u.Email, u.DisplayName, u.CreatedAt))
        .ToListAsync();
    return Results.Ok(users);
}).RequireAuthorization();

// ---- Lobby / Game sessions (partyleader m.m.)
app.MapPost("/api/gamesessions", async (CreateGameSessionRequest req, HttpContext ctx, GameSessionService gameService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err, session) = await gameService.CreateAsync(userId.Value, req.GameType, req.MaxPlayers ?? 6);
    if (!ok) return Results.BadRequest(new { error = err });
    return Results.Created($"/api/gamesessions/{session!.Id}", session);
}).RequireAuthorization();

app.MapGet("/api/gamesessions", async (HttpContext ctx, GameSessionService gameService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var list = await gameService.GetMySessionsAsync(userId.Value);
    return Results.Ok(list);
}).RequireAuthorization();

app.MapGet("/api/gamesessions/{id:guid}", async (Guid id, HttpContext ctx, GameSessionService gameService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var session = await gameService.GetByIdAsync(id, userId);
    if (session == null) return Results.NotFound();
    return Results.Ok(session);
}).RequireAuthorization();

app.MapPatch("/api/gamesessions/{id:guid}", async (Guid id, UpdateGameSessionRequest req, HttpContext ctx, GameSessionService gameService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err) = await gameService.UpdateAsync(id, userId.Value, req.GameType);
    if (!ok) return Results.BadRequest(new { error = err });
    var session = await gameService.GetByIdAsync(id, userId);
    return Results.Ok(session);
}).RequireAuthorization();

app.MapPost("/api/gamesessions/{id:guid}/invite", async (Guid id, InviteToSessionRequest req, HttpContext ctx, GameSessionService gameService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err) = await gameService.InviteAsync(id, userId.Value, req.UserId);
    if (!ok) return Results.BadRequest(new { error = err });
    return Results.Ok();
}).RequireAuthorization();

app.MapPost("/api/gamesessions/{id:guid}/join", async (Guid id, HttpContext ctx, GameSessionService gameService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err) = await gameService.JoinAsync(id, userId.Value);
    if (!ok) return Results.BadRequest(new { error = err });
    var session = await gameService.GetByIdAsync(id, userId);
    return Results.Ok(session);
}).RequireAuthorization();

app.MapPost("/api/gamesessions/{id:guid}/leave", async (Guid id, HttpContext ctx, GameSessionService gameService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err) = await gameService.LeaveAsync(id, userId.Value);
    if (!ok) return Results.BadRequest(new { error = err });
    return Results.Ok();
}).RequireAuthorization();

app.MapPost("/api/gamesessions/{id:guid}/start", async (Guid id, HttpContext ctx, GameSessionService gameService) =>
{
    var userId = GetUserId(ctx.User);
    if (userId == null) return Results.Unauthorized();
    var (ok, err) = await gameService.StartGameAsync(id, userId.Value);
    if (!ok) return Results.BadRequest(new { error = err });
    var session = await gameService.GetByIdAsync(id, userId);
    return Results.Ok(session);
}).RequireAuthorization();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", app = "Kortspel API" }));

app.Run();

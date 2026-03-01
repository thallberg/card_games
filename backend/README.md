# Kortspel – Backend

.NET Web API med Entity Framework Core mot **Azure Database for PostgreSQL**.  
Innehåller: **Auth** (registrering, inloggning med JWT), **vänförfrågningar** och **lobby/spelsessioner** (partyleader väljer spel, startar, bjuder in m.m.).

## Krav

- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- Azure PostgreSQL-instans (eller lokal PostgreSQL)

## Konfiguration

**Om du får 500 eller 503 vid registrering/inloggning:** sätt en giltig connection string och kör `dotnet ef database update` (se nedan).

1. **Connection string** – i `appsettings.Development.json` eller User Secrets:
   ```bash
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true"
   ```
   På Azure: användarnamn ofta `användare@servernamn`.

2. **JWT** – Nyckeln finns i `appsettings` (dev). För produktion: sätt `Jwt:Key` via miljövariabel eller User Secrets (minst 32 tecken).

3. **Azure (miljövariabler)** – I Azure används `__` som avgränsare (blir `:` i .NET):  
   `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`, `Cors__AllowedOrigins` (kommaseparerade, t.ex. `https://din-app.vercel.app,http://localhost:3000`).

## Köra

```bash
cd backend
dotnet run
```

API: http://localhost:5236. Testa: `GET /api/health`

## API – översikt

**Auth (öppet)**  
- `POST /api/auth/register` – Body: `{ "email", "password", "displayName" }`  
- `POST /api/auth/login` – Body: `{ "email", "password" }` → `{ "token", "user" }`  

**Vänner** (Header: `Authorization: Bearer <token>`)  
- `POST /api/friends/request` – Body: `{ "toUserId" }`  
- `GET /api/friends/requests/received`  
- `GET /api/friends/requests/sent`  
- `POST /api/friends/requests/{id}/accept`  
- `POST /api/friends/requests/{id}/decline`  
- `GET /api/friends`  

**Användarsökning**  
- `GET /api/users/search?q=...` – Hitta användare (visningsnamn/e-post) för vänförfrågan.

**Lobby / spelsessioner** (partyleader = den som skapade sessionen)  
- `POST /api/gamesessions` – Body: `{ "gameType": 0, "maxPlayers": 6 }` (0=Poker, 1=Blackjack)  
- `GET /api/gamesessions` – Mina sessioner  
- `GET /api/gamesessions/{id}`  
- `PATCH /api/gamesessions/{id}` – Byta kortspel: Body `{ "gameType": 1 }`  
- `POST /api/gamesessions/{id}/invite` – Body: `{ "userId" }`  
- `POST /api/gamesessions/{id}/join`  
- `POST /api/gamesessions/{id}/leave`  
- `POST /api/gamesessions/{id}/start` – Endast partyleader, minst 2 spelare  

## Databas

```bash
cd backend
dotnet ef migrations add NamnPaMigrering
dotnet ef database update
```

Verktyg: `dotnet tool install --global dotnet-ef`

## Projektstruktur

- `Program.cs` – JWT, DI, alla endpoints  
- `Models/` – User, FriendRequest, UserFriend, GameSession, GameSessionPlayer, GameType  
- `Data/ApplicationDbContext.cs` – EF-modeller  
- `DTOs/` – Request/response-objekt  
- `Services/` – AuthService, FriendService, GameSessionService  
- `Migrations/` – EF-migreringar  

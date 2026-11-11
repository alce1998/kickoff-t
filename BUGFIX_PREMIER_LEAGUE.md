# Bugfix: Nomi squadre Premier League non visualizzati

## Problema
I nomi delle squadre Premier League (Arsenal, Leicester, Man City, Liverpool, ecc.) non venivano visualizzati nell'intestazione della partita nel gioco Formazioni.

## Causa
Le partite Premier League nel database (`matches_verified_100.json`) usavano **snake_case** per i campi squadra:
- `home_team: "Arsenal"`
- `away_team: "Leicester"`

Mentre il codice TypeScript in `game-logic.ts` cercava **camelCase**:
- `homeTeam`
- `awayTeam`

Questo causava che `currentMatch.homeTeam` e `currentMatch.awayTeam` fossero `undefined`, rendendo i nomi delle squadre invisibili nell'interfaccia.

## Soluzione
Convertito tutti i 908 record Premier League da snake_case a camelCase:

```python
for match in matches:
    if match.get('competition') == 'Premier League':
        if 'home_team' in match:
            match['homeTeam'] = match.pop('home_team')
        if 'away_team' in match:
            match['awayTeam'] = match.pop('away_team')
```

## Risultato
✅ I nomi delle squadre Premier League ora vengono visualizzati correttamente:
- **Man City** 4:1 **Liverpool** (01/04/23)
- **Arsenal** vs **Leicester**
- Ecc.

## File modificati
- `client/src/data/matches_verified_100.json` (908 partite aggiornate)

## Test eseguito
Avviata partita Premier League Man City vs Liverpool (01/04/23) - nomi squadre visibili correttamente nell'intestazione.

## Data correzione
14 gennaio 2026

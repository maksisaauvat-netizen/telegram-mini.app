RESONANT UI REBUILD

1. Replace the current index.html with this index.html.
2. Put resonant-hero.jpeg in the same directory as index.html.
3. bot.py can remain unchanged: the rebuilt UI uses the existing /api/me, /api/history, /api/deposit and /api/withdraw endpoints.
4. The visual game screens are UI shells. The current bot.py deliberately returns HTTP 501 from /api/game/round until an audited server-side game routine is selected, so the rebuild does not fake real-money game results in the browser.

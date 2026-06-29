# Faltin Travel – MCP-Server

MCP-Server, mit dem ein KI-Client (Claude Desktop, Cowork, …) die Faltin-Travel-Plattform
steuern kann – **Authentifizierung per API-Key**. Greift über die externe API `/api/ext/*`
auf die Website zu.

## Funktionen (Tools)

- **Tickets/Aufgaben:** `ft_list_tasks`, `ft_get_task`, `ft_create_task`, `ft_update_task`,
  `ft_book_task_time`, `ft_list_task_time`, `ft_list_task_messages`, `ft_send_task_message`
- **Anfragen/CRM:** `ft_list_bookings`, `ft_get_booking`, `ft_update_booking`,
  `ft_list_booking_messages`, `ft_reply_booking`
- **Kunden (read):** `ft_list_customers`, `ft_get_customer`
- **Content (read):** `ft_list_events`, `ft_list_series`, `ft_list_packages`, `ft_list_faqs`
- **Health:** `ft_whoami`

## 1. API-Key erzeugen

Im Admin unter **`/admin/api-keys`** einen Key erzeugen (Bezeichnung vergeben). Der Key wird
**nur einmal** angezeigt – sofort kopieren. Format: `ftk_…`. Widerrufen geht jederzeit auf
derselben Seite.

## 2. Bauen

```bash
cd mcp-server
npm install
npm run build
```

## 3. Im KI-Client eintragen

Beispiel-Konfiguration (Claude Desktop `claude_desktop_config.json` bzw. Cowork-MCP-Settings):

```json
{
  "mcpServers": {
    "faltin-travel": {
      "command": "node",
      "args": ["/ABSOLUTER/PFAD/ft-super-bowl/mcp-server/dist/index.js"],
      "env": {
        "FT_BASE_URL": "https://next.faltintravel.com",
        "FT_API_KEY": "ftk_DEIN_KEY"
      }
    }
  }
}
```

- `FT_BASE_URL` – Basis-URL der Plattform (Default `https://next.faltintravel.com`; für lokal `http://localhost:3000`).
- `FT_API_KEY` – der erzeugte Key (**erforderlich**).

Verbindung testen: das Tool `ft_whoami` aufrufen – es gibt die Bezeichnung des Keys zurück.

## Sicherheit

- Keys werden serverseitig nur **gehasht** gespeichert (SHA-256), nie im Klartext.
- Ein Key hat Lese- **und** Schreibrechte im freigegebenen Umfang. Bei Verlust sofort widerrufen.
- `ft_reply_booking` und `ft_send_task_message` (kind=email) versenden **echte E-Mails** – mit Bedacht nutzen.

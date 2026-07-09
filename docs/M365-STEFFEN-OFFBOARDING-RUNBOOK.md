# Runbook: Postfach Steffen → Shared Mailbox, User deaktivieren, Lizenz entziehen (TASK-00099)

Reiner Leitfaden zum manuellen Ausführen im Microsoft 365 Admin Center bzw. per
PowerShell — **keine dieser Aktionen wird von der App automatisch ausgeführt**.
Bitte in der angegebenen Reihenfolge abarbeiten (Reihenfolge ist wichtig: Mailbox
zuerst konvertieren, dann Lizenz entziehen — sonst drohen Zustellprobleme).

Voraussetzung: Global Admin oder (Exchange Admin + User Admin) im Tenant.

## 1. Postfach zu Shared Mailbox konvertieren

**Exchange Admin Center** (https://admin.exchange.microsoft.com):
1. Empfänger → Postfächer → Steffens Postfach auswählen.
2. „Zu freigegebenem Postfach konvertieren" (Convert to shared mailbox).

**Äquivalent per PowerShell** (`Connect-ExchangeOnline` vorher ausführen):
```powershell
Set-Mailbox -Identity "steffen@faltintravel.com" -Type Shared
```

Shared Mailboxes bis 50 GB benötigen **keine** Lizenz — deshalb zuerst
konvertieren, danach entziehen (Schritt 3). Bestehende Mails/Ordner bleiben
erhalten und sind über die Shared Mailbox weiter erreichbar (z. B. für
`request@` o. ä., falls das Postfach künftig so mitgenutzt werden soll).

## 2. Zugriff auf die Shared Mailbox vergeben (optional)

Falls Kolleg:innen das Postfach weiter mitlesen sollen:
```powershell
Add-MailboxPermission -Identity "steffen@faltintravel.com" -User "natalie@faltintravel.com" -AccessRights FullAccess -InheritanceType All -AutoMapping $true
```

## 3. Benutzerkonto deaktivieren

**Microsoft 365 Admin Center** (https://admin.microsoft.com) → Benutzer → Aktive
Benutzer → Steffen auswählen → „Anmeldestatus blockieren" (Block sign-in).

**Äquivalent per PowerShell** (Microsoft Graph PowerShell SDK,
`Connect-MgGraph -Scopes "User.ReadWrite.All"` vorher ausführen):
```powershell
Update-MgUser -UserId "steffen@faltintravel.com" -AccountEnabled:$false
```

## 4. Lizenz entziehen

**Microsoft 365 Admin Center** → Benutzer → Steffen auswählen → Lizenzen und Apps
→ alle Häkchen entfernen → Änderungen speichern.

**Äquivalent per PowerShell:**
```powershell
$user = Get-MgUser -UserId "steffen@faltintravel.com"
Set-MgUserLicense -UserId $user.Id -RemoveLicenses @($user.AssignedLicenses.SkuId) -AddLicenses @()
```

## 5. Nacharbeiten (optional, je nach Bedarf)

- Aus Verteilerlisten/Gruppen entfernen, in denen Steffen Mitglied war.
- Automatische Antwort/Weiterleitung auf der Shared Mailbox einrichten, falls
  externe Absender informiert werden sollen.
- Falls Steffen in `/admin/team` als Mitarbeiter geführt wird: dort auf
  „inaktiv" setzen (rein für die interne Zeiterfassung/Rapporte —
  hat keinen Einfluss auf M365).

## Warum das nicht automatisiert wurde

Diese drei Schritte greifen direkt in reale Benutzerkonten/Lizenzen ein
(Kontodeaktivierung, Lizenz-Entzug einer echten Person) und sind über die
Microsoft Graph API zwar technisch abbildbar, aber bewusst **nicht** in die
Anwendung integriert — das wären weitreichende neue App-Berechtigungen
(`User.ReadWrite.All` u. ä.) für eine seltene, hochsensible Einzelaktion, die
sich manuell in 5 Minuten erledigen lässt und volle Kontrolle behält.

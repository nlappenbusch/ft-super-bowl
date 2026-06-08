/**
 * entraSetupScript.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generiert ein PowerShell-Setup-Script für die Microsoft-365/Entra-
 * App-Registrierung inkl. Berechtigungen, Admin-Consent, Client-Secret und
 * (optional) ApplicationAccessPolicy zur Beschränkung auf das Postfach.
 * Reine String-Funktion (keine Secrets, client- & serverseitig nutzbar).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface EntraScriptOptions {
  appName: string;
  mailbox: string;
  restrict: boolean;
}

export function buildEntraSetupScript({ appName, mailbox, restrict }: EntraScriptOptions): string {
  const safeApp = (appName || 'Faltin CRM Mailer').replace(/'/g, '');
  const safeMailbox = (mailbox || 'request@faltintravel.com').replace(/'/g, '');
  const restrictFlag = restrict ? '$true' : '$false';

  return `<#
=====================================================================
 Faltin CRM - Microsoft 365 / Entra App-Registrierung (App-only)
=====================================================================
 Legt automatisch an:
  - App-Registrierung "${safeApp}"
  - Application-Permissions: Mail.Send, Mail.ReadWrite (Microsoft Graph)
  - Admin-Consent (App-Rollen-Zuweisung)
  - Client-Secret (2 Jahre gueltig)
  - (optional) ApplicationAccessPolicy -> App-Zugriff nur auf das Postfach

 Voraussetzungen (einmalig, als Administrator):
   Install-Module Microsoft.Graph -Scope CurrentUser
   Install-Module ExchangeOnlineManagement -Scope CurrentUser
 Benoetigte Rollen: Global Admin ODER (Application Admin + Exchange Admin).

 Danach die ausgegebenen Werte ins Admin-Panel (E-Mail / M365) eintragen.
=====================================================================
#>

$ErrorActionPreference = 'Stop'

$AppName   = '${safeApp}'
$Mailbox   = '${safeMailbox}'
$GroupName = 'sg-faltin-crm-mailer'   # mail-enabled Security-Group fuer die Access-Policy
$Restrict  = ${restrictFlag}

# Well-known IDs (Microsoft Graph)
$GraphAppId    = '00000003-0000-0000-c000-000000000000'
$MailSend      = 'b633e1c5-b582-4048-a93e-9f11b44c7e96'  # Mail.Send (Application)
$MailReadWrite = 'e2a3a72e-5f79-4c64-b1b1-878b674786c9'  # Mail.ReadWrite (Application)

Write-Host '== Verbinde mit Microsoft Graph ==' -ForegroundColor Cyan
Connect-MgGraph -Scopes 'Application.ReadWrite.All','AppRoleAssignment.ReadWrite.All','Directory.ReadWrite.All' | Out-Null
$TenantId = (Get-MgContext).TenantId

Write-Host '== Erstelle App-Registrierung + Berechtigungen ==' -ForegroundColor Cyan
$rra = @{
  ResourceAppId  = $GraphAppId
  ResourceAccess = @(
    @{ Id = $MailSend;      Type = 'Role' },
    @{ Id = $MailReadWrite; Type = 'Role' }
  )
}
$app = New-MgApplication -DisplayName $AppName -SignInAudience 'AzureADMyOrg' -RequiredResourceAccess @($rra)
Start-Sleep -Seconds 5
$sp = New-MgServicePrincipal -AppId $app.AppId

Write-Host '== Admin-Consent (App-Rollen zuweisen) ==' -ForegroundColor Cyan
$graphSp = Get-MgServicePrincipal -Filter "appId eq '$GraphAppId'"
foreach ($roleId in @($MailSend, $MailReadWrite)) {
  New-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $sp.Id -BodyParameter @{
    PrincipalId = $sp.Id; ResourceId = $graphSp.Id; AppRoleId = $roleId
  } | Out-Null
}

Write-Host '== Client-Secret erstellen ==' -ForegroundColor Cyan
$secret = Add-MgApplicationPassword -ApplicationId $app.Id -PasswordCredential @{
  DisplayName = 'faltin-crm'; EndDateTime = (Get-Date).AddYears(2)
}

if ($Restrict) {
  Write-Host '== Exchange Online: Zugriff auf das Postfach beschraenken ==' -ForegroundColor Cyan
  Connect-ExchangeOnline -ShowBanner:$false
  if (-not (Get-DistributionGroup -Identity $GroupName -ErrorAction SilentlyContinue)) {
    New-DistributionGroup -Name $GroupName -Alias $GroupName -Type Security -Members $Mailbox | Out-Null
    Write-Host '   Security-Group erstellt, warte auf Replikation...' -ForegroundColor DarkGray
    Start-Sleep -Seconds 15
  }
  New-ApplicationAccessPolicy -AppId $app.AppId -PolicyScopeGroupId $GroupName \`
    -AccessRight RestrictAccess -Description 'Faltin CRM Mailer - nur Postfach' | Out-Null
  Write-Host '   Test:' -ForegroundColor DarkGray
  Test-ApplicationAccessPolicy -Identity $Mailbox -AppId $app.AppId
}

Write-Host ''
Write-Host '==================== ERGEBNIS ====================' -ForegroundColor Green
Write-Host ("GRAPH_TENANT_ID     = " + $TenantId)
Write-Host ("GRAPH_CLIENT_ID     = " + $app.AppId)
Write-Host ("GRAPH_CLIENT_SECRET = " + $secret.SecretText)
Write-Host ("GRAPH_MAILBOX       = " + $Mailbox)
Write-Host '==================================================' -ForegroundColor Green
Write-Host 'Diese Werte ins Admin-Panel (E-Mail / Microsoft 365) eintragen und speichern.'
Write-Host 'Das Client-Secret wird nur EINMAL angezeigt - jetzt sichern!'
`;
}

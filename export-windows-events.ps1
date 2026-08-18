<#
.SYNOPSIS
    Выгружает события входа/выхода из журналов Windows в CSV для дашборда IPBan.

.DESCRIPTION
    Браузер не может читать бинарный журнал Windows (.evtx) напрямую, поэтому
    этот скрипт выгружает нужные события в CSV-файл, который дашборд читает
    вместе с логами IPBan и RadiusProxy.

    Выгружаются:
      Журнал Security:
        4624 - успешный вход в систему
        4625 - неудачный вход (содержит IP источника - связывается с банами IPBan)
        4634 - выход из системы
        4647 - выход по инициативе пользователя
        4778 - переподключение к сессии
        4779 - отключение от сессии
      Журнал TerminalServices-LocalSessionManager/Operational:
        21 - вход в RDP-сессию
        23 - выход из RDP-сессии
        24 - RDP-сессия отключена
        25 - RDP-сессия переподключена

    Длительность сессий дашборд считает по паре 4624 -> 4634/4647,
    связывая их по Logon ID (это надёжнее, чем сопоставлять по времени).

.PARAMETER OutputDir
    Папка, в которую пишется CSV. Эту же папку добавьте в дашборде
    кнопкой "Добавить папку с логами".

.PARAMETER Days
    За сколько последних дней выгружать события. По умолчанию 7.

.PARAMETER Install
    Зарегистрировать задачу в Планировщике Windows, чтобы выгрузка
    выполнялась автоматически каждые N минут (см. -IntervalMinutes).

.PARAMETER IntervalMinutes
    Периодичность автоматической выгрузки при -Install. По умолчанию 15 минут.

.PARAMETER Uninstall
    Удалить ранее созданную задачу из Планировщика.

.EXAMPLE
    # Разовая выгрузка за последние 7 дней
    .\export-windows-events.ps1 -OutputDir C:\IPBan\windows-events

.EXAMPLE
    # Настроить автоматическую выгрузку каждые 15 минут
    .\export-windows-events.ps1 -OutputDir C:\IPBan\windows-events -Install

.NOTES
    Требуются права администратора: журнал Security недоступен обычному
    пользователю. Запускайте PowerShell "от имени администратора".
#>

[CmdletBinding()]
param(
    [string] $OutputDir = "C:\IPBan\windows-events",
    [int]    $Days = 7,
    [switch] $Install,
    [int]    $IntervalMinutes = 15,
    [switch] $Uninstall
)

$ErrorActionPreference = "Stop"
$TaskName = "IPBanDashboard-ExportWindowsEvents"

# --------------------------------------------------------------------------
# Установка / удаление задачи в Планировщике
# --------------------------------------------------------------------------
if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Задача '$TaskName' удалена из Планировщика." -ForegroundColor Green
    } else {
        Write-Host "Задача '$TaskName' не найдена — нечего удалять." -ForegroundColor Yellow
    }
    return
}

if ($Install) {
    $scriptPath = $MyInvocation.MyCommand.Path
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -OutputDir `"$OutputDir`" -Days $Days"

    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
        -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)

    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings `
        -Description "Выгрузка событий входа/выхода Windows в CSV для дашборда IPBan" | Out-Null

    Write-Host "Задача '$TaskName' создана: выгрузка каждые $IntervalMinutes мин. в $OutputDir" -ForegroundColor Green
    Write-Host "Запускаю первую выгрузку..." -ForegroundColor Cyan
}

# --------------------------------------------------------------------------
# Вспомогательное: вытащить именованные поля события из его XML
# --------------------------------------------------------------------------
function Get-EventFields {
    param($Event)

    $fields = @{}
    try {
        $xml = [xml] $Event.ToXml()
    } catch {
        return $fields
    }

    # Обычные события Security кладут поля в EventData/Data с атрибутом Name
    if ($xml.Event.EventData) {
        foreach ($d in $xml.Event.EventData.Data) {
            if ($d.Name) { $fields[$d.Name] = [string]$d.'#text' }
        }
    }

    # События TerminalServices кладут поля в UserData/<...>/<поле>
    if ($xml.Event.UserData) {
        foreach ($container in $xml.Event.UserData.ChildNodes) {
            foreach ($node in $container.ChildNodes) {
                $fields[$node.LocalName] = [string]$node.'#text'
            }
        }
    }

    return $fields
}

# --------------------------------------------------------------------------
# Сбор событий
# --------------------------------------------------------------------------
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$startTime = (Get-Date).AddDays(-$Days)
$records = New-Object System.Collections.Generic.List[object]

function Add-Records {
    param($Events, [string]$SourceLog)

    foreach ($ev in $Events) {
        $f  = Get-EventFields -Event $ev
        $id = [int]$ev.Id

        # Имя пользователя лежит в разных полях в зависимости от журнала
        $user = $f['TargetUserName']
        if (-not $user) { $user = $f['User'] }
        if (-not $user) { $user = $f['AccountName'] }

        # События TerminalServices дают "ДОМЕН\пользователь" одной строкой
        $domain = $f['TargetDomainName']
        if ($user -and $user.Contains('\')) {
            $parts  = $user.Split('\')
            $domain = $parts[0]
            $user   = $parts[-1]
        }

        $ip = $f['IpAddress']
        if (-not $ip) { $ip = $f['Address'] }
        if (-not $ip) { $ip = $f['ClientAddress'] }
        # Windows пишет "-" или "::1" когда адрес не применим
        if ($ip -eq '-' -or $ip -eq '::1' -or $ip -eq '127.0.0.1') { $ip = '' }

        $records.Add([PSCustomObject]@{
            TimeCreated = $ev.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
            EventId     = $id
            LogName     = $SourceLog
            User        = $user
            Domain      = $domain
            LogonId     = $f['TargetLogonId']
            LogonType   = $f['LogonType']
            IpAddress   = $ip
            Workstation = $f['WorkstationName']
            SessionId   = $f['SessionID']
            Computer    = $ev.MachineName
        })
    }
}

# --- Журнал Security -------------------------------------------------------
try {
    $secEvents = Get-WinEvent -FilterHashtable @{
        LogName   = 'Security'
        Id        = 4624, 4625, 4634, 4647, 4778, 4779
        StartTime = $startTime
    } -ErrorAction Stop
    Add-Records -Events $secEvents -SourceLog 'Security'
    Write-Host "Security: получено $($secEvents.Count) событий" -ForegroundColor Gray
} catch [System.Diagnostics.Eventing.Reader.EventLogNotFoundException] {
    Write-Warning "Журнал Security не найден."
} catch {
    if ($_.Exception.Message -match 'No events were found') {
        Write-Host "Security: событий за период не найдено" -ForegroundColor Gray
    } else {
        Write-Warning "Не удалось прочитать журнал Security: $($_.Exception.Message)"
        Write-Warning "Скорее всего не хватает прав — запустите PowerShell от имени администратора."
    }
}

# --- Журнал TerminalServices (RDP) ----------------------------------------
try {
    $tsEvents = Get-WinEvent -FilterHashtable @{
        LogName   = 'Microsoft-Windows-TerminalServices-LocalSessionManager/Operational'
        Id        = 21, 23, 24, 25
        StartTime = $startTime
    } -ErrorAction Stop
    Add-Records -Events $tsEvents -SourceLog 'TerminalServices'
    Write-Host "TerminalServices: получено $($tsEvents.Count) событий" -ForegroundColor Gray
} catch [System.Diagnostics.Eventing.Reader.EventLogNotFoundException] {
    Write-Warning "Журнал TerminalServices-LocalSessionManager не найден (возможно, роль RDP не установлена)."
} catch {
    if ($_.Exception.Message -match 'No events were found') {
        Write-Host "TerminalServices: событий за период не найдено" -ForegroundColor Gray
    } else {
        Write-Warning "Не удалось прочитать журнал TerminalServices: $($_.Exception.Message)"
    }
}

# --------------------------------------------------------------------------
# Запись CSV
# --------------------------------------------------------------------------
if ($records.Count -eq 0) {
    Write-Warning "Событий не найдено — CSV не создан."
    return
}

# Имя файла с датой: дашборд определяет день лога по дате в имени файла
$fileName = "windows-events-{0}.csv" -f (Get-Date -Format "yyyy-MM-dd")
$outFile  = Join-Path $OutputDir $fileName

$records |
    Sort-Object TimeCreated |
    Export-Csv -Path $outFile -NoTypeInformation -Encoding UTF8

Write-Host "Готово: $($records.Count) событий записано в $outFile" -ForegroundColor Green
Write-Host "Добавьте папку '$OutputDir' в дашборде кнопкой 'Добавить папку с логами'." -ForegroundColor Cyan

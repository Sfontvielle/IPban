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
    [switch] $Uninstall,
    [switch] $Diagnose
)

$ErrorActionPreference = "Stop"
$TaskName = "IPBanDashboard-ExportWindowsEvents"

# Расшифровка LogonType из события 4624 — используется в диагностике
$LogonTypeNames = @{
    '2'  = 'локальный вход'
    '3'  = 'сетевой доступ'
    '4'  = 'пакетное задание'
    '5'  = 'служба'
    '7'  = 'разблокировка'
    '8'  = 'сетевой (открытый пароль)'
    '9'  = 'новые учётные данные'
    '10' = 'RDP (удалённый рабочий стол)'
    '11' = 'кэшированный вход'
}

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
# Поля достаются регулярными выражениями по XML-строке, а не через [xml].
# Приведение к DOM стоит дорого, и на журнале Security в десятки тысяч
# событий оно превращает выгрузку в многоминутное ожидание.
$script:ReData  = [regex]::new("<Data Name='([^']+)'\s*>(.*?)</Data>", 'Singleline')
$script:ReUser  = [regex]::new("<(User|SessionID|Address|Param\d+)\s*>(.*?)</\1>", 'Singleline')

function Expand-XmlEntities {
    param([string] $Value)
    if (-not $Value) { return $Value }
    if ($Value.IndexOf('&') -lt 0) { return $Value }
    return $Value.Replace('&lt;', '<').Replace('&gt;', '>').
                  Replace('&quot;', '"').Replace('&apos;', "'").
                  Replace('&amp;', '&')
}

function Get-EventFields {
    param($Event)

    $fields = @{}
    try {
        $xmlStr = $Event.ToXml()
    } catch {
        return $fields
    }
    if (-not $xmlStr) { return $fields }

    # Обычные события Security: <Data Name='TargetUserName'>значение</Data>
    foreach ($m in $script:ReData.Matches($xmlStr)) {
        $fields[$m.Groups[1].Value] = Expand-XmlEntities $m.Groups[2].Value
    }

    # События TerminalServices: <User>, <SessionID>, <Address>, <ParamN>
    foreach ($m in $script:ReUser.Matches($xmlStr)) {
        $name = $m.Groups[1].Value
        if (-not $fields.ContainsKey($name)) {
            $fields[$name] = Expand-XmlEntities $m.Groups[2].Value
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

    $total = @($Events).Count
    $n = 0
    foreach ($ev in $Events) {
        $n++
        # Без этого на журнале в десятки тысяч событий выглядит как зависание
        if ($total -gt 2000 -and ($n % 1000) -eq 0) {
            Write-Progress -Activity "Разбор журнала $SourceLog" `
                -Status "$n из $total" -PercentComplete ([int](100 * $n / $total))
        }

        $f  = Get-EventFields -Event $ev
        $id = [int]$ev.Id

        # Имя пользователя лежит в разных полях в зависимости от журнала.
        # Событие 1149 (RemoteConnectionManager) кладёт значения без имён,
        # позиционно: Param1 = пользователь, Param2 = домен, Param3 = адрес.
        $user = $f['TargetUserName']
        if (-not $user) { $user = $f['User'] }
        if (-not $user) { $user = $f['AccountName'] }
        if (-not $user -and $id -eq 1149) { $user = $f['Param1'] }

        # События TerminalServices дают "ДОМЕН\пользователь" одной строкой
        $domain = $f['TargetDomainName']
        if ($user -and $user.Contains('\')) {
            $parts  = $user.Split('\')
            $domain = $parts[0]
            $user   = $parts[-1]
        }

        $domainFromParam = if ($id -eq 1149) { $f['Param2'] } else { $null }
        if (-not $domain -and $domainFromParam) { $domain = $domainFromParam }

        $ip = $f['IpAddress']
        if (-not $ip) { $ip = $f['Address'] }
        if (-not $ip) { $ip = $f['ClientAddress'] }
        if (-not $ip -and $id -eq 1149) { $ip = $f['Param3'] }
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

# --------------------------------------------------------------------------
# Какие журналы и события собираем
# --------------------------------------------------------------------------
# 1149 (RemoteConnectionManager) — самое надёжное свидетельство того, что
# конкретный доменный пользователь подключился по RDP: оно пишется на каждое
# успешное подключение и содержит логин и адрес источника. Журналы Security и
# LocalSessionManager дают вход/выход и позволяют посчитать длительность.
$LogSpecs = @(
    @{ Log = 'Security';
       Ids = 4624, 4625, 4634, 4647, 4778, 4779;
       Label = 'Security';
       Hint = 'Нужны права администратора и включённый аудит входа в систему.' },

    @{ Log = 'Microsoft-Windows-TerminalServices-LocalSessionManager/Operational';
       Ids = 21, 23, 24, 25;
       Label = 'TerminalServices (сессии)';
       Hint = 'Появляется при установленной роли RDP / службе удалённых рабочих столов.' },

    @{ Log = 'Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational';
       Ids = 1149;
       Label = 'TerminalServices (подключения)';
       Hint = 'Здесь видно каждое RDP-подключение доменных пользователей.' }
)

# --------------------------------------------------------------------------
# Диагностика: показать, что реально лежит в журналах
# --------------------------------------------------------------------------
# Если в дашборде видно меньше людей, чем ожидалось, причина почти всегда в
# самих журналах (скрипт запущен не на том сервере, аудит выключен, или журнал
# успел перезаписаться), а не в разборе. Этот режим показывает факты.
if ($Diagnose) {
    Write-Host ""
    Write-Host "=== ДИАГНОСТИКА ===" -ForegroundColor Cyan
    Write-Host ("Компьютер: {0}" -f $env:COMPUTERNAME)
    Write-Host ("Период выгрузки: последние {0} дн. (с {1})" -f $Days, $startTime.ToString("yyyy-MM-dd HH:mm"))
    Write-Host ""

    foreach ($spec in $LogSpecs) {
        Write-Host ("--- {0} [{1}]" -f $spec.Label, $spec.Log) -ForegroundColor Yellow
        try {
            $log = Get-WinEvent -ListLog $spec.Log -ErrorAction Stop
            Write-Host ("  включён: {0}; записей всего: {1}; размер: {2:N0} из {3:N0} байт" -f `
                $log.IsEnabled, $log.RecordCount, $log.FileSize, $log.MaximumSizeInBytes)

            $oldest = Get-WinEvent -LogName $spec.Log -Oldest -MaxEvents 1 -ErrorAction Stop
            Write-Host ("  самая старая запись в журнале: {0}" -f $oldest.TimeCreated)
            if ($oldest.TimeCreated -gt $startTime) {
                Write-Warning ("  Журнал не хранит все {0} дн. — он перезаписался. Более старых событий уже нет." -f $Days)
            }
        } catch {
            Write-Warning ("  недоступен: {0}" -f $_.Exception.Message)
            continue
        }

        try {
            # На большом журнале сам запрос к службе журнала событий (не
            # разбор — он уже быстрый) может занять до минуты: Windows
            # обрабатывает фильтр с несколькими Id медленнее, чем с одним.
            # Ограничиваем последними 5000 событиями каждого вида — этого
            # достаточно, чтобы увидеть, какие типы входа и какие люди
            # вообще встречаются, а диагностика не превращается в ту же
            # долгую выгрузку, которую она должна заменить.
            $diagMax = 5000
            Write-Host ("  запрашиваю события (до {0} шт., может занять до минуты)..." -f $diagMax) -ForegroundColor DarkGray
            $ev = Get-WinEvent -FilterHashtable @{ LogName = $spec.Log; Id = $spec.Ids; StartTime = $startTime } -MaxEvents $diagMax -ErrorAction Stop
            if (@($ev).Count -eq $diagMax) {
                Write-Host ("  (показаны {0} самых свежих событий — их может быть больше)" -f $diagMax) -ForegroundColor DarkGray
            }
            $ev | Group-Object Id | Sort-Object Name | ForEach-Object {
                Write-Host ("  событие {0}: {1} шт." -f $_.Name, $_.Count)
            }

            # Разбивка входов по типу и список людей. Читается из .Properties
            # (позиционно, без разбора XML) — иначе на десятках тысяч событий
            # диагностика была бы такой же долгой, как сама выгрузка.
            $logons = @($ev | Where-Object { $_.Id -eq 4624 })
            if ($logons.Count -gt 0) {
                Write-Host "  входы 4624 по типу:"
                $logons | Group-Object { $_.Properties[8].Value } | Sort-Object Name | ForEach-Object {
                    $t = [string]$_.Name
                    $label = $LogonTypeNames[$t]
                    if (-not $label) { $label = 'иной' }
                    Write-Host ("    тип {0} ({1}): {2} шт." -f $t, $label, $_.Count)
                }

                $people = $logons |
                    ForEach-Object { [string]$_.Properties[5].Value } |
                    Where-Object { $_ -and $_ -notmatch '\$$' -and
                                   $_ -notmatch '^(SYSTEM|LOCAL SERVICE|NETWORK SERVICE|ANONYMOUS LOGON|DWM-\d+|UMFD-\d+)$' } |
                    Select-Object -Unique | Sort-Object
                Write-Host ("  разных пользователей во входах: {0}" -f $people.Count)
                if ($people.Count -gt 0) {
                    Write-Host ("    {0}" -f ($people -join ", ")) -ForegroundColor Gray
                }
            }
        } catch {
            Write-Host "  событий за период нет"
        }
        Write-Host ""
    }

    Write-Host "Диагностика завершена (выгрузка не выполнялась)." -ForegroundColor Cyan
    Write-Host "Если нужных пользователей нет в списке событий — их нет и в журнале," -ForegroundColor Cyan
    Write-Host "и дашборд их показать не сможет: искать причину надо на стороне Windows." -ForegroundColor Cyan
    return
}

foreach ($spec in $LogSpecs) {
    try {
        $events = Get-WinEvent -FilterHashtable @{
            LogName   = $spec.Log
            Id        = $spec.Ids
            StartTime = $startTime
        } -ErrorAction Stop

        Write-Host ("{0}: найдено {1} событий, разбираю..." -f $spec.Label, @($events).Count) -ForegroundColor Gray
        Add-Records -Events $events -SourceLog $spec.Label
        Write-Progress -Activity "Разбор журнала $($spec.Label)" -Completed
    }
    catch [System.Diagnostics.Eventing.Reader.EventLogNotFoundException] {
        Write-Warning ("Журнал не найден: {0}" -f $spec.Log)
        Write-Warning ("  {0}" -f $spec.Hint)
    }
    catch {
        if ($_.Exception.Message -match 'No events were found|Не найдено событий') {
            Write-Host ("{0}: событий за период не найдено" -f $spec.Label) -ForegroundColor Gray
        } else {
            Write-Warning ("Не удалось прочитать {0}: {1}" -f $spec.Log, $_.Exception.Message)
            Write-Warning ("  {0}" -f $spec.Hint)
        }
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

$distinctUsers = $records |
    Where-Object { $_.User } |
    Select-Object -ExpandProperty User -Unique |
    Sort-Object

Write-Host "Готово: $($records.Count) событий записано в $outFile" -ForegroundColor Green
Write-Host ("Найдено пользователей: {0}" -f $distinctUsers.Count) -ForegroundColor Green
if ($distinctUsers.Count -gt 0) {
    Write-Host ("  {0}" -f ($distinctUsers -join ", ")) -ForegroundColor Gray
}
if ($distinctUsers.Count -le 2) {
    Write-Host ""
    Write-Warning "Пользователей найдено очень мало. Возможные причины:"
    Write-Warning "  1. Скрипт запущен не на том сервере, где люди работают по RDP."
    Write-Warning ("     Сейчас это: {0}" -f $env:COMPUTERNAME)
    Write-Warning "  2. Журнал успел перезаписаться и хранит только последние часы."
    Write-Warning "  3. Отключён аудит входа в систему."
    Write-Warning "Запустите с ключом -Diagnose, чтобы увидеть, что реально в журналах."
}
Write-Host "Добавьте папку '$OutputDir' в дашборде кнопкой 'Добавить папку с логами'." -ForegroundColor Cyan

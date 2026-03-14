param(
    [string]$ProjectRoot = "c:\project\Insight_Paser\ToDit\todit",
    [string]$RecordDir = "c:\project\Insight_Paser\ToDit\todit\autorecord"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $RecordDir)) {
    New-Item -ItemType Directory -Path $RecordDir | Out-Null
}

$statePath = Join-Path $RecordDir ".state.json"
$timestamp = Get-Date
$timestampTag = $timestamp.ToString("yyyy-MM-dd_HH-mm")
$nowKst = $timestamp.ToString("yyyy-MM-dd HH:mm:ss zzz")

$ignoreRootDirs = @(".git", "node_modules", ".next", "autorecord")

function To-RelativePath {
    param([string]$FullName, [string]$Root)

    $r = $FullName.Substring($Root.Length).TrimStart([char]92)
    return $r.Replace([char]92, [char]47)
}

function Classify-Owner {
    param(
        [string]$RelativePath,
        [string]$ProjectRoot
    )

    $p = $RelativePath.ToLowerInvariant()

    # Prefer Git last-commit author/email when available.
    $gitAuthor = ""
    $gitEmail = ""
    try {
        $raw = git -C $ProjectRoot log -1 --format="%an|%ae" -- "$RelativePath" 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($raw)) {
            $parts = $raw.Trim().Split("|", 2)
            if ($parts.Count -ge 1) { $gitAuthor = $parts[0].ToLowerInvariant() }
            if ($parts.Count -ge 2) { $gitEmail = $parts[1].ToLowerInvariant() }
        }
    }
    catch {
        # Fall through to path-based fallback.
    }

    if ($gitAuthor -ne "" -or $gitEmail -ne "") {
        if (($gitAuthor -match "(claude|codex|gpt|agent|ai)") -or ($gitEmail -match "(claude|codex|gpt|agent|ai)")) {
            return "AI 에이전트 구현"
        }
        return "사용자 직접 구현"
    }

    if ($p -like "autorecord/*") {
        return "AI 에이전트 구현"
    }

    if ($p -match "(claude|codex|gpt|agent)") {
        return "AI 에이전트 구현"
    }

    return "사용자 직접 구현"
}

function ConvertTo-Hashtable {
    param([object]$InputObject)

    if ($null -eq $InputObject) { return $null }

    if ($InputObject -is [System.Collections.IDictionary]) {
        $dict = @{}
        foreach ($k in $InputObject.Keys) {
            $dict[$k] = ConvertTo-Hashtable -InputObject $InputObject[$k]
        }
        return $dict
    }

    if ($InputObject -is [System.Collections.IEnumerable] -and -not ($InputObject -is [string])) {
        $arr = @()
        foreach ($item in $InputObject) {
            $arr += ,(ConvertTo-Hashtable -InputObject $item)
        }
        return $arr
    }

    if ($InputObject -is [pscustomobject]) {
        $dict = @{}
        foreach ($prop in $InputObject.PSObject.Properties) {
            $dict[$prop.Name] = ConvertTo-Hashtable -InputObject $prop.Value
        }
        return $dict
    }

    return $InputObject
}

function Format-SizeDeltaText {
    param(
        [long]$Before,
        [long]$After
    )

    $delta = $After - $Before
    $deltaText = if ($delta -ge 0) { "+$delta" } else { "$delta" }
    return "$Before B -> $After B (Δ $deltaText B)"
}

$files = Get-ChildItem -Path $ProjectRoot -Recurse -File | Where-Object {
    $relative = To-RelativePath -FullName $_.FullName -Root $ProjectRoot
    $topLevel = ($relative.Split('/')[0]).ToLowerInvariant()
    -not ($ignoreRootDirs -contains $topLevel)
}

$currentMap = @{}
foreach ($file in $files) {
    $relative = To-RelativePath -FullName $file.FullName -Root $ProjectRoot
    # -Path treats [] as wildcard; use -LiteralPath for exact file hashing.
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash
    $owner = Classify-Owner -RelativePath $relative -ProjectRoot $ProjectRoot

    $currentMap[$relative] = [ordered]@{
        hash = $hash
        size = $file.Length
        lastWriteTimeUtc = $file.LastWriteTimeUtc.ToString("o")
        owner = $owner
    }
}

$previousMap = @{}
$hasPrevious = $false
if (Test-Path $statePath) {
    $raw = Get-Content $statePath -Raw
    if ($raw.Trim().Length -gt 0) {
        $parsedObj = $raw | ConvertFrom-Json
        $parsed = ConvertTo-Hashtable -InputObject $parsedObj
        if ($parsed.ContainsKey("files")) {
            $previousMap = $parsed["files"]
            $hasPrevious = $true
        }
    }
}

$newFiles = New-Object System.Collections.Generic.List[string]
$changedFiles = New-Object System.Collections.Generic.List[string]
$deletedFiles = New-Object System.Collections.Generic.List[string]

foreach ($path in $currentMap.Keys) {
    if (-not $previousMap.ContainsKey($path)) {
        $newFiles.Add($path)
    }
    elseif ($previousMap[$path]["hash"] -ne $currentMap[$path]["hash"]) {
        $changedFiles.Add($path)
    }
}

foreach ($path in $previousMap.Keys) {
    if (-not $currentMap.ContainsKey($path)) {
        $deletedFiles.Add($path)
    }
}

$userNew = @($newFiles | Where-Object { $currentMap[$_]["owner"] -eq "사용자 직접 구현" })
$userChanged = @($changedFiles | Where-Object { $currentMap[$_]["owner"] -eq "사용자 직접 구현" })
$userDeleted = @($deletedFiles | Where-Object { $previousMap[$_]["owner"] -eq "사용자 직접 구현" })
$aiNew = @($newFiles | Where-Object { $currentMap[$_]["owner"] -eq "AI 에이전트 구현" })
$aiChanged = @($changedFiles | Where-Object { $currentMap[$_]["owner"] -eq "AI 에이전트 구현" })
$aiDeleted = @($deletedFiles | Where-Object { $previousMap[$_]["owner"] -eq "AI 에이전트 구현" })

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# 개발일지 자동기록 - $($timestamp.ToString('yyyy-MM-dd HH:mm'))")
$lines.Add("")
$lines.Add("## 실행 정보")
$lines.Add("- 실행 시각: $nowKst")
$lines.Add("- 비교 기준: " + ($(if ($hasPrevious) { "이전 실행 스냅샷" } else { "이전 스냅샷 없음(초기 기준선 생성)" })))
$lines.Add("- 스캔 범위: $ProjectRoot (제외: .git, node_modules, .next, autorecord)")
$lines.Add("")
$lines.Add("## 변경 요약")
$lines.Add("- 신규 파일: $($newFiles.Count)개")
$lines.Add("- 수정 파일: $($changedFiles.Count)개")
$lines.Add("- 삭제 파일: $($deletedFiles.Count)개")
$lines.Add("")
$lines.Add("## 구현 주체 분류")
$lines.Add("- 사용자 직접 구현: 신규 $($userNew.Count)개, 수정 $($userChanged.Count)개, 삭제 $($userDeleted.Count)개")
$lines.Add("- AI 에이전트 구현: 신규 $($aiNew.Count)개, 수정 $($aiChanged.Count)개, 삭제 $($aiDeleted.Count)개")
$lines.Add("")
$lines.Add("## 이전과 달라진 부분")
if ($changedFiles.Count -eq 0 -and $deletedFiles.Count -eq 0) {
    $lines.Add("- 없음")
} else {
    foreach ($p in ($changedFiles | Sort-Object)) {
        $beforeSize = [long]$previousMap[$p]["size"]
        $afterSize = [long]$currentMap[$p]["size"]
        $lines.Add("- [수정][$($currentMap[$p]["owner"])] $p | 크기: $(Format-SizeDeltaText -Before $beforeSize -After $afterSize)")
    }
    foreach ($p in ($deletedFiles | Sort-Object)) {
        $deletedOwner = if ($previousMap.ContainsKey($p) -and $previousMap[$p].ContainsKey("owner")) { $previousMap[$p]["owner"] } else { "미분류" }
        $deletedSize = if ($previousMap.ContainsKey($p) -and $previousMap[$p].ContainsKey("size")) { [long]$previousMap[$p]["size"] } else { 0 }
        $lines.Add("- [삭제][$deletedOwner] $p | 마지막 기록 크기: $deletedSize B")
    }
}
$lines.Add("")
$lines.Add("## 새로 개발된 부분")
if ($newFiles.Count -eq 0) {
    $lines.Add("- 없음")
} else {
    foreach ($p in ($newFiles | Sort-Object)) {
        $newSize = [long]$currentMap[$p]["size"]
        $lines.Add("- [신규][$($currentMap[$p]["owner"])] $p | 크기: $newSize B")
    }
}
$lines.Add("")
$lines.Add("## 분류 기준")
$lines.Add("- 기본: Git 마지막 커밋 작성자/이메일에 claude, codex, gpt, agent, ai가 있으면 AI 에이전트 구현")
$lines.Add("- Git 이력이 없으면 경로/파일명의 claude, codex, gpt, agent 규칙으로 보조 판정")
$lines.Add("- 그 외 파일은 사용자 직접 구현으로 분류")

$reportPath = Join-Path $RecordDir ("devlog_$timestampTag.md")
$lines | Set-Content -Path $reportPath -Encoding UTF8

$state = [ordered]@{
    generatedAt = $timestamp.ToUniversalTime().ToString("o")
    files = $currentMap
}
$state | ConvertTo-Json -Depth 8 | Set-Content -Path $statePath -Encoding UTF8

Write-Output "REPORT=$reportPath"
Write-Output "STATE=$statePath"
Write-Output "NEW=$($newFiles.Count);CHANGED=$($changedFiles.Count);DELETED=$($deletedFiles.Count)"

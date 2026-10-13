# Export a built handbook to PDF through Word, updating the Contents field first.
#
#   powershell -File export_pdf.ps1 "C:\path\SAMAR Portal - Assessor Handbook.docx"
#
# Word is the renderer the reader opens the file in, so its output is the one to
# check page by page. The docx is saved back with the Contents filled in.
param([Parameter(Mandatory = $true)][string]$Docx)

$Docx = (Resolve-Path $Docx).Path
$Pdf = [System.IO.Path]::ChangeExtension($Docx, ".pdf")

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($Docx, $false, $false)
    $doc.Fields.Update() | Out-Null
    foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
    $doc.Save()
    $doc.ExportAsFixedFormat($Pdf, 17)
    $doc.Close($false)
    Write-Output "exported: $Pdf"
} finally {
    $word.Quit()
}

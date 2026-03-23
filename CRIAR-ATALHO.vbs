Dim pastaApp, batPath, atalhoPath, wsh, link

pastaApp = "C:\Users\clark\OneDrive\Documentos\Claude\Projects\ERP\galpao-pro"
batPath  = pastaApp & "\abrir-app.bat"
atalhoPath = CreateObject("WScript.Shell").SpecialFolders("Desktop") & "\CDS Industrial.lnk"

Set wsh  = CreateObject("WScript.Shell")
Set link = wsh.CreateShortcut(atalhoPath)

link.TargetPath       = batPath
link.WorkingDirectory = pastaApp
link.WindowStyle      = 1
link.Description      = "Abre o sistema ERP CDS Industrial"
link.Save()

MsgBox "Atalho 'CDS Industrial' criado na Area de Trabalho!" & Chr(13) & Chr(13) & "Agora e so dar duplo clique nele para abrir o sistema.", 64, "Sucesso"

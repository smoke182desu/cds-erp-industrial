<?php
// One-time cleanup script — neutralize after use
if (($_GET['key']??'') !== 'cds-erp-2026-secure-key') { http_response_code(403); exit; }

$pdo = new PDO('mysql:host=localhost;dbname=cdsind79_erp;charset=utf8mb4','cdsind79_erpuser','CdsErp@2026!',
    [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);

$deleted = [];

// Delete test leads
$s = $pdo->prepare("DELETE FROM leads WHERE nome LIKE '%Teste%' OR nome LIKE '%test%' OR email LIKE '%@test.%'");
$s->execute();
$deleted['leads'] = $s->rowCount();

// Delete test mensagens
$s = $pdo->prepare("DELETE FROM mensagens WHERE remote_jid LIKE '%900000000%' OR conteudo LIKE '%teste CI%' OR conteudo LIKE '%Teste CI%'");
$s->execute();
$deleted['mensagens'] = $s->rowCount();

header('Content-Type: application/json');
echo json_encode(['ok'=>true,'deleted'=>$deleted]);

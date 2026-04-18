<?php
// CDS ERP Industrial — PHP REST API
// Hosted: cdsind.com.br/erp-api/api.php
// Auth: X-Api-Key header

define('DB_HOST', 'localhost');
define('DB_NAME', 'cdsind79_erp');
define('DB_USER', 'cdsind79_erpuser');
define('DB_PASS', 'CdsErp@2026!');
define('API_KEY', 'cds-erp-2026-secure-key');

// CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// Auth (skip for health)
$endpoint = $_GET['endpoint'] ?? '';
if ($endpoint !== 'health') {
    $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['key'] ?? '';
    if ($key !== API_KEY) {
        http_response_code(401);
        echo json_encode(['error' => 'API Key invalida']);
        exit;
    }
}

// DB
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    }
    return $pdo;
}

function uuid(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),
        mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000,
        mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
}

function body(): array {
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}

$method = $_SERVER['REQUEST_METHOD'];

// ——— HEALTH ———
if ($endpoint === 'health') {
    try { getDB(); echo json_encode(['status'=>'ok','db'=>'connected','ts'=>date('c')]); }
    catch(Exception $e) { http_response_code(500); echo json_encode(['status'=>'error','msg'=>$e->getMessage()]); }
    exit;
}

// ——— LEADS ———
// Table cols: id, nome, empresa, telefone, email, origem, status_funil, valor_estimado, observacoes, woocommerce_customer_id, criado_em, atualizado_em
if ($endpoint === 'leads') {
    $db = getDB();
    if ($method === 'GET') {
        $id = $_GET['id'] ?? null;
        if ($id) {
            $s = $db->prepare("SELECT * FROM leads WHERE id=?"); $s->execute([$id]);
            echo json_encode($s->fetch() ?: null);
        } else {
            $s = $db->query("SELECT * FROM leads ORDER BY criado_em DESC LIMIT 500");
            $leads = $s->fetchAll();
            echo json_encode(['ok'=>true,'leads'=>$leads,'total'=>count($leads)]);
        }
    } elseif ($method === 'POST') {
        $b = body(); $id = uuid();
        $db->prepare("INSERT INTO leads (id,nome,email,telefone,empresa,observacoes,origem,status_funil,valor_estimado) VALUES (?,?,?,?,?,?,?,?,?)")
           ->execute([$id,$b['nome']??'',$b['email']??null,$b['telefone']??null,$b['empresa']??null,
                      $b['observacoes']??$b['mensagem']??null,$b['origem']??'manual',
                      $b['status_funil']??$b['etapa']??'lead_novo',
                      $b['valor_estimado']??$b['valor']??null]);
        echo json_encode(['success'=>true,'leadId'=>$id,'id'=>$id]);
    } elseif ($method === 'PUT') {
        $id = $_GET['id'] ?? null;
        if (!$id) { http_response_code(400); echo json_encode(['error'=>'id required']); exit; }
        $b = body();
        $map = ['nome'=>'nome','email'=>'email','telefone'=>'telefone','empresa'=>'empresa',
                'origem'=>'origem','observacoes'=>'observacoes',
                'status_funil'=>'status_funil','etapa'=>'status_funil',
                'valor_estimado'=>'valor_estimado','valor'=>'valor_estimado'];
        $sets=[]; $params=[];
        foreach($map as $from=>$col) {
            if(array_key_exists($from,$b) && !in_array($col,array_column(array_map(null,$sets,$params),'col')??[])){
                $sets[]="$col=?"; $params[]=$b[$from];
            }
        }
        if($sets){$params[]=$id;$db->prepare("UPDATE leads SET ".implode(',',$sets)." WHERE id=?")->execute($params);}
        echo json_encode(['ok'=>true]);
    } elseif (\ === 'DELETE') {
        \ = \['id'] ?? null;
        if (!\) { http_response_code(400); echo json_encode(['error'=>'id required']); exit; }
        \->prepare("DELETE FROM leads WHERE id=?")->execute([\]);
        echo json_encode(['ok'=>true,'deleted'=>true]);
    }
    exit;
}

// ——— CLIENTES ———
// Table cols: id, nome, email, telefone, empresa, origem, tipo, codigo, codigo_formatado, criado_em, atualizado_em
if ($endpoint === 'clientes') {
    $db = getDB();
    if ($method === 'GET') {
        $tel = $_GET['telefone'] ?? null;
        if ($tel) {
            $s=$db->prepare("SELECT * FROM clientes WHERE telefone=? LIMIT 1"); $s->execute([$tel]);
            echo json_encode($s->fetch() ?: null);
        } else {
            $s=$db->query("SELECT * FROM clientes ORDER BY criado_em DESC LIMIT 500");
            echo json_encode($s->fetchAll());
        }
    } elseif ($method === 'POST') {
        $b = body(); $tel = $b['telefone']??null;
        if ($tel) {
            $s=$db->prepare("SELECT id FROM clientes WHERE telefone=? LIMIT 1"); $s->execute([$tel]);
            $ex=$s->fetchColumn();
            if ($ex) {
                $db->prepare("UPDATE clientes SET nome=?,email=?,empresa=?,origem=?,tipo=? WHERE id=?")
                   ->execute([$b['nome']??'',$b['email']??null,$b['empresa']??null,$b['origem']??'manual',$b['tipo']??'pre_cadastro',$ex]);
                echo json_encode(['id'=>$ex,'updated'=>true]); exit;
            }
        }
        $id=uuid();
        $db->prepare("INSERT INTO clientes (id,nome,email,telefone,empresa,origem,tipo,codigo,codigo_formatado) VALUES (?,?,?,?,?,?,?,?,?)")
           ->execute([$id,$b['nome']??'',$b['email']??null,$tel,$b['empresa']??null,$b['origem']??'manual',$b['tipo']??'pre_cadastro',$b['codigo']??null,$b['codigoFormatado']??$b['codigo_formatado']??null]);
        echo json_encode(['id'=>$id]);
    }
    exit;
}

// ——— MENSAGENS ———
// Table cols: id, remote_jid, message_id, tipo, conteudo, tipo_midia, nome_contato, nome_empresa, timestamp_msg, ia_analise, lead_id, criado_em
// NOTE: remote_jid stores phone as "5561999...@s.whatsapp.net" or plain number
if ($endpoint === 'mensagens') {
    $db = getDB();
    if ($method === 'GET') {
        $tel = $_GET['telefone'] ?? null;
        if ($tel) {
            // Match remote_jid that contains the phone number
            $s=$db->prepare("SELECT * FROM mensagens WHERE remote_jid LIKE ? OR remote_jid=? ORDER BY criado_em ASC LIMIT 200");
            $s->execute(['%'.$tel.'%', $tel]);
            echo json_encode($s->fetchAll());
        } else {
            $s=$db->query("SELECT * FROM mensagens ORDER BY criado_em DESC LIMIT 200");
            echo json_encode($s->fetchAll());
        }
    } elseif ($method === 'POST') {
        $b = body(); $id=uuid();
        $tel = $b['telefone']??$b['remote_jid']??'';
        $conteudo = $b['conteudo']??$b['texto']??$b['mensagem']??'';
        $tipo = $b['tipo']??'entrada';
        $db->prepare("INSERT INTO mensagens (id,remote_jid,conteudo,tipo,lead_id,message_id) VALUES (?,?,?,?,?,?)")
           ->execute([$id,$tel,$conteudo,$tipo,$b['lead_id']??null,$b['message_id']??null]);
        echo json_encode(['id'=>$id]);
    }
    exit;
}

// ——— PRODUTOS ———
// Table cols: id, nome, codigo, sku, categoria, descricao, material, acabamento, peso, largura, altura, comprimento, preco, preco_custo, estoque, woocommerce_id, status, criado_em, atualizado_em
if ($endpoint === 'produtos') {
    $db = getDB();
    if ($method === 'GET') {
        $s=$db->query("SELECT * FROM produtos WHERE status='publish' ORDER BY nome ASC LIMIT 1000");
        echo json_encode($s->fetchAll());
    } elseif ($method === 'POST') {
        $b = body();
        $wcId = $b['woocommerce_id']??$b['wc_id']??$b['id']??null;
        if ($wcId) {
            $s=$db->prepare("SELECT id FROM produtos WHERE woocommerce_id=? LIMIT 1"); $s->execute([$wcId]);
            $ex=$s->fetchColumn();
            if ($ex) {
                $db->prepare("UPDATE produtos SET nome=?,sku=?,preco=?,estoque=?,status=?,categoria=?,descricao=?,atualizado_em=NOW() WHERE id=?")
                   ->execute([$b['nome']??'',$b['sku']??null,$b['preco']??0,$b['estoque']??0,$b['status']??'publish',$b['categoria']??null,$b['descricao']??null,$ex]);
                echo json_encode(['id'=>$ex,'updated'=>true]); exit;
            }
        }
        $id=uuid();
        $db->prepare("INSERT INTO produtos (id,woocommerce_id,nome,sku,preco,estoque,status,categoria,descricao) VALUES (?,?,?,?,?,?,?,?,?)")
           ->execute([$id,$wcId,$b['nome']??'',$b['sku']??null,$b['preco']??0,$b['estoque']??0,$b['status']??'publish',$b['categoria']??null,$b['descricao']??null]);
        echo json_encode(['id'=>$id]);
    }
    exit;
}

// ——— CONFIG ———
if ($endpoint === 'config') {
    $db = getDB();
    $col = $_GET['collection'] ?? 'config';
    $doc = $_GET['doc'] ?? 'geral';
    if ($method === 'GET') {
        $s=$db->prepare("SELECT data FROM config WHERE col_name=? AND doc_name=?"); $s->execute([$col,$doc]);
        $row=$s->fetchColumn();
        echo $row ?? '{}';
    } elseif ($method === 'POST' || $method === 'PUT') {
        $b = body();
        $db->prepare("INSERT INTO config (col_name,doc_name,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=?, atualizado_em=NOW()")
           ->execute([$col,$doc,json_encode($b),json_encode($b)]);
        echo json_encode(['ok'=>true]);
    } elseif (\ === 'DELETE') {
        \ = \['id'] ?? null;
        if (!\) { http_response_code(400); echo json_encode(['error'=>'id required']); exit; }
        \->prepare("DELETE FROM leads WHERE id=?")->execute([\]);
        echo json_encode(['ok'=>true,'deleted'=>true]);
    }
    exit;
}

// ——— PROJETOS ———
if ($endpoint === 'projects') {
    $db = getDB();
    $id = $_GET['id'] ?? null;
    if ($method === 'GET' && $id) {
        $s=$db->prepare("SELECT * FROM projetos WHERE id=? AND is_public=1"); $s->execute([$id]);
        $row=$s->fetch();
        if ($row) {
            $row['data'] = json_decode($row['data']??'{}', true);
            $row['company_config'] = json_decode($row['company_config']??'{}', true);
            echo json_encode(['project'=>$row]);
        } else { http_response_code(404); echo json_encode(['error'=>'not found']); }
    } elseif ($method === 'POST') {
        $b = body(); $id=uuid();
        $db->prepare("INSERT INTO projetos (id,nome,data,company_config,user_id,is_public,atualizado_em) VALUES (?,?,?,?,?,?,?)")
           ->execute([$id,$b['name']??'Projeto',json_encode($b['data']??$b),json_encode($b['companyConfig']??[]),$b['userId']??null,1,$b['updated_at']??time()]);
        echo json_encode(['id'=>$id]);
    }
    exit;
}

// ——— PROPOSALS ———
if ($endpoint === 'proposals') {
    $db = getDB();
    if ($method === 'POST') {
        $b = body(); $id=uuid();
        $db->prepare("INSERT INTO proposals (id,client_id,project_summary,signature,created_at) VALUES (?,?,?,?,?)")
           ->execute([$id,$b['clientId']??null,json_encode($b['projectSummary']??[]),$b['signature']??null,$b['createdAt']??time()]);
        echo json_encode(['id'=>$id]);
    } elseif ($method === 'GET') {
        $s=$db->query("SELECT * FROM proposals ORDER BY created_at DESC LIMIT 100");
        echo json_encode($s->fetchAll());
    }
    exit;
}

// ——— WEBHOOK (Evolution API) ———
// mensagens cols: id, remote_jid, message_id, tipo, conteudo, lead_id, criado_em
if ($endpoint === 'webhook') {
    $b = body();
    $db = getDB();
    $event = $b['event'] ?? $b['type'] ?? '';

    if (in_array($event, ['MESSAGES_UPSERT','messages.upsert','MESSAGE_RECEIVED'])) {
        $msgs = $b['data'] ?? $b['messages'] ?? [$b];
        foreach($msgs as $msg) {
            $remoteJid = $msg['key']['remoteJid']??$msg['from']??'';
            $tel = preg_replace('/\D/','',$remoteJid);
            $conteudo = $msg['message']['conversation']??$msg['message']['extendedTextMessage']['text']??$msg['body']??'';
            $tipo = ($msg['key']['fromMe']??false) ? 'saida' : 'entrada';
            if (!$tel || !$conteudo) continue;
            $msgId = $msg['key']['id']??null;
            // Dedup by message_id
            if ($msgId) {
                $ck=$db->prepare("SELECT id FROM mensagens WHERE message_id=? LIMIT 1"); $ck->execute([$msgId]);
                if ($ck->fetchColumn()) continue;
            }
            try {
                // Find lead_id by phone
                $ls=$db->prepare("SELECT id FROM leads WHERE telefone=? LIMIT 1"); $ls->execute([$tel]);
                $leadId=$ls->fetchColumn()?:null;
                $id=uuid();
                $db->prepare("INSERT INTO mensagens (id,remote_jid,conteudo,tipo,lead_id,message_id) VALUES (?,?,?,?,?,?)")
                   ->execute([$id,$remoteJid,$conteudo,$tipo,$leadId,$msgId]);
                // Create lead if none
                if (!$leadId) {
                    $db->prepare("INSERT INTO leads (id,nome,telefone,origem,status_funil) VALUES (?,?,?,?,?)")
                       ->execute([uuid(),$tel,$tel,'whatsapp','lead_novo']);
                }
            } catch(Exception $e) {}
        }
    }
    echo json_encode(['ok'=>true,'event'=>$event]);
    exit;
}

http_response_code(400);
echo json_encode(['error'=>'endpoint invalido','endpoints'=>['health','leads','clientes','mensagens','produtos','config','projects','proposals','webhook']]);

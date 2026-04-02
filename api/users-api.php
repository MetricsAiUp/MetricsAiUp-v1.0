<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dataFile = __DIR__ . '/users.json';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents($dataFile), true);

if ($action === 'login') {
    $email = strtolower($_GET['email'] ?? '');
    $password = $_GET['password'] ?? '';
    if (!$email || !$password) { http_response_code(400); echo json_encode(['error' => 'Email and password required']); exit; }

    $user = null;
    foreach ($data['users'] as $u) {
        if (strtolower($u['email']) === $email) { $user = $u; break; }
    }
    if (!$user) { http_response_code(401); echo json_encode(['error' => 'User not found']); exit; }
    if (!$user['isActive']) { http_response_code(403); echo json_encode(['error' => 'User is disabled']); exit; }
    if ($user['password'] !== $password) { http_response_code(401); echo json_encode(['error' => 'Wrong password']); exit; }

    $token = base64_encode(json_encode(['userId' => $user['id'], 'ts' => time()]));
    unset($user['password']);
    echo json_encode(['token' => $token, 'user' => $user]);
    exit;
}

if ($action === 'list') {
    echo json_encode($data);
    exit;
}

if ($action === 'create') {
    $body = json_decode($_GET['data'] ?? '{}', true);
    $newUser = [
        'id' => 'user-' . time() . rand(100, 999),
        'email' => $body['email'] ?? '',
        'password' => $body['password'] ?: 'demo123',
        'firstName' => $body['firstName'] ?? '',
        'lastName' => $body['lastName'] ?? '',
        'role' => $body['role'] ?? 'viewer',
        'isActive' => $body['isActive'] ?? true,
        'createdAt' => date('Y-m-d'),
        'pages' => $body['pages'] ?? ['dashboard'],
    ];
    $data['users'][] = $newUser;
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode($newUser);
    exit;
}

if ($action === 'update') {
    $id = $_GET['id'] ?? '';
    $body = json_decode($_GET['data'] ?? '{}', true);
    foreach ($data['users'] as &$u) {
        if ($u['id'] === $id) {
            $oldPass = $u['password'];
            $u = array_merge($u, $body);
            $u['id'] = $id;
            if (empty($body['password'])) $u['password'] = $oldPass ?: 'demo123';
            file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode($u);
            exit;
        }
    }
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
}

if ($action === 'delete') {
    $id = $_GET['id'] ?? '';
    $data['users'] = array_values(array_filter($data['users'], fn($u) => $u['id'] !== $id));
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['error' => 'Unknown action']);

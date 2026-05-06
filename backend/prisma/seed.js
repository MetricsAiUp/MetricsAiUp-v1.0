const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Permissions
  const permissionData = [
    { key: 'view_dashboard', displayName: 'Просмотр дашборда', group: 'dashboard' },
    { key: 'view_analytics', displayName: 'Просмотр аналитики', group: 'analytics' },
    { key: 'view_zones', displayName: 'Просмотр зон', group: 'zones' },
    { key: 'manage_zones', displayName: 'Управление зонами', group: 'zones' },
    { key: 'view_posts', displayName: 'Просмотр постов', group: 'posts' },
    { key: 'view_sessions', displayName: 'Просмотр сессий авто', group: 'sessions' },
    { key: 'view_events', displayName: 'Просмотр событий', group: 'events' },
    { key: 'view_work_orders', displayName: 'Просмотр заказ-нарядов', group: 'work_orders' },
    { key: 'manage_work_orders', displayName: 'Управление заказ-нарядами', group: 'work_orders' },
    { key: 'view_recommendations', displayName: 'Просмотр рекомендаций', group: 'recommendations' },
    { key: 'manage_users', displayName: 'Управление пользователями', group: 'admin' },
    { key: 'manage_roles', displayName: 'Управление ролями', group: 'admin' },
    { key: 'manage_settings', displayName: 'Управление настройками', group: 'admin' },
    { key: 'view_cameras', displayName: 'Просмотр камер', group: 'cameras' },
    { key: 'manage_cameras', displayName: 'Управление камерами', group: 'cameras' },
    { key: 'view_1c', displayName: 'Просмотр 1С', group: '1c' },
    { key: 'manage_1c_import', displayName: 'Импорт 1С', group: '1c' },
    { key: 'manage_1c_config', displayName: 'Настройки IMAP/1С', group: '1c' },
    { key: 'manage_discrepancies', displayName: 'Управление нестыковками', group: 'discrepancies' },
  ];

  const permissions = {};
  for (const p of permissionData) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: p,
      create: p,
    });
    permissions[p.key] = perm.id;
  }

  // Roles
  const roles = {
    admin: await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: { name: 'admin', displayName: 'Администратор', description: 'Полный доступ' },
    }),
    director: await prisma.role.upsert({
      where: { name: 'director' },
      update: {},
      create: { name: 'director', displayName: 'Директор', description: 'Доступ к аналитике и управлению' },
    }),
    manager: await prisma.role.upsert({
      where: { name: 'manager' },
      update: {},
      create: { name: 'manager', displayName: 'Менеджер', description: 'Мастер-приёмщик' },
    }),
    mechanic: await prisma.role.upsert({
      where: { name: 'mechanic' },
      update: {},
      create: { name: 'mechanic', displayName: 'Механик', description: 'Просмотр своего поста' },
    }),
    viewer: await prisma.role.upsert({
      where: { name: 'viewer' },
      update: {},
      create: { name: 'viewer', displayName: 'Наблюдатель', description: 'Только просмотр' },
    }),
  };

  // Role-Permission mappings
  const rolePerms = {
    admin: Object.keys(permissions), // все права
    director: ['view_dashboard', 'view_analytics', 'view_zones', 'view_posts', 'view_sessions', 'view_events', 'view_work_orders', 'view_recommendations', 'view_cameras', 'view_1c', 'manage_discrepancies'],
    manager: ['view_dashboard', 'view_zones', 'view_posts', 'view_sessions', 'view_events', 'view_work_orders', 'manage_work_orders', 'view_recommendations', 'view_1c', 'manage_1c_import', 'manage_discrepancies'],
    mechanic: ['view_dashboard', 'view_posts', 'view_sessions'],
    viewer: ['view_dashboard', 'view_zones', 'view_posts', 'view_1c'],
  };

  for (const [roleName, permKeys] of Object.entries(rolePerms)) {
    for (const key of permKeys) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles[roleName].id,
            permissionId: permissions[key],
          },
        },
        update: {},
        create: {
          roleId: roles[roleName].id,
          permissionId: permissions[key],
        },
      });
    }
  }

  // Admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@metricsai.up' },
    update: {},
    create: {
      email: 'admin@metricsai.up',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'MetricsAI',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: roles.admin.id } },
    update: {},
    create: { userId: adminUser.id, roleId: roles.admin.id },
  });

  // Additional users (matching frontend mock data)
  const additionalUsers = [
    { email: 'demo@metricsai.up', password: 'demo12345', firstName: 'Генри', lastName: 'Форд', role: 'manager' },
    { email: 'manager@metricsai.up', password: 'demo123', firstName: 'Сергей', lastName: 'Петров', role: 'manager' },
    { email: 'mechanic@metricsai.up', password: 'demo123', firstName: 'Иван', lastName: 'Козлов', role: 'mechanic', isActive: false },
  ];

  for (const u of additionalUsers) {
    const hashed = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: hashed,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: u.isActive !== false,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[u.role].id } },
      update: {},
      create: { userId: user.id, roleId: roles[u.role].id },
    });
  }

  console.log('Seed completed!');
  console.log('Users: admin@metricsai.up/admin123, demo@metricsai.up/demo12345, manager@metricsai.up/demo123, mechanic@metricsai.up/demo123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import type { StaffMember, TeacherCredentials } from '@heroes/shared/api';
import type { Prisma, SchoolRole } from '../../generated/prisma/client';
import type { AuthUser } from '../../platform/auth.js';
import { generatePassword, hashPassword } from '../../platform/credentials.js';
import { prisma } from '../../platform/db.js';
import { HttpError, isUniqueViolation, notFound } from '../../platform/errors.js';
import { lockSchool } from '../access/index.js';
import { LOGIN_TAKEN } from './join.service.js';

/** Сотрудников администрации одной школы не больше этого */
export const MAX_STAFF = 50;

const ROLE_ORDER: Record<SchoolRole, number> = { DIRECTOR: 0, DEPUTY: 1, STAFF: 2 };

export async function schoolStaff(user: AuthUser): Promise<StaffMember[]> {
  const rows = await prisma.admin.findMany({
    where: { schoolId: user.schoolId! },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, role: true, departmentId: true, accountId: true, account: { select: { login: true } } },
  });
  return rows
    .map((a) => ({
      id: a.id, name: a.name, login: a.account.login, role: a.role, departmentId: a.departmentId, isMe: a.accountId === user.accountId,
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

/**
 * Состав администрации меняет только директор и только у других: свою должность снять нельзя,
 * поэтому в школе всегда остаётся директор. Блокировка школы и повторная проверка должности
 * не дают двум директорам одновременно понизить друг друга.
 */
async function asDirector<T>(user: AuthUser, staffId: string | null, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await lockSchool(tx, user.schoolId!);
    const me = await tx.admin.findUnique({ where: { accountId: user.accountId }, select: { id: true, role: true } });
    if (me?.role !== 'DIRECTOR') throw new HttpError(403, 'Это может сделать только директор');
    if (staffId === me.id) throw new HttpError(400, 'Свою должность и вход здесь изменить нельзя');
    if (staffId && !(await tx.admin.count({ where: { id: staffId, schoolId: user.schoolId! } }))) {
      throw notFound('Сотрудник не найден');
    }
    return run(tx);
  });
}

export async function createStaff(user: AuthUser, input: { name: string; login: string; role: SchoolRole }): Promise<TeacherCredentials> {
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  try {
    const admin = await asDirector(user, null, async (tx) => {
      if ((await tx.admin.count({ where: { schoolId: user.schoolId! } })) >= MAX_STAFF) {
        throw new HttpError(400, `В администрации может быть не больше ${MAX_STAFF} человек`);
      }
      return tx.admin.create({
        data: {
          name: input.name,
          role: input.role,
          school: { connect: { id: user.schoolId! } },
          account: { create: { login: input.login, role: 'ADMIN', passwordHash } },
        },
        select: { id: true },
      });
    });
    return { id: admin.id, name: input.name, login: input.login, password };
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, LOGIN_TAKEN);
    throw err;
  }
}

export async function setStaffRole(user: AuthUser, staffId: string, role: SchoolRole) {
  await asDirector(user, staffId, (tx) => tx.admin.update({ where: { id: staffId }, data: { role } }));
  return schoolStaff(user);
}

/** Новый пароль сотруднику: старый и все его сеансы перестают работать */
export async function resetStaffPassword(user: AuthUser, staffId: string): Promise<TeacherCredentials> {
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  return asDirector(user, staffId, async (tx) => {
    const admin = await tx.admin.findUniqueOrThrow({ where: { id: staffId }, select: { name: true, accountId: true, account: true } });
    await tx.account.update({ where: { id: admin.accountId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { accountId: admin.accountId } });
    return { id: staffId, name: admin.name, login: admin.account.login, password };
  });
}

/** Удаляется весь вход сотрудника вместе с сеансами */
export async function removeStaff(user: AuthUser, staffId: string) {
  await asDirector(user, staffId, async (tx) => {
    const { accountId } = await tx.admin.findUniqueOrThrow({ where: { id: staffId }, select: { accountId: true } });
    await tx.account.delete({ where: { id: accountId } });
  });
  return schoolStaff(user);
}

/** Закрепить сотрудника за подразделением: он увидит только его группы. null — всё учреждение */
export async function setStaffDepartment(user: AuthUser, staffId: string, departmentId: string | null) {
  await asDirector(user, staffId, async (tx) => {
    if (departmentId && !(await tx.department.count({ where: { id: departmentId, schoolId: user.schoolId! } }))) {
      throw notFound('Подразделение не найдено');
    }
    await tx.admin.update({ where: { id: staffId }, data: { departmentId } });
  });
  return schoolStaff(user);
}

import ExcelJS from 'exceljs';
import type { NetworkOverview } from '@heroes/shared/api';
import { TERMS } from '@heroes/shared/terms';
import { prisma } from '../../platform/db.js';
import { add, empty, groupTotals, row } from '../dashboard/index.js';

/**
 * Панель руководителя сети: те же показатели, что у руководителя учреждения, но строка — целое учреждение.
 * Учеников, групп по именам и переписки руководитель сети не видит: только сводные цифры
 */
export async function networkOverview(networkId: string, from: string, to: string): Promise<NetworkOverview> {
  const network = await prisma.network.findUniqueOrThrow({
    where: { id: networkId },
    select: {
      name: true,
      schools: {
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, kind: true, _count: { select: { teachers: { where: { pendingSince: null, disabledAt: null } } } } },
      },
    },
  });
  const schoolIds = network.schools.map((s) => s.id);
  const groups = await prisma.group.findMany({
    where: { teacher: { schoolId: { in: schoolIds } }, archivedAt: null },
    select: { id: true, teacher: { select: { schoolId: true } } },
  });
  const perGroup = await groupTotals(groups.map((g) => g.id), from, to);
  const total = empty();
  const schools = network.schools.map((s) => {
    const totals = empty();
    for (const g of groups) if (g.teacher.schoolId === s.id) add(totals, perGroup.get(g.id)!);
    add(total, totals);
    return { ...row(s.id, s.name, totals), kind: s.kind, teachers: s._count.teachers };
  });
  const teachers = schools.reduce((sum, s) => sum + s.teachers, 0);
  return { name: network.name, from, to, total: { ...row('total', 'Всего', total), teachers }, schools };
}

const fmt = (key: string) => key.split('-').reverse().join('.');

export async function networkWorkbook(o: NetworkOverview): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Герои класса';
  const sheet = wb.addWorksheet('Сеть', { views: [{ state: 'frozen', ySplit: 3 }] });
  sheet.mergeCells('A1:J1');
  sheet.getCell('A1').value = `${o.name}, ${fmt(o.from)} - ${fmt(o.to)}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.columns = [34, 12, 9, 14, 15, 15, 10, 15, 10, 10].map((width) => ({ width }));
  sheet.getRow(3).values = [
    'Учреждение', 'Тип', 'Групп', 'Обучающихся', 'Преподавателей', 'Вовлечённость', 'Уроков', 'Посещаемость', 'Плюсы', 'Минусы',
  ];
  sheet.getRow(3).font = { bold: true };
  for (const r of [...o.schools, { ...o.total, kind: null }]) {
    const kind = r.kind ? TERMS[r.kind].kindName : '';
    const added = sheet.addRow([r.name, kind, r.groups, r.students, r.teachers, r.engagement, r.lessons, r.attendance, r.earned, -r.lost]);
    added.getCell(6).numFmt = '0%';
    added.getCell(8).numFmt = '0%';
    if (!r.kind) added.font = { bold: true };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

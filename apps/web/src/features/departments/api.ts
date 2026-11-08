import { api, type Department } from '../../lib/api';

type DepartmentData = { name: string; parentId: string | null };

export const fetchDepartments = () => api<Department[]>('GET', '/admin/departments');

export const createDepartment = (data: DepartmentData) => api<Department[]>('POST', '/admin/departments', data);

export const updateDepartment = (id: string, data: DepartmentData) => api<Department[]>('PATCH', `/admin/departments/${id}`, data);

export const deleteDepartment = (id: string) => api<Department[]>('DELETE', `/admin/departments/${id}`);

/** Подразделения деревом: верхний уровень и вложенные в него, по алфавиту */
export function departmentTree(list: Department[]) {
  const top = list.filter((d) => !d.parentId);
  return top.map((d) => ({ ...d, children: list.filter((c) => c.parentId === d.id) }));
}

/** Плоский список для выбора: вложенные с отступом после своего подразделения */
export function departmentOptions(list: Department[]) {
  return departmentTree(list).flatMap((d) => [
    { id: d.id, label: d.name },
    ...d.children.map((c) => ({ id: c.id, label: `— ${c.name}` })),
  ]);
}

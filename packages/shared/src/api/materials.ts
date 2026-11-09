/** Типы ответов API: методички преподавателя */

export type MaterialKind = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'text';

export interface MaterialItem {
  id: string;
  title: string;
  description: string;
  /** Имя загруженного файла */
  name: string;
  kind: MaterialKind;
  size: number;
  /** Видят коллеги учреждения */
  shared: boolean;
  mine: boolean;
  author: string;
  createdAt: string;
  /** Можно смотреть на сайте прямо сейчас; у документов Office — когда готова PDF-копия */
  viewable: boolean;
}

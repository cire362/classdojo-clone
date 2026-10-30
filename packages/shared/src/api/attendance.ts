/** Типы ответов API: посещаемость */

export interface Detection {
  count: number;
  width: number;
  height: number;
  boxes: { x: number; y: number; w: number; h: number; score: number }[];
  elapsedMs: number;
}

export interface AttendanceDay {
  date: string;
  lesson: number;
  lessons: { lesson: number; presentCount: number; studentsTotal: number; peopleOnPhoto: number | null }[];
  session: {
    peopleOnPhoto: number | null;
    subtractedTeacher: boolean;
    presentStudentIds: string[];
    markedStudentIds: string[];
  } | null;
}

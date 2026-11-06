import { useParams } from 'react-router-dom';
import { AssignmentReview } from './AssignmentReview';
import { GroupAssignments } from './GroupAssignments';

/** Задания группы, а по адресу с id задания — ответы на него */
export function GroupAssignmentsView() {
  const { assignmentId } = useParams();
  return assignmentId ? <AssignmentReview key={assignmentId} assignmentId={assignmentId} /> : <GroupAssignments />;
}

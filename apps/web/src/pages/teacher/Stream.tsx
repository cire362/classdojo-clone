import { useParams } from 'react-router-dom';
import { StreamBoard } from '../../features/streams';

export function StreamPage() {
  const { streamId = '' } = useParams();
  return <StreamBoard key={streamId} streamId={streamId} />;
}
